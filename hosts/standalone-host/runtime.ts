import path from "node:path";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

import type { DiscoverySubmissionRequest } from "../../discovery/lib/discovery-submission-router.ts";
import { submitDirectiveDiscoveryFrontDoor } from "../../discovery/lib/discovery-front-door.ts";
import { openDirectiveDiscoveryRoute } from "../../discovery/lib/discovery-route-opener.ts";
import { openDirectiveRuntimeFollowUp } from "../../runtime/lib/runtime-follow-up-opener.ts";
import { openDirectiveRuntimeRecordProof } from "../../runtime/lib/runtime-record-proof-opener.ts";
import { openDirectiveRuntimeProofRuntimeCapabilityBoundary } from "../../runtime/lib/runtime-proof-runtime-capability-boundary-opener.ts";
import { openDirectiveRuntimePromotionReadiness } from "../../runtime/lib/runtime-runtime-capability-boundary-promotion-readiness-opener.ts";
import {
  createFilesystemDirectiveEngineStore,
  DirectiveEngine,
  createDirectiveWorkspaceEngineLanes,
  normalizeDirectiveEngineSourceTypeInput,
  resolveDirectiveEngineStoreRecordPath,
  type DirectiveEngineMissionInput,
  type DirectiveEngineRunRecord,
  type DirectiveEngineSourceItem,
} from "../../engine/index.ts";
import type {
  ResolvedStandaloneHostConfig,
  ResolvedStandaloneHostPersistence,
} from "./config.ts";
import {
  readDiscoveryOverviewWithHostBridge,
  type DiscoveryOverviewSummary,
} from "../integration-kit/starter/discovery-overview-reader.template.ts";
import {
  createFilesystemDiscoveryHostStorageBridge,
} from "../integration-kit/starter/discovery-host-storage-bridge.filesystem.template.ts";
import {
  submitDiscoveryEntryWithHostBridge,
} from "../integration-kit/starter/discovery-submission-adapter.template.ts";
import { createStandaloneHostPersistenceLedger } from "./persistence.ts";
import type { RuntimeFollowUpRecordRequest } from "../../runtime/lib/runtime-follow-up-record-writer.ts";
import type { RuntimeProofBundleRequest } from "../../runtime/lib/runtime-proof-bundle-writer.ts";
import type { RuntimePromotionRecordRequest } from "../../runtime/lib/runtime-promotion-record-writer.ts";
import type { RuntimeRegistryEntryRequest } from "../../runtime/lib/runtime-registry-entry-writer.ts";
import type { RuntimeRecordRequest } from "../../runtime/lib/runtime-record-writer.ts";
import type { RuntimeTransformationProofRequest } from "../../runtime/lib/runtime-transformation-proof-writer.ts";
import type { RuntimeTransformationRecordRequest } from "../../runtime/lib/runtime-transformation-record-writer.ts";
import { describeDirectiveEngineGapPressure } from "../../engine/execution/engine-run-artifacts.ts";

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

