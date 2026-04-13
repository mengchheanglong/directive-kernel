import fs from "node:fs";
import path from "node:path";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

import type { DiscoveryHostStorageBridge } from "../integration-kit/starter/discovery-submission-adapter.template.ts";
import { resolveDirectiveWorkspaceState } from "../../engine/state/index.ts";
import {
  DIRECTIVE_RUNTIME_TO_HOST_CONTRACT_PATH,
  readDirectiveRuntimePromotionSpecification,
} from "../../runtime/lib/runtime-promotion-specification.ts";
import {
  readRuntimeHostSelectionResolution,
} from "../../runtime/lib/runtime-host-selection-resolution.ts";
import {
  buildDescriptorOnlyHostCallableAdapterDescriptor,
  buildRuntimeCallableExecutionHostAdapterDescriptor,
  type RuntimeHostCallableAdapterDescriptor,
} from "../../runtime/lib/runtime-host-callable-adapter-contract.ts";
import {
  renderRuntimeFollowUpRecord,
  resolveRuntimeFollowUpRecordPath,
  type RuntimeFollowUpRecordRequest,
} from "../../runtime/lib/runtime-follow-up-record-writer.ts";
import {
  renderRuntimeRecord,
  resolveRuntimeRecordPath,
  type RuntimeRecordRequest,
} from "../../runtime/lib/runtime-record-writer.ts";
import {
  renderRuntimeProofChecklist,
  resolveRuntimeProofChecklistPath,
  resolveRuntimeProofGateSnapshotPath,
  type RuntimeProofBundleRequest,
} from "../../runtime/lib/runtime-proof-bundle-writer.ts";
import {
  renderRuntimeTransformationProof,
  resolveRuntimeTransformationProofPath,
  type RuntimeTransformationProofRequest,
} from "../../runtime/lib/runtime-transformation-proof-writer.ts";
import {
  renderRuntimeTransformationRecord,
  resolveRuntimeTransformationRecordPath,
  type RuntimeTransformationRecordRequest,
} from "../../runtime/lib/runtime-transformation-record-writer.ts";
import {
  renderRuntimePromotionRecord,
  resolveRuntimePromotionRecordPath,
  type RuntimePromotionRecordRequest,
} from "../../runtime/lib/runtime-promotion-record-writer.ts";
import {
  renderRuntimeRegistryEntry,
  resolveRuntimeRegistryEntryPath,
  type RuntimeRegistryEntryRequest,
} from "../../runtime/lib/runtime-registry-entry-writer.ts";
import {
  assertRuntimeRegistryAcceptanceGate,
} from "../../runtime/lib/runtime-registry-acceptance-gate.ts";
import {
  runDirectiveRuntimeCallableExecution,
  type DirectiveRuntimeCallableExecutionRunResult,
} from "../../runtime/core/callable-execution.ts";

function resolveDirectivePathLike(
  storage: DiscoveryHostStorageBridge,
  filePath: string,
) {
  const normalized = String(filePath).trim();
  if (!normalized) {
    return normalized;
  }

  if (path.isAbsolute(normalized)) {
    return normalizeAbsolutePath(normalized);
  }

  return storage.resolveWithinDirectiveRoot(normalized);
}

