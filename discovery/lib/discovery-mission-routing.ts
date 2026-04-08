import type { DiscoverySourceType } from "./discovery-intake-queue-writer.ts";
import type { DiscoverySubmissionRequest, DiscoverySubmissionShape } from "./discovery-submission-router.ts";
import {
  generateDiscoveryGapWorklist,
  parseActiveMissionProfile,
  type CapabilityGapRecord,
  type DiscoveryGapWorklistItem,
  type DiscoveryQueueEntry,
} from "./discovery-gap-worklist-generator.ts";

export type DiscoveryRoutingTrack = "discovery" | "architecture" | "runtime";

export type DiscoveryMissionRoutingConfidence = "high" | "medium" | "low";

export type DiscoveryMissionRoutingAssessment = {
  recommended_track: DiscoveryRoutingTrack;
  recommended_record_shape: DiscoverySubmissionShape;
  mission_priority_score: number;
  confidence: DiscoveryMissionRoutingConfidence;
  matched_gap_id: string | null;
  matched_gap_rank: number | null;
  explicit_route_destination: DiscoveryRoutingTrack | null;
  route_conflict: boolean;
  needs_human_review: boolean;
  ambiguity_summary: {
    top_track: DiscoveryRoutingTrack;
    runner_up_track: DiscoveryRoutingTrack | null;
    score_delta: number;
    conflicting_signal_families: Array<"keyword" | "metadata" | "gap">;
    conflicting_tracks: DiscoveryRoutingTrack[];
  };
  review_guidance: {
    guidance_kind:
      | "conflicted_architecture_review"
      | "conflicted_runtime_review"
      | "low_confidence_discovery_hold"
      | "bounded_lane_review";
    summary: string;
    operator_action: string;
    required_checks: string[];
    stop_line: string;
  } | null;
  score_breakdown: {
    mission_fit: number;
    gap_alignment: number;
    track_scores: Record<DiscoveryRoutingTrack, number>;
    transformation_signal: number;
    runtime_signal: number;
    ambiguity_penalty: number;
    total: number;
  };
  explanation_breakdown: {
    keyword_signals: string[];
    metadata_signals: string[];
    gap_alignment_signals: string[];
    ambiguity_signals: string[];
  };
  rationale: string[];
};

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

const RUNTIME_SOURCE_TYPES = new Set<DiscoverySourceType>([
  "github-repo",
  "tool",
  "external-system",
] as DiscoverySourceType[]);

const STRUCTURAL_SOURCE_TYPES = new Set<DiscoverySourceType>([
  "paper",
  "product-doc",
  "technical-essay",
  "workflow-writeup",
  "theory",
] as DiscoverySourceType[]);

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
]);

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
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

function flattenRequestText(request: DiscoverySubmissionRequest) {
  const parts = [
    request.candidate_name,
    request.source_reference,
    request.mission_alignment ?? "",
    request.notes ?? "",
  ];

  if (request.fast_path) {
    parts.push(
      request.fast_path.claimed_value,
      request.fast_path.first_pass_summary,
      request.fast_path.why_this_route,
      request.fast_path.why_not_alternatives,
      request.fast_path.need_bounded_proof,
      request.fast_path.next_artifact,
    );
  }

  if (request.case_record) {
    parts.push(
      request.case_record.intake.why_it_entered_the_system,
      request.case_record.intake.claimed_value,
      request.case_record.intake.initial_relevance_to_workspace,
      request.case_record.triage.first_pass_summary,
      request.case_record.triage.problem_it_appears_to_solve,
      request.case_record.triage.extractable_value_hypothesis,
      request.case_record.triage.routing_recommendation,
      request.case_record.triage.next_action,
      request.case_record.routing.why_this_route,
      request.case_record.routing.why_not_alternatives,
      request.case_record.routing.required_next_artifact,
      request.case_record.completion?.rationale ?? "",
    );
  }

  return parts.filter(Boolean).join(" ");
}

