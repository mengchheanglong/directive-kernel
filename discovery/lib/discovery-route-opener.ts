import fs from "node:fs";
import path from "node:path";

import { readUtf8 } from "../../shared/lib/file-io.ts";

import {
  normalizeDirectiveApprovalActor,
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveExplicitApproval,
  requireDirectiveString,
  resolveDirectiveWorkspaceRelativePath,
  writeDirectiveArtifactIfMissing,
} from "../../engine/approval-boundary.ts";
import { writeJson as writeJsonPretty } from "../../shared/lib/file-io.ts";
import {
  normalizeDirectiveRelativePath,
} from "../../shared/lib/directive-relative-path.ts";
import {
  renderRuntimeFollowUpRecord,
  type RuntimeFollowUpRecordRequest,
} from "../../runtime/lib/runtime-follow-up-record-writer.ts";
import { readDiscoveryRoutingReviewResolution } from "./discovery-routing-review-resolution.ts";
import {
  deriveEffectiveDiscoveryRouteBoundary,
  type DiscoveryRouteDestination,
} from "./discovery-routing-effective-boundary.ts";
import { type DiscoveryIntakeQueueDocument } from "./discovery-intake-queue-writer.ts";
import { syncDiscoveryIntakeLifecycle } from "./discovery-intake-lifecycle-sync.ts";
import {
  extractRuntimeOpenerMarkdownTitle as extractMarkdownTitle,
  extractRuntimeOpenerOptionalBulletValue as extractOptionalBulletValue,
  extractRuntimeOpenerRequiredBulletValue as extractBulletValue,
} from "../../runtime/lib/runtime-opener-shared.ts";
import {
  describeDirectiveEngineGapPressure,
  type DirectiveEngineGapPressureDetail,
} from "../../engine/execution/engine-run-artifacts.ts";

type DirectiveEngineRunRecordLike = {
  runId: string;
  receivedAt: string;
  source: {
    sourceRef: string;
  };
  candidate: {
    candidateId: string;
    candidateName: string;
    usefulnessLevel: string;
    missionPriorityScore?: number;
    matchedGapId?: string | null;
  };
  analysis: {
    usefulnessRationale: string;
  };
  openGaps?: Array<{
    gapId: string;
    description: string;
    priority: string;
    relatedMissionObjective?: string;
    currentState?: string;
    desiredState?: string;
  }>;
  routingAssessment?: {
    confidence?: string;
    matchedGapId?: string | null;
    matchedGapRank?: number | null;
    routeConflict?: boolean;
    needsHumanReview?: boolean;
    ambiguitySummary?: {
      topLaneId: string;
      runnerUpLaneId: string | null;
      scoreDelta: number;
      conflictingSignalFamilies: string[];
      conflictingLaneIds: string[];
    } | null;
    scoreBreakdown?: {
      gapAlignment?: number;
    };
  };
  extractionPlan: {
    extractedValue: string[];
    excludedBaggage: string[];
  };
  proofPlan: {
    objective: string;
    requiredEvidence: string[];
    requiredGates: string[];
    rollbackPrompt: string;
  };
  decision: {
    decisionState: string;
  };
  integrationProposal: {
    integrationMode: string;
    nextAction: string;
    valuableWithoutHostRuntime: boolean;
    hostDependence?: string | null;
  };
};

export type DirectiveDiscoveryRoutingArtifact = {
  title: string;
  date: string;
  candidateId: string;
  candidateName: string;
  routingDate: string;
  sourceType: string;
  decisionState: string;
  adoptionTarget: string;
  routeDestination: DiscoveryRouteDestination;
  effectiveRouteDestination: DiscoveryRouteDestination;
  whyThisRoute: string;
  whyNotAlternatives: string;
  handoffContractUsed: string | null;
  receivingTrackOwner: string;
  requiredNextArtifact: string;
  reentryOrPromotionConditions: string | null;
  reviewCadence: string | null;
  missionPriorityScore: number | null;
  linkedIntakeRecord: string;
  linkedTriageRecord: string | null;
  routingRelativePath: string;
  routingAbsolutePath: string;
  effectiveRequiredNextArtifact: string;
  downstreamStubRelativePath: string | null;
  downstreamStubExists: boolean;
  approvalAllowed: boolean;
  engineRunRecordPath: string | null;
  engineRunReportPath: string | null;
  engineRunId: string | null;
  usefulnessLevel: string | null;
  usefulnessRationale: string | null;
  matchedGapId: string | null;
  gapPressure: DirectiveEngineGapPressureDetail | null;
  routingConfidence: string | null;
  routeConflict: boolean | null;
  needsHumanReview: boolean | null;
  explanationBreakdown: {
    keywordSignals: string[];
    metadataSignals: string[];
    gapAlignmentSignals: string[];
    ambiguitySignals: string[];
  } | null;
  ambiguitySummary: {
    topLaneId: string;
    runnerUpLaneId: string | null;
    scoreDelta: number;
    conflictingSignalFamilies: string[];
    conflictingLaneIds: string[];
  } | null;
  reviewGuidance: {
    guidanceKind: string;
    summary: string;
    operatorAction: string;
    requiredChecks: string[];
    stopLine: string;
  } | null;
};

