import type {
  EngineMissionContext,
  EngineRunRecord,
} from "../types.ts";
import { clampInt, uniqueStrings } from "../source-utils.ts";
import { extractSourceSignalTokens } from "../routing/correction-ledger.ts";

export type MissionHealthAssessment = {
  overallScore: number;
  healthGrade: "A" | "B" | "C" | "D" | "F";
  objectiveSpecificityScore: number;
  usefulnessSignalQualityScore: number;
  constraintQualityScore: number;
  lanePriorityClarityScore: number;
  overmatchRiskScore: number;
  stalenessRiskScore: number;
  warnings: string[];
  tensionSignals: string[];
  rationale: string[];
  suggestedObjectiveRewrite: string | null;
  suggestedConstraintAdditions: string[];
} | null;

const GENERIC_TOKENS = new Set([
  "active",
  "better",
  "bounded",
  "capability",
  "current",
  "directive",
  "goal",
  "improve",
  "kernel",
  "mission",
  "product",
  "project",
  "quality",
  "result",
  "routing",
  "signal",
  "system",
  "useful",
  "workspace",
]);

function specificTokenCount(value: string) {
  return extractSourceSignalTokens(value)
    .filter((token) => !GENERIC_TOKENS.has(token))
    .length;
}

function grade(score: number) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function buildSuggestedObjectiveRewrite(mission: EngineMissionContext) {
  const useful = uniqueStrings(mission.usefulnessSignals).slice(0, 2);
  const lanes = uniqueStrings(mission.capabilityLanes).slice(0, 2);
  const parts = [
    "Improve",
    useful[0] ?? "routing clarity",
    useful[1] ? `by preserving ${useful[1].toLowerCase()}` : "",
    lanes[0] ? `for ${lanes[0]} ownership` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return parts.length > 10 ? parts : null;
}

function deriveLaneTensionSignals(input: {
  mission: EngineMissionContext;
  recentRuns: EngineRunRecord[];
}) {
  const counts = new Map<string, number>();
  for (const run of input.recentRuns) {
    const laneId = run.selectedLane.laneId;
    counts.set(laneId, (counts.get(laneId) ?? 0) + 1);
  }
  const dominant = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  const signals: string[] = [];
  if (
    dominant
    && input.mission.adoptionTarget
    && dominant !== input.mission.adoptionTarget
    && input.recentRuns.length >= 4
  ) {
    signals.push(
      `Recent source pressure is dominated by ${dominant}, but the mission adoption target is ${input.mission.adoptionTarget}.`,
    );
  }
  if (
    input.mission.capabilityLanes.length > 0
    && dominant
    && !input.mission.capabilityLanes.some((lane) => lane.toLowerCase() === dominant)
  ) {
    signals.push(
      `Recent source pressure is landing in ${dominant}, which is not prioritized in the mission lane list.`,
    );
  }
  return signals;
}

export function deriveDirectiveMissionHealth(input: {
  mission: EngineMissionContext;
  existingRuns?: EngineRunRecord[];
}) {
  const recentRuns = [...(input.existingRuns ?? [])]
    .filter((run) => run.mission.missionId === input.mission.missionId || !input.mission.missionId)
    .slice(-12);
  const objectiveSpecificityScore = clampInt(specificTokenCount(input.mission.currentObjective), 0, 5);
  const usefulnessSignalQualityScore = clampInt(
    uniqueStrings(input.mission.usefulnessSignals).reduce((score, signal) =>
      score + (specificTokenCount(signal) >= 2 ? 2 : specificTokenCount(signal) >= 1 ? 1 : 0), 0),
    0,
    5,
  );
  const constraintQualityScore = clampInt(
    uniqueStrings(input.mission.constraints).reduce((score, constraint) =>
      score
      + (/\b(keep|stay|avoid|require|limit|preserve|review|rollback|revers)\b/i.test(constraint) ? 2 : 0)
      + (specificTokenCount(constraint) >= 1 ? 1 : 0), 0),
    0,
    5,
  );
  const normalizedLanes = uniqueStrings(input.mission.capabilityLanes.map((lane) => lane.toLowerCase()))
    .filter((lane) => lane === "discovery" || lane === "architecture" || lane === "runtime");
  const lanePriorityClarityScore = clampInt(
    (normalizedLanes.length > 0 ? 2 : 0)
    + (normalizedLanes.length === 1 ? 2 : normalizedLanes.length === 2 ? 1 : 0)
    + (input.mission.adoptionTarget ? 1 : 0),
    0,
    5,
  );
  const overmatchRiskScore = clampInt(
    5
    - Math.min(
      5,
      objectiveSpecificityScore
      + Math.min(2, usefulnessSignalQualityScore),
    ),
    0,
    5,
  );
  const stalenessRiskScore = clampInt(
    (
      recentRuns.length >= 4
      && recentRuns.filter((run) =>
        Boolean(run.routingAssessment.missionSpecificityWarning)
        || Boolean(run.routingAssessment.confidenceRecovery)
      ).length >= Math.ceil(recentRuns.length / 2)
    )
      ? 4
      : recentRuns.length >= 4
        ? 2
        : 1,
    0,
    5,
  );

  const warnings: string[] = [];
  if (objectiveSpecificityScore <= 1) {
    warnings.push("Mission objective is too generic to distinguish strong matches from generic relevance.");
  }
  if (usefulnessSignalQualityScore <= 2) {
    warnings.push("Usefulness signals are weak or sparse, so mission-fit remains under-specified.");
  }
  if (constraintQualityScore <= 2) {
    warnings.push("Constraints are too weak to keep future work bounded and reviewable.");
  }
  if (lanePriorityClarityScore <= 2) {
    warnings.push("Lane ownership is too ambiguous for a mission that expects confident routing.");
  }
  if (overmatchRiskScore >= 4) {
    warnings.push("This mission is likely to over-match unrelated sources.");
  }

  const tensionSignals = deriveLaneTensionSignals({
    mission: input.mission,
    recentRuns,
  });
  const overallScore = clampInt(
    (
      objectiveSpecificityScore
      + usefulnessSignalQualityScore
      + constraintQualityScore
      + lanePriorityClarityScore
    ) * 5
    - overmatchRiskScore * 6
    - stalenessRiskScore * 4,
    0,
    100,
  );

  return {
    overallScore,
    healthGrade: grade(overallScore),
    objectiveSpecificityScore,
    usefulnessSignalQualityScore,
    constraintQualityScore,
    lanePriorityClarityScore,
    overmatchRiskScore,
    stalenessRiskScore,
    warnings,
    tensionSignals,
    rationale: [
      `Mission Health scored specificity ${objectiveSpecificityScore}/5, usefulness ${usefulnessSignalQualityScore}/5, constraints ${constraintQualityScore}/5, and lane clarity ${lanePriorityClarityScore}/5.`,
      `Over-match risk is ${overmatchRiskScore}/5 and staleness risk is ${stalenessRiskScore}/5.`,
      ...(tensionSignals.length > 0 ? tensionSignals : ["No strong lane-pressure tension is visible from recent runs."]),
    ],
    suggestedObjectiveRewrite:
      overallScore >= 85
        ? null
        : buildSuggestedObjectiveRewrite(input.mission),
    suggestedConstraintAdditions: [
      ...(!input.mission.constraints.some((entry) => /\breview\b/i.test(entry))
        ? ["Keep review explicit until the route is high-confidence and bounded."]
        : []),
      ...(!input.mission.constraints.some((entry) => /\brollback|revers/i.test(entry))
        ? ["Stay reversible and keep the rollback boundary explicit."]
        : []),
      ...(!input.mission.constraints.some((entry) => /\bbound|scope|single\b/i.test(entry))
        ? ["Keep the next change to one bounded slice."]
        : []),
    ].slice(0, 3),
  } satisfies MissionHealthAssessment;
}
