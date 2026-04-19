import type {
  DirectiveEngineCapabilityGap,
  DirectiveEngineMissionContext,
  DirectiveEngineRoutingConfidence,
  DirectiveEngineSourceItem,
} from "../types.ts";
import type { DirectiveMissionHealthAssessment } from "../mission/mission-health.ts";
import type { DirectiveSourceNarrativeContext } from "./source-narrative-threading.ts";

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
  strategy: "keep" | "replace" = "keep",
) {
  const existingIndex = questions.findIndex((entry) => entry.field === question.field);
  if (existingIndex === -1) {
    questions.push(question);
    return;
  }
  if (strategy === "replace") {
    questions[existingIndex] = question;
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
  narrativeContext: DirectiveSourceNarrativeContext;
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

  const primaryThread = input.narrativeContext?.primaryThread ?? null;
  if (primaryThread) {
    const runtimeDemand = primaryThread.demandSignals.find((signal) =>
      signal.kind === "lane_validation" && signal.requestedLaneId === "runtime"
    );
    if (runtimeDemand && input.source.containsExecutableCode == null) {
      uniqueByField(questions, {
        field: "source.containsExecutableCode",
        question: `Does this source add runtime validation to the "${primaryThread.name}" thread by contributing callable code or a repeated operational mechanism?`,
        whyItMatters: runtimeDemand.summary,
        exampleAnswer: "true - it adds a repeated executable mechanism the thread did not have before",
        predictedEffect: `A yes answer would add the missing runtime evidence the "${primaryThread.name}" thread currently lacks.`,
      }, "replace");
    }

    const architectureDemand = primaryThread.demandSignals.find((signal) =>
      signal.kind === "lane_validation" && signal.requestedLaneId === "architecture"
    );
    if (architectureDemand && input.source.improvesDirectiveWorkspace == null) {
      uniqueByField(questions, {
        field: "source.improvesDirectiveWorkspace",
        question: `Does this source clarify the reusable workflow boundary inside the "${primaryThread.name}" thread, rather than only adding runtime execution value?`,
        whyItMatters: architectureDemand.summary,
        exampleAnswer: "true - it clarifies architecture-owned workflow logic and review boundaries",
        predictedEffect: `A yes answer would add the missing architecture evidence the "${primaryThread.name}" thread currently lacks.`,
      }, "replace");
    }

    const gapClosureDemand = primaryThread.demandSignals.find((signal) =>
      signal.kind === "gap_closure"
    );
    if (gapClosureDemand && !input.source.capabilityGapId) {
      uniqueByField(questions, {
        field: "source.capabilityGapId",
        question: `Does this source materially move the "${primaryThread.name}" thread closer to closing ${primaryThread.gapCoverage.dominantGapId ?? "its recurring gap"}?`,
        whyItMatters: gapClosureDemand.summary,
        exampleAnswer: primaryThread.gapCoverage.dominantGapId,
        predictedEffect: "A confirmed gap link turns thread momentum into explicit gap-closing evidence instead of another loose related source.",
      }, "replace");
    }
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
