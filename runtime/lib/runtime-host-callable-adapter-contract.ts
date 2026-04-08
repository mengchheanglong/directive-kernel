export const RUNTIME_HOST_CALLABLE_ADAPTER_CONTRACT_VERSION =
  "host_callable_adapter.v1" as const;
export const RUNTIME_HOST_CALLABLE_ADAPTER_CONTRACT_PATH =
  "shared/contracts/host-callable-adapter.md";
export const RUNTIME_HOST_CALLABLE_ADAPTER_SCHEMA_PATH =
  "shared/schemas/host-callable-adapter.v1.schema.json";

export type RuntimeHostCallableAdapterKind =
  | "descriptor_callable"
  | "runtime_callable_execution";

export type RuntimeHostCallableAdapterEvidencePaths = {
  promotionRecordPath: string | null;
  promotionSpecificationPath: string | null;
  callableStubPath?: string | null;
  hostSelectionResolutionPath?: string | null;
  executionEvidencePath?: string | null;
};

export type RuntimeHostCallableAdapterAcceptance = {
  callableThroughHost: boolean;
  descriptorCallableOnly: boolean;
  runtimeCallableExecution: boolean;
  sourceRuntimeExecutionClaimed: boolean;
  hostIntegrationClaimed: boolean;
  registryAcceptanceClaimed: boolean;
  promotionAutomation: boolean;
  runtimeInternalsBypassed: boolean;
};

export type RuntimeHostCallableAdapterProof = {
  primaryChecker: string;
  supportingCheckers: string[];
};

export type RuntimeHostCallableAdapterDescriptor = {
  contractVersion: typeof RUNTIME_HOST_CALLABLE_ADAPTER_CONTRACT_VERSION;
  contractPath: typeof RUNTIME_HOST_CALLABLE_ADAPTER_CONTRACT_PATH;
  schemaPath: typeof RUNTIME_HOST_CALLABLE_ADAPTER_SCHEMA_PATH;
  adapterId: string;
  candidateId: string;
  candidateName: string;
  hostName: string;
  hostSurface: string;
  callableSurface: string;
  capabilityKind: RuntimeHostCallableAdapterKind;
  evidencePaths: RuntimeHostCallableAdapterEvidencePaths;
  acceptance: RuntimeHostCallableAdapterAcceptance;
  proof: RuntimeHostCallableAdapterProof;
  stopLine: string;
};

function assertNonEmpty(value: string, fieldName: string) {
  if (!value.trim()) {
    throw new Error(`invalid_host_callable_adapter_contract:${fieldName}`);
  }
}

export function assertRuntimeHostCallableAdapterDescriptor(
  descriptor: RuntimeHostCallableAdapterDescriptor,
) {
  assertNonEmpty(descriptor.adapterId, "adapterId");
  assertNonEmpty(descriptor.candidateId, "candidateId");
  assertNonEmpty(descriptor.candidateName, "candidateName");
  assertNonEmpty(descriptor.hostName, "hostName");
  assertNonEmpty(descriptor.hostSurface, "hostSurface");
  assertNonEmpty(descriptor.callableSurface, "callableSurface");
  assertNonEmpty(descriptor.stopLine, "stopLine");
  assertNonEmpty(descriptor.proof.primaryChecker, "proof.primaryChecker");
  if (descriptor.proof.supportingCheckers.some((entry) => !entry.trim())) {
    throw new Error("invalid_host_callable_adapter_contract:proof.supportingCheckers");
  }

  if (
    descriptor.acceptance.descriptorCallableOnly
    && descriptor.acceptance.runtimeCallableExecution
  ) {
    throw new Error("invalid_host_callable_adapter_contract:ambiguous_capability_kind");
  }
  if (
    descriptor.capabilityKind === "descriptor_callable"
    && !descriptor.acceptance.descriptorCallableOnly
  ) {
    throw new Error("invalid_host_callable_adapter_contract:descriptor_flag_missing");
  }
  if (
    descriptor.capabilityKind === "runtime_callable_execution"
    && !descriptor.acceptance.runtimeCallableExecution
  ) {
    throw new Error("invalid_host_callable_adapter_contract:runtime_execution_flag_missing");
  }
  if (!descriptor.acceptance.callableThroughHost) {
    throw new Error("invalid_host_callable_adapter_contract:callable_host_surface_missing");
  }
  if (descriptor.acceptance.sourceRuntimeExecutionClaimed) {
    throw new Error("invalid_host_callable_adapter_contract:source_execution_out_of_scope");
  }
  if (descriptor.acceptance.registryAcceptanceClaimed) {
    throw new Error("invalid_host_callable_adapter_contract:registry_acceptance_out_of_scope");
  }
  if (descriptor.acceptance.promotionAutomation) {
    throw new Error("invalid_host_callable_adapter_contract:promotion_automation_out_of_scope");
  }
  if (descriptor.acceptance.runtimeInternalsBypassed) {
    throw new Error("invalid_host_callable_adapter_contract:runtime_bypass_out_of_scope");
  }
}

