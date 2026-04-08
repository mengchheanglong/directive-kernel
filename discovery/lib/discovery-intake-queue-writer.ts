import {
  optionalString,
  requiredString,
} from "../../shared/lib/validation.ts";

export type DiscoverySourceType =
  | "github-repo"
  | "paper"
  | "product-doc"
  | "theory"
  | "technical-essay"
  | "workflow-writeup"
  | "external-system"
  | "internal-signal";

export type DiscoverySubmissionOrigin = "research-engine" | null;

export type DiscoveryQueueStatus =
  | "pending"
  | "processing"
  | "routed"
  | "completed"
  | "held";

export type DiscoveryRoutingTarget =
  | "runtime"
  | "architecture"
  | "monitor"
  | "defer"
  | "reject"
  | "reference"
  | null;

export type DiscoveryIntakeSubmission = {
  candidate_id: string;
  candidate_name: string;
  source_type?: DiscoverySourceType | null;
  source_reference: string;
  mission_alignment?: string | null;
  capability_gap_id?: string | null;
  notes?: string | null;
  operating_mode?: DiscoveryOperatingMode;
  submission_origin?: DiscoverySubmissionOrigin;
  discovery_signal_band?: string | null;
  signal_total_score?: number | null;
  signal_score_summary?: string | null;
};

export type DiscoveryOperatingMode = "note" | "standard" | "deep" | null;

export type DiscoveryIntakeQueueEntry = {
  candidate_id: string;
  candidate_name: string;
  source_type: DiscoverySourceType;
  source_reference: string;
  received_at: string;
  status: DiscoveryQueueStatus;
  routing_target: DiscoveryRoutingTarget;
  mission_alignment: string | null;
  capability_gap_id: string | null;
  assigned_worker: string | null;
  intake_record_path?: string | null;
  fast_path_record_path: string | null;
  routing_record_path: string | null;
  routed_at: string | null;
  completed_at: string | null;
  result_record_path: string | null;
  notes: string | null;
  operating_mode?: DiscoveryOperatingMode;
  submission_origin?: DiscoverySubmissionOrigin;
  discovery_signal_band?: string | null;
  signal_total_score?: number | null;
  signal_score_summary?: string | null;
};

export type DiscoveryIntakeQueueDocument = {
  status: string;
  updatedAt: string;
  policy?: Record<string, unknown>;
  entries: DiscoveryIntakeQueueEntry[];
};

function optionalFiniteNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

export function getDiscoveryIntakeArtifactPath(
  entry: Pick<DiscoveryIntakeQueueEntry, "intake_record_path" | "fast_path_record_path">,
) {
  return optionalString(entry.intake_record_path) ?? optionalString(entry.fast_path_record_path);
}

export function hasDiscoveryIntakeArtifactPath(
  entry: Pick<DiscoveryIntakeQueueEntry, "intake_record_path" | "fast_path_record_path">,
) {
  return getDiscoveryIntakeArtifactPath(entry) !== null;
}

export function createDiscoveryIntakeQueueEntry(input: {
  submission: DiscoveryIntakeSubmission;
  receivedAt: string;
}): DiscoveryIntakeQueueEntry {
  const candidateId = requiredString(input.submission.candidate_id, "candidate_id");
  const candidateName = requiredString(
    input.submission.candidate_name,
    "candidate_name",
  );
  const sourceReference = requiredString(
    input.submission.source_reference,
    "source_reference",
  );

  return {
    candidate_id: candidateId,
    candidate_name: candidateName,
    source_type: input.submission.source_type ?? "internal-signal",
    source_reference: sourceReference,
    received_at: input.receivedAt,
    status: "pending",
    routing_target: null,
    mission_alignment: optionalString(input.submission.mission_alignment),
    capability_gap_id: optionalString(input.submission.capability_gap_id),
    assigned_worker: null,
    intake_record_path: null,
    fast_path_record_path: null,
    routing_record_path: null,
    routed_at: null,
    completed_at: null,
    result_record_path: null,
    notes: optionalString(input.submission.notes),
    operating_mode: input.submission.operating_mode ?? null,
    submission_origin: input.submission.submission_origin ?? null,
    discovery_signal_band: optionalString(input.submission.discovery_signal_band),
    signal_total_score: optionalFiniteNumber(input.submission.signal_total_score),
    signal_score_summary: optionalString(input.submission.signal_score_summary),
  };
}

export function appendDiscoveryIntakeQueueEntry(input: {
  queue: DiscoveryIntakeQueueDocument;
  submission: DiscoveryIntakeSubmission;
  receivedAt: string;
  unresolvedGapIds?: Iterable<string>;
}) {
  if (input.queue.status !== "primary") {
    throw new Error(`Discovery queue is not in primary mode: ${input.queue.status}`);
  }

  const entry = createDiscoveryIntakeQueueEntry({
    submission: input.submission,
    receivedAt: input.receivedAt,
  });

  if (
    input.queue.entries.some(
      (existing) => existing.candidate_id === entry.candidate_id,
    )
  ) {
    throw new Error(`Discovery queue already contains candidate_id: ${entry.candidate_id}`);
  }

  if (entry.capability_gap_id && input.unresolvedGapIds) {
    const validGapIds = new Set(input.unresolvedGapIds);
    if (!validGapIds.has(entry.capability_gap_id)) {
      throw new Error(
        `capability_gap_id must reference an unresolved gap: ${entry.capability_gap_id}`,
      );
    }
  }

  return {
    entry,
    queue: {
      ...input.queue,
      updatedAt: input.receivedAt,
      entries: [...input.queue.entries, entry],
    } satisfies DiscoveryIntakeQueueDocument,
  };
}
