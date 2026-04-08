import type {
  DirectiveEngineCapabilityGap,
  DirectiveEngineCapabilityGapPriority,
  DirectiveEngineMissionContext,
  DirectiveEngineRoutingAssessment,
  DirectiveEngineRoutingConfidence,
  DirectiveEngineSourceItem,
} from "./types.ts";

const DISCOVERY_KEYWORDS = [
  "discovery",
  "front door",
  "intake",
  "queue",
  "routing",
  "route",
  "monitor",
  "review cadence",
  "coverage",
  "gap",
];

const ARCHITECTURE_KEYWORDS = [
  "architecture",
  "contract",
  "schema",
  "policy",
  "workflow",
  "doctrine",
  "evaluation",
  "evaluator",
  "adaptation",
  "analysis",
  "operating logic",
  "operating code",
  "structure",
  "engine",
  "self-improvement",
];

const RUNTIME_KEYWORDS = [
  "runtime",
  "runtime",
  "callable",
  "skill",
  "automation",
  "workflow",
  "latency",
  "performance",
  "cost",
  "reliability",
  "import",
  "source-pack",
  "runtime capability",
];

const TRANSFORMATION_KEYWORDS = [
  "transform",
  "transformation",
  "behavior-preserving",
  "faster",
  "slower",
  "latency",
  "cost",
  "reliability",
  "same behavior",
  "same capability",
  "better implementation",
  "maintainability",
];

const META_USEFULNESS_KEYWORDS = [
  "engine",
  "routing",
  "adaptation",
  "self-improvement",
  "evaluation",
  "proof",
  "schema",
  "contract",
  "policy",
];

const PATTERN_EXTRACTION_KEYWORDS = [
  "without adopting",
  "rather than direct runtime reuse",
  "not the library as a dependency",
  "not the library as dependency",
];

const RUNTIME_SOURCE_TYPES = new Set([
  "github-repo",
  "external-system",
]);

const STRUCTURAL_SOURCE_TYPES = new Set([
  "paper",
  "product-doc",
  "technical-essay",
  "workflow-writeup",
  "theory",
]);

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "into",
  "through",
  "when",
  "only",
  "have",
  "will",
  "would",
  "should",
  "about",
  "candidate",
  "current",
  "active",
  "mission",
  "source",
]);

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

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

function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function countKeywordHits(text: string, keywords: string[]) {
  const lowered = text.toLowerCase();
  return keywords.reduce(
    (count, keyword) => count + (lowered.includes(keyword.toLowerCase()) ? 1 : 0),
    0,
  );
}

function countTokenOverlap(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap;
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
    };
  }

  return {
    gap: bestGap,
    rank: bestRank,
    structuredSignalScore: bestStructuredSignalScore,
  };
}

function deriveMissionFit(
  sourceText: string,
  mission: DirectiveEngineMissionContext,
) {
  const objectiveOverlap = countTokenOverlap(sourceText, mission.currentObjective);
  const usefulnessOverlap = mission.usefulnessSignals.reduce(
    (score, signal) => score + countTokenOverlap(sourceText, signal),
    0,
  );
  const laneOverlap = mission.capabilityLanes.reduce(
    (score, lane) => score + countTokenOverlap(sourceText, lane),
    0,
  );
  return clampInt(objectiveOverlap + usefulnessOverlap + laneOverlap, 0, 5);
}

function deriveLaneScores(input: {
  source: DirectiveEngineSourceItem;
  sourceText: string;
  matchedGap: DirectiveEngineCapabilityGap | null;
}) {
  const discoverySignal = countKeywordHits(input.sourceText, DISCOVERY_KEYWORDS);
  const architectureSignal = countKeywordHits(input.sourceText, ARCHITECTURE_KEYWORDS);
  const baseRuntimeSignal = countKeywordHits(input.sourceText, RUNTIME_KEYWORDS);
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
      discoverySignal * 3 +
        (input.source.sourceType === "internal-signal" ? 2 : 0) -
        discoveryBoundaryPenalty,
    ),
    architecture:
      structuralSignal * 3 +
      (runtimeOverreadCorrectionEligible ? patternExtractionSignal * 4 : 0) +
      architectureBoundaryBonus,
    runtime:
      runtimeSignal * 3 +
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

