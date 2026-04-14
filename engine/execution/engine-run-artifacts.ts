import fs from "node:fs";
import path from "node:path";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import { getDefaultDirectiveWorkspaceRoot } from "../../shared/lib/workspace-root.ts";

export type StoredDirectiveEngineRunRecord = {
  $schema?: string;
  schemaVersion?: number;
  recordKind?: string;
  runId: string;
  receivedAt: string;
  source: {
    sourceType: string;
    sourceRef: string;
    title: string;
  };
  selectedLane: {
    laneId: string;
    label: string;
    hostDependence: string;
    valuableWithoutHostRuntime: boolean;
  };
  candidate: {
    candidateId: string;
    candidateName: string;
    recommendedLaneId: string;
    usefulnessLevel: string;
    confidence: string;
    matchedGapId?: string | null;
    requiresHumanReview: boolean;
    rationale: string[];
  };
  openGaps?: Array<{
    gapId: string;
    description: string;
    priority: string;
    relatedMissionObjective?: string;
    currentState?: string;
    desiredState?: string;
  }>;
  routingAssessment?: {
    confidence?: string;
    matchedGapId?: string | null;
    matchedGapRank?: number | null;
    routeConflict?: boolean;
    needsHumanReview?: boolean;
    digest?: {
      headline: string;
      explanation: string;
      primaryConcern: {
        kind: "conflict" | "low_confidence" | "mission_weakness" | "stalled_thread" | "gap_pressure";
        summary: string;
        suggestedAction: string;
      } | null;
      secondaryConcerns: Array<{
        kind: "conflict" | "low_confidence" | "mission_weakness" | "stalled_thread" | "gap_pressure";
        summary: string;
      }>;
      threadContext: string | null;
      trustLevel: string;
    };
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
    scoreBreakdown?: {
      gapAlignment?: number;
    };
  };
  analysis: {
    missionFitSummary: string;
    primaryAdoptionQuestion: string;
    usefulnessRationale: string;
    rationale: string[];
  };
  decision: {
    decisionState: string;
    summary: string;
    requiresHumanApproval: boolean;
    rationale: string[];
  };
  integrationProposal: {
    targetLaneId: string;
    integrationMode: string;
    hostDependence: string;
    valuableWithoutHostRuntime: boolean;
    nextAction: string;
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
  proofPlan: {
    proofKind: string;
    objective: string;
  };
  reportPlan: {
    reportKind: string;
    summary: string;
    usefulnessRationale: string;
  };
  events: Array<{
    type: string;
    at: string;
    summary: string;
  }>;
};

export type DirectiveEngineGapPressureDetail = {
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

export type DirectiveEngineGapPressureRecordLike = {
  candidate: {
    matchedGapId?: string | null;
  };
  openGaps?: Array<{
    gapId: string;
    description: string;
    priority: string;
    relatedMissionObjective?: string;
    currentState?: string;
    desiredState?: string;
  }>;
  routingAssessment?: {
    matchedGapId?: string | null;
    matchedGapRank?: number | null;
    scoreBreakdown?: {
      gapAlignment?: number;
    };
  };
};

export type DirectiveEngineRunArtifact = {
  recordPath: string;
  reportPath: string | null;
  reportExcerpt: string | null;
  reportContent?: string | null;
  gapPressure: DirectiveEngineGapPressureDetail;
  record: StoredDirectiveEngineRunRecord;
};

export type DirectiveEngineRunDetail = {
  ok: boolean;
  error?: string;
  rootPath: string;
  engineRunsRoot: string;
  snapshotAt: string;
  recordPath: string | null;
  reportPath: string | null;
  reportExcerpt: string | null;
  reportContent: string | null;
  gapPressure: DirectiveEngineGapPressureDetail | null;
  record: StoredDirectiveEngineRunRecord | null;
};

export type DirectiveEngineRunsOverview = {
  ok: boolean;
  error?: string;
  rootPath: string;
  engineRunsRoot: string;
  snapshotAt: string;
  totalRuns: number;
  invalidArtifacts: number;
  counts: {
    discovery: number;
    runtime: number;
    architecture: number;
    direct: number;
    structural: number;
    meta: number;
    hybrid: number;
    humanReview: number;
    holdInDiscovery: number;
    routeToRuntime: number;
    acceptForArchitecture: number;
  };
  latest: {
    recordPath: string | null;
    reportPath: string | null;
  };
  recentRuns: DirectiveEngineRunArtifact[];
};

type ReadDirectiveEngineRunsOverviewOptions = {
  directiveRoot?: string;
  maxRuns?: number;
};

type ReadDirectiveEngineRunDetailOptions = {
  directiveRoot?: string;
  runId: string;
};

function isRecordLike(value: unknown): value is StoredDirectiveEngineRunRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const candidate = record.candidate as Record<string, unknown> | undefined;
  const analysis = record.analysis as Record<string, unknown> | undefined;
  const decision = record.decision as Record<string, unknown> | undefined;
  const reportPlan = record.reportPlan as Record<string, unknown> | undefined;

  return (
    typeof record.runId === "string"
    && typeof record.receivedAt === "string"
    && typeof candidate?.candidateId === "string"
    && typeof candidate?.candidateName === "string"
    && typeof candidate?.recommendedLaneId === "string"
    && typeof candidate?.usefulnessLevel === "string"
    && typeof analysis?.usefulnessRationale === "string"
    && typeof decision?.decisionState === "string"
    && typeof reportPlan?.summary === "string"
    && typeof reportPlan?.usefulnessRationale === "string"
  );
}

function readJson(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export function describeDirectiveEngineGapPressure(
  record: DirectiveEngineGapPressureRecordLike,
): DirectiveEngineGapPressureDetail {
  const matchedGapId =
    record.routingAssessment?.matchedGapId
    ?? record.candidate.matchedGapId
    ?? null;
  const matchedGap = (record.openGaps ?? []).find((gap) => gap.gapId === matchedGapId) ?? null;

  return {
    openGapCount: Array.isArray(record.openGaps) ? record.openGaps.length : 0,
    gapAlignmentScore: record.routingAssessment?.scoreBreakdown?.gapAlignment ?? null,
    matchedGapId,
    matchedGapRank: record.routingAssessment?.matchedGapRank ?? null,
    matchedGapPriority: matchedGap?.priority ?? null,
    matchedGapDescription: matchedGap?.description ?? null,
    relatedMissionObjective: matchedGap?.relatedMissionObjective ?? null,
    currentState: matchedGap?.currentState ?? null,
    desiredState: matchedGap?.desiredState ?? null,
  };
}

function summarizeReportMarkdown(content: string | null, fallback: string) {
  if (!content) {
    return fallback;
  }

  const candidate = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (line.startsWith("#")) return false;
      if (/^- (Run ID|Received At|Candidate ID|Candidate Name|Source Type|Source Ref|Schema version|Schema ref|Selected Lane|Usefulness Level|Decision State|Integration Mode|Proof Kind|Run Record Path):/.test(line)) {
        return false;
      }
      return true;
    })[0];

  const normalized = String(candidate || fallback).replace(/\s+/g, " ").trim();
  if (normalized.length <= 220) {
    return normalized;
  }
  return `${normalized.slice(0, 219).trim()}...`;
}