function buildDirectiveEngineSourceFromDiscoverySubmission(
  request: DiscoverySubmissionRequest,
): DirectiveEngineSourceItem {
  const sourceTypeNormalization = normalizeDirectiveEngineSourceTypeInput(
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

function buildDirectiveEngineMissionFromDiscoverySubmission(
  request: DiscoverySubmissionRequest,
): DirectiveEngineMissionInput {
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
  record: DirectiveEngineRunRecord;
}) {
  const runtimeArtifactsRoot = normalizeAbsolutePath(input.runtimeArtifactsRoot);
  const engineRunsRoot = normalizeAbsolutePath(path.resolve(runtimeArtifactsRoot, "engine-runs"));
  const recordPath = normalizeAbsolutePath(resolveDirectiveEngineStoreRecordPath({
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
  record: DirectiveEngineRunRecord;
  artifactPaths: {
    recordRelativePath: string;
  };
}) {
  const { record } = input;
  const gapPressure = describeDirectiveEngineGapPressure(record);

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
    "## Next Action",
    "",
    record.integrationProposal.nextAction,
    "",
  ].join("\n");
}

async function loadStandaloneRuntimeLaneModule() {
  return import("./runtime-lane.ts");
}

async function loadStandaloneAcceptanceModule() {
  return import("../integration-kit/starter/run-host-integration-acceptance-quickstart.template.ts");
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
      ?? path.resolve(options.directiveRoot, "runtime", "standalone-host"),
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
        const engine = new DirectiveEngine({
          laneSet: createDirectiveWorkspaceEngineLanes(),
          store: createFilesystemDirectiveEngineStore({
            engineRunsRoot: path.resolve(runtimeArtifactsRoot, "engine-runs"),
          }),
        });
        const engineResult = await engine.processSource({
          source: buildDirectiveEngineSourceFromDiscoverySubmission(request),
          mission: buildDirectiveEngineMissionFromDiscoverySubmission(request),
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
    readDiscoveryOverview(maxEntries?: number): DiscoveryOverviewSummary {
      return readDiscoveryOverviewWithHostBridge({
        storage,
        maxEntries,
      });
    },
    async writeRuntimeFollowUp(request: RuntimeFollowUpRecordRequest) {
      const { writeStandaloneRuntimeFollowUp } =
        await loadStandaloneRuntimeLaneModule();
      return writeStandaloneRuntimeFollowUp({
        storage,
        request,
      });
    },
    async writeRuntimeRecord(request: RuntimeRecordRequest) {
      const { writeStandaloneRuntimeRecord } =
        await loadStandaloneRuntimeLaneModule();
      return writeStandaloneRuntimeRecord({
        storage,
        request,
      });
    },
    async writeRuntimeProofBundle(request: RuntimeProofBundleRequest) {
      const { writeStandaloneRuntimeProofBundle } =
        await loadStandaloneRuntimeLaneModule();
      return writeStandaloneRuntimeProofBundle({
        storage,
        request,
      });
    },
    async writeRuntimeTransformationProof(request: RuntimeTransformationProofRequest) {
      const { writeStandaloneRuntimeTransformationProof } =
        await loadStandaloneRuntimeLaneModule();
      return writeStandaloneRuntimeTransformationProof({
        storage,
        request,
      });
    },
    async writeRuntimeTransformationRecord(request: RuntimeTransformationRecordRequest) {
      const { writeStandaloneRuntimeTransformationRecord } =
        await loadStandaloneRuntimeLaneModule();
      return writeStandaloneRuntimeTransformationRecord({
        storage,
        request,
      });
    },
    async writeRuntimePromotionRecord(request: RuntimePromotionRecordRequest) {
      const { writeStandaloneRuntimePromotionRecord } =
        await loadStandaloneRuntimeLaneModule();
      return writeStandaloneRuntimePromotionRecord({
        storage,
        request,
      });
    },
    async writeRuntimeRegistryEntry(request: RuntimeRegistryEntryRequest) {
      const { writeStandaloneRuntimeRegistryEntry } =
        await loadStandaloneRuntimeLaneModule();
      return writeStandaloneRuntimeRegistryEntry({
        storage,
        request,
      });
    },
    async readRuntimeOverview(maxEntries?: number) {
      const { readStandaloneRuntimeOverview } =
        await loadStandaloneRuntimeLaneModule();
      return readStandaloneRuntimeOverview({
        directiveRoot: harness.directiveRoot,
        maxEntries,
      });
    },
    async readScientifyLiteratureAccessBundle() {
      const { readStandaloneScientifyLiteratureAccessBundle } =
        await loadStandaloneRuntimeLaneModule();
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
        await loadStandaloneRuntimeLaneModule();
      return invokeStandaloneScientifyLiteratureAccessTool({
        directiveRoot: harness.directiveRoot,
        request: input,
      });
    },
    async readLiveMiniSweAgentDescriptor() {
      const { readStandaloneLiveMiniSweAgentDescriptor } =
        await loadStandaloneRuntimeLaneModule();
      return readStandaloneLiveMiniSweAgentDescriptor({
        directiveRoot: harness.directiveRoot,
      });
    },
    async readResearchVaultDescriptor() {
      const { readStandaloneResearchVaultDescriptor } =
        await loadStandaloneRuntimeLaneModule();
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
        await loadStandaloneRuntimeLaneModule();
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
        await loadStandaloneRuntimeLaneModule();
      return invokeStandaloneResearchVaultSourcePackTool({
        directiveRoot: harness.directiveRoot,
        request: input,
      });
    },
    async readBlisspixelDeeprDescriptor() {
      const { readStandaloneBlisspixelDeeprDescriptor } =
        await loadStandaloneRuntimeLaneModule();
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
        await loadStandaloneRuntimeLaneModule();
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
