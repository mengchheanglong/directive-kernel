import type {
  DirectiveReadOnlyLifecycleCoordinationBucketId,
  DirectiveReadOnlyLifecycleCoordinationEntry,
  DirectiveReadOnlyLifecycleCoordinationPressure,
} from "./read-only-lifecycle-coordination-types.ts";
import {
  READ_ONLY_LIFECYCLE_BUCKET_PRIORITY,
} from "./read-only-lifecycle-coordination-types.ts";

function buildPressure(
  bucketId: DirectiveReadOnlyLifecycleCoordinationBucketId,
  entries: DirectiveReadOnlyLifecycleCoordinationEntry[],
): DirectiveReadOnlyLifecycleCoordinationPressure | null {
  if (entries.length === 0) {
    return null;
  }

  const coordinationOutcome = entries[0]!.coordinationOutcome;
  if (coordinationOutcome === "stop") {
    return null;
  }

  let recommendedFocus = "Keep the recurring coordination pressure visible without opening workflow advancement.";
  switch (bucketId) {
    case "runtime_promotion_readiness_parked":
      recommendedFocus =
        "Keep the recurring promotion-readiness cluster visible and prefer explicit host-target and callable-boundary clarity before any later promotion follow-through.";
      break;
    case "architecture_retention_confirmation_due":
      recommendedFocus =
        "Keep retention-confirmation cases grouped for explicit review, but do not auto-open the next Architecture step.";
      break;
    case "architecture_experimental_parked":
      recommendedFocus =
        "Keep experimental Architecture cases grouped as parked until new bounded pressure appears.";
      break;
    case "discovery_monitor_hold":
      recommendedFocus =
        "Keep Discovery monitor holds grouped until reroute pressure becomes explicit.";
      break;
    case "runtime_manual_promotion_stop":
      recommendedFocus =
        "Keep manual promotion-record stops visible as evidence, not as automatic continuation signals.";
      break;
    case "other_live_case":
      recommendedFocus =
        "Keep unmatched live cases visible for explicit review before opening any new seam.";
      break;
    default:
      break;
  }

  return {
    bucketId,
    coordinationOutcome,
    caseCount: entries.length,
    candidateIds: entries.map((entry) => entry.candidateId),
    recommendedFocus,
  };
}

export function selectTopPressure(entries: DirectiveReadOnlyLifecycleCoordinationEntry[]) {
  const grouped = new Map<
    DirectiveReadOnlyLifecycleCoordinationBucketId,
    DirectiveReadOnlyLifecycleCoordinationEntry[]
  >();

  for (const entry of entries) {
    if (entry.coordinationOutcome === "stop") {
      continue;
    }
    const group = grouped.get(entry.bucketId) ?? [];
    group.push(entry);
    grouped.set(entry.bucketId, group);
  }

  const pressures = [...grouped.entries()]
    .map(([bucketId, bucketEntries]) => buildPressure(bucketId, bucketEntries))
    .filter((pressure): pressure is DirectiveReadOnlyLifecycleCoordinationPressure => pressure !== null)
    .sort((left, right) => {
      if (left.caseCount !== right.caseCount) {
        return right.caseCount - left.caseCount;
      }
      return READ_ONLY_LIFECYCLE_BUCKET_PRIORITY[left.bucketId]
        - READ_ONLY_LIFECYCLE_BUCKET_PRIORITY[right.bucketId];
    });

  return pressures[0] ?? null;
}
