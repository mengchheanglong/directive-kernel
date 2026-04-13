import type {
  DirectiveEngineCapabilityGap,
  DirectiveEngineMissionContext,
  DirectiveEngineRoutingConfidence,
  DirectiveEngineSourceItem,
} from "./types.ts";
import type { DirectiveMissionHealthAssessment } from "./mission-health.ts";

export type DirectiveEngineFollowUpQuestion = {
  field: string;
  question: string;
  whyItMatters: string;
  exampleAnswer: string | null;
  predictedEffect: string;
};

export type DirectiveEngineFollowUpQuestionSet = {
  summary: string;
  questions: DirectiveEngineFollowUpQuestion[];
} | null;

function uniqueByField(
  questions: DirectiveEngineFollowUpQuestion[],
  question: DirectiveEngineFollowUpQuestion,
) {
  if (!questions.some((entry) => entry.field === question.field)) {
    questions.push(question);
  }
}

export function deriveDirectiveFollowUpQuestionSet(input: {
  source: DirectiveEngineSourceItem;
  mission: DirectiveEngineMissionContext;
  missionHealth: DirectiveMissionHealthAssessment | null;
  goalCopilot: {
    suggestedObjective: string | null;
    suggestedConstraints: string[];
    suggestedUsefulnessSignals: string[];
    suggestedCapabilityLanes: string[];
  };
  recommendedLaneId: "discovery" | "architecture" | "runtime";
  laneProportions: Record<"discovery" | "architecture" | "runtime", number>;
  confidence: DirectiveEngineRoutingConfidence;
  routeConflict: boolean;
  matchedGap: DirectiveEngineCapabilityGap | null;
  openGaps: DirectiveEngineCapabilityGap[];
}) {
  const questions: DirectiveEngineFollowUpQuestion[] = [];
  const architectureInPlay = input.laneProportions.architecture >= 25;
  const runtimeInPlay = input.laneProportions.runtime >= 25;
  const goalWeak =
    (input.missionHealth?.overallScore ?? 100) < 70
    || (input.missionHealth?.overmatchRiskScore ?? 0) >= 4;

  if (goalWeak) {
    uniqueByField(questions, {
      field: "mission.currentObjective",
      question: "What concrete capability or boundary is this mission trying to improve right now?",
      whyItMatters: "A more specific mission objective reduces over-match and makes weak source evidence less ambiguous.",
      exampleAnswer: input.goalCopilot.suggestedObjective,
      predictedEffect: "A concrete rewrite usually raises mission-fit and can harden the current route without changing workflow state.",
    });
  }

  if (!input.mission.successSignal) {
    uniqueByField(questions, {
      field: "mission.successSignal",
      question: "What observable result would count as a sufficient improvement for this mission?",
      whyItMatters: "A clear success signal separates meaningful relevance from generic improvement language.",
      exampleAnswer: "One bounded routing decision becomes materially clearer and requires less manual review.",
      predictedEffect: "Adds an explicit mission boundary; usually improves medium-confidence routes more than low-confidence lane conflicts.",
    });
  }

  if (!input.source.primaryAdoptionTarget && (input.routeConflict || input.confidence === "low")) {
    uniqueByField(questions, {
      field: "source.primaryAdoptionTarget",
      question: "If you had to choose one owner now, should this land in Discovery, Architecture, or Runtime?",
      whyItMatters: "Explicit ownership metadata is still the strongest structured tie-breaker in the routing model.",
      exampleAnswer: input.recommendedLaneId,
      predictedEffect: `Setting an owner will usually break the current tie in favor of ${input.recommendedLaneId}.`,
    });
  }

  if (runtimeInPlay && input.source.containsExecutableCode == null) {
    uniqueByField(questions, {
      field: "source.containsExecutableCode",
      question: "Does the source contain executable code or a repeated operational mechanism that should become reusable runtime capability?",
      whyItMatters: "This is the cleanest discriminator between Runtime and non-Runtime routes.",
      exampleAnswer: "true - includes callable code that should be reused",
      predictedEffect: "If yes, Runtime becomes much more likely; if no, Architecture or Discovery remain the honest owners.",
    });
  }

  if (architectureInPlay && input.source.improvesDirectiveWorkspace == null) {
    uniqueByField(questions, {
      field: "source.improvesDirectiveWorkspace",
      question: "Is the primary value improving Directive Workspace itself rather than a host/runtime capability?",
      whyItMatters: "This is the strongest Architecture-specific source signal.",
      exampleAnswer: "true - improves routing, evaluation, or workflow logic",
      predictedEffect: "If yes, Architecture usually becomes the clear owner; if no, Runtime/Discovery pressure stays live.",
    });
  }

  if (input.source.containsWorkflowPattern === true && !input.source.workflowBoundaryShape) {
    uniqueByField(questions, {
      field: "source.workflowBoundaryShape",
      question: "Is the workflow value a bounded protocol or an iterative loop?",
      whyItMatters: "Boundary shape clarifies whether the source is reusable Engine workflow logic or just generic process language.",
      exampleAnswer: "bounded_protocol",
      predictedEffect: "A bounded protocol tends to strengthen Architecture; an explicit iterative loop can keep Architecture and Runtime both in play but more honestly scoped.",
    });
  }

  if (!input.matchedGap && !input.source.capabilityGapId && input.openGaps.length > 0) {
    uniqueByField(questions, {
      field: "source.capabilityGapId",
      question: "Which currently open capability gap does this source close most directly?",
      whyItMatters: "A confirmed gap link raises gap alignment immediately and can remove low-confidence holds without adding more prose.",
      exampleAnswer: input.openGaps[0]?.gapId ?? null,
      predictedEffect: "A strong gap match often converts a weak route into a bounded recommendation.",
    });
  }

  if (!input.source.missionAlignmentHint) {
    uniqueByField(questions, {
      field: "source.missionAlignmentHint",
      question: "Give one sentence that ties this source directly to the mission objective.",
      whyItMatters: "A crisp alignment sentence raises mission-fit without pretending the source is more specific than it is.",
      exampleAnswer: "This improves directive workspace routing quality by clarifying bounded architecture ownership.",
      predictedEffect: "Usually hardens medium-confidence routes; it will not override strong source metadata on its own.",
    });
  }

  if (questions.length === 0) {
    return null;
  }

  return {
    summary: input.routeConflict
      ? "Answer one discriminating question to break the current lane disagreement."
      : "Add one or two explicit structured answers to raise routing confidence.",
    questions: questions.slice(0, 4),
  } satisfies DirectiveEngineFollowUpQuestionSet;
}
