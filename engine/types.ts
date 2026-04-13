export const DIRECTIVE_ENGINE_SUPPORTED_SOURCE_TYPES = [
  "github-repo",
  "paper",
  "product-doc",
  "theory",
  "technical-essay",
  "workflow-writeup",
  "external-system",
  "internal-signal",
] as const;

export const DIRECTIVE_ENGINE_INTEGRATION_MODES = [
  "none",
  "reimplement",
  "adapt",
  "wrap",
] as const;

export const DIRECTIVE_ENGINE_RUN_RECORD_KIND = "directive_engine_run_record" as const;
export const DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION = 6 as const;
export const DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_REF =
  "shared/schemas/directive-engine-run-record.schema.json" as const;

export type DirectiveEngineSourceType =
  (typeof DIRECTIVE_ENGINE_SUPPORTED_SOURCE_TYPES)[number];

export type DirectiveEngineIntegrationMode =
  (typeof DIRECTIVE_ENGINE_INTEGRATION_MODES)[number];

export type DirectiveEngineUsefulnessLevel = "direct" | "structural" | "meta" | "hybrid";

export type DirectiveEngineRoutingConfidence = "high" | "medium" | "low";

export type DirectiveEnginePrimaryAdoptionTarget =
  | "discovery"
  | "architecture"
  | "runtime";

export type DirectiveEngineWorkflowBoundaryShape =
  | "bounded_protocol"
  | "iterative_loop";

export type DirectiveEngineHostDependence =
  | "engine_only"
  | "host_adapter_required";

export type DirectiveEngineLaneId = string;

export type DirectiveEngineCapabilityGapPriority = "high" | "medium" | "low";

export type DirectiveEngineEventType =
  | "source_ingested"
  | "source_analyzed"
  | "candidate_routed"
  | "value_extracted"
  | "value_adapted"
  | "value_improved"
  | "proof_planned"
  | "decision_recorded"
  | "integration_proposed"
  | "report_planned";

export type DirectiveEngineSourceItem = {
  sourceId?: string | null;
  sourceType: DirectiveEngineSourceType;
  sourceRef: string;
  title: string;
  summary?: string | null;
  notes?: string[] | null;
  missionAlignmentHint?: string | null;
  capabilityGapId?: string | null;
  primaryAdoptionTarget?: DirectiveEnginePrimaryAdoptionTarget | null;
  containsExecutableCode?: boolean | null;
  containsWorkflowPattern?: boolean | null;
  improvesDirectiveWorkspace?: boolean | null;
  workflowBoundaryShape?: DirectiveEngineWorkflowBoundaryShape | null;
};

export type DirectiveEngineMissionInput = {
  missionId?: string | null;
  currentObjective?: string | null;
  usefulnessSignals?: string[] | null;
  capabilityLanes?: string[] | null;
  constraints?: string[] | null;
  successSignal?: string | null;
  adoptionTarget?: string | null;
  activeMissionMarkdown?: string | null;
};

export type DirectiveEngineMissionContext = {
  missionId: string | null;
  currentObjective: string;
  usefulnessSignals: string[];
  capabilityLanes: string[];
  constraints: string[];
  successSignal: string | null;
  adoptionTarget: string | null;
  activeMissionMarkdown: string;
};

export type DirectiveEngineCapabilityGap = {
  gapId: string;
  description: string;
  priority: DirectiveEngineCapabilityGapPriority;
  relatedMissionObjective: string;
  currentState: string;
  desiredState: string;
  detectedAt: string;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
};

