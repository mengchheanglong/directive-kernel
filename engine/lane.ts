import type {
  EngineAdaptationPlan,
  EngineCapabilityGap,
  EngineDecisionState,
  EngineExtractionPlan,
  EngineHostDependence,
  EngineImprovementPlan,
  EngineIntegrationMode,
  EngineIntegrationProposal,
  EngineLaneId,
  EngineMissionContext,
  EngineProofPlan,
  EngineRoutingAssessment,
  EngineSourceItem,
  EngineUsefulnessLevel,
} from "./types.ts";

export type EngineLaneDefinition = {
  laneId: EngineLaneId;
  label: string;
  hostDependence: EngineHostDependence;
  valuableWithoutHostRuntime: boolean;
  defaultIntegrationMode: EngineIntegrationMode;
  handoffArtifactFamily: string;
  nextAction: string;
  defaultDecisionState?: EngineDecisionState;
  planExtraction?: (
    input: EngineLaneExtractionPlanningInput,
  ) => EngineExtractionPlan;
  planAdaptation?: (
    input: EngineLaneAdaptationPlanningInput,
  ) => EngineAdaptationPlan;
  planImprovement?: (
    input: EngineLaneImprovementPlanningInput,
  ) => EngineImprovementPlan;
  planProof?: (
    input: EngineLaneProofPlanningInput,
  ) => EngineProofPlan;
  planIntegration?: (
    input: EngineLaneIntegrationPlanningInput,
  ) => Partial<EngineIntegrationProposal>;
};

export type EngineLanePlanningInput = {
  source: EngineSourceItem;
  mission: EngineMissionContext;
  openGaps: EngineCapabilityGap[];
  candidateId: string;
  receivedAt: string;
  routingAssessment: EngineRoutingAssessment;
  lane: EngineLaneDefinition;
};

export type EngineLaneUsefulnessPlanningInput = {
  planningInput: EngineLanePlanningInput;
  extractionPlan: EngineExtractionPlan;
  adaptationPlan: EngineAdaptationPlan;
  improvementPlan: EngineImprovementPlan;
};

export type EngineLaneExtractionPlanningInput = {
  planningInput: EngineLanePlanningInput;
};

export type EngineLaneAdaptationPlanningInput = {
  planningInput: EngineLanePlanningInput;
  extractionPlan: EngineExtractionPlan;
};

export type EngineLaneImprovementPlanningInput = {
  planningInput: EngineLanePlanningInput;
  extractionPlan: EngineExtractionPlan;
  adaptationPlan: EngineAdaptationPlan;
  runtimePromotionFeedbackSignal?: {
    summary: string;
    integrationHint: string;
    improvementHint: string;
  } | null;
  runtimeExecutionEvidenceSignal?: {
    summary: string;
    integrationHint: string;
    improvementHint: string;
  } | null;
};

export type EngineLaneProofPlanningInput = {
  planningInput: EngineLanePlanningInput;
  extractionPlan: EngineExtractionPlan;
  adaptationPlan: EngineAdaptationPlan;
  improvementPlan: EngineImprovementPlan;
};

export type EngineLaneIntegrationPlanningInput = {
  planningInput: EngineLanePlanningInput;
  extractionPlan: EngineExtractionPlan;
  adaptationPlan: EngineAdaptationPlan;
  improvementPlan: EngineImprovementPlan;
  proofPlan: EngineProofPlan;
};

export type EngineLaneSet = {
  laneSetId: string;
  label: string;
  lanes: EngineLaneDefinition[];
  refineUsefulness?: (input: EngineLaneUsefulnessPlanningInput) => EngineUsefulnessLevel;
};

export function resolveEngineLane(input: {
  laneSet: EngineLaneSet;
  laneId: EngineLaneId;
}): EngineLaneDefinition {
  const lane = input.laneSet.lanes.find((item) => item.laneId === input.laneId);
  if (!lane) {
    throw new Error(
      `directive_engine_lane_set_invalid: missing lane definition for ${input.laneId}`,
    );
  }
  return lane;
}

export function listEngineLanes(laneSet: EngineLaneSet) {
  return [...laneSet.lanes];
}
