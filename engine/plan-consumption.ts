import { extractSourceSignalTokens } from "./routing-correction-ledger.ts";
import { deriveDirectiveEngineRouteClass } from "./earned-autonomy.ts";
import type {
  DirectiveEngineLaneId,
  DirectiveEngineRunRecord,
  DirectiveEngineSourceItem,
} from "./types.ts";

export type DirectivePriorPlanContext = {
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

function flattenSource(source: DirectiveEngineSourceItem) {
  return [
    source.title,
    source.summary ?? "",
    source.sourceRef,
    source.missionAlignmentHint ?? "",
    ...(source.notes ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function overlapCount(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.reduce((count, token) => count + (rightSet.has(token) ? 1 : 0), 0);
}

function countBy<T extends string>(values: T[]) {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function isSuccessful(run: DirectiveEngineRunRecord) {
  return run.decision.requiresHumanApproval === false
    && run.decision.decisionState !== "hold_in_discovery";
}

function isStalled(run: DirectiveEngineRunRecord) {
  return run.decision.requiresHumanApproval === true
    || run.decision.decisionState === "hold_in_discovery";
}

export function deriveDirectivePriorPlanContext(input: {
  source: DirectiveEngineSourceItem;
  recommendedLaneId: DirectiveEngineLaneId;
  existingRuns: DirectiveEngineRunRecord[];
}) {
  const sourceTokens = extractSourceSignalTokens(flattenSource(input.source));
  const routeClass = deriveDirectiveEngineRouteClass({
    recommendedLaneId: input.recommendedLaneId,
    source: input.source,
  });
  const matchingRuns = input.existingRuns
    .filter((run) =>
      run.selectedLane.laneId === input.recommendedLaneId
      || deriveDirectiveEngineRouteClass({
        recommendedLaneId: run.selectedLane.laneId,
        source: run.source,
      }) === routeClass
    )
    .filter((run) =>
      overlapCount(
        sourceTokens,
        extractSourceSignalTokens(flattenSource(run.source)),
      ) >= 2
    )
    .slice(-8);

  if (matchingRuns.length === 0) {
    return null;
  }

  const successfulFollowThroughCount = matchingRuns.filter(isSuccessful).length;
  const stalledRunCount = matchingRuns.filter(isStalled).length;
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
      const successfulCount = proofRuns.filter(isSuccessful).length;
      const stalledCount = proofRuns.filter(isStalled).length;
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
        successfulCount: adaptationRuns.filter(isSuccessful).length,
        stalledCount: adaptationRuns.filter(isStalled).length,
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
  } satisfies DirectivePriorPlanContext;
}
