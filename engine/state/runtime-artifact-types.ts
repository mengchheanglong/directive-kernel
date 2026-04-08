export type GenericRuntimeRecordArtifact =
  | {
      kind: "follow_up_review";
      candidateId: string;
      candidateName: string;
      currentStatus: string;
      runtimeRecordRelativePath: string;
      linkedFollowUpRecord: string;
      linkedRoutingPath: string | null;
      runtimeProofRelativePath: string | null;
      runtimeRuntimeCapabilityBoundaryPath: string | null;
      callableStubPath: null;
      sourceIntegrationRecordPath: null;
    }
  | {
      kind: "callable_integration_record";
      candidateId: string;
      candidateName: string;
      currentStatus: string;
      runtimeRecordRelativePath: string;
      linkedFollowUpRecord: null;
      linkedRoutingPath: null;
      runtimeProofRelativePath: string | null;
      runtimeRuntimeCapabilityBoundaryPath: string | null;
      callableStubPath: string | null;
      sourceIntegrationRecordPath: string | null;
    };

export type GenericRuntimeProofArtifact =
  | {
      kind: "follow_up_review";
      candidateId: string;
      candidateName: string;
      runtimeProofRelativePath: string;
      linkedRuntimeRecordPath: string;
      linkedFollowUpPath: string;
      linkedRoutingPath: string | null;
      promotionStatus: null;
      runtimeRuntimeCapabilityBoundaryPath: null;
      callableStubPath: null;
    }
  | {
      kind: "callable_integration";
      candidateId: string;
      candidateName: string;
      runtimeProofRelativePath: string;
      linkedRuntimeRecordPath: string;
      linkedFollowUpPath: null;
      linkedRoutingPath: null;
      promotionStatus: string | null;
      runtimeRuntimeCapabilityBoundaryPath: string | null;
      callableStubPath: string | null;
    };

export type GenericRuntimeRuntimeCapabilityBoundaryArtifact = {
  candidateId: string;
  title: string;
  runtimeRuntimeCapabilityBoundaryPath: string;
  linkedRuntimeProofPath: string | null;
  linkedRuntimeRecordPath: string | null;
  linkedCallableStubPath: string | null;
  currentProofStatus: string | null;
};

export type GenericRuntimePromotionReadinessArtifactBase = {
  candidateId: string;
  candidateName: string;
  promotionReadinessPath: string;
  linkedCapabilityBoundaryPath: string;
  linkedRuntimeProofPath: string | null;
  linkedRuntimeRecordPath: string | null;
  linkedCallableStubPath: string | null;
  proposedHost: string | null;
  executionState: string | null;
  currentStatus: string | null;
};

export type GenericLegacyRuntimeFollowUpArtifact = {
  candidateId: string;
  candidateName: string;
  followUpRelativePath: string;
  currentDecisionState: string | null;
  runtimeValueToOperationalize: string;
  proposedHost: string | null;
  proposedIntegrationMode: string | null;
  reentryContractPath: string | null;
  currentStatus: string;
  reviewCadence: string | null;
};

export type GenericLegacyRuntimeHandoffArtifact = {
  candidateId: string;
  candidateName: string;
  handoffRelativePath: string;
  runtimeValueToOperationalize: string;
  proposedHost: string | null;
  proposedRuntimeSurface: string;
  originatingArchitectureRecordPath: string | null;
  runtimeFollowUpPath: string | null;
  runtimeRecordPath: string | null;
  runtimeProofPath: string | null;
  promotionRecordPath: string | null;
  registryEntryPath: string | null;
};

export type GenericLegacyRuntimeRecordArtifact = {
  candidateId: string;
  candidateName: string;
  runtimeRecordRelativePath: string;
  originPath: string | null;
  linkedFollowUpPath: string | null;
  runtimeObjective: string;
  proposedHost: string | null;
  proposedRuntimeSurface: string | null;
  executionSlice: string | null;
  currentStatus: string;
  nextDecisionPoint: string | null;
};

export type GenericLegacyRuntimeSliceProofArtifact = {
  candidateId: string;
  candidateName: string;
  runtimeSliceProofRelativePath: string;
  proofDate: string | null;
  linkedRuntimeRecordPath: string | null;
  linkedExecutionRecordPath: string | null;
  primaryHostChecker: string | null;
  promotionProfileFamily: string | null;
  result: string | null;
};

