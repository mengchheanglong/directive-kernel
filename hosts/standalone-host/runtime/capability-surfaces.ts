import { resolveDirectiveWorkspaceState } from "../../../engine/state/index.ts";
import {
  runDirectiveCallableCapabilityWithExecutionSurface,
  runDirectiveRuntimeCallableExecution,
} from "../../../runtime/core/callable-execution.ts";
import {
  buildDescriptorOnlyHostCallableAdapterDescriptor,
  buildRuntimeCallableExecutionHostAdapterDescriptor,
} from "../../../runtime/lib/host/callable-adapter-contract.ts";
import {
  readRuntimeHostSelectionResolution,
} from "../../../runtime/lib/host/selection-resolution.ts";
import {
  DIRECTIVE_RUNTIME_TO_HOST_CONTRACT_PATH,
  readDirectiveRuntimePromotionSpecification,
} from "../../../runtime/lib/host/promotion-specification.ts";

import type {
  StandaloneBlisspixelDeeprDescriptor,
  StandaloneBlisspixelDeeprDescriptorCallableRequest,
  StandaloneBlisspixelDeeprDescriptorCallableResult,
  StandaloneLiveMiniSweAgentDescriptor,
  StandaloneResearchVaultDescriptor,
  StandaloneResearchVaultDescriptorCallableRequest,
  StandaloneResearchVaultDescriptorCallableResult,
  StandaloneResearchVaultSourcePackInvocationRequest,
  StandaloneResearchVaultSourcePackInvocationResult,
  StandaloneScientifyBundleDescriptor,
  StandaloneScientifyHostInvocationRequest,
  StandaloneScientifyHostInvocationResult,
} from "./types.ts";
import {
  BLISSPIXEL_DEEPR_PROMOTION_RECORD_RELATIVE_PATH,
  LIVE_MINI_SWE_CALLABLE_BOUNDARY,
  LIVE_MINI_SWE_IMPLEMENTATION_SLICE_RELATIVE_PATH,
  LIVE_MINI_SWE_PRE_PROMOTION_SLICE_RELATIVE_PATH,
  LIVE_MINI_SWE_PROMOTION_READINESS_RELATIVE_PATH,
  RESEARCH_VAULT_PROMOTION_RECORD_RELATIVE_PATH,
  SCIENTIFY_DESCRIPTOR_TOOLS,
  SCIENTIFY_IMPLEMENTATION_SLICE_RELATIVE_PATH,
  SCIENTIFY_PRE_PROMOTION_SLICE_RELATIVE_PATH,
  SCIENTIFY_PROMOTION_READINESS_RELATIVE_PATH,
  STANDALONE_HOST_TARGET,
} from "./shared.ts";

