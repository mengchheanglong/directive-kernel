import fs from "node:fs";
import path from "node:path";

import {
  createFilesystemEngineStore,
  Engine,
  createDirectiveWorkspaceEngineLanes,
  type EngineCapabilityGap,
  type EngineMissionInput,
  type EngineRunRecord,
  type EngineSourceItem,
} from "../../../engine/index.ts";
import { readDecisionPolicyLedger } from "../../../engine/decision-policy-ledger.ts";
import { normalizeEngineSourceTypeInput } from "../../../engine/source-type-normalization.ts";
import { resolveEngineStoreRecordPath } from "../../../engine/storage.ts";
import {
  readRoutingCorrectionLedger,
  writeGapRadarReport,
} from "../../../engine/routing/index.ts";
import {
  appendDiscoveryIntakeQueueEntry,
  type DiscoveryIntakeQueueDocument,
  type DiscoveryIntakeQueueEntry,
  type DiscoveryRoutingTarget,
} from "../intake/queue-writer.ts";
import type { DiscoverySubmissionRequest } from "./submission-router.ts";
import {
  resolveDiscoveryIntakeRecordPath,
  resolveDiscoveryTriageRecordPath,
} from "../records/case-record-writer.ts";
import {
  resolveDiscoveryRoutingRecordPath,
  type DiscoveryRoutingDecisionState,
} from "../routing/record-writer.ts";
import { openDirectiveDiscoveryRoute } from "../routing/route-opener.ts";
import {
  syncDiscoveryIntakeLifecycle,
  type DiscoveryIntakeLifecycleSyncRequest,
} from "../intake/lifecycle-sync.ts";
import type { CapabilityGapRecord } from "../gaps/gap-worklist-generator.ts";
import { mirrorDirectiveDiscoveryFrontDoorSubmission } from "../../../engine/cases/case-store.ts";
import {
  writeDirectiveDiscoveryFrontDoorProjectionSet,
  type MirroredDiscoveryFrontDoorProjectionInput,
} from "./projections.ts";
import { readJson, writeJson as writeJsonPretty, writeUtf8 } from "../../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../../shared/lib/path-normalization.ts";

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

export type DiscoveryFrontDoorResult = {
  ok: true;
  candidateId: string;
  queuePath: string;
  queueEntry: DiscoveryIntakeQueueEntry;
  sourceType: {
    submittedType: string;
    canonicalType: EngineSourceItem["sourceType"];
    normalizedFrom: string | null;
    normalizationKind: "none" | "format" | "alias";
  };
  createdPaths: {
    intakeRecordPath: string;
    triageRecordPath: string;
    routingRecordPath: string;
  };
  downstream: {
    autoOpened: boolean;
    routeDestination: "architecture" | "runtime" | null;
    stubKind: "architecture_handoff" | "runtime_follow_up" | null;
    stubRelativePath: string | null;
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
    record: EngineRunRecord;
  };
};