function readRunArtifact(
  recordPath: string,
  options: { includeReportContent?: boolean } = {},
): DirectiveEngineRunArtifact | null {
  const parsed = readJson(recordPath);
  if (!isRecordLike(parsed)) {
    return null;
  }

  const reportPath = recordPath.replace(/\.json$/i, ".md");
  const reportExists = fs.existsSync(reportPath);
  const reportContent = reportExists ? fs.readFileSync(reportPath, "utf8") : null;

  return {
    recordPath: normalizeAbsolutePath(recordPath),
    reportPath: reportExists ? normalizeAbsolutePath(reportPath) : null,
    reportExcerpt: summarizeReportMarkdown(reportContent, parsed.reportPlan.summary),
    reportContent: options.includeReportContent ? reportContent : undefined,
    gapPressure: describeDirectiveEngineGapPressure(parsed),
    record: parsed,
  };
}

function listEngineRunRecordPaths(engineRunsRoot: string) {
  if (!fs.existsSync(engineRunsRoot)) {
    return [];
  }

  return fs
    .readdirSync(engineRunsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(engineRunsRoot, entry.name))
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)));
}

function zeroCounts() {
  return {
    discovery: 0,
    runtime: 0,
    architecture: 0,
    direct: 0,
    structural: 0,
    meta: 0,
    hybrid: 0,
    humanReview: 0,
    holdInDiscovery: 0,
    routeToRuntime: 0,
    acceptForArchitecture: 0,
  };
}