function deriveExplicitRouteDestination(
  request: DiscoverySubmissionRequest,
): DiscoveryRoutingTrack | null {
  const explicitRoute =
    request.case_record?.routing.route_destination ??
    request.fast_path?.route_destination ??
    null;
  if (explicitRoute === "architecture" || explicitRoute === "runtime") {
    return explicitRoute;
  }
  return null;
}

function findMatchedGap(
  request: DiscoverySubmissionRequest,
  openWorklist: DiscoveryGapWorklistItem[],
  requestText: string,
) {
  if (request.capability_gap_id) {
    const directMatch =
      openWorklist.find((item) => item.gap_id === request.capability_gap_id) ?? null;
    if (directMatch) {
      return directMatch;
    }
  }

  let bestMatch: DiscoveryGapWorklistItem | null = null;
  let bestScore = 0;
  for (const item of openWorklist) {
    const overlap = countTokenOverlap(
      requestText,
      `${item.gap_id} ${item.mission_objective} ${item.next_action} ${item.blocking_reason ?? ""}`,
    );
    if (overlap > bestScore) {
      bestScore = overlap;
      bestMatch = item;
    }
  }

  return bestScore >= 2 ? bestMatch : null;
}

function deriveMissionFit(
  requestText: string,
  activeMissionMarkdown: string,
) {
  const missionProfile = parseActiveMissionProfile(activeMissionMarkdown);
  const objectiveOverlap = countTokenOverlap(requestText, missionProfile.currentObjective);
  const usefulnessOverlap = missionProfile.usefulnessSignals.reduce(
    (score, signal) => score + countTokenOverlap(requestText, signal),
    0,
  );
  const laneOverlap = missionProfile.capabilityLanes.reduce(
    (score, lane) => score + countTokenOverlap(requestText, lane),
    0,
  );
  return clampInt(objectiveOverlap + usefulnessOverlap + laneOverlap, 0, 5);
}

function deriveTrackScores(
  request: DiscoverySubmissionRequest,
  requestText: string,
  matchedGap: DiscoveryGapWorklistItem | null,
) {
  const discoverySignal = countKeywordHits(requestText, DISCOVERY_KEYWORDS);
  const architectureSignal = countKeywordHits(requestText, ARCHITECTURE_KEYWORDS);
  const baseRuntimeSignal = countKeywordHits(requestText, RUNTIME_KEYWORDS);
  const transformationSignal = countKeywordHits(requestText, TRANSFORMATION_KEYWORDS);
  const runtimeSignal =
    baseRuntimeSignal +
    (request.source_type && RUNTIME_SOURCE_TYPES.has(request.source_type) ? 2 : 0);
  const structuralSignal =
    architectureSignal +
    (request.source_type && STRUCTURAL_SOURCE_TYPES.has(request.source_type) ? 1 : 0);

  const trackScores: Record<DiscoveryRoutingTrack, number> = {
    discovery:
      discoverySignal * 3 +
      (request.source_type === "internal-signal" ? 2 : 0) +
      (matchedGap?.next_slice_track === "discovery" ? 4 : 0),
    architecture:
      structuralSignal * 3 +
      (matchedGap?.next_slice_track === "architecture" ? 4 : 0),
    runtime:
      runtimeSignal * 3 +
      transformationSignal * 2 +
      (matchedGap?.next_slice_track === "runtime" ? 4 : 0),
  };

  return {
    trackScores,
    transformationSignal: clampInt(transformationSignal, 0, 5),
    runtimeSignal: clampInt(runtimeSignal, 0, 5),
    structuralSignal: clampInt(structuralSignal, 0, 5),
  };
}

function deriveRecommendedTrack(trackScores: Record<DiscoveryRoutingTrack, number>) {
  return (Object.entries(trackScores).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0]?.[0] ?? "discovery") as DiscoveryRoutingTrack;
}

