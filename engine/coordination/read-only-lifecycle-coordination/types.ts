export type ReadOnlyLifecycleCoordinationOutcome =
  | "recommend_task"
  | "parked"
  | "stop";

export type ReadOnlyLifecycleCoordinationBucketId =
  | "runtime_promotion_readiness_parked"
  | "runtime_manual_promotion_stop"
  | "architecture_retention_confirmation_due"
  | "architecture_experimental_parked"
  | "architecture_note_stop_carried_in_queue"
  | "architecture_keep_stop_carried_in_queue"
  | "discovery_monitor_hold"
  | "other_live_case";

export type ReadOnlyLifecycleCoordinationActionKind =
  | "review_retention_confirmation"
  | "keep_runtime_promotion_readiness_visible"
  | "keep_manual_promotion_record_visible"
  | "keep_experimental_case_visible"
  | "keep_note_stop_visible_without_reopening"
  | "keep_keep_stop_visible_without_reopening"
  | "keep_discovery_monitor_hold"
  | "inspect_live_case_boundary";

export type ReadOnlyLifecycleCoordinationLane =
  | "architecture"
  | "runtime"
  | "discovery"
  | "unknown";

export type ReadOnlyLifecycleCoordinationEntry = {
  candidateId: string;
  candidateName: string;
  routingRecordPath: string;
  queueStatus: string | null;
  routeTarget: string | null;
  operatingMode: string | null;
  currentLane: ReadOnlyLifecycleCoordinationLane;
  currentStage: string | null;
  currentHeadPath: string | null;
  nextLegalStep: string | null;
  coordinationOutcome: ReadOnlyLifecycleCoordinationOutcome;
  bucketId: ReadOnlyLifecycleCoordinationBucketId;
  actionKind: ReadOnlyLifecycleCoordinationActionKind;
  actionSummary: string;
  approvalRequired: true;
  readOnly: true;
  mutatesWorkflowState: false;
  bypassesApproval: false;
};

export type ReadOnlyLifecycleCoordinationPressure = {
  bucketId: ReadOnlyLifecycleCoordinationBucketId;
  coordinationOutcome: Exclude<ReadOnlyLifecycleCoordinationOutcome, "stop">;
  caseCount: number;
  candidateIds: string[];
  recommendedFocus: string;
};

export type ReadOnlyLifecycleCoordinationReport = {
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
    currentLaneCounts: Record<ReadOnlyLifecycleCoordinationLane, number>;
    bucketCounts: Record<ReadOnlyLifecycleCoordinationBucketId, number>;
  };
  topCoordinationPressure: ReadOnlyLifecycleCoordinationPressure | null;
  liveCases: ReadOnlyLifecycleCoordinationEntry[];
};

export const READ_ONLY_LIFECYCLE_COORDINATION_CHECKER_ID =
  "read_only_lifecycle_coordination" as const;

export const READ_ONLY_LIFECYCLE_BUCKET_PRIORITY: Record<
  ReadOnlyLifecycleCoordinationBucketId,
  number
> = {
  runtime_promotion_readiness_parked: 10,
  architecture_retention_confirmation_due: 20,
  architecture_experimental_parked: 30,
  discovery_monitor_hold: 40,
  runtime_manual_promotion_stop: 50,
  architecture_note_stop_carried_in_queue: 60,
  architecture_keep_stop_carried_in_queue: 70,
  other_live_case: 80,
};
