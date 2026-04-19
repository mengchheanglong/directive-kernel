import {
  buildDescriptorOnlyHostCallableAdapterDescriptor,
} from "../../../runtime/lib/host/runtime-host-callable-adapter-contract.ts";

import type {
  StandaloneBlisspixelDeeprDescriptor,
  StandaloneBlisspixelDeeprDescriptorCallableResult,
  StandaloneBlisspixelDeeprHostCallableExecutionReport,
  StandaloneBlisspixelDeeprHostConsumptionReport,
  StandaloneResearchVaultDescriptor,
  StandaloneResearchVaultDescriptorCallableResult,
  StandaloneResearchVaultHostCallableExecutionReport,
  StandaloneResearchVaultHostConsumptionReport,
  StandaloneResearchVaultSourcePackExecutionReport,
  StandaloneResearchVaultSourcePackInvocationResult,
  StandaloneScientifyHostConsumptionReport,
  StandaloneScientifyHostInvocationResult,
} from "./types.ts";
import { resolveStandaloneHostReportPath } from "./shared.ts";

export function resolveStandaloneScientifyHostConsumptionReportPath(input: {
  candidateId: string;
  generatedAt: string;
}) {
  return resolveStandaloneHostReportPath({
    category: "host-consumption",
    candidateId: input.candidateId,
    generatedAt: input.generatedAt,
    suffix: "host-consumption-report",
  });
}

export function renderStandaloneScientifyHostConsumptionReport(input: {
  generatedAt: string;
  invocationResult: StandaloneScientifyHostInvocationResult;
  primaryChecker: string;
  supportingCheckers?: string[];
  registryEntryPath?: string | null;
}): StandaloneScientifyHostConsumptionReport {
  const raw = input.invocationResult.execution.rawResult.result as
    | {
        ok?: boolean;
        returned?: number;
        works?: Array<{ title?: string }>;
      }
    | undefined;

  return {
    reportVersion: "standalone_scientify_host_consumption_report/v1",
    generatedAt: input.generatedAt,
    candidateId: input.invocationResult.candidateId,
    candidateName: input.invocationResult.candidateName,
    hostName: "Directive Kernel standalone host",
    hostSurface: input.invocationResult.hostSurface,
    invokeSurface: input.invocationResult.adapter.invokeSurface,
    promotionRecordPath:
      input.invocationResult.linkedArtifacts.runtimePromotionRecordPath ?? "",
    promotionSpecificationPath:
      input.invocationResult.linkedArtifacts.runtimePromotionSpecificationPath ?? "",
    callableStubPath: input.invocationResult.linkedArtifacts.runtimeCallableStubPath,
    ...(input.registryEntryPath ? { registryEntryPath: input.registryEntryPath } : {}),
    executionSurface: input.invocationResult.execution.record.boundary.executionSurface,
    sampleInvocation: {
      tool: input.invocationResult.execution.record.invocation.tool,
      status: input.invocationResult.execution.rawResult.status,
      persistArtifacts:
        input.invocationResult.execution.record.invocation.persistArtifacts,
      returned: typeof raw?.returned === "number" ? raw.returned : null,
      topTitle:
        Array.isArray(raw?.works) && raw.works.length > 0
          ? raw.works[0]?.title ?? null
          : null,
    },
    acceptance: {
      consumableThroughHost: true,
      runtimeInternalsBypassed:
        input.invocationResult.adapter.runtimeInternalsBypassed,
      hostIntegrated: input.invocationResult.adapter.hostIntegrated,
      promotionAutomation: input.invocationResult.adapter.promotionAutomation,
      automaticWorkflowAdvancement:
        input.invocationResult.adapter.automaticWorkflowAdvancement,
    },
    hostCallableAdapter: input.invocationResult.hostCallableAdapter,
    proof: {
      primaryChecker: input.primaryChecker,
      supportingCheckers: [
        "pnpm run check:standalone-scientify-host-adapter",
        "pnpm run check:directive-scientify-runtime-promotion",
        ...(input.supportingCheckers ?? []),
      ],
    },
    stopLine:
      "One promoted Scientify callable executes through the standalone host adapter without bypassing Runtime internals; broader host expansion and promotion automation remain closed by default.",
  };
}

export function resolveStandaloneResearchVaultHostConsumptionReportPath(input: {
  candidateId: string;
  generatedAt: string;
}) {
  return resolveStandaloneHostReportPath({
    category: "host-consumption",
    candidateId: input.candidateId,
    generatedAt: input.generatedAt,
    suffix: "host-consumption-report",
  });
}

