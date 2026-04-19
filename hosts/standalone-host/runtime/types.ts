import type { DirectiveRuntimeCallableExecutionRunResult } from "../../../runtime/core/callable-execution.ts";
import type { RuntimeHostCallableAdapterDescriptor } from "../../../runtime/lib/host/runtime-host-callable-adapter-contract.ts";

export type StandaloneRuntimeOverviewEntry = {
  kind:
    | "follow_up"
    | "record"
    | "proof_bundle"
    | "transformation_record"
    | "transformation_proof"
    | "promotion_record"
    | "registry_entry";
  path: string;
  title: string | null;
  candidateId: string | null;
  candidateName: string | null;
  status: string | null;
};

export type StandaloneRuntimeOverviewSummary = {
  followUpCount: number;
  recordCount: number;
  proofBundleCount: number;
  transformationRecordCount: number;
  transformationProofCount: number;
  promotionRecordCount: number;
  registryEntryCount: number;
  recentEntries: StandaloneRuntimeOverviewEntry[];
};

export type StandaloneScientifyToolDescriptor = {
  tool: string;
  functionName: string;
  modulePath: string;
};

export type StandaloneLiveMiniSweCallableBoundaryDescriptor = {
  inputShape: string[];
  outputShape: string[];
  description: string;
  safetyRules: string[];
};

export type StandaloneScientifyBundleDescriptor = {
  candidateId: string;
  candidateName: string;
  hostSurface: string;
  currentStage: string;
  nextLegalStep: string;
  proposedHost: string | null;
  executionState: string | null;
  promotionReadinessBlockers: string[];
  prePromotionSlicePath: string;
  implementationSlicePath: string;
  artifactPath: string;
  linkedArtifacts: {
    runtimeRecordPath: string | null;
    runtimeProofPath: string | null;
    runtimeCapabilityBoundaryPath: string | null;
    runtimePromotionReadinessPath: string | null;
    runtimePromotionRecordPath: string | null;
    runtimePromotionSpecificationPath: string | null;
    runtimeCallableStubPath: string | null;
  };
  adapter: {
    adapterId: string;
    loadMode: "read_promotion_specification_only";
    compileContractArtifact: string;
    promotionSpecificationPath: string;
    callableStubPath: string | null;
    integrationMode: string | null;
    targetRuntimeSurface: string | null;
    requiredGates: string[];
    openDecisions: string[];
    hostConsumableDescription: string;
  };
  tools: StandaloneScientifyToolDescriptor[];
  runtimeOwnedBoundary: string[];
  standaloneHostOwnedBoundary: string[];
};

export type StandaloneScientifyHostInvocationRequest = {
  tool: StandaloneScientifyToolDescriptor["tool"];
  input: Record<string, unknown>;
  timeoutMs?: number;
  executionAt?: string;
  persistArtifacts?: boolean;
};

export type StandaloneScientifyHostInvocationResult = {
  candidateId: string;
  candidateName: string;
  hostSurface: string;
  currentStage: string;
  proposedHost: string | null;
  linkedArtifacts: StandaloneScientifyBundleDescriptor["linkedArtifacts"];
  adapter: {
    adapterId: string;
    invokeSurface: "standalone_host_runtime_scientify_invoke";
    compileContractArtifact: string;
    promotionSpecificationPath: string;
    callableStubPath: string | null;
    runtimeExecutorSurface: "runtime/core/callable-execution.ts";
    runtimeInternalsBypassed: false;
    hostIntegrated: true;
    promotionAutomation: false;
    automaticWorkflowAdvancement: false;
  };
  hostCallableAdapter: RuntimeHostCallableAdapterDescriptor;
  execution: DirectiveRuntimeCallableExecutionRunResult;
};

export type StandaloneScientifyHostConsumptionReport = {
  reportVersion: "standalone_scientify_host_consumption_report/v1";
  generatedAt: string;
  candidateId: string;
  candidateName: string;
  hostName: string;
  hostSurface: string;
  invokeSurface: string;
  promotionRecordPath: string;
  promotionSpecificationPath: string;
  callableStubPath: string | null;
  registryEntryPath?: string;
  executionSurface: string;
  sampleInvocation: {
    tool: string;
    status: string;
    persistArtifacts: boolean;
    returned: number | null;
    topTitle: string | null;
  };
  acceptance: {
    consumableThroughHost: boolean;
    runtimeInternalsBypassed: boolean;
    hostIntegrated: boolean;
    promotionAutomation: boolean;
    automaticWorkflowAdvancement: boolean;
  };
  hostCallableAdapter: RuntimeHostCallableAdapterDescriptor;
  proof: {
    primaryChecker: string;
    supportingCheckers: string[];
  };
  stopLine: string;
};

