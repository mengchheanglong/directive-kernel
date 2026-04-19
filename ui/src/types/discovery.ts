import type { FrontendCurrentHead, FrontendGapPressureDetail } from "./shared.ts";

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
  digest?: {
    headline: string;
    explanation: string;
    primaryConcern: {
      kind: "conflict" | "low_confidence" | "mission_weakness" | "stalled_thread" | "narrative_action" | "gap_pressure";
      summary: string;
      suggestedAction: string;
    } | null;
    secondaryConcerns: Array<{
      kind: "conflict" | "low_confidence" | "mission_weakness" | "stalled_thread" | "narrative_action" | "gap_pressure";
      summary: string;
    }>;
    threadContext: string | null;
    trustLevel: string;
  } | null;
  missionSpecificityWarning?: string | null;
  missionHealth?: {
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
  goalCopilot?: {
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
  } | null;
  confidenceRecovery?: {
    summary: string;
    confidenceLift: string;
    requestedInputs: Array<{
      field: string;
      question: string;
      whyItMatters: string;
      exampleAnswer: string | null;
    }>;
  } | null;
  followUpQuestions?: {
    summary: string;
    questions: Array<{
      field: string;
      question: string;
      whyItMatters: string;
      exampleAnswer: string | null;
      predictedEffect: string;
    }>;
  } | null;
  gapRadar?: {
    summary: string;
    suggestions: Array<{
      radarId: string;
      targetLaneId: string;
      confidence: string;
      evidenceCount: number;
      summary: string;
      recommendedChange: string;
      signalTokens: string[];
      relatedOpenGapId: string | null;
      suggestedPriority: string;
    }>;
  } | null;
  earnedAutonomy?: {
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
  } | null;
  sourceMemory?: {
    summary: string;
    biasAdjustments: Record<string, number>;
    matchingTopics: Array<{
      token: string;
      recentCount: number;
      totalCount: number;
      dominantLaneId: string;
    }>;
    matchingRouteClass: {
      routeClass: string;
      laneId: string;
      sourceType: string;
      recentCount: number;
      totalCount: number;
      lastSeenAt: string;
    } | null;
    rationale: string[];
  } | null;
  sourceSimilarity?: {
    summary: string;
    relatedSources: Array<{
      runId: string;
      candidateId: string;
      candidateName: string;
      laneId: string;
      decisionState: string;
      receivedAt: string;
      similarityScore: number;
      sharedTokens: string[];
      summary: string;
    }>;
  } | null;
  narrativeContext?: {
    summary: string;
    primaryThread: {
      threadId: string;
      name: string;
      state: "nascent" | "developing" | "mature" | "stalled" | "completed";
      summary: string;
      sourceCount: number;
      firstSeenAt: string;
      lastSeenAt: string;
      activeSpanDays: number;
      currentSourceOverlap: number;
      topTokens: string[];
      laneTendency: {
        dominantLaneId: string;
        dominancePercent: number;
        laneCounts: Record<string, number>;
        biasAdjustment: number;
      };
      gapCoverage: {
        dominantGapId: string | null;
        matchedGapIds: string[];
        status: "none" | "emerging" | "partially_addressed" | "closed";
      };
      followThrough: {
        completedProofCount: number;
        stalledProofCount: number;
        followThroughRate: number;
      };
      demandSignals: Array<{
        kind: string;
        priority: string;
        summary: string;
        requestedLaneId: string | null;
      }>;
      relatedRunIds: string[];
    } | null;
    relatedThreads: Array<{
      threadId: string;
      name: string;
      state: "nascent" | "developing" | "mature" | "stalled" | "completed";
      summary: string;
      sourceCount: number;
      firstSeenAt: string;
      lastSeenAt: string;
      activeSpanDays: number;
      currentSourceOverlap: number;
      topTokens: string[];
      laneTendency: {
        dominantLaneId: string;
        dominancePercent: number;
        laneCounts: Record<string, number>;
        biasAdjustment: number;
      };
      gapCoverage: {
        dominantGapId: string | null;
        matchedGapIds: string[];
        status: "none" | "emerging" | "partially_addressed" | "closed";
      };
      followThrough: {
        completedProofCount: number;
        stalledProofCount: number;
        followThroughRate: number;
      };
      demandSignals: Array<{
        kind: string;
        priority: string;
        summary: string;
        requestedLaneId: string | null;
      }>;
      relatedRunIds: string[];
    }>;
    biasAdjustments: Record<string, number>;
    demandSignals: Array<{
      kind: string;
      priority: string;
      summary: string;
      requestedLaneId: string | null;
    }>;
    rationale: string[];
  } | null;
  laneProportions?: Record<string, number> | null;
  secondaryLanes?: Array<{
    laneId: string;
    proportion: number;
    reason: string;
  }> | null;
  downstreamStubRelativePath?: string | null;
  approvalAllowed?: boolean;
  content?: string;
};
