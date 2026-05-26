import path from "node:path";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

import type { DiscoverySubmissionRequest } from "../../discovery/lib/front-door/submission-router.ts";
import { submitDirectiveDiscoveryFrontDoor } from "../../discovery/lib/front-door/front-door.ts";
import { openDirectiveDiscoveryRoute } from "../../discovery/lib/routing/route-opener.ts";
import { openDirectiveRuntimeFollowUp } from "../../runtime/lib/openers/follow-up.ts";
import { openDirectiveRuntimeRecordProof } from "../../runtime/lib/openers/record-proof-opener.ts";
import { openDirectiveRuntimeProofRuntimeCapabilityBoundary } from "../../runtime/lib/openers/proof-runtime-capability-boundary-opener.ts";
import { openDirectiveRuntimePromotionReadiness } from "../../runtime/lib/openers/promotion-readiness.ts";
import {
  type RuntimeHostSelectionResolutionInput,
  writeRuntimeHostSelectionResolution as writeRuntimeHostSelectionResolutionArtifact,
} from "../../runtime/lib/host/selection-resolution.ts";
import {
  createFilesystemEngineStore,
  Engine,
  createDirectiveWorkspaceEngineLanes,
  type EngineMissionInput,
  type EnginePlanProgressUpdate,
  type EngineRunRecord,
  type EngineSourceItem,
} from "../../engine/index.ts";
import { normalizeEngineSourceTypeInput } from "../../engine/source-type-normalization.ts";
import { resolveEngineStoreRecordPath } from "../../engine/storage.ts";
import {
  buildManualRuntimePromotionRecordRequest,
  buildManualRuntimeRegistryAcceptanceRequest,
} from "../../engine/coordination/runtime-manual-actions.ts";
import type {
  ResolvedStandaloneHostConfig,
  ResolvedStandaloneHostPersistence,
} from "./config.ts";
import {
  readDiscoveryOverviewWithHostBridge,
  type DiscoveryOverviewSummary,
} from "../integration-kit/lib/discovery-overview-reader.ts";
import {
  createFilesystemDiscoveryHostStorageBridge,
} from "../integration-kit/lib/discovery-host-storage-bridge.filesystem.ts";
import {
  submitDiscoveryEntryWithHostBridge,
} from "../integration-kit/lib/discovery-submission-adapter.ts";
import { createStandaloneHostPersistenceLedger } from "./persistence.ts";
import type { RuntimeFollowUpRecordRequest } from "../../runtime/lib/writers/follow-up-record-writer.ts";
import type { RuntimeProofBundleRequest } from "../../runtime/lib/writers/proof-bundle-writer.ts";
import type { RuntimePromotionRecordRequest } from "../../runtime/lib/writers/promotion-record-writer.ts";
import type { RuntimeRegistryEntryRequest } from "../../runtime/lib/writers/registry-entry-writer.ts";
import type { RuntimeRecordRequest } from "../../runtime/lib/writers/record-writer.ts";
import type { RuntimeTransformationProofRequest } from "../../runtime/lib/writers/transformation-proof-writer.ts";
import type { RuntimeTransformationRecordRequest } from "../../runtime/lib/writers/transformation-record-writer.ts";
import { describeEngineGapPressure } from "../../engine/execution/run-artifacts.ts";

type JsonValue = Record<string, unknown>;

export const DEFAULT_STANDALONE_HOST_NAME =
  "Directive Kernel Standalone Host";

export type CreateStandaloneFilesystemHostOptions = {
  directiveRoot: string;
  unresolvedGapIds?: string[];
  receivedAt?: string;
  initialQueue?: JsonValue;
  persistence?: ResolvedStandaloneHostPersistence;
  runtimeArtifactsRoot?: string;
  allowExternalFetches?: boolean;
};

function normalizeRelativeDirectivePath(
  directiveRoot: string,
  filePath: string,
) {
  return path.relative(directiveRoot, filePath).replace(/\\/g, "/");
}

