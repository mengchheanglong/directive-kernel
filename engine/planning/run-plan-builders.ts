import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildDefaultAdaptationPlan,
  buildDefaultExtractionPlan,
  buildDefaultImprovementPlan,
} from "./lane-planning-defaults.ts";
import type {
  DirectiveEngineAdaptationPlan,
  DirectiveEngineDecision,
  DirectiveEngineIntegrationMode,
  DirectiveEngineIntegrationProposal,
  DirectiveEngineImprovementPlan,
  DirectiveEngineProofPlan,
  DirectiveEngineReportPlan,
  DirectiveEngineSelectedLane,
} from "../types.ts";
import type {
  DirectiveEngineLaneAdaptationPlanningInput,
  DirectiveEngineLaneExtractionPlanningInput,
  DirectiveEngineLaneImprovementPlanningInput,
  DirectiveEngineLaneIntegrationPlanningInput,
  DirectiveEngineLaneProofPlanningInput,
} from "../lane.ts";
import { buildDirectiveRuntimePromotionAssistanceReport } from "../../runtime/lib/control/runtime-promotion-assistance.ts";
import { buildRuntimeCallableExecutionEvidenceReport } from "../../runtime/lib/control/runtime-callable-execution-evidence.ts";

const DIRECTIVE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type DirectiveEngineRuntimePromotionFeedbackSignal =
  NonNullable<DirectiveEngineLaneImprovementPlanningInput["runtimePromotionFeedbackSignal"]>;

type DirectiveEngineRuntimeExecutionEvidenceSignal =
  NonNullable<DirectiveEngineLaneImprovementPlanningInput["runtimeExecutionEvidenceSignal"]>;

function deriveIntegrationMode(input: {
  source: DirectiveEngineLaneIntegrationPlanningInput["planningInput"]["source"];
  defaultIntegrationMode: DirectiveEngineIntegrationMode;
  valuableWithoutHostRuntime: boolean;
}): DirectiveEngineIntegrationMode {
  if (input.defaultIntegrationMode === "none") {
    return "none";
  }

  if (!input.valuableWithoutHostRuntime) {
    if (
      input.source.sourceType === "github-repo"
      || input.source.sourceType === "external-system"
    ) {
      return "reimplement";
    }
  }

  return input.defaultIntegrationMode;
}

function buildDefaultProofPlan(
  input: DirectiveEngineLaneProofPlanningInput,
): DirectiveEngineProofPlan {
  const primaryImprovementGoal =
    input.improvementPlan.improvementGoals[0]
    ?? "bounded improvement delta recorded";
  return {
    proofKind: `${input.planningInput.lane.laneId}_proof`,
    objective:
      `Prove the ${input.planningInput.lane.label} path is safe, bounded, and useful under the current mission, `
      + `while keeping the proof boundary grounded in the staged improvement goal "${primaryImprovementGoal}".`,
    requiredEvidence: [
      "lane rationale recorded",
      "bounded next action recorded",
      "proof owner identified",
      "improvement delta stays anchored to prior stage output",
    ],
    requiredGates: [
      "scope_review",
      "boundary_review",
      "rollback_review",
    ],
    rollbackPrompt:
      "Keep the candidate at its current state and avoid downstream integration until the proof boundary is clearer.",
  };
}

function buildExtractionPlan(
  input: DirectiveEngineLaneExtractionPlanningInput["planningInput"],
) {
  return input.lane.planExtraction?.({ planningInput: input })
    ?? buildDefaultExtractionPlan({ planningInput: input });
}

function buildAdaptationPlan(
  input: DirectiveEngineLaneAdaptationPlanningInput,
): DirectiveEngineAdaptationPlan {
  return input.planningInput.lane.planAdaptation?.(input)
    ?? buildDefaultAdaptationPlan(input);
}

