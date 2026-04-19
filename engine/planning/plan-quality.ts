import { clampInt, countTokenOverlap } from "../engine-source-utils.ts";
import { extractSourceSignalTokens } from "../routing/routing-correction-ledger.ts";
import type { DirectiveEnginePlanItem, DirectiveEngineRunRecord } from "../types.ts";
import type { DecisionPolicyEvent } from "../decision-policy-ledger.ts";
import type { RoutingCorrectionEntry } from "../routing/routing-correction-ledger.ts";

export type DirectiveEnginePlanQualitySignal = {
  extractionRelevance: "high" | "medium" | "low" | "unknown";
  adaptationFollowThrough: "completed" | "partial" | "none" | "unknown";
  improvementGoalProgress: number;
  proofGateCompletion: number;
  overallPlanQuality: "strong" | "adequate" | "weak" | "unknown";
  rationale: string[];
};

function uniqueTokensFromText(values: string[]) {
  return Array.from(
    new Set(
      extractSourceSignalTokens(values.join(" ")),
    ),
  );
}

function buildRunDownstreamTokens(run: DirectiveEngineRunRecord) {
  return uniqueTokensFromText([
    run.adaptationPlan.directiveOwnedForm,
    ...run.adaptationPlan.adaptedValue,
    ...run.improvementPlan.improvementGoals,
    run.improvementPlan.intendedDelta,
    run.proofPlan.objective,
    ...run.proofPlan.requiredEvidence,
    ...run.proofPlan.requiredGates,
  ]);
}

function completedCount(items: DirectiveEnginePlanItem[]) {
  return items.filter((item) => item.status === "completed").length;
}

function completionRateForPlanActions(input: {
  record: DirectiveEngineRunRecord;
  plan: "extraction" | "adaptation" | "improvement" | "proof";
}) {
  const planActions = input.record.executablePlanState?.actions.filter((action) =>
    action.plan === input.plan
  ) ?? [];
  if (planActions.length === 0) {
    return null;
  }
  const completed = planActions.filter((action) =>
    action.status === "completed" || action.status === "skipped"
  ).length;
  return clampInt(Math.round((completed / planActions.length) * 100), 0, 100);
}

function deriveExtractionRelevance(input: {
  record: DirectiveEngineRunRecord;
  relatedRuns: DirectiveEngineRunRecord[];
  rationale: string[];
}) {
  const extractedTokens = uniqueTokensFromText(input.record.extractionPlan.extractedValue);
  if (extractedTokens.length === 0 || input.relatedRuns.length === 0) {
    input.rationale.push(
      "Extraction relevance is unknown because there is no similar historical downstream usage to compare.",
    );
    return "unknown" as const;
  }

  const maxOverlap = input.relatedRuns.reduce((best, run) =>
    Math.max(best, countTokenOverlap(extractedTokens, buildRunDownstreamTokens(run))), 0);

  if (maxOverlap >= 3) {
    input.rationale.push(
      `Extraction relevance is high because extracted value tokens reappear strongly in similar downstream plans (max overlap ${maxOverlap}).`,
    );
    return "high" as const;
  }
  if (maxOverlap >= 1) {
    input.rationale.push(
      `Extraction relevance is medium because extracted value tokens partially reappear in similar downstream plans (max overlap ${maxOverlap}).`,
    );
    return "medium" as const;
  }

  input.rationale.push(
    "Extraction relevance is low because extracted value tokens did not reappear in similar downstream plans.",
  );
  return "low" as const;
}

