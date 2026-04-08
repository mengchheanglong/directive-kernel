export type FrontendCurrentHead = {
  artifact_path: string;
  artifact_kind: string;
  artifact_stage: string;
  artifact_lane: string;
  view_path: string;
};

export type FrontendQueueEntry = {
  candidate_id: string;
  candidate_name: string;
  status: string;
  status_effective: string;
  status_warning: string | null;
  routing_target: string | null;
  routing_record_path?: string | null;
  result_record_path: string | null;
  integrity_state: "ok" | "broken" | null;
  current_case_stage: string | null;
  current_case_next_legal_step: string | null;
  current_head: FrontendCurrentHead | null;
  review_pressure: {
    guidance_kind: string;
    summary: string;
    operator_action: string;
    stop_line: string;
    routing_confidence: string | null;
    route_conflict: boolean | null;
    needs_human_review: boolean | null;
    ambiguity_summary: {
      top_lane_id: string;
      runner_up_lane_id: string | null;
      score_delta: number;
      conflicting_signal_families: string[];
      conflicting_lane_ids: string[];
    } | null;
  } | null;
  runtime_summary: {
    proposed_host: string | null;
    promotion_readiness_blockers: string[];
  } | null;
};

export type FrontendQueueOverview = {
  entries: FrontendQueueEntry[];
  totalEntries: number;
};

export type FrontendHandoffStub = {
  kind:
    | "architecture_handoff"
    | "architecture_handoff_invalid"
    | "runtime_follow_up"
    | "runtime_follow_up_legacy"
    | "runtime_handoff_legacy";
  lane: "architecture" | "runtime";
  relativePath: string;
  candidateId: string;
  title: string;
  status: string;
  startRelativePath: string | null;
  warning: string | null;
};

export type FrontendGapPressureDetail = {
  openGapCount: number;
  gapAlignmentScore: number | null;
  matchedGapId: string | null;
  matchedGapRank: number | null;
  matchedGapPriority: string | null;
  matchedGapDescription: string | null;
  relatedMissionObjective: string | null;
  currentState: string | null;
  desiredState: string | null;
};

export type FrontendDiscoveryRoutingDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  sourceType?: string;
  decisionState?: string;
  adoptionTarget?: string;
  routeDestination?: string;
  whyThisRoute?: string;
  whyNotAlternatives?: string;
  requiredNextArtifact?: string;
  linkedIntakeRecord?: string;
  linkedTriageRecord?: string | null;
  reviewCadence?: string | null;
  engineRunId?: string | null;
  engineRunRecordPath?: string | null;
  engineRunReportPath?: string | null;
  usefulnessLevel?: string | null;
  usefulnessRationale?: string | null;
  missionPriorityScore?: number | null;
  matchedGapId?: string | null;
  gapPressure?: FrontendGapPressureDetail | null;
  routingConfidence?: string | null;
  routeConflict?: boolean | null;
  needsHumanReview?: boolean | null;
  explanationBreakdown?: {
    keywordSignals: string[];
    metadataSignals: string[];
    gapAlignmentSignals: string[];
    ambiguitySignals: string[];
  } | null;
  ambiguitySummary?: {
    topLaneId: string;
    runnerUpLaneId: string | null;
    scoreDelta: number;
    conflictingSignalFamilies: string[];
    conflictingLaneIds: string[];
  } | null;
  reviewGuidance?: {
    guidanceKind: string;
    summary: string;
    operatorAction: string;
    requiredChecks: string[];
    stopLine: string;
  } | null;
  downstreamStubRelativePath?: string | null;
  approvalAllowed?: boolean;
  content?: string;
};

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