function readRuntimePromotionFeedbackSignal():
  | DirectiveEngineRuntimePromotionFeedbackSignal
  | null {
  try {
    const assistance = buildDirectiveRuntimePromotionAssistanceReport();
    const validatedManualPromotionCycles =
      assistance.manualRuntimePromotionCycles.validatedLocallyCount;
    if (
      validatedManualPromotionCycles < 2
      || !assistance.topRecommendation
    ) {
      return null;
    }

    const externalHostPressure =
      assistance.topRecommendation.recommendedActionKind
      === "keep_parked_external_host_candidate";
    const repoNativeHostPressure =
      assistance.topRecommendation.hostScope === "directive_workspace_host"
      && (
        assistance.topRecommendation.recommendedActionKind
          === "request_manual_promotion_seam_decision"
        || assistance.topRecommendation.recommendedActionKind
          === "clarify_repo_native_host_target"
      );
    const callableBoundaryPressure =
      assistance.topRecommendation.recommendedActionKind
        === "clarify_callable_boundary";
    const hostTargetClarityPressure =
      repoNativeHostPressure
      || assistance.topRecommendation.recommendedActionKind
        === "clarify_repo_native_host_target";
    const summary = externalHostPressure
      ? `Runtime promotion evidence signal: ${validatedManualPromotionCycles} validated manual promotion cycles exist, and the strongest remaining pre-host-ready candidate still stays parked because its proposed host is external.`
      : repoNativeHostPressure
        ? `Runtime promotion evidence signal: ${validatedManualPromotionCycles} validated manual promotion cycles exist, and the current top recommendation is "${assistance.topRecommendation.recommendedActionKind}" for ${assistance.topRecommendation.candidateId} with a repo-native host target.`
        : `Runtime promotion evidence signal: ${validatedManualPromotionCycles} validated manual promotion cycles exist, and the current top recommendation is "${assistance.topRecommendation.recommendedActionKind}" for ${assistance.topRecommendation.candidateId}.`;

    return {
      summary,
      integrationHint: externalHostPressure
        ? "Use promotion assistance only as a reviewable soft signal; prefer explicit repo-native host targeting before any later promotion follow-through."
        : hostTargetClarityPressure
          ? "Use promotion assistance only as a reviewable soft signal; keep explicit host-target clarity before any later promotion follow-through."
          : callableBoundaryPressure
            ? "Use promotion assistance only as a reviewable soft signal; keep explicit callable-boundary clarity before any later promotion follow-through."
            : "Use promotion assistance only as a reviewable soft signal before any later promotion follow-through.",
      improvementHint: externalHostPressure || hostTargetClarityPressure
        ? "Improve host-target clarity before suggesting promotion follow-through for new Runtime candidates."
        : callableBoundaryPressure
          ? "Improve callable-boundary clarity before suggesting promotion follow-through for new Runtime candidates."
          : "Reuse promotion assistance as a soft planning signal instead of manual reinspection.",
    };
  } catch {
    return null;
  }
}

function readRuntimeExecutionEvidenceSignal():
  | DirectiveEngineRuntimeExecutionEvidenceSignal
  | null {
  try {
    const evidence = buildRuntimeCallableExecutionEvidenceReport({
      directiveRoot: DIRECTIVE_ROOT,
    });
    if (evidence.totalExecutionRecords < 2) {
      return null;
    }

    const latestFailure = evidence.failurePatterns[evidence.failurePatterns.length - 1] ?? null;
    const nonSuccessLabel = evidence.nonSuccessCount === 1
      ? "non-success result"
      : "non-success results";
    const summary = latestFailure
      ? `Runtime callable execution evidence signal: ${evidence.totalExecutionRecords} bounded execution records exist across ${evidence.capabilityCount} capabilities, and ${evidence.nonSuccessCount} ${nonSuccessLabel} ${evidence.nonSuccessCount === 1 ? "is" : "are"} already captured as ${latestFailure.status} for ${latestFailure.capabilityId}.`
      : `Runtime callable execution evidence signal: ${evidence.totalExecutionRecords} bounded execution records exist across ${evidence.capabilityCount} capabilities, all currently successful.`;

    return {
      summary,
      integrationHint: latestFailure
        ? "Use callable execution evidence only as a reviewable soft signal; keep explicit failure-pattern review before widening host consumption or broader Runtime surface claims."
        : "Use callable execution evidence only as a reviewable soft signal before widening host consumption or broader Runtime surface claims.",
      improvementHint: latestFailure
        ? `Improve callable input-boundary clarity where bounded execution evidence already shows ${latestFailure.status} patterns.`
        : "Reuse bounded callable execution evidence as a soft planning signal instead of re-arguing runtime viability from scratch.",
    };
  } catch {
    return null;
  }
}