function deriveRecommendedLane(
  laneScores: Record<"discovery" | "architecture" | "runtime", number>,
) {
  return (Object.entries(laneScores).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0]?.[0] ?? "discovery") as "discovery" | "architecture" | "runtime";
}

function rankLaneScores(
  laneScores: Record<"discovery" | "architecture" | "runtime", number>,
) {
  return Object.entries(laneScores)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    }) as Array<["discovery" | "architecture" | "runtime", number]>;
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
  if (!routeConflict && ambiguityPenalty === 0 && topLaneScore >= 10) {
    return "high";
  }
  if (ambiguityPenalty <= 1 && topLaneScore >= 6) {
    return "medium";
  }
  return "low";
}

function deriveSignalWinner(
  laneScores: Record<"discovery" | "architecture" | "runtime", number>,
) {
  const ranked = rankLaneScores(laneScores);
  if ((ranked[0]?.[1] ?? 0) <= 0) {
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

function deriveReviewGuidance(input: {
  recommendedLaneId: "discovery" | "architecture" | "runtime";
  confidence: DirectiveEngineRoutingConfidence;
  matchedGap: DirectiveEngineCapabilityGap | null;
  routeConflict: boolean;
  needsHumanReview: boolean;
  recommendedRecordShape: string;
}) {
  if (input.routeConflict && input.recommendedLaneId === "architecture") {
    return {
      guidanceKind: "conflicted_architecture_review" as const,
      summary: "Conflicted Architecture route requires explicit structural review before downstream adoption.",
      operatorAction:
        "Review the competing Runtime-vs-Architecture signals, confirm Architecture ownership explicitly, and keep the fuller split-case record until the conflict is resolved.",
      requiredChecks: [
        "Confirm why Architecture still owns the candidate despite the competing Runtime signal.",
        "Record why the alternative lane was rejected before any downstream adoption step.",
        "Keep the split-case structural record explicit during review.",
      ],
      stopLine:
        "Do not treat this as a fast-path Architecture adoption or open downstream Runtime follow-through until the conflict is explicitly resolved.",
    };
  }

  if (input.routeConflict && input.recommendedLaneId === "runtime") {
    return {
      guidanceKind: "conflicted_runtime_review" as const,
      summary: "Conflicted Runtime route requires explicit review before any bounded Runtime follow-up opens.",
      operatorAction:
        "Review the competing signals, confirm Runtime ownership explicitly, and keep the case queue-only until that review is recorded.",
      requiredChecks: [
        "Confirm why Runtime still owns the candidate despite the competing lane signal.",
        "Record why the alternative lane was rejected before opening follow-up.",
        "Keep the case queue-only until review completes.",
      ],
      stopLine:
        "Do not open fast-path Runtime follow-through while the route conflict remains unresolved.",
    };
  }

  if (input.needsHumanReview && input.recommendedLaneId === "discovery" && input.confidence === "low") {
    return {
      guidanceKind: "low_confidence_discovery_hold" as const,
      summary: "Low-confidence route stays in Discovery until routing clarity improves.",
      operatorAction:
        "Keep the candidate in Discovery, gather clearer routing evidence, and avoid assigning Architecture or Runtime ownership early.",
      requiredChecks: [
        "Record what evidence is still missing for lane ownership.",
        "Prefer new routing evidence or open-gap alignment before rerouting.",
      ],
      stopLine:
        "Do not assign downstream lane ownership while confidence remains low and no stronger routing signal exists.",
    };
  }

  if (input.needsHumanReview) {
    return {
      guidanceKind: "bounded_lane_review" as const,
      summary: "Bounded lane review remains required before downstream adoption.",
      operatorAction:
        "Keep the bounded lane recommendation visible, review the remaining uncertainty explicitly, and only proceed after that review is recorded.",
      requiredChecks: [
        "Confirm the lane still matches the best bounded interpretation.",
        "Record the remaining uncertainty before downstream advancement.",
      ],
      stopLine:
        "Do not widen downstream work while this bounded review requirement remains open.",
    };
  }

  return null;
}

export function assessDirectiveEngineRouting(input: {
  source: DirectiveEngineSourceItem;
  mission: DirectiveEngineMissionContext;
  openGaps: DirectiveEngineCapabilityGap[];
}): DirectiveEngineRoutingAssessment {
  const sourceText = flattenSourceText(input.source);
  const {
    gap: matchedGap,
    rank: matchedGapRank,
    structuredSignalScore: matchedGapStructuredSignalScore,
  } = findMatchedGap({
    source: input.source,
    openGaps: input.openGaps,
    sourceText,
  });
  const missionFit = deriveMissionFit(sourceText, input.mission);
  const gapAlignment = matchedGap ? priorityWeight(matchedGap.priority) + 1 : 0;
  const {
    laneScores,
    keywordLaneScores,
    metadataLaneScores,
    gapLaneScores,
    metaUsefulnessSignal,
    patternExtractionSignal,
    transformationSignal,
    runtimeSignal,
    discoveryArchitectureCorrectionEligible,
    discoveryBoundaryPenalty,
    architectureBoundaryBonus,
  } = deriveLaneScores({
    source: input.source,
    sourceText,
    matchedGap,
  });
  const scoreWinnerLaneId = deriveRecommendedLane(laneScores);
  const ambiguityPenalty = deriveAmbiguityPenalty(laneScores);
  const rankedLaneScores = rankLaneScores(laneScores);
  const topLaneScore = laneScores[scoreWinnerLaneId];
  const runnerUpLaneId = rankedLaneScores[1]?.[0] ?? null;
  const scoreDelta = topLaneScore - (runnerUpLaneId ? laneScores[runnerUpLaneId] : 0);
  const keywordWinner = deriveSignalWinner(keywordLaneScores);
  const metadataWinner = deriveSignalWinner(metadataLaneScores);
  const gapWinner = deriveSignalWinner(gapLaneScores);
  const conflictingSignalFamilies = [
    keywordWinner !== null && keywordWinner !== scoreWinnerLaneId ? "keyword" : null,
    metadataWinner !== null && metadataWinner !== scoreWinnerLaneId ? "metadata" : null,
    gapWinner !== null && gapWinner !== scoreWinnerLaneId ? "gap" : null,
  ].filter((value): value is "keyword" | "metadata" | "gap" => value !== null);
  const conflictingLaneIds = Array.from(
    new Set(
      [keywordWinner, metadataWinner, gapWinner]
        .filter((value): value is "discovery" | "architecture" | "runtime" => value !== null)
        .filter((value) => value !== scoreWinnerLaneId),
    ),
  );
  const total =
    missionFit * 4 +
    gapAlignment * 5 +
    topLaneScore +
    transformationSignal -
    ambiguityPenalty * 4;
  const missionPriorityScore = clampInt(total, 0, 100);
  const routeConflict = conflictingSignalFamilies.length > 0;
  const confidence = deriveConfidence(topLaneScore, ambiguityPenalty, routeConflict);
  const recommendedLaneId = shouldFallbackLowConfidenceRouteToDiscovery({
    confidence,
    matchedGap,
    source: input.source,
  })
    ? "discovery"
    : scoreWinnerLaneId;
  const recommendedRecordShape = deriveRecommendedRecordShape({
    recommendedLaneId,
    confidence,
    matchedGap,
    routeConflict,
    source: input.source,
    metaUsefulnessSignal,
    patternExtractionSignal,
    transformationSignal,
    runtimeSignal,
    discoveryArchitectureCorrectionEligible,
  });
  const noGapHighConfidenceBoundedRoute =
    matchedGap === null &&
    confidence === "high" &&
    !routeConflict &&
    (
      recommendedRecordShape === "fast_path" ||
      recommendedRecordShape === "split_case"
    );
  const needsHumanReview =
    routeConflict ||
    confidence === "low" ||
    (matchedGap === null && !noGapHighConfidenceBoundedRoute && recommendedRecordShape === "fast_path") ||
    recommendedRecordShape === "queue_only";
  const reviewGuidance = deriveReviewGuidance({
    recommendedLaneId,
    confidence,
    matchedGap,
    routeConflict,
    needsHumanReview,
    recommendedRecordShape,
  });

  const rationale: string[] = [];
  const keywordSignals: string[] = [];
  const metadataSignals: string[] = [];
  const gapAlignmentSignals: string[] = [];
  const ambiguitySignals: string[] = [];
  if (matchedGap && matchedGapRank !== null) {
    const line =
      `Matched open gap ${matchedGap.gapId} (rank ${matchedGapRank}) as the closest current mission pressure.`;
    rationale.push(line);
    gapAlignmentSignals.push(line);
    if (matchedGapStructuredSignalScore > 0) {
      const structuredLine =
        `Structured source signals added ${matchedGapStructuredSignalScore} points of gap alignment for ${matchedGap.gapId}, so matching did not rely only on token overlap.`;
      rationale.push(structuredLine);
      gapAlignmentSignals.push(structuredLine);
    }
  } else {
    const line =
      "No unresolved gap matched strongly enough, so the assessment relied on mission-fit and lane-signal scoring.";
    rationale.push(line);
    gapAlignmentSignals.push(line);
  }
  rationale.push(
    `Recommended ${scoreWinnerLaneId} because its lane score (${laneScores[scoreWinnerLaneId]}) exceeded the alternatives.`,
  );
  if (input.source.primaryAdoptionTarget) {
    const line =
      `Primary adoption target metadata is set to ${input.source.primaryAdoptionTarget}, which contributes directly to lane scoring instead of relying only on keyword overlap.`;
    rationale.push(line);
    metadataSignals.push(line);
  }
  if (input.source.containsExecutableCode) {
    const line =
      "Structured source metadata says executable code is present, which strengthens repeated-runtime usefulness scoring.";
    rationale.push(line);
    metadataSignals.push(line);
  }
  if (input.source.containsWorkflowPattern) {
    const line =
      "Structured source metadata says a workflow pattern is present, which strengthens architecture/runtime workflow interpretation beyond title keywords alone.";
    rationale.push(line);
    metadataSignals.push(line);
  }
  if (input.source.improvesDirectiveWorkspace) {
    const line =
      "Structured source metadata says the source primarily improves Directive Workspace itself, which strengthens Architecture scoring even when the source also contains executable code.";
    rationale.push(line);
    metadataSignals.push(line);
  }
  if (input.source.workflowBoundaryShape) {
    const line =
      `Structured workflow-boundary metadata is set to ${input.source.workflowBoundaryShape}, which strengthens Architecture interpretation of explicit reusable workflow boundaries instead of relying only on title/summary tokens.`;
    rationale.push(line);
    metadataSignals.push(line);
  }
  if (transformationSignal > 0) {
    const line =
      `Transformation signal is present (${transformationSignal}/5), which strengthens Runtime-style behavior-preserving work.`;
    rationale.push(line);
    keywordSignals.push(line);
  }
  if (metaUsefulnessSignal > 0) {
    const line =
      `Meta-usefulness signal is present (${metaUsefulnessSignal}/5), which strengthens Engine-improvement handling inside Architecture or Discovery.`;
    rationale.push(line);
    keywordSignals.push(line);
  }
  if (patternExtractionSignal > 0) {
    const line =
      `Pattern-extraction signal is present (${patternExtractionSignal}/5), which favors Architecture when the source text says to retain the pattern without adopting the source itself as runtime capability.`;
    rationale.push(line);
    keywordSignals.push(line);
  }
  if (discoveryArchitectureCorrectionEligible) {
    const line =
      `Structural-source correction is present: Discovery overread from intake/routing vocabulary was reduced by ${discoveryBoundaryPenalty} points while Architecture gained ${architectureBoundaryBonus} points because this source looks like Engine workflow logic, not front-door queue work.`;
    rationale.push(line);
    keywordSignals.push(line);
  }
  keywordSignals.push(
    `Keyword-derived lane scores: discovery=${keywordLaneScores.discovery}, architecture=${keywordLaneScores.architecture}, runtime=${keywordLaneScores.runtime}.`,
  );
  metadataSignals.push(
    `Metadata-derived lane scores: discovery=${metadataLaneScores.discovery}, architecture=${metadataLaneScores.architecture}, runtime=${metadataLaneScores.runtime}.`,
  );
  gapAlignmentSignals.push(
    `Gap-derived lane scores: discovery=${gapLaneScores.discovery}, architecture=${gapLaneScores.architecture}, runtime=${gapLaneScores.runtime}.`,
  );
  ambiguitySignals.push(
    `Top lane ${scoreWinnerLaneId} beat ${runnerUpLaneId ?? "none"} by ${scoreDelta} points after ambiguity penalties.`,
  );
  if (routeConflict) {
    const conflictLine =
      `Signal disagreement requires review: ${conflictingSignalFamilies.join(", ")} evidence pointed to ${conflictingLaneIds.join(", ")} instead of ${scoreWinnerLaneId}.`;
    rationale.push(conflictLine);
    ambiguitySignals.push(conflictLine);
  } else {
    ambiguitySignals.push(
      `No material signal-family disagreement remained after scoring; keyword, metadata, and gap alignment all supported ${scoreWinnerLaneId} or had no competing winner.`,
    );
  }
  rationale.push(
    `Route explanation breakdown for ${recommendedLaneId}: keyword=${keywordLaneScores[recommendedLaneId]}, metadata=${metadataLaneScores[recommendedLaneId]}, gap=${gapLaneScores[recommendedLaneId]}.`,
  );
  if (recommendedLaneId === "discovery" && scoreWinnerLaneId !== "discovery" && confidence === "low") {
    const fallbackLine =
      `Routing confidence remained low without an open gap, so the candidate stays in Discovery instead of assigning early ${scoreWinnerLaneId} ownership.`;
    rationale.push(fallbackLine);
    ambiguitySignals.push(fallbackLine);
  }
  if (recommendedRecordShape === "fast_path") {
    if (
      recommendedLaneId === "runtime" &&
      matchedGap === null &&
      confidence === "high" &&
      !routeConflict
    ) {
      rationale.push(
        "Fast-path is recommended because strong Runtime signals justify bounded follow-through even without an open gap match.",
      );
    } else {
      rationale.push(
        "Fast-path is recommended because the route appears bounded enough to avoid a full split-case path.",
      );
    }
  } else if (recommendedRecordShape === "split_case") {
    if (routeConflict) {
      rationale.push(
        "Split-case is recommended because a conflicted Architecture route needs the fuller structural record before downstream review.",
      );
    } else if (
      recommendedLaneId === "architecture" &&
      matchedGap === null &&
      confidence === "high" &&
      !routeConflict
    ) {
      rationale.push(
        "Split-case is recommended because strong Architecture signals justify a fuller structural record even without an open gap match.",
      );
    } else {
      rationale.push(
        "Split-case is recommended because the candidate looks structural or ambiguous enough to benefit from fuller Discovery records.",
      );
    }
  } else {
    if (routeConflict && recommendedLaneId === "runtime") {
      rationale.push(
        "Queue-only is recommended because a conflicted Runtime route should not open fast-path follow-through before explicit review.",
      );
    } else {
      rationale.push(
        "Queue-only is recommended because the candidate still needs more routing clarity before record expansion.",
      );
    }
  }

  return {
    recommendedLaneId,
    recommendedRecordShape,
    missionPriorityScore,
    confidence,
    matchedGapId: matchedGap?.gapId ?? null,
    matchedGapRank,
    explicitRouteDestination: null,
    routeConflict,
    needsHumanReview,
    ambiguitySummary: {
      topLaneId: scoreWinnerLaneId,
      runnerUpLaneId,
      scoreDelta,
      conflictingSignalFamilies,
      conflictingLaneIds,
    },
    reviewGuidance,
    scoreBreakdown: {
      missionFit,
      gapAlignment,
      laneScores,
      keywordLaneScores,
      metadataLaneScores,
      gapLaneScores,
      metaUsefulnessSignal,
      patternExtractionSignal,
      transformationSignal,
      runtimeSignal,
      ambiguityPenalty,
      total: missionPriorityScore,
    },
    explanationBreakdown: {
      keywordSignals,
      metadataSignals,
      gapAlignmentSignals,
      ambiguitySignals,
    },
    rationale,
  };
}
