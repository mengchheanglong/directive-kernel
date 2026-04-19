import type { FrontendGapPressureDetail } from "./shared.ts";

export type FrontendExecutablePlanAction = {
  actionId: string;
  plan: "extraction" | "adaptation" | "improvement" | "proof";
  itemType: string;
  itemIndex: number | null;
  title: string;
  detail: string;
  owner: "engine" | "operator" | "host";
  status: "pending" | "in_progress" | "completed" | "skipped";
  completedAt: string | null;
  blockedByActionIds: string[];
  completionCriteria: string[];
  evidenceStatus: "not_needed" | "pending" | "gathering" | "gathered";
  gateStatus: "not_needed" | "pending" | "reviewing" | "passed";
};

export type FrontendExecutableProofState = {
  objectiveState: "pending" | "defined";
  evidenceState: "not_needed" | "evidence_pending" | "evidence_gathering" | "evidence_gathered";
  gateState: "not_needed" | "gate_pending" | "gate_review" | "gate_passed";
  finalState: "proof_pending" | "proof_ready" | "proved";
  outstandingEvidenceActionIds: string[];
  outstandingGateActionIds: string[];
};

export type FrontendExecutablePlanState = {
  version: 1;
  actions: FrontendExecutablePlanAction[];
  nextActionIds: string[];
  blockedActionIds: string[];
  completionRate: number;
  proofState: FrontendExecutableProofState;
  rationale: string[];
};

export type FrontendExecutablePlanSummary = {
  runId: string;
  proofState: FrontendExecutablePlanState["proofState"]["finalState"];
  completionRate: number;
  pendingActionCount: number;
  blockedActionCount: number;
  nextActions: string[];
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
    laneProportions?: Record<string, number>;
    secondaryLanes?: Array<{
      laneId: string;
      proportion: number;
      reason: string;
    }>;
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
  executablePlanState?: FrontendExecutablePlanState | null;
  integrationProposal: {
    integrationMode: string;
  };
  priorPlanContext?: {
    routeClass: string;
    summary: string;
    matchingRunCount: number;
    successfulFollowThroughCount: number;
    stalledRunCount: number;
    recurringImprovementGoals: string[];
    recurringProofKinds: Array<{
      proofKind: string;
      count: number;
      status: "successful" | "stalled" | "mixed";
    }>;
    adaptationPatterns: Array<{
      directiveOwnedForm: string;
      count: number;
      successfulCount: number;
      stalledCount: number;
    }>;
    relatedRunIds: string[];
  } | null;
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
