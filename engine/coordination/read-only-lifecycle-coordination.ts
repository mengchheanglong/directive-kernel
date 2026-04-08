import fs from "node:fs";
import path from "node:path";

import { readJson } from "../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import { getDefaultDirectiveWorkspaceRoot } from "../../shared/lib/workspace-root.ts";
import { resolveDirectiveWorkspaceState } from "../../engine/state/index.ts";
import { aggregateRunEvidence } from "../execution/run-evidence-aggregation.ts";
import { buildDirectiveRuntimePromotionAssistanceReport } from "../../runtime/lib/runtime-promotion-assistance.ts";
import type { DiscoveryIntakeQueueEntry } from "../../discovery/lib/discovery-intake-queue-writer.ts";

export type DirectiveReadOnlyLifecycleCoordinationOutcome =
  | "recommend_task"
  | "parked"
  | "stop";

export type DirectiveReadOnlyLifecycleCoordinationBucketId =
  | "runtime_promotion_readiness_parked"
  | "runtime_manual_promotion_stop"
  | "architecture_retention_confirmation_due"
  | "architecture_experimental_parked"
  | "architecture_note_stop_carried_in_queue"
  | "architecture_keep_stop_carried_in_queue"
  | "discovery_monitor_hold"
  | "other_live_case";

export type DirectiveReadOnlyLifecycleCoordinationActionKind =
  | "review_retention_confirmation"
  | "keep_runtime_promotion_readiness_visible"
  | "keep_manual_promotion_record_visible"
  | "keep_experimental_case_visible"
  | "keep_note_stop_visible_without_reopening"
  | "keep_keep_stop_visible_without_reopening"
  | "keep_discovery_monitor_hold"
  | "inspect_live_case_boundary";

export type DirectiveReadOnlyLifecycleCoordinationLane =
  | "architecture"
  | "runtime"
  | "discovery"
  | "unknown";

export type DirectiveReadOnlyLifecycleCoordinationEntry = {
  candidateId: string;
  candidateName: string;
  routingRecordPath: string;
  queueStatus: string | null;
  routeTarget: string | null;
  operatingMode: string | null;
  currentLane: DirectiveReadOnlyLifecycleCoordinationLane;
  currentStage: string | null;
  currentHeadPath: string | null;
  nextLegalStep: string | null;
  coordinationOutcome: DirectiveReadOnlyLifecycleCoordinationOutcome;
  bucketId: DirectiveReadOnlyLifecycleCoordinationBucketId;
  actionKind: DirectiveReadOnlyLifecycleCoordinationActionKind;
  actionSummary: string;
  approvalRequired: true;
  readOnly: true;
  mutatesWorkflowState: false;
  bypassesApproval: false;
};

export type DirectiveReadOnlyLifecycleCoordinationPressure = {
  bucketId: DirectiveReadOnlyLifecycleCoordinationBucketId;
  coordinationOutcome: Exclude<DirectiveReadOnlyLifecycleCoordinationOutcome, "stop">;
  caseCount: number;
  candidateIds: string[];
  recommendedFocus: string;
};

export type DirectiveReadOnlyLifecycleCoordinationReport = {
  ok: boolean;
  checkerId: string;
  snapshotAt: string;
  mode: "read_only_lifecycle_coordination";
  guardrails: {
    mutatesQueueOrStateTruth: false;
    autoAdvancesWorkflow: false;
    bypassesApproval: false;
    impliesLifecycleOrchestration: false;
    impliesHostIntegration: false;
    impliesRuntimeExecution: false;
    impliesPromotionAutomation: false;
  };
  upstreamSignals: {
    manualRuntimePromotionCycles: {
      totalManualPromotionRecords: number;
      validatedLocallyCount: number;
      latestCandidateId: string | null;
      latestPromotionRecordPath: string | null;
    };
    runtimePromotionAssistanceTopRecommendation: null | {
      candidateId: string;
      assistanceState: string;
      recommendedActionKind: string;
    };
  };
  summary: {
    totalLiveCases: number;
    recommendTaskCount: number;
    parkedCount: number;
    stopCount: number;
    currentLaneCounts: Record<DirectiveReadOnlyLifecycleCoordinationLane, number>;
    bucketCounts: Record<DirectiveReadOnlyLifecycleCoordinationBucketId, number>;
  };
  topCoordinationPressure: DirectiveReadOnlyLifecycleCoordinationPressure | null;
  liveCases: DirectiveReadOnlyLifecycleCoordinationEntry[];
};

const CHECKER_ID = "read_only_lifecycle_coordination" as const;

const BUCKET_PRIORITY: Record<DirectiveReadOnlyLifecycleCoordinationBucketId, number> = {
  runtime_promotion_readiness_parked: 10,
  architecture_retention_confirmation_due: 20,
  architecture_experimental_parked: 30,
  discovery_monitor_hold: 40,
  runtime_manual_promotion_stop: 50,
  architecture_note_stop_carried_in_queue: 60,
  architecture_keep_stop_carried_in_queue: 70,
  other_live_case: 80,
};