function assertDirectivePathExists(filePath: string, fieldName: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${fieldName}_not_found`);
  }
}

function listMarkdownFiles(dirPath: string) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => normalizeAbsolutePath(path.join(dirPath, entry.name)))
    .sort();
}

function listJsonFiles(dirPath: string) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => normalizeAbsolutePath(path.join(dirPath, entry.name)))
    .sort();
}

function readField(content: string, label: string) {
  const match = content.match(
    new RegExp(`^-\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(.*)$`, "im"),
  );
  return match ? match[1].trim().replace(/^`|`$/g, "") : null;
}

function readHeading(content: string) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

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

const LIVE_MINI_SWE_CALLABLE_BOUNDARY: StandaloneLiveMiniSweCallableBoundaryDescriptor = {
  inputShape: [
    "task",
    "repositoryContext",
    "constraints",
  ],
  outputShape: [
    "summary",
    "changedFiles",
    "proofNotes",
    "rollbackBoundary",
  ],
  description:
    "Bounded live mini-swe callable boundary descriptor retained for compatibility with the standalone host surface.",
  safetyRules: [
    "host descriptor only unless the consuming project provides the real promoted Runtime chain",
    "no imported-source execution claim",
    "no promotion or registry implication",
  ],
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

const SCIENTIFY_PROMOTION_READINESS_RELATIVE_PATH =
  "runtime/05-promotion-readiness/2026-03-27-dw-source-scientify-research-workflow-plugin-2026-03-27-promotion-readiness.md";
const SCIENTIFY_PRE_PROMOTION_SLICE_RELATIVE_PATH =
  "runtime/00-follow-up/2026-03-27-dw-source-scientify-research-workflow-plugin-2026-03-27-standalone-host-pre-promotion-implementation-slice-01.md";
const SCIENTIFY_IMPLEMENTATION_SLICE_RELATIVE_PATH =
  "runtime/00-follow-up/2026-03-27-dw-source-scientify-research-workflow-plugin-2026-03-27-standalone-host-runtime-implementation-slice-01.md";
const STANDALONE_HOST_TARGET =
  "Directive Kernel standalone host (hosts/standalone-host/)";
const SCIENTIFY_DESCRIPTOR_TOOLS: StandaloneScientifyToolDescriptor[] = [
  {
    tool: "arxiv-search",
    functionName: "arxivSearch",
    modulePath: "runtime/capabilities/literature-access/arxiv-search.ts",
  },
  {
    tool: "arxiv-download",
    functionName: "arxivDownload",
    modulePath: "runtime/capabilities/literature-access/arxiv-download.ts",
  },
  {
    tool: "openalex-search",
    functionName: "openalexSearch",
    modulePath: "runtime/capabilities/literature-access/openalex-search.ts",
  },
  {
    tool: "unpaywall-download",
    functionName: "unpaywallDownload",
    modulePath: "runtime/capabilities/literature-access/unpaywall-download.ts",
  },
];

const LIVE_MINI_SWE_PROMOTION_READINESS_RELATIVE_PATH =
  "runtime/05-promotion-readiness/2026-03-24-dw-live-mini-swe-agent-engine-pressure-2026-03-24-promotion-readiness.md";
const LIVE_MINI_SWE_PRE_PROMOTION_SLICE_RELATIVE_PATH =
  "runtime/00-follow-up/2026-04-02-dw-live-mini-swe-agent-engine-pressure-2026-03-24-standalone-host-pre-promotion-implementation-slice-01.md";
const LIVE_MINI_SWE_IMPLEMENTATION_SLICE_RELATIVE_PATH =
  "runtime/00-follow-up/2026-04-02-dw-live-mini-swe-agent-engine-pressure-2026-03-24-standalone-host-runtime-implementation-slice-01.md";
const RESEARCH_VAULT_PROMOTION_RECORD_RELATIVE_PATH =
  "runtime/07-promotion-records/2026-04-07-research-engine-web-aakashsharan-com-research-va-20260407t052643z-20260407t052702.-promotion-record.md";
const BLISSPIXEL_DEEPR_PROMOTION_RECORD_RELATIVE_PATH =
  "runtime/07-promotion-records/2026-04-07-research-engine-repo-blisspixel-deepr-20260407t052643z-20260407t072402.-promotion-record.md";

export function resolveStandaloneScientifyHostConsumptionReportPath(input: {
  candidateId: string;
  generatedAt: string;
}) {
  const date = input.generatedAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
  return path
    .join(
      "runtime",
      "standalone-host",
      "host-consumption",
      `${date}-${input.candidateId}-host-consumption-report.json`,
    )
    .replace(/\\/g, "/");
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
  const date = input.generatedAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
  return path
    .join(
      "runtime",
      "standalone-host",
      "host-consumption",
      `${date}-${input.candidateId}-host-consumption-report.json`,
    )
    .replace(/\\/g, "/");
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
  const date = input.generatedAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
  return path
    .join(
      "runtime",
      "standalone-host",
      "host-executions",
      `${date}-${input.candidateId}-host-callable-execution-report.json`,
    )
    .replace(/\\/g, "/");
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
  const date = input.generatedAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
  return path
    .join(
      "runtime",
      "standalone-host",
      "host-executions",
      `${date}-${input.candidateId}-source-pack-execution-report.json`,
    )
    .replace(/\\/g, "/");
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
  const date = input.generatedAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
  return path
    .join(
      "runtime",
      "standalone-host",
      "host-consumption",
      `${date}-${input.candidateId}-host-consumption-report.json`,
    )
    .replace(/\\/g, "/");
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
        promotionRecordPath:
          input.descriptor.linkedArtifacts.runtimePromotionRecordPath,
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
  const date = input.generatedAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
  return path
    .join(
      "runtime",
      "standalone-host",
      "host-executions",
      `${date}-${input.candidateId}-host-callable-execution-report.json`,
    )
    .replace(/\\/g, "/");
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

export async function writeStandaloneRuntimeFollowUp(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimeFollowUpRecordRequest;
}) {
  const request = {
    ...input.request,
    promotion_contract_path: input.request.promotion_contract_path
      ? resolveDirectivePathLike(input.storage, input.request.promotion_contract_path)
      : input.request.promotion_contract_path,
    reentry_contract_path: input.request.reentry_contract_path
      ? resolveDirectivePathLike(input.storage, input.request.reentry_contract_path)
      : input.request.reentry_contract_path,
    linked_handoff_path: input.request.linked_handoff_path
      ? resolveDirectivePathLike(input.storage, input.request.linked_handoff_path)
      : input.request.linked_handoff_path,
    linked_runtime_record_path: input.request.linked_runtime_record_path
      ? resolveDirectivePathLike(input.storage, input.request.linked_runtime_record_path)
      : input.request.linked_runtime_record_path,
    linked_proof_checklist_path: input.request.linked_proof_checklist_path
      ? resolveDirectivePathLike(
          input.storage,
          input.request.linked_proof_checklist_path,
        )
      : input.request.linked_proof_checklist_path,
    linked_live_proof_path: input.request.linked_live_proof_path
      ? resolveDirectivePathLike(input.storage, input.request.linked_live_proof_path)
      : input.request.linked_live_proof_path,
  } satisfies RuntimeFollowUpRecordRequest;

  const relativePath = resolveRuntimeFollowUpRecordPath({
    candidate_id: request.candidate_id,
    follow_up_date: request.follow_up_date,
    output_relative_path: request.output_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  await input.storage.writeText(absolutePath, renderRuntimeFollowUpRecord(request));

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    candidate_id: request.candidate_id,
  };
}

export async function writeStandaloneRuntimeRecord(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimeRecordRequest;
}) {
  const request = {
    ...input.request,
    origin_path: resolveDirectivePathLike(input.storage, input.request.origin_path),
    linked_follow_up_record: resolveDirectivePathLike(
      input.storage,
      input.request.linked_follow_up_record,
    ),
    required_proof: resolveDirectivePathLike(
      input.storage,
      input.request.required_proof,
    ),
    supporting_contracts: (input.request.supporting_contracts ?? []).map((value) =>
      resolveDirectivePathLike(input.storage, value)
    ),
  } satisfies RuntimeRecordRequest;

  const relativePath = resolveRuntimeRecordPath({
    candidate_id: request.candidate_id,
    runtime_record_date: request.runtime_record_date,
    output_relative_path: request.output_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  await input.storage.writeText(absolutePath, renderRuntimeRecord(request));

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    candidate_id: request.candidate_id,
  };
}

export async function writeStandaloneRuntimeProofBundle(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimeProofBundleRequest;
}) {
  const linkedRuntimeRecord = resolveDirectivePathLike(
    input.storage,
    input.request.linked_runtime_record,
  );
  assertDirectivePathExists(linkedRuntimeRecord, "linked_runtime_record");

  const request = {
    ...input.request,
    linked_runtime_record: linkedRuntimeRecord,
    source_proof_artifacts: (input.request.source_proof_artifacts ?? []).map((value) =>
      resolveDirectivePathLike(input.storage, value)
    ),
  } satisfies RuntimeProofBundleRequest;

  const relativePath = resolveRuntimeProofChecklistPath({
    candidate_id: request.candidate_id,
    proof_date: request.proof_date,
    output_relative_path: request.output_relative_path,
  });
  const gateSnapshotRelativePath = resolveRuntimeProofGateSnapshotPath({
    candidate_id: request.candidate_id,
    proof_date: request.proof_date,
    gate_snapshot_relative_path: request.gate_snapshot_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  const gateSnapshotPath =
    input.storage.resolveWithinDirectiveRoot(gateSnapshotRelativePath);

  await input.storage.writeJson(gateSnapshotPath, request.gate_snapshot);
  await input.storage.writeText(
    absolutePath,
    renderRuntimeProofChecklist({
      request,
      gateSnapshotPath,
    }),
  );

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    gateSnapshotPath,
    gateSnapshotRelativePath,
    candidate_id: request.candidate_id,
  };
}

export async function writeStandaloneRuntimeTransformationProof(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimeTransformationProofRequest;
}) {
  const relativePath = resolveRuntimeTransformationProofPath({
    candidate_id: input.request.candidate_id,
    proof_date: input.request.proof_date,
    output_relative_path: input.request.output_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  await input.storage.writeJson(
    absolutePath,
    renderRuntimeTransformationProof(input.request),
  );

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    candidate_id: input.request.candidate_id,
  };
}

export async function writeStandaloneRuntimeTransformationRecord(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimeTransformationRecordRequest;
}) {
  const request = {
    ...input.request,
    discovery_intake_path: resolveDirectivePathLike(
      input.storage,
      input.request.discovery_intake_path,
    ),
    baseline_artifact_path: resolveDirectivePathLike(
      input.storage,
      input.request.baseline_artifact_path,
    ),
    result_artifact_path: resolveDirectivePathLike(
      input.storage,
      input.request.result_artifact_path,
    ),
    promotion_record: input.request.promotion_record
      ? resolveDirectivePathLike(input.storage, input.request.promotion_record)
      : input.request.promotion_record,
  } satisfies RuntimeTransformationRecordRequest;

  assertDirectivePathExists(request.baseline_artifact_path, "baseline_artifact_path");
  assertDirectivePathExists(request.result_artifact_path, "result_artifact_path");

  const relativePath = resolveRuntimeTransformationRecordPath({
    candidate_id: request.candidate_id,
    record_date: request.record_date,
    output_relative_path: request.output_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  await input.storage.writeText(
    absolutePath,
    renderRuntimeTransformationRecord(request),
  );

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    candidate_id: request.candidate_id,
  };
}

export async function writeStandaloneRuntimePromotionRecord(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimePromotionRecordRequest;
}) {
  const linkedRuntimeRecord = resolveDirectivePathLike(
    input.storage,
    input.request.linked_runtime_record,
  );
  const sourceIntentArtifact = resolveDirectivePathLike(
    input.storage,
    input.request.source_intent_artifact,
  );
  const compileContractArtifact = resolveDirectivePathLike(
    input.storage,
    input.request.compile_contract_artifact,
  );
  const proofPath = resolveDirectivePathLike(input.storage, input.request.proof_path);
  assertDirectivePathExists(linkedRuntimeRecord, "linked_runtime_record");
  assertDirectivePathExists(sourceIntentArtifact, "source_intent_artifact");
  assertDirectivePathExists(proofPath, "proof_path");

  const request = {
    ...input.request,
    linked_runtime_record: linkedRuntimeRecord,
    source_intent_artifact: sourceIntentArtifact,
    compile_contract_artifact: compileContractArtifact,
    proof_path: proofPath,
  } satisfies RuntimePromotionRecordRequest;

  const relativePath = resolveRuntimePromotionRecordPath({
    candidate_id: request.candidate_id,
    promotion_date: request.promotion_date,
    output_relative_path: request.output_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  await input.storage.writeText(absolutePath, renderRuntimePromotionRecord(request));

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    candidate_id: request.candidate_id,
  };
}

export async function writeStandaloneRuntimeRegistryEntry(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimeRegistryEntryRequest;
}) {
  if (input.request.acceptance_gate) {
    assertRuntimeRegistryAcceptanceGate({
      directiveRoot: input.storage.directiveRoot,
      request: input.request,
    });
  }

  const linkedPromotionRecord = resolveDirectivePathLike(
    input.storage,
    input.request.linked_promotion_record,
  );
  const proofPath = resolveDirectivePathLike(input.storage, input.request.proof_path);
  assertDirectivePathExists(linkedPromotionRecord, "linked_promotion_record");
  assertDirectivePathExists(proofPath, "proof_path");

  const request = {
    ...input.request,
  } satisfies RuntimeRegistryEntryRequest;

  const relativePath = resolveRuntimeRegistryEntryPath({
    candidate_id: request.candidate_id,
    registry_date: request.registry_date,
    output_relative_path: request.output_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  await input.storage.writeText(absolutePath, renderRuntimeRegistryEntry(request));

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    candidate_id: request.candidate_id,
  };
}

export function readStandaloneRuntimeOverview(input: {
  directiveRoot: string;
  maxEntries?: number;
}): StandaloneRuntimeOverviewSummary {
  const followUpDir = normalizeAbsolutePath(
    path.resolve(input.directiveRoot, "runtime", "follow-up"),
  );
  const recordsDir = normalizeAbsolutePath(
    path.resolve(input.directiveRoot, "runtime", "records"),
  );
  const transformationRecordFiles = listMarkdownFiles(recordsDir).filter(
    (filePath) =>
      !filePath.endsWith("/README.md")
      && filePath.endsWith("-transformation-record.md"),
  );
  const proofChecklistFiles = listMarkdownFiles(recordsDir).filter(
    (filePath) =>
      !filePath.endsWith("/README.md")
      && /-proof-checklist(?:-artifact)?\.md$/i.test(filePath),
  );
  const transformationProofFiles = listJsonFiles(recordsDir).filter((filePath) =>
    filePath.endsWith("-transformation-proof.json")
  );
  const promotionRecordsDir = normalizeAbsolutePath(
    path.resolve(input.directiveRoot, "runtime", "07-promotion-records"),
  );
  const registryDir = normalizeAbsolutePath(
    path.resolve(input.directiveRoot, "runtime", "registry"),
  );
  const followUpFiles = listMarkdownFiles(followUpDir).filter(
    (filePath) => !filePath.endsWith("/README.md") && !filePath.endsWith("/.gitkeep"),
  );
  const recordFiles = listMarkdownFiles(recordsDir).filter(
    (filePath) => !filePath.endsWith("/README.md") && filePath.endsWith("-runtime-record.md"),
  );
  const promotionRecordFiles = listMarkdownFiles(promotionRecordsDir).filter(
    (filePath) =>
      !filePath.endsWith("/README.md")
      && !filePath.endsWith("-runtime-promotion-backlog.md")
      && filePath.endsWith("-promotion-record.md"),
  );
  const registryEntryFiles = listMarkdownFiles(registryDir).filter(
    (filePath) =>
      !filePath.endsWith("/README.md") && filePath.endsWith("-registry-entry.md"),
  );

  const recentEntries = [
    ...followUpFiles,
    ...recordFiles,
    ...proofChecklistFiles,
    ...transformationRecordFiles,
    ...transformationProofFiles,
    ...promotionRecordFiles,
    ...registryEntryFiles,
  ]
    .map((filePath) => {
      const isJson = filePath.endsWith(".json");
      const content = fs.readFileSync(filePath, "utf8");
      const json =
        isJson && content.trim().length > 0
          ? (JSON.parse(content) as Record<string, unknown>)
          : null;
      const kind = filePath.includes("/runtime/00-follow-up/")
        || filePath.includes("/runtime/follow-up/")
        ? ("follow_up" as const)
        : filePath.includes("/runtime/legacy-records/")
          || filePath.includes("/runtime/records/")
          ? /-proof-checklist(?:-artifact)?\.md$/i.test(filePath)
            ? ("proof_bundle" as const)
            : filePath.endsWith("-transformation-record.md")
              ? ("transformation_record" as const)
              : filePath.endsWith("-transformation-proof.json")
                ? ("transformation_proof" as const)
            : ("record" as const)
          : filePath.includes("/runtime/07-promotion-records/")
            ? ("promotion_record" as const)
            : ("registry_entry" as const);
      return {
        kind,
        path: filePath,
        title:
          kind === "transformation_proof"
            ? `Transformation Proof: ${String(json?.candidate_id ?? "unknown")}`
            : readHeading(content),
        candidateId:
          kind === "transformation_proof"
            ? String(json?.candidate_id ?? "").trim() || null
            : readField(content, "Candidate id") ?? readField(content, "Capability id"),
        candidateName:
          kind === "transformation_proof"
            ? null
            : readField(content, "Candidate name")
              ?? readField(content, "Capability name"),
        status:
          kind === "follow_up"
            ? readField(content, "Current status")
            : kind === "record"
              ? readField(content, "Current status")
              : kind === "proof_bundle"
                ? readField(content, "Status")
                : kind === "transformation_record"
                  ? readField(content, "Decision state")
                  : kind === "transformation_proof"
                    ? Array.isArray(json?.regression_checks)
                      && (json?.regression_checks as Array<Record<string, unknown>>).length > 0
                      ? (json?.regression_checks as Array<Record<string, unknown>>).every(
                          (check) => check.result === "pass",
                        )
                        ? "pass"
                        : "fail"
                      : null
              : kind === "promotion_record"
                ? readField(content, "Promotion decision")
                : readField(content, "Runtime status"),
        mtime: fs.statSync(filePath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtime - left.mtime)
    .slice(0, input.maxEntries ?? 8)
    .map(({ mtime: _mtime, ...entry }) => entry);

  return {
    followUpCount: followUpFiles.length,
    recordCount: recordFiles.length,
    proofBundleCount: proofChecklistFiles.length,
    transformationRecordCount: transformationRecordFiles.length,
    transformationProofCount: transformationProofFiles.length,
    promotionRecordCount: promotionRecordFiles.length,
    registryEntryCount: registryEntryFiles.length,
    recentEntries,
  };
}

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
          "pnpm run check:runtime-host-callable-adapter-contract",
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
          "pnpm run check:runtime-host-callable-adapter-contract",
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
