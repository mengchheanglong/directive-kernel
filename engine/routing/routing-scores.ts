import type {
  DirectiveEngineCapabilityGap,
  DirectiveEngineCapabilityGapPriority,
  DirectiveEngineMissionContext,
  DirectiveEngineRoutingConfidence,
  DirectiveEngineSourceItem,
} from "../types.ts";
import {
  ARCHITECTURE_KEYWORDS,
  ARCHITECTURE_KEYWORDS_WEIGHTED,
  DISCOVERY_KEYWORDS,
  DISCOVERY_KEYWORDS_WEIGHTED,
  META_USEFULNESS_KEYWORDS,
  PATTERN_EXTRACTION_KEYWORDS,
  RUNTIME_KEYWORDS,
  RUNTIME_KEYWORDS_WEIGHTED,
  RUNTIME_SOURCE_TYPES,
  STRUCTURAL_SOURCE_TYPES,
  TRANSFORMATION_KEYWORDS,
  countKeywordHits,
  countTokenOverlap,
  countWeightedKeywordHits,
  deriveMissionObjectiveSpecificity,
} from "./routing-keywords.ts";
import {
  clampInt,
  deriveRecommendedLane,
  rankLaneScores,
} from "./routing-shared.ts";

function priorityWeight(priority: DirectiveEngineCapabilityGapPriority) {
  switch (priority) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function flattenSourceText(source: DirectiveEngineSourceItem) {
  return [
    source.title,
    source.sourceRef,
    source.missionAlignmentHint ?? "",
    source.summary ?? "",
    source.improvesDirectiveWorkspace ? "improves directive workspace itself engine self-improvement" : "",
    source.workflowBoundaryShape ? `workflow boundary shape ${source.workflowBoundaryShape}` : "",
    ...(source.notes ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function sortOpenGaps(openGaps: DirectiveEngineCapabilityGap[]) {
  return [...openGaps]
    .filter((gap) => !gap.resolvedAt)
    .sort((left, right) => {
      const priorityDelta = priorityWeight(right.priority) - priorityWeight(left.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const detectedDelta = left.detectedAt.localeCompare(right.detectedAt);
      if (detectedDelta !== 0) {
        return detectedDelta;
      }
      return left.gapId.localeCompare(right.gapId);
    });
}

function buildGapText(gap: DirectiveEngineCapabilityGap) {
  return [
    gap.gapId,
    gap.description,
    gap.relatedMissionObjective,
    gap.currentState,
    gap.desiredState,
    gap.resolutionNotes ?? "",
  ].join(" ");
}

function deriveStructuredGapAlignmentScore(input: {
  source: DirectiveEngineSourceItem;
  gap: DirectiveEngineCapabilityGap;
}) {
  const gapText = buildGapText(input.gap);
  const discoveryGapSignal = countKeywordHits(gapText, DISCOVERY_KEYWORDS);
  const architectureGapSignal =
    countKeywordHits(gapText, ARCHITECTURE_KEYWORDS)
    + countKeywordHits(gapText, META_USEFULNESS_KEYWORDS);
  const runtimeGapSignal =
    countKeywordHits(gapText, RUNTIME_KEYWORDS)
    + countKeywordHits(gapText, TRANSFORMATION_KEYWORDS);

  let score = 0;

  if (input.source.primaryAdoptionTarget === "discovery" && discoveryGapSignal > 0) {
    score += 5;
  }
  if (input.source.primaryAdoptionTarget === "architecture" && architectureGapSignal > 0) {
    score += 5;
  }
  if (input.source.primaryAdoptionTarget === "runtime" && runtimeGapSignal > 0) {
    score += 5;
  }
  if (input.source.improvesDirectiveWorkspace && architectureGapSignal > 0) {
    score += 6;
  }
  if (input.source.workflowBoundaryShape && architectureGapSignal > 0) {
    score += 4;
  }
  if (input.source.containsExecutableCode && runtimeGapSignal > 0) {
    score += 3;
  }
  if (input.source.containsWorkflowPattern && (architectureGapSignal > 0 || runtimeGapSignal > 0)) {
    score += 2;
  }

  return score;
}

function findMatchedGap(input: {
  source: DirectiveEngineSourceItem;
  openGaps: DirectiveEngineCapabilityGap[];
  sourceText: string;
}) {
  const rankedGaps = sortOpenGaps(input.openGaps);

  if (input.source.capabilityGapId) {
    const directIndex = rankedGaps.findIndex((gap) => gap.gapId === input.source.capabilityGapId);
    if (directIndex >= 0) {
      return {
        gap: rankedGaps[directIndex] ?? null,
        rank: directIndex + 1,
        structuredSignalScore: 0,
        directReference: true,
      };
    }
  }

  let bestGap: DirectiveEngineCapabilityGap | null = null;
  let bestRank: number | null = null;
  let bestScore = 0;
  let bestStructuredSignalScore = 0;

  rankedGaps.forEach((gap, index) => {
    const overlap = countTokenOverlap(input.sourceText, buildGapText(gap));
    const structuredSignalScore = deriveStructuredGapAlignmentScore({
      source: input.source,
      gap,
    });
    const score = overlap + structuredSignalScore;
    if (score > bestScore) {
      bestScore = score;
      bestGap = gap;
      bestRank = index + 1;
      bestStructuredSignalScore = structuredSignalScore;
    }
  });

  if (bestScore < 3) {
    return {
      gap: null,
      rank: null,
      structuredSignalScore: 0,
      directReference: false,
    };
  }

  return {
    gap: bestGap,
    rank: bestRank,
    structuredSignalScore: bestStructuredSignalScore,
    directReference: false,
  };
}

function deriveMissionFit(
  source: DirectiveEngineSourceItem,
  sourceText: string,
  mission: DirectiveEngineMissionContext,
) {
  const objectiveSpecificity = deriveMissionObjectiveSpecificity(mission.currentObjective);
  const objectiveOverlap = countTokenOverlap(sourceText, mission.currentObjective);
  const usefulnessOverlap = mission.usefulnessSignals.reduce(
    (score, signal) => score + countTokenOverlap(sourceText, signal),
    0,
  );
  const laneOverlap = mission.capabilityLanes.reduce(
    (score, lane) => score + countTokenOverlap(sourceText, lane),
    0,
  );
  const structuredMissionBoost =
    (source.primaryAdoptionTarget
      && mission.capabilityLanes.some((lane) =>
        countTokenOverlap(source.primaryAdoptionTarget ?? "", lane) > 0
      )
      ? 1
      : 0)
    + (
      source.improvesDirectiveWorkspace === true
      && mission.usefulnessSignals.some((signal) =>
        countTokenOverlap("engine routing evaluation adaptation workflow", signal) > 0
      )
        ? 1
        : 0
    );
  const weightedObjectiveOverlap =
    objectiveSpecificity === 0
      ? 0
      : objectiveSpecificity === 1
        ? Math.min(objectiveOverlap, 1)
        : objectiveSpecificity === 2
          ? Math.min(objectiveOverlap, 2)
          : objectiveOverlap;

  return clampInt(
    weightedObjectiveOverlap + usefulnessOverlap + laneOverlap + structuredMissionBoost,
    0,
    5,
  );
}

function deriveLaneScores(input: {
  source: DirectiveEngineSourceItem;
  sourceText: string;
  matchedGap: DirectiveEngineCapabilityGap | null;
}) {
  const discoverySignal = countWeightedKeywordHits(input.sourceText, DISCOVERY_KEYWORDS_WEIGHTED);
  const architectureSignal = countWeightedKeywordHits(input.sourceText, ARCHITECTURE_KEYWORDS_WEIGHTED);
  const baseRuntimeSignal = countWeightedKeywordHits(input.sourceText, RUNTIME_KEYWORDS_WEIGHTED);
  const metaUsefulnessSignal = countKeywordHits(input.sourceText, META_USEFULNESS_KEYWORDS);
  const patternExtractionSignal = countKeywordHits(
    input.sourceText,
    PATTERN_EXTRACTION_KEYWORDS,
  );
  const transformationSignal = countKeywordHits(input.sourceText, TRANSFORMATION_KEYWORDS);
  const runtimeSignal =
    baseRuntimeSignal +
    (RUNTIME_SOURCE_TYPES.has(input.source.sourceType) ? 2 : 0);
  const structuralSignal =
    architectureSignal +
    (STRUCTURAL_SOURCE_TYPES.has(input.source.sourceType) ? 1 : 0);
  const matchedGapText = input.matchedGap
    ? [
      input.matchedGap.gapId,
      input.matchedGap.description,
      input.matchedGap.relatedMissionObjective,
      input.matchedGap.currentState,
      input.matchedGap.desiredState,
    ].join(" ")
    : "";

  const matchedGapDiscoverySignal = countKeywordHits(matchedGapText, DISCOVERY_KEYWORDS);
  const matchedGapArchitectureSignal = countKeywordHits(matchedGapText, ARCHITECTURE_KEYWORDS);
  const matchedGapRuntimeSignal =
    countKeywordHits(matchedGapText, RUNTIME_KEYWORDS)
    + countKeywordHits(matchedGapText, TRANSFORMATION_KEYWORDS);
  const runtimeOverreadCorrectionEligible =
    RUNTIME_SOURCE_TYPES.has(input.source.sourceType) &&
    patternExtractionSignal > 0 &&
    metaUsefulnessSignal > 0 &&
    transformationSignal === 0;
  const discoveryArchitectureCorrectionEligible =
    STRUCTURAL_SOURCE_TYPES.has(input.source.sourceType) &&
    transformationSignal === 0 &&
    metaUsefulnessSignal > 0 &&
    (
      input.source.containsWorkflowPattern === true
      || input.source.improvesDirectiveWorkspace === true
      || patternExtractionSignal > 0
    );
  const discoveryBoundaryPenalty = discoveryArchitectureCorrectionEligible
    ? 2 + Math.min(metaUsefulnessSignal, 2)
    : 0;
  const architectureBoundaryBonus = discoveryArchitectureCorrectionEligible
    ? 2
      + Math.min(metaUsefulnessSignal, 2)
      + (input.source.containsWorkflowPattern ? 1 : 0)
      + (input.source.improvesDirectiveWorkspace ? 1 : 0)
    : 0;
  const metadataRuntimeSignal =
    (input.source.primaryAdoptionTarget === "runtime" ? 6 : 0)
    + (input.source.containsExecutableCode ? 3 : 0)
    + (input.source.containsExecutableCode && input.source.containsWorkflowPattern ? 1 : 0)
    + (
      input.source.workflowBoundaryShape !== null
      && input.source.workflowBoundaryShape !== undefined
      && !input.source.improvesDirectiveWorkspace
        ? 1
        : 0
    );
  const metadataArchitectureSignal =
    (input.source.primaryAdoptionTarget === "architecture" ? 6 : 0)
    + (input.source.containsWorkflowPattern && !input.source.containsExecutableCode ? 3 : 0)
    + (input.source.improvesDirectiveWorkspace ? 5 : 0)
    + (
      input.source.workflowBoundaryShape !== null
      && input.source.workflowBoundaryShape !== undefined
        ? 2
        : 0
    )
    + (
      input.source.improvesDirectiveWorkspace
      && input.source.containsExecutableCode
        ? 1
        : 0
    );
  const metadataDiscoverySignal =
    input.source.primaryAdoptionTarget === "discovery" ? 6 : 0;

  const keywordLaneScores = {
    discovery: Math.max(
      0,
      discoverySignal +
        (input.source.sourceType === "internal-signal" ? 2 : 0) -
        discoveryBoundaryPenalty,
    ),
    architecture:
      structuralSignal +
      (runtimeOverreadCorrectionEligible ? patternExtractionSignal * 4 : 0) +
      architectureBoundaryBonus,
    runtime:
      runtimeSignal +
      transformationSignal * 2 -
      (runtimeOverreadCorrectionEligible ? patternExtractionSignal * 3 : 0),
  };
  const metadataLaneScores = {
    discovery: metadataDiscoverySignal,
    architecture: metadataArchitectureSignal,
    runtime: metadataRuntimeSignal,
  };
  const gapLaneScores = {
    discovery: matchedGapDiscoverySignal * 2,
    architecture: matchedGapArchitectureSignal * 2,
    runtime: matchedGapRuntimeSignal * 2,
  };
  const laneScores = {
    discovery:
      keywordLaneScores.discovery +
      metadataLaneScores.discovery +
      gapLaneScores.discovery,
    architecture:
      keywordLaneScores.architecture +
      metadataLaneScores.architecture +
      gapLaneScores.architecture,
    runtime:
      keywordLaneScores.runtime +
      metadataLaneScores.runtime +
      gapLaneScores.runtime,
  };

  return {
    laneScores,
    keywordLaneScores,
    metadataLaneScores,
    gapLaneScores,
    metaUsefulnessSignal: clampInt(metaUsefulnessSignal, 0, 5),
    patternExtractionSignal: clampInt(patternExtractionSignal, 0, 5),
    transformationSignal: clampInt(transformationSignal, 0, 5),
    runtimeSignal: clampInt(runtimeSignal, 0, 5),
    discoveryArchitectureCorrectionEligible,
    discoveryBoundaryPenalty,
    architectureBoundaryBonus,
  };
}

function deriveLaneProportions(
  laneScores: Record<"discovery" | "architecture" | "runtime", number>,
) {
  const total = Object.values(laneScores).reduce((sum, score) => sum + Math.max(0, score), 0);
  if (total <= 0) {
    return {
      discovery: 34,
      architecture: 33,
      runtime: 33,
    };
  }
  const raw = {
    discovery: Math.round((Math.max(0, laneScores.discovery) / total) * 100),
    architecture: Math.round((Math.max(0, laneScores.architecture) / total) * 100),
    runtime: Math.round((Math.max(0, laneScores.runtime) / total) * 100),
  };
  const sum = raw.discovery + raw.architecture + raw.runtime;
  if (sum === 100) {
    return raw;
  }
  const winner = deriveRecommendedLane(laneScores);
  raw[winner] += 100 - sum;
  return raw;
}

function deriveAmbiguityPenalty(
  laneScores: Record<"discovery" | "architecture" | "runtime", number>,
) {
  const sortedScores = Object.values(laneScores).sort((left, right) => right - left);
  if (sortedScores.length < 2) {
    return 0;
  }
  const difference = sortedScores[0] - sortedScores[1];
  if (difference >= 4) return 0;
  if (difference >= 2) return 1;
  return 2;
}

function deriveConfidence(
  topLaneScore: number,
  ambiguityPenalty: number,
  routeConflict: boolean,
): DirectiveEngineRoutingConfidence {
  if (!routeConflict && ambiguityPenalty === 0 && topLaneScore >= 8) {
    return "high";
  }
  if (ambiguityPenalty <= 1 && topLaneScore >= 5) {
    return "medium";
  }
  return "low";
}

function deriveSignalWinner(
  laneScores: Record<"discovery" | "architecture" | "runtime", number>,
  minimumScore = 2,
) {
  const ranked = rankLaneScores(laneScores);
  if ((ranked[0]?.[1] ?? 0) < minimumScore) {
    return null;
  }
  return ranked[0]?.[0] ?? null;
}

function deriveRecommendedRecordShape(input: {
  recommendedLaneId: "discovery" | "architecture" | "runtime";
  confidence: DirectiveEngineRoutingConfidence;
  matchedGap: DirectiveEngineCapabilityGap | null;
  routeConflict: boolean;
  source: DirectiveEngineSourceItem;
  metaUsefulnessSignal: number;
  patternExtractionSignal: number;
  transformationSignal: number;
  runtimeSignal: number;
  discoveryArchitectureCorrectionEligible: boolean;
}) {
  if (input.confidence === "high" && input.matchedGap) {
    if (input.recommendedLaneId === "architecture") {
      return "split_case";
    }
    return "fast_path";
  }

  if (
    input.recommendedLaneId === "architecture" &&
    input.confidence === "high" &&
    !input.routeConflict &&
    (
      input.source.improvesDirectiveWorkspace === true ||
      input.source.containsWorkflowPattern === true ||
      input.source.workflowBoundaryShape !== null && input.source.workflowBoundaryShape !== undefined ||
      input.metaUsefulnessSignal > 0 ||
      input.patternExtractionSignal > 0 ||
      input.discoveryArchitectureCorrectionEligible
    )
  ) {
    return "split_case";
  }

  if (
    input.recommendedLaneId === "runtime" &&
    input.confidence === "high" &&
    !input.routeConflict &&
    (
      input.source.primaryAdoptionTarget === "runtime" ||
      input.source.containsExecutableCode === true ||
      input.transformationSignal > 0 ||
      input.runtimeSignal > 0
    )
  ) {
    return "fast_path";
  }

  if (input.routeConflict) {
    if (input.recommendedLaneId === "architecture") {
      return "split_case";
    }
    if (input.recommendedLaneId === "runtime") {
      return "queue_only";
    }
  }

  if (input.confidence === "medium" && input.recommendedLaneId !== "discovery") {
    return "fast_path";
  }

  return "queue_only";
}

function shouldFallbackLowConfidenceRouteToDiscovery(input: {
  confidence: DirectiveEngineRoutingConfidence;
  matchedGap: DirectiveEngineCapabilityGap | null;
  source: DirectiveEngineSourceItem;
}) {
  const hasExplicitOwnershipSignal =
    input.source.primaryAdoptionTarget != null
    || input.source.improvesDirectiveWorkspace === true
    || input.source.workflowBoundaryShape != null;
  return input.confidence === "low" && input.matchedGap === null && !hasExplicitOwnershipSignal;
}

export {
  deriveAmbiguityPenalty,
  deriveConfidence,
  deriveLaneProportions,
  deriveLaneScores,
  deriveMissionFit,
  deriveRecommendedRecordShape,
  deriveSignalWinner,
  findMatchedGap,
  flattenSourceText,
  priorityWeight,
  shouldFallbackLowConfidenceRouteToDiscovery,
};
