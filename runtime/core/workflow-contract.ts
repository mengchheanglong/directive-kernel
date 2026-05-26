import {
  DIRECTIVE_SOURCE_FLOW,
  DIRECTIVE_USEFULNESS_LEVELS,
  DIRECTIVE_WORKSPACE_V0,
  inferDirectiveCapabilityTitle,
  normalizeDirectiveEvaluationOutcome,
  normalizeDirectiveExperimentStatus,
  normalizeDirectiveNotes,
  normalizeDirectiveRecommendation,
  normalizeDirectiveSourceType,
  type CapabilitySourceType,
  type CapabilityRecommendation,
  type ExperimentStatus,
  type EvaluationOutcome,
} from "./contract.js";

export type CandidateContractInput = {
  sourceType?: unknown;
  sourceRef: unknown;
  title?: unknown;
  userIntent?: unknown;
  notes?: unknown;
  metadata?: Record<string, unknown>;
};

export type CandidateContract = {
  sourceType: CapabilitySourceType;
  sourceRef: string;
  title: string;
  userIntent: string | null;
  notes: string[];
  metadata: Record<string, unknown>;
};

export type AnalysisContractInput = {
  analysisSummary: unknown;
  category?: unknown;
  problemFit?: unknown;
  overlapNotes?: unknown;
  riskNotes?: unknown;
  recommendation: unknown;
  metadata?: Record<string, unknown>;
};

export type AnalysisContract = {
  analysisSummary: string;
  category: string | null;
  problemFit: string | null;
  overlapNotes: string | null;
  riskNotes: string | null;
  recommendation: CapabilityRecommendation;
  metadata: Record<string, unknown>;
};

export type ExperimentContractInput = {
  hypothesis: unknown;
  plan: unknown;
  successCriteria?: unknown;
  runId?: unknown;
  artifactPath?: unknown;
  status?: unknown;
  metadata?: Record<string, unknown>;
};

export type ExperimentContract = {
  hypothesis: string;
  plan: string;
  successCriteria: string[];
  runId: string | null;
  artifactPath: string | null;
  status: ExperimentStatus;
  metadata: Record<string, unknown>;
};

export type EvaluationContractInput = {
  outcome: unknown;
  usefulness?: unknown;
  friction?: unknown;
  workflowImpact?: unknown;
  evidenceSummary: unknown;
  metadata?: Record<string, unknown>;
};

export type EvaluationContract = {
  outcome: EvaluationOutcome;
  usefulness: string | null;
  friction: string | null;
  workflowImpact: string | null;
  evidenceSummary: string;
  metadata: Record<string, unknown>;
};

export function normalizeDirectiveCandidateContract(
  input: CandidateContractInput,
): CandidateContract {
  const sourceType = normalizeDirectiveSourceType(
    input.sourceType || "internal-signal",
  );
  const sourceRef = String(input.sourceRef || "").trim();
  if (!sourceRef) {
    throw new Error("invalid_input: sourceRef is required");
  }

  const title =
    String(input.title || "").trim() || inferDirectiveCapabilityTitle(sourceRef);
  if (!title) {
    throw new Error("invalid_input: title is required");
  }

  return {
    sourceType,
    sourceRef,
    title,
    userIntent: String(input.userIntent || "").trim() || null,
    notes: normalizeDirectiveNotes(input.notes),
    metadata: {
      ...(input.metadata || {}),
      workflowSentence: DIRECTIVE_WORKSPACE_V0.workflowSentence,
      sourceFlow: [...DIRECTIVE_SOURCE_FLOW],
      usefulnessLevels: [...DIRECTIVE_USEFULNESS_LEVELS],
      primaryMetric: {
        key: DIRECTIVE_WORKSPACE_V0.primaryMetricKey,
        targetHours: DIRECTIVE_WORKSPACE_V0.primaryMetricTargetHours,
      },
    },
  };
}

export function normalizeDirectiveAnalysisContract(
  input: AnalysisContractInput,
): AnalysisContract {
  const analysisSummary = String(input.analysisSummary || "").trim();
  if (!analysisSummary) {
    throw new Error("invalid_input: analysisSummary is required");
  }

  return {
    analysisSummary,
    category: String(input.category || "").trim() || null,
    problemFit: String(input.problemFit || "").trim() || null,
    overlapNotes: String(input.overlapNotes || "").trim() || null,
    riskNotes: String(input.riskNotes || "").trim() || null,
    recommendation: normalizeDirectiveRecommendation(input.recommendation),
    metadata: input.metadata || {},
  };
}

export function normalizeDirectiveExperimentContract(
  input: ExperimentContractInput,
): ExperimentContract {
  const hypothesis = String(input.hypothesis || "").trim();
  const plan = String(input.plan || "").trim();
  if (!hypothesis) {
    throw new Error("invalid_input: hypothesis is required");
  }
  if (!plan) {
    throw new Error("invalid_input: plan is required");
  }

  return {
    hypothesis,
    plan,
    successCriteria: normalizeDirectiveNotes(input.successCriteria),
    runId: String(input.runId || "").trim() || null,
    artifactPath: String(input.artifactPath || "").trim() || null,
    status: normalizeDirectiveExperimentStatus(input.status || "proposed"),
    metadata: input.metadata || {},
  };
}

export function normalizeDirectiveEvaluationContract(
  input: EvaluationContractInput,
): EvaluationContract {
  const evidenceSummary = String(input.evidenceSummary || "").trim();
  if (!evidenceSummary) {
    throw new Error("invalid_input: evidenceSummary is required");
  }

  return {
    outcome: normalizeDirectiveEvaluationOutcome(input.outcome),
    usefulness: String(input.usefulness || "").trim() || null,
    friction: String(input.friction || "").trim() || null,
    workflowImpact: String(input.workflowImpact || "").trim() || null,
    evidenceSummary,
    metadata: input.metadata || {},
  };
}