export type DirectiveDiscoveryRouteOpenResult = {
  ok: true;
  created: boolean;
  directiveRoot: string;
  routingRelativePath: string;
  routeDestination: "architecture" | "runtime";
  stubKind: "architecture_handoff" | "runtime_follow_up";
  stubRelativePath: string;
  stubAbsolutePath: string;
  candidateId: string;
  candidateName: string;
  queuePath: string;
};

function optionalString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === "n/a") {
    return null;
  }
  return normalized;
}

function normalizeEngineCandidateId(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function candidateIdsMatch(input: {
  expectedCandidateId: string;
  observedCandidateId: string;
}) {
  if (input.expectedCandidateId === input.observedCandidateId) {
    return true;
  }
  const expectedNormalized = normalizeEngineCandidateId(input.expectedCandidateId);
  const observedNormalized = normalizeEngineCandidateId(input.observedCandidateId);
  return Boolean(expectedNormalized) && expectedNormalized === observedNormalized;
}



function readOptionalBullet(markdown: string, label: string) {
  return optionalString(extractOptionalBulletValue(markdown, label));
}

function parseYesNoBoolean(value: string | null) {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") return true;
  if (normalized === "no") return false;
  return null;
}

function extractSection(markdown: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(`^## ${escaped}\\r?\\n\\r?\\n([\\s\\S]*?)(?=^## |\\s*$)`, "m"),
  );
  return match?.[1]?.trim() ?? null;
}

function extractSectionLines(markdown: string, heading: string, prefix: string) {
  const section = extractSection(markdown, heading);
  if (!section) {
    return [];
  }
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim())
    .filter(Boolean);
}