function deriveAdaptationFollowThrough(input: {
  record: DirectiveEngineRunRecord;
  rationale: string[];
}) {
  const actualCompletionRate =
    completionRateForPlanActions({ record: input.record, plan: "adaptation" })
    ?? input.record.structuredAdaptationPlan?.completionRate
    ?? 0;
  if (actualCompletionRate >= 100) {
    input.rationale.push(
      "Adaptation follow-through is completed because the executable adaptation actions are fully marked complete.",
    );
    return "completed" as const;
  }
  if (actualCompletionRate > 0) {
    input.rationale.push(
      `Adaptation follow-through is partial because the executable adaptation actions are ${actualCompletionRate}% complete.`,
    );
    return "partial" as const;
  }

  const patterns = input.record.priorPlanContext?.adaptationPatterns ?? [];
  if (patterns.length === 0) {
    input.rationale.push(
      "Adaptation follow-through is unknown because there is no similar adaptation history yet.",
    );
    return "unknown" as const;
  }

  const currentTokens = uniqueTokensFromText([input.record.adaptationPlan.directiveOwnedForm]);
  const matchingPattern = patterns
    .map((pattern) => ({
      pattern,
      overlap: countTokenOverlap(
        currentTokens,
        uniqueTokensFromText([pattern.directiveOwnedForm]),
      ),
    }))
    .sort((left, right) => right.overlap - left.overlap)[0];

  if (!matchingPattern || matchingPattern.overlap === 0) {
    input.rationale.push(
      "Adaptation follow-through is unknown because the current directive-owned form has no close historical pattern match.",
    );
    return "unknown" as const;
  }

  if (matchingPattern.pattern.successfulCount > 0 && matchingPattern.pattern.stalledCount === 0) {
    input.rationale.push(
      `Adaptation follow-through is completed because similar directive-owned forms succeeded ${matchingPattern.pattern.successfulCount} times without stalls.`,
    );
    return "completed" as const;
  }
  if (matchingPattern.pattern.successfulCount > 0) {
    input.rationale.push(
      `Adaptation follow-through is partial because similar directive-owned forms have mixed history (${matchingPattern.pattern.successfulCount} successful, ${matchingPattern.pattern.stalledCount} stalled).`,
    );
    return "partial" as const;
  }

  input.rationale.push(
    `Adaptation follow-through is none because similar directive-owned forms only show stalled history (${matchingPattern.pattern.stalledCount} stalled).`,
  );
  return "none" as const;
}

function deriveImprovementGoalProgress(input: {
  record: DirectiveEngineRunRecord;
  rationale: string[];
}) {
  const actualCompletionRate =
    completionRateForPlanActions({ record: input.record, plan: "improvement" })
    ?? input.record.structuredImprovementPlan?.completionRate
    ?? 0;
  const priorContext = input.record.priorPlanContext;
  if (!priorContext) {
    if (actualCompletionRate > 0) {
      input.rationale.push(
        `Improvement goal progress uses the current structured plan completion rate of ${actualCompletionRate}% because there is no similar plan history yet.`,
      );
      return actualCompletionRate;
    }
    input.rationale.push(
      "Improvement goal progress defaults to 0 because there is no similar plan history yet.",
    );
    return 0;
  }

  const currentGoals = input.record.improvementPlan.improvementGoals;
  const recurringGoals = priorContext.recurringImprovementGoals;
  const recurringMatches = currentGoals.filter((goal) =>
    recurringGoals.some((previous) =>
      countTokenOverlap(
        uniqueTokensFromText([goal]),
        uniqueTokensFromText([previous]),
      ) >= 2
    )
  ).length;
  const totalHistory = priorContext.successfulFollowThroughCount + priorContext.stalledRunCount;
  const successRate = totalHistory > 0
    ? priorContext.successfulFollowThroughCount / totalHistory
    : 0;
  const score = clampInt(
    Math.round(successRate * 70)
      + Math.round(actualCompletionRate * 0.3)
      + (recurringMatches === 0 ? 20 : 0)
      - recurringMatches * 15,
    0,
    100,
  );
  input.rationale.push(
    `Improvement goal progress is ${score}/100 based on ${priorContext.successfulFollowThroughCount} successful vs ${priorContext.stalledRunCount} stalled similar runs and ${recurringMatches} recurring goal matches.`,
  );
  return score;
}