export type GenericLegacyRuntimeSliceExecutionArtifact = {
  candidateId: string;
  candidateName: string;
  runtimeSliceExecutionRelativePath: string;
  executionDate: string | null;
  linkedRuntimeProofPath: string | null;
  status: string | null;
};

export type GenericLegacyRuntimeProofChecklistArtifact = {
  candidateId: string;
  candidateName: string;
  proofChecklistRelativePath: string;
  generatedAt: string | null;
  linkedRuntimeRecordPath: string | null;
  linkedRuntimeProofPath: string | null;
  linkedSupplementalProofPath: string | null;
  gateSnapshotPath: string | null;
  status: string | null;
};

export type GenericLegacyRuntimeLiveFetchProofArtifact = {
  candidateId: string;
  candidateName: string;
  liveFetchProofRelativePath: string;
  proofDate: string | null;
  linkedRuntimeRecordPath: string | null;
  linkedProofChecklistPath: string | null;
  gateSnapshotPath: string | null;
  result: string | null;
};

export type GenericLegacyRuntimeLiveFetchGateSnapshotArtifact = {
  candidateId: string;
  candidateName: string;
  gateSnapshotRelativePath: string;
  generatedAt: string | null;
  workflowSurface: string | null;
  deliveryTarget: string | null;
  linkedLiveFetchProofPath: string | null;
};

export type GenericLegacyRuntimeLivePoolArtifact = {
  candidateId: string;
  candidateName: string;
  livePoolRelativePath: string;
  artifactType: string | null;
  generatedAt: string | null;
  degraded: boolean;
  evidenceQualityResult: string | null;
  deliveryTarget: string | null;
  withheldDelivery: boolean | null;
  linkedGateSnapshotPath: string | null;
  linkedLiveFetchProofPath: string | null;
};

export type GenericLegacyRuntimeSamplePoolArtifact = {
  candidateId: string;
  candidateName: string;
  samplePoolRelativePath: string;
  artifactType: string | null;
  generatedAt: string | null;
  degraded: boolean;
  evidenceQualityResult: string | null;
  deliveryTarget: string | null;
  withheldDelivery: boolean | null;
};

export type GenericLegacyRuntimeSystemBundleArtifact = {
  candidateId: string;
  candidateName: string;
  systemBundleRelativePath: string;
  bundleDate: string | null;
  owner: string | null;
  status: string | null;
  decisionState: string | null;
  adoptionTarget: string | null;
  nextStep: string | null;
};

export type GenericLegacyRuntimeValidationNoteArtifact = {
  candidateId: string;
  candidateName: string;
  validationNoteRelativePath: string;
  noteDate: string | null;
  mode: string | null;
  verdict: string | null;
  blocker: string | null;
};

export type GenericLegacyRuntimePreconditionDecisionNoteArtifact = {
  candidateId: string;
  candidateName: string;
  noteRelativePath: string;
  noteKind: "precondition_proof" | "precondition_correction" | "host_adapter_decision";
  noteDate: string | null;
  status: string | null;
  linkedFollowUpPath: string | null;
};

export type GenericLegacyRuntimeTransformationRecordArtifact = {
  candidateId: string;
  candidateName: string;
  transformationRecordRelativePath: string;
  recordDate: string | null;
  transformationType: string;
  discoveryIntakePath: string | null;
  baselineArtifactPath: string | null;
  resultArtifactPath: string | null;
  adoptionTarget: string | null;
  promotionRecordPath: string | null;
};

export type GenericLegacyRuntimeTransformationProofArtifact = {
  candidateId: string;
  transformationProofRelativePath: string;
  generatedAt: string | null;
  transformationType: string | null;
  metric: string | null;
  linkedTransformationRecordPath: string | null;
};

export type GenericLegacyRuntimeRegistryArtifact = {
  candidateId: string;
  candidateName: string;
  registryEntryRelativePath: string;
  linkedPromotionRecordPath: string | null;
  proofArtifactPath: string | null;
  proposedHost: string | null;
  runtimeSurface: string | null;
  runtimeStatus: string;
  registryAcceptanceGateVersion: string | null;
};

export type GenericLegacyRuntimePromotionRecordArtifact = {
  candidateId: string;
  candidateName: string;
  promotionRecordRelativePath: string;
  linkedRuntimeRecordPath: string | null;
  sourceIntentArtifactPath: string | null;
  proofArtifactPath: string | null;
  targetHost: string | null;
  targetRuntimeSurface: string | null;
  proposedRuntimeStatus: string;
};
