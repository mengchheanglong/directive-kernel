import type { FrontendCurrentHead } from "./shared.ts";

export type FrontendRuntimeFollowUpDetail = {
  ok: boolean;
  error?: string;
  kind?: "runtime_follow_up";
  relativePath?: string;
  content?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  status?: string;
  runtimeValueToOperationalize?: string;
  proposedHost?: string;
  proposedIntegrationMode?: string;
  reviewCadence?: string;
  linkedRoutingPath?: string | null;
  runtimeRecordRelativePath?: string;
  runtimeRecordExists?: boolean;
  approvalAllowed?: boolean;
};

export type FrontendLegacyRuntimeFollowUpDetail = {
  ok: boolean;
  error?: string;
  kind?: "runtime_follow_up_legacy";
  relativePath?: string;
  content?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  currentDecisionState?: string | null;
  runtimeValueToOperationalize?: string;
  proposedHost?: string;
  proposedIntegrationMode?: string | null;
  reentryContractPath?: string | null;
  currentStatus?: string | null;
  reviewCadence?: string | null;
  requiredProof?: string[];
  requiredGates?: string[];
  rollbackNote?: string | null;
};

export type FrontendLegacyRuntimeHandoffDetail = {
  ok: boolean;
  error?: string;
  kind?: "runtime_handoff_legacy";
  relativePath?: string;
  content?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  handoffType?: string | null;
  runtimeValueToOperationalize?: string;
  proposedHost?: string;
  proposedRuntimeSurface?: string;
  originatingArchitectureRecordPath?: string | null;
  mixedValuePartitionRef?: string | null;
  runtimeFollowUpPath?: string | null;
  runtimeRecordPath?: string | null;
  runtimeProofPath?: string | null;
  promotionRecordPath?: string | null;
  registryEntryPath?: string | null;
  qualityGateResult?: string | null;
};

export type FrontendRuntimeRecordDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  runtimeObjective?: string;
  proposedHost?: string;
  proposedRuntimeSurface?: string;
  requiredProofSummary?: string;
  currentStatus?: string;
  linkedFollowUpRecord?: string;
  linkedRoutingPath?: string | null;
  runtimeProofRelativePath?: string;
  proofExists?: boolean;
  approvalAllowed?: boolean;
  content?: string;
};

export type FrontendRuntimeProofDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  runtimeObjective?: string;
  proposedHost?: string;
  proposedRuntimeSurface?: string;
  currentStatus?: string;
  linkedRuntimeRecordPath?: string;
  linkedFollowUpPath?: string;
  linkedRoutingPath?: string | null;
  runtimeCapabilityBoundaryRelativePath?: string;
  runtimeCapabilityBoundaryExists?: boolean;
  approvalAllowed?: boolean;
  content?: string;
};

export type FrontendRuntimeRuntimeCapabilityBoundaryDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  runtimeObjective?: string;
  proposedHost?: string;
  proposedRuntimeSurface?: string;
  currentProofStatus?: string;
  linkedRuntimeProofPath?: string;
  linkedRuntimeRecordPath?: string;
  linkedFollowUpPath?: string;
  linkedRoutingPath?: string | null;
  promotionReadinessRelativePath?: string;
  promotionReadinessExists?: boolean;
  approvalAllowed?: boolean;
  content?: string;
};

export type FrontendRuntimePromotionReadinessDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  runtimeObjective?: string;
  proposedHost?: string;
  proposedRuntimeSurface?: string;
  executionState?: string;
  currentStatus?: string;
  promotionReadinessDecision?: string;
  hostFacingPromotionDecision?: string;
  frontendCapabilityDecision?: string;
  openedRuntimeImplementationSlicePath?: string | null;
  prePromotionImplementationSlicePath?: string | null;
  promotionInputPackagePath?: string | null;
  profileCheckerDecisionPath?: string | null;
  compileContractPath?: string | null;
  promotionGoNoGoDecisionPath?: string | null;
  linkedCapabilityBoundaryPath?: string;
  linkedRuntimeProofPath?: string;
  linkedRuntimeRecordPath?: string;
  linkedFollowUpPath?: string;
  linkedRoutingPath?: string | null;
  artifactStage?: string;
  artifactNextLegalStep?: string;
  currentStage?: string;
  nextLegalStep?: string;
  promotionReadinessBlockers?: string[];
  content?: string;
};

export type FrontendRuntimeSummaryCase = {
  candidate_id: string;
  candidate_name: string;
  current_case_stage: string | null;
  current_case_next_legal_step: string | null;
  current_head: FrontendCurrentHead | null;
  runtime_summary: {
    proposed_host: string | null;
    promotion_readiness_blockers: string[];
  } | null;
};