function deriveProofGateCompletion(input: {
  record: DirectiveEngineRunRecord;
  rationale: string[];
}) {
  const proofState = input.record.executablePlanState?.proofState ?? null;
  if (proofState) {
    const directCompletion = proofState.finalState === "proved"
      ? 100
      : proofState.gateState === "gate_passed" && proofState.evidenceState === "evidence_gathered"
        ? 85
        : proofState.evidenceState === "evidence_gathered" || proofState.gateState === "gate_passed"
          ? 60
          : proofState.objectiveState === "defined"
            ? 25
            : 0;
    if (directCompletion > 0) {
      input.rationale.push(
        `Proof gate completion directly reflects the executable proof state: objective ${proofState.objectiveState}, evidence ${proofState.evidenceState}, gates ${proofState.gateState}, final ${proofState.finalState}.`,
      );
      return directCompletion;
    }
  }

  const structuredProofPlan = input.record.structuredProofPlan;
  if (structuredProofPlan) {
    const directItems = [
      structuredProofPlan.objective,
      structuredProofPlan.rollbackPrompt,
      ...structuredProofPlan.requiredEvidence,
      ...structuredProofPlan.requiredGates,
    ];
    const directCompletion = clampInt(
      Math.round((completedCount(directItems) / Math.max(1, directItems.length)) * 100),
      0,
      100,
    );
    if (directCompletion > 0) {
      input.rationale.push(
        `Proof gate completion directly reflects the current structured proof plan: ${directCompletion}% complete.`,
      );
      return directCompletion;
    }
  }

  const priorContext = input.record.priorPlanContext;
  if (!priorContext) {
    input.rationale.push(
      "Proof gate completion defaults to 0 because there is no similar proof history yet.",
    );
    return 0;
  }

  const matchingProofKind = priorContext.recurringProofKinds.find((entry) =>
    entry.proofKind === input.record.proofPlan.proofKind
  );
  if (!matchingProofKind) {
    const fallbackScore = priorContext.successfulFollowThroughCount > priorContext.stalledRunCount
      ? 50
      : 0;
    input.rationale.push(
      matchingProofKind
        ? ""
        : `Proof gate completion falls back to ${fallbackScore}/100 because this proof kind has no direct historical match.`,
    );
    return fallbackScore;
  }

  const score = matchingProofKind.status === "successful"
    ? 100
    : matchingProofKind.status === "mixed"
      ? 50
      : 0;
  input.rationale.push(
    `Proof gate completion is ${score}/100 because proof kind ${matchingProofKind.proofKind} has ${matchingProofKind.status} historical follow-through.`,
  );
  return score;
}

export function deriveDirectivePlanQualitySignal(input: {
  record: DirectiveEngineRunRecord;
  existingRuns: DirectiveEngineRunRecord[];
  policyEvents?: DecisionPolicyEvent[];
  corrections?: RoutingCorrectionEntry[];
}): DirectiveEnginePlanQualitySignal {
  void input.policyEvents;
  void input.corrections;

  const relatedRunIds = new Set(input.record.priorPlanContext?.relatedRunIds ?? []);
  const relatedRuns = input.existingRuns.filter((run) => relatedRunIds.has(run.runId));
  const rationale: string[] = [];

  const extractionRelevance = deriveExtractionRelevance({
    record: input.record,
    relatedRuns,
    rationale,
  });
  const adaptationFollowThrough = deriveAdaptationFollowThrough({
    record: input.record,
    rationale,
  });
  const improvementGoalProgress = deriveImprovementGoalProgress({
    record: input.record,
    rationale,
  });
  const proofGateCompletion = deriveProofGateCompletion({
    record: input.record,
    rationale,
  });

  const overallPlanQuality =
    !input.record.priorPlanContext
      ? "unknown"
      : extractionRelevance === "high"
          && adaptationFollowThrough === "completed"
          && improvementGoalProgress >= 70
          && proofGateCompletion >= 70
        ? "strong"
        : (
            extractionRelevance === "low"
            || adaptationFollowThrough === "none"
            || improvementGoalProgress < 40
            || proofGateCompletion < 40
          )
        ? "weak"
        : "adequate";

  if (overallPlanQuality === "unknown") {
    rationale.push(
      "Overall plan quality is unknown because this route has not accumulated comparable downstream history yet.",
    );
  } else {
    rationale.push(
      `Overall plan quality is ${overallPlanQuality} based on historical downstream follow-through for similar runs.`,
    );
  }

  return {
    extractionRelevance,
    adaptationFollowThrough,
    improvementGoalProgress,
    proofGateCompletion,
    overallPlanQuality,
    rationale,
  };
}
