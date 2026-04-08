import {
  submitDiscoveryEntryWithHostBridge,
  type DiscoveryHostStorageBridge,
} from "./discovery-submission-adapter.template.ts";
import type { DiscoverySubmissionRequest } from "../../../discovery/lib/discovery-submission-router.ts";

export type RuntimeVerificationSignal = {
  candidate_id: string;
  signal_detected: boolean;
  regression_age_hours: number | null;
  regression_stale: boolean;
  soak_age_hours: number | null;
  soak_stale: boolean;
  reasons: string[];
};

export type MaintenanceWatchdogSignal = {
  candidate_id: string;
  candidate_name: string;
  source_type: "internal-signal";
  source_reference: string;
  mission_alignment: string;
  capability_gap_id: string | null;
  notes: string;
};

type RuntimeVerificationSignalAdapterOptions = {
  candidateName?: string;
  sourceReference?: string;
  missionAlignment?: string;
  capabilityGapId?: string | null;
};

function joinSignalReasons(reasons: string[]) {
  return reasons.map((reason) => reason.trim()).filter(Boolean).join("; ");
}

export function toDiscoverySubmissionFromRuntimeVerificationSignal(
  signal: RuntimeVerificationSignal,
  options: RuntimeVerificationSignalAdapterOptions = {},
): DiscoverySubmissionRequest | null {
  if (!signal.signal_detected) {
    return null;
  }

  return {
    candidate_id: signal.candidate_id,
    candidate_name:
      options.candidateName ?? "Runtime Verification Freshness Signal",
    source_type: "internal-signal",
    source_reference:
      options.sourceReference ??
      "host://signals/runtime-verification-freshness",
    mission_alignment:
      options.missionAlignment ??
      "Surfaces stale runtime verification into Discovery before orchestration confidence drifts away from recent proof.",
    capability_gap_id: options.capabilityGapId ?? null,
    notes: joinSignalReasons(signal.reasons),
    record_shape: "queue_only",
  };
}

export function toDiscoverySubmissionFromMaintenanceWatchdogSignal(
  signal: MaintenanceWatchdogSignal,
): DiscoverySubmissionRequest {
  return {
    candidate_id: signal.candidate_id,
    candidate_name: signal.candidate_name,
    source_type: signal.source_type,
    source_reference: signal.source_reference,
    mission_alignment: signal.mission_alignment,
    capability_gap_id: signal.capability_gap_id ?? null,
    notes: signal.notes,
    record_shape: "queue_only",
  };
}

export async function submitRuntimeVerificationSignalWithHostBridge(input: {
  signal: RuntimeVerificationSignal;
  storage: DiscoveryHostStorageBridge;
  dryRun?: boolean;
  options?: RuntimeVerificationSignalAdapterOptions;
}) {
  const submission = toDiscoverySubmissionFromRuntimeVerificationSignal(
    input.signal,
    input.options,
  );
  if (!submission) {
    return {
      ok: true as const,
      submitted: false as const,
      reason: "signal_not_detected" as const,
      candidate_id: input.signal.candidate_id,
    };
  }

  return submitDiscoveryEntryWithHostBridge({
    storage: input.storage,
    request: submission,
    dryRun: input.dryRun,
  });
}

export async function submitMaintenanceWatchdogSignalWithHostBridge(input: {
  signal: MaintenanceWatchdogSignal;
  storage: DiscoveryHostStorageBridge;
  dryRun?: boolean;
}) {
  return submitDiscoveryEntryWithHostBridge({
    storage: input.storage,
    request: toDiscoverySubmissionFromMaintenanceWatchdogSignal(input.signal),
    dryRun: input.dryRun,
  });
}