export function readStandaloneScientifyLiteratureAccessBundle(input: {
  directiveRoot: string;
}): StandaloneScientifyBundleDescriptor {
  const resolved = resolveDirectiveWorkspaceState({
    directiveRoot: input.directiveRoot,
    artifactPath: SCIENTIFY_PROMOTION_READINESS_RELATIVE_PATH,
    includeAnchors: false,
  }).focus;

  if (!resolved || !resolved.runtime) {
    throw new Error("scientify_runtime_descriptor_unavailable");
  }
  const promotionSpecificationPath =
    resolved.linkedArtifacts.runtimePromotionSpecificationPath;
  if (!promotionSpecificationPath) {
    throw new Error("scientify_runtime_promotion_specification_unavailable");
  }
  const promotionSpecification = readDirectiveRuntimePromotionSpecification({
    directiveRoot: input.directiveRoot,
    promotionSpecificationPath,
  });

  return {
    candidateId: resolved.candidateId ?? "dw-source-scientify-research-workflow-plugin-2026-03-27",
    candidateName: resolved.candidateName ?? "Scientify Literature-Access Tool Bundle",
    hostSurface: "Directive Kernel standalone host CLI descriptor",
    currentStage: resolved.currentStage,
    nextLegalStep: resolved.nextLegalStep,
    proposedHost: resolved.runtime.proposedHost,
    executionState: resolved.runtime.executionState,
    promotionReadinessBlockers: [...resolved.runtime.promotionReadinessBlockers],
    prePromotionSlicePath: SCIENTIFY_PRE_PROMOTION_SLICE_RELATIVE_PATH,
    implementationSlicePath: SCIENTIFY_IMPLEMENTATION_SLICE_RELATIVE_PATH,
    artifactPath: SCIENTIFY_PROMOTION_READINESS_RELATIVE_PATH,
    linkedArtifacts: {
      runtimeRecordPath: resolved.linkedArtifacts.runtimeRecordPath,
      runtimeProofPath: resolved.linkedArtifacts.runtimeProofPath,
      runtimeCapabilityBoundaryPath: resolved.linkedArtifacts.runtimeRuntimeCapabilityBoundaryPath,
      runtimePromotionReadinessPath: resolved.linkedArtifacts.runtimePromotionReadinessPath,
      runtimePromotionRecordPath: resolved.linkedArtifacts.runtimePromotionRecordPath,
      runtimePromotionSpecificationPath: promotionSpecificationPath,
      runtimeCallableStubPath: resolved.linkedArtifacts.runtimeCallableStubPath,
    },
    adapter: {
      adapterId: `${promotionSpecification.candidateId}:standalone_host:promotion_spec_adapter`,
      loadMode: "read_promotion_specification_only",
      compileContractArtifact: DIRECTIVE_RUNTIME_TO_HOST_CONTRACT_PATH,
      promotionSpecificationPath,
      callableStubPath: promotionSpecification.linkedArtifacts.callableStubPath,
      integrationMode: promotionSpecification.integrationMode,
      targetRuntimeSurface: promotionSpecification.targetRuntimeSurface,
      requiredGates: [...promotionSpecification.requiredGates],
      openDecisions: [...promotionSpecification.openDecisions],
      hostConsumableDescription: promotionSpecification.hostConsumableDescription,
    },
    tools: [...SCIENTIFY_DESCRIPTOR_TOOLS],
    runtimeOwnedBoundary: [
      "lifecycle truth",
      "blocker judgment",
      "tool module ownership",
      "promotion/execution/integration legality",
    ],
    standaloneHostOwnedBoundary: [
      "read-only descriptor surface for the approved 4-tool bundle",
      "promotion-specification reader for the approved Runtime-owned capability",
      "host-visible summary of current Runtime truth and linked artifacts",
    ],
  };
}

export async function invokeStandaloneScientifyLiteratureAccessTool(input: {
  directiveRoot: string;
  request: StandaloneScientifyHostInvocationRequest;
}): Promise<StandaloneScientifyHostInvocationResult> {
  const descriptor = readStandaloneScientifyLiteratureAccessBundle({
    directiveRoot: input.directiveRoot,
  });
  const promotionSpecificationPath =
    descriptor.linkedArtifacts.runtimePromotionSpecificationPath;
  if (!promotionSpecificationPath) {
    throw new Error("scientify_runtime_promotion_specification_unavailable");
  }
  if (
    descriptor.currentStage !== "runtime.promotion_record.opened"
    && !descriptor.linkedArtifacts.runtimePromotionRecordPath
  ) {
    throw new Error("scientify_host_invoke_requires_promotion_record");
  }
  if (descriptor.proposedHost !== STANDALONE_HOST_TARGET) {
    throw new Error("scientify_host_invoke_requires_standalone_host_target");
  }

  const promotionSpecification = readDirectiveRuntimePromotionSpecification({
    directiveRoot: input.directiveRoot,
    promotionSpecificationPath,
  });
  const adapterId =
    `${promotionSpecification.candidateId}:standalone_host:runtime_callable_invoke_adapter`;
  const invokeSurface = "standalone_host_runtime_scientify_invoke" as const;
  const execution = await runDirectiveRuntimeCallableExecution({
    directiveRoot: input.directiveRoot,
    capabilityId: descriptor.candidateId,
    tool: input.request.tool,
    input: input.request.input,
    timeoutMs: input.request.timeoutMs,
    allowExternalFetches: input.request.allowExternalFetches,
    executionAt: input.request.executionAt,
    persistArtifacts: input.request.persistArtifacts,
  });
  const hostCallableAdapter =
    buildRuntimeCallableExecutionHostAdapterDescriptor({
      adapterId,
      candidateId: descriptor.candidateId,
      candidateName: descriptor.candidateName,
      hostName: "Directive Kernel standalone host",
      hostSurface: "Directive Kernel standalone host callable invoke adapter",
      callableSurface: invokeSurface,
      evidencePaths: {
        promotionRecordPath: descriptor.linkedArtifacts.runtimePromotionRecordPath,
        promotionSpecificationPath,
        callableStubPath: promotionSpecification.linkedArtifacts.callableStubPath,
        executionEvidencePath: execution.record.artifacts.recordPath,
      },
      proof: {
        primaryChecker: "pnpm run check:standalone-scientify-host-consumption",
        supportingCheckers: [
          "pnpm run check:standalone-scientify-host-adapter",
          "pnpm run check:directive-scientify-runtime-promotion",
        ],
      },
      stopLine:
        "Scientify executes a Runtime-owned callable through the standalone host adapter; imported-source execution, registry acceptance, and promotion automation remain unopened.",
      hostIntegrationClaimed: true,
    });

  return {
    candidateId: descriptor.candidateId,
    candidateName: descriptor.candidateName,
    hostSurface: "Directive Kernel standalone host callable invoke adapter",
    currentStage: descriptor.currentStage,
    proposedHost: descriptor.proposedHost,
    linkedArtifacts: descriptor.linkedArtifacts,
    adapter: {
      adapterId,
      invokeSurface,
      compileContractArtifact: DIRECTIVE_RUNTIME_TO_HOST_CONTRACT_PATH,
      promotionSpecificationPath,
      callableStubPath: promotionSpecification.linkedArtifacts.callableStubPath,
      runtimeExecutorSurface: "runtime/core/callable-execution.ts",
      runtimeInternalsBypassed: false,
      hostIntegrated: true,
      promotionAutomation: false,
      automaticWorkflowAdvancement: false,
    },
    hostCallableAdapter,
    execution,
  };
}

