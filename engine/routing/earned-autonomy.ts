import { extractSourceSignalTokens } from "./correction-ledger.ts";
import type { DecisionPolicyEvent } from "../decision-policy-ledger.ts";
import type { RoutingCorrectionEntry } from "./correction-ledger.ts";
import { deriveRoutingQualityAssessment } from "./quality.ts";
import { clampInt, countTokenOverlap, flattenSourceText } from "../source-utils.ts";
import type {
  EngineRoutingConfidence,
  EngineRunRecord,
  EngineSourceItem,
} from "../types.ts";

export type EngineEarnedAutonomyAssessment = {
  routeClass: string;
  overallScore: number;
  evidenceCount: number;
  operatorAgreementRate: number | null;
  reviewClearRate: number | null;
  reversalCount: number;
  autoApprovalEligible: boolean;
  approvalReductionApplied: boolean;
  summary: string;
  rationale: string[];
};

export function deriveEngineRouteClass(input: {
  recommendedLaneId: string;
  source: EngineSourceItem;
}) {
  return [
    input.recommendedLaneId,
    input.source.sourceType,
    input.source.containsWorkflowPattern === true ? "workflow" : "nonworkflow",
    input.source.improvesDirectiveWorkspace === true ? "workspace" : "external",
    input.source.containsExecutableCode === true ? "code" : "nocode",
  ].join(":");
}

export function deriveEngineEarnedAutonomyAssessment(input: {
  source: EngineSourceItem;
  recommendedLaneId: string;
  recommendedRecordShape: string;
  confidence: EngineRoutingConfidence;
  routeConflict: boolean;
  baseNeedsHumanReview: boolean;
  existingRuns: EngineRunRecord[];
  policyEvents: DecisionPolicyEvent[];
  corrections: RoutingCorrectionEntry[];
}) {
  const routeClass = deriveEngineRouteClass({
    recommendedLaneId: input.recommendedLaneId,
    source: input.source,
  });
  const sourceTokens = extractSourceSignalTokens(flattenSourceText(input.source));

  const similarRuns = input.existingRuns.filter((record) =>
    deriveEngineRouteClass({
      recommendedLaneId: record.selectedLane.laneId,
      source: record.source,
    }) === routeClass
  );
  const cleanRuns = similarRuns.filter((record) =>
    record.routingAssessment.confidence === "high"
    && record.routingAssessment.routeConflict === false
    && record.routingAssessment.needsHumanReview === false
    && record.decision.requiresHumanApproval === false
  );
  const noisyRuns = similarRuns.filter((record) =>
    record.routingAssessment.routeConflict === true
    || record.routingAssessment.needsHumanReview === true
  );

  const matchingEvents = input.policyEvents.filter((event) =>
    event.resolvedLaneId === input.recommendedLaneId
    && event.sourceType === input.source.sourceType
    && countTokenOverlap(sourceTokens, event.sourceSignalTokens) >= 2
  );
  const contraryEvents = input.policyEvents.filter((event) =>
    event.sourceType === input.source.sourceType
    && event.resolvedLaneId !== input.recommendedLaneId
    && countTokenOverlap(sourceTokens, event.sourceSignalTokens) >= 2
  );
  const operatorAgreementCount = matchingEvents.filter((event) =>
    event.originalLaneId === event.resolvedLaneId
  ).length;
  const reviewClearCount = matchingEvents.filter((event) =>
    event.originalNeedsHumanReview === true
    && event.resolvedNeedsHumanReview === false
    && event.resolvedConfidence === "high"
  ).length;
  const operatorAgreementRate = matchingEvents.length > 0
    ? operatorAgreementCount / matchingEvents.length
    : null;
  const reviewClearRate = matchingEvents.length > 0
    ? reviewClearCount / matchingEvents.length
    : null;
  const reversalCount =
    contraryEvents.length
    + matchingEvents.filter((event) => event.originalLaneId !== event.resolvedLaneId).length;
  const evidenceCount = similarRuns.length + matchingEvents.length;
  const routingQuality = deriveRoutingQualityAssessment({
    routeClass,
    existingRuns: input.existingRuns,
    policyEvents: input.policyEvents,
    corrections: input.corrections,
  });

  const overallScore = clampInt(
    10
    + cleanRuns.length * 16
    + operatorAgreementCount * 10
    + reviewClearCount * 8
    + (input.confidence === "high" ? 10 : input.confidence === "medium" ? 5 : 0)
    + Math.round((routingQuality.overallScore - 50) / 5)
    - noisyRuns.length * 10
    - contraryEvents.length * 14
    - reversalCount * 6
    - (input.routeConflict ? 20 : 0),
    0,
    100,
  );

  const autoApprovalEligible =
    input.baseNeedsHumanReview
    && input.recommendedLaneId !== "discovery"
    && !input.routeConflict
    && input.confidence !== "low"
    && input.recommendedRecordShape !== "queue_only"
    && evidenceCount >= 3
    && overallScore >= 75
    && contraryEvents.length === 0
    && reversalCount <= 1
    && (
      cleanRuns.length >= 2
      || operatorAgreementCount >= 2
      || reviewClearCount >= 2
    );

  const approvalReductionApplied = autoApprovalEligible;
  const rationale = [
    `Route class ${routeClass} has ${similarRuns.length} prior runs and ${matchingEvents.length} matching review decisions.`,
    `Clean prior runs: ${cleanRuns.length}; noisy prior runs: ${noisyRuns.length}.`,
    operatorAgreementRate == null
      ? "No matching operator-decision history exists yet for this route class."
      : `Operator agreement rate is ${(operatorAgreementRate * 100).toFixed(0)}%.`,
    reviewClearRate == null
      ? "No matching review-clear history exists yet for this route class."
      : `Review-clear rate is ${(reviewClearRate * 100).toFixed(0)}%.`,
    `Contrary decisions: ${contraryEvents.length}; reversals counted against this route: ${reversalCount}.`,
    `Routing quality is ${routingQuality.overallScore}/100 across ${routingQuality.resolvedOutcomeCount} recorded outcomes for this route class.`,
  ];

  return {
    routeClass,
    overallScore,
    evidenceCount,
    operatorAgreementRate,
    reviewClearRate,
    reversalCount,
    autoApprovalEligible,
    approvalReductionApplied,
    summary: autoApprovalEligible
      ? "Earned Autonomy found enough clean history to waive this run's extra manual review gate."
      : "Earned Autonomy did not find enough clean history to relax the current review boundary.",
    rationale,
  } satisfies EngineEarnedAutonomyAssessment;
}