export function readDirectiveEngineRunsOverview(
  options: ReadDirectiveEngineRunsOverviewOptions = {},
): DirectiveEngineRunsOverview {
  const directiveRoot = normalizeAbsolutePath(options.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const engineRunsRoot = normalizeAbsolutePath(
    path.join(directiveRoot, "runtime", "standalone-host", "engine-runs"),
  );
  const maxRuns = Math.max(1, options.maxRuns ?? 6);
  const counts = zeroCounts();

  if (!fs.existsSync(engineRunsRoot)) {
    return {
      ok: false,
      rootPath: directiveRoot,
      engineRunsRoot,
      snapshotAt: new Date().toISOString(),
      totalRuns: 0,
      invalidArtifacts: 0,
      counts,
      latest: {
        recordPath: null,
        reportPath: null,
      },
      recentRuns: [],
    };
  }

  const recordPaths = listEngineRunRecordPaths(engineRunsRoot);
  const artifacts: DirectiveEngineRunArtifact[] = [];
  let invalidArtifacts = 0;

  for (const recordPath of recordPaths) {
    const artifact = readRunArtifact(recordPath);
    if (!artifact) {
      invalidArtifacts += 1;
      continue;
    }

    const laneId = artifact.record.selectedLane?.laneId || artifact.record.candidate.recommendedLaneId;
    if (laneId === "discovery") counts.discovery += 1;
    if (laneId === "runtime") counts.runtime += 1;
    if (laneId === "architecture") counts.architecture += 1;

    if (artifact.record.candidate.usefulnessLevel === "direct") counts.direct += 1;
    if (artifact.record.candidate.usefulnessLevel === "structural") counts.structural += 1;
    if (artifact.record.candidate.usefulnessLevel === "meta") counts.meta += 1;
    if (artifact.record.candidate.usefulnessLevel === "hybrid") counts.hybrid += 1;

    if (
      artifact.record.candidate.requiresHumanReview
      || artifact.record.decision.requiresHumanApproval
    ) {
      counts.humanReview += 1;
    }

    if (artifact.record.decision.decisionState === "hold_in_discovery") {
      counts.holdInDiscovery += 1;
    }
    if (artifact.record.decision.decisionState === "route_to_runtime_follow_up") {
      counts.routeToRuntime += 1;
    }
    if (artifact.record.decision.decisionState === "accept_for_architecture") {
      counts.acceptForArchitecture += 1;
    }

    artifacts.push(artifact);
  }

  const recentRuns = artifacts.slice(0, maxRuns);
  const latest = recentRuns[0] || null;

  return {
    ok: true,
    rootPath: directiveRoot,
    engineRunsRoot,
    snapshotAt: new Date().toISOString(),
    totalRuns: artifacts.length,
    invalidArtifacts,
    counts,
    latest: {
      recordPath: latest?.recordPath || null,
      reportPath: latest?.reportPath || null,
    },
    recentRuns,
  };
}

export function readDirectiveEngineRunDetail(
  options: ReadDirectiveEngineRunDetailOptions,
): DirectiveEngineRunDetail {
  const directiveRoot = normalizeAbsolutePath(options.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const engineRunsRoot = normalizeAbsolutePath(
    path.join(directiveRoot, "runtime", "standalone-host", "engine-runs"),
  );
  const runId = String(options.runId || "").trim();

  if (!runId) {
    return {
      ok: false,
      error: "missing_run_id",
      rootPath: directiveRoot,
      engineRunsRoot,
      snapshotAt: new Date().toISOString(),
      recordPath: null,
      reportPath: null,
      reportExcerpt: null,
      reportContent: null,
      gapPressure: null,
      record: null,
    };
  }

  for (const recordPath of listEngineRunRecordPaths(engineRunsRoot)) {
    const artifact = readRunArtifact(recordPath, { includeReportContent: true });
    if (!artifact) {
      continue;
    }
    if (artifact.record.runId !== runId) {
      continue;
    }

    return {
      ok: true,
      rootPath: directiveRoot,
      engineRunsRoot,
      snapshotAt: new Date().toISOString(),
      recordPath: artifact.recordPath,
      reportPath: artifact.reportPath,
      reportExcerpt: artifact.reportExcerpt,
      reportContent: artifact.reportContent ?? null,
      gapPressure: artifact.gapPressure,
      record: artifact.record,
    };
  }

  return {
    ok: false,
    error: "run_not_found",
    rootPath: directiveRoot,
    engineRunsRoot,
    snapshotAt: new Date().toISOString(),
    recordPath: null,
    reportPath: null,
    reportExcerpt: null,
    reportContent: null,
    gapPressure: null,
    record: null,
  };
}
