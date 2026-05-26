import type {
  EngineCapabilityGap,
  EngineMissionContext,
  EngineRoutingConfidence,
  EngineSourceItem,
} from "../types.ts";
import type { GoalCopilotAssessment } from "./keywords.ts";

function deriveConfidenceRecovery(input: {
  source: EngineSourceItem;
  mission: EngineMissionContext;
  missionFit: number;
  missionSpecificityWarning: string | null;
  recommendedLaneId: "discovery" | "architecture" | "runtime";
  confidence: EngineRoutingConfidence;
  routeConflict: boolean;
  matchedGap: EngineCapabilityGap | null;
  openGaps: EngineCapabilityGap[];
  conflictingLaneIds: Array<"discovery" | "architecture" | "runtime">;
  goalCopilot: GoalCopilotAssessment;
}) {
  const runtimeInPlay =
    input.recommendedLaneId === "runtime" || input.conflictingLaneIds.includes("runtime");
  const architectureInPlay =
    input.recommendedLaneId === "architecture" || input.conflictingLaneIds.includes("architecture");
  const goalNeedsFollowUp =
    Boolean(input.missionSpecificityWarning)
    || input.goalCopilot.overallScore < 60
    || input.goalCopilot.objectiveSpecificityScore <= 1
    || input.goalCopilot.usefulnessSignalQualityScore <= 1
    || input.goalCopilot.constraintQualityScore <= 1
    || input.goalCopilot.laneClarityScore <= 2;
  const requestedInputs: Array<{
    field: string;
    question: string;
    whyItMatters: string;
    exampleAnswer: string | null;
  }> = [];

  const pushRequest = (request: {
    field: string;
    question: string;
    whyItMatters: string;
    exampleAnswer: string | null;
  }) => {
    if (requestedInputs.some((entry) => entry.field === request.field)) {
      return;
    }
    requestedInputs.push(request);
  };

  if (goalNeedsFollowUp) {
    if (input.missionSpecificityWarning || input.goalCopilot.objectiveSpecificityScore <= 1) {
      pushRequest({
        field: "mission.currentObjective",
        question: "Rewrite the mission objective with 2-3 concrete capability nouns instead of generic improvement language.",
        whyItMatters: "Generic mission text over-matches everything and keeps routing confidence artificially low.",
        exampleAnswer: input.goalCopilot.suggestedObjective,
      });
    }
    if (input.goalCopilot.usefulnessSignalQualityScore <= 1) {
      pushRequest({
        field: "mission.usefulnessSignals",
        question: "List 1-2 concrete usefulness signals that say what 'better' means for this mission.",
        whyItMatters: "Specific usefulness signals sharpen mission-fit and make downstream triage less subjective.",
        exampleAnswer: input.goalCopilot.suggestedUsefulnessSignals[0] ?? null,
      });
    }
    if (input.goalCopilot.constraintQualityScore <= 1) {
      pushRequest({
        field: "mission.constraints",
        question: "Add 1-3 explicit constraints that keep the next change bounded, reviewable, and reversible.",
        whyItMatters: "Constraints stop the mission from rewarding broad but unsafe changes.",
        exampleAnswer: input.goalCopilot.suggestedConstraints[0] ?? null,
      });
    }
    if (!input.mission.successSignal) {
      pushRequest({
        field: "mission.successSignal",
        question: "What observable outcome would count as a sufficient improvement for this mission?",
        whyItMatters: "An explicit success signal helps the Engine distinguish meaningful progress from generic relevance.",
        exampleAnswer: "One bounded routing decision becomes materially clearer and requires less manual review.",
      });
    }
    if (
      input.goalCopilot.laneClarityScore <= 2
      && !input.mission.adoptionTarget
      && input.goalCopilot.suggestedCapabilityLanes.length > 0
    ) {
      pushRequest({
        field: "mission.adoptionTarget",
        question: "Which lane should be treated as the default owner when the source matches this mission most strongly?",
        whyItMatters: "A default mission-level owner reduces avoidable cross-lane ambiguity before source metadata is available.",
        exampleAnswer: input.goalCopilot.suggestedCapabilityLanes[0] ?? null,
      });
    }
  }

  if (input.routeConflict || input.confidence === "low") {
    if (!input.source.primaryAdoptionTarget) {
      pushRequest({
        field: "source.primaryAdoptionTarget",
        question: "If you had to choose one owner now, should this land in Discovery, Architecture, or Runtime?",
        whyItMatters: "Explicit ownership metadata is the strongest structured routing signal and breaks many lane ties immediately.",
        exampleAnswer: architectureInPlay ? "architecture" : runtimeInPlay ? "runtime" : "discovery",
      });
    }
    if (runtimeInPlay && input.source.containsExecutableCode == null) {
      pushRequest({
        field: "source.containsExecutableCode",
        question: "Does the source contain executable code or a repeated operational mechanism that should become reusable runtime capability?",
        whyItMatters: "Executable repeated value is the cleanest separator between Runtime and non-Runtime routes.",
        exampleAnswer: "true - includes callable code that should be reused",
      });
    }
    if (architectureInPlay && input.source.improvesDirectiveWorkspace == null) {
      pushRequest({
        field: "source.improvesDirectiveWorkspace",
        question: "Is the primary value improving Directive Workspace itself rather than a host/runtime capability?",
        whyItMatters: "This is the strongest structured signal for Architecture ownership.",
        exampleAnswer: "true - improves routing, evaluation, or workflow logic",
      });
    }
    if (input.source.containsWorkflowPattern === true && !input.source.workflowBoundaryShape) {
      pushRequest({
        field: "source.workflowBoundaryShape",
        question: "Is the workflow value a bounded protocol or an iterative loop?",
        whyItMatters: "Boundary shape helps distinguish Architecture workflow logic from generic automation wording.",
        exampleAnswer: "bounded_protocol",
      });
    }
    if (!input.matchedGap && !input.source.capabilityGapId && input.openGaps.length > 0) {
      pushRequest({
        field: "source.capabilityGapId",
        question: "Which currently open capability gap does this source close most directly?",
        whyItMatters: "Explicit gap alignment often resolves low-confidence ties without adding more prose.",
        exampleAnswer: input.openGaps[0]?.gapId ?? null,
      });
    }
    if (!input.source.missionAlignmentHint || input.missionFit <= 1) {
      pushRequest({
        field: "source.missionAlignmentHint",
        question: "Give one sentence that ties this source directly to the current mission objective.",
        whyItMatters: "A crisp mission-alignment sentence raises mission-fit and reduces generic over-match.",
        exampleAnswer:
          "This improves directive workspace routing quality by clarifying bounded architecture ownership.",
      });
    }
  }

  if (requestedInputs.length === 0) {
    return null;
  }

  const summary = input.routeConflict
    ? "Answer one or two structured follow-up questions to break the current lane conflict."
    : input.missionSpecificityWarning
      ? "Sharpen the mission and one ownership signal so this route is backed by explicit, non-generic intent."
      : goalNeedsFollowUp
        ? "Fill the highest-leverage mission gaps so this route is supported by stronger explicit intent."
        : "Add one or two explicit structured signals to raise routing confidence.";
  const confidenceLift = input.routeConflict
    ? "Likely to resolve the current lane disagreement."
    : goalNeedsFollowUp && input.confidence !== "low"
      ? "Likely to harden this route by replacing weak goal inputs with explicit intent."
      : input.recommendedLaneId === "discovery"
        ? "Likely to move this from Discovery hold to a bounded lane recommendation."
        : "Likely to move this from low-confidence review to a clearer bounded route.";

  return {
    summary,
    confidenceLift,
    requestedInputs: requestedInputs.slice(0, 3),
  };
}