function normalizeRelativeDirectivePath(
  directiveRoot: string,
  filePath: string,
) {
  return path.relative(directiveRoot, filePath).replace(/\\/g, "/");
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

function buildEngineSourceFromDiscoverySubmission(
  request: DiscoverySubmissionRequest,
): EngineSourceItem {
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

function buildEngineMission(
  activeMissionMarkdown: string,
): EngineMissionInput {
  return {
    missionId: "directive-workspace-discovery-front-door",
    activeMissionMarkdown,
  };
}

function buildEngineCapabilityGaps(
  gaps: CapabilityGapRecord[],
): EngineCapabilityGap[] {
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
  record: EngineRunRecord;
}) {
  const runtimeArtifactsRoot = normalizeAbsolutePath(input.runtimeArtifactsRoot);
  const engineRunsRoot = normalizeAbsolutePath(path.resolve(runtimeArtifactsRoot, "engine-runs"));
  const recordPath = normalizeAbsolutePath(resolveEngineStoreRecordPath({
    engineRunsRoot,
    record: input.record,
  }));
  const reportPath = normalizeAbsolutePath(recordPath.replace(/\.json$/u, ".md"));

  return {
    recordPath,
    reportPath,
    recordRelativePath: normalizeRelativeDirectivePath(input.directiveRoot, recordPath),
    reportRelativePath: normalizeRelativeDirectivePath(input.directiveRoot, reportPath),
  };
}

function renderEngineRunReport(input: {
  record: EngineRunRecord;
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
    "## Goal Copilot",
    "",
    `- Overall score: ${record.routingAssessment.goalCopilot.overallScore}/100`,
    `- Objective specificity score: ${record.routingAssessment.goalCopilot.objectiveSpecificityScore}/5`,
    `- Usefulness signal quality score: ${record.routingAssessment.goalCopilot.usefulnessSignalQualityScore}/5`,
    `- Constraint quality score: ${record.routingAssessment.goalCopilot.constraintQualityScore}/5`,
    `- Lane clarity score: ${record.routingAssessment.goalCopilot.laneClarityScore}/5`,
    `- Warnings: ${record.routingAssessment.goalCopilot.warnings.join(" | ") || "none"}`,
    `- Suggested objective: ${record.routingAssessment.goalCopilot.suggestedObjective ?? "n/a"}`,
    `- Suggested constraints: ${record.routingAssessment.goalCopilot.suggestedConstraints.join(" | ") || "none"}`,
    `- Suggested usefulness signals: ${record.routingAssessment.goalCopilot.suggestedUsefulnessSignals.join(" | ") || "none"}`,
    `- Suggested capability lanes: ${record.routingAssessment.goalCopilot.suggestedCapabilityLanes.join(" | ") || "none"}`,
    "",
    "## Confidence Recovery Follow-Up",
    "",
    `- Summary: ${record.routingAssessment.confidenceRecovery?.summary ?? "n/a"}`,
    `- Confidence lift: ${record.routingAssessment.confidenceRecovery?.confidenceLift ?? "n/a"}`,
    ...(record.routingAssessment.confidenceRecovery?.requestedInputs.map((entry) =>
      `- Requested input: ${entry.field} | Question: ${entry.question} | Why it matters: ${entry.whyItMatters} | Example answer: ${entry.exampleAnswer ?? "n/a"}`
    ) ?? []),
    "",
    "## Gap Radar",
    "",
    `- Summary: ${record.routingAssessment.gapRadar?.summary ?? "n/a"}`,
    ...(record.routingAssessment.gapRadar?.suggestions.map((entry) =>
      `- Suggestion: ${entry.targetLaneId} | ${entry.confidence} confidence | ${entry.evidenceCount} events | ${entry.summary} | Recommended change: ${entry.recommendedChange} | Signals: ${entry.signalTokens.join(", ") || "none"} | Related open gap: ${entry.relatedOpenGapId ?? "n/a"} | Suggested priority: ${entry.suggestedPriority}`
    ) ?? []),
    "",
    "## Earned Autonomy",
    "",
    `- Route class: ${record.routingAssessment.earnedAutonomy.routeClass}`,
    `- Overall score: ${record.routingAssessment.earnedAutonomy.overallScore}/100`,
    `- Evidence count: ${record.routingAssessment.earnedAutonomy.evidenceCount}`,
    `- Operator agreement rate: ${record.routingAssessment.earnedAutonomy.operatorAgreementRate == null ? "n/a" : `${Math.round(record.routingAssessment.earnedAutonomy.operatorAgreementRate * 100)}%`}`,
    `- Review clear rate: ${record.routingAssessment.earnedAutonomy.reviewClearRate == null ? "n/a" : `${Math.round(record.routingAssessment.earnedAutonomy.reviewClearRate * 100)}%`}`,
    `- Reversal count: ${record.routingAssessment.earnedAutonomy.reversalCount}`,
    `- Auto-approval eligible: ${record.routingAssessment.earnedAutonomy.autoApprovalEligible ? "yes" : "no"}`,
    `- Approval reduction applied: ${record.routingAssessment.earnedAutonomy.approvalReductionApplied ? "yes" : "no"}`,
    `- Summary: ${record.routingAssessment.earnedAutonomy.summary}`,
    ...record.routingAssessment.earnedAutonomy.rationale.map((entry) => `- Rationale: ${entry}`),
    "",
    "## Next Action",
    "",
    record.integrationProposal.nextAction,
    "",
  ].join("\n");
}

function resolveFrontDoorDecision(input: {
  record: EngineRunRecord;
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
}): Promise<DiscoveryFrontDoorResult> {
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
      ?? path.join(directiveRoot, "runtime", "host-artifacts"),
  );
  const engineRunsRoot = normalizeAbsolutePath(path.resolve(runtimeArtifactsRoot, "engine-runs"));
  const queue = loadQueue(directiveRoot);
  const capabilityGaps = loadCapabilityGaps(directiveRoot);
  const activeMissionMarkdown = loadActiveMissionMarkdown(directiveRoot);
  const receivedAt = normalizeReceivedAt(input.receivedAt);
  const sourceTypeNormalization = normalizeEngineSourceTypeInput(
    input.request.source_type ?? "internal-signal",
  );
  const normalizedRequest = {
    ...input.request,
    source_type: sourceTypeNormalization.canonicalSourceType,
  } satisfies DiscoverySubmissionRequest;

  const correctionLedger = readRoutingCorrectionLedger(directiveRoot);
  const policyLedger = readDecisionPolicyLedger(directiveRoot);
  const engine = new Engine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: createFilesystemEngineStore({
      engineRunsRoot,
    }),
  });
  const engineResult = await engine.processSource({
    source: buildEngineSourceFromDiscoverySubmission(normalizedRequest),
    mission: buildEngineMission(activeMissionMarkdown),
    gaps: buildEngineCapabilityGaps(capabilityGaps),
    corrections: correctionLedger.corrections,
    policyEvents: policyLedger.events,
    receivedAt,
  });
  writeGapRadarReport({
    directiveRoot,
    generatedAt: receivedAt,
    events: policyLedger.events,
    openGaps: buildEngineCapabilityGaps(capabilityGaps),
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
  const requiresHumanApproval = engineResult.record.decision.requiresHumanApproval;
  const reviewBoundarySummary = requiresHumanApproval
    ? "Human review remains explicit before downstream lane execution."
    : "The route is bounded strongly enough for one automatic downstream handoff without an extra manual approval stop.";
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
    mission_specificity_warning:
      engineResult.record.routingAssessment.missionSpecificityWarning,
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
    goal_copilot: {
      overall_score: engineResult.record.routingAssessment.goalCopilot.overallScore,
      objective_specificity_score:
        engineResult.record.routingAssessment.goalCopilot.objectiveSpecificityScore,
      usefulness_signal_quality_score:
        engineResult.record.routingAssessment.goalCopilot.usefulnessSignalQualityScore,
      constraint_quality_score:
        engineResult.record.routingAssessment.goalCopilot.constraintQualityScore,
      lane_clarity_score:
        engineResult.record.routingAssessment.goalCopilot.laneClarityScore,
      warnings: [
        ...engineResult.record.routingAssessment.goalCopilot.warnings,
      ],
      rationale: [
        ...engineResult.record.routingAssessment.goalCopilot.rationale,
      ],
      suggested_objective:
        engineResult.record.routingAssessment.goalCopilot.suggestedObjective,
      suggested_constraints: [
        ...engineResult.record.routingAssessment.goalCopilot.suggestedConstraints,
      ],
      suggested_usefulness_signals: [
        ...engineResult.record.routingAssessment.goalCopilot.suggestedUsefulnessSignals,
      ],
      suggested_capability_lanes: [
        ...engineResult.record.routingAssessment.goalCopilot.suggestedCapabilityLanes,
      ],
    },
    confidence_recovery: engineResult.record.routingAssessment.confidenceRecovery
      ? {
          summary: engineResult.record.routingAssessment.confidenceRecovery.summary,
          confidence_lift:
            engineResult.record.routingAssessment.confidenceRecovery.confidenceLift,
          requested_inputs:
            engineResult.record.routingAssessment.confidenceRecovery.requestedInputs.map((entry) => ({
              field: entry.field,
              question: entry.question,
              why_it_matters: entry.whyItMatters,
              example_answer: entry.exampleAnswer,
            })),
        }
      : null,
    gap_radar: engineResult.record.routingAssessment.gapRadar
      ? {
          summary: engineResult.record.routingAssessment.gapRadar.summary,
          suggestions: engineResult.record.routingAssessment.gapRadar.suggestions.map((entry) => ({
            radar_id: entry.radarId,
            target_lane_id: entry.targetLaneId,
            confidence: entry.confidence,
            evidence_count: entry.evidenceCount,
            summary: entry.summary,
            recommended_change: entry.recommendedChange,
            signal_tokens: [...entry.signalTokens],
            related_open_gap_id: entry.relatedOpenGapId,
            suggested_priority: entry.suggestedPriority,
          })),
        }
      : null,
    earned_autonomy: {
      route_class: engineResult.record.routingAssessment.earnedAutonomy.routeClass,
      overall_score: engineResult.record.routingAssessment.earnedAutonomy.overallScore,
      evidence_count: engineResult.record.routingAssessment.earnedAutonomy.evidenceCount,
      operator_agreement_rate:
        engineResult.record.routingAssessment.earnedAutonomy.operatorAgreementRate,
      review_clear_rate:
        engineResult.record.routingAssessment.earnedAutonomy.reviewClearRate,
      reversal_count: engineResult.record.routingAssessment.earnedAutonomy.reversalCount,
      auto_approval_eligible:
        engineResult.record.routingAssessment.earnedAutonomy.autoApprovalEligible,
      approval_reduction_applied:
        engineResult.record.routingAssessment.earnedAutonomy.approvalReductionApplied,
      summary: engineResult.record.routingAssessment.earnedAutonomy.summary,
      rationale: [
        ...engineResult.record.routingAssessment.earnedAutonomy.rationale,
      ],
    },
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
  const projectionInput: MirroredDiscoveryFrontDoorProjectionInput = {
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
        reviewBoundarySummary,
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
        requiresHumanApproval
          ? "Discovery recorded the route and proof boundary, but downstream execution still waits on an explicit human review decision."
          : "Discovery recorded the route and proof boundary and can auto-open one bounded downstream artifact without widening execution scope.",
      integration_cost:
        engineResult.record.integrationProposal.hostDependence === "host_adapter_required"
          ? "medium"
          : "low",
      can_current_gates_validate_safely:
        requiresHumanApproval
          ? `partially - proof plan ${engineResult.record.proofPlan.proofKind} defines required evidence and gates, but human review still decides whether to advance.`
          : `yes - proof plan ${engineResult.record.proofPlan.proofKind} defines the required evidence and gates, and the current route is bounded enough to open exactly one downstream stub automatically.`,
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
    renderEngineRunReport({
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
  let downstream: DiscoveryFrontDoorResult["downstream"] = {
    autoOpened: false,
    routeDestination: null,
    stubKind: null,
    stubRelativePath: null,
  };
  if (
    !requiresHumanApproval
    && (
      frontDoorDecision.routingTarget === "architecture"
      || frontDoorDecision.routingTarget === "runtime"
    )
  ) {
    const openedRoute = openDirectiveDiscoveryRoute({
      directiveRoot,
      routingPath: routingRecordPath,
      approved: true,
      approvedBy: "directive-engine-auto-approval",
    });
    downstream = {
      autoOpened: true,
      routeDestination: openedRoute.routeDestination,
      stubKind: openedRoute.stubKind,
      stubRelativePath: openedRoute.stubRelativePath,
    };
  }
  const refreshedQueue = downstream.autoOpened ? loadQueue(directiveRoot) : lifecycleResult.queue;
  const refreshedQueueEntry =
    refreshedQueue.entries.find((entry) => entry.candidate_id === input.request.candidate_id)
    ?? lifecycleResult.entry;

  return {
    ok: true,
    candidateId: input.request.candidate_id,
    queuePath,
    queueEntry: refreshedQueueEntry,
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
    downstream,
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