function buildImprovementPlan(
  input: DirectiveEngineLaneImprovementPlanningInput,
): DirectiveEngineImprovementPlan {
  return input.planningInput.lane.planImprovement?.(input)
    ?? buildDefaultImprovementPlan(input);
}

function buildIntegrationProposal(
  input: DirectiveEngineLaneIntegrationPlanningInput,
  runtimePromotionFeedbackSignal?: DirectiveEngineRuntimePromotionFeedbackSignal | null,
  runtimeExecutionEvidenceSignal?: DirectiveEngineRuntimeExecutionEvidenceSignal | null,
): DirectiveEngineIntegrationProposal {
  const integrationMode = deriveIntegrationMode({
    source: input.planningInput.source,
    defaultIntegrationMode: input.planningInput.lane.defaultIntegrationMode,
    valuableWithoutHostRuntime: input.planningInput.lane.valuableWithoutHostRuntime,
  });

  const base: DirectiveEngineIntegrationProposal = {
    targetLaneId: input.planningInput.lane.laneId,
    targetLaneLabel: input.planningInput.lane.label,
    integrationMode,
    hostDependence: input.planningInput.lane.hostDependence,
    valuableWithoutHostRuntime: input.planningInput.lane.valuableWithoutHostRuntime,
    handoffArtifactFamily: input.planningInput.lane.handoffArtifactFamily,
    nextAction:
      input.planningInput.lane.laneId === "runtime"
        ? [
            input.planningInput.lane.nextAction,
            runtimePromotionFeedbackSignal?.integrationHint,
            runtimeExecutionEvidenceSignal?.integrationHint,
          ]
            .filter(Boolean)
            .join(" ")
        : input.planningInput.lane.nextAction,
    requiresHumanReview: input.planningInput.routingAssessment.needsHumanReview,
  };

  const overrides = input.planningInput.lane.planIntegration?.(input) ?? {};
  return {
    ...base,
    ...overrides,
  };
}

function buildReportPlan(input: {
  lane: DirectiveEngineSelectedLane;
  decision: DirectiveEngineDecision;
  integrationProposal: DirectiveEngineIntegrationProposal;
  usefulnessRationale: string;
}): DirectiveEngineReportPlan {
  const reportKind =
    input.lane.laneId === "discovery"
      ? "discovery_routing_report"
      : input.lane.laneId === "architecture"
        ? "architecture_adaptation_report"
        : "runtime_follow_up_report";

  const requiredDestinations = [
    "directive_workspace_record",
    "directive_workspace_report_sync",
  ];

  if (input.integrationProposal.hostDependence === "host_adapter_required") {
    requiredDestinations.push("host_adapter_report");
  }

  return {
    reportKind,
    summary:
      `Sync the ${input.decision.decisionState} decision and ${input.integrationProposal.integrationMode} integration plan into Directive Workspace reporting surfaces. Usefulness rationale: ${input.usefulnessRationale}`,
    usefulnessRationale: input.usefulnessRationale,
    requiredDestinations,
    syncRequired: true,
  };
}

export {
  buildAdaptationPlan,
  buildDefaultProofPlan,
  buildExtractionPlan,
  buildImprovementPlan,
  buildIntegrationProposal,
  buildReportPlan,
  readRuntimeExecutionEvidenceSignal,
  readRuntimePromotionFeedbackSignal,
};
