import path from "node:path";
import type {
  DiscoveryIntakeQueueDocument,
  DiscoveryIntakeQueueEntry,
  DiscoveryQueueStatus,
  DiscoveryRoutingTarget,
} from "../../../discovery/lib/discovery-intake-queue-writer.ts";

export type DiscoveryOverviewHostStorageBridge = {
  directiveRoot: string;
  readJson<T>(filePath: string): T;
};

export type DiscoveryOverviewRecentEntry = {
  candidateId: string;
  candidateName: string;
  sourceType: DiscoveryIntakeQueueEntry["source_type"];
  sourceReference: string;
  receivedAt: string;
  status: DiscoveryQueueStatus;
  routingTarget: DiscoveryRoutingTarget;
  missionAlignment: string | null;
  capabilityGapId: string | null;
  fastPathRecordPath: string | null;
  routingRecordPath: string | null;
  resultRecordPath: string | null;
  routedAt: string | null;
  completedAt: string | null;
  notes: string | null;
};

export type DiscoveryOverviewStatusCounts = Record<DiscoveryQueueStatus, number>;

export type DiscoveryOverviewRoutingCounts = Record<string, number>;

export type DiscoveryOverviewSummary = {
  queuePath: string;
  updatedAt: string;
  totalEntries: number;
  statusCounts: DiscoveryOverviewStatusCounts;
  routingCounts: DiscoveryOverviewRoutingCounts;
  recentEntries: DiscoveryOverviewRecentEntry[];
};

type ReadDiscoveryOverviewWithHostBridgeOptions = {
  storage: DiscoveryOverviewHostStorageBridge;
  maxEntries?: number;
};

function queuePathFor(storage: DiscoveryOverviewHostStorageBridge) {
  return path.resolve(storage.directiveRoot, "discovery", "intake-queue.json");
}

function sortTimeFor(entry: DiscoveryIntakeQueueEntry) {
  return Math.max(
    new Date(entry.completed_at || "1970-01-01").getTime(),
    new Date(entry.routed_at || "1970-01-01").getTime(),
    new Date(entry.received_at || "1970-01-01").getTime(),
  );
}

function createEmptyStatusCounts(): DiscoveryOverviewStatusCounts {
  return {
    pending: 0,
    processing: 0,
    routed: 0,
    completed: 0,
    held: 0,
  };
}

function createRecentEntry(entry: DiscoveryIntakeQueueEntry): DiscoveryOverviewRecentEntry {
  return {
    candidateId: entry.candidate_id,
    candidateName: entry.candidate_name,
    sourceType: entry.source_type,
    sourceReference: entry.source_reference,
    receivedAt: entry.received_at,
    status: entry.status,
    routingTarget: entry.routing_target,
    missionAlignment: entry.mission_alignment,
    capabilityGapId: entry.capability_gap_id,
    fastPathRecordPath: entry.fast_path_record_path,
    routingRecordPath: entry.routing_record_path,
    resultRecordPath: entry.result_record_path,
    routedAt: entry.routed_at,
    completedAt: entry.completed_at,
    notes: entry.notes,
  };
}

export function readDiscoveryOverviewWithHostBridge(
  input: ReadDiscoveryOverviewWithHostBridgeOptions,
): DiscoveryOverviewSummary {
  const queuePath = queuePathFor(input.storage);
  const queue = input.storage.readJson<DiscoveryIntakeQueueDocument>(queuePath);
  const statusCounts = createEmptyStatusCounts();
  const routingCounts: DiscoveryOverviewRoutingCounts = {};

  for (const entry of queue.entries) {
    statusCounts[entry.status] += 1;
    const routingKey = entry.routing_target ?? "unrouted";
    routingCounts[routingKey] = (routingCounts[routingKey] ?? 0) + 1;
  }

  const maxEntries = input.maxEntries ?? 8;
  const recentEntries = queue.entries
    .slice()
    .sort((left, right) => sortTimeFor(right) - sortTimeFor(left))
    .slice(0, maxEntries)
    .map(createRecentEntry);

  return {
    queuePath,
    updatedAt: queue.updatedAt,
    totalEntries: queue.entries.length,
    statusCounts,
    routingCounts,
    recentEntries,
  };
}
