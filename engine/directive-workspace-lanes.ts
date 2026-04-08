import type {
  DirectiveEngineLaneDefinition,
  DirectiveEngineLaneIntegrationPlanningInput,
  DirectiveEngineLanePlanningInput,
  DirectiveEngineLaneProofPlanningInput,
  DirectiveEngineLaneSet,
} from "./lane.ts";
import type { DirectiveEngineIntegrationProposal } from "./types.ts";

type DirectiveWorkspaceLaneId = "discovery" | "architecture" | "runtime";

type DirectiveWorkspaceLaneOverrides = Partial<
  Record<
    DirectiveWorkspaceLaneId,
    Partial<
      Pick<
        DirectiveEngineLaneDefinition,
        | "label"
        | "hostDependence"
        | "valuableWithoutHostRuntime"
        | "defaultIntegrationMode"
        | "handoffArtifactFamily"
        | "nextAction"
      >
    >
  >
>;

function buildDiscoveryProofPlan(
  input: DirectiveEngineLaneProofPlanningInput,
) {
  return {
    proofKind: "discovery_review",
    objective: `Confirm the source is captured and routed correctly against mission "${input.planningInput.mission.currentObjective}".`,
    requiredEvidence: [
      "mission-fit rationale recorded",
      "routing rationale recorded",
      "next bounded action chosen",
    ],
    requiredGates: [
      "routing_review",
      "human_decision_required",
    ],
    rollbackPrompt:
      "Keep the candidate in Discovery, downgrade confidence, or defer without integrating downstream work.",
  };
}

function buildArchitectureProofPlan(
  input: DirectiveEngineLaneProofPlanningInput,
) {
  const primaryImprovementGoal =
    input.improvementPlan.improvementGoals[0]
    ?? "improvement delta recorded";
  return {
    proofKind: "architecture_validation",
    objective:
      "Prove the extracted mechanism is adapted into product-owned operating code or engine logic without carrying source baggage forward blindly, "
      + `and that the proof boundary stays grounded in the staged improvement delta "${primaryImprovementGoal}".`,
    requiredEvidence: [
      "adapted mechanism described",
      "excluded baggage described",
      "engine or product boundary improvement explained",
      "improvement delta stays anchored to prior extraction, adaptation, and improvement stages",
    ],
    requiredGates: [
      "adaptation_complete",
      "improvement_complete",
      "engine_boundary_preserved",
      "decision_review",
    ],
    rollbackPrompt:
      "Keep the result at experiment status and do not integrate it into the engine until the staged proof boundary is clearer.",
  };
}

function buildRuntimeProofPlan(
  input: DirectiveEngineLaneProofPlanningInput,
) {
  if (input.planningInput.routingAssessment.scoreBreakdown.transformationSignal > 0) {
    return {
      proofKind: "runtime_transformation_proof",
      objective:
        "Prove the same capability can be operationalized with a better implementation shape while preserving intended behavior.",
      requiredEvidence: [
        "baseline artifact or metric",
        "result artifact or metric",
        "behavior-preserving claim",
        "rollback path",
      ],
      requiredGates: [
        "behavior_preservation",
        "metric_improvement_or_equivalent_value",
        "runtime_boundary_review",
      ],
      rollbackPrompt:
        "Revert to the baseline implementation and keep the candidate in follow-up status until proof is stronger.",
    };
  }

  return {
    proofKind: "runtime_runtime_proof",
    objective:
      "Prove the candidate can become a bounded callable capability with clear objective, evaluator, and rollback behavior.",
    requiredEvidence: [
      "runtime objective",
      "evaluation method",
      "rollback path",
      "host-integration boundary note",
    ],
    requiredGates: [
      "bounded_runtime_scope",
      "proof_artifact_present",
      "host_adapter_review",
    ],
    rollbackPrompt:
      "Keep the candidate at follow-up/prototype status and avoid promotion until runtime proof becomes concrete.",
  };
}

function buildArchitectureIntegrationProposal(
  input: DirectiveEngineLaneIntegrationPlanningInput,
): Partial<DirectiveEngineIntegrationProposal> {
  const primaryImprovementGoal =
    input.improvementPlan.improvementGoals[0]
    ?? "bounded improvement delta recorded";
  const primaryProofGate =
    input.proofPlan.requiredGates[0]
    ?? "proof boundary review";
  return {
    nextAction:
      `Materialize the adapted mechanism as engine-owned product logic only after the staged proof boundary `
      + `for "${primaryImprovementGoal}" remains explicit through ${primaryProofGate}.`,
  };
}

function createBaseLanes(): DirectiveEngineLaneDefinition[] {
  return [
    {
      laneId: "discovery",
      label: "Discovery",
      hostDependence: "engine_only",
      valuableWithoutHostRuntime: true,
      defaultIntegrationMode: "none",
      handoffArtifactFamily: "discovery_backlog",
      nextAction: "Keep the candidate in Discovery until routing clarity improves.",
      planProof: buildDiscoveryProofPlan,
    },
    {
      laneId: "architecture",
      label: "Architecture",
      hostDependence: "engine_only",
      valuableWithoutHostRuntime: true,
      defaultIntegrationMode: "adapt",
      handoffArtifactFamily: "architecture_adoption",
      nextAction:
        "Materialize the adapted mechanism as engine-owned product logic before any host-specific integration work.",
      planProof: buildArchitectureProofPlan,
      planIntegration: buildArchitectureIntegrationProposal,
    },
    {
      laneId: "runtime",
      label: "Runtime",
      hostDependence: "host_adapter_required",
      valuableWithoutHostRuntime: false,
      defaultIntegrationMode: "adapt",
      handoffArtifactFamily: "runtime_follow_up",
      nextAction:
        "Open a bounded Runtime follow-up and only involve host code through the engine adapter boundary.",
      planProof: buildRuntimeProofPlan,
    },
  ];
}

export function createDirectiveWorkspaceEngineLanes(input: {
  laneOverrides?: DirectiveWorkspaceLaneOverrides;
} = {}): DirectiveEngineLaneSet {
  const lanes = createBaseLanes().map((lane) => ({
    ...lane,
    ...(input.laneOverrides?.[lane.laneId as DirectiveWorkspaceLaneId] ?? {}),
  }));

  return {
    laneSetId: "directive-workspace",
    label: "Directive Workspace Engine Lanes",
    lanes,
  };
}