function readQueueEntries(directiveRoot: string): DiscoveryIntakeQueueEntry[] {
  const queuePath = path.join(directiveRoot, "discovery", "intake-queue.json");
  const parsed = readJson<{
    entries?: DiscoveryIntakeQueueEntry[];
  }>(queuePath);
  return parsed.entries ?? [];
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function deriveCurrentLane(currentStage: string | null): DirectiveReadOnlyLifecycleCoordinationLane {
  const stage = normalizeText(currentStage);
  if (stage.startsWith("architecture.")) return "architecture";
  if (stage.startsWith("runtime.")) return "runtime";
  if (stage.startsWith("discovery.")) return "discovery";
  return "unknown";
}

function isLiveCase(entry: DiscoveryIntakeQueueEntry, currentStage: string | null) {
  return entry.status !== "completed" || currentStage === "discovery.monitor.active";
}

function classifyEntry(input: {
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

function compareEntries(
  left: DirectiveReadOnlyLifecycleCoordinationEntry,
  right: DirectiveReadOnlyLifecycleCoordinationEntry,
) {
  const priorityDelta = BUCKET_PRIORITY[left.bucketId] - BUCKET_PRIORITY[right.bucketId];
  if (priorityDelta !== 0) {
    return priorityDelta;
  }
  return left.candidateId.localeCompare(right.candidateId);
}

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

function selectTopPressure(entries: DirectiveReadOnlyLifecycleCoordinationEntry[]) {
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
      return BUCKET_PRIORITY[left.bucketId] - BUCKET_PRIORITY[right.bucketId];
    });

  return pressures[0] ?? null;
}

export function buildDirectiveReadOnlyLifecycleCoordinationReport(input?: {
  directiveRoot?: string;
  snapshotAt?: string;
}): DirectiveReadOnlyLifecycleCoordinationReport {
  const directiveRoot = normalizeAbsolutePath(input?.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const queueEntries = readQueueEntries(directiveRoot);
  const assistance = buildDirectiveRuntimePromotionAssistanceReport({ directiveRoot });
  const evidence = aggregateRunEvidence({ directiveRoot });

  const liveCases = queueEntries.flatMap((entry) => {
    if (!entry.candidate_id || !entry.routing_record_path) {
      return [];
    }

    const focus = resolveDirectiveWorkspaceState({
      directiveRoot,
      artifactPath: entry.routing_record_path,
      includeAnchors: false,
    }).focus;

    if (!focus || !isLiveCase(entry, focus.currentStage)) {
      return [];
    }

    const classification = classifyEntry({ focus });
    return [{
      candidateId: entry.candidate_id,
      candidateName: focus.candidateName ?? entry.candidate_name ?? entry.candidate_id,
      routingRecordPath: entry.routing_record_path,
      queueStatus: entry.status ?? null,
      routeTarget: focus.routeTarget ?? entry.routing_target ?? null,
      operatingMode: focus.discovery.operatingMode ?? entry.operating_mode ?? null,
      currentLane: deriveCurrentLane(focus.currentStage),
      currentStage: focus.currentStage,
      currentHeadPath: focus.currentHead.artifactPath,
      nextLegalStep: focus.nextLegalStep,
      coordinationOutcome: classification.coordinationOutcome,
      bucketId: classification.bucketId,
      actionKind: classification.actionKind,
      actionSummary: classification.actionSummary,
      approvalRequired: true,
      readOnly: true,
      mutatesWorkflowState: false,
      bypassesApproval: false,
    } satisfies DirectiveReadOnlyLifecycleCoordinationEntry];
  }).sort(compareEntries);

  const laneCounts: Record<DirectiveReadOnlyLifecycleCoordinationLane, number> = {
    architecture: 0,
    runtime: 0,
    discovery: 0,
    unknown: 0,
  };
  const bucketCounts: Record<DirectiveReadOnlyLifecycleCoordinationBucketId, number> = {
    runtime_promotion_readiness_parked: 0,
    runtime_manual_promotion_stop: 0,
    architecture_retention_confirmation_due: 0,
    architecture_experimental_parked: 0,
    architecture_note_stop_carried_in_queue: 0,
    architecture_keep_stop_carried_in_queue: 0,
    discovery_monitor_hold: 0,
    other_live_case: 0,
  };

  for (const entry of liveCases) {
    laneCounts[entry.currentLane] += 1;
    bucketCounts[entry.bucketId] += 1;
  }

  return {
    ok: true,
    checkerId: CHECKER_ID,
    snapshotAt: input?.snapshotAt ?? new Date().toISOString(),
    mode: "read_only_lifecycle_coordination",
    guardrails: {
      mutatesQueueOrStateTruth: false,
      autoAdvancesWorkflow: false,
      bypassesApproval: false,
      impliesLifecycleOrchestration: false,
      impliesHostIntegration: false,
      impliesRuntimeExecution: false,
      impliesPromotionAutomation: false,
    },
    upstreamSignals: {
      manualRuntimePromotionCycles: {
        totalManualPromotionRecords:
          evidence.manualRuntimePromotionCycles.totalManualPromotionRecords,
        validatedLocallyCount:
          evidence.manualRuntimePromotionCycles.validatedLocallyCount,
        latestCandidateId: evidence.manualRuntimePromotionCycles.latestCandidateId,
        latestPromotionRecordPath:
          evidence.manualRuntimePromotionCycles.latestPromotionRecordPath,
      },
      runtimePromotionAssistanceTopRecommendation: assistance.topRecommendation
        ? {
            candidateId: assistance.topRecommendation.candidateId,
            assistanceState: assistance.topRecommendation.assistanceState,
            recommendedActionKind: assistance.topRecommendation.recommendedActionKind,
          }
        : null,
    },
    summary: {
      totalLiveCases: liveCases.length,
      recommendTaskCount: liveCases.filter((entry) => entry.coordinationOutcome === "recommend_task")
        .length,
      parkedCount: liveCases.filter((entry) => entry.coordinationOutcome === "parked").length,
      stopCount: liveCases.filter((entry) => entry.coordinationOutcome === "stop").length,
      currentLaneCounts: laneCounts,
      bucketCounts,
    },
    topCoordinationPressure: selectTopPressure(liveCases),
    liveCases,
  };
}
