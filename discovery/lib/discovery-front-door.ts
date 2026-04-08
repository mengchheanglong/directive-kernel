import fs from "node:fs";
import path from "node:path";

import {
  DirectiveEngine,
  createDirectiveWorkspaceEngineLanes,
  normalizeDirectiveEngineSourceTypeInput,
  type DirectiveEngineCapabilityGap,
  type DirectiveEngineMissionInput,
  type DirectiveEngineRunRecord,
  type DirectiveEngineSourceItem,
} from "../../engine/index.ts";
import {
  appendDiscoveryIntakeQueueEntry,
  type DiscoveryIntakeQueueDocument,
  type DiscoveryIntakeQueueEntry,
  type DiscoveryRoutingTarget,
} from "./discovery-intake-queue-writer.ts";
import type { DiscoverySubmissionRequest } from "./discovery-submission-router.ts";
import {
  resolveDiscoveryIntakeRecordPath,
  resolveDiscoveryTriageRecordPath,
} from "./discovery-case-record-writer.ts";
import {
  resolveDiscoveryRoutingRecordPath,
  type DiscoveryRoutingDecisionState,
} from "./discovery-routing-record-writer.ts";
import {
  syncDiscoveryIntakeLifecycle,
  type DiscoveryIntakeLifecycleSyncRequest,
} from "./discovery-intake-lifecycle-sync.ts";
import type { CapabilityGapRecord } from "./discovery-gap-worklist-generator.ts";
import { mirrorDirectiveDiscoveryFrontDoorSubmission } from "../../engine/cases/case-store.ts";
import {
  writeDirectiveDiscoveryFrontDoorProjectionSet,
  type DirectiveMirroredDiscoveryFrontDoorProjectionInput,
} from "./discovery-front-door-projections.ts";
import { readJson, writeJson as writeJsonPretty, writeUtf8 } from "../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

type DiscoveryFrontDoorDecision = {
  routingTarget: Exclude<DiscoveryRoutingTarget, null>;
  decisionState: DiscoveryRoutingDecisionState;
  adoptionTarget: string;
  receivingTrackOwner: string;
  requiredNextArtifact: string;
  reviewCadence: string;
};

function filterRoutingRationaleLines(lines: string[]) {
  return lines.filter((line) => !/(Fast-path|Split-case|Queue-only) is recommended/i.test(line));
}

export type DirectiveDiscoveryFrontDoorResult = {
  ok: true;
  candidateId: string;
  queuePath: string;
  queueEntry: DiscoveryIntakeQueueEntry;
  sourceType: {
    submittedType: string;
    canonicalType: DirectiveEngineSourceItem["sourceType"];
    normalizedFrom: string | null;
    normalizationKind: "none" | "format" | "alias";
  };
  createdPaths: {
    intakeRecordPath: string;
    triageRecordPath: string;
    routingRecordPath: string;
  };
  discovery: {
    usefulnessLevel: string;
    usefulnessRationale: string;
    routingTarget: Exclude<DiscoveryRoutingTarget, null>;
    decisionState: DiscoveryRoutingDecisionState;
    missionPriorityScore: number;
    confidence: string;
    matchedGapId: string | null;
    proofKind: string;
    proofObjective: string;
    proofRequiredGates: string[];
    proofRequiredEvidence: string[];
    nextAction: string;
  };
  engine: {
    recordPath: string;
    recordRelativePath: string;
    reportPath: string;
    reportRelativePath: string;
    record: DirectiveEngineRunRecord;
  };
};

function normalizeRelativeDirectivePath(
  directiveRoot: string,
  filePath: string,
) {
  return path.relative(directiveRoot, filePath).replace(/\\/g, "/");
}

