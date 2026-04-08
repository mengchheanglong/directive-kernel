import type {
  DirectiveEngineAdaptationPlan,
  DirectiveEngineCapabilityGap,
  DirectiveEngineExtractionPlan,
  DirectiveEngineHostDependence,
  DirectiveEngineImprovementPlan,
  DirectiveEngineIntegrationMode,
  DirectiveEngineIntegrationProposal,
  DirectiveEngineLaneId,
  DirectiveEngineMissionContext,
  DirectiveEngineProofPlan,
  DirectiveEngineRoutingAssessment,
  DirectiveEngineSourceItem,
  DirectiveEngineUsefulnessLevel,
} from "./types.ts";

export type DirectiveEngineLaneDefinition = {
  laneId: DirectiveEngineLaneId;
  label: string;
  hostDependence: DirectiveEngineHostDependence;
  valuableWithoutHostRuntime: boolean;
  defaultIntegrationMode: DirectiveEngineIntegrationMode;
  handoffArtifactFamily: string;
  nextAction: string;
  planProof?: (
    input: DirectiveEngineLaneProofPlanningInput,
  ) => DirectiveEngineProofPlan;
  planIntegration?: (
    input: DirectiveEngineLaneIntegrationPlanningInput,
  ) => Partial<DirectiveEngineIntegrationProposal>;
};

export type DirectiveEngineLanePlanningInput = {
  source: DirectiveEngineSourceItem;
  mission: DirectiveEngineMissionContext;
  openGaps: DirectiveEngineCapabilityGap[];
  candidateId: string;
  receivedAt: string;
  routingAssessment: DirectiveEngineRoutingAssessment;
  lane: DirectiveEngineLaneDefinition;
};

export type DirectiveEngineLaneUsefulnessPlanningInput = {
  planningInput: DirectiveEngineLanePlanningInput;
  extractionPlan: DirectiveEngineExtractionPlan;
  adaptationPlan: DirectiveEngineAdaptationPlan;
  improvementPlan: DirectiveEngineImprovementPlan;
};

export type DirectiveEngineLaneProofPlanningInput = {
  planningInput: DirectiveEngineLanePlanningInput;
  extractionPlan: DirectiveEngineExtractionPlan;
  adaptationPlan: DirectiveEngineAdaptationPlan;
  improvementPlan: DirectiveEngineImprovementPlan;
};

export type DirectiveEngineLaneIntegrationPlanningInput = {
  planningInput: DirectiveEngineLanePlanningInput;
  extractionPlan: DirectiveEngineExtractionPlan;
  adaptationPlan: DirectiveEngineAdaptationPlan;
  improvementPlan: DirectiveEngineImprovementPlan;
  proofPlan: DirectiveEngineProofPlan;
};

export type DirectiveEngineLaneSet = {
  laneSetId: string;
  label: string;
  lanes: DirectiveEngineLaneDefinition[];
  refineUsefulness?: (input: DirectiveEngineLaneUsefulnessPlanningInput) => DirectiveEngineUsefulnessLevel;
};

export function resolveDirectiveEngineLane(input: {
  laneSet: DirectiveEngineLaneSet;
  laneId: DirectiveEngineLaneId;
}): DirectiveEngineLaneDefinition {
  const lane = input.laneSet.lanes.find((item) => item.laneId === input.laneId);
  if (!lane) {
    throw new Error(
      `directive_engine_lane_set_invalid: missing lane definition for ${input.laneId}`,
    );
  }
  return lane;
}

export function listDirectiveEngineLanes(laneSet: DirectiveEngineLaneSet) {
  return [...laneSet.lanes];
}