function deriveAmbiguityPenalty(trackScores: Record<DiscoveryRoutingTrack, number>) {
  const sortedScores = Object.values(trackScores).sort((left, right) => right - left);
  if (sortedScores.length < 2) {
    return 0;
  }
  const difference = sortedScores[0] - sortedScores[1];
  if (difference >= 4) return 0;
  if (difference >= 2) return 1;
  return 2;
}

function deriveAmbiguitySummary(trackScores: Record<DiscoveryRoutingTrack, number>) {
  const sorted = Object.entries(trackScores).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });
  const top = (sorted[0]?.[0] ?? "discovery") as DiscoveryRoutingTrack;
  const topScore = sorted[0]?.[1] ?? 0;
  const runnerUp = (sorted[1]?.[0] ?? null) as DiscoveryRoutingTrack | null;
  const runnerUpScore = sorted[1]?.[1] ?? 0;
  return {
    top_track: top,
    runner_up_track: runnerUp,
    score_delta: topScore - runnerUpScore,
  };
}

function deriveConflictingSignalFamilies(input: {
  recommendedTrack: DiscoveryRoutingTrack;
  matchedGap: DiscoveryGapWorklistItem | null;
  explicitRouteDestination: DiscoveryRoutingTrack | null;
  discoverySignal: number;
  structuralSignal: number;
  runtimeSignal: number;
}) {
  const keywordWinner = deriveRecommendedTrack({
    discovery: input.discoverySignal,
    architecture: input.structuralSignal,
    runtime: input.runtimeSignal,
  });
  const metadataWinner = input.explicitRouteDestination;
  const gapWinner =
    input.matchedGap?.next_slice_track === "discovery"
    || input.matchedGap?.next_slice_track === "architecture"
    || input.matchedGap?.next_slice_track === "runtime"
      ? input.matchedGap.next_slice_track
      : null;

  const conflictingSignalFamilies: Array<"keyword" | "metadata" | "gap"> = [];
  const conflictingTracks = new Set<DiscoveryRoutingTrack>();

  if (keywordWinner !== input.recommendedTrack) {
    conflictingSignalFamilies.push("keyword");
    conflictingTracks.add(keywordWinner);
  }
  if (metadataWinner && metadataWinner !== input.recommendedTrack) {
    conflictingSignalFamilies.push("metadata");
    conflictingTracks.add(metadataWinner);
  }
  if (gapWinner && gapWinner !== input.recommendedTrack) {
    conflictingSignalFamilies.push("gap");
    conflictingTracks.add(gapWinner);
  }

  return {
    conflictingSignalFamilies,
    conflictingTracks: [...conflictingTracks],
  };
}