export type DirectiveEngineRoutingAssessment = {
  recommendedLaneId: DirectiveEngineLaneId;
  recommendedRecordShape: string;
  missionPriorityScore: number;
  confidence: DirectiveEngineRoutingConfidence;
  matchedGapId: string | null;
  matchedGapRank: number | null;
  explicitRouteDestination: DirectiveEngineLaneId | null;
  routeConflict: boolean;
  needsHumanReview: boolean;
  ambiguitySummary: {
    topLaneId: DirectiveEngineLaneId;
    runnerUpLaneId: DirectiveEngineLaneId | null;
    scoreDelta: number;
    conflictingSignalFamilies: Array<"keyword" | "metadata" | "gap">;
    conflictingLaneIds: DirectiveEngineLaneId[];
  };
  reviewGuidance: {
    guidanceKind:
      | "conflicted_architecture_review"
      | "conflicted_runtime_review"
      | "low_confidence_discovery_hold"
      | "bounded_lane_review";
    summary: string;
    operatorAction: string;
    requiredChecks: string[];
    stopLine: string;
  } | null;
  missionSpecificityWarning: string | null;
  missionHealth: {
    overallScore: number;
    healthGrade: "A" | "B" | "C" | "D" | "F";
    objectiveSpecificityScore: number;
    usefulnessSignalQualityScore: number;
    constraintQualityScore: number;
    lanePriorityClarityScore: number;
    overmatchRiskScore: number;
    stalenessRiskScore: number;
    warnings: string[];
    tensionSignals: string[];
    rationale: string[];
    suggestedObjectiveRewrite: string | null;
    suggestedConstraintAdditions: string[];
  } | null;
  goalCopilot: {
    overallScore: number;
    objectiveSpecificityScore: number;
    usefulnessSignalQualityScore: number;
    constraintQualityScore: number;
    laneClarityScore: number;
    warnings: string[];
    rationale: string[];
    suggestedObjective: string | null;
    suggestedConstraints: string[];
    suggestedUsefulnessSignals: string[];
    suggestedCapabilityLanes: string[];
  };
  confidenceRecovery: {
    summary: string;
    confidenceLift: string;
    requestedInputs: Array<{
      field: string;
      question: string;
      whyItMatters: string;
      exampleAnswer: string | null;
    }>;
  } | null;
  followUpQuestions: {
    summary: string;
    questions: Array<{
      field: string;
      question: string;
      whyItMatters: string;
      exampleAnswer: string | null;
      predictedEffect: string;
    }>;
  } | null;
  gapRadar: {
    summary: string;
    suggestions: Array<{
      radarId: string;
      targetLaneId: DirectiveEngineLaneId;
      confidence: "low" | "medium" | "high";
      evidenceCount: number;
      summary: string;
      recommendedChange: string;
      signalTokens: string[];
      relatedOpenGapId: string | null;
      suggestedPriority: DirectiveEngineCapabilityGapPriority;
    }>;
  } | null;
  earnedAutonomy: {
    routeClass: string;
    overallScore: number;
    evidenceCount: number;
    operatorAgreementRate: number | null;
    reviewClearRate: number | null;
    reversalCount: number;
    autoApprovalEligible: boolean;
    approvalReductionApplied: boolean;
    summary: string;
    rationale: string[];
  };
  sourceMemory: {
    summary: string;
    biasAdjustments: Record<DirectiveEngineLaneId, number>;
    matchingTopics: Array<{
      token: string;
      recentCount: number;
      totalCount: number;
      dominantLaneId: DirectiveEngineLaneId;
    }>;
    matchingRouteClass: {
      routeClass: string;
      laneId: DirectiveEngineLaneId;
      sourceType: string;
      recentCount: number;
      totalCount: number;
      lastSeenAt: string;
    } | null;
    rationale: string[];
  } | null;
  sourceSimilarity: {
    summary: string;
    relatedSources: Array<{
      runId: string;
      candidateId: string;
      candidateName: string;
      laneId: DirectiveEngineLaneId;
      decisionState: string;
      receivedAt: string;
      similarityScore: number;
      sharedTokens: string[];
      summary: string;
    }>;
  } | null;
  narrativeContext: import("./source-narrative-threading.ts").DirectiveSourceNarrativeContext;
  laneProportions: Record<DirectiveEngineLaneId, number>;
  secondaryLanes: Array<{
    laneId: DirectiveEngineLaneId;
    proportion: number;
    reason: string;
  }>;
  scoreBreakdown: {
    missionFit: number;
    gapAlignment: number;
    laneScores: Record<DirectiveEngineLaneId, number>;
    keywordLaneScores: Record<DirectiveEngineLaneId, number>;
    metadataLaneScores: Record<DirectiveEngineLaneId, number>;
    gapLaneScores: Record<DirectiveEngineLaneId, number>;
    metaUsefulnessSignal: number;
    patternExtractionSignal: number;
    transformationSignal: number;
    runtimeSignal: number;
    ambiguityPenalty: number;
    total: number;
  };
  explanationBreakdown: {
    keywordSignals: string[];
    metadataSignals: string[];
    gapAlignmentSignals: string[];
    ambiguitySignals: string[];
  };
  rationale: string[];
};

export type DirectiveEngineSelectedLane = {
  laneId: DirectiveEngineLaneId;
  label: string;
  hostDependence: DirectiveEngineHostDependence;
  valuableWithoutHostRuntime: boolean;
};

export type DirectiveEngineCandidate = {
  candidateId: string;
  candidateName: string;
  recommendedLaneId: DirectiveEngineLaneId;
  recommendedLaneLabel: string | null;
  recommendedRecordShape: string;
  usefulnessLevel: DirectiveEngineUsefulnessLevel;
  missionPriorityScore: number;
  confidence: DirectiveEngineRoutingConfidence;
  matchedGapId: string | null;
  matchedGapRank: number | null;
  requiresHumanReview: boolean;
  rationale: string[];
};