export function renderStandaloneResearchVaultHostConsumptionReport(input: {
  generatedAt: string;
  descriptor: StandaloneResearchVaultDescriptor;
  primaryChecker: string;
  supportingCheckers?: string[];
}): StandaloneResearchVaultHostConsumptionReport {
  const hostCallableAdapter =
    buildDescriptorOnlyHostCallableAdapterDescriptor({
      adapterId:
        `${input.descriptor.candidateId}:standalone_host:research_vault_descriptor_callable_adapter`,
      candidateId: input.descriptor.candidateId,
      candidateName: input.descriptor.candidateName,
      hostName: "Directive Kernel standalone host",
      hostSurface: "Directive Kernel standalone host descriptor callable",
      callableSurface: "standalone_host.research_vault_descriptor_summary.v1",
      evidencePaths: {
        promotionRecordPath:
          input.descriptor.linkedArtifacts.runtimePromotionRecordPath,
        promotionSpecificationPath:
          input.descriptor.linkedArtifacts.runtimePromotionSpecificationPath,
        hostSelectionResolutionPath:
          input.descriptor.linkedArtifacts.runtimeHostSelectionResolutionPath,
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
    reportVersion: "standalone_research_vault_host_consumption_report/v1",
    generatedAt: input.generatedAt,
    candidateId: input.descriptor.candidateId,
    candidateName: input.descriptor.candidateName,
    hostName: "Directive Kernel standalone host",
    hostSurface: input.descriptor.hostSurface,
    descriptorSurface: "standalone_host_runtime_research_vault_descriptor",
    promotionRecordPath: input.descriptor.linkedArtifacts.runtimePromotionRecordPath ?? "",
    promotionSpecificationPath:
      input.descriptor.linkedArtifacts.runtimePromotionSpecificationPath ?? "",
    hostSelectionResolutionPath:
      input.descriptor.linkedArtifacts.runtimeHostSelectionResolutionPath,
    acceptance: {
      consumableThroughHost: true,
      descriptorOnly: true,
      runtimeInternalsBypassed: false,
      hostIntegrationClaimed: false,
      runtimeExecutionClaimed: false,
      promotionAutomation: false,
    },
    hostCallableAdapter,
    proof: {
      primaryChecker: input.primaryChecker,
      supportingCheckers: [
        "pnpm run check:standalone-research-vault-host-adapter",
        "pnpm run check:standalone-research-vault-host-adapter-boundary",
        ...(input.supportingCheckers ?? []),
      ],
    },
    stopLine:
      "One fresh Runtime import exposes a read-only standalone-host descriptor and descriptor callable from canonical promotion-record truth; imported-source runtime execution, registry acceptance, and broader host integration remain intentionally unopened.",
  };
}

export function resolveStandaloneResearchVaultHostCallableExecutionReportPath(input: {
  candidateId: string;
  generatedAt: string;
}) {
  return resolveStandaloneHostReportPath({
    category: "host-executions",
    candidateId: input.candidateId,
    generatedAt: input.generatedAt,
    suffix: "host-callable-execution-report",
  });
}

export function renderStandaloneResearchVaultHostCallableExecutionReport(input: {
  generatedAt: string;
  invocationResult: StandaloneResearchVaultDescriptorCallableResult;
  primaryChecker: string;
  supportingCheckers?: string[];
}): StandaloneResearchVaultHostCallableExecutionReport {
  return {
    reportVersion: "standalone_research_vault_host_callable_execution_report/v1",
    generatedAt: input.generatedAt,
    candidateId: input.invocationResult.candidateId,
    candidateName: input.invocationResult.candidateName,
    hostName: "Directive Kernel standalone host",
    hostSurface: input.invocationResult.hostSurface,
    callableSurface: input.invocationResult.callable.callableId,
    promotionRecordPath:
      input.invocationResult.execution.output.evidencePaths.promotionRecordPath,
    promotionSpecificationPath:
      input.invocationResult.execution.output.evidencePaths.promotionSpecificationPath,
    hostSelectionResolutionPath:
      input.invocationResult.execution.output.evidencePaths.hostSelectionResolutionPath,
    sampleInvocation: {
      action: input.invocationResult.callable.action,
      status: input.invocationResult.execution.status,
      descriptorCallableExecuted:
        input.invocationResult.callable.descriptorCallableExecuted,
      summary: input.invocationResult.execution.output.summary,
    },
    acceptance: {
      callableThroughHost: true,
      descriptorCallableOnly: true,
      sourceRuntimeExecutionClaimed:
        input.invocationResult.callable.sourceRuntimeExecutionClaimed,
      hostIntegrationClaimed: input.invocationResult.callable.hostIntegrationClaimed,
      registryAcceptanceClaimed:
        input.invocationResult.callable.registryAcceptanceClaimed,
      promotionAutomation: input.invocationResult.callable.promotionAutomation,
    },
    hostCallableAdapter: input.invocationResult.hostCallableAdapter,
    proof: {
      primaryChecker: input.primaryChecker,
      supportingCheckers: [
        "pnpm run check:standalone-research-vault-host-callable",
        "pnpm run check:standalone-research-vault-host-adapter",
        "pnpm run check:standalone-research-vault-host-adapter-boundary",
        ...(input.supportingCheckers ?? []),
      ],
    },
    stopLine:
      "One fresh Runtime import now has a standalone-host callable descriptor summary; imported-source runtime execution, registry acceptance, promotion automation, and generic host integration remain intentionally unopened.",
  };
}

export function resolveStandaloneResearchVaultSourcePackExecutionReportPath(input: {
  candidateId: string;
  generatedAt: string;
}) {
  return resolveStandaloneHostReportPath({
    category: "host-executions",
    candidateId: input.candidateId,
    generatedAt: input.generatedAt,
    suffix: "source-pack-execution-report",
  });
}

export function renderStandaloneResearchVaultSourcePackExecutionReport(input: {
  generatedAt: string;
  invocationResult: StandaloneResearchVaultSourcePackInvocationResult;
  primaryChecker: string;
  supportingCheckers?: string[];
}): StandaloneResearchVaultSourcePackExecutionReport {
  const rawResult = input.invocationResult.execution.rawResult.result;
  const matchedSections = (
    rawResult
    && typeof rawResult === "object"
    && Array.isArray((rawResult as { matchedSections?: unknown }).matchedSections)
  )
    ? (rawResult as { matchedSections: Array<{ id?: unknown }> }).matchedSections
    : [];

  return {
    reportVersion: "standalone_research_vault_source_pack_execution_report/v1",
    generatedAt: input.generatedAt,
    candidateId: input.invocationResult.candidateId,
    candidateName: input.invocationResult.candidateName,
    hostName: "Directive Kernel standalone host",
    hostSurface: input.invocationResult.hostSurface,
    callableSurface: input.invocationResult.hostCallableAdapter.callableSurface,
    promotionRecordPath: input.invocationResult.adapter.promotionRecordPath,
    promotionSpecificationPath:
      input.invocationResult.adapter.promotionSpecificationPath,
    hostSelectionResolutionPath:
      input.invocationResult.adapter.hostSelectionResolutionPath,
    sampleInvocation: {
      tool: "query-source-pack",
      status: input.invocationResult.execution.rawResult.status,
      persistArtifacts: input.invocationResult.execution.absolutePaths !== null,
      matchedSectionCount: matchedSections.length,
      topSectionId: typeof matchedSections[0]?.id === "string"
        ? matchedSections[0].id
        : null,
    },
    acceptance: {
      callableThroughHost: true,
      descriptorCallableOnly: false,
      runtimeCallableExecution: true,
      sourceRuntimeExecutionClaimed: false,
      hostIntegrationClaimed: true,
      registryAcceptanceClaimed: false,
      promotionAutomation: false,
      runtimeInternalsBypassed: false,
    },
    hostCallableAdapter: input.invocationResult.hostCallableAdapter,
    executionEvidencePath:
      input.invocationResult.execution.absolutePaths === null
        ? null
        : input.invocationResult.execution.record.artifacts.recordPath,
    proof: {
      primaryChecker: input.primaryChecker,
      supportingCheckers: [
        "pnpm run check:standalone-research-vault-host-callable",
        "pnpm run check:runtime-host-callable-adapter-contract",
        ...(input.supportingCheckers ?? []),
      ],
    },
    stopLine:
      "Research Vault source-pack query is a Directive-owned derived execution; the external Research Vault app, registry acceptance, and promotion automation remain unopened.",
  };
}

export function resolveStandaloneBlisspixelDeeprHostConsumptionReportPath(input: {
  candidateId: string;
  generatedAt: string;
}) {
  return resolveStandaloneHostReportPath({
    category: "host-consumption",
    candidateId: input.candidateId,
    generatedAt: input.generatedAt,
    suffix: "host-consumption-report",
  });
}

export function renderStandaloneBlisspixelDeeprHostConsumptionReport(input: {
  generatedAt: string;
  descriptor: StandaloneBlisspixelDeeprDescriptor;
  primaryChecker: string;
  supportingCheckers?: string[];
}): StandaloneBlisspixelDeeprHostConsumptionReport {
  const hostCallableAdapter =
    buildDescriptorOnlyHostCallableAdapterDescriptor({
      adapterId:
        `${input.descriptor.candidateId}:standalone_host:blisspixel_deepr_descriptor_callable_adapter`,
      candidateId: input.descriptor.candidateId,
      candidateName: input.descriptor.candidateName,
      hostName: "Directive Kernel standalone host",
      hostSurface: "Directive Kernel standalone host descriptor callable",
      callableSurface: "standalone_host.blisspixel_deepr_descriptor_summary.v1",
      evidencePaths: {
        promotionRecordPath: input.descriptor.linkedArtifacts.runtimePromotionRecordPath,
        promotionSpecificationPath:
          input.descriptor.linkedArtifacts.runtimePromotionSpecificationPath,
      },
      proof: {
        primaryChecker: "pnpm run check:standalone-blisspixel-deepr-host-callable",
        supportingCheckers: [
          "pnpm run check:runtime-host-callable-adapter-contract",
        ],
      },
      stopLine:
        "blisspixel/deepr exposes a descriptor callable only; imported-source execution, registry acceptance, promotion automation, and generic host integration remain unopened.",
    });

  return {
    reportVersion: "standalone_blisspixel_deepr_host_consumption_report/v1",
    generatedAt: input.generatedAt,
    candidateId: input.descriptor.candidateId,
    candidateName: input.descriptor.candidateName,
    hostName: "Directive Kernel standalone host",
    hostSurface: input.descriptor.hostSurface,
    descriptorSurface: "standalone_host_runtime_blisspixel_deepr_descriptor",
    promotionRecordPath: input.descriptor.linkedArtifacts.runtimePromotionRecordPath ?? "",
    promotionSpecificationPath:
      input.descriptor.linkedArtifacts.runtimePromotionSpecificationPath ?? "",
    acceptance: {
      consumableThroughHost: true,
      descriptorOnly: true,
      runtimeInternalsBypassed: false,
      hostIntegrationClaimed: false,
      runtimeExecutionClaimed: false,
      promotionAutomation: false,
    },
    hostCallableAdapter,
    proof: {
      primaryChecker: input.primaryChecker,
      supportingCheckers: [
        "pnpm run check:standalone-blisspixel-deepr-host-callable",
        "pnpm run check:runtime-host-callable-adapter-contract",
        ...(input.supportingCheckers ?? []),
      ],
    },
    stopLine:
      "One second fresh Runtime import exposes a read-only standalone-host descriptor and descriptor callable from canonical promotion-record truth; imported-source runtime execution, registry acceptance, and broader host integration remain intentionally unopened.",
  };
}

export function resolveStandaloneBlisspixelDeeprHostCallableExecutionReportPath(input: {
  candidateId: string;
  generatedAt: string;
}) {
  return resolveStandaloneHostReportPath({
    category: "host-executions",
    candidateId: input.candidateId,
    generatedAt: input.generatedAt,
    suffix: "host-callable-execution-report",
  });
}

export function renderStandaloneBlisspixelDeeprHostCallableExecutionReport(input: {
  generatedAt: string;
  invocationResult: StandaloneBlisspixelDeeprDescriptorCallableResult;
  primaryChecker: string;
  supportingCheckers?: string[];
}): StandaloneBlisspixelDeeprHostCallableExecutionReport {
  return {
    reportVersion: "standalone_blisspixel_deepr_host_callable_execution_report/v1",
    generatedAt: input.generatedAt,
    candidateId: input.invocationResult.candidateId,
    candidateName: input.invocationResult.candidateName,
    hostName: "Directive Kernel standalone host",
    hostSurface: input.invocationResult.hostSurface,
    callableSurface: input.invocationResult.callable.callableId,
    promotionRecordPath:
      input.invocationResult.execution.output.evidencePaths.promotionRecordPath,
    promotionSpecificationPath:
      input.invocationResult.execution.output.evidencePaths.promotionSpecificationPath,
    sampleInvocation: {
      action: input.invocationResult.callable.action,
      status: input.invocationResult.execution.status,
      descriptorCallableExecuted:
        input.invocationResult.callable.descriptorCallableExecuted,
      summary: input.invocationResult.execution.output.summary,
    },
    acceptance: {
      callableThroughHost: true,
      descriptorCallableOnly: true,
      sourceRuntimeExecutionClaimed:
        input.invocationResult.callable.sourceRuntimeExecutionClaimed,
      hostIntegrationClaimed: input.invocationResult.callable.hostIntegrationClaimed,
      registryAcceptanceClaimed:
        input.invocationResult.callable.registryAcceptanceClaimed,
      promotionAutomation: input.invocationResult.callable.promotionAutomation,
    },
    hostCallableAdapter: input.invocationResult.hostCallableAdapter,
    proof: {
      primaryChecker: input.primaryChecker,
      supportingCheckers: [
        "pnpm run check:standalone-blisspixel-deepr-host-callable",
        "pnpm run check:runtime-host-callable-adapter-contract",
        ...(input.supportingCheckers ?? []),
      ],
    },
    stopLine:
      "One second fresh Runtime import now has a standalone-host callable descriptor summary; imported-source runtime execution, registry acceptance, promotion automation, and generic host integration remain intentionally unopened.",
  };
}
