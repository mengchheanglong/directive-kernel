import type { FrontendExecutablePlanSummary } from "./engine.ts";

export type FrontendMissionFeedbackPreview = {
  feedback: {
    feedbackId: string;
    kind: "objective_rewrite" | "constraint_addition" | "staleness_warning" | "tension_resolution";
    proposedAction: string;
    rationale: string;
    healthGradeAtGeneration: string;
    sourceSignals: string[];
    suggestedMissionDelta: {
      objective?: string | null;
      usefulnessSignals?: string[];
      capabilityLanes?: string[];
      constraints?: string[];
      successSignal?: string | null;
      adoptionTarget?: string | null;
    };
    eligibleForCascade: boolean;
  };
  preview: {
    previewId: string;
    generatedAt: string;
    currentMission: {
      currentObjective: string;
      usefulnessSignals: string[];
      capabilityLanes: string[];
      constraints: string[];
      successSignal: string | null;
      adoptionTarget: string | null;
    };
    proposedMission: {
      currentObjective: string;
      usefulnessSignals: string[];
      capabilityLanes: string[];
      constraints: string[];
      successSignal: string | null;
      adoptionTarget: string | null;
    };
    affectedRuns: Array<{
      runId: string;
      currentLane: string;
      currentConfidence: string;
      projectedLane: string;
      projectedConfidence: string;
      confidenceDelta: "improved" | "unchanged" | "degraded";
      eligibilityKind: "low_confidence" | "conflicted" | "discovery_held" | null;
      eligible: boolean;
      reason: string;
    }>;
    summary: {
      totalRunsAnalyzed: number;
      totalAffected: number;
      eligibleForCascade: number;
      improvedCount: number;
      degradedCount: number;
      unchangedCount: number;
    };
  };
};

export type FrontendOperatorDecisionInboxEntry = {
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
