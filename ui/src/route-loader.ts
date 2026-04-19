import type {
  FrontendArchitectureAdoptionDetail,
  FrontendArchitectureConsumptionRecordDetail,
  FrontendArchitectureImplementationResultDetail,
  FrontendArchitectureImplementationTargetDetail,
  FrontendArchitectureIntegrationRecordDetail,
  FrontendArchitecturePostConsumptionEvaluationDetail,
  FrontendArchitectureResultDetail,
  FrontendArchitectureRetentionDetail,
  FrontendArchitectureStartDetail,
  FrontendDiscoveryRoutingDetail,
  FrontendEngineRunDetail,
  FrontendEngineRunsOverview,
  FrontendHandoffStub,
  FrontendOperatorDecisionInboxReport,
  FrontendQueueOverview,
  FrontendRuntimePromotionReadinessDetail,
  FrontendRuntimeProofDetail,
  FrontendRuntimeRecordDetail,
  FrontendRuntimeRuntimeCapabilityBoundaryDetail,
  FrontendSnapshot,
} from "./types/index.ts";
import { getJson } from "./app-utils.ts";

export async function loadDirectiveUiPage(url: URL) {
  if (url.pathname === "/") {
    const [snapshot, inbox] = await Promise.all([
      getJson<FrontendSnapshot>("/api/snapshot"),
      getJson<FrontendOperatorDecisionInboxReport>("/api/operator-decision-inbox"),
    ]);
    return { kind: "home", data: snapshot, inbox };
  }

  if (url.pathname === "/discovery") {
    return { kind: "discovery-lane", data: await getJson<FrontendSnapshot>("/api/snapshot") };
  }

  if (url.pathname === "/architecture") {
    return { kind: "architecture-lane", data: await getJson<FrontendSnapshot>("/api/snapshot") };
  }

  if (url.pathname === "/runtime") {
    return { kind: "runtime-lane", data: await getJson<FrontendSnapshot>("/api/snapshot") };
  }

  if (url.pathname === "/engine-runs") {
    return { kind: "engine-runs", data: await getJson<FrontendEngineRunsOverview>("/api/engine-runs") };
  }

  if (url.pathname === "/operator-inbox") {
    return {
      kind: "operator-inbox",
      data: await getJson<FrontendOperatorDecisionInboxReport>("/api/operator-decision-inbox"),
    };
  }

  if (url.pathname === "/workflow-map") {
    const [snapshot, inbox] = await Promise.all([
      getJson<FrontendSnapshot>("/api/snapshot"),
      getJson<FrontendOperatorDecisionInboxReport>("/api/operator-decision-inbox"),
    ]);
    return { kind: "workflow-map", snapshot, inbox };
  }

  if (url.pathname.startsWith("/engine-runs/")) {
    const runId = decodeURIComponent(url.pathname.replace(/^\/engine-runs\//, ""));
    const [detail, queue, handoffs] = await Promise.all([
      getJson<FrontendEngineRunDetail>(`/api/engine-runs/${encodeURIComponent(runId)}`),
      getJson<FrontendQueueOverview>("/api/queue"),
      getJson<FrontendHandoffStub[]>("/api/handoffs"),
    ]);
    return { kind: "engine-run-detail", detail, queue, handoffs };
  }

  if (url.pathname === "/queue") {
    const [queue, runs, handoffs] = await Promise.all([
      getJson<FrontendQueueOverview>("/api/queue"),
      getJson<FrontendEngineRunsOverview>("/api/engine-runs"),
      getJson<FrontendHandoffStub[]>("/api/handoffs"),
    ]);
    return { kind: "queue", queue, runs, handoffs };
  }

  if (url.pathname === "/discovery-routing-records/view") {
    return {
      kind: "discovery-routing-detail",
      data: await getJson<FrontendDiscoveryRoutingDetail>(
        `/api/discovery-routing-records/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/handoffs") {
    return { kind: "handoffs", data: await getJson<FrontendSnapshot>("/api/snapshot") };
  }

  if (url.pathname === "/handoffs/view") {
    return {
      kind: "handoff-detail",
      data: await getJson(`/api/handoffs/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`),
    };
  }

  if (url.pathname === "/runtime-records/view") {
    return {
      kind: "runtime-record-detail",
      data: await getJson<FrontendRuntimeRecordDetail>(
        `/api/runtime-records/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/runtime-proofs/view") {
    return {
      kind: "runtime-proof-detail",
      data: await getJson<FrontendRuntimeProofDetail>(
        `/api/runtime-proofs/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/runtime-runtime-capability-boundaries/view") {
    return {
      kind: "runtime-runtime-capability-boundary-detail",
      data: await getJson<FrontendRuntimeRuntimeCapabilityBoundaryDetail>(
        `/api/runtime-runtime-capability-boundaries/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/runtime-promotion-readiness/view") {
    return {
      kind: "runtime-promotion-readiness-detail",
      data: await getJson<FrontendRuntimePromotionReadinessDetail>(
        `/api/runtime-promotion-readiness/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/architecture-starts/view") {
    return {
      kind: "architecture-start",
      data: await getJson<FrontendArchitectureStartDetail>(
        `/api/architecture-starts/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/architecture-results/view") {
    return {
      kind: "architecture-result",
      data: await getJson<FrontendArchitectureResultDetail>(
        `/api/architecture-results/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/architecture-adoptions/view") {
    return {
      kind: "architecture-adoption",
      data: await getJson<FrontendArchitectureAdoptionDetail>(
        `/api/architecture-adoptions/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/architecture-implementation-targets/view") {
    return {
      kind: "architecture-implementation-target",
      data: await getJson<FrontendArchitectureImplementationTargetDetail>(
        `/api/architecture-implementation-targets/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/architecture-implementation-results/view") {
    return {
      kind: "architecture-implementation-result",
      data: await getJson<FrontendArchitectureImplementationResultDetail>(
        `/api/architecture-implementation-results/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/architecture-retained/view") {
    return {
      kind: "architecture-retained",
      data: await getJson<FrontendArchitectureRetentionDetail>(
        `/api/architecture-retained/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/architecture-integration-records/view") {
    return {
      kind: "architecture-integration-record",
      data: await getJson<FrontendArchitectureIntegrationRecordDetail>(
        `/api/architecture-integration-records/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/architecture-consumption-records/view") {
    return {
      kind: "architecture-consumption-record",
      data: await getJson<FrontendArchitectureConsumptionRecordDetail>(
        `/api/architecture-consumption-records/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/architecture-post-consumption-evaluations/view") {
    return {
      kind: "architecture-post-consumption-evaluation",
      data: await getJson<FrontendArchitecturePostConsumptionEvaluationDetail>(
        `/api/architecture-post-consumption-evaluations/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
      ),
    };
  }

  if (url.pathname === "/artifacts") {
    return {
      kind: "artifact",
      data: await getJson(`/api/artifacts?path=${encodeURIComponent(url.searchParams.get("path") || "")}`),
    };
  }

  return { kind: "not-found", path: url.pathname };
}