function deriveReviewGuidance(input: {
  recommendedTrack: DiscoveryRoutingTrack;
  routeConflict: boolean;
  confidence: DiscoveryMissionRoutingConfidence;
  needsHumanReview: boolean;
}) {
  if (input.routeConflict && input.recommendedTrack === "architecture") {
    return {
      guidance_kind: "conflicted_architecture_review",
      summary:
        "Discovery found a structurally strong Architecture route, but the route remains conflicted and needs explicit review before downstream adoption.",
      operator_action:
        "Keep the fuller Discovery record visible, confirm the Architecture route still reflects the best bounded interpretation, and only then open the downstream Architecture handoff.",
      required_checks: [
        "Confirm the structural Architecture signals still outweigh the conflicting route pressure.",
        "Record the remaining route conflict before approving the Architecture handoff.",
      ],
      stop_line:
        "Do not open downstream Architecture work until the conflicted route is explicitly reviewed.",
    } as const;
  }

  if (input.routeConflict && input.recommendedTrack === "runtime") {
    return {
      guidance_kind: "conflicted_runtime_review",
      summary:
        "Discovery found a Runtime-oriented route, but the conflict is strong enough that the case should stay queued until the route is reviewed explicitly.",
      operator_action:
        "Keep the candidate in Discovery queue form, review the conflicting route signals, and only open Runtime follow-up after that explicit review.",
      required_checks: [
        "Confirm the Runtime route still fits the active mission better than the conflicting alternative.",
        "Resolve the route conflict before opening Runtime follow-through.",
      ],
      stop_line:
        "Do not open Runtime follow-up while the route conflict remains unresolved.",
    } as const;
  }

  if (input.confidence === "low" && input.recommendedTrack === "discovery") {
    return {
      guidance_kind: "low_confidence_discovery_hold",
      summary:
        "Discovery should hold this candidate because routing confidence is still too low to assign lane ownership safely.",
      operator_action:
        "Keep the case in Discovery, gather clearer mission-fit or gap evidence, and avoid early Architecture or Runtime assignment.",
      required_checks: [
        "Gather stronger route evidence before assigning downstream ownership.",
        "Confirm whether an open capability gap or explicit adoption target exists.",
      ],
      stop_line:
        "Do not assign Architecture or Runtime ownership while routing confidence stays low.",
    } as const;
  }

  if (input.needsHumanReview && input.recommendedTrack !== "discovery") {
    return {
      guidance_kind: "bounded_lane_review",
      summary:
        "The route is directionally correct, but Discovery still requires one bounded human review before downstream follow-through.",
      operator_action:
        "Review the bounded lane recommendation, confirm the route still matches the active mission, and only then open the downstream stub.",
      required_checks: [
        "Confirm the recommended lane still reflects the best bounded interpretation.",
        "Record the bounded review outcome before downstream approval.",
      ],
      stop_line:
        "Do not open the downstream stub until the bounded lane review is complete.",
    } as const;
  }

  return null;
}

function deriveConfidence(
  topTrackScore: number,
  ambiguityPenalty: number,
  routeConflict: boolean,
): DiscoveryMissionRoutingConfidence {
  if (!routeConflict && ambiguityPenalty === 0 && topTrackScore >= 10) {
    return "high";
  }
  if (ambiguityPenalty <= 1 && topTrackScore >= 6) {
    return "medium";
  }
  return "low";
}

function deriveRecommendedShape(
  input: {
    request: DiscoverySubmissionRequest;
    recommendedTrack: DiscoveryRoutingTrack;
    confidence: DiscoveryMissionRoutingConfidence;
    matchedGap: DiscoveryGapWorklistItem | null;
    routeConflict: boolean;
    transformationSignal: number;
    runtimeSignal: number;
    structuralSignal: number;
  },
): DiscoverySubmissionShape {
  const explicitShape = input.request.record_shape;
  if (
    !input.routeConflict &&
    explicitShape === "queue_only" ||
    !input.routeConflict &&
    explicitShape === "fast_path" ||
    !input.routeConflict &&
    explicitShape === "split_case"
  ) {
    return explicitShape;
  }

  if (!input.routeConflict && input.request.case_record) return "split_case";
  if (!input.routeConflict && input.request.fast_path) return "fast_path";

  if (input.confidence === "high" && input.matchedGap) {
    if (input.recommendedTrack === "architecture") {
      return "split_case";
    }
    return "fast_path";
  }

  if (
    input.confidence === "high" &&
    !input.routeConflict &&
    input.matchedGap === null
  ) {
    if (
      input.recommendedTrack === "architecture" &&
      (
        (input.request.source_type !== undefined && STRUCTURAL_SOURCE_TYPES.has(input.request.source_type)) ||
        input.structuralSignal > 0
      )
    ) {
      return "split_case";
    }
    if (
      input.recommendedTrack === "runtime" &&
      (
        (input.request.source_type !== undefined && RUNTIME_SOURCE_TYPES.has(input.request.source_type)) ||
        input.transformationSignal > 0 ||
        input.runtimeSignal > 0
      )
    ) {
      return "fast_path";
    }
  }

  if (input.routeConflict) {
    if (input.recommendedTrack === "architecture") {
      return "split_case";
    }
    if (input.recommendedTrack === "runtime") {
      return "queue_only";
    }
  }

  if (input.confidence === "medium" && input.recommendedTrack !== "discovery") {
    return "fast_path";
  }

  return "queue_only";
}