export function readStandaloneResearchVaultDescriptor(input: {
  directiveRoot: string;
}): StandaloneResearchVaultDescriptor {
  const resolved = resolveDirectiveWorkspaceState({
    directiveRoot: input.directiveRoot,
    artifactPath: RESEARCH_VAULT_PROMOTION_RECORD_RELATIVE_PATH,
    includeAnchors: false,
  }).focus;

  if (!resolved || !resolved.runtime) {
    throw new Error("research_vault_runtime_descriptor_unavailable");
  }
  if (resolved.currentStage !== "runtime.promotion_record.opened") {
    throw new Error("research_vault_host_descriptor_requires_promotion_record");
  }

  const promotionSpecificationPath =
    resolved.linkedArtifacts.runtimePromotionSpecificationPath;
  const hostSelectionResolutionPath =
    resolved.linkedArtifacts.runtimeHostSelectionResolutionPath;
  const promotionRecordPath = resolved.linkedArtifacts.runtimePromotionRecordPath;
  const promotionReadinessPath = resolved.linkedArtifacts.runtimePromotionReadinessPath;

  if (!promotionRecordPath) {
    throw new Error("research_vault_host_descriptor_requires_promotion_record");
  }
  if (!promotionSpecificationPath) {
    throw new Error("research_vault_runtime_promotion_specification_unavailable");
  }
  if (!hostSelectionResolutionPath || !promotionReadinessPath) {
    throw new Error("research_vault_host_descriptor_requires_host_selection_resolution");
  }

  const hostSelectionResolution = readRuntimeHostSelectionResolution({
    directiveRoot: input.directiveRoot,
    promotionReadinessPath,
  });
  if (!hostSelectionResolution) {
    throw new Error("research_vault_host_descriptor_requires_host_selection_resolution");
  }
  if (hostSelectionResolution.resolvedHost !== STANDALONE_HOST_TARGET) {
    throw new Error("research_vault_host_descriptor_requires_standalone_host_target");
  }

  const promotionSpecification = readDirectiveRuntimePromotionSpecification({
    directiveRoot: input.directiveRoot,
    promotionSpecificationPath,
  });
  const resolvedOpenDecisions = promotionSpecification.openDecisions.filter(
    (entry) => !entry.startsWith("Host selection: "),
  );
  const resolvedHostConsumableDescription =
    `If promoted, ${hostSelectionResolution.resolvedHost} would receive a ${
      promotionSpecification.integrationMode || "runtime"
    } integration of "${resolved.candidateName ?? promotionSpecification.candidateName}" (${
      promotionSpecification.targetRuntimeSurface || "runtime capability"
    }). The host would need to provide a runtime surface for the integration mode "${
      promotionSpecification.integrationMode || "unknown"
    }" with the required gates: ${promotionSpecification.requiredGates.join(", ")}.`;

  return {
    candidateId: resolved.candidateId
      ?? "research-engine-web-aakashsharan-com-research-va-20260407t052643z-20260407t052702.",
    candidateName:
      resolved.candidateName ?? "Research Vault: Open Source Agentic AI Research Assistant",
    hostSurface: "Directive Kernel standalone host CLI descriptor",
    currentStage: resolved.currentStage,
    nextLegalStep: resolved.nextLegalStep,
    originalProposedHost: hostSelectionResolution.originalProposedHost,
    resolvedHost: hostSelectionResolution.resolvedHost,
    resolutionDecision: hostSelectionResolution.decision,
    executionState: resolved.runtime.executionState,
    artifactPath: promotionRecordPath,
    linkedArtifacts: {
      runtimeRecordPath: resolved.linkedArtifacts.runtimeRecordPath,
      runtimeProofPath: resolved.linkedArtifacts.runtimeProofPath,
      runtimeCapabilityBoundaryPath: resolved.linkedArtifacts.runtimeRuntimeCapabilityBoundaryPath,
      runtimePromotionReadinessPath: promotionReadinessPath,
      runtimePromotionRecordPath: promotionRecordPath,
      runtimePromotionSpecificationPath: promotionSpecificationPath,
      runtimeHostSelectionResolutionPath: hostSelectionResolutionPath,
      runtimeCallableStubPath: resolved.linkedArtifacts.runtimeCallableStubPath,
    },
    adapter: {
      adapterId: `${promotionSpecification.candidateId}:standalone_host:research_vault_descriptor_adapter`,
      loadMode: "read_promotion_record_and_specification_only",
      compileContractArtifact: DIRECTIVE_RUNTIME_TO_HOST_CONTRACT_PATH,
      promotionRecordPath,
      promotionSpecificationPath,
      hostSelectionResolutionPath,
      integrationMode: promotionSpecification.integrationMode,
      targetRuntimeSurface: promotionSpecification.targetRuntimeSurface,
      requiredGates: [...promotionSpecification.requiredGates],
      openDecisions: resolvedOpenDecisions,
      hostConsumableDescription: resolvedHostConsumableDescription,
      runtimeExecutionAvailable: false,
      hostIntegrationClaimed: false,
    },
    runtimeOwnedBoundary: [
      "lifecycle truth",
      "promotion decision truth",
      "host selection legality",
      "promotion/execution/integration legality",
    ],
    standaloneHostOwnedBoundary: [
      "read-only descriptor surface for one approved fresh Runtime promotion record",
      "promotion-record and promotion-specification reader for the selected candidate only",
      "host-visible summary of current Runtime truth and linked artifacts without execution claims",
    ],
  };
}

