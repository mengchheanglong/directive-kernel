import { extractSourceSignalTokens } from "../routing/correction-ledger.ts";
import { deriveEngineRouteClass } from "../routing/earned-autonomy.ts";
import {
  flattenSourceText,
  countTokenOverlap,
  isSuccessfulRun,
  isStalledRun,
} from "../source-utils.ts";
import type {
  EngineLaneId,
  EngineRunRecord,
  EngineSourceItem,
} from "../types.ts";

export type PriorPlanContext = {
  routeClass: string;
  summary: string;
  matchingRunCount: number;
  successfulFollowThroughCount: number;
  stalledRunCount: number;
  recurringImprovementGoals: string[];
  recurringProofKinds: Array<{
    proofKind: string;
    count: number;
    status: "successful" | "stalled" | "mixed";
  }>;
  adaptationPatterns: Array<{
    directiveOwnedForm: string;
    count: number;
    successfulCount: number;
    stalledCount: number;
  }>;
  relatedRunIds: string[];
} | null;

function countBy<T extends string>(values: T[]) {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function derivePriorPlanContext(input: {
  source: EngineSourceItem;
  recommendedLaneId: EngineLaneId;
  existingRuns: EngineRunRecord[];
  /** Pre-computed source signal tokens keyed by runId, avoids redundant tokenization. */
  precomputedSourceTokens?: Map<string, string[]> | null;
}) {
  const sourceTokens = extractSourceSignalTokens(flattenSourceText(input.source));
  const routeClass = deriveEngineRouteClass({
    recommendedLaneId: input.recommendedLaneId,
    source: input.source,
  });
  const matchingRuns = input.existingRuns
    .filter((run) =>
      run.selectedLane.laneId === input.recommendedLaneId
      || deriveEngineRouteClass({
        recommendedLaneId: run.selectedLane.laneId,
        source: run.source,
      }) === routeClass
    )
    .filter((run) =>
      countTokenOverlap(
        sourceTokens,
        input.precomputedSourceTokens?.get(run.runId)
          ?? extractSourceSignalTokens(flattenSourceText(run.source)),
      ) >= 2
    )
    .slice(-8);

  if (matchingRuns.length === 0) {
    return null;
  }

  const successfulFollowThroughCount = matchingRuns.filter(isSuccessfulRun).length;
  const stalledRunCount = matchingRuns.filter(isStalledRun).length;
  const recurringImprovementGoals = [...countBy(
    matchingRuns.flatMap((run) => run.improvementPlan.improvementGoals),
  ).entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([goal]) => goal)
    .slice(0, 4);

  const recurringProofKinds = [...countBy(
    matchingRuns.map((run) => run.proofPlan.proofKind),
  ).entries()]
    .map(([proofKind, count]) => {
      const proofRuns = matchingRuns.filter((run) => run.proofPlan.proofKind === proofKind);
      const successfulCount = proofRuns.filter(isSuccessfulRun).length;
      const stalledCount = proofRuns.filter(isStalledRun).length;
      return {
        proofKind,
        count,
        status:
          successfulCount > 0 && stalledCount === 0
            ? "successful"
            : stalledCount > 0 && successfulCount === 0
              ? "stalled"
              : "mixed",
      } as const;
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 3);

  const adaptationPatterns = [...countBy(
    matchingRuns.map((run) => run.adaptationPlan.directiveOwnedForm),
  ).entries()]
    .map(([directiveOwnedForm, count]) => {
      const adaptationRuns = matchingRuns.filter((run) =>
        run.adaptationPlan.directiveOwnedForm === directiveOwnedForm
      );
      return {
        directiveOwnedForm,
        count,
        successfulCount: adaptationRuns.filter(isSuccessfulRun).length,
        stalledCount: adaptationRuns.filter(isStalledRun).length,
      };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 3);

  return {
    routeClass,
    summary:
      `Prior plan context found ${matchingRuns.length} similar ${input.recommendedLaneId} runs with ${successfulFollowThroughCount} successful bounded follow-through decisions and ${stalledRunCount} stalled/pending ones.`,
    matchingRunCount: matchingRuns.length,
    successfulFollowThroughCount,
    stalledRunCount,
    recurringImprovementGoals,
    recurringProofKinds,
    adaptationPatterns,
    relatedRunIds: matchingRuns.map((run) => run.runId).slice(-5),
  } satisfies PriorPlanContext;
}
