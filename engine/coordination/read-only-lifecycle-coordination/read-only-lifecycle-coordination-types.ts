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

export const READ_ONLY_LIFECYCLE_COORDINATION_CHECKER_ID =
  "read_only_lifecycle_coordination" as const;

export const READ_ONLY_LIFECYCLE_BUCKET_PRIORITY: Record<
  DirectiveReadOnlyLifecycleCoordinationBucketId,
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