function sanitizePathSegment(value: string) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizeReceivedAt(value: string | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return new Date().toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized}T00:00:00.000Z`;
  }
  return normalized;
}



function loadQueue(directiveRoot: string) {
  return readJson<DiscoveryIntakeQueueDocument>(
    path.join(directiveRoot, "discovery", "intake-queue.json"),
  );
}

function loadCapabilityGaps(directiveRoot: string) {
  const payload = readJson<{ gaps?: CapabilityGapRecord[] }>(
    path.join(directiveRoot, "discovery", "capability-gaps.json"),
  );
  return payload.gaps ?? [];
}

function loadActiveMissionMarkdown(directiveRoot: string) {
  return fs.readFileSync(
    path.join(directiveRoot, "knowledge", "active-mission.md"),
    "utf8",
  );
}

function loadUnresolvedGapIds(gaps: CapabilityGapRecord[]) {
  return gaps.filter((gap) => !gap.resolved_at).map((gap) => gap.gap_id);
}

function buildDirectiveEngineSourceFromDiscoverySubmission(
  request: DiscoverySubmissionRequest,
): DirectiveEngineSourceItem {
  const notes = [
    typeof request.notes === "string" ? request.notes : null,
    request.record_shape ? `record_shape:${request.record_shape}` : null,
  ].filter((value): value is string => Boolean(value && value.trim()));
  const summary =
    request.mission_alignment?.trim()
    || "Discovery front-door submission processed by Directive Workspace.";

  return {
    sourceId: request.candidate_id,
    sourceType: request.source_type ?? "internal-signal",
    sourceRef: request.source_reference,
    title: request.candidate_name,
    summary,
    notes,
    missionAlignmentHint: request.mission_alignment ?? null,
    capabilityGapId: request.capability_gap_id ?? null,
    primaryAdoptionTarget: request.primary_adoption_target ?? null,
    containsExecutableCode: request.contains_executable_code ?? null,
    containsWorkflowPattern: request.contains_workflow_pattern ?? null,
    improvesDirectiveWorkspace: request.improves_directive_workspace ?? null,
    workflowBoundaryShape: request.workflow_boundary_shape ?? null,
  };
}

function buildDirectiveEngineMission(
  activeMissionMarkdown: string,
): DirectiveEngineMissionInput {
  return {
    missionId: "directive-workspace-discovery-front-door",
    activeMissionMarkdown,
  };
}

function buildDirectiveEngineCapabilityGaps(
  gaps: CapabilityGapRecord[],
): DirectiveEngineCapabilityGap[] {
  return gaps
    .filter((gap) => !gap.resolved_at)
    .map((gap) => ({
      gapId: gap.gap_id,
      description: gap.description,
      priority: gap.priority,
      relatedMissionObjective: gap.related_mission_objective,
      currentState: gap.current_state,
      desiredState: gap.desired_state,
      detectedAt: gap.detected_at,
      resolvedAt: gap.resolved_at ?? null,
      resolutionNotes: gap.resolution_notes ?? null,
    }));
}

function resolveEngineArtifactPaths(input: {
  directiveRoot: string;
  runtimeArtifactsRoot: string;
  record: DirectiveEngineRunRecord;
}) {
  const runtimeArtifactsRoot = normalizeAbsolutePath(input.runtimeArtifactsRoot);
  const artifactDir = path.resolve(runtimeArtifactsRoot, "engine-runs");
  const timestamp = input.record.receivedAt.replace(/[:.]/g, "-");
  const candidateSegment =
    sanitizePathSegment(input.record.candidate.candidateId)
    || sanitizePathSegment(input.record.runId)
    || "directive-engine-run";
  const runSegment = input.record.runId.slice(0, 8).toLowerCase();
  const baseName = `${timestamp}-${candidateSegment}-${runSegment}`;
  const recordPath = normalizeAbsolutePath(path.resolve(artifactDir, `${baseName}.json`));
  const reportPath = normalizeAbsolutePath(path.resolve(artifactDir, `${baseName}.md`));

  return {
    recordPath,
    reportPath,
    recordRelativePath: normalizeRelativeDirectivePath(input.directiveRoot, recordPath),
    reportRelativePath: normalizeRelativeDirectivePath(input.directiveRoot, reportPath),
  };
}

function renderDirectiveEngineRunReport(input: {
  record: DirectiveEngineRunRecord;
  recordRelativePath: string;
}) {
  const { record } = input;

  return [
    "# Directive Engine Run",
    "",
    `- Run ID: \`${record.runId}\``,
    `- Received At: \`${record.receivedAt}\``,
    `- Candidate ID: \`${record.candidate.candidateId}\``,
    `- Candidate Name: ${record.candidate.candidateName}`,
    `- Source Type: \`${record.source.sourceType}\``,
    `- Source Ref: \`${record.source.sourceRef}\``,
    `- Selected Lane: \`${record.selectedLane.laneId}\``,
    `- Usefulness Level: \`${record.candidate.usefulnessLevel}\``,
    `- Decision State: \`${record.decision.decisionState}\``,
    `- Integration Mode: \`${record.integrationProposal.integrationMode}\``,
    `- Proof Kind: \`${record.proofPlan.proofKind}\``,
    `- Run Record Path: \`${input.recordRelativePath}\``,
    "",
    "## Mission Fit",
    "",
    record.analysis.missionFitSummary,
    "",
    "## Usefulness Rationale",
    "",
    record.analysis.usefulnessRationale,
    "",
    "## Report Summary",
    "",
    record.reportPlan.summary,
    "",
    "## Routing Rationale",
    "",
    ...record.candidate.rationale.map((entry) => `- ${entry}`),
    "",
    "## Routing Explanation Breakdown",
    "",
    ...record.routingAssessment.explanationBreakdown.keywordSignals.map((entry) => `- Keyword: ${entry}`),
    ...record.routingAssessment.explanationBreakdown.metadataSignals.map((entry) => `- Metadata: ${entry}`),
    ...record.routingAssessment.explanationBreakdown.gapAlignmentSignals.map((entry) => `- Gap: ${entry}`),
    ...record.routingAssessment.explanationBreakdown.ambiguitySignals.map((entry) => `- Ambiguity: ${entry}`),
    "",
    "## Next Action",
    "",
    record.integrationProposal.nextAction,
    "",
  ].join("\n");
}