function deriveReviewGuidance(input: {
  recommendedLaneId: "discovery" | "architecture" | "runtime";
  confidence: EngineRoutingConfidence;
  matchedGap: EngineCapabilityGap | null;
  routeConflict: boolean;
  needsHumanReview: boolean;
  recommendedRecordShape: string;
  confidenceRecoverySummary?: string | null;
}) {
  if (input.routeConflict && input.recommendedLaneId === "architecture") {
    return {
      guidanceKind: "conflicted_architecture_review" as const,
      summary: "Conflicted Architecture route requires explicit structural review before downstream adoption.",
      operatorAction:
        `Review the competing Runtime-vs-Architecture signals, confirm Architecture ownership explicitly, and keep the fuller split-case record until the conflict is resolved.${input.confidenceRecoverySummary ? ` ${input.confidenceRecoverySummary}` : ""}`,
      requiredChecks: [
        "Confirm why Architecture still owns the candidate despite the competing Runtime signal.",
        "Record why the alternative lane was rejected before any downstream adoption step.",
        "Keep the split-case structural record explicit during review.",
        ...(input.confidenceRecoverySummary
          ? ["Capture the requested confidence-recovery inputs before rerouting."]
          : []),
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
        `Review the competing signals, confirm Runtime ownership explicitly, and keep the case queue-only until that review is recorded.${input.confidenceRecoverySummary ? ` ${input.confidenceRecoverySummary}` : ""}`,
      requiredChecks: [
        "Confirm why Runtime still owns the candidate despite the competing lane signal.",
        "Record why the alternative lane was rejected before opening follow-up.",
        "Keep the case queue-only until review completes.",
        ...(input.confidenceRecoverySummary
          ? ["Capture the requested confidence-recovery inputs before rerouting."]
          : []),
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
        `Keep the candidate in Discovery, gather clearer routing evidence, and avoid assigning Architecture or Runtime ownership early.${input.confidenceRecoverySummary ? ` ${input.confidenceRecoverySummary}` : ""}`,
      requiredChecks: [
        "Record what evidence is still missing for lane ownership.",
        "Prefer new routing evidence or open-gap alignment before rerouting.",
        ...(input.confidenceRecoverySummary
          ? ["Capture the requested confidence-recovery inputs before rerouting."]
          : []),
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
        `Keep the bounded lane recommendation visible, review the remaining uncertainty explicitly, and only proceed after that review is recorded.${input.confidenceRecoverySummary ? ` ${input.confidenceRecoverySummary}` : ""}`,
      requiredChecks: [
        "Confirm the lane still matches the best bounded interpretation.",
        "Record the remaining uncertainty before downstream advancement.",
        ...(input.confidenceRecoverySummary
          ? ["Capture the requested confidence-recovery inputs before rerouting."]
          : []),
      ],
      stopLine:
        "Do not widen downstream work while this bounded review requirement remains open.",
    };
  }

  return null;
}

export {
  deriveConfidenceRecovery,
  deriveReviewGuidance,
};
