import { createMemoryDiscoveryHostStorageBridge } from "./discovery-host-storage-bridge.memory.template.ts";
import { readDiscoveryOverviewWithHostBridge } from "./discovery-overview-reader.template.ts";

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function runDiscoveryOverviewStarterSmoke() {
  const harness = createMemoryDiscoveryHostStorageBridge({
    initialQueue: {
      status: "primary",
      updatedAt: "2026-03-22",
      entries: [
        {
          candidate_id: "dw-overview-completed",
          candidate_name: "Completed Candidate",
          source_type: "internal-signal",
          source_reference: "host://signals/completed",
          received_at: "2026-03-21",
          status: "completed",
          routing_target: "runtime",
          mission_alignment: "Completed path example.",
          capability_gap_id: "gap-example",
          assigned_worker: null,
          fast_path_record_path: "discovery/01-intake/2026-03-22-completed.md",
          routing_record_path: "discovery/03-routing-log/2026-03-22-completed.md",
          routed_at: "2026-03-21",
          completed_at: "2026-03-22",
          result_record_path: "runtime/02-records/2026-03-22-completed-runtime-record.md",
          notes: "Completed entry.",
        },
        {
          candidate_id: "dw-overview-pending",
          candidate_name: "Pending Candidate",
          source_type: "paper",
          source_reference: "https://example.com/pending",
          received_at: "2026-03-22",
          status: "pending",
          routing_target: null,
          mission_alignment: "Pending path example.",
          capability_gap_id: null,
          assigned_worker: null,
          fast_path_record_path: null,
          routing_record_path: null,
          routed_at: null,
          completed_at: null,
          result_record_path: null,
          notes: "Pending entry.",
        },
      ],
    },
  });

  const overview = readDiscoveryOverviewWithHostBridge({
    storage: harness.bridge,
    maxEntries: 5,
  });

  assertCondition(overview.totalEntries === 2, "overview must report both queue entries");
  assertCondition(
    overview.statusCounts.completed === 1,
    "overview must count completed entries",
  );
  assertCondition(
    overview.statusCounts.pending === 1,
    "overview must count pending entries",
  );
  assertCondition(
    overview.routingCounts.runtime === 1,
    "overview must count routed runtime entries",
  );
  assertCondition(
    overview.routingCounts.unrouted === 1,
    "overview must count unrouted entries",
  );
  assertCondition(
    overview.recentEntries[0]?.candidateId === "dw-overview-completed",
    "overview must sort by most recent routed/completed activity first",
  );
  assertCondition(
    overview.recentEntries[1]?.candidateId === "dw-overview-pending",
    "overview must preserve remaining recent queue entries",
  );

  return {
    ok: true as const,
    totalEntries: overview.totalEntries,
    statusCounts: overview.statusCounts,
    routingCounts: overview.routingCounts,
    recentEntryIds: overview.recentEntries.map((entry) => entry.candidateId),
  };
}