export function invokeStandaloneResearchVaultDescriptorCallable(input: {
  directiveRoot: string;
  request: StandaloneResearchVaultDescriptorCallableRequest;
}): StandaloneResearchVaultDescriptorCallableResult {
  if (input.request.action !== "summarize_descriptor") {
    throw new Error("research_vault_descriptor_callable_unsupported_action");
  }

  const descriptor = readStandaloneResearchVaultDescriptor({
    directiveRoot: input.directiveRoot,
  });

  const openDecisions = input.request.includeOpenDecisions
    ? [...descriptor.adapter.openDecisions]
    : [];
  const summary =
    `${descriptor.candidateName} is exposed through the standalone host as a ` +
    "read-only descriptor-summary callable backed by the candidate promotion record, " +
    "promotion specification, and host-selection resolution.";
  const callableId = "standalone_host.research_vault_descriptor_summary.v1" as const;
  const hostCallableAdapter =
    buildDescriptorOnlyHostCallableAdapterDescriptor({
      adapterId:
        `${descriptor.candidateId}:standalone_host:research_vault_descriptor_callable_adapter`,
      candidateId: descriptor.candidateId,
      candidateName: descriptor.candidateName,
      hostName: "Directive Kernel standalone host",
      hostSurface: "Directive Kernel standalone host descriptor callable",
      callableSurface: callableId,
      evidencePaths: {
        promotionRecordPath: descriptor.linkedArtifacts.runtimePromotionRecordPath,
        promotionSpecificationPath:
          descriptor.linkedArtifacts.runtimePromotionSpecificationPath,
        hostSelectionResolutionPath:
          descriptor.linkedArtifacts.runtimeHostSelectionResolutionPath,
      },
      proof: {
        primaryChecker: "pnpm run check:standalone-research-vault-host-callable",
        supportingCheckers: [
          "pnpm run check:standalone-research-vault-host-adapter",
          "pnpm run check:standalone-research-vault-host-adapter-boundary",
        ],
      },
      stopLine:
        "Research Vault exposes a descriptor callable only; imported-source execution, registry acceptance, promotion automation, and generic host integration remain unopened.",
    });

  return {
    candidateId: descriptor.candidateId,
    candidateName: descriptor.candidateName,
    hostSurface: "Directive Kernel standalone host descriptor callable",
    currentStage: descriptor.currentStage,
    resolvedHost: descriptor.resolvedHost,
    callable: {
      callableId,
      action: "summarize_descriptor",
      inputShape: [
        "action: 'summarize_descriptor'",
        "includeOpenDecisions?: boolean",
      ],
      outputShape: [
        "summary",
        "nextLegalStep",
        "resolvedHost",
        "integrationMode",
        "targetRuntimeSurface",
        "requiredGates",
        "openDecisions",
        "evidencePaths",
        "stopLine",
      ],
      descriptorCallableExecuted: true,
      sourceRuntimeExecutionClaimed: false,
      hostIntegrationClaimed: false,
      registryAcceptanceClaimed: false,
      promotionAutomation: false,
    },
    hostCallableAdapter,
    execution: {
      status: "ok",
      executedAt: input.request.executedAt ?? new Date().toISOString(),
      output: {
        summary,
        nextLegalStep: descriptor.nextLegalStep,
        resolvedHost: descriptor.resolvedHost,
        integrationMode: descriptor.adapter.integrationMode,
        targetRuntimeSurface: descriptor.adapter.targetRuntimeSurface,
        requiredGates: [...descriptor.adapter.requiredGates],
        openDecisions,
        evidencePaths: {
          promotionRecordPath:
            descriptor.linkedArtifacts.runtimePromotionRecordPath ?? "",
          promotionSpecificationPath:
            descriptor.linkedArtifacts.runtimePromotionSpecificationPath ?? "",
          hostSelectionResolutionPath:
            descriptor.linkedArtifacts.runtimeHostSelectionResolutionPath,
        },
        stopLine:
          "Descriptor callable executed through the standalone host; imported-source runtime execution, registry acceptance, promotion automation, and generic host integration remain unopened.",
      },
    },
  };
}

