import { createMemoryDiscoveryHostStorageBridge } from "./discovery-host-storage-bridge.memory.template.ts";
import {
  submitMaintenanceWatchdogSignalWithHostBridge,
  submitRuntimeVerificationSignalWithHostBridge,
  type MaintenanceWatchdogSignal,
  type RuntimeVerificationSignal,
} from "./discovery-signal-adapter.template.ts";

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const staleRuntimeVerificationSignal: RuntimeVerificationSignal = {
  candidate_id: "dw-starter-runtime-verification-signal",
  signal_detected: true,
  regression_age_hours: 84,
  regression_stale: true,
  soak_age_hours: 79,
  soak_stale: true,
  reasons: [
    "Runtime regression verification is older than the freshness threshold.",
    "Soak verification is older than the freshness threshold.",
  ],
};

const healthyRuntimeVerificationSignal: RuntimeVerificationSignal = {
  candidate_id: "dw-starter-runtime-verification-healthy",
  signal_detected: false,
  regression_age_hours: 12,
  regression_stale: false,
  soak_age_hours: 8,
  soak_stale: false,
  reasons: [],
};

const maintenanceWatchdogSignal: MaintenanceWatchdogSignal = {
  candidate_id: "dw-starter-maintenance-watchdog-signal",
  candidate_name: "Host Maintenance Watchdog Signal",
  source_type: "internal-signal",
  source_reference: "host://maintenance/degraded",
  mission_alignment:
    "Preserves Discovery front-door coverage for persistent maintenance degradation.",
  capability_gap_id: null,
  notes: "Starter smoke degraded-state signal.",
};

export async function runDiscoverySignalStarterSmoke() {
  const harness = createMemoryDiscoveryHostStorageBridge({
    receivedAt: "2026-03-22",
  });

  const healthyResult = await submitRuntimeVerificationSignalWithHostBridge({
    signal: healthyRuntimeVerificationSignal,
    storage: harness.bridge,
  });
  const runtimeResult = await submitRuntimeVerificationSignalWithHostBridge({
    signal: staleRuntimeVerificationSignal,
    storage: harness.bridge,
  });
  const maintenanceResult = await submitMaintenanceWatchdogSignalWithHostBridge({
    signal: maintenanceWatchdogSignal,
    storage: harness.bridge,
  });

  assertCondition(
    healthyResult.submitted === false,
    "healthy runtime verification signal must not submit into Discovery",
  );
  assertCondition(
    runtimeResult.status === "pending",
    "stale runtime verification signal must submit a pending Discovery entry",
  );
  assertCondition(
    maintenanceResult.status === "pending",
    "maintenance watchdog signal must submit a pending Discovery entry",
  );

  const queue = harness.readQueue() as {
    entries?: Array<{ candidate_id?: string; status?: string }>;
  };
  const queueStatuses = Object.fromEntries(
    (queue.entries ?? [])
      .filter((entry) => typeof entry.candidate_id === "string")
      .map((entry) => [entry.candidate_id as string, entry.status ?? "unknown"]),
  );

  assertCondition(
    queueStatuses["dw-starter-runtime-verification-signal"] === "pending",
    "runtime verification signal must appear in the queue",
  );
  assertCondition(
    queueStatuses["dw-starter-maintenance-watchdog-signal"] === "pending",
    "maintenance watchdog signal must appear in the queue",
  );
  assertCondition(
    !("dw-starter-runtime-verification-healthy" in queueStatuses),
    "healthy runtime verification signal must not appear in the queue",
  );

  return {
    ok: true as const,
    queueStatuses,
  };
}