export type DirectiveEngineAnalysis = {
  missionFitSummary: string;
  primaryAdoptionQuestion: string;
  matchedCapabilityGapId: string | null;
  usefulnessRationale: string;
  rationale: string[];
};

export type DirectiveEngineExtractionPlan = {
  extractedValue: string[];
  excludedBaggage: string[];
};

export type DirectiveEngineAdaptationPlan = {
  directiveOwnedForm: string;
  adaptedValue: string[];
};

export type DirectiveEngineImprovementPlan = {
  improvementGoals: string[];
  intendedDelta: string;
};

export type DirectiveEngineProofPlan = {
  proofKind: string;
  objective: string;
  requiredEvidence: string[];
  requiredGates: string[];
  rollbackPrompt: string;
};

export type DirectiveEngineDecisionState =
  | "hold_in_discovery"
  | "accept_for_architecture"
  | "route_to_runtime_follow_up"
  | "needs_human_review";

export type DirectiveEngineDecision = {
  decisionState: DirectiveEngineDecisionState;
  adoptionTargetLaneId: DirectiveEngineLaneId;
  adoptionTargetLaneLabel: string | null;
  requiresHumanApproval: boolean;
  summary: string;
  rationale: string[];
};

export type DirectiveEngineIntegrationProposal = {
  targetLaneId: DirectiveEngineLaneId;
  targetLaneLabel: string | null;
  integrationMode: DirectiveEngineIntegrationMode;
  hostDependence: DirectiveEngineHostDependence;
  valuableWithoutHostRuntime: boolean;
  handoffArtifactFamily: string;
  nextAction: string;
  requiresHumanReview: boolean;
};

export type DirectiveEngineReportPlan = {
  reportKind: string;
  summary: string;
  usefulnessRationale: string;
  requiredDestinations: string[];
  syncRequired: boolean;
};

export type DirectiveEngineEvent = {
  type: DirectiveEngineEventType;
  at: string;
  summary: string;
};

export type DirectiveEngineRunRecord = {
  $schema: typeof DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_REF;
  schemaVersion: typeof DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION;
  recordKind: typeof DIRECTIVE_ENGINE_RUN_RECORD_KIND;
  runId: string;
  receivedAt: string;
  source: DirectiveEngineSourceItem;
  mission: DirectiveEngineMissionContext;
  openGaps: DirectiveEngineCapabilityGap[];
  selectedLane: DirectiveEngineSelectedLane;
  candidate: DirectiveEngineCandidate;
  analysis: DirectiveEngineAnalysis;
  routingAssessment: DirectiveEngineRoutingAssessment;
  extractionPlan: DirectiveEngineExtractionPlan;
  adaptationPlan: DirectiveEngineAdaptationPlan;
  improvementPlan: DirectiveEngineImprovementPlan;
  proofPlan: DirectiveEngineProofPlan;
  priorPlanContext: import("./plan-consumption.ts").DirectivePriorPlanContext;
  decision: DirectiveEngineDecision;
  integrationProposal: DirectiveEngineIntegrationProposal;
  reportPlan: DirectiveEngineReportPlan;
  events: DirectiveEngineEvent[];
};

export type DirectiveEngineHostAdapterResult = {
  accepted: boolean;
  note?: string | null;
};

export type DirectiveEngineHostAdapter = {
  id: string;
  onRunRecorded?(
    record: DirectiveEngineRunRecord,
  ):
    | DirectiveEngineHostAdapterResult
    | void
    | Promise<DirectiveEngineHostAdapterResult | void>;
};

export type DirectiveEngineProcessSourceInput = {
  source: DirectiveEngineSourceItem;
  mission: DirectiveEngineMissionInput;
  gaps?: DirectiveEngineCapabilityGap[] | null;
  receivedAt?: string | null;
  /** Past operator routing corrections to bias future lane scoring. */
  corrections?: import("./routing-correction-ledger.ts").RoutingCorrectionEntry[] | null;
  /** Past review-resolution policy events used for gap radar and earned autonomy. */
  policyEvents?: import("./decision-policy-ledger.ts").DecisionPolicyEvent[] | null;
};

export type DirectiveEngineProcessSourceResult = {
  ok: true;
  record: DirectiveEngineRunRecord;
  adapterResults: Array<{
    adapterId: string;
    accepted: boolean;
    note: string | null;
  }>;
  deduplicated?: boolean;
  duplicateOfRunId?: string | null;
  duplicateReason?: string | null;
};