function parseDiscoveryRoutingMarkdown(markdown: string) {
  const dateLine = markdown
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("Date: "));
  const title = extractMarkdownTitle(markdown, "routing record title")
    .replace(/^Discovery Routing Record:\s*/, "")
    .trim();

  return {
    title,
    date: requireDirectiveString(dateLine?.replace(/^Date:\s*/, ""), "routing record date"),
    candidateId: extractBulletValue(markdown, "Candidate id", 'invalid_input: missing "Candidate id" in Discovery routing record'),
    candidateName: extractBulletValue(markdown, "Candidate name", 'invalid_input: missing "Candidate name" in Discovery routing record'),
    routingDate: extractBulletValue(markdown, "Routing date", 'invalid_input: missing "Routing date" in Discovery routing record'),
    sourceType: extractBulletValue(markdown, "Source type", 'invalid_input: missing "Source type" in Discovery routing record'),
    decisionState: extractBulletValue(markdown, "Decision state", 'invalid_input: missing "Decision state" in Discovery routing record'),
    adoptionTarget: extractBulletValue(markdown, "Adoption target", 'invalid_input: missing "Adoption target" in Discovery routing record'),
    routeDestination: extractBulletValue(markdown, "Route destination", 'invalid_input: missing "Route destination" in Discovery routing record') as DiscoveryRouteDestination,
    usefulnessLevel: optionalString(extractOptionalBulletValue(markdown, "Usefulness level")),
    usefulnessRationale: optionalString(extractOptionalBulletValue(markdown, "Usefulness rationale")),
    whyThisRoute: extractBulletValue(markdown, "Why this route", 'invalid_input: missing "Why this route" in Discovery routing record'),
    whyNotAlternatives: extractBulletValue(markdown, "Why not the alternatives", 'invalid_input: missing "Why not the alternatives" in Discovery routing record'),
    handoffContractUsed: optionalString(extractBulletValue(markdown, "Handoff contract used", 'invalid_input: missing "Handoff contract used" in Discovery routing record')),
    receivingTrackOwner: extractBulletValue(markdown, "Receiving track owner", 'invalid_input: missing "Receiving track owner" in Discovery routing record'),
    requiredNextArtifact: extractBulletValue(markdown, "Required next artifact", 'invalid_input: missing "Required next artifact" in Discovery routing record'),
    reentryOrPromotionConditions: optionalString(
      extractBulletValue(markdown, "Re-entry/Promotion trigger conditions", 'invalid_input: missing "Re-entry/Promotion trigger conditions" in Discovery routing record'),
    ),
    reviewCadence: optionalString(extractBulletValue(markdown, "Review cadence", 'invalid_input: missing "Review cadence" in Discovery routing record')),
    missionPriorityScore: optionalString(extractOptionalBulletValue(markdown, "Mission priority score")) === null
      ? null
      : Number(readOptionalBullet(markdown, "Mission priority score")),
    routingConfidence: readOptionalBullet(markdown, "Routing confidence"),
    matchedGapId: readOptionalBullet(markdown, "Matched gap id"),
    matchedGapRank: optionalString(extractOptionalBulletValue(markdown, "Matched gap rank")) === null
      ? null
      : Number(readOptionalBullet(markdown, "Matched gap rank")),
    routeConflict: parseYesNoBoolean(readOptionalBullet(markdown, "Route conflict")),
    needsHumanReview: parseYesNoBoolean(readOptionalBullet(markdown, "Needs human review")),
    linkedIntakeRecord: extractBulletValue(markdown, "Linked intake record", 'invalid_input: missing "Linked intake record" in Discovery routing record'),
    linkedTriageRecord: optionalString(extractBulletValue(markdown, "Linked triage record", 'invalid_input: missing "Linked triage record" in Discovery routing record')),
    linkedEngineRunRecord: optionalString(
      extractOptionalBulletValue(
        markdown,
        "Linked Engine run record",
      ),
    ),
    linkedEngineRunReport: optionalString(
      extractOptionalBulletValue(
        markdown,
        "Linked Engine run report",
      ),
    ),
    ambiguitySummary: extractSection(markdown, "Ambiguity Summary")
      ? {
          topTrack: readOptionalBullet(markdown, "Top track") ?? "discovery",
          runnerUpTrack: readOptionalBullet(markdown, "Runner-up track"),
          scoreDelta: Number(readOptionalBullet(markdown, "Score delta") ?? "0"),
          conflictingSignalFamilies: (readOptionalBullet(markdown, "Conflicting signal families") ?? "none")
            .split(/\s*,\s*/)
            .map((entry) => entry.trim())
            .filter((entry) => entry && entry !== "none"),
          conflictingTracks: (readOptionalBullet(markdown, "Conflicting tracks") ?? "none")
            .split(/\s*,\s*/)
            .map((entry) => entry.trim())
            .filter((entry) => entry && entry !== "none"),
        }
      : null,
    reviewGuidance: extractSection(markdown, "Review Guidance")
      ? {
          guidanceKind: readOptionalBullet(markdown, "Guidance kind") ?? "bounded_lane_review",
          summary: readOptionalBullet(markdown, "Summary") ?? "",
          operatorAction: readOptionalBullet(markdown, "Operator action") ?? "",
          requiredChecks: (readOptionalBullet(markdown, "Required checks") ?? "none")
            .split(/\s*\|\s*/)
            .map((entry) => entry.trim())
            .filter((entry) => entry && entry !== "none"),
          stopLine: readOptionalBullet(markdown, "Stop-line") ?? "",
        }
      : null,
    explanationBreakdown: extractSection(markdown, "Routing Explanation Breakdown")
      ? {
          keywordSignals: extractSectionLines(markdown, "Routing Explanation Breakdown", "- Keyword:"),
          metadataSignals: extractSectionLines(markdown, "Routing Explanation Breakdown", "- Metadata:"),
          gapAlignmentSignals: extractSectionLines(markdown, "Routing Explanation Breakdown", "- Gap:"),
          ambiguitySignals: extractSectionLines(markdown, "Routing Explanation Breakdown", "- Ambiguity:"),
        }
      : null,
  };
}