export type StandaloneLiveMiniSweAgentDescriptor = {
  candidateId: string;
  candidateName: string;
  hostSurface: string;
  currentStage: string;
  nextLegalStep: string;
  proposedHost: string | null;
  executionState: string | null;
  promotionReadinessBlockers: string[];
  prePromotionSlicePath: string;
  implementationSlicePath: string;
  artifactPath: string;
  linkedArtifacts: {
    runtimeRecordPath: string | null;
    runtimeProofPath: string | null;
    runtimeCapabilityBoundaryPath: string | null;
    runtimePromotionReadinessPath: string | null;
    runtimePromotionRecordPath: string | null;
    runtimePromotionSpecificationPath: string | null;
    runtimeCallableStubPath: string | null;
  };
  adapter: {
    adapterId: string;
    loadMode: "read_promotion_specification_only";
    compileContractArtifact: string;
    promotionSpecificationPath: string;
    callableStubPath: string | null;
    integrationMode: string | null;
    targetRuntimeSurface: string | null;
    requiredGates: string[];
    openDecisions: string[];
    hostConsumableDescription: string;
  };
  callableBoundary: StandaloneLiveMiniSweCallableBoundaryDescriptor;
  runtimeOwnedBoundary: string[];
  standaloneHostOwnedBoundary: string[];
};

export type StandaloneResearchVaultDescriptor = {
  candidateId: string;
  candidateName: string;
  hostSurface: string;
  currentStage: string;
  nextLegalStep: string;
  originalProposedHost: string | null;
  resolvedHost: string;
  resolutionDecision: string;
  executionState: string | null;
  artifactPath: string;
  linkedArtifacts: {
    runtimeRecordPath: string | null;
    runtimeProofPath: string | null;
    runtimeCapabilityBoundaryPath: string | null;
    runtimePromotionReadinessPath: string | null;
    runtimePromotionRecordPath: string | null;
    runtimePromotionSpecificationPath: string | null;
    runtimeHostSelectionResolutionPath: string;
    runtimeCallableStubPath: string | null;
  };
  adapter: {
    adapterId: string;
    loadMode: "read_promotion_record_and_specification_only";
    compileContractArtifact: string;
    promotionRecordPath: string;
    promotionSpecificationPath: string;
    hostSelectionResolutionPath: string;
    integrationMode: string | null;
    targetRuntimeSurface: string | null;
    requiredGates: string[];
    openDecisions: string[];
    hostConsumableDescription: string;
    runtimeExecutionAvailable: false;
    hostIntegrationClaimed: false;
  };
  runtimeOwnedBoundary: string[];
  standaloneHostOwnedBoundary: string[];
};

export type StandaloneResearchVaultHostConsumptionReport = {
  reportVersion: "standalone_research_vault_host_consumption_report/v1";
  generatedAt: string;
  candidateId: string;
  candidateName: string;
  hostName: string;
  hostSurface: string;
  descriptorSurface: string;
  promotionRecordPath: string;
  promotionSpecificationPath: string;
  hostSelectionResolutionPath: string;
  acceptance: {
    consumableThroughHost: boolean;
    descriptorOnly: true;
    runtimeInternalsBypassed: false;
    hostIntegrationClaimed: false;
    runtimeExecutionClaimed: false;
    promotionAutomation: false;
  };
  hostCallableAdapter: RuntimeHostCallableAdapterDescriptor;
  proof: {
    primaryChecker: string;
    supportingCheckers: string[];
  };
  stopLine: string;
};

export type StandaloneResearchVaultDescriptorCallableRequest = {
  action: "summarize_descriptor";
  includeOpenDecisions?: boolean;
  executedAt?: string;
};