function normalizeStandaloneHostReceivedAt(value: string | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return new Date().toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized}T00:00:00.000Z`;
  }
  return normalized;
}

function buildEngineSourceFromDiscoverySubmission(
  request: DiscoverySubmissionRequest,
): EngineSourceItem {
  const sourceTypeNormalization = normalizeEngineSourceTypeInput(
    request.source_type ?? "internal-signal",
  );
  const notes = [
    typeof request.notes === "string" ? request.notes : null,
    request.record_shape ? `record_shape:${request.record_shape}` : null,
  ].filter((value): value is string => Boolean(value && value.trim()));
  const summary =
    request.mission_alignment?.trim()
    || "Discovery front-door submission processed by the standalone host.";

  return {
    sourceId: request.candidate_id,
    sourceType: sourceTypeNormalization.canonicalSourceType,
    sourceRef: request.source_reference,
    title: request.candidate_name,
    summary,
    notes,
    missionAlignmentHint: request.mission_alignment ?? null,
    capabilityGapId: request.capability_gap_id ?? null,
    primaryAdoptionTarget: request.primary_adoption_target ?? null,
    containsExecutableCode: request.contains_executable_code ?? null,
    containsWorkflowPattern: request.contains_workflow_pattern ?? null,
    improvesDirectiveWorkspace: request.improves_directive_workspace ?? null,
    workflowBoundaryShape: request.workflow_boundary_shape ?? null,
  };
}

function buildEngineMissionFromDiscoverySubmission(
  request: DiscoverySubmissionRequest,
): EngineMissionInput {
  const currentObjective =
    request.mission_alignment?.trim()
    || `Assess ${request.candidate_name} for Directive Kernel usefulness.`;

  return {
    missionId: null,
    currentObjective,
    usefulnessSignals: [
      "mission-relevant usefulness",
      "safe routing through Discovery, Runtime, or Architecture",
    ],
    capabilityLanes: [
      "Discovery lane intake and routing",
      "Architecture lane engine self-improvement",
      "Runtime lane runtime usefulness conversion",
    ],
  };
}

function resolveStandaloneHostEngineArtifactPaths(input: {
  directiveRoot: string;
  runtimeArtifactsRoot: string;
  record: EngineRunRecord;
}) {
  const runtimeArtifactsRoot = normalizeAbsolutePath(input.runtimeArtifactsRoot);
  const engineRunsRoot = normalizeAbsolutePath(path.resolve(runtimeArtifactsRoot, "engine-runs"));
  const recordPath = normalizeAbsolutePath(resolveEngineStoreRecordPath({
    engineRunsRoot,
    record: input.record,
  }));
  const reportPath = normalizeAbsolutePath(recordPath.replace(/\.json$/u, ".md"));

  return {
    recordPath,
    reportPath,
    recordRelativePath: normalizeRelativeDirectivePath(input.directiveRoot, recordPath),
    reportRelativePath: normalizeRelativeDirectivePath(input.directiveRoot, reportPath),
  };
}

function renderStandaloneHostEngineRunReport(input: {
  record: EngineRunRecord;
  artifactPaths: {
    recordRelativePath: string;
  };
}) {
  const { record } = input;
  const gapPressure = describeEngineGapPressure(record);

  return [
    "# Directive Engine Run",
    "",
    `- Run ID: \`${record.runId}\``,
    `- Received At: \`${record.receivedAt}\``,
    `- Candidate ID: \`${record.candidate.candidateId}\``,
    `- Candidate Name: ${record.candidate.candidateName}`,
    `- Source Type: \`${record.source.sourceType}\``,
    `- Source Ref: \`${record.source.sourceRef}\``,
    `- Schema version: \`${record.schemaVersion ?? "n/a"}\``,
    `- Schema ref: \`${record.$schema ?? "n/a"}\``,
    `- Selected Lane: \`${record.selectedLane.laneId}\``,
    `- Usefulness Level: \`${record.candidate.usefulnessLevel}\``,
    `- Decision State: \`${record.decision.decisionState}\``,
    `- Integration Mode: \`${record.integrationProposal.integrationMode}\``,
    `- Proof Kind: \`${record.proofPlan.proofKind}\``,
    `- Run Record Path: \`${input.artifactPaths.recordRelativePath}\``,
    "",
    "## Mission Fit",
    "",
    record.analysis.missionFitSummary,
    "",
    "## Usefulness Rationale",
    "",
    record.analysis.usefulnessRationale,
    "",
    "## Report Summary",
    "",
    record.reportPlan.summary,
    "",
    "## Routing Rationale",
    "",
    ...record.candidate.rationale.map((entry) => `- ${entry}`),
    "",
    "## Routing Explanation Breakdown",
    "",
    ...record.routingAssessment.explanationBreakdown.keywordSignals.map((entry) => `- Keyword: ${entry}`),
    ...record.routingAssessment.explanationBreakdown.metadataSignals.map((entry) => `- Metadata: ${entry}`),
    ...record.routingAssessment.explanationBreakdown.gapAlignmentSignals.map((entry) => `- Gap: ${entry}`),
    ...record.routingAssessment.explanationBreakdown.ambiguitySignals.map((entry) => `- Ambiguity: ${entry}`),
    "",
    "## Gap Pressure",
    "",
    `- Open gaps considered: \`${gapPressure.openGapCount}\``,
    `- Gap alignment score: \`${gapPressure.gapAlignmentScore ?? "n/a"}\``,
    `- Matched gap: \`${gapPressure.matchedGapId ?? "n/a"}\``,
    `- Gap rank: \`${gapPressure.matchedGapRank ?? "n/a"}\``,
    `- Gap priority: \`${gapPressure.matchedGapPriority ?? "n/a"}\``,
    `- Gap description: ${gapPressure.matchedGapDescription ?? "n/a"}`,
    `- Related mission objective: ${gapPressure.relatedMissionObjective ?? "n/a"}`,
    `- Current state: ${gapPressure.currentState ?? "n/a"}`,
    `- Desired state: ${gapPressure.desiredState ?? "n/a"}`,
    "",
    "## Review Handling Guidance",
    "",
    ...(record.routingAssessment.reviewGuidance
      ? [
          `- Guidance kind: \`${record.routingAssessment.reviewGuidance.guidanceKind}\``,
          `- Summary: ${record.routingAssessment.reviewGuidance.summary}`,
          `- Operator action: ${record.routingAssessment.reviewGuidance.operatorAction}`,
          ...record.routingAssessment.reviewGuidance.requiredChecks.map((entry) => `- Required check: ${entry}`),
          `- Stop-line: ${record.routingAssessment.reviewGuidance.stopLine}`,
        ]
      : ["- No additional review guidance beyond the normal bounded approval path."]),
    "",
    "## Gap Radar",
    "",
    `- Summary: ${record.routingAssessment.gapRadar?.summary ?? "n/a"}`,
    ...(record.routingAssessment.gapRadar?.suggestions.map((entry) =>
      `- Suggestion: ${entry.targetLaneId} | ${entry.confidence} confidence | ${entry.evidenceCount} events | ${entry.summary} | Recommended change: ${entry.recommendedChange} | Signals: ${entry.signalTokens.join(", ") || "none"} | Related open gap: ${entry.relatedOpenGapId ?? "n/a"} | Suggested priority: ${entry.suggestedPriority}`
    ) ?? []),
    "",
    "## Earned Autonomy",
    "",
    `- Route class: ${record.routingAssessment.earnedAutonomy.routeClass}`,
    `- Overall score: ${record.routingAssessment.earnedAutonomy.overallScore}/100`,
    `- Evidence count: ${record.routingAssessment.earnedAutonomy.evidenceCount}`,
    `- Operator agreement rate: ${record.routingAssessment.earnedAutonomy.operatorAgreementRate == null ? "n/a" : `${Math.round(record.routingAssessment.earnedAutonomy.operatorAgreementRate * 100)}%`}`,
    `- Review clear rate: ${record.routingAssessment.earnedAutonomy.reviewClearRate == null ? "n/a" : `${Math.round(record.routingAssessment.earnedAutonomy.reviewClearRate * 100)}%`}`,
    `- Reversal count: ${record.routingAssessment.earnedAutonomy.reversalCount}`,
    `- Auto-approval eligible: ${record.routingAssessment.earnedAutonomy.autoApprovalEligible ? "yes" : "no"}`,
    `- Approval reduction applied: ${record.routingAssessment.earnedAutonomy.approvalReductionApplied ? "yes" : "no"}`,
    `- Summary: ${record.routingAssessment.earnedAutonomy.summary}`,
    ...record.routingAssessment.earnedAutonomy.rationale.map((entry) => `- Rationale: ${entry}`),
    "",
    "## Next Action",
    "",
    record.integrationProposal.nextAction,
    "",
  ].join("\n");
}