function isDirectiveEngineRunRecordLike(value: unknown): value is DirectiveEngineRunRecordLike {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const candidate = record.candidate as Record<string, unknown> | undefined;
  const analysis = record.analysis as Record<string, unknown> | undefined;
  const extractionPlan = record.extractionPlan as Record<string, unknown> | undefined;
  const proofPlan = record.proofPlan as Record<string, unknown> | undefined;
  const integrationProposal = record.integrationProposal as Record<string, unknown> | undefined;
  const source = record.source as Record<string, unknown> | undefined;

  return Boolean(
    typeof record.runId === "string"
      && typeof record.receivedAt === "string"
      && typeof source?.sourceRef === "string"
      && typeof candidate?.candidateId === "string"
      && typeof candidate?.candidateName === "string"
      && typeof candidate?.usefulnessLevel === "string"
      && typeof analysis?.usefulnessRationale === "string"
      && Array.isArray(extractionPlan?.extractedValue)
      && Array.isArray(extractionPlan?.excludedBaggage)
      && typeof proofPlan?.objective === "string"
      && Array.isArray(proofPlan?.requiredEvidence)
      && Array.isArray(proofPlan?.requiredGates)
      && typeof proofPlan?.rollbackPrompt === "string"
      && typeof integrationProposal?.integrationMode === "string"
      && typeof integrationProposal?.nextAction === "string"
      && typeof integrationProposal?.valuableWithoutHostRuntime === "boolean",
  );
}

