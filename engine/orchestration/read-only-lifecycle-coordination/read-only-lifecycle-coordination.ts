import path from "node:path";

import { readJson } from "../../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../../shared/lib/path-normalization.ts";
import { getDefaultDirectiveWorkspaceRoot } from "../../../shared/lib/workspace-root.ts";
import { resolveDirectiveWorkspaceState } from "../../state/index.ts";
import { aggregateRunEvidence } from "../run-evidence-aggregation.ts";
import { buildDirectiveRuntimePromotionAssistanceReport } from "../../../runtime/lib/control/promotion-assistance.ts";
import type { DiscoveryIntakeQueueEntry } from "../../../discovery/lib/intake/queue-writer.ts";
import {
  classifyEntry,
  compareEntries,
  deriveCurrentLane,
  isLiveCase,
} from "./classification.ts";
import { selectTopPressure } from "./pressure.ts";

export type {
  ReadOnlyLifecycleCoordinationActionKind,
  ReadOnlyLifecycleCoordinationBucketId,
  ReadOnlyLifecycleCoordinationEntry,
  ReadOnlyLifecycleCoordinationLane,
  ReadOnlyLifecycleCoordinationOutcome,
  ReadOnlyLifecycleCoordinationPressure,
  ReadOnlyLifecycleCoordinationReport,
} from "./types.ts";
import {
  READ_ONLY_LIFECYCLE_COORDINATION_CHECKER_ID,
  type ReadOnlyLifecycleCoordinationBucketId,
  type ReadOnlyLifecycleCoordinationEntry,
  type ReadOnlyLifecycleCoordinationLane,
  type ReadOnlyLifecycleCoordinationReport,
} from "./types.ts";

function readQueueEntries(directiveRoot: string): DiscoveryIntakeQueueEntry[] {
  const queuePath = path.join(directiveRoot, "discovery", "intake-queue.json");
  const parsed = readJson<{
    entries?: DiscoveryIntakeQueueEntry[];
  }>(queuePath);
  return parsed.entries ?? [];
}

export function buildReadOnlyLifecycleCoordinationReport(input?: {
  directiveRoot?: string;
  snapshotAt?: string;
}): ReadOnlyLifecycleCoordinationReport {
  const directiveRoot = normalizeAbsolutePath(input?.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const queueEntries = readQueueEntries(directiveRoot);
  const assistance = buildDirectiveRuntimePromotionAssistanceReport({ directiveRoot });
  const evidence = aggregateRunEvidence({ directiveRoot });

  const liveCases: ReadOnlyLifecycleCoordinationEntry[] = queueEntries.flatMap((entry) => {
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
    } satisfies ReadOnlyLifecycleCoordinationEntry];
  }).sort(compareEntries);

  const laneCounts: Record<ReadOnlyLifecycleCoordinationLane, number> = {
    architecture: 0,
    runtime: 0,
    discovery: 0,
    unknown: 0,
  };
  const bucketCounts: Record<ReadOnlyLifecycleCoordinationBucketId, number> = {
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
    checkerId: READ_ONLY_LIFECYCLE_COORDINATION_CHECKER_ID,
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
