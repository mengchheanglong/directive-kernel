import type { DecisionPolicyEvent } from "./decision-policy-ledger.ts";
import { clampInt, parseTimestamp } from "./engine-source-utils.ts";
import type { RoutingCorrectionEntry } from "./routing/routing-correction-ledger.ts";
import type { DirectiveEngineRunRecord } from "./types.ts";

export type DirectiveRoutingOutcome = {
  runId: string;
  routeClass: string;
  outcomeRecordedAt: string;
  proofCompleted: boolean;
  gapClosed: boolean;
  operatorAgreed: boolean;
  operatorCorrected: boolean;
  timeToResolutionHours: number | null;
  planQuality: import("./planning/plan-quality.ts").DirectiveEnginePlanQualitySignal["overallPlanQuality"] | null;
  outcomeQuality: "strong" | "adequate" | "weak" | "failed";
  notes: string[];
};

function deriveRouteClass(record: DirectiveEngineRunRecord) {
  return [
    record.selectedLane.laneId,
    record.source.sourceType,
    record.source.containsWorkflowPattern === true ? "workflow" : "nonworkflow",
    record.source.improvesDirectiveWorkspace === true ? "workspace" : "external",
    record.source.containsExecutableCode === true ? "code" : "nocode",
  ].join(":");
}

function hoursBetween(start: string, end: string) {
  const startMs = parseTimestamp(start);
  const endMs = parseTimestamp(end);
  if (startMs === null || endMs === null || endMs < startMs) {
    return null;
  }
  return clampInt((endMs - startMs) / (1000 * 60 * 60), 0, 24 * 365 * 10);
}

function inferProofCompletion(record: DirectiveEngineRunRecord) {
  if (record.executablePlanState?.proofState.finalState === "proved") {
    return true;
  }
  return (
    record.selectedLane.laneId !== "discovery"
    && record.routingAssessment.confidence === "high"
    && record.routingAssessment.routeConflict === false
    && record.routingAssessment.needsHumanReview === false
    && record.decision.requiresHumanApproval === false
  );
}

export function deriveDirectiveRoutingOutcome(input: {
  record: DirectiveEngineRunRecord;
  policyEvents: DecisionPolicyEvent[];
  corrections: RoutingCorrectionEntry[];
}): DirectiveRoutingOutcome {
  const candidateId = input.record.candidate.candidateId;
  const relatedPolicyEvents = input.policyEvents.filter((event) => event.candidateId === candidateId);
  const relatedCorrections = input.corrections.filter((entry) => entry.candidateId === candidateId);
  const policyResolutionAt = [...relatedPolicyEvents]
    .map((event) => event.recordedAt)
    .sort((left, right) => left.localeCompare(right))[0] ?? null;
  const correctionAt = [...relatedCorrections]
    .map((entry) => entry.correctedAt)
    .sort((left, right) => left.localeCompare(right))[0] ?? null;

  const operatorCorrected =
    relatedCorrections.length > 0
    || relatedPolicyEvents.some((event) => event.originalLaneId !== event.resolvedLaneId);
  const operatorAgreed = relatedPolicyEvents.some((event) =>
    event.originalLaneId === event.resolvedLaneId
    && event.resolvedLaneId === input.record.selectedLane.laneId
  );
  const matchedGapId = input.record.routingAssessment.matchedGapId;
  const resolvedGap = matchedGapId
    ? input.record.openGaps.find((gap) =>
      gap.gapId === matchedGapId && Boolean(gap.resolvedAt)
    ) ?? null
    : null;
  const gapClosed = Boolean(resolvedGap);
  const proofCompleted = inferProofCompletion(input.record);
  const outcomeRecordedAt =
    resolvedGap?.resolvedAt
    ?? correctionAt
    ?? policyResolutionAt
    ?? input.record.receivedAt;
  const timeToResolutionHours = hoursBetween(
    input.record.receivedAt,
    outcomeRecordedAt,
  );

  const notes: string[] = [];
  if (operatorAgreed) {
    notes.push("operator agreement recorded");
  }
  if (operatorCorrected) {
    notes.push("operator correction recorded");
  }
  if (proofCompleted) {
    notes.push("bounded high-confidence follow-through inferred");
  }
  if (gapClosed) {
    notes.push(`matched gap ${matchedGapId} is now resolved`);
  }
  if (input.record.planQualitySignal?.overallPlanQuality) {
    notes.push(
      `historical plan quality is ${input.record.planQualitySignal.overallPlanQuality}`,
    );
  }

  const outcomeQuality =
    operatorCorrected
      ? "failed"
      : gapClosed || (operatorAgreed && proofCompleted)
        ? "strong"
        : operatorAgreed || proofCompleted
          ? "adequate"
          : "weak";

  if (notes.length === 0) {
    notes.push("no downstream resolution signal recorded yet");
  }

  return {
    runId: input.record.runId,
    routeClass: deriveRouteClass(input.record),
    outcomeRecordedAt,
    proofCompleted,
    gapClosed,
    operatorAgreed,
    operatorCorrected,
    timeToResolutionHours,
    planQuality: input.record.planQualitySignal?.overallPlanQuality ?? null,
    outcomeQuality,
    notes,
  };
}

export function deriveDirectiveRoutingOutcomes(input: {
  existingRuns: DirectiveEngineRunRecord[];
  policyEvents: DecisionPolicyEvent[];
  corrections: RoutingCorrectionEntry[];
}) {
  return input.existingRuns.map((record) =>
    deriveDirectiveRoutingOutcome({
      record,
      policyEvents: input.policyEvents,
      corrections: input.corrections,
    })
  );
}