async function loadStandaloneRuntimeOperationsModule() {
  return import("./runtime/operations.ts");
}

async function loadStandaloneAcceptanceModule() {
  return import("../integration-kit/lib/run-host-integration-acceptance-quickstart.ts");
}

export function createStandaloneFilesystemHost(
  options: CreateStandaloneFilesystemHostOptions,
) {
  const harness = createFilesystemDiscoveryHostStorageBridge({
    directiveRoot: options.directiveRoot,
    unresolvedGapIds: options.unresolvedGapIds,
    receivedAt: options.receivedAt,
    initialQueue: options.initialQueue,
  });
  const persistenceLedger = createStandaloneHostPersistenceLedger({
    persistence: options.persistence,
  });
  const runtimeArtifactsRoot = normalizeAbsolutePath(
    options.runtimeArtifactsRoot
      ?? path.resolve(options.directiveRoot, "runtime", "host-artifacts"),
  );
  const storage = {
    ...harness.bridge,
    async writeJson(filePath: string, value: unknown) {
      await harness.bridge.writeJson(filePath, value);
      persistenceLedger.recordJsonArtifact(filePath, value, "json_artifact");
    },
    async writeText(filePath: string, content: string) {
      await harness.bridge.writeText(filePath, content);
      persistenceLedger.recordTextArtifact(filePath, content, "text_artifact");
    },
  };
  const createEngine = () => new Engine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: createFilesystemEngineStore({
      engineRunsRoot: path.resolve(runtimeArtifactsRoot, "engine-runs"),
    }),
  });

  return {
    directiveRoot: harness.directiveRoot,
    runtimeArtifactsRoot,
    receivedAt: options.receivedAt,
    unresolvedGapIds: [...(options.unresolvedGapIds ?? [])],
    persistence: persistenceLedger.describe(),
    storage,
    submitDiscoveryEntry(
      request: DiscoverySubmissionRequest,
      dryRun = false,
    ) {
      return submitDiscoveryEntryWithHostBridge({
        request,
        storage,
        dryRun,
      });
    },
    async submitDiscoveryFrontDoor(
      request: DiscoverySubmissionRequest,
    ) {
      return submitDirectiveDiscoveryFrontDoor({
        directiveRoot: harness.directiveRoot,
        request,
        runtimeArtifactsRoot,
        receivedAt: options.receivedAt ?? harness.bridge.receivedAt,
      });
    },
    async openDiscoveryRoute(input: {
      routingPath: string;
      approved?: boolean;
      approvedBy?: string | null;
    }) {
      return openDirectiveDiscoveryRoute({
        directiveRoot: harness.directiveRoot,
        routingPath: input.routingPath,
        approved: input.approved,
        approvedBy: input.approvedBy,
      });
    },
    async openRuntimeFollowUp(input: {
      followUpPath: string;
      approved?: boolean;
      approvedBy?: string | null;
    }) {
      return openDirectiveRuntimeFollowUp({
        directiveRoot: harness.directiveRoot,
        followUpPath: input.followUpPath,
        approved: input.approved,
        approvedBy: input.approvedBy,
      });
    },
    async openRuntimeRecordProof(input: {
      runtimeRecordPath: string;
      approved?: boolean;
      approvedBy?: string | null;
    }) {
      return openDirectiveRuntimeRecordProof({
        directiveRoot: harness.directiveRoot,
        runtimeRecordPath: input.runtimeRecordPath,
        approved: input.approved,
        approvedBy: input.approvedBy,
      });
    },
    async openRuntimeProofRuntimeCapabilityBoundary(input: {
      runtimeProofPath: string;
      approved?: boolean;
      approvedBy?: string | null;
    }) {
      return openDirectiveRuntimeProofRuntimeCapabilityBoundary({
        directiveRoot: harness.directiveRoot,
        runtimeProofPath: input.runtimeProofPath,
        approved: input.approved,
        approvedBy: input.approvedBy,
      });
    },
    async openRuntimePromotionReadiness(input: {
      capabilityBoundaryPath: string;
      approved?: boolean;
      approvedBy?: string | null;
    }) {
      return openDirectiveRuntimePromotionReadiness({
        directiveRoot: harness.directiveRoot,
        capabilityBoundaryPath: input.capabilityBoundaryPath,
        approved: input.approved,
        approvedBy: input.approvedBy,
      });
    },
    async writeRuntimeHostSelectionResolution(
      input: Omit<RuntimeHostSelectionResolutionInput, "directiveRoot">,
    ) {
      return writeRuntimeHostSelectionResolutionArtifact({
        ...input,
        directiveRoot: harness.directiveRoot,
      });
    },
    async writeRuntimePromotionSeamDecision(input: {
      promotionReadinessPath: string;
      rationale: string;
      approvedBy: string;
    }) {
      const { request } = buildManualRuntimePromotionRecordRequest({
        directiveRoot: harness.directiveRoot,
        promotionReadinessPath: input.promotionReadinessPath,
        rationale: input.rationale,
        approvedBy: input.approvedBy,
      });
      const { writeStandaloneRuntimePromotionRecord } =
        await loadStandaloneRuntimeOperationsModule();
      return writeStandaloneRuntimePromotionRecord({
        storage,
        request,
      });
    },
    async writeRuntimeRegistryAcceptanceDecision(input: {
      promotionRecordPath: string;
      rationale: string;
      acceptedBy: string;
    }) {
      const { request } = buildManualRuntimeRegistryAcceptanceRequest({
        directiveRoot: harness.directiveRoot,
        promotionRecordPath: input.promotionRecordPath,
        rationale: input.rationale,
        acceptedBy: input.acceptedBy,
      });
      const { writeStandaloneRuntimeRegistryEntry } =
        await loadStandaloneRuntimeOperationsModule();
      return writeStandaloneRuntimeRegistryEntry({
        storage,
        request,
      });
    },
    async submitDiscoveryEntryWithEngine(
      request: DiscoverySubmissionRequest,
      dryRun = false,
    ) {
      const submission = await submitDiscoveryEntryWithHostBridge({
        request,
        storage,
        dryRun,
      });

      if (dryRun) {
        return {
          ...submission,
          engine: {
            ok: true,
            processed: false,
            reason: "dry_run",
          },
        };
      }

      try {
        const engine = createEngine();
        const engineResult = await engine.processSource({
          source: buildEngineSourceFromDiscoverySubmission(request),
          mission: buildEngineMissionFromDiscoverySubmission(request),
          receivedAt: normalizeStandaloneHostReceivedAt(
            options.receivedAt ?? harness.bridge.receivedAt,
          ),
        });
        const artifactPaths = resolveStandaloneHostEngineArtifactPaths({
          directiveRoot: harness.directiveRoot,
          runtimeArtifactsRoot,
          record: engineResult.record,
        });
        await storage.writeJson(artifactPaths.recordPath, engineResult.record);
        await storage.writeText(
          artifactPaths.reportPath,
          renderStandaloneHostEngineRunReport({
            record: engineResult.record,
            artifactPaths,
          }),
        );

        return {
          ...submission,
          engine: {
            ok: true,
            processed: true,
            path: artifactPaths.recordPath,
            relativePath: artifactPaths.recordRelativePath,
            reportPath: artifactPaths.reportPath,
            reportRelativePath: artifactPaths.reportRelativePath,
            record: engineResult.record,
            adapterResults: engineResult.adapterResults,
          },
        };
      } catch (error) {
        return {
          ...submission,
          engine: {
            ok: false,
            processed: false,
            error: String((error as Error).message || error),
          },
        };
      }
    },
    async updateEnginePlanProgress(input: {
      runId: string;
      updates: EnginePlanProgressUpdate[];
      at?: string | null;
    }) {
      const engine = createEngine();
      return engine.updatePlanProgress(input);
    },
    async reRouteEngineRunWithAnswers(input: {
      runId: string;
      answers: Record<string, unknown>;
      receivedAt?: string | null;
    }) {
      const engine = createEngine();
      return engine.reRouteWithAnswers(input);
    },
    readDiscoveryOverview(maxEntries?: number): DiscoveryOverviewSummary {
      return readDiscoveryOverviewWithHostBridge({
        storage,
        maxEntries,
      });
    },
    async writeRuntimeFollowUp(request: RuntimeFollowUpRecordRequest) {
      const { writeStandaloneRuntimeFollowUp } =
        await loadStandaloneRuntimeOperationsModule();
      return writeStandaloneRuntimeFollowUp({
        storage,
        request,
      });
    },
    async writeRuntimeRecord(request: RuntimeRecordRequest) {
      const { writeStandaloneRuntimeRecord } =
        await loadStandaloneRuntimeOperationsModule();
      return writeStandaloneRuntimeRecord({
        storage,
        request,
      });
    },
    async writeRuntimeProofBundle(request: RuntimeProofBundleRequest) {
      const { writeStandaloneRuntimeProofBundle } =
        await loadStandaloneRuntimeOperationsModule();
      return writeStandaloneRuntimeProofBundle({
        storage,
        request,
      });
    },
    async writeRuntimeTransformationProof(request: RuntimeTransformationProofRequest) {
      const { writeStandaloneRuntimeTransformationProof } =
        await loadStandaloneRuntimeOperationsModule();
      return writeStandaloneRuntimeTransformationProof({
        storage,
        request,
      });
    },
    async writeRuntimeTransformationRecord(request: RuntimeTransformationRecordRequest) {
      const { writeStandaloneRuntimeTransformationRecord } =
        await loadStandaloneRuntimeOperationsModule();
      return writeStandaloneRuntimeTransformationRecord({
        storage,
        request,
      });
    },
    async writeRuntimePromotionRecord(request: RuntimePromotionRecordRequest) {
      const { writeStandaloneRuntimePromotionRecord } =
        await loadStandaloneRuntimeOperationsModule();
      return writeStandaloneRuntimePromotionRecord({
        storage,
        request,
      });
    },
    async writeRuntimeRegistryEntry(request: RuntimeRegistryEntryRequest) {
      const { writeStandaloneRuntimeRegistryEntry } =
        await loadStandaloneRuntimeOperationsModule();
      return writeStandaloneRuntimeRegistryEntry({
        storage,
        request,
      });
    },
    async readRuntimeOverview(maxEntries?: number) {
      const { readStandaloneRuntimeOverview } =
        await loadStandaloneRuntimeOperationsModule();
      return readStandaloneRuntimeOverview({
        directiveRoot: harness.directiveRoot,
        maxEntries,
      });
    },
    async readScientifyLiteratureAccessBundle() {
      const { readStandaloneScientifyLiteratureAccessBundle } =
        await loadStandaloneRuntimeOperationsModule();
      return readStandaloneScientifyLiteratureAccessBundle({
        directiveRoot: harness.directiveRoot,
      });
    },
    async invokeScientifyLiteratureAccessTool(input: {
      tool: "arxiv-search" | "arxiv-download" | "openalex-search" | "unpaywall-download";
      input: Record<string, unknown>;
      timeoutMs?: number;
      executionAt?: string;
      persistArtifacts?: boolean;
    }) {
      const { invokeStandaloneScientifyLiteratureAccessTool } =
        await loadStandaloneRuntimeOperationsModule();
      return invokeStandaloneScientifyLiteratureAccessTool({
        directiveRoot: harness.directiveRoot,
        request: {
          ...input,
          allowExternalFetches: options.allowExternalFetches ?? true,
        },
      });
    },
    async readLiveMiniSweAgentDescriptor() {
      const { readStandaloneLiveMiniSweAgentDescriptor } =
        await loadStandaloneRuntimeOperationsModule();
      return readStandaloneLiveMiniSweAgentDescriptor({
        directiveRoot: harness.directiveRoot,
      });
    },
    async readResearchVaultDescriptor() {
      const { readStandaloneResearchVaultDescriptor } =
        await loadStandaloneRuntimeOperationsModule();
      return readStandaloneResearchVaultDescriptor({
        directiveRoot: harness.directiveRoot,
      });
    },
    async invokeResearchVaultDescriptorCallable(input: {
      action: "summarize_descriptor";
      includeOpenDecisions?: boolean;
      executedAt?: string;
    }) {
      const { invokeStandaloneResearchVaultDescriptorCallable } =
        await loadStandaloneRuntimeOperationsModule();
      return invokeStandaloneResearchVaultDescriptorCallable({
        directiveRoot: harness.directiveRoot,
        request: input,
      });
    },
    async invokeResearchVaultSourcePackTool(input: {
      tool: "query-source-pack";
      input: {
        query: string;
        includeEvidence?: boolean;
        maxItems?: number;
      };
      timeoutMs?: number;
      executionAt?: string;
      persistArtifacts?: boolean;
    }) {
      const { invokeStandaloneResearchVaultSourcePackTool } =
        await loadStandaloneRuntimeOperationsModule();
      return invokeStandaloneResearchVaultSourcePackTool({
        directiveRoot: harness.directiveRoot,
        request: input,
      });
    },
    async readBlisspixelDeeprDescriptor() {
      const { readStandaloneBlisspixelDeeprDescriptor } =
        await loadStandaloneRuntimeOperationsModule();
      return readStandaloneBlisspixelDeeprDescriptor({
        directiveRoot: harness.directiveRoot,
      });
    },
    async invokeBlisspixelDeeprDescriptorCallable(input: {
      action: "summarize_descriptor";
      includeOpenDecisions?: boolean;
      executedAt?: string;
    }) {
      const { invokeStandaloneBlisspixelDeeprDescriptorCallable } =
        await loadStandaloneRuntimeOperationsModule();
      return invokeStandaloneBlisspixelDeeprDescriptorCallable({
        directiveRoot: harness.directiveRoot,
        request: input,
      });
    },
    readQueue() {
      return harness.readQueue();
    },
    readText(relativePath: string) {
      return harness.readText(relativePath);
    },
    listTextArtifactPaths() {
      return harness.listTextArtifactPaths();
    },
    listJsonArtifactPaths() {
      return harness.listJsonArtifactPaths();
    },
    close() {
      persistenceLedger.close();
    },
  };
}

export function createStandaloneFilesystemHostFromConfig(
  config: ResolvedStandaloneHostConfig,
) {
  return createStandaloneFilesystemHost({
    directiveRoot: config.directiveRoot,
    receivedAt: config.receivedAt,
    unresolvedGapIds: config.unresolvedGapIds,
    initialQueue: config.initialQueue,
    persistence: config.persistence,
    runtimeArtifactsRoot: config.runtimeArtifacts.root,
    allowExternalFetches: config.runtime.allowExternalFetches,
  });
}

export async function runStandaloneHostAcceptanceQuickstart(input: {
  outputRoot: string;
  hostName?: string;
  relativeOutputPath?: string;
  generatedAt?: string;
}) {
  const { runHostIntegrationAcceptanceQuickstart } = await loadStandaloneAcceptanceModule();
  return runHostIntegrationAcceptanceQuickstart({
    hostName: input.hostName ?? DEFAULT_STANDALONE_HOST_NAME,
    moduleSurface: "package_import",
    outputRoot: input.outputRoot,
    relativeOutputPath: input.relativeOutputPath,
    generatedAt: input.generatedAt,
  });
}
