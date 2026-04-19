import type {
  DirectiveEngineCapabilityGap,
  DirectiveEngineMissionContext,
  DirectiveEngineRoutingAssessment,
  DirectiveEngineRunRecord,
  DirectiveEngineSourceItem,
} from "../types.ts";
import type { DecisionPolicyEvent } from "../decision-policy-ledger.ts";
import type { RoutingCorrectionEntry } from "./routing-correction-ledger.ts";
import { buildDirectiveRunSourceTokenMap } from "../engine-source-utils.ts";
import { deriveDirectiveMissionHealth } from "../mission/mission-health.ts";
import { deriveDirectiveEngineEarnedAutonomyAssessment } from "./earned-autonomy.ts";
import { deriveDirectiveFollowUpQuestionSet } from "./follow-up-questions.ts";
import {
  compileDirectiveGapRadarSuggestions,
  deriveDirectiveGapRadarAssessment,
} from "./gap-radar.ts";
import {
  deriveRoutingCorrectionAdjustments,
} from "./routing-correction-ledger.ts";
import { deriveRoutingDigest } from "./routing-digest.ts";
import {
  buildDirectiveSourceNarrativeThreads,
  deriveDirectiveSourceNarrativeContext,
} from "./source-narrative-threading.ts";
import {
  createDirectiveSourceMemorySnapshot,
  deriveDirectiveSourceMemoryAssessment,
} from "./source-memory.ts";
import { deriveDirectiveSourceSimilarityAssessment } from "./source-similarity.ts";
import {
  deriveGoalCopilotAssessment,
  deriveMissionObjectiveSpecificity,
} from "./routing-keywords.ts";
import {
  deriveConfidenceRecovery,
  deriveReviewGuidance,
} from "./routing-recovery.ts";
import {
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
} from "./routing-scores.ts";
import {
  deriveRecommendedLane,
  rankLaneScores,
} from "./routing-shared.ts";

