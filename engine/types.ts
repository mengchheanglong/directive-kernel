export const ENGINE_SUPPORTED_SOURCE_TYPES = [
  "github-repo",
  "paper",
  "product-doc",
  "theory",
  "technical-essay",
  "workflow-writeup",
  "external-system",
  "internal-signal",
] as const;

export const ENGINE_INTEGRATION_MODES = [
  "none",
  "reimplement",
  "adapt",
  "wrap",
] as const;

export const ENGINE_RUN_RECORD_KIND = "directive_engine_run_record" as const;
export const DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION = 9 as const;
export const ENGINE_RUN_RECORD_SCHEMA_REF =
  "shared/schemas/run-record.schema.json" as const;
export type EngineRunRecordSchemaVersion =
  | 8
  | typeof DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION;

export type EngineSourceType =
  (typeof ENGINE_SUPPORTED_SOURCE_TYPES)[number];

export type EngineIntegrationMode =
  (typeof ENGINE_INTEGRATION_MODES)[number];

export type EngineUsefulnessLevel = "direct" | "structural" | "meta" | "hybrid";

export type EngineRoutingConfidence = "high" | "medium" | "low";

export type RoutingDigestConcernKind =
  | "conflict"
  | "low_confidence"
  | "mission_weakness"
  | "stalled_thread"
  | "narrative_action"
  | "gap_pressure"
  | "none";

export type RoutingDigestConcern = {
  kind: Exclude<RoutingDigestConcernKind, "none">;
  summary: string;
  suggestedAction: string;
};

export type RoutingDigest = {
  headline: string;
  explanation: string;
  primaryConcern: RoutingDigestConcern | null;
  secondaryConcerns: Array<{
    kind: Exclude<RoutingDigestConcernKind, "none">;
    summary: string;
  }>;
  threadContext: string | null;
  trustLevel: string;
};

export type EnginePrimaryAdoptionTarget =
  | "discovery"
  | "architecture"
  | "runtime";

export type EngineWorkflowBoundaryShape =
  | "bounded_protocol"
  | "iterative_loop";

export type EngineHostDependence =
  | "engine_only"
  | "host_adapter_required";

export type EngineLaneId = string;

export type EngineCapabilityGapPriority = "high" | "medium" | "low";

export type EngineEventType =
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

export type EngineSourceItem = {
  sourceId?: string | null;
  sourceType: EngineSourceType;
  sourceRef: string;
  title: string;
  summary?: string | null;
  notes?: string[] | null;
  missionAlignmentHint?: string | null;
  capabilityGapId?: string | null;
  primaryAdoptionTarget?: EnginePrimaryAdoptionTarget | null;
  containsExecutableCode?: boolean | null;
  containsWorkflowPattern?: boolean | null;
  improvesDirectiveWorkspace?: boolean | null;
  workflowBoundaryShape?: EngineWorkflowBoundaryShape | null;
};

export type EngineMissionInput = {
  missionId?: string | null;
  currentObjective?: string | null;
  usefulnessSignals?: string[] | null;
  capabilityLanes?: string[] | null;
  constraints?: string[] | null;
  successSignal?: string | null;
  adoptionTarget?: string | null;
  activeMissionMarkdown?: string | null;
};

export type EngineMissionContext = {
  missionId: string | null;
  currentObjective: string;
  usefulnessSignals: string[];
  capabilityLanes: string[];
  constraints: string[];
  successSignal: string | null;
  adoptionTarget: string | null;
  activeMissionMarkdown: string;
};

export type EngineCapabilityGap = {
  gapId: string;
  description: string;
  priority: EngineCapabilityGapPriority;
  relatedMissionObjective: string;
  currentState: string;
  desiredState: string;
  detectedAt: string;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
};