export type FrontendArchitectureStartDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  objective?: string;
  startApproval?: string;
  resultSummary?: string;
  handoffStubPath?: string;
  resultRelativePath?: string | null;
  decisionRelativePath?: string | null;
  closeoutAssist?: {
    missionFitSummary: string;
    primaryAdoptionQuestion: string;
    extractedValue: string[];
    excludedBaggage: string[];
    directiveOwnedForm: string;
    adaptedValue: string[];
    improvementGoals: string[];
    intendedDelta: string;
    structuralStages: string[];
    stagePreservationExpectation: "preserve_explicit_stages" | "not_applicable";
    stagePreservationSummary: string;
    decisionGuidance: string;
    readinessGuidance: string[];
    suggestedResultSummary: string;
  };
  resultEvidence?: {
    availability: "direct_evidence" | "artifact_only" | "not_available";
    primaryKind: "code_path" | "artifact_path" | "none";
    primaryPath: string | null;
    primaryLabel: string;
    summary: string;
    supportingEvidence: Array<{
      kind: "bounded_result" | "closeout_decision" | "engine_run_record";
      path: string;
      label: string;
    }>;
  };
  content?: string;
};

export type FrontendArchitectureResultDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  objective?: string;
  closeoutApproval?: string;
  resultSummary?: string;
  nextDecision?: string;
  verdict?: string;
  rationale?: string;
  startRelativePath?: string;
  handoffStubPath?: string;
  decisionRelativePath?: string;
  continuationStartRelativePath?: string | null;
  adoptionRelativePath?: string | null;
  resultEvidence?: {
    availability: "direct_evidence" | "artifact_only" | "not_available";
    primaryKind: "code_path" | "artifact_path" | "none";
    primaryPath: string | null;
    primaryLabel: string;
    summary: string;
    supportingEvidence: Array<{
      kind: "bounded_result" | "closeout_decision" | "engine_run_record";
      path: string;
      label: string;
    }>;
  };
  content?: string;
};

export type FrontendArchitectureAdoptionDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  finalStatus?: string;
  sourceResultRelativePath?: string;
  decisionRelativePath?: string;
  implementationTargetRelativePath?: string | null;
  content?: string;
};

export type FrontendArchitectureImplementationTargetDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  artifactType?: string;
  finalStatus?: string;
  objective?: string;
  expectedOutcome?: string;
  adoptionRelativePath?: string;
  decisionRelativePath?: string;
  sourceResultRelativePath?: string;
  implementationResultRelativePath?: string | null;
  content?: string;
};

export type FrontendArchitectureImplementationResultDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  objective?: string;
  outcome?: "success" | "failure";
  resultSummary?: string;
  validationResult?: string;
  rollbackNote?: string;
  targetRelativePath?: string;
  adoptionRelativePath?: string;
  sourceResultRelativePath?: string;
  retainedRelativePath?: string | null;
  content?: string;
};

export type FrontendArchitectureRetentionDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  objective?: string;
  stabilityLevel?: string;
  reuseScope?: string;
  confirmationDecision?: string;
  rollbackBoundary?: string;
  resultRelativePath?: string;
  targetRelativePath?: string;
  adoptionRelativePath?: string;
  sourceResultRelativePath?: string;
  integrationRecordRelativePath?: string | null;
  content?: string;
};

export type FrontendArchitectureIntegrationRecordDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  objective?: string;
  integrationTargetSurface?: string;
  readinessSummary?: string;
  expectedEffect?: string;
  validationBoundary?: string;
  integrationDecision?: string;
  rollbackBoundary?: string;
  retainedRelativePath?: string;
  resultRelativePath?: string;
  targetRelativePath?: string;
  adoptionRelativePath?: string;
  sourceResultRelativePath?: string;
  consumptionRelativePath?: string | null;
  content?: string;
};

export type FrontendArchitectureConsumptionRecordDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  objective?: string;
  appliedSurface?: string;
  applicationSummary?: string;
  observedEffect?: string;
  validationResult?: string;
  outcome?: "success" | "failure";
  rollbackNote?: string;
  integrationRelativePath?: string;
  retainedRelativePath?: string;
  resultRelativePath?: string;
  targetRelativePath?: string;
  adoptionRelativePath?: string;
  sourceResultRelativePath?: string;
  evaluationRelativePath?: string | null;
  content?: string;
};

