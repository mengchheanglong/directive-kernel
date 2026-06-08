import type { ToolRegistryOptions, ToolExecutorMap } from "../types.ts";
import type { DiscoverySubmissionRequest } from "../../../discovery/lib/front-door/submission-router.ts";
import { writeDiscoveryRoutingReviewResolution } from "../../../discovery/lib/routing/review-resolution.ts";
import { createStandaloneFilesystemHost } from "../../standalone-host/filesystem-host.ts";
import type { EnginePlanProgressUpdate } from "../../../engine/index.ts";

export function buildDiscoveryExecutors(options: ToolRegistryOptions): ToolExecutorMap {
  const { directiveRoot } = options;
  const runtimeHost = createStandaloneFilesystemHost({ directiveRoot });
  const mcpOperatorActor = "mcp-operator";

  return {
    async discovery_submit(args: Record<string, unknown>) {
      const payload = args as unknown as DiscoverySubmissionRequest;
      const processWithEngine = Boolean(args.process_with_engine);
      return processWithEngine
        ? await runtimeHost.submitDiscoveryEntryWithEngine(payload, false)
        : await runtimeHost.submitDiscoveryEntry(payload, false);
    },

    async engine_run_reroute(args: Record<string, unknown>) {
      const { runId, answers, receivedAt } = args as {
        runId: string;
        answers: Record<string, unknown>;
        receivedAt?: string | null;
      };
      return await runtimeHost.reRouteEngineRunWithAnswers({
        runId,
        answers,
        receivedAt,
      });
    },

    async engine_run_plan_progress(args: Record<string, unknown>) {
      const { runId, updates, at } = args as {
        runId: string;
        updates: EnginePlanProgressUpdate[];
        at?: string | null;
      };
      return await runtimeHost.updateEnginePlanProgress({
        runId,
        updates,
        at,
      });
    },

    async discovery_front_door(args: Record<string, unknown>) {
      const payload = args as unknown as DiscoverySubmissionRequest;
      return await runtimeHost.submitDiscoveryFrontDoor(payload);
    },

    async discovery_open_route(args: Record<string, unknown>) {
      const { routingPath, approved } = args as {
        routingPath: string;
        approved?: boolean;
      };
      return await runtimeHost.openDiscoveryRoute({
        routingPath,
        approved,
        approvedBy: mcpOperatorActor,
      });
    },

    async discovery_resolve_routing_review(args: Record<string, unknown>) {
      const { routingRecordPath, decision, rationale, reviewedBy, resolvedConfidence } = args as {
        routingRecordPath: string;
        decision: "confirm_architecture" | "confirm_runtime" | "redirect_to_architecture" | "redirect_to_runtime" | "reject" | "defer";
        rationale: string;
        reviewedBy?: string;
        resolvedConfidence?: "high" | "medium" | "low";
      };
      return writeDiscoveryRoutingReviewResolution({
        directiveRoot,
        routingRecordPath,
        decision,
        rationale,
        reviewedBy: reviewedBy ?? mcpOperatorActor,
        resolvedConfidence,
      });
    },
  };
}