export type EngineRoutingAssessment = {
  recommendedLaneId: EngineLaneId;
  recommendedRecordShape: string;
  missionPriorityScore: number;
  confidence: EngineRoutingConfidence;
  matchedGapId: string | null;
  matchedGapRank: number | null;
  explicitRouteDestination: EngineLaneId | null;
  routingPrior?: {
    recommendedLaneId: EngineLaneId;
    confidence: EngineRoutingConfidence;
    laneScores: Record<EngineLaneId, number>;
    signalWinner: EngineLaneId;
  };
  routingJudgment?: Record<string, unknown>;
  routingDisagreement?: {
    kind: "lane" | "confidence" | "review" | "none";
    priorLaneId: string;
    judgmentLaneId: string;
    priorConfidence: string;
    judgmentConfidence: string;
    priorLaneScores: Record<string, number>;
    resolution: "judgment_wins";
  } | null;
  routeConflict: boolean;
  needsHumanReview: boolean;
  ambiguitySummary: {
    topLaneId: EngineLaneId;
    runnerUpLaneId: EngineLaneId | null;
    scoreDelta: number;
    conflictingSignalFamilies: Array<"keyword" | "metadata" | "gap">;
    conflictingLaneIds: EngineLaneId[];
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
  digest: RoutingDigest;
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
      targetLaneId: EngineLaneId;
      confidence: "low" | "medium" | "high";
      evidenceCount: number;
      summary: string;
      recommendedChange: string;
      signalTokens: string[];
      relatedOpenGapId: string | null;
      suggestedPriority: EngineCapabilityGapPriority;
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
    biasAdjustments: Record<EngineLaneId, number>;
    matchingTopics: Array<{
      token: string;
      recentCount: number;
      totalCount: number;
      dominantLaneId: EngineLaneId;
    }>;
    matchingRouteClass: {
      routeClass: string;
      laneId: EngineLaneId;
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
      laneId: EngineLaneId;
      decisionState: string;
      receivedAt: string;
      similarityScore: number;
      sharedTokens: string[];
      summary: string;
    }>;
  } | null;
  narrativeContext: import("./routing/source-narrative-threading.ts").SourceNarrativeContext;
  laneProportions: Record<EngineLaneId, number>;
  secondaryLanes: Array<{
    laneId: EngineLaneId;
    proportion: number;
    reason: string;
  }>;
  scoreBreakdown: {
    missionFit: number;
    gapAlignment: number;
    laneScores: Record<EngineLaneId, number>;
    keywordLaneScores: Record<EngineLaneId, number>;
    metadataLaneScores: Record<EngineLaneId, number>;
    gapLaneScores: Record<EngineLaneId, number>;
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

export type EngineSelectedLane = {
  laneId: EngineLaneId;
  label: string;
  hostDependence: EngineHostDependence;
  valuableWithoutHostRuntime: boolean;
};

export type EngineCandidate = {
  candidateId: string;
  candidateName: string;
  recommendedLaneId: EngineLaneId;
  recommendedLaneLabel: string | null;
  recommendedRecordShape: string;
  usefulnessLevel: EngineUsefulnessLevel;
  missionPriorityScore: number;
  confidence: EngineRoutingConfidence;
  matchedGapId: string | null;
  matchedGapRank: number | null;
  requiresHumanReview: boolean;
  rationale: string[];
};

export type EngineAnalysis = {
  missionFitSummary: string;
  primaryAdoptionQuestion: string;
  matchedCapabilityGapId: string | null;
  usefulnessRationale: string;
  rationale: string[];
};

export type EngineExtractionPlan = {
  extractedValue: string[];
  excludedBaggage: string[];
};

export type EnginePlanItemStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped";

export type EnginePlanItem = {
  value: string;
  status: EnginePlanItemStatus;
  completedAt: string | null;
};

export type EnginePlanProgressUpdate =
  | {
      plan: "extraction";
      itemType: "extractedValue" | "excludedBaggage";
      index: number;
      status: EnginePlanItemStatus;
      completedAt?: string | null;
    }
  | {
      plan: "adaptation";
      itemType: "directiveOwnedForm";
      status: EnginePlanItemStatus;
      completedAt?: string | null;
    }
  | {
      plan: "adaptation";
      itemType: "adaptedValue";
      index: number;
      status: EnginePlanItemStatus;
      completedAt?: string | null;
    }
  | {
      plan: "improvement";
      itemType: "intendedDelta";
      status: EnginePlanItemStatus;
      completedAt?: string | null;
    }
  | {
      plan: "improvement";
      itemType: "improvementGoals";
      index: number;
      status: EnginePlanItemStatus;
      completedAt?: string | null;
    }
  | {
      plan: "proof";
      itemType: "objective" | "rollbackPrompt";
      status: EnginePlanItemStatus;
      completedAt?: string | null;
    }
  | {
      plan: "proof";
      itemType: "requiredEvidence" | "requiredGates";
      index: number;
      status: EnginePlanItemStatus;
      completedAt?: string | null;
    };

export type EngineStructuredExtractionPlan = {
  extractedValue: EnginePlanItem[];
  excludedBaggage: EnginePlanItem[];
  completionRate: number;
};

export type EngineAdaptationPlan = {
  directiveOwnedForm: string;
  adaptedValue: string[];
};

export type EngineStructuredAdaptationPlan = {
  directiveOwnedForm: EnginePlanItem;
  adaptedValue: EnginePlanItem[];
  completionRate: number;
};

export type EngineImprovementPlan = {
  improvementGoals: string[];
  intendedDelta: string;
};

export type EngineStructuredImprovementPlan = {
  improvementGoals: EnginePlanItem[];
  intendedDelta: EnginePlanItem;
  completionRate: number;
};

export type EngineProofPlan = {
  proofKind: string;
  objective: string;
  requiredEvidence: string[];
  requiredGates: string[];
  rollbackPrompt: string;
};

export type EngineStructuredProofPlan = {
  proofKind: string;
  objective: EnginePlanItem;
  requiredEvidence: EnginePlanItem[];
  requiredGates: EnginePlanItem[];
  rollbackPrompt: EnginePlanItem;
  completionRate: number;
};

export type EngineExecutablePlanActionOwner =
  | "engine"
  | "operator"
  | "host";

export type EngineExecutablePlanAction = {
  actionId: string;
  plan: "extraction" | "adaptation" | "improvement" | "proof";
  itemType: string;
  itemIndex: number | null;
  title: string;
  detail: string;
  owner: EngineExecutablePlanActionOwner;
  status: EnginePlanItemStatus;
  completedAt: string | null;
  blockedByActionIds: string[];
  completionCriteria: string[];
  evidenceStatus: "not_needed" | "pending" | "gathering" | "gathered";
  gateStatus: "not_needed" | "pending" | "reviewing" | "passed";
};

export type EngineExecutableProofState = {
  objectiveState: "pending" | "defined";
  evidenceState: "not_needed" | "evidence_pending" | "evidence_gathering" | "evidence_gathered";
  gateState: "not_needed" | "gate_pending" | "gate_review" | "gate_passed";
  finalState: "proof_pending" | "proof_ready" | "proved";
  outstandingEvidenceActionIds: string[];
  outstandingGateActionIds: string[];
};

export type EngineExecutablePlanState = {
  version: 1;
  actions: EngineExecutablePlanAction[];
  nextActionIds: string[];
  blockedActionIds: string[];
  completionRate: number;
  proofState: EngineExecutableProofState;
  rationale: string[];
};

export type EngineDecisionState =
  | "hold_in_discovery"
  | "accept_for_architecture"
  | "route_to_runtime_follow_up"
  | "needs_human_review";

export type EngineDecision = {
  decisionState: EngineDecisionState;
  adoptionTargetLaneId: EngineLaneId;
  adoptionTargetLaneLabel: string | null;
  requiresHumanApproval: boolean;
  summary: string;
  rationale: string[];
};

export type EngineIntegrationProposal = {
  targetLaneId: EngineLaneId;
  targetLaneLabel: string | null;
  integrationMode: EngineIntegrationMode;
  hostDependence: EngineHostDependence;
  valuableWithoutHostRuntime: boolean;
  handoffArtifactFamily: string;
  nextAction: string;
  requiresHumanReview: boolean;
};

export type EngineReportPlan = {
  reportKind: string;
  summary: string;
  usefulnessRationale: string;
  requiredDestinations: string[];
  syncRequired: boolean;
};

export type EngineEvent = {
  type: EngineEventType;
  at: string;
  summary: string;
};

export type EngineRunRecord = {
  $schema: typeof ENGINE_RUN_RECORD_SCHEMA_REF;
  schemaVersion: EngineRunRecordSchemaVersion;
  recordKind: typeof ENGINE_RUN_RECORD_KIND;
  runId: string;
  receivedAt: string;
  source: EngineSourceItem;
  mission: EngineMissionContext;
  openGaps: EngineCapabilityGap[];
  selectedLane: EngineSelectedLane;
  candidate: EngineCandidate;
  analysis: EngineAnalysis;
  routingAssessment: EngineRoutingAssessment;
  extractionPlan: EngineExtractionPlan;
  structuredExtractionPlan?: EngineStructuredExtractionPlan;
  adaptationPlan: EngineAdaptationPlan;
  structuredAdaptationPlan?: EngineStructuredAdaptationPlan;
  improvementPlan: EngineImprovementPlan;
  structuredImprovementPlan?: EngineStructuredImprovementPlan;
  proofPlan: EngineProofPlan;
  structuredProofPlan?: EngineStructuredProofPlan;
  executablePlanState?: EngineExecutablePlanState;
  planQualitySignal?: import("./planning/plan-quality.ts").EnginePlanQualitySignal | null;
  narrativeActions?: import("./routing/source-narrative-threading.ts").NarrativeAction[] | null;
  priorPlanContext: import("./planning/plan-consumption.ts").PriorPlanContext;
  decision: EngineDecision;
  integrationProposal: EngineIntegrationProposal;
  reportPlan: EngineReportPlan;
  events: EngineEvent[];
};

export type EngineHostAdapterResult = {
  accepted: boolean;
  note?: string | null;
};

export type EngineHostAdapter = {
  id: string;
  onRunRecorded?(
    record: EngineRunRecord,
  ):
    | EngineHostAdapterResult
    | void
    | Promise<EngineHostAdapterResult | void>;
};

export type EngineProcessSourceInput = {
  source: EngineSourceItem;
  mission: EngineMissionInput;
  gaps?: EngineCapabilityGap[] | null;
  receivedAt?: string | null;
  /** Past operator routing corrections to bias future lane scoring. */
  corrections?: import("./routing/correction-ledger.ts").RoutingCorrectionEntry[] | null;
  /** Past review-resolution policy events used for gap radar and earned autonomy. */
  policyEvents?: import("./decision-policy-ledger.ts").DecisionPolicyEvent[] | null;
};

export type EngineMinimalSourceInput = {
  title: string;
  url?: string | null;
  summary?: string | null;
  mission?: EngineMissionInput | null;
  gaps?: EngineCapabilityGap[] | null;
  receivedAt?: string | null;
  corrections?: import("./routing/correction-ledger.ts").RoutingCorrectionEntry[] | null;
  policyEvents?: import("./decision-policy-ledger.ts").DecisionPolicyEvent[] | null;
};

export type EngineProcessSourceResult = {
  ok: true;
  record: EngineRunRecord;
  adapterResults: Array<{
    adapterId: string;
    accepted: boolean;
    note: string | null;
  }>;
  deduplicated?: boolean;
  duplicateOfRunId?: string | null;
  duplicateReason?: string | null;
};

export type EngineMissionPreviewChange = {
  objective?: string | null;
  usefulnessSignals?: string[] | null;
  capabilityLanes?: string[] | null;
  constraints?: string[] | null;
  successSignal?: string | null;
  adoptionTarget?: string | null;
};

export type EngineRoutingDigestPreview = {
  before: RoutingDigest;
  after: RoutingDigest;
  diff: string[];
  assessment: EngineRoutingAssessment;
};

export type EngineRunReplayDriftKind =
  | "answers_override"
  | "mission_change"
  | "received_at_override"
  | "workspace_newer_runs";

export type EngineRunReplayDrift = {
  kind: EngineRunReplayDriftKind;
  detail: string;
};

export type EngineRunReplayInput = {
  answers?: Record<string, unknown> | null;
  missionChange?: EngineMissionPreviewChange | null;
  receivedAt?: string | null;
  corrections?: EngineProcessSourceInput["corrections"];
  policyEvents?: EngineProcessSourceInput["policyEvents"];
};

export type EngineRunReplayResult = {
  runId: string;
  replayedAt: string;
  nonPersistent: true;
  determinism: {
    mode: "exact" | "approximate";
    driftedInputs: EngineRunReplayDrift[];
    rationale: string[];
  };
  overrides: {
    answerFields: string[];
    missionFieldsChanged: string[];
    receivedAtOverridden: boolean;
  };
  baseline: {
    receivedAt: string;
    recommendedLaneId: EngineLaneId;
    confidence: EngineRoutingConfidence;
    needsHumanReview: boolean;
    decisionState: EngineDecisionState;
    routingHeadline: string;
    decisionSummary: string;
  };
  replay: {
    receivedAt: string;
    recommendedLaneId: EngineLaneId;
    confidence: EngineRoutingConfidence;
    needsHumanReview: boolean;
    decisionState: EngineDecisionState;
    routingHeadline: string;
    decisionSummary: string;
  };
  diff: string[];
};