export type FrontendArchitecturePostConsumptionEvaluationDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  objective?: string;
  decision?: "keep" | "reopen";
  rationale?: string;
  observedStability?: string;
  retainedUsefulnessAssessment?: string;
  nextBoundedAction?: string;
  rollbackNote?: string;
  reopenedStartRelativePath?: string | null;
  consumptionRelativePath?: string;
  integrationRelativePath?: string;
  retainedRelativePath?: string;
  resultRelativePath?: string;
  targetRelativePath?: string;
  adoptionRelativePath?: string;
  sourceResultRelativePath?: string;
  content?: string;
};

export type FrontendEngineRunRecord = {
  runId: string;
  receivedAt: string;
  candidate: {
    candidateId: string;
    candidateName: string;
    usefulnessLevel: string;
    confidence?: string;
    requiresHumanReview?: boolean;
  };
  routingAssessment?: {
    confidence?: string;
    matchedGapId?: string | null;
    routeConflict?: boolean;
    needsHumanReview?: boolean;
    ambiguitySummary?: {
      topLaneId: string;
      runnerUpLaneId: string | null;
      scoreDelta: number;
      conflictingSignalFamilies: string[];
      conflictingLaneIds: string[];
    } | null;
    reviewGuidance?: {
      guidanceKind: string;
      summary: string;
      operatorAction: string;
      requiredChecks: string[];
      stopLine: string;
    } | null;
  };
  selectedLane: {
    laneId: string;
  };
  analysis: {
    usefulnessRationale: string;
  };
  decision: {
    decisionState: string;
  };
  proofPlan: {
    proofKind: string;
  };
  integrationProposal: {
    integrationMode: string;
  };
  reportPlan: {
    summary: string;
  };
};

export type FrontendEngineRunsOverview = {
  recentRuns: Array<{
    record: FrontendEngineRunRecord;
  }>;
  totalRuns: number;
};

export type FrontendEngineRunDetail = {
  ok: boolean;
  error?: string;
  record?: FrontendEngineRunRecord;
  recordPath?: string | null;
  reportPath?: string | null;
  reportContent?: string | null;
  reportExcerpt?: string | null;
  gapPressure?: FrontendGapPressureDetail | null;
};

export type FrontendLaneAnchor = {
  label: string;
  artifactPath: string;
  currentStage: string;
  nextLegalStep: string;
  candidateId: string | null;
  candidateName: string | null;
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

export type FrontendArchitectureSummaryCase = {
  candidate_id: string;
  candidate_name: string;
  current_case_stage: string | null;
  current_case_next_legal_step: string | null;
  current_head: FrontendCurrentHead | null;
};

export type FrontendLaneCaseStripInput = {
  tone: "runtime" | "architecture";
  title: string;
  summary: string;
  tags: Array<{
    value: string;
    tone: "default" | "runtime" | "architecture" | "warning";
  }>;
  cards: Array<{
    label: string;
    value: unknown;
  }>;
  boundaryNote: unknown;
  action?: {
    href: string;
    label: string;
  } | null;
};

export type FrontendSnapshot = {
  engineRuns: FrontendEngineRunsOverview;
  queue: FrontendQueueOverview;
  runtimeSummary: {
    activeCases: FrontendRuntimeSummaryCase[];
    recentAnchors: FrontendLaneAnchor[];
  };
  architectureSummary: {
    activeCases: FrontendArchitectureSummaryCase[];
    recentAnchors: FrontendLaneAnchor[];
  };
  handoffStubs: FrontendHandoffStub[];
  handoffWarnings: string[];
};

export type FrontendOperatorDecisionInboxEntry = {
  entryId: string;
  lane: "discovery" | "architecture" | "runtime";
  decisionSurface:
    | "discovery_routing_review"
    | "architecture_materialization_due"
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
    discoveryRoutingReviewCount: number;
    architectureMaterializationDueCount: number;
    runtimeHostSelectionCount: number;
    runtimePromotionSeamDecisionCount: number;
    runtimeRegistryAcceptanceCount: number;
  };
  entries: FrontendOperatorDecisionInboxEntry[];
};
