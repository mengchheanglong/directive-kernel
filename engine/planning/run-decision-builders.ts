import type {
  DirectiveEngineCandidate,
  DirectiveEngineDecision,
  DirectiveEngineIntegrationProposal,
  DirectiveEngineSelectedLane,
} from "../types.ts";
import type { DirectiveEngineLaneDefinition } from "../lane.ts";

function buildDecision(input: {
  laneDefinition: DirectiveEngineLaneDefinition;
  lane: DirectiveEngineSelectedLane;
  candidate: DirectiveEngineCandidate;
  integrationProposal: DirectiveEngineIntegrationProposal;
}): DirectiveEngineDecision {
  let decisionState: DirectiveEngineDecision["decisionState"];
  if (input.candidate.requiresHumanReview) {
    decisionState = "needs_human_review";
  } else {
    decisionState =
      input.laneDefinition.defaultDecisionState
      ?? (input.lane.laneId === "discovery"
        ? "hold_in_discovery"
        : input.lane.laneId === "architecture"
          ? "accept_for_architecture"
          : "route_to_runtime_follow_up");
  }

  const requiresHumanApproval =
    input.candidate.requiresHumanReview
    || input.integrationProposal.requiresHumanReview;

  return {
    decisionState,
    adoptionTargetLaneId: input.lane.laneId,
    adoptionTargetLaneLabel: input.lane.label,
    requiresHumanApproval,
    summary:
      decisionState === "needs_human_review"
        ? `Preliminary engine decision: needs_human_review for ${input.lane.label}; the route is bounded but must be reviewed explicitly before downstream adoption.`
        : requiresHumanApproval
          ? `Preliminary engine decision: ${decisionState} for ${input.lane.label}${input.candidate.requiresHumanReview ? " with additional human review required" : ""}, pending human approval before final adoption.`
          : input.lane.laneId === "discovery"
            ? `Preliminary engine decision: ${decisionState} for ${input.lane.label}; the source is held in Discovery without opening a separate manual approval step.`
            : `Preliminary engine decision: ${decisionState} for ${input.lane.label}; the route is bounded strongly enough to proceed without an additional manual approval gate.`,
    rationale: [
      ...input.candidate.rationale,
      input.integrationProposal.nextAction,
    ],
  };
}

export {
  buildDecision,
};