function shouldFallbackLowConfidenceTrackToDiscovery(input: {
  confidence: DiscoveryMissionRoutingConfidence;
  matchedGap: DiscoveryGapWorklistItem | null;
  explicitRouteDestination: DiscoveryRoutingTrack | null;
}) {
  return (
    input.confidence === "low"
    && input.matchedGap === null
    && input.explicitRouteDestination === null
  );
}

export function assessDiscoveryMissionRouting(input: {
  request: DiscoverySubmissionRequest;
  gaps: CapabilityGapRecord[];
  activeMissionMarkdown: string;
  intakeQueueEntries?: DiscoveryQueueEntry[];
}): DiscoveryMissionRoutingAssessment {
  const requestText = flattenRequestText(input.request);
  const worklist = generateDiscoveryGapWorklist({
    updatedAt: "assessment",
    gaps: input.gaps,
    intakeQueueEntries: input.intakeQueueEntries ?? [],
    activeMissionMarkdown: input.activeMissionMarkdown,
  });
  const matchedGap = findMatchedGap(input.request, worklist.items, requestText);
  const missionFit = deriveMissionFit(requestText, input.activeMissionMarkdown);
  const gapAlignment = matchedGap
    ? clampInt(Math.ceil(matchedGap.priority_score / 20), 0, 5)
    : 0;
  const { trackScores, transformationSignal, runtimeSignal, structuralSignal } = deriveTrackScores(
    input.request,
    requestText,
    matchedGap,
  );
  const discoverySignal = countKeywordHits(requestText, DISCOVERY_KEYWORDS);
  const scoreWinnerTrack = deriveRecommendedTrack(trackScores);
  const ambiguityPenalty = deriveAmbiguityPenalty(trackScores);
  const explicitRouteDestination = deriveExplicitRouteDestination(input.request);
  const routeConflict =
    explicitRouteDestination !== null && explicitRouteDestination !== scoreWinnerTrack;
  const topTrackScore = trackScores[scoreWinnerTrack];
  const total =
    missionFit * 4 +
    gapAlignment * 5 +
    topTrackScore +
    transformationSignal -
    ambiguityPenalty * 4;
  const missionPriorityScore = clampInt(total, 0, 100);
  const confidence = deriveConfidence(topTrackScore, ambiguityPenalty, routeConflict);
  const recommendedTrack = shouldFallbackLowConfidenceTrackToDiscovery({
    confidence,
    matchedGap,
    explicitRouteDestination,
  })
    ? "discovery"
    : scoreWinnerTrack;
  const recommendedRecordShape = deriveRecommendedShape({
    request: input.request,
    recommendedTrack,
    confidence,
    matchedGap,
    routeConflict,
    transformationSignal,
    runtimeSignal,
    structuralSignal,
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
  const ambiguitySummaryBase = deriveAmbiguitySummary(trackScores);
  const conflictingSignals = deriveConflictingSignalFamilies({
    recommendedTrack,
    matchedGap,
    explicitRouteDestination,
    discoverySignal,
    structuralSignal,
    runtimeSignal,
  });
  const reviewGuidance = deriveReviewGuidance({
    recommendedTrack,
    routeConflict,
    confidence,
    needsHumanReview,
  });
  const explanationBreakdown = {
    keyword_signals: [
      `Discovery keyword signal scored ${discoverySignal}.`,
      `Architecture structural signal scored ${structuralSignal}.`,
      `Runtime signal scored ${runtimeSignal}.`,
      ...(transformationSignal > 0
        ? [`Transformation pressure scored ${transformationSignal}.`]
        : []),
    ],
    metadata_signals: [
      ...(explicitRouteDestination
        ? [`Explicit route destination requested ${explicitRouteDestination}.`]
        : ["No explicit route destination was supplied."]),
      ...(input.request.source_type
        ? [`Source type contributed ${input.request.source_type} routing context.`]
        : []),
    ],
    gap_alignment_signals: matchedGap
      ? [
          `Matched open gap ${matchedGap.gap_id} at rank ${matchedGap.worklist_rank}.`,
          `Gap alignment pressure contributed ${gapAlignment}/5.`,
        ]
      : [
          "No open gap matched strongly enough to drive the route.",
          `Gap alignment pressure contributed ${gapAlignment}/5.`,
        ],
    ambiguity_signals: [
      `Top route ${ambiguitySummaryBase.top_track} leads ${ambiguitySummaryBase.runner_up_track ?? "none"} by ${ambiguitySummaryBase.score_delta}.`,
      ...(conflictingSignals.conflictingSignalFamilies.length > 0
        ? [
            `Conflicting signal families: ${conflictingSignals.conflictingSignalFamilies.join(", ")}.`,
            `Conflicting track pressure: ${conflictingSignals.conflictingTracks.join(", ")}.`,
          ]
        : ["No materially conflicting signal families remained after the bounded routing pass."]),
    ],
  };

  const rationale: string[] = [];
  if (matchedGap) {
    rationale.push(
      `Matched open gap ${matchedGap.gap_id} (rank ${matchedGap.worklist_rank}) as the closest current mission pressure.`,
    );
  } else {
    rationale.push(
      "No unresolved gap matched strongly enough, so the assessment relied on mission-fit and track-signal scoring.",
    );
  }
  rationale.push(
    `Recommended ${scoreWinnerTrack} because its track score (${trackScores[scoreWinnerTrack]}) exceeded the alternatives.`,
  );
  if (transformationSignal > 0) {
    rationale.push(
      `Transformation signal is present (${transformationSignal}/5), which strengthens Runtime-style behavior-preserving work.`,
    );
  }
  if (routeConflict && explicitRouteDestination) {
    rationale.push(
      `Explicit route ${explicitRouteDestination} conflicts with the computed recommendation and should be reviewed by a human.`,
    );
  }
  if (recommendedTrack === "discovery" && scoreWinnerTrack !== "discovery" && confidence === "low") {
    rationale.push(
      `Routing confidence remained low without an open gap or explicit route, so the candidate stays in Discovery instead of assigning early ${scoreWinnerTrack} ownership.`,
    );
  }
  if (recommendedRecordShape === "fast_path") {
    if (
      recommendedTrack === "runtime" &&
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
      recommendedTrack === "architecture" &&
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
    if (routeConflict && recommendedTrack === "runtime") {
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
    recommended_track: recommendedTrack,
    recommended_record_shape: recommendedRecordShape,
    mission_priority_score: missionPriorityScore,
    confidence,
    matched_gap_id: matchedGap?.gap_id ?? null,
    matched_gap_rank: matchedGap?.worklist_rank ?? null,
    explicit_route_destination: explicitRouteDestination,
    route_conflict: routeConflict,
    needs_human_review: needsHumanReview,
    ambiguity_summary: {
      ...ambiguitySummaryBase,
      conflicting_signal_families: conflictingSignals.conflictingSignalFamilies,
      conflicting_tracks: conflictingSignals.conflictingTracks,
    },
    review_guidance: reviewGuidance,
    score_breakdown: {
      mission_fit: missionFit,
      gap_alignment: gapAlignment,
      track_scores: trackScores,
      transformation_signal: transformationSignal,
      runtime_signal: runtimeSignal,
      ambiguity_penalty: ambiguityPenalty,
      total: missionPriorityScore,
    },
    explanation_breakdown: explanationBreakdown,
    rationale,
  };
}