function resolveFrontDoorDecision(input: {
  record: DirectiveEngineRunRecord;
  routeDate: string;
  triageRecordPath: string;
}) {
  const candidateId = input.record.candidate.candidateId;

  if (input.record.selectedLane.laneId === "architecture") {
    return {
      routingTarget: "architecture",
      decisionState: "adopt",
      adoptionTarget: "engine-owned product logic",
      receivingTrackOwner: "architecture",
      requiredNextArtifact: `architecture/01-experiments/${input.routeDate}-${candidateId}-engine-handoff.md`,
      reviewCadence: "before any downstream execution or promotion",
    } satisfies DiscoveryFrontDoorDecision;
  }

  if (input.record.selectedLane.laneId === "runtime") {
    return {
      routingTarget: "runtime",
      decisionState: "adopt",
      adoptionTarget:
        input.record.routingAssessment.scoreBreakdown.transformationSignal > 0
          ? "reusable runtime transformation capability"
          : "reusable runtime capability",
      receivingTrackOwner: "runtime",
      requiredNextArtifact: `runtime/00-follow-up/${input.routeDate}-${candidateId}-runtime-follow-up-record.md`,
      reviewCadence: "before any downstream execution or promotion",
    } satisfies DiscoveryFrontDoorDecision;
  }

  return {
    routingTarget: "monitor",
    decisionState: "monitor",
    adoptionTarget: "discovery-held candidate",
    receivingTrackOwner: "discovery",
    requiredNextArtifact: input.triageRecordPath,
    reviewCadence: "before any downstream route is accepted",
  } satisfies DiscoveryFrontDoorDecision;
}

function attachMatchedGapLink(input: {
  queue: DiscoveryIntakeQueueDocument;
  candidateId: string;
  capabilityGapId: string | null;
}) {
  if (!input.capabilityGapId) {
    return input.queue;
  }

  return {
    ...input.queue,
    entries: input.queue.entries.map((entry) =>
      entry.candidate_id === input.candidateId
        ? {
            ...entry,
            capability_gap_id: entry.capability_gap_id ?? input.capabilityGapId,
          }
        : entry
    ),
  } satisfies DiscoveryIntakeQueueDocument;
}