export function assessDirectiveEngineRouting(input: {
  source: DirectiveEngineSourceItem;
  mission: DirectiveEngineMissionContext;
  openGaps: DirectiveEngineCapabilityGap[];
  corrections?: RoutingCorrectionEntry[];
  policyEvents?: DecisionPolicyEvent[];
  existingRuns?: DirectiveEngineRunRecord[];
  receivedAt?: string | null;
}): DirectiveEngineRoutingAssessment {
  const existingRuns = [...(input.existingRuns ?? [])];
  const policyEvents = [...(input.policyEvents ?? [])];
  const corrections = [...(input.corrections ?? [])];
  const sourceText = flattenSourceText(input.source);
  const {
    gap: matchedGap,
    rank: matchedGapRank,
    structuredSignalScore: matchedGapStructuredSignalScore,
    directReference: matchedGapDirectReference,
  } = findMatchedGap({
    source: input.source,
    openGaps: input.openGaps,
    sourceText,
  });
  const missionFit = deriveMissionFit(input.source, sourceText, input.mission);
  const missionSpecificity = deriveMissionObjectiveSpecificity(input.mission.currentObjective);
  const missionSpecificityWarning =
    missionSpecificity === 0
      ? "Mission objective contains only generic tokens (e.g. \"improve the system\"). All sources will match equally, making routing unreliable. Add specific terms describing what the mission actually targets."
      : missionSpecificity === 1
        ? "Mission objective has very low specificity (1 meaningful token). Routing may over-match. Consider adding 2-3 specific terms describing the capability or area being improved."
        : null;
  const goalCopilot = deriveGoalCopilotAssessment(input.mission);
  const missionHealth = deriveDirectiveMissionHealth({
    mission: input.mission,
    existingRuns,
  });
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
  const correctionAdjustments = corrections.length
    ? deriveRoutingCorrectionAdjustments({
      sourceText,
      corrections,
    })
    : {};
  for (const [laneId, adjustment] of Object.entries(correctionAdjustments)) {
    if (laneId in laneScores) {
      (laneScores as Record<string, number>)[laneId] = Math.max(
        0,
        (laneScores as Record<string, number>)[laneId] + adjustment,
      );
    }
  }
  const precomputedSourceTokens = buildDirectiveRunSourceTokenMap(existingRuns);
  const sourceMemorySnapshot = createDirectiveSourceMemorySnapshot({
    runs: existingRuns,
    precomputedSourceTokens,
  });
  const narrativeThreadBuild = buildDirectiveSourceNarrativeThreads({
    runs: existingRuns,
    mission: input.mission,
  });
  const provisionalLaneId = deriveRecommendedLane(laneScores);
  const sourceMemoryPreAssessment = deriveDirectiveSourceMemoryAssessment({
    snapshot: sourceMemorySnapshot,
    sourceText,
    recommendedLaneId: provisionalLaneId,
    source: input.source,
  });
  if (sourceMemoryPreAssessment) {
    for (const [laneId, adjustment] of Object.entries(sourceMemoryPreAssessment.biasAdjustments)) {
      if (adjustment > 0 && laneId in laneScores) {
        (laneScores as Record<string, number>)[laneId] += adjustment;
      }
    }
  }
  const narrativeContextPreAssessment = deriveDirectiveSourceNarrativeContext({
    source: input.source,
    sourceText,
    mission: input.mission,
    existingRuns,
    prebuiltThreads: narrativeThreadBuild,
    provisionalLaneId,
    currentMatchedGapId: matchedGap?.gapId ?? input.source.capabilityGapId ?? null,
    receivedAt: input.receivedAt,
  });
  if (narrativeContextPreAssessment) {
    for (const [laneId, adjustment] of Object.entries(narrativeContextPreAssessment.biasAdjustments)) {
      if (adjustment > 0 && laneId in laneScores) {
        (laneScores as Record<string, number>)[laneId] += adjustment;
      }
    }
  }
  const scoreWinnerLaneId = deriveRecommendedLane(laneScores);
  const ambiguityPenalty = deriveAmbiguityPenalty(laneScores);
  const rankedLaneScores = rankLaneScores(laneScores);
  const laneProportions = deriveLaneProportions(laneScores);
  const topLaneScore = laneScores[scoreWinnerLaneId];
  const runnerUpLaneId = rankedLaneScores[1]?.[0] ?? null;
  const scoreDelta = topLaneScore - (runnerUpLaneId ? laneScores[runnerUpLaneId] : 0);
  const keywordWinner = deriveSignalWinner(keywordLaneScores);
  const metadataWinner = deriveSignalWinner(metadataLaneScores);
  const gapWinner = matchedGapDirectReference
    ? null
    : deriveSignalWinner(gapLaneScores);
  const metadataStronglySupportsWinner =
    metadataLaneScores[scoreWinnerLaneId] >= 6
    && (metadataWinner === scoreWinnerLaneId || metadataWinner === null);
  const conflictingSignalFamilies = [
    keywordWinner !== null && keywordWinner !== scoreWinnerLaneId
      && !metadataStronglySupportsWinner
      ? "keyword"
      : null,
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
  const missionPriorityScore = Math.max(0, Math.min(100, Math.round(total)));
  const routeConflict = conflictingSignalFamilies.length > 0;
  const confidence = deriveConfidence(topLaneScore, ambiguityPenalty, routeConflict);
  const recommendedLaneId = shouldFallbackLowConfidenceRouteToDiscovery({
    confidence,
    matchedGap,
    source: input.source,
  })
    ? "discovery"
    : scoreWinnerLaneId;
  const sourceMemory = recommendedLaneId === provisionalLaneId
    ? sourceMemoryPreAssessment
    : deriveDirectiveSourceMemoryAssessment({
      snapshot: sourceMemorySnapshot,
      sourceText,
      recommendedLaneId,
      source: input.source,
    });
  const secondaryLanes = rankedLaneScores
    .filter(([laneId]) => laneId !== recommendedLaneId)
    .map(([laneId]) => ({
      laneId,
      proportion: laneProportions[laneId],
      reason:
        laneProportions[laneId] >= 25
          ? `${laneId} still claims ${laneProportions[laneId]}% of the route score, so this is a material secondary concern.`
          : `${laneId} remains visible but is not a material secondary owner.`,
    }))
    .filter((entry) => entry.proportion >= 25)
    .slice(0, 2);
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
  const baseNeedsHumanReview =
    routeConflict ||
    (confidence === "low" && recommendedLaneId !== "discovery") ||
    (matchedGap === null && !noGapHighConfidenceBoundedRoute && recommendedRecordShape === "fast_path") ||
    (recommendedRecordShape === "queue_only" && recommendedLaneId !== "discovery");
  const gapRadarSuggestions = compileDirectiveGapRadarSuggestions({
    events: policyEvents,
    openGaps: input.openGaps,
  });
  const gapRadar = deriveDirectiveGapRadarAssessment({
    sourceText,
    recommendedLaneId,
    matchedGapId: matchedGap?.gapId ?? null,
    suggestions: gapRadarSuggestions,
  });
  const earnedAutonomy = deriveDirectiveEngineEarnedAutonomyAssessment({
    source: input.source,
    recommendedLaneId,
    recommendedRecordShape,
    confidence,
    routeConflict,
    baseNeedsHumanReview,
    existingRuns,
    policyEvents,
    corrections,
  });
  const needsHumanReview =
    baseNeedsHumanReview && !earnedAutonomy.approvalReductionApplied;
  const sourceSimilarity = deriveDirectiveSourceSimilarityAssessment({
    source: input.source,
    sourceText,
    existingRuns,
    recommendedLaneId,
    precomputedSourceTokens,
  });
  const narrativeContext = deriveDirectiveSourceNarrativeContext({
    source: input.source,
    sourceText,
    mission: input.mission,
    existingRuns,
    prebuiltThreads: narrativeThreadBuild,
    provisionalLaneId: recommendedLaneId,
    currentMatchedGapId: matchedGap?.gapId ?? input.source.capabilityGapId ?? null,
    receivedAt: input.receivedAt,
  });
  const followUpQuestions = deriveDirectiveFollowUpQuestionSet({
    source: input.source,
    mission: input.mission,
    missionHealth,
    goalCopilot,
    narrativeContext,
    recommendedLaneId,
    laneProportions,
    confidence,
    routeConflict,
    matchedGap,
    openGaps: input.openGaps,
  });
  const confidenceRecovery = deriveConfidenceRecovery({
    source: input.source,
    mission: input.mission,
    missionFit,
    missionSpecificityWarning,
    recommendedLaneId,
    confidence,
    routeConflict,
    matchedGap,
    openGaps: input.openGaps,
    conflictingLaneIds,
    goalCopilot,
  });
  const reviewGuidance = deriveReviewGuidance({
    recommendedLaneId,
    confidence,
    matchedGap,
    routeConflict,
    needsHumanReview,
    recommendedRecordShape,
    confidenceRecoverySummary: confidenceRecovery?.summary ?? null,
  });

  const rationale: string[] = [];
  const keywordSignals: string[] = [];
  const metadataSignals: string[] = [];
  const gapAlignmentSignals: string[] = [];
  const ambiguitySignals: string[] = [];
  if (missionSpecificityWarning) {
    rationale.push(missionSpecificityWarning);
    ambiguitySignals.push(missionSpecificityWarning);
  }
  if (missionHealth) {
    const missionHealthLine =
      `Mission Health scored ${missionHealth.overallScore}/100 (${missionHealth.healthGrade}); over-match risk ${missionHealth.overmatchRiskScore}/5 and staleness risk ${missionHealth.stalenessRiskScore}/5.`;
    rationale.push(missionHealthLine);
    metadataSignals.push(missionHealthLine);
    for (const warning of missionHealth.warnings) {
      const warningLine = `Mission Health warning: ${warning}`;
      rationale.push(warningLine);
      ambiguitySignals.push(warningLine);
    }
    for (const tensionLine of missionHealth.tensionSignals) {
      const fullLine = `Mission Health tension: ${tensionLine}`;
      rationale.push(fullLine);
      ambiguitySignals.push(fullLine);
    }
    if (missionHealth.suggestedObjectiveRewrite) {
      const rewriteLine = `Mission Health suggested rewrite: ${missionHealth.suggestedObjectiveRewrite}`;
      rationale.push(rewriteLine);
      metadataSignals.push(rewriteLine);
    }
  }
  rationale.push(
    `Goal Copilot overall score is ${goalCopilot.overallScore}/100.`,
  );
  if (goalCopilot.warnings.length > 0) {
    const goalWarningLine = `Goal Copilot warnings: ${goalCopilot.warnings.join(" ")}`;
    rationale.push(goalWarningLine);
    ambiguitySignals.push(goalWarningLine);
  }
  if (goalCopilot.suggestedObjective) {
    const goalRewriteLine = `Goal Copilot suggested objective rewrite: ${goalCopilot.suggestedObjective}`;
    rationale.push(goalRewriteLine);
    metadataSignals.push(goalRewriteLine);
  }
  const appliedCorrectionLanes = Object.entries(correctionAdjustments).filter(
    ([, adj]) => adj !== 0,
  );
  if (appliedCorrectionLanes.length > 0) {
    const correctionLine =
      `Routing correction ledger applied adjustments: ${appliedCorrectionLanes.map(([lane, adj]) => `${lane} ${adj > 0 ? "+" : ""}${adj}`).join(", ")}.`;
    rationale.push(correctionLine);
    keywordSignals.push(correctionLine);
  }
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
  if (sourceMemory) {
    rationale.push(`Source Memory summary: ${sourceMemory.summary}`);
    for (const line of sourceMemory.rationale) {
      const fullLine = `Source Memory: ${line}`;
      rationale.push(fullLine);
      keywordSignals.push(fullLine);
    }
  }
  if (gapRadar) {
    const gapRadarLine = `Gap Radar summary: ${gapRadar.summary}`;
    rationale.push(gapRadarLine);
    gapAlignmentSignals.push(gapRadarLine);
    for (const suggestion of gapRadar.suggestions) {
      const suggestionLine =
        `Gap Radar suggestion (${suggestion.confidence}, ${suggestion.evidenceCount} events): ${suggestion.summary} ${suggestion.recommendedChange}`;
      rationale.push(suggestionLine);
      gapAlignmentSignals.push(suggestionLine);
    }
  }
  rationale.push(`Earned Autonomy score is ${earnedAutonomy.overallScore}/100 for route class ${earnedAutonomy.routeClass}.`);
  for (const autonomyLine of earnedAutonomy.rationale) {
    rationale.push(`Earned Autonomy: ${autonomyLine}`);
    ambiguitySignals.push(`Earned Autonomy: ${autonomyLine}`);
  }
  if (earnedAutonomy.approvalReductionApplied) {
    const autonomyAppliedLine =
      "Earned Autonomy waived the extra human-review gate because this route class has enough clean operator-confirmed history.";
    rationale.push(autonomyAppliedLine);
    ambiguitySignals.push(autonomyAppliedLine);
  } else if (baseNeedsHumanReview) {
    const autonomyBlockedLine =
      "Earned Autonomy did not waive review because the route class still lacks enough clean history or has contrary evidence.";
    rationale.push(autonomyBlockedLine);
    ambiguitySignals.push(autonomyBlockedLine);
  }
  rationale.push(
    `Lane proportions: discovery=${laneProportions.discovery}%, architecture=${laneProportions.architecture}%, runtime=${laneProportions.runtime}%.`,
  );
  if (secondaryLanes.length > 0) {
    for (const secondaryLane of secondaryLanes) {
      const secondaryLine = `Secondary lane signal: ${secondaryLane.reason}`;
      rationale.push(secondaryLine);
      ambiguitySignals.push(secondaryLine);
    }
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
  if (confidenceRecovery) {
    const followUpLine =
      `Confidence recovery asks for: ${confidenceRecovery.requestedInputs.map((entry) => entry.field).join(", ")}.`;
    rationale.push(followUpLine);
    ambiguitySignals.push(followUpLine);
  }
  if (followUpQuestions) {
    const questionLine =
      `Follow-up questions target: ${followUpQuestions.questions.map((entry) => entry.field).join(", ")}.`;
    rationale.push(questionLine);
    ambiguitySignals.push(questionLine);
  }
  if (sourceSimilarity) {
    const similarityLine = `Source similarity summary: ${sourceSimilarity.summary}`;
    rationale.push(similarityLine);
    keywordSignals.push(similarityLine);
  }
  if (narrativeContext) {
    const narrativeLine = `Narrative Threading summary: ${narrativeContext.summary}`;
    rationale.push(narrativeLine);
    ambiguitySignals.push(narrativeLine);
    if (narrativeContext.primaryThread) {
      const primaryThreadLine =
        `Narrative Threading primary thread "${narrativeContext.primaryThread.name}" is ${narrativeContext.primaryThread.state} with ${narrativeContext.primaryThread.sourceCount} sources and ${narrativeContext.primaryThread.followThrough.followThroughRate}% follow-through.`;
      rationale.push(primaryThreadLine);
      ambiguitySignals.push(primaryThreadLine);
    }
    if (Object.values(narrativeContext.biasAdjustments).some((value) => value > 0)) {
      const biasLine =
        `Narrative Threading bias adjustments: ${Object.entries(narrativeContext.biasAdjustments).map(([laneId, value]) => `${laneId} ${value > 0 ? "+" : ""}${value}`).join(", ")}.`;
      rationale.push(biasLine);
      keywordSignals.push(biasLine);
    }
    for (const signal of narrativeContext.demandSignals) {
      const demandLine = `Narrative Threading demand (${signal.priority}): ${signal.summary}`;
      rationale.push(demandLine);
      ambiguitySignals.push(demandLine);
    }
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

  const assessmentWithoutDigest: Omit<DirectiveEngineRoutingAssessment, "digest"> = {
    recommendedLaneId,
    recommendedRecordShape,
    missionPriorityScore,
    confidence,
    matchedGapId: matchedGap?.gapId ?? null,
    matchedGapRank,
    explicitRouteDestination: null,
    routeConflict,
    needsHumanReview,
    missionSpecificityWarning,
    missionHealth,
    goalCopilot,
    confidenceRecovery,
    followUpQuestions,
    gapRadar,
    earnedAutonomy,
    sourceMemory,
    sourceSimilarity,
    narrativeContext,
    laneProportions,
    secondaryLanes,
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

  return {
    ...assessmentWithoutDigest,
    digest: deriveRoutingDigest(assessmentWithoutDigest),
  };
}
