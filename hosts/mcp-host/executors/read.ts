import fs from "node:fs";
import path from "node:path";
import { buildApiManifest } from "../../web-host/api-manifest.ts";
import {
  readDirectiveFrontendSnapshot,
  readDirectiveFrontendRunDetail,
  readDirectiveFrontendQueueEntry,
  readDirectiveFrontendDiscoveryRoutingDetail,
  readDirectiveFrontendHandoffDetail,
  readDirectiveFrontendRuntimeRecordDetail,
  readDirectiveFrontendRuntimeProofDetail,
  readDirectiveFrontendRuntimeRuntimeCapabilityBoundaryDetail,
  readDirectiveFrontendRuntimePromotionReadinessDetail,
  readDirectiveFrontendArchitectureStartDetail,
  readDirectiveFrontendArchitectureResultDetail,
  readDirectiveFrontendArchitectureAdoptionDetail,
  readDirectiveFrontendArchitectureImplementationTargetDetail,
  readDirectiveFrontendArchitectureImplementationResultDetail,
  readDirectiveFrontendArchitectureRetentionDetail,
  readDirectiveFrontendArchitectureIntegrationRecordDetail,
  readDirectiveFrontendArchitectureConsumptionRecordDetail,
  readDirectiveFrontendArchitecturePostConsumptionEvaluationDetail,
  readDirectiveFrontendArtifactText,
} from "../../web-host/data/snapshot.ts";
import { readDirectiveFrontendRunExplanation } from "../../web-host/data/run-explanation.ts";
import { readGlossaryTerms } from "../../web-host/glossary.ts";
import { readFederationSnapshot } from "../../web-host/federation.ts";
import { buildOperatorDecisionInboxReport } from "../../../engine/orchestration/operator-decision-inbox/operator-decision-inbox.ts";
import { summarizeKernelStorage } from "../../../engine/maintenance/archive.ts";
import {
  listMissionFeedbackEntries,
  listMissionEvolutionHistory,
  listPendingGapFormalizationCandidates,
} from "../../../engine/mission/index.ts";
import { listRuntimeCapabilityMetadata } from "../../../runtime/core/capability-registry.ts";
import type { ToolRegistryOptions, ToolExecutorMap } from "../types.ts";

export function buildReadExecutors(options: ToolRegistryOptions): ToolExecutorMap {
  const { directiveRoot } = options;

  const executors: ToolExecutorMap = {
    manifest_get: async () => buildApiManifest(),

    telemetry_snapshot_get: async () => ({
      counters: {},
      gauges: {},
      events: [],
    }),

    federation_snapshot_get: async () => readFederationSnapshot(directiveRoot),

    snapshot_get: async () =>
      readDirectiveFrontendSnapshot({
        directiveRoot,
        maxRuns: 200,
        maxQueueEntries: 500,
        maxHandoffs: 250,
      }),

    operator_decision_inbox_get: async () =>
      buildOperatorDecisionInboxReport({ directiveRoot }),

    runtime_status: async () => ({
      ok: true,
      storage: summarizeKernelStorage(directiveRoot),
    }),

    runtime_capabilities_list: async () => ({
      capabilities: listRuntimeCapabilityMetadata(),
    }),

    explain_get: async (args) =>
      readDirectiveFrontendRunExplanation({
        directiveRoot,
        runId: String(args.runId ?? "").trim(),
      }),

    glossary_get: async (args) => {
      const allTerms = readGlossaryTerms();
      const filter = String(args.term ?? "").trim().toLowerCase();
      return {
        terms:
          filter.length === 0
            ? allTerms
            : allTerms.filter((entry) => entry.term.toLowerCase() === filter),
      };
    },

    schema_get: async (args) => {
      const schemaName = String(args.schemaName ?? args.name ?? "").trim();
      if (!/^[A-Za-z0-9._-]+\.schema\.json$/u.test(schemaName) || schemaName.includes("..")) {
        return { ok: false, error: "invalid_schema_name" };
      }
      const schemaPath = path.resolve(process.cwd(), "shared", "schemas", schemaName);
      if (!fs.existsSync(schemaPath)) {
        return { ok: false, error: "schema_not_found" };
      }
      return JSON.parse(fs.readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
    },

    engine_runs_list: async () =>
      readDirectiveFrontendSnapshot({ directiveRoot, maxRuns: 200 }).engineRuns,

    engine_run_get: async (args) =>
      readDirectiveFrontendRunDetail({
        directiveRoot,
        runId: String(args.runId ?? ""),
      }),

    queue_list: async () =>
      readDirectiveFrontendSnapshot({ directiveRoot, maxQueueEntries: 500 }).queue,

    queue_entry_get: async (args) =>
      readDirectiveFrontendQueueEntry({
        directiveRoot,
        candidateId: String(args.candidateId ?? "").trim(),
      }),

    discovery_routing_record_detail_get: async (args) =>
      readDirectiveFrontendDiscoveryRoutingDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    handoffs_list: async () =>
      readDirectiveFrontendSnapshot({ directiveRoot, maxHandoffs: 250 }).handoffStubs,

    handoff_detail_get: async (args) =>
      readDirectiveFrontendHandoffDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    runtime_record_detail_get: async (args) =>
      readDirectiveFrontendRuntimeRecordDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    runtime_proof_detail_get: async (args) =>
      readDirectiveFrontendRuntimeProofDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    runtime_runtime_capability_boundary_detail_get: async (args) =>
      readDirectiveFrontendRuntimeRuntimeCapabilityBoundaryDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    runtime_promotion_readiness_detail_get: async (args) =>
      readDirectiveFrontendRuntimePromotionReadinessDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    architecture_start_detail_get: async (args) =>
      readDirectiveFrontendArchitectureStartDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    architecture_result_detail_get: async (args) =>
      readDirectiveFrontendArchitectureResultDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    architecture_adoption_detail_get: async (args) =>
      readDirectiveFrontendArchitectureAdoptionDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    implementation_target_detail_get: async (args) =>
      readDirectiveFrontendArchitectureImplementationTargetDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    implementation_result_detail_get: async (args) =>
      readDirectiveFrontendArchitectureImplementationResultDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    retained_detail_get: async (args) =>
      readDirectiveFrontendArchitectureRetentionDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    integration_record_detail_get: async (args) =>
      readDirectiveFrontendArchitectureIntegrationRecordDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    consumption_record_detail_get: async (args) =>
      readDirectiveFrontendArchitectureConsumptionRecordDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    post_consumption_evaluation_detail_get: async (args) =>
      readDirectiveFrontendArchitecturePostConsumptionEvaluationDetail({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    artifact_text_get: async (args) =>
      readDirectiveFrontendArtifactText({
        directiveRoot,
        relativePath: String(args.path ?? "").trim(),
      }),

    mission_feedback_list: async () =>
      listMissionFeedbackEntries({ directiveRoot }),

    mission_history_list: async () =>
      listMissionEvolutionHistory({ directiveRoot }),

    gaps_pending_list: async () =>
      listPendingGapFormalizationCandidates({ directiveRoot }),
  };

  return executors;
}