export type StandaloneResearchVaultDescriptorCallableResult = {
  candidateId: string;
  candidateName: string;
  hostSurface: string;
  currentStage: string;
  resolvedHost: string;
  callable: {
    callableId: "standalone_host.research_vault_descriptor_summary.v1";
    action: "summarize_descriptor";
    inputShape: string[];
    outputShape: string[];
    descriptorCallableExecuted: true;
    sourceRuntimeExecutionClaimed: false;
    hostIntegrationClaimed: false;
    registryAcceptanceClaimed: false;
    promotionAutomation: false;
  };
  hostCallableAdapter: RuntimeHostCallableAdapterDescriptor;
  execution: {
    status: "ok";
    executedAt: string;
    output: {
      summary: string;
      nextLegalStep: string;
      resolvedHost: string;
      integrationMode: string | null;
      targetRuntimeSurface: string | null;
      requiredGates: string[];
      openDecisions: string[];
      evidencePaths: {
        promotionRecordPath: string;
        promotionSpecificationPath: string;
        hostSelectionResolutionPath: string;
      };
      stopLine: string;
    };
  };
};

export type StandaloneResearchVaultHostCallableExecutionReport = {
  reportVersion: "standalone_research_vault_host_callable_execution_report/v1";
  generatedAt: string;
  candidateId: string;
  candidateName: string;
  hostName: string;
  hostSurface: string;
  callableSurface: string;
  promotionRecordPath: string;
  promotionSpecificationPath: string;
  hostSelectionResolutionPath: string;
  sampleInvocation: {
    action: "summarize_descriptor";
    status: "ok";
    descriptorCallableExecuted: true;
    summary: string;
  };
  acceptance: {
    callableThroughHost: true;
    descriptorCallableOnly: true;
    sourceRuntimeExecutionClaimed: false;
    hostIntegrationClaimed: false;
    registryAcceptanceClaimed: false;
    promotionAutomation: false;
  };
  hostCallableAdapter: RuntimeHostCallableAdapterDescriptor;
  proof: {
    primaryChecker: string;
    supportingCheckers: string[];
  };
  stopLine: string;
};

export type StandaloneResearchVaultSourcePackInvocationRequest = {
  tool: "query-source-pack";
  input: {
    query: string;
    includeEvidence?: boolean;
    maxItems?: number;
  };
  timeoutMs?: number;
  executionAt?: string;
  persistArtifacts?: boolean;
};

export type StandaloneResearchVaultSourcePackInvocationResult = {
  candidateId: string;
  candidateName: string;
  hostSurface: string;
  currentStage: string;
  resolvedHost: string;
  linkedArtifacts: StandaloneResearchVaultDescriptor["linkedArtifacts"];
  adapter: {
    adapterId: string;
    invokeSurface: "standalone_host_runtime_research_vault_source_pack_query";
    compileContractArtifact: string;
    promotionRecordPath: string;
    promotionSpecificationPath: string;
    hostSelectionResolutionPath: string;
    runtimeExecutorSurface: "runtime/core/callable-execution.ts";
    runtimeInternalsBypassed: false;
    hostIntegrated: true;
    sourceRuntimeExecutionClaimed: false;
    promotionAutomation: false;
    automaticWorkflowAdvancement: false;
  };
  hostCallableAdapter: RuntimeHostCallableAdapterDescriptor;
  execution: DirectiveRuntimeCallableExecutionRunResult;
};

export type StandaloneResearchVaultSourcePackExecutionReport = {
  reportVersion: "standalone_research_vault_source_pack_execution_report/v1";
  generatedAt: string;
  candidateId: string;
  candidateName: string;
  hostName: string;
  hostSurface: string;
  callableSurface: string;
  promotionRecordPath: string;
  promotionSpecificationPath: string;
  hostSelectionResolutionPath: string;
  sampleInvocation: {
    tool: "query-source-pack";
    status: string;
    persistArtifacts: boolean;
    matchedSectionCount: number | null;
    topSectionId: string | null;
  };
  acceptance: {
    callableThroughHost: true;
    descriptorCallableOnly: false;
    runtimeCallableExecution: true;
    sourceRuntimeExecutionClaimed: false;
    hostIntegrationClaimed: true;
    registryAcceptanceClaimed: false;
    promotionAutomation: false;
    runtimeInternalsBypassed: false;
  };
  hostCallableAdapter: RuntimeHostCallableAdapterDescriptor;
  executionEvidencePath: string | null;
  proof: {
    primaryChecker: string;
    supportingCheckers: string[];
  };
  stopLine: string;
};