export async function invokeStandaloneResearchVaultSourcePackTool(input: {
  directiveRoot: string;
  request: StandaloneResearchVaultSourcePackInvocationRequest;
}): Promise<StandaloneResearchVaultSourcePackInvocationResult> {
  const descriptor = readStandaloneResearchVaultDescriptor({
    directiveRoot: input.directiveRoot,
  });
  const promotionSpecificationPath =
    descriptor.linkedArtifacts.runtimePromotionSpecificationPath;
  const promotionRecordPath = descriptor.linkedArtifacts.runtimePromotionRecordPath;
  const hostSelectionResolutionPath =
    descriptor.linkedArtifacts.runtimeHostSelectionResolutionPath;

  if (descriptor.currentStage !== "runtime.promotion_record.opened") {
    throw new Error("research_vault_source_pack_requires_promotion_record");
  }
  if (!promotionRecordPath) {
    throw new Error("research_vault_source_pack_requires_promotion_record");
  }
  if (!promotionSpecificationPath) {
    throw new Error("research_vault_source_pack_requires_promotion_specification");
  }
  if (!hostSelectionResolutionPath) {
    throw new Error("research_vault_source_pack_requires_host_selection_resolution");
  }

  const promotionSpecification = readDirectiveRuntimePromotionSpecification({
    directiveRoot: input.directiveRoot,
    promotionSpecificationPath,
  });
  const adapterId =
    `${descriptor.candidateId}:standalone_host:research_vault_source_pack_runtime_callable_adapter`;
  const invokeSurface =
    "standalone_host_runtime_research_vault_source_pack_query" as const;
  const execution = await runDirectiveRuntimeCallableExecution({
    directiveRoot: input.directiveRoot,
    capabilityId: descriptor.candidateId,
    tool: input.request.tool,
    input: input.request.input,
    timeoutMs: input.request.timeoutMs,
    executionAt: input.request.executionAt,
    persistArtifacts: input.request.persistArtifacts,
  });
  const hostCallableAdapter =
    buildRuntimeCallableExecutionHostAdapterDescriptor({
      adapterId,
      candidateId: descriptor.candidateId,
      candidateName: descriptor.candidateName,
      hostName: "Directive Kernel standalone host",
      hostSurface: "Directive Kernel standalone host Research Vault source-pack invoke adapter",
      callableSurface: invokeSurface,
      evidencePaths: {
        promotionRecordPath,
        promotionSpecificationPath,
        hostSelectionResolutionPath,
        executionEvidencePath: execution.record.artifacts.recordPath,
      },
      proof: {
        primaryChecker: "pnpm run check:standalone-research-vault-source-pack-execution",
        supportingCheckers: [
          "pnpm run check:standalone-research-vault-host-callable",
          "pnpm run check:runtime-callable-adapter-contract",
        ],
      },
      stopLine:
        "Research Vault source-pack query executes as Directive-owned derived behavior; the external Research Vault app, registry acceptance, and promotion automation remain unopened.",
      hostIntegrationClaimed: true,
    });

  return {
    candidateId: descriptor.candidateId,
    candidateName: descriptor.candidateName,
    hostSurface:
      "Directive Kernel standalone host Research Vault source-pack invoke adapter",
    currentStage: descriptor.currentStage,
    resolvedHost: descriptor.resolvedHost,
    linkedArtifacts: descriptor.linkedArtifacts,
    adapter: {
      adapterId,
      invokeSurface,
      compileContractArtifact: DIRECTIVE_RUNTIME_TO_HOST_CONTRACT_PATH,
      promotionRecordPath,
      promotionSpecificationPath,
      hostSelectionResolutionPath,
      runtimeExecutorSurface: "runtime/core/callable-execution.ts",
      runtimeInternalsBypassed: false,
      hostIntegrated: true,
      sourceRuntimeExecutionClaimed: false,
      promotionAutomation: false,
      automaticWorkflowAdvancement: false,
    },
    hostCallableAdapter,
    execution,
  };
}

