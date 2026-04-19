import type { DiscoveryIntakeQueueEntry } from "../../../discovery/lib/intake/discovery-intake-queue-writer.ts";
import { resolveDirectiveWorkspaceState } from "../../state/index.ts";
import type {
  DirectiveReadOnlyLifecycleCoordinationEntry,
  DirectiveReadOnlyLifecycleCoordinationLane,
} from "./read-only-lifecycle-coordination-types.ts";
import {
  READ_ONLY_LIFECYCLE_BUCKET_PRIORITY,
} from "./read-only-lifecycle-coordination-types.ts";

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function deriveCurrentLane(
  currentStage: string | null,
): DirectiveReadOnlyLifecycleCoordinationLane {
  const stage = normalizeText(currentStage);
  if (stage.startsWith("architecture.")) return "architecture";
  if (stage.startsWith("runtime.")) return "runtime";
  if (stage.startsWith("discovery.")) return "discovery";
  return "unknown";
}

export function isLiveCase(entry: DiscoveryIntakeQueueEntry, currentStage: string | null) {
  return entry.status !== "completed" || currentStage === "discovery.monitor.active";
}

export function classifyEntry(input: {
  focus: NonNullable<ReturnType<typeof resolveDirectiveWorkspaceState>["focus"]>;
}): Pick<
  DirectiveReadOnlyLifecycleCoordinationEntry,
  "coordinationOutcome" | "bucketId" | "actionKind" | "actionSummary"
> {
  const stage = normalizeText(input.focus.currentStage);
  const nextLegalStep = normalizeText(input.focus.nextLegalStep);

  if (stage === "architecture.bounded_result.adopt") {
    return {
      coordinationOutcome: "recommend_task",
      bucketId: "architecture_retention_confirmation_due",
      actionKind: "review_retention_confirmation",
      actionSummary:
        "Retention confirmation is the next bounded task. Keep this case visible for explicit review, but do not auto-open it.",
    };
  }

  if (stage === "runtime.promotion_readiness.opened") {
    return {
      coordinationOutcome: "parked",
      bucketId: "runtime_promotion_readiness_parked",
      actionKind: "keep_runtime_promotion_readiness_visible",
      actionSummary:
        "Keep the case visible at the promotion-readiness stop. Host targeting, callable clarity, and promotion follow-through still require separate explicit decisions.",
    };
  }

  if (stage === "runtime.promotion_record.opened") {
    return {
      coordinationOutcome: "parked",
      bucketId: "runtime_manual_promotion_stop",
      actionKind: "keep_manual_promotion_record_visible",
      actionSummary:
        "Keep the bounded manual promotion record visible as a stop. Registry acceptance, host integration, runtime execution, and automation remain closed.",
    };
  }

  if (stage === "discovery.monitor.active") {
    return {
      coordinationOutcome: "parked",
      bucketId: "discovery_monitor_hold",
      actionKind: "keep_discovery_monitor_hold",
      actionSummary:
        "Keep the source in Discovery monitor until a later explicit reroute decision is justified.",
    };
  }

  if (
    stage === "architecture.bounded_result.stay_experimental"
    && nextLegalStep.includes("note-mode bounded result is an explicit stop")
  ) {
    return {
      coordinationOutcome: "stop",
      bucketId: "architecture_note_stop_carried_in_queue",
      actionKind: "keep_note_stop_visible_without_reopening",
      actionSummary:
        "This NOTE-mode stop is still present in the live queue surface. Keep it visible, but do not reopen it by momentum.",
    };
  }

  if (stage === "architecture.bounded_result.stay_experimental") {
    return {
      coordinationOutcome: "parked",
      bucketId: "architecture_experimental_parked",
      actionKind: "keep_experimental_case_visible",
      actionSummary:
        "Keep the experimental Architecture case parked until new bounded pressure justifies explicit continuation.",
    };
  }

  if (stage === "architecture.post_consumption_evaluation.keep") {
    return {
      coordinationOutcome: "stop",
      bucketId: "architecture_keep_stop_carried_in_queue",
      actionKind: "keep_keep_stop_visible_without_reopening",
      actionSummary:
        "This evaluated keep boundary remains an explicit stop even though the queue row is still live. Do not auto-continue it.",
    };
  }

  return {
    coordinationOutcome: "parked",
    bucketId: "other_live_case",
    actionKind: "inspect_live_case_boundary",
    actionSummary:
      "Keep the case visible and inspect its canonical boundary explicitly before taking any follow-through action.",
  };
}

export function compareEntries(
  left: DirectiveReadOnlyLifecycleCoordinationEntry,
  right: DirectiveReadOnlyLifecycleCoordinationEntry,
) {
  const priorityDelta =
    READ_ONLY_LIFECYCLE_BUCKET_PRIORITY[left.bucketId]
    - READ_ONLY_LIFECYCLE_BUCKET_PRIORITY[right.bucketId];
  if (priorityDelta !== 0) {
    return priorityDelta;
  }
  return left.candidateId.localeCompare(right.candidateId);
}
