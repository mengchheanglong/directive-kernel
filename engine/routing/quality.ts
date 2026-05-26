import type { DecisionPolicyEvent } from "../decision-policy-ledger.ts";
import { clampInt } from "../source-utils.ts";
import { deriveRoutingOutcomes } from "../outcome-tracker.ts";
import type { RoutingCorrectionEntry } from "./correction-ledger.ts";
import type { EngineRunRecord } from "../types.ts";

export type RoutingQualityAssessment = {
  routeClass: string;
  overallScore: number;
  resolvedOutcomeCount: number;
  strongCount: number;
  adequateCount: number;
  weakCount: number;
  failedCount: number;
  operatorAgreementRate: number | null;
  correctionRate: number | null;
  averageResolutionHours: number | null;
  summary: string;
  rationale: string[];
};

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function deriveRoutingQualityAssessment(input: {
  routeClass: string;
  existingRuns: EngineRunRecord[];
  policyEvents: DecisionPolicyEvent[];
  corrections: RoutingCorrectionEntry[];
}): RoutingQualityAssessment {
  const outcomes = deriveRoutingOutcomes({
    existingRuns: input.existingRuns,
    policyEvents: input.policyEvents,
    corrections: input.corrections,
  }).filter((outcome) => outcome.routeClass === input.routeClass);

  const strongCount = outcomes.filter((outcome) => outcome.outcomeQuality === "strong").length;
  const adequateCount = outcomes.filter((outcome) => outcome.outcomeQuality === "adequate").length;
  const weakCount = outcomes.filter((outcome) => outcome.outcomeQuality === "weak").length;
  const failedCount = outcomes.filter((outcome) => outcome.outcomeQuality === "failed").length;
  const strongPlanCount = outcomes.filter((outcome) => outcome.planQuality === "strong").length;
  const weakPlanCount = outcomes.filter((outcome) => outcome.planQuality === "weak").length;
  const operatorAgreementCount = outcomes.filter((outcome) => outcome.operatorAgreed).length;
  const correctionCount = outcomes.filter((outcome) => outcome.operatorCorrected).length;
  const resolutionHours = outcomes
    .map((outcome) => outcome.timeToResolutionHours)
    .filter((value): value is number => typeof value === "number");
  const operatorAgreementRate = outcomes.length > 0
    ? operatorAgreementCount / outcomes.length
    : null;
  const correctionRate = outcomes.length > 0
    ? correctionCount / outcomes.length
    : null;
  const averageResolutionHours = average(resolutionHours);
  const overallScore = clampInt(
    50
      + strongCount * 12
      + adequateCount * 6
      - weakCount * 8
      - failedCount * 18
      + strongPlanCount * 4
      - weakPlanCount * 4
      + Math.round((operatorAgreementRate ?? 0) * 20)
      - Math.round((correctionRate ?? 0) * 25),
    0,
    100,
  );

  const rationale = [
    `Resolved outcomes: ${outcomes.length}. Strong=${strongCount}, adequate=${adequateCount}, weak=${weakCount}, failed=${failedCount}.`,
    `Historical plan quality: strong=${strongPlanCount}, weak=${weakPlanCount}.`,
    operatorAgreementRate == null
      ? "No operator outcome history is recorded for this route class yet."
      : `Operator agreement rate is ${(operatorAgreementRate * 100).toFixed(0)}%.`,
    correctionRate == null
      ? "No correction rate can be computed yet for this route class."
      : `Correction rate is ${(correctionRate * 100).toFixed(0)}%.`,
    averageResolutionHours == null
      ? "No resolution timing evidence exists yet for this route class."
      : `Average time to recorded resolution is ${Math.round(averageResolutionHours)} hour(s).`,
  ];

  return {
    routeClass: input.routeClass,
    overallScore,
    resolvedOutcomeCount: outcomes.length,
    strongCount,
    adequateCount,
    weakCount,
    failedCount,
    operatorAgreementRate,
    correctionRate,
    averageResolutionHours,
    summary:
      outcomes.length === 0
        ? "Routing quality is still unproven because this route class has no recorded outcomes yet."
        : `Routing quality is ${overallScore}/100 across ${outcomes.length} recorded outcome${outcomes.length === 1 ? "" : "s"}.`,
    rationale,
  };
}