export function readStandaloneBlisspixelDeeprDescriptor(input: {
  directiveRoot: string;
}): StandaloneBlisspixelDeeprDescriptor {
  const resolved = resolveDirectiveWorkspaceState({
    directiveRoot: input.directiveRoot,
    artifactPath: BLISSPIXEL_DEEPR_PROMOTION_RECORD_RELATIVE_PATH,
    includeAnchors: false,
  }).focus;

  if (!resolved || !resolved.runtime) {
    throw new Error("blisspixel_deepr_runtime_descriptor_unavailable");
  }
  if (resolved.currentStage !== "runtime.promotion_record.opened") {
    throw new Error("blisspixel_deepr_host_descriptor_requires_promotion_record");
  }

  const promotionSpecificationPath =
    resolved.linkedArtifacts.runtimePromotionSpecificationPath;
  const promotionRecordPath = resolved.linkedArtifacts.runtimePromotionRecordPath;
  if (!promotionRecordPath) {
    throw new Error("blisspixel_deepr_host_descriptor_requires_promotion_record");
  }
  if (!promotionSpecificationPath) {
    throw new Error("blisspixel_deepr_runtime_promotion_specification_unavailable");
  }
  if (resolved.runtime.proposedHost !== STANDALONE_HOST_TARGET) {
    throw new Error("blisspixel_deepr_host_descriptor_requires_standalone_host_target");
  }

  const promotionSpecification = readDirectiveRuntimePromotionSpecification({
    directiveRoot: input.directiveRoot,
    promotionSpecificationPath,
  });

  return {
    candidateId: resolved.candidateId
      ?? "research-engine-repo-blisspixel-deepr-20260407t052643z-20260407t072402.",
    candidateName: resolved.candidateName ?? "blisspixel/deepr",
    hostSurface: "Directive Kernel standalone host CLI descriptor",
    currentStage: resolved.currentStage,
    nextLegalStep: resolved.nextLegalStep,
    proposedHost: resolved.runtime.proposedHost,
    executionState: resolved.runtime.executionState,
    artifactPath: promotionRecordPath,
    linkedArtifacts: {
      runtimeRecordPath: resolved.linkedArtifacts.runtimeRecordPath,
      runtimeProofPath: resolved.linkedArtifacts.runtimeProofPath,
      runtimeCapabilityBoundaryPath:
        resolved.linkedArtifacts.runtimeRuntimeCapabilityBoundaryPath,
      runtimePromotionReadinessPath:
        resolved.linkedArtifacts.runtimePromotionReadinessPath,
      runtimePromotionRecordPath: promotionRecordPath,
      runtimePromotionSpecificationPath: promotionSpecificationPath,
      runtimeCallableStubPath: resolved.linkedArtifacts.runtimeCallableStubPath,
    },
    adapter: {
      adapterId: `${promotionSpecification.candidateId}:standalone_host:blisspixel_deepr_descriptor_adapter`,
      loadMode: "read_promotion_record_and_specification_only",
      compileContractArtifact: DIRECTIVE_RUNTIME_TO_HOST_CONTRACT_PATH,
      promotionRecordPath,
      promotionSpecificationPath,
      integrationMode: promotionSpecification.integrationMode,
      targetRuntimeSurface: promotionSpecification.targetRuntimeSurface,
      requiredGates: [...promotionSpecification.requiredGates],
      openDecisions: [...promotionSpecification.openDecisions],
      hostConsumableDescription: promotionSpecification.hostConsumableDescription,
      runtimeExecutionAvailable: false,
      hostIntegrationClaimed: false,
    },
    runtimeOwnedBoundary: [
      "lifecycle truth",
      "promotion decision truth",
      "promotion/execution/integration legality",
    ],
    standaloneHostOwnedBoundary: [
      "read-only descriptor surface for one fresh Runtime promotion record",
      "promotion-record and promotion-specification reader for the selected candidate only",
      "host-visible summary of current Runtime truth and linked artifacts without execution claims",
    ],
  };
}

