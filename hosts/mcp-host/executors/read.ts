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
import { buildOperatorDecisionInboxReport } from "../../../engine/orchestration/operator-decision-inbox/operator-decision-inbox.ts";
import { summarizeKernelStorage } from "../../../engine/maintenance/archive.ts";
import {
  listMissionFeedbackEntries,
  listMissionEvolutionHistory,
  listPendingGapFormalizationCandidates,
} from "../../../engine/mission/index.ts";
import type { ToolRegistryOptions, ToolExecutorMap } from "../types.ts";

export function buildReadExecutors(options: ToolRegistryOptions): ToolExecutorMap {
  const { directiveRoot } = options;

  const executors: ToolExecutorMap = {
    manifest_get: async () => buildApiManifest(),

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
