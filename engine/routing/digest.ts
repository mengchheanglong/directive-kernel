import type {
  EngineRoutingAssessment,
  RoutingDigest,
  RoutingDigestConcern,
  RoutingDigestConcernKind,
} from "../types.ts";

type RoutingAssessmentForDigest = Omit<EngineRoutingAssessment, "digest">;
type RankedConcernKind = Exclude<RoutingDigestConcernKind, "none">;

function toSentenceCase(value: string) {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatLaneLabel(laneId: string) {
  return toSentenceCase(laneId);
}

function formatThreadContext(
  assessment: RoutingAssessmentForDigest,
) {
  const primaryThread = assessment.narrativeContext?.primaryThread;
  if (!primaryThread) {
    return null;
  }
  return `Part of "${primaryThread.name}" (${primaryThread.state}, ${primaryThread.sourceCount} sources).`;
}

function buildTrustLevel(
  assessment: RoutingAssessmentForDigest,
) {
  const autonomy = assessment.earnedAutonomy;
  if (autonomy.approvalReductionApplied || autonomy.autoApprovalEligible) {
    return "Earned autonomy: auto-approval eligible.";
  }
  if (autonomy.evidenceCount === 0) {
    return "Needs review: first time seeing this route class.";
  }
  if (assessment.needsHumanReview) {
    return "Needs review: route class trust is still building.";
  }
  return `Earned autonomy: bounded route with ${autonomy.evidenceCount} prior case${autonomy.evidenceCount === 1 ? "" : "s"}.`;
}

function buildExplanation(
  assessment: RoutingAssessmentForDigest,
) {
  const laneLabel = formatLaneLabel(assessment.recommendedLaneId);
  if (assessment.routeConflict) {
    return `${laneLabel} currently wins, but the route is still provisional because the signal families disagree.`;
  }
  if (assessment.matchedGapId) {
    return `${laneLabel} wins because the source aligns with open gap ${assessment.matchedGapId} and still leads the lane score.`;
  }
  const primaryThread = assessment.narrativeContext?.primaryThread;
  if (primaryThread) {
    return `${laneLabel} wins because this source continues the "${primaryThread.name}" thread and keeps the strongest lane claim.`;
  }
  if (assessment.reviewGuidance?.summary) {
    return assessment.reviewGuidance.summary;
  }
  return `${laneLabel} wins because the dominant routing signals and mission fit all point in the same direction.`;
}

function deriveFollowUpSuggestedAction(
  assessment: RoutingAssessmentForDigest,
) {
  const confidenceRecoveryInput = assessment.confidenceRecovery?.requestedInputs[0];
  if (confidenceRecoveryInput) {
    return `Answer ${confidenceRecoveryInput.field}: ${confidenceRecoveryInput.question}`;
  }
  const followUpQuestion = assessment.followUpQuestions?.questions[0];
  if (followUpQuestion) {
    return `Answer ${followUpQuestion.field}: ${followUpQuestion.question}`;
  }
  return assessment.reviewGuidance?.operatorAction
    ?? "Record one stronger ownership signal before re-routing.";
}

function buildConcernSummary(
  kind: RankedConcernKind,
  assessment: RoutingAssessmentForDigest,
) {
  switch (kind) {
    case "conflict":
      return assessment.reviewGuidance?.summary
        ?? `Signals disagree about whether ${assessment.recommendedLaneId} is the right owner.`;
    case "low_confidence":
      return assessment.confidenceRecovery?.summary
        ?? `Routing confidence remains ${assessment.confidence}.`;
    case "mission_weakness":
      return assessment.missionSpecificityWarning
        ?? assessment.missionHealth?.warnings[0]
        ?? "The active mission is too weak to steer routing reliably.";
    case "stalled_thread": {
      const primaryThread = assessment.narrativeContext?.primaryThread;
      return primaryThread
        ? `Thread "${primaryThread.name}" is ${primaryThread.state} and still missing follow-through.`
        : "A related source thread has stalled and needs a missing piece.";
    }
    case "narrative_action":
      return assessment.narrativeContext?.demandSignals[0]?.summary
        ?? "A related thread is asking for a specific next move.";
    case "gap_pressure":
      return assessment.gapRadar?.suggestions[0]?.summary
        ?? "Repeated signals are pointing at a missing or stale capability gap.";
  }
}

function buildConcernAction(
  kind: RankedConcernKind,
  assessment: RoutingAssessmentForDigest,
) {
  switch (kind) {
    case "conflict":
      return assessment.reviewGuidance?.operatorAction
        ?? deriveFollowUpSuggestedAction(assessment);
    case "low_confidence":
      return deriveFollowUpSuggestedAction(assessment);
    case "mission_weakness":
      return assessment.goalCopilot.suggestedObjective
        ?? assessment.missionHealth?.suggestedObjectiveRewrite
        ?? assessment.goalCopilot.suggestedConstraints[0]
        ?? "Tighten the mission objective and constraints before trusting this route.";
    case "stalled_thread":
      return assessment.narrativeContext?.primaryThread?.demandSignals[0]?.summary
        ?? deriveFollowUpSuggestedAction(assessment);
    case "narrative_action":
      return assessment.narrativeContext?.demandSignals[0]?.summary
        ?? "Follow the highest-priority thread demand signal before routing more similar sources.";
    case "gap_pressure":
      return assessment.gapRadar?.suggestions[0]?.recommendedChange
        ?? "Record a new capability gap if this pressure is recurring.";
  }
}

function buildConcern(
  kind: RankedConcernKind,
  assessment: RoutingAssessmentForDigest,
): RoutingDigestConcern {
  return {
    kind,
    summary: buildConcernSummary(kind, assessment),
    suggestedAction: buildConcernAction(kind, assessment),
  };
}

function collectConcernKinds(
  assessment: RoutingAssessmentForDigest,
) {
  const concernKinds: RankedConcernKind[] = [];
  if (assessment.routeConflict) {
    concernKinds.push("conflict");
  }
  if (assessment.confidence === "low") {
    concernKinds.push("low_confidence");
  }
  if (
    assessment.missionSpecificityWarning
    || assessment.missionHealth?.healthGrade === "D"
    || assessment.missionHealth?.healthGrade === "F"
  ) {
    concernKinds.push("mission_weakness");
  }
  if (assessment.narrativeContext?.primaryThread?.state === "stalled") {
    concernKinds.push("stalled_thread");
  } else if (
    assessment.narrativeContext?.demandSignals.some((signal) => signal.priority === "high")
  ) {
    concernKinds.push("narrative_action");
  }
  if (
    assessment.matchedGapId === null
    && (assessment.gapRadar?.suggestions.length ?? 0) > 0
  ) {
    concernKinds.push("gap_pressure");
  }
  return concernKinds;
}

function rankConcernKinds(
  concernKinds: RankedConcernKind[],
) {
  const order: Record<RankedConcernKind, number> = {
    conflict: 0,
    low_confidence: 1,
    mission_weakness: 2,
    stalled_thread: 3,
    narrative_action: 4,
    gap_pressure: 5,
  };
  return [...concernKinds].sort((left, right) => order[left] - order[right]);
}

export function deriveRoutingDigest(
  assessment: RoutingAssessmentForDigest,
): RoutingDigest {
  const rankedConcernKinds = rankConcernKinds(collectConcernKinds(assessment));
  const primaryConcern = rankedConcernKinds[0]
    ? buildConcern(rankedConcernKinds[0], assessment)
    : null;

  return {
    headline:
      `${formatLaneLabel(assessment.recommendedLaneId)}, ${assessment.confidence} confidence.`,
    explanation: buildExplanation(assessment),
    primaryConcern,
    secondaryConcerns: rankedConcernKinds
      .slice(primaryConcern ? 1 : 0, primaryConcern ? 3 : 2)
      .map((kind) => ({
        kind,
        summary: buildConcernSummary(kind, assessment),
      })),
    threadContext: formatThreadContext(assessment),
    trustLevel: buildTrustLevel(assessment),
  };
}