export function invokeStandaloneBlisspixelDeeprDescriptorCallable(input: {
  directiveRoot: string;
  request: StandaloneBlisspixelDeeprDescriptorCallableRequest;
}): StandaloneBlisspixelDeeprDescriptorCallableResult {
  if (input.request.action !== "summarize_descriptor") {
    throw new Error("blisspixel_deepr_descriptor_callable_unsupported_action");
  }

  const descriptor = readStandaloneBlisspixelDeeprDescriptor({
    directiveRoot: input.directiveRoot,
  });

  const openDecisions = input.request.includeOpenDecisions
    ? [...descriptor.adapter.openDecisions]
    : [];
  const summary =
    `${descriptor.candidateName} is exposed through the standalone host as a ` +
    "read-only descriptor-summary callable backed by the candidate promotion record " +
    "and promotion specification.";
  const callableId = "standalone_host.blisspixel_deepr_descriptor_summary.v1" as const;
  const hostCallableAdapter =
    buildDescriptorOnlyHostCallableAdapterDescriptor({
      adapterId:
        `${descriptor.candidateId}:standalone_host:blisspixel_deepr_descriptor_callable_adapter`,
      candidateId: descriptor.candidateId,
      candidateName: descriptor.candidateName,
      hostName: "Directive Kernel standalone host",
      hostSurface: "Directive Kernel standalone host descriptor callable",
      callableSurface: callableId,
      evidencePaths: {
        promotionRecordPath: descriptor.linkedArtifacts.runtimePromotionRecordPath,
        promotionSpecificationPath:
          descriptor.linkedArtifacts.runtimePromotionSpecificationPath,
      },
      proof: {
        primaryChecker: "pnpm run check:standalone-blisspixel-deepr-host-callable",
        supportingCheckers: [
          "pnpm run check:runtime-callable-adapter-contract",
        ],
      },
      stopLine:
        "blisspixel/deepr exposes a descriptor callable only; imported-source execution, registry acceptance, promotion automation, and generic host integration remain unopened.",
    });

  return {
    candidateId: descriptor.candidateId,
    candidateName: descriptor.candidateName,
    hostSurface: "Directive Kernel standalone host descriptor callable",
    currentStage: descriptor.currentStage,
    proposedHost: descriptor.proposedHost,
    callable: {
      callableId,
      action: "summarize_descriptor",
      inputShape: [
        "action: 'summarize_descriptor'",
        "includeOpenDecisions?: boolean",
      ],
      outputShape: [
        "summary",
        "nextLegalStep",
        "proposedHost",
        "integrationMode",
        "targetRuntimeSurface",
        "requiredGates",
        "openDecisions",
        "evidencePaths",
        "stopLine",
      ],
      descriptorCallableExecuted: true,
      sourceRuntimeExecutionClaimed: false,
      hostIntegrationClaimed: false,
      registryAcceptanceClaimed: false,
      promotionAutomation: false,
    },
    hostCallableAdapter,
    execution: {
      status: "ok",
      executedAt: input.request.executedAt ?? new Date().toISOString(),
      output: {
        summary,
        nextLegalStep: descriptor.nextLegalStep,
        proposedHost: descriptor.proposedHost,
        integrationMode: descriptor.adapter.integrationMode,
        targetRuntimeSurface: descriptor.adapter.targetRuntimeSurface,
        requiredGates: [...descriptor.adapter.requiredGates],
        openDecisions,
        evidencePaths: {
          promotionRecordPath:
            descriptor.linkedArtifacts.runtimePromotionRecordPath ?? "",
          promotionSpecificationPath:
            descriptor.linkedArtifacts.runtimePromotionSpecificationPath ?? "",
        },
        stopLine:
          "Descriptor callable executed through the standalone host; imported-source runtime execution, registry acceptance, promotion automation, and generic host integration remain unopened.",
      },
    },
  };
}