export type StandaloneBlisspixelDeeprDescriptor = {
  candidateId: string;
  candidateName: string;
  hostSurface: string;
  currentStage: string;
  nextLegalStep: string;
  proposedHost: string | null;
  executionState: string | null;
  artifactPath: string;
  linkedArtifacts: {
    runtimeRecordPath: string | null;
    runtimeProofPath: string | null;
    runtimeCapabilityBoundaryPath: string | null;
    runtimePromotionReadinessPath: string | null;
    runtimePromotionRecordPath: string | null;
    runtimePromotionSpecificationPath: string | null;
    runtimeCallableStubPath: string | null;
  };
  adapter: {
    adapterId: string;
    loadMode: "read_promotion_record_and_specification_only";
    compileContractArtifact: string;
    promotionRecordPath: string;
    promotionSpecificationPath: string;
    integrationMode: string | null;
    targetRuntimeSurface: string | null;
    requiredGates: string[];
    openDecisions: string[];
    hostConsumableDescription: string;
    runtimeExecutionAvailable: false;
    hostIntegrationClaimed: false;
  };
  runtimeOwnedBoundary: string[];
  standaloneHostOwnedBoundary: string[];
};

export type StandaloneBlisspixelDeeprHostConsumptionReport = {
  reportVersion: "standalone_blisspixel_deepr_host_consumption_report/v1";
  generatedAt: string;
  candidateId: string;
  candidateName: string;
  hostName: string;
  hostSurface: string;
  descriptorSurface: string;
  promotionRecordPath: string;
  promotionSpecificationPath: string;
  acceptance: {
    consumableThroughHost: boolean;
    descriptorOnly: true;
    runtimeInternalsBypassed: false;
    hostIntegrationClaimed: false;
    runtimeExecutionClaimed: false;
    promotionAutomation: false;
  };
  hostCallableAdapter: RuntimeHostCallableAdapterDescriptor;
  proof: {
    primaryChecker: string;
    supportingCheckers: string[];
  };
  stopLine: string;
};

export type StandaloneBlisspixelDeeprDescriptorCallableRequest = {
  action: "summarize_descriptor";
  includeOpenDecisions?: boolean;
  executedAt?: string;
};

export type StandaloneBlisspixelDeeprDescriptorCallableResult = {
  candidateId: string;
  candidateName: string;
  hostSurface: string;
  currentStage: string;
  proposedHost: string | null;
  callable: {
    callableId: "standalone_host.blisspixel_deepr_descriptor_summary.v1";
    action: "summarize_descriptor";
    inputShape: string[];
    outputShape: string[];
    descriptorCallableExecuted: true;
    sourceRuntimeExecutionClaimed: false;
    hostIntegrationClaimed: false;
    registryAcceptanceClaimed: false;
    promotionAutomation: false;
  };
  hostCallableAdapter: RuntimeHostCallableAdapterDescriptor;
  execution: {
    status: "ok";
    executedAt: string;
    output: {
      summary: string;
      nextLegalStep: string;
      proposedHost: string | null;
      integrationMode: string | null;
      targetRuntimeSurface: string | null;
      requiredGates: string[];
      openDecisions: string[];
      evidencePaths: {
        promotionRecordPath: string;
        promotionSpecificationPath: string;
      };
      stopLine: string;
    };
  };
};

export type StandaloneBlisspixelDeeprHostCallableExecutionReport = {
  reportVersion: "standalone_blisspixel_deepr_host_callable_execution_report/v1";
  generatedAt: string;
  candidateId: string;
  candidateName: string;
  hostName: string;
  hostSurface: string;
  callableSurface: string;
  promotionRecordPath: string;
  promotionSpecificationPath: string;
  sampleInvocation: {
    action: "summarize_descriptor";
    status: "ok";
    descriptorCallableExecuted: true;
    summary: string;
  };
  acceptance: {
    callableThroughHost: true;
    descriptorCallableOnly: true;
    sourceRuntimeExecutionClaimed: false;
    hostIntegrationClaimed: false;
    registryAcceptanceClaimed: false;
    promotionAutomation: false;
  };
  hostCallableAdapter: RuntimeHostCallableAdapterDescriptor;
  proof: {
    primaryChecker: string;
    supportingCheckers: string[];
  };
  stopLine: string;
};