export function buildRuntimeHostCallableAdapterDescriptor(input: {
  adapterId: string;
  candidateId: string;
  candidateName: string;
  hostName: string;
  hostSurface: string;
  callableSurface: string;
  capabilityKind: RuntimeHostCallableAdapterKind;
  evidencePaths: RuntimeHostCallableAdapterEvidencePaths;
  acceptance: RuntimeHostCallableAdapterAcceptance;
  proof: RuntimeHostCallableAdapterProof;
  stopLine: string;
}): RuntimeHostCallableAdapterDescriptor {
  const descriptor = {
    contractVersion: RUNTIME_HOST_CALLABLE_ADAPTER_CONTRACT_VERSION,
    contractPath: RUNTIME_HOST_CALLABLE_ADAPTER_CONTRACT_PATH,
    schemaPath: RUNTIME_HOST_CALLABLE_ADAPTER_SCHEMA_PATH,
    adapterId: input.adapterId,
    candidateId: input.candidateId,
    candidateName: input.candidateName,
    hostName: input.hostName,
    hostSurface: input.hostSurface,
    callableSurface: input.callableSurface,
    capabilityKind: input.capabilityKind,
    evidencePaths: { ...input.evidencePaths },
    acceptance: { ...input.acceptance },
    proof: {
      primaryChecker: input.proof.primaryChecker,
      supportingCheckers: [...input.proof.supportingCheckers],
    },
    stopLine: input.stopLine,
  };
  assertRuntimeHostCallableAdapterDescriptor(descriptor);
  return descriptor;
}

export function buildDescriptorOnlyHostCallableAdapterDescriptor(input: {
  adapterId: string;
  candidateId: string;
  candidateName: string;
  hostName: string;
  hostSurface: string;
  callableSurface: string;
  evidencePaths: RuntimeHostCallableAdapterEvidencePaths;
  proof: RuntimeHostCallableAdapterProof;
  stopLine: string;
}) {
  return buildRuntimeHostCallableAdapterDescriptor({
    ...input,
    capabilityKind: "descriptor_callable",
    acceptance: {
      callableThroughHost: true,
      descriptorCallableOnly: true,
      runtimeCallableExecution: false,
      sourceRuntimeExecutionClaimed: false,
      hostIntegrationClaimed: false,
      registryAcceptanceClaimed: false,
      promotionAutomation: false,
      runtimeInternalsBypassed: false,
    },
  });
}

export function buildRuntimeCallableExecutionHostAdapterDescriptor(input: {
  adapterId: string;
  candidateId: string;
  candidateName: string;
  hostName: string;
  hostSurface: string;
  callableSurface: string;
  evidencePaths: RuntimeHostCallableAdapterEvidencePaths;
  proof: RuntimeHostCallableAdapterProof;
  stopLine: string;
  hostIntegrationClaimed?: boolean;
}) {
  return buildRuntimeHostCallableAdapterDescriptor({
    ...input,
    capabilityKind: "runtime_callable_execution",
    acceptance: {
      callableThroughHost: true,
      descriptorCallableOnly: false,
      runtimeCallableExecution: true,
      sourceRuntimeExecutionClaimed: false,
      hostIntegrationClaimed: input.hostIntegrationClaimed ?? true,
      registryAcceptanceClaimed: false,
      promotionAutomation: false,
      runtimeInternalsBypassed: false,
    },
  });
}