function findEngineRunForCandidate(input: {
  directiveRoot: string;
  candidateId: string;
}) {
  const engineRunsRoot = path.join(input.directiveRoot, "runtime", "standalone-host", "engine-runs");
  if (!fs.existsSync(engineRunsRoot)) {
    return null;
  }

  const matches = fs
    .readdirSync(engineRunsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(engineRunsRoot, entry.name))
    .map((recordPath) => {
      try {
        const parsed = JSON.parse(readUtf8(recordPath)) as unknown;
        if (!isDirectiveEngineRunRecordLike(parsed)) {
          return null;
        }
        if (!candidateIdsMatch({
          expectedCandidateId: input.candidateId,
          observedCandidateId: parsed.candidate.candidateId,
        })) {
          return null;
        }
        const reportPath = recordPath.replace(/\.json$/i, ".md");
        return {
          record: parsed,
          recordAbsolutePath: path.resolve(recordPath).replace(/\\/g, "/"),
          recordRelativePath: normalizeDirectiveRelativePath(
            path.relative(input.directiveRoot, recordPath),
          ),
          reportAbsolutePath: fs.existsSync(reportPath)
            ? path.resolve(reportPath).replace(/\\/g, "/")
            : null,
          reportRelativePath: fs.existsSync(reportPath)
            ? normalizeDirectiveRelativePath(path.relative(input.directiveRoot, reportPath))
            : null,
        };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => right.record.receivedAt.localeCompare(left.record.receivedAt));

  return matches[0] ?? null;
}

function readEngineRunByRecordPath(input: {
  directiveRoot: string;
  candidateId: string;
  recordRelativePath: string;
  reportRelativePath: string | null;
}) {
  const recordRelativePath = resolveDirectiveWorkspaceRelativePath(
    input.directiveRoot,
    input.recordRelativePath,
    "linked_engine_run_record",
  );
  const recordAbsolutePath = path.join(input.directiveRoot, recordRelativePath);
  if (!fs.existsSync(recordAbsolutePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readUtf8(recordAbsolutePath)) as unknown;
    if (!isDirectiveEngineRunRecordLike(parsed)) {
      return null;
    }
    if (!candidateIdsMatch({
      expectedCandidateId: input.candidateId,
      observedCandidateId: parsed.candidate.candidateId,
    })) {
      return null;
    }

    const reportFromInput = input.reportRelativePath
      ? resolveDirectiveWorkspaceRelativePath(
        input.directiveRoot,
        input.reportRelativePath,
        "linked_engine_run_report",
      )
      : null;
    const reportFromInputExists = reportFromInput
      ? fs.existsSync(path.join(input.directiveRoot, reportFromInput))
      : false;
    const derivedReportRelativePath = recordRelativePath.replace(/\.json$/i, ".md");
    const resolvedReportRelativePath = reportFromInputExists
      ? reportFromInput
      : (fs.existsSync(path.join(input.directiveRoot, derivedReportRelativePath))
        ? derivedReportRelativePath
        : null);

    return {
      record: parsed,
      recordAbsolutePath: path.resolve(recordAbsolutePath).replace(/\\/g, "/"),
      recordRelativePath: normalizeDirectiveRelativePath(recordRelativePath),
      reportAbsolutePath: resolvedReportRelativePath
        ? path.resolve(path.join(input.directiveRoot, resolvedReportRelativePath)).replace(/\\/g, "/")
        : null,
      reportRelativePath: resolvedReportRelativePath
        ? normalizeDirectiveRelativePath(resolvedReportRelativePath)
        : null,
    };
  } catch {
    return null;
  }
}

function readQueueDocument(directiveRoot: string) {
  const queuePath = path.join(directiveRoot, "discovery", "intake-queue.json");
  if (!fs.existsSync(queuePath)) {
    throw new Error(`invalid_input: discovery queue not found: ${path.resolve(queuePath).replace(/\\/g, "/")}`);
  }
  return {
    queuePath: path.resolve(queuePath).replace(/\\/g, "/"),
    queue: JSON.parse(readUtf8(queuePath)) as DiscoveryIntakeQueueDocument,
  };
}

function renderArchitectureHandoffMarkdown(input: {
  routingRelativePath: string;
  routeDate: string;
  engineRecordRelativePath: string;
  engineReportRelativePath: string | null;
  record: DirectiveEngineRunRecordLike;
}) {
  const extractedValue = input.record.extractionPlan.extractedValue.length > 0
    ? input.record.extractionPlan.extractedValue.map((value) => `  - ${value}`).join("\n")
    : "  - n/a";
  const requiredGates = input.record.proofPlan.requiredGates.length > 0
    ? input.record.proofPlan.requiredGates.map((gate) => `  - \`${gate}\``).join("\n")
    : "  - n/a";

  return [
    `# ${input.record.candidate.candidateName} Engine-Routed Architecture Experiment`,
    "",
    `Date: ${input.routeDate}`,
    "Track: Architecture",
    "Type: engine-routed handoff",
    "Status: pending_review",
    "",
    "## Source",
    "",
    `- Candidate id: \`${input.record.candidate.candidateId}\``,
    `- Source reference: \`${input.record.source.sourceRef}\``,
    `- Engine run record: \`${input.engineRecordRelativePath}\``,
    `- Engine run report: \`${input.engineReportRelativePath ?? "n/a"}\``,
    `- Discovery routing record: \`${input.routingRelativePath}\``,
    `- Usefulness level: \`${input.record.candidate.usefulnessLevel}\``,
    `- Usefulness rationale: ${input.record.analysis.usefulnessRationale}`,
    "",
    "## Objective",
    "",
    input.record.integrationProposal.nextAction,
    "",
    "## Bounded scope",
    "",
    "- Keep this at one Architecture experiment slice.",
    "- Preserve human review before any adoption or host integration.",
    "- Do not execute downstream Engine changes from this stub alone.",
    "",
    "## Inputs",
    "",
    extractedValue,
    "",
    "## Validation gate(s)",
    "",
    requiredGates,
    "",
    "## Lifecycle classification",
    "",
    "- Origin: `source-driven`",
    `- Usefulness level: \`${input.record.candidate.usefulnessLevel}\``,
    `- Runtime threshold check: Would this mechanism still be valuable without a runtime surface? \`${input.record.integrationProposal.valuableWithoutHostRuntime ? "yes" : "no"}\``,
    "",
    "## Rollback",
    "",
    input.record.proofPlan.rollbackPrompt,
    "",
    "## Next decision",
    "",
    "- `needs-more-evidence`",
    "",
  ].join("\n");
}

function inferRuntimeHostSelection(record: DirectiveEngineRunRecordLike): {
  proposed_host: string;
  host_selection_mode: "inferred" | "manual_required";
  proposed_host_confidence: "high" | "medium" | "low";
} {
  const hostDependence = record.integrationProposal.hostDependence ?? "";
  const needsHost = hostDependence === "host_adapter_required"
    || record.integrationProposal.valuableWithoutHostRuntime === false;
  const routingConfidence = record.routingAssessment?.confidence ?? "";
  const highRoutingConfidence = routingConfidence === "high";
  const hasIntegrationMode = Boolean(record.integrationProposal.integrationMode);

  if (needsHost && highRoutingConfidence && hasIntegrationMode) {
    return {
      proposed_host: "Directive Kernel standalone host (hosts/standalone-host/)",
      host_selection_mode: "inferred",
      proposed_host_confidence: "medium",
    };
  }

  return {
    proposed_host: "pending_host_selection",
    host_selection_mode: "manual_required",
    proposed_host_confidence: "low",
  };
}

function buildRuntimeFollowUpRequest(input: {
  artifact: DirectiveDiscoveryRoutingArtifact;
  record: DirectiveEngineRunRecordLike;
}): RuntimeFollowUpRecordRequest {
  const hostSelection = inferRuntimeHostSelection(input.record);

  return {
    candidate_id: input.artifact.candidateId,
    candidate_name: input.artifact.candidateName,
    follow_up_date: input.artifact.routingDate,
    current_decision_state: input.record.decision.decisionState || input.artifact.decisionState,
    origin_track: "discovery-routing-approval",
    runtime_value_to_operationalize:
      input.record.integrationProposal.nextAction
      || input.record.extractionPlan.extractedValue[0]
      || "Bounded runtime usefulness conversion remains to be defined.",
    proposed_host: hostSelection.proposed_host,
    host_selection_mode: hostSelection.host_selection_mode,
    proposed_host_confidence: hostSelection.proposed_host_confidence,
    proposed_integration_mode: input.record.integrationProposal.integrationMode,
    source_pack_allowlist_profile: "n/a",
    allowed_export_surfaces: [
      "bounded runtime capability",
      "callable capability boundary",
    ],
    excluded_baggage: input.record.extractionPlan.excludedBaggage,
    promotion_contract_path: null,
    reentry_contract_path: null,
    reentry_preconditions: [
      "Human review confirms the bounded runtime objective.",
      "Proof scope stays narrow and reversible.",
    ],
    required_proof: input.record.proofPlan.requiredEvidence,
    required_gates: input.record.proofPlan.requiredGates,
    trial_scope_limit: [
      "Keep this as a follow-up stub only.",
      "Do not execute runtime integration from this record alone.",
    ],
    risks: [
      "Human review still required.",
      "Host-specific baggage can leak into runtime implementation if adaptation is skipped.",
    ],
    rollback: input.record.proofPlan.rollbackPrompt,
    no_op_path:
      "Leave the candidate routed with a follow-up stub only and do not materialize runtime execution yet.",
    review_cadence:
      input.artifact.reviewCadence
      ?? "Review on the next active Directive Kernel operating pass.",
    current_status: "pending_review",
    linked_handoff_path: input.artifact.routingRelativePath,
    output_relative_path: input.artifact.requiredNextArtifact,
  };
}

function readRoutingArtifact(input: {
  directiveRoot: string;
  routingRelativePath: string;
}): DirectiveDiscoveryRoutingArtifact {
  if (!input.routingRelativePath.startsWith("discovery/03-routing-log/")) {
    throw new Error("invalid_input: routingPath must point to discovery/03-routing-log/");
  }

  const routingAbsolutePath = path.resolve(input.directiveRoot, input.routingRelativePath).replace(/\\/g, "/");
  if (!fs.existsSync(routingAbsolutePath)) {
    throw new Error(`invalid_input: routingPath not found: ${input.routingRelativePath}`);
  }

  const parsed = parseDiscoveryRoutingMarkdown(readUtf8(routingAbsolutePath));
  const reviewResolution = readDiscoveryRoutingReviewResolution({
    directiveRoot: input.directiveRoot,
    routingRecordPath: input.routingRelativePath,
  });
  const effectiveBoundary = deriveEffectiveDiscoveryRouteBoundary({
    candidateId: parsed.candidateId,
    routingDate: parsed.routingDate,
    routeDestination: parsed.routeDestination,
    decisionState: parsed.decisionState,
    requiredNextArtifact: parsed.requiredNextArtifact,
    reviewResolution,
  });
  const engineRun = parsed.linkedEngineRunRecord
    ? readEngineRunByRecordPath({
      directiveRoot: input.directiveRoot,
      candidateId: parsed.candidateId,
      recordRelativePath: parsed.linkedEngineRunRecord,
      reportRelativePath: parsed.linkedEngineRunReport,
    })
    : findEngineRunForCandidate({
      directiveRoot: input.directiveRoot,
      candidateId: parsed.candidateId,
    });
  const { queue } = readQueueDocument(input.directiveRoot);
  const queueEntry = queue.entries.find((entry) => entry.candidate_id === parsed.candidateId) ?? null;
  const approvalAllowed = effectiveBoundary.approvalAllowed;
  const downstreamStubRelativePath = approvalAllowed
    ? optionalString(queueEntry?.result_record_path)
      ?? (fs.existsSync(path.join(input.directiveRoot, effectiveBoundary.effectiveRequiredNextArtifact))
        ? effectiveBoundary.effectiveRequiredNextArtifact
        : null)
    : null;

  return {
    ...parsed,
    effectiveRouteDestination: effectiveBoundary.effectiveRouteDestination,
    routingRelativePath: input.routingRelativePath,
    routingAbsolutePath,
    effectiveRequiredNextArtifact: effectiveBoundary.effectiveRequiredNextArtifact,
    downstreamStubRelativePath,
    downstreamStubExists: Boolean(downstreamStubRelativePath),
    approvalAllowed,
    engineRunRecordPath:
      parsed.linkedEngineRunRecord
      ?? engineRun?.recordRelativePath
      ?? null,
    engineRunReportPath:
      parsed.linkedEngineRunReport
      ?? engineRun?.reportRelativePath
      ?? null,
    engineRunId: engineRun?.record.runId ?? null,
    usefulnessLevel: parsed.usefulnessLevel ?? engineRun?.record.candidate.usefulnessLevel ?? null,
    usefulnessRationale: parsed.usefulnessRationale ?? engineRun?.record.analysis.usefulnessRationale ?? null,
    missionPriorityScore:
      parsed.missionPriorityScore
      ?? engineRun?.record.candidate.missionPriorityScore
      ?? null,
    matchedGapId:
      parsed.matchedGapId
      ?? engineRun?.record.candidate.matchedGapId
      ?? engineRun?.record.routingAssessment?.matchedGapId
      ?? null,
    gapPressure: engineRun?.record
      ? describeDirectiveEngineGapPressure(engineRun.record)
      : null,
    routingConfidence:
      parsed.routingConfidence
      ?? engineRun?.record.routingAssessment?.confidence
      ?? engineRun?.record.candidate.confidence
      ?? null,
    routeConflict: parsed.routeConflict ?? engineRun?.record.routingAssessment?.routeConflict ?? null,
    needsHumanReview:
      parsed.needsHumanReview
      ?? engineRun?.record.routingAssessment?.needsHumanReview
      ?? engineRun?.record.candidate.requiresHumanReview
      ?? null,
    explanationBreakdown:
      parsed.explanationBreakdown
      ?? (engineRun?.record?.routingAssessment?.explanationBreakdown
        ? {
            keywordSignals: [...engineRun.record.routingAssessment.explanationBreakdown.keywordSignals],
            metadataSignals: [...engineRun.record.routingAssessment.explanationBreakdown.metadataSignals],
            gapAlignmentSignals: [...engineRun.record.routingAssessment.explanationBreakdown.gapAlignmentSignals],
            ambiguitySignals: [...engineRun.record.routingAssessment.explanationBreakdown.ambiguitySignals],
          }
        : null),
    ambiguitySummary:
      parsed.ambiguitySummary
      ? {
          topLaneId: parsed.ambiguitySummary.topTrack,
          runnerUpLaneId: parsed.ambiguitySummary.runnerUpTrack,
          scoreDelta: parsed.ambiguitySummary.scoreDelta,
          conflictingSignalFamilies: [...parsed.ambiguitySummary.conflictingSignalFamilies],
          conflictingLaneIds: [...parsed.ambiguitySummary.conflictingTracks],
        }
      : engineRun?.record.routingAssessment?.ambiguitySummary ?? null,
    reviewGuidance:
      parsed.reviewGuidance
      ? {
          guidanceKind: parsed.reviewGuidance.guidanceKind,
          summary: parsed.reviewGuidance.summary,
          operatorAction: parsed.reviewGuidance.operatorAction,
          requiredChecks: [...parsed.reviewGuidance.requiredChecks],
          stopLine: parsed.reviewGuidance.stopLine,
        }
      : engineRun?.record.routingAssessment?.reviewGuidance ?? null,
  };
}

function updateQueueForOpenedRoute(input: {
  directiveRoot: string;
  artifact: DirectiveDiscoveryRoutingArtifact;
  stubRelativePath: string;
  approvedBy: string;
}) {
  const { queuePath, queue } = readQueueDocument(input.directiveRoot);
  const result = syncDiscoveryIntakeLifecycle({
    directiveRoot: input.directiveRoot,
    queue,
    transitionDate: input.artifact.routingDate,
    request: {
      candidate_id: input.artifact.candidateId,
      target_phase: "routed",
      routing_target: input.artifact.effectiveRouteDestination,
      intake_record_path: input.artifact.linkedIntakeRecord,
      routing_record_path: input.artifact.routingRelativePath,
      result_record_path: input.stubRelativePath,
      note_append: `route approval by ${input.approvedBy} opened ${input.stubRelativePath}`,
    },
  });
  writeJsonPretty(queuePath, result.queue);
  return queuePath;
}

export function readDirectiveDiscoveryRoutingArtifact(input: {
  routingPath: string;
  directiveRoot?: string;
}) {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const routingRelativePath = resolveDirectiveWorkspaceRelativePath(
    directiveRoot,
    input.routingPath,
    "routingPath",
  );
  return readRoutingArtifact({
    directiveRoot,
    routingRelativePath,
  });
}

export function openDirectiveDiscoveryRoute(input: {
  routingPath: string;
  approved?: boolean;
  approvedBy?: string | null;
  directiveRoot?: string;
}): DirectiveDiscoveryRouteOpenResult {
  requireDirectiveExplicitApproval({
    approved: input.approved,
    action: "open a Discovery route",
  });

  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const routingRelativePath = resolveDirectiveWorkspaceRelativePath(
    directiveRoot,
    input.routingPath,
    "routingPath",
  );
  const artifact = readRoutingArtifact({
    directiveRoot,
    routingRelativePath,
  });

  if (!artifact.approvalAllowed) {
    throw new Error(
      `invalid_input: routing record cannot open downstream work for effective route destination "${artifact.effectiveRouteDestination}" and decision "${artifact.decisionState}"`,
    );
  }

  const engineRun = artifact.engineRunRecordPath
    ? readEngineRunByRecordPath({
      directiveRoot,
      candidateId: artifact.candidateId,
      recordRelativePath: artifact.engineRunRecordPath,
      reportRelativePath: artifact.engineRunReportPath,
    })
    : findEngineRunForCandidate({
      directiveRoot,
      candidateId: artifact.candidateId,
    });
  if (!engineRun) {
    if (artifact.engineRunRecordPath) {
      throw new Error(
        `invalid_state: linked Engine run artifact not found for candidate ${artifact.candidateId}: ${artifact.engineRunRecordPath}`,
      );
    }
    throw new Error(
      `invalid_state: no Engine run artifact found for candidate ${artifact.candidateId}`,
    );
  }
  if (!engineRun.reportRelativePath) {
    throw new Error(
      `invalid_state: Engine run report missing for candidate ${artifact.candidateId}`,
    );
  }

  const approvedBy = normalizeDirectiveApprovalActor(input.approvedBy);
  const stubRelativePath = normalizeDirectiveRelativePath(artifact.effectiveRequiredNextArtifact);
  const stubAbsolutePath = path.resolve(directiveRoot, stubRelativePath).replace(/\\/g, "/");

  if (artifact.effectiveRouteDestination === "architecture") {
    if (
      !stubRelativePath.startsWith("architecture/01-experiments/")
      || !stubRelativePath.endsWith("-engine-handoff.md")
    ) {
      throw new Error("invalid_input: Architecture route must open an engine handoff stub");
    }

    const created = writeDirectiveArtifactIfMissing({
      absolutePath: stubAbsolutePath,
      content: renderArchitectureHandoffMarkdown({
        routingRelativePath,
        routeDate: artifact.routingDate,
        engineRecordRelativePath: engineRun.recordRelativePath,
        engineReportRelativePath: engineRun.reportRelativePath,
        record: engineRun.record,
      }),
    });

    const queuePath = updateQueueForOpenedRoute({
      directiveRoot,
      artifact,
      stubRelativePath,
      approvedBy,
    });

    return {
      ok: true,
      created,
      directiveRoot,
      routingRelativePath,
      routeDestination: "architecture",
      stubKind: "architecture_handoff",
      stubRelativePath,
      stubAbsolutePath,
      candidateId: artifact.candidateId,
      candidateName: artifact.candidateName,
      queuePath,
    };
  }

  if (
    !stubRelativePath.startsWith("runtime/00-follow-up/")
    || !stubRelativePath.endsWith("-runtime-follow-up-record.md")
  ) {
    throw new Error("invalid_input: Runtime route must open a Runtime follow-up stub");
  }

  const created = writeDirectiveArtifactIfMissing({
    absolutePath: stubAbsolutePath,
    content: renderRuntimeFollowUpRecord(
      buildRuntimeFollowUpRequest({
        artifact,
        record: engineRun.record,
      }),
    ),
  });

  const queuePath = updateQueueForOpenedRoute({
    directiveRoot,
    artifact,
    stubRelativePath,
    approvedBy,
  });

  return {
    ok: true,
    created,
    directiveRoot,
    routingRelativePath,
    routeDestination: "runtime",
    stubKind: "runtime_follow_up",
    stubRelativePath,
    stubAbsolutePath,
    candidateId: artifact.candidateId,
    candidateName: artifact.candidateName,
    queuePath,
  };
}

