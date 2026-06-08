import type { ToolRegistryOptions, ToolExecutorMap } from "../types.ts";
import {
  approveGapFormalization,
  approveMissionFeedbackEntry,
  previewMissionFeedbackEntry,
  rejectGapFormalization,
  rejectMissionFeedbackEntry,
  revertMissionEvolution,
} from "../../../engine/mission/index.ts";
import { refreshDiscoveryGapWorklist } from "../../../discovery/lib/gaps/gap-worklist-refresh.ts";

export function buildMissionExecutors(options: ToolRegistryOptions): ToolExecutorMap {
  const { directiveRoot } = options;

  return {
    mission_preview: async (args: Record<string, unknown>) => {
      const feedbackId = args.feedbackId as string;
      return previewMissionFeedbackEntry({ directiveRoot, feedbackId });
    },

    mission_approve: async (args: Record<string, unknown>) => {
      const feedbackId = args.feedbackId as string;
      const rationale = args.rationale as string;
      const cascadeScope = args.cascadeScope as "none" | "low_confidence" | "conflicted" | "discovery_held" | undefined;
      const approvedRunIds = args.approvedRunIds as string[] | undefined;
      return approveMissionFeedbackEntry({
        directiveRoot,
        feedbackId,
        operatorRationale: rationale,
        cascadeScope,
        approvedRunIds: approvedRunIds ?? [],
      });
    },

    mission_reject: async (args: Record<string, unknown>) => {
      const feedbackId = args.feedbackId as string;
      const rationale = args.rationale as string;
      return rejectMissionFeedbackEntry({
        directiveRoot,
        feedbackId,
        operatorRationale: rationale,
      });
    },

    mission_revert: async (args: Record<string, unknown>) => {
      const rationale = args.rationale as string;
      return revertMissionEvolution({
        directiveRoot,
        operatorRationale: rationale,
      });
    },

    gaps_approve: async (args: Record<string, unknown>) => {
      const formalizationId = args.formalizationId as string;
      const rationale = args.rationale as string;
      const priority = args.priority as "high" | "medium" | "low";
      const result = await approveGapFormalization({
        directiveRoot,
        formalizationId,
        operatorRationale: rationale,
        operatorApprovedPriority: priority,
      });
      const refreshedWorklist = refreshDiscoveryGapWorklist({ directiveRoot });
      return { ...result, refreshedWorklist };
    },

    gaps_reject: async (args: Record<string, unknown>) => {
      const formalizationId = args.formalizationId as string;
      const rationale = args.rationale as string;
      return rejectGapFormalization({
        directiveRoot,
        formalizationId,
        operatorRationale: rationale,
      });
    },
  };
}