export async function submitDirectiveDiscoveryFrontDoor(input: {
  directiveRoot: string;
  request: DiscoverySubmissionRequest;
  runtimeArtifactsRoot?: string;
  receivedAt?: string;
}): Promise<DirectiveDiscoveryFrontDoorResult> {
  if (input.request.fast_path || input.request.case_record) {
    throw new Error(
      "invalid_input: Discovery front door derives its own records from shared Engine output; fast_path and case_record payloads are not accepted here",
    );
  }

  const directiveRoot = normalizeAbsolutePath(input.directiveRoot);
  const queuePath = normalizeAbsolutePath(
    path.join(directiveRoot, "discovery", "intake-queue.json"),
  );
  if (!fs.existsSync(queuePath)) {
    throw new Error(`Discovery queue not found: ${queuePath}`);
  }

  const runtimeArtifactsRoot = normalizeAbsolutePath(
    input.runtimeArtifactsRoot
      ?? path.join(directiveRoot, "runtime", "standalone-host"),
  );
  const queue = loadQueue(directiveRoot);
  const capabilityGaps = loadCapabilityGaps(directiveRoot);
  const activeMissionMarkdown = loadActiveMissionMarkdown(directiveRoot);
  const receivedAt = normalizeReceivedAt(input.receivedAt);
  const sourceTypeNormalization = normalizeDirectiveEngineSourceTypeInput(
    input.request.source_type ?? "internal-signal",
  );
  const normalizedRequest = {
    ...input.request,
    source_type: sourceTypeNormalization.canonicalSourceType,
  } satisfies DiscoverySubmissionRequest;

  const engine = new DirectiveEngine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
  });
  const engineResult = await engine.processSource({
    source: buildDirectiveEngineSourceFromDiscoverySubmission(normalizedRequest),
    mission: buildDirectiveEngineMission(activeMissionMarkdown),
    gaps: buildDirectiveEngineCapabilityGaps(capabilityGaps),
    receivedAt,
  });

  const queueAppend = appendDiscoveryIntakeQueueEntry({
    queue,
    submission: toQueueSubmission(normalizedRequest),
    receivedAt: receivedAt.slice(0, 10),
    unresolvedGapIds: loadUnresolvedGapIds(capabilityGaps),
  });
  const queueWithMatchedGap = attachMatchedGapLink({
    queue: queueAppend.queue,
    candidateId: input.request.candidate_id,
    capabilityGapId:
      input.request.capability_gap_id ?? engineResult.record.candidate.matchedGapId,
  });

  const routeDate = engineResult.record.receivedAt.slice(0, 10);
  const intakeRecordPath = resolveDiscoveryIntakeRecordPath({
    candidate_id: input.request.candidate_id,
    intake_date: routeDate,
  });
  const triageRecordPath = resolveDiscoveryTriageRecordPath({
    candidate_id: input.request.candidate_id,
    triage_date: routeDate,
  });
  const frontDoorDecision = resolveFrontDoorDecision({
    record: engineResult.record,
    routeDate,
    triageRecordPath,
  });
  const filteredRoutingRationale = filterRoutingRationaleLines(
    engineResult.record.routingAssessment.rationale,
  );
  const engineArtifactPaths = resolveEngineArtifactPaths({
    directiveRoot,
    runtimeArtifactsRoot,
    record: engineResult.record,
  });
  const routingRecordPath = resolveDiscoveryRoutingRecordPath({
    candidate_id: normalizedRequest.candidate_id,
    candidate_name: normalizedRequest.candidate_name,
    route_date: routeDate,
    source_type: normalizedRequest.source_type ?? "internal-signal",
    decision_state: frontDoorDecision.decisionState,
    adoption_target: frontDoorDecision.adoptionTarget,
    route_destination: frontDoorDecision.routingTarget,
    why_this_route:
      filteredRoutingRationale[1]
      ?? `Shared Engine routing selected ${frontDoorDecision.routingTarget}.`,
    why_not_alternatives:
      filteredRoutingRationale
        .filter((_, index) => index !== 1)
        .join(" ")
      || "The other lanes scored lower under the active mission-conditioned routing pass. Discovery still materialized a full intake, triage, and routing record set so the decision remains inspectable.",
    receiving_track_owner: frontDoorDecision.receivingTrackOwner,
    required_next_artifact: frontDoorDecision.requiredNextArtifact,
    linked_intake_record: intakeRecordPath,
    linked_triage_record: triageRecordPath,
    linked_engine_run_record: engineArtifactPaths.recordRelativePath,
    linked_engine_run_report: engineArtifactPaths.reportRelativePath,
    reentry_or_promotion_conditions:
      engineResult.record.proofPlan.requiredGates.join(", ") || "human review required",
    review_cadence: frontDoorDecision.reviewCadence,
    mission_priority_score: engineResult.record.candidate.missionPriorityScore,
    routing_confidence:
      engineResult.record.routingAssessment.confidence
      ?? engineResult.record.candidate.confidence,
    matched_gap_id:
      engineResult.record.candidate.matchedGapId
      ?? engineResult.record.routingAssessment.matchedGapId,
    matched_gap_rank: engineResult.record.routingAssessment.matchedGapRank,
    route_conflict: engineResult.record.routingAssessment.routeConflict,
    needs_human_review:
      engineResult.record.routingAssessment.needsHumanReview
      ?? engineResult.record.candidate.requiresHumanReview,
    ambiguity_summary: engineResult.record.routingAssessment.ambiguitySummary
      ? {
          top_track: engineResult.record.routingAssessment.ambiguitySummary.topLaneId,
          runner_up_track: engineResult.record.routingAssessment.ambiguitySummary.runnerUpLaneId,
          score_delta: engineResult.record.routingAssessment.ambiguitySummary.scoreDelta,
          conflicting_signal_families: [
            ...engineResult.record.routingAssessment.ambiguitySummary.conflictingSignalFamilies,
          ],
          conflicting_tracks: [
            ...engineResult.record.routingAssessment.ambiguitySummary.conflictingLaneIds,
          ],
        }
      : null,
    review_guidance: engineResult.record.routingAssessment.reviewGuidance
      ? {
          guidance_kind: engineResult.record.routingAssessment.reviewGuidance.guidanceKind,
          summary: engineResult.record.routingAssessment.reviewGuidance.summary,
          operator_action: engineResult.record.routingAssessment.reviewGuidance.operatorAction,
          required_checks: [
            ...engineResult.record.routingAssessment.reviewGuidance.requiredChecks,
          ],
          stop_line: engineResult.record.routingAssessment.reviewGuidance.stopLine,
        }
      : null,
    explanation_breakdown: {
      keyword_signals: [
        ...engineResult.record.routingAssessment.explanationBreakdown.keywordSignals,
      ],
      metadata_signals: [
        ...engineResult.record.routingAssessment.explanationBreakdown.metadataSignals,
      ],
      gap_alignment_signals: [
        ...engineResult.record.routingAssessment.explanationBreakdown.gapAlignmentSignals,
      ],
      ambiguity_signals: [
        ...engineResult.record.routingAssessment.explanationBreakdown.ambiguitySignals,
      ],
    },
  });
  const projectionInput: DirectiveMirroredDiscoveryFrontDoorProjectionInput = {
    routeDate,
    decisionState: frontDoorDecision.decisionState,
    intake: {
      intake_date: routeDate,
      source_type: normalizedRequest.source_type ?? "internal-signal",
      source_reference: normalizedRequest.source_reference,
      submitted_by: "directive-workspace-discovery-front-door",
      why_it_entered_the_system:
        "This source entered through Discovery first so Directive Workspace could record mission-aware usefulness, routing, and proof boundaries before any downstream lane work.",
      claimed_value:
        engineResult.record.extractionPlan.extractedValue[0]
        ?? engineResult.record.analysis.missionFitSummary,
      initial_relevance_to_workspace:
        engineResult.record.analysis.usefulnessRationale,
      suspected_adoption_target: frontDoorDecision.adoptionTarget,
      immediate_notes: [
        `Engine run ${engineResult.record.runId} selected ${engineResult.record.selectedLane.laneId}.`,
        engineResult.record.candidate.matchedGapId
          ? `Matched capability gap ${engineResult.record.candidate.matchedGapId}.`
          : "No open capability gap matched strongly enough.",
        "Human review remains explicit before downstream lane execution.",
      ].join(" "),
    },
    triage: {
      triage_date: routeDate,
      first_pass_summary: engineResult.record.analysis.missionFitSummary,
      problem_it_appears_to_solve: engineResult.record.improvementPlan.intendedDelta,
      extractable_value_hypothesis:
        engineResult.record.extractionPlan.extractedValue.join(" | ")
        || engineResult.record.analysis.missionFitSummary,
      routing_recommendation:
        `Shared Engine routing selected ${frontDoorDecision.routingTarget} with usefulness level ${engineResult.record.candidate.usefulnessLevel}.`,
      proposed_adoption_target: frontDoorDecision.adoptionTarget,
      stack_shape_summary:
        `${engineResult.record.source.sourceType} source; host dependence ${engineResult.record.integrationProposal.hostDependence}; integration mode ${engineResult.record.integrationProposal.integrationMode}.`,
      boilerplate_vs_product_boundary:
        `Directive-owned form: ${engineResult.record.adaptationPlan.directiveOwnedForm}. Excluded baggage: ${engineResult.record.extractionPlan.excludedBaggage.join(", ") || "n/a"}.`,
      suggested_decision_state: engineResult.record.decision.decisionState,
      fit_to_current_direction: engineResult.record.analysis.usefulnessRationale,
      reusability_across_surfaces:
        engineResult.record.integrationProposal.valuableWithoutHostRuntime
          ? "Value remains useful without a host runtime surface."
          : "Value depends on a later host adapter boundary for repeated runtime use.",
      operational_risk:
        "Discovery only recorded the route and proof boundary; downstream execution remains out of scope and human review is still required.",
      integration_cost:
        engineResult.record.integrationProposal.hostDependence === "host_adapter_required"
          ? "medium"
          : "low",
      can_current_gates_validate_safely:
        `partially - proof plan ${engineResult.record.proofPlan.proofKind} defines required evidence and gates, but human review still decides whether to advance.`,
      immediate_risks:
        engineResult.record.proofPlan.requiredGates.join(", ") || "n/a",
      missing_evidence:
        engineResult.record.proofPlan.requiredEvidence.join(", ") || "n/a",
      next_action: engineResult.record.integrationProposal.nextAction,
      monitor_defer_trigger_conditions:
        frontDoorDecision.routingTarget === "monitor"
          ? "Hold the source in Discovery until routing confidence or downstream adoption target becomes clearer."
          : "If the route is rejected in human review, keep the source in Discovery instead of forcing downstream work.",
      reentry_conditions:
        `Respect rollback boundary: ${engineResult.record.proofPlan.rollbackPrompt}`,
    },
    routing: {
      route_date: routeDate,
      source_type: normalizedRequest.source_type ?? "internal-signal",
      decision_state: frontDoorDecision.decisionState,
      adoption_target: frontDoorDecision.adoptionTarget,
      route_destination: frontDoorDecision.routingTarget,
      why_this_route:
        filteredRoutingRationale[1]
        ?? `Shared Engine routing selected ${frontDoorDecision.routingTarget}.`,
      why_not_alternatives:
        filteredRoutingRationale
          .filter((_, index) => index !== 1)
          .join(" ")
        || "The other lanes scored lower under the active mission-conditioned routing pass. Discovery still materialized a full intake, triage, and routing record set so the decision remains inspectable.",
      receiving_track_owner: frontDoorDecision.receivingTrackOwner,
      required_next_artifact: frontDoorDecision.requiredNextArtifact,
      linked_intake_record: intakeRecordPath,
      linked_triage_record: triageRecordPath,
      linked_engine_run_record: engineArtifactPaths.recordRelativePath,
      linked_engine_run_report: engineArtifactPaths.reportRelativePath,
      reentry_or_promotion_conditions:
        engineResult.record.proofPlan.requiredGates.join(", ") || "human review required",
      review_cadence: frontDoorDecision.reviewCadence,
      mission_priority_score: engineResult.record.routingAssessment.missionPriorityScore,
      routing_confidence:
        engineResult.record.routingAssessment.confidence
        ?? engineResult.record.candidate.confidence,
      matched_gap_id:
        engineResult.record.candidate.matchedGapId
        ?? engineResult.record.routingAssessment.matchedGapId,
      matched_gap_rank: engineResult.record.routingAssessment.matchedGapRank,
      route_conflict: engineResult.record.routingAssessment.routeConflict,
      needs_human_review:
        engineResult.record.routingAssessment.needsHumanReview
        ?? engineResult.record.candidate.requiresHumanReview,
      ambiguity_summary: engineResult.record.routingAssessment.ambiguitySummary
        ? {
            top_track: engineResult.record.routingAssessment.ambiguitySummary.topLaneId,
            runner_up_track: engineResult.record.routingAssessment.ambiguitySummary.runnerUpLaneId,
            score_delta: engineResult.record.routingAssessment.ambiguitySummary.scoreDelta,
            conflicting_signal_families: [
              ...engineResult.record.routingAssessment.ambiguitySummary.conflictingSignalFamilies,
            ],
            conflicting_tracks: [
              ...engineResult.record.routingAssessment.ambiguitySummary.conflictingLaneIds,
            ],
          }
        : null,
      review_guidance: engineResult.record.routingAssessment.reviewGuidance
        ? {
            guidance_kind: engineResult.record.routingAssessment.reviewGuidance.guidanceKind,
            summary: engineResult.record.routingAssessment.reviewGuidance.summary,
            operator_action: engineResult.record.routingAssessment.reviewGuidance.operatorAction,
            required_checks: [
              ...engineResult.record.routingAssessment.reviewGuidance.requiredChecks,
            ],
            stop_line: engineResult.record.routingAssessment.reviewGuidance.stopLine,
          }
        : null,
      explanation_breakdown: {
        keyword_signals: [
          ...engineResult.record.routingAssessment.explanationBreakdown.keywordSignals,
        ],
        metadata_signals: [
          ...engineResult.record.routingAssessment.explanationBreakdown.metadataSignals,
        ],
        gap_alignment_signals: [
          ...engineResult.record.routingAssessment.explanationBreakdown.gapAlignmentSignals,
        ],
        ambiguity_signals: [
          ...engineResult.record.routingAssessment.explanationBreakdown.ambiguitySignals,
        ],
      },
    },
  };

  writeJsonPretty(engineArtifactPaths.recordPath, engineResult.record);
  writeUtf8(
    engineArtifactPaths.reportPath,
    renderDirectiveEngineRunReport({
      record: engineResult.record,
      recordRelativePath: engineArtifactPaths.recordRelativePath,
    }),
  );

  mirrorDirectiveDiscoveryFrontDoorSubmission({
    directiveRoot,
    caseId: input.request.candidate_id,
    candidateId: input.request.candidate_id,
    candidateName: input.request.candidate_name,
    sourceType: normalizedRequest.source_type ?? "internal-signal",
    sourceReference: input.request.source_reference,
    receivedAt: engineResult.record.receivedAt,
    decisionState: frontDoorDecision.decisionState,
    routeTarget: frontDoorDecision.routingTarget,
    operatingMode: normalizedRequest.operating_mode ?? null,
    queueStatus: "routed",
    linkedArtifacts: {
      intakeRecordPath,
      triageRecordPath,
      routingRecordPath,
      engineRunRecordPath: engineArtifactPaths.recordRelativePath,
      engineRunReportPath: engineArtifactPaths.reportRelativePath,
    },
    projectionInputs: {
      discoveryFrontDoor: projectionInput,
    },
  });
  const projectionWrite = writeDirectiveDiscoveryFrontDoorProjectionSet({
    directiveRoot,
    caseId: input.request.candidate_id,
  });
  if (!projectionWrite.ok) {
    throw new Error(
      `generated_discovery_projection_failed:${projectionWrite.reason}:${input.request.candidate_id}`,
    );
  }
  const lifecycleResult = syncDiscoveryIntakeLifecycle({
    queue: queueWithMatchedGap,
    request: {
      candidate_id: input.request.candidate_id,
      target_phase: "routed",
      routing_target: frontDoorDecision.routingTarget,
      intake_record_path: intakeRecordPath,
      routing_record_path: routingRecordPath,
      result_record_path: null,
      note_append:
        `discovery front door materialized: ${intakeRecordPath}, ${triageRecordPath}, ${routingRecordPath}`,
    } satisfies DiscoveryIntakeLifecycleSyncRequest,
    transitionDate: routeDate,
    directiveRoot,
  });
  writeJsonPretty(queuePath, lifecycleResult.queue);
  mirrorDirectiveDiscoveryFrontDoorSubmission({
    directiveRoot,
    caseId: input.request.candidate_id,
    candidateId: input.request.candidate_id,
    candidateName: input.request.candidate_name,
    sourceType: normalizedRequest.source_type ?? "internal-signal",
    sourceReference: input.request.source_reference,
    receivedAt: engineResult.record.receivedAt,
    decisionState: frontDoorDecision.decisionState,
    routeTarget: frontDoorDecision.routingTarget,
    operatingMode: lifecycleResult.entry.operating_mode ?? null,
    queueStatus: lifecycleResult.entry.status,
    linkedArtifacts: {
      intakeRecordPath,
      triageRecordPath,
      routingRecordPath,
      engineRunRecordPath: engineArtifactPaths.recordRelativePath,
      engineRunReportPath: engineArtifactPaths.reportRelativePath,
    },
    projectionInputs: {
      discoveryFrontDoor: projectionInput,
    },
  });

  return {
    ok: true,
    candidateId: input.request.candidate_id,
    queuePath,
    queueEntry: lifecycleResult.entry,
    sourceType: {
      submittedType: sourceTypeNormalization.submittedSourceType,
      canonicalType: sourceTypeNormalization.canonicalSourceType,
      normalizedFrom: sourceTypeNormalization.normalizedFrom,
      normalizationKind: sourceTypeNormalization.normalizationKind,
    },
    createdPaths: {
      intakeRecordPath,
      triageRecordPath,
      routingRecordPath,
    },
    discovery: {
      usefulnessLevel: engineResult.record.candidate.usefulnessLevel,
      usefulnessRationale: engineResult.record.analysis.usefulnessRationale,
      routingTarget: frontDoorDecision.routingTarget,
      decisionState: frontDoorDecision.decisionState,
      missionPriorityScore: engineResult.record.routingAssessment.missionPriorityScore,
      confidence: engineResult.record.routingAssessment.confidence,
      matchedGapId:
        input.request.capability_gap_id ?? engineResult.record.candidate.matchedGapId,
      proofKind: engineResult.record.proofPlan.proofKind,
      proofObjective: engineResult.record.proofPlan.objective,
      proofRequiredGates: engineResult.record.proofPlan.requiredGates,
      proofRequiredEvidence: engineResult.record.proofPlan.requiredEvidence,
      nextAction: engineResult.record.integrationProposal.nextAction,
    },
    engine: {
      recordPath: engineArtifactPaths.recordPath,
      recordRelativePath: engineArtifactPaths.recordRelativePath,
      reportPath: engineArtifactPaths.reportPath,
      reportRelativePath: engineArtifactPaths.reportRelativePath,
      record: engineResult.record,
    },
  };
}

function toQueueSubmission(request: DiscoverySubmissionRequest) {
  const submissionOrigin = request.submission_origin ?? null;
  return {
    candidate_id: request.candidate_id,
    candidate_name: request.candidate_name,
    source_type: request.source_type ?? "internal-signal",
    source_reference: request.source_reference,
    mission_alignment: request.mission_alignment ?? null,
    capability_gap_id: request.capability_gap_id ?? null,
    notes: request.notes ?? null,
    operating_mode: request.operating_mode ?? null,
    ...(submissionOrigin ? { submission_origin: submissionOrigin } : {}),
    ...(typeof request.discovery_signal_band === "string" && request.discovery_signal_band.trim()
      ? { discovery_signal_band: request.discovery_signal_band }
      : {}),
    ...(typeof request.signal_total_score === "number" && Number.isFinite(request.signal_total_score)
      ? { signal_total_score: request.signal_total_score }
      : {}),
    ...(typeof request.signal_score_summary === "string" && request.signal_score_summary.trim()
      ? { signal_score_summary: request.signal_score_summary }
      : {}),
  };
}