export function readStandaloneLiveMiniSweAgentDescriptor(input: {
  directiveRoot: string;
}): StandaloneLiveMiniSweAgentDescriptor {
  const resolved = resolveDirectiveWorkspaceState({
    directiveRoot: input.directiveRoot,
    artifactPath: LIVE_MINI_SWE_PROMOTION_READINESS_RELATIVE_PATH,
    includeAnchors: false,
  }).focus;

  if (!resolved || !resolved.runtime) {
    throw new Error("live_mini_swe_runtime_descriptor_unavailable");
  }
  const promotionSpecificationPath =
    resolved.linkedArtifacts.runtimePromotionSpecificationPath;
  const callableStubPath = resolved.linkedArtifacts.runtimeCallableStubPath;
  if (!promotionSpecificationPath) {
    throw new Error("live_mini_swe_runtime_promotion_specification_unavailable");
  }
  if (!callableStubPath) {
    throw new Error("live_mini_swe_runtime_callable_stub_unavailable");
  }
  const promotionSpecification = readDirectiveRuntimePromotionSpecification({
    directiveRoot: input.directiveRoot,
    promotionSpecificationPath,
  });
  return {
    candidateId: resolved.candidateId ?? "dw-live-mini-swe-agent-engine-pressure-2026-03-24",
    candidateName: resolved.candidateName ?? "mini-swe-agent Runtime Capability Pressure",
    hostSurface: "Directive Kernel standalone host CLI descriptor",
    currentStage: resolved.currentStage,
    nextLegalStep: resolved.nextLegalStep,
    proposedHost: resolved.runtime.proposedHost,
    executionState: resolved.runtime.executionState,
    promotionReadinessBlockers: [...resolved.runtime.promotionReadinessBlockers],
    prePromotionSlicePath: LIVE_MINI_SWE_PRE_PROMOTION_SLICE_RELATIVE_PATH,
    implementationSlicePath: LIVE_MINI_SWE_IMPLEMENTATION_SLICE_RELATIVE_PATH,
    artifactPath: LIVE_MINI_SWE_PROMOTION_READINESS_RELATIVE_PATH,
    linkedArtifacts: {
      runtimeRecordPath: resolved.linkedArtifacts.runtimeRecordPath,
      runtimeProofPath: resolved.linkedArtifacts.runtimeProofPath,
      runtimeCapabilityBoundaryPath: resolved.linkedArtifacts.runtimeRuntimeCapabilityBoundaryPath,
      runtimePromotionReadinessPath: resolved.linkedArtifacts.runtimePromotionReadinessPath,
      runtimePromotionRecordPath: resolved.linkedArtifacts.runtimePromotionRecordPath,
      runtimePromotionSpecificationPath: promotionSpecificationPath,
      runtimeCallableStubPath: callableStubPath,
    },
    adapter: {
      adapterId: `${promotionSpecification.candidateId}:standalone_host:promotion_spec_adapter`,
      loadMode: "read_promotion_specification_only",
      compileContractArtifact: DIRECTIVE_RUNTIME_TO_HOST_CONTRACT_PATH,
      promotionSpecificationPath,
      callableStubPath: promotionSpecification.linkedArtifacts.callableStubPath,
      integrationMode: promotionSpecification.integrationMode,
      targetRuntimeSurface: promotionSpecification.targetRuntimeSurface,
      requiredGates: [...promotionSpecification.requiredGates],
      openDecisions: [...promotionSpecification.openDecisions],
      hostConsumableDescription: promotionSpecification.hostConsumableDescription,
    },
    callableBoundary: {
      inputShape: [...LIVE_MINI_SWE_CALLABLE_BOUNDARY.inputShape],
      outputShape: [...LIVE_MINI_SWE_CALLABLE_BOUNDARY.outputShape],
      description: LIVE_MINI_SWE_CALLABLE_BOUNDARY.description,
      safetyRules: [...LIVE_MINI_SWE_CALLABLE_BOUNDARY.safetyRules],
    },
    runtimeOwnedBoundary: [
      "lifecycle truth",
      "blocker judgment",
      "callable legality",
      "promotion/execution/integration legality",
    ],
    standaloneHostOwnedBoundary: [
      "read-only descriptor surface for the approved live mini-swe callable boundary",
      "promotion-specification reader for the approved Runtime-owned capability",
      "host-visible summary of current Runtime truth and linked artifacts",
    ],
  };
}

// Deleted: shadcn-ui capability descriptor (canned-data callable removed in registry cleanup)
