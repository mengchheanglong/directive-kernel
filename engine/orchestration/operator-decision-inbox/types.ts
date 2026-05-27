import type { EngineExecutablePlanState } from "../../types.ts";

export const OPERATOR_DECISION_INBOX_VERSION = "operator_decision_inbox.v8" as const;

export type OperatorDecisionInboxLane = "discovery" | "architecture" | "runtime" | "engine";

export type OperatorDecisionInboxEntry = {
  entryId: string;
  actionId: string;
  actionKind:
    | "mission_feedback_review"
    | "discovery_routing_review"
    | "architecture_materialization_due"
    | "gap_formalization_review"
    | "runtime_host_selection"
    | "runtime_promotion_seam_decision"
    | "runtime_registry_acceptance";
  actionExecutable: boolean;
  actionTargetPath: string;
  defaultDecision: string | null;
  priorityHint: "highest" | "high" | "medium" | "low" | null;
  missionFeedbackId?: string | null;
  gapFormalizationId?: string | null;
  gapFormalizationPriorityHint?: "high" | "medium" | "low" | null;
  lane: OperatorDecisionInboxLane;
  decisionSurface:
    | "mission_health_feedback"
    | "discovery_routing_review"
    | "architecture_materialization_due"
    | "gap_formalization_review"
    | "runtime_host_selection"
    | "runtime_promotion_seam_decision"
    | "runtime_registry_acceptance";
  candidateId: string | null;
  candidateName: string | null;
  currentStage: string | null;
  artifactPath: string;
  blockReason: string;
  eligibleNextAction: string;
  requiredProof: string[];
  resolverCommandOrArtifact: string;
  relatedArtifacts: string[];
  readOnly: true;
  mutatesWorkflowState: false;
  bypassesReview: false;
  stopLine: string;
  planStateSummary?: {
    runId: string;
    proofState: EngineExecutablePlanState["proofState"]["finalState"];
    completionRate: number;
    pendingActionCount: number;
    blockedActionCount: number;
    nextActions: string[];
  } | null;
};

export type OperatorDecisionInboxReport = {
  ok: true;
  inboxVersion: typeof OPERATOR_DECISION_INBOX_VERSION;
  snapshotAt: string;
  directiveRoot: string;
  guardrails: {
    readOnly: true;
    mutatesWorkflowState: false;
    bypassesReview: false;
    writesRegistryEntries: false;
    runsHostAdapters: false;
  };
  summary: {
    totalActionableEntries: number;
    missionHealthFeedbackCount: number;
    discoveryRoutingReviewCount: number;
    architectureMaterializationDueCount: number;
    gapFormalizationReviewCount: number;
    runtimeHostSelectionCount: number;
    runtimePromotionSeamDecisionCount: number;
    runtimeRegistryAcceptanceCount: number;
  };
  entries: OperatorDecisionInboxEntry[];
};

export type CandidatePlanStateSummary =
  NonNullable<OperatorDecisionInboxEntry["planStateSummary"]>;
