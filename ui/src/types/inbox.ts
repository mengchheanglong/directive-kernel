import type { FrontendExecutablePlanSummary } from "./engine.ts";

export type FrontendOperatorDecisionInboxEntry = {
  entryId: string;
  lane: "discovery" | "architecture" | "runtime" | "engine";
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
  planStateSummary?: FrontendExecutablePlanSummary | null;
};

export type FrontendOperatorDecisionInboxReport = {
  ok: boolean;
  inboxVersion: string;
  snapshotAt: string;
  directiveRoot: string;
  guardrails: {
    readOnly: boolean;
    mutatesWorkflowState: boolean;
    bypassesReview: boolean;
    writesRegistryEntries: boolean;
    runsHostAdapters: boolean;
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
  entries: FrontendOperatorDecisionInboxEntry[];
};
