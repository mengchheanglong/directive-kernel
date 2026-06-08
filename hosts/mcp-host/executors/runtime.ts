import type { ToolRegistryOptions, ToolExecutorMap } from "../types.ts";
import type { RuntimeHostSelectionDecision } from "../../../runtime/lib/host/selection-resolution.ts";
import { createStandaloneFilesystemHost } from "../../standalone-host/filesystem-host.ts";

const MCP_OPERATOR_ACTOR = "mcp-operator";

export function buildRuntimeExecutors(options: ToolRegistryOptions): ToolExecutorMap {
  const runtimeHost = createStandaloneFilesystemHost({
    directiveRoot: options.directiveRoot,
  });

  return {
    runtime_open_follow_up: async (args: Record<string, unknown>) => {
      const followUpPath = String(args.followUpPath ?? "");
      const approved = args.approved !== undefined ? Boolean(args.approved) : undefined;
      return runtimeHost.openRuntimeFollowUp({
        followUpPath,
        approved,
        approvedBy: MCP_OPERATOR_ACTOR,
      });
    },

    runtime_open_proof: async (args: Record<string, unknown>) => {
      const runtimeRecordPath = String(args.runtimeRecordPath ?? "");
      const approved = args.approved !== undefined ? Boolean(args.approved) : undefined;
      return runtimeHost.openRuntimeRecordProof({
        runtimeRecordPath,
        approved,
        approvedBy: MCP_OPERATOR_ACTOR,
      });
    },

    runtime_open_runtime_capability_boundary: async (args: Record<string, unknown>) => {
      const runtimeProofPath = String(args.runtimeProofPath ?? "");
      const approved = args.approved !== undefined ? Boolean(args.approved) : undefined;
      return runtimeHost.openRuntimeProofRuntimeCapabilityBoundary({
        runtimeProofPath,
        approved,
        approvedBy: MCP_OPERATOR_ACTOR,
      });
    },

    runtime_open_promotion_readiness: async (args: Record<string, unknown>) => {
      const capabilityBoundaryPath = String(args.capabilityBoundaryPath ?? "");
      const approved = args.approved !== undefined ? Boolean(args.approved) : undefined;
      return runtimeHost.openRuntimePromotionReadiness({
        capabilityBoundaryPath,
        approved,
        approvedBy: MCP_OPERATOR_ACTOR,
      });
    },

    runtime_selection_resolutions: async (args: Record<string, unknown>) => {
      const promotionReadinessPath = String(args.promotionReadinessPath ?? "");
      const decision = (String(args.decision ?? "") || "defer") as RuntimeHostSelectionDecision;
      const selectedHost = args.selectedHost ? String(args.selectedHost) : "";
      const rationale = String(args.rationale ?? "");
      const resolvedConfidence = args.resolvedConfidence as
        | "high"
        | "medium"
        | "low"
        | undefined;
      return runtimeHost.writeRuntimeHostSelectionResolution({
        promotionReadinessPath,
        decision,
        selectedHost,
        rationale,
        reviewedBy: MCP_OPERATOR_ACTOR,
        resolvedConfidence,
      });
    },

    runtime_promotion_seam_decisions: async (args: Record<string, unknown>) => {
      const promotionReadinessPath = String(args.promotionReadinessPath ?? "");
      const rationale = String(args.rationale ?? "");
      return runtimeHost.writeRuntimePromotionSeamDecision({
        promotionReadinessPath,
        rationale,
        approvedBy: MCP_OPERATOR_ACTOR,
      });
    },

    runtime_registry_acceptance_decisions: async (args: Record<string, unknown>) => {
      const promotionRecordPath = String(args.promotionRecordPath ?? "");
      const rationale = String(args.rationale ?? "");
      return runtimeHost.writeRuntimeRegistryAcceptanceDecision({
        promotionRecordPath,
        rationale,
        acceptedBy: MCP_OPERATOR_ACTOR,
      });
    },
  };
}
