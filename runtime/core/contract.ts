export const DIRECTIVE_SUPPORTED_SOURCE_TYPES = [
  "github-repo",
  "paper",
  "product-doc",
  "theory",
  "technical-essay",
  "workflow-writeup",
  "external-system",
  "internal-signal",
] as const;

export const DIRECTIVE_SOURCE_FLOW = [
  "source",
  "analyze",
  "route",
  "extract",
  "adapt",
  "improve",
  "prove",
  "integrate",
] as const;

export const DIRECTIVE_USEFULNESS_LEVELS = [
  "direct",
  "structural",
  "meta",
] as const;

export const DIRECTIVE_WORKSPACE_V0 = {
  supportedSourceTypes: DIRECTIVE_SUPPORTED_SOURCE_TYPES,
  sourceFlow: DIRECTIVE_SOURCE_FLOW,
  usefulnessLevels: DIRECTIVE_USEFULNESS_LEVELS,
  workflowFamily: "source-adaptation-engine",
  workflowSentence:
    "Analyze a source against the active mission, route it to the right track, adapt the useful mechanism into Directive-owned form, prove it safely, and integrate the result with rollback clarity.",
  primaryMetricKey: "decision_lead_time_hours",
  primaryMetricTargetHours: 72,
} as const;

export type CapabilitySourceType =
  (typeof DIRECTIVE_SUPPORTED_SOURCE_TYPES)[number];

export type CapabilityStatus =
  | "intake"
  | "analyzed"
  | "experimenting"
  | "evaluated"
  | "decided"
  | "integrated";

export type FrameworkStatus =
  | "intake"
  | "analyzed"
  | "experimenting"
  | "evaluated"
  | "decided";

export type RuntimeStatus =
  | "none"
  | "planned"
  | "implementing"
  | "callable"
  | "parked"
  | "removed";

export type CapabilityRecommendation =
  | "ignore"
  | "monitor"
  | "test";

export type ExperimentStatus =
  | "proposed"
  | "running"
  | "completed"
  | "aborted";

export type EvaluationOutcome =
  | "positive"
  | "negative"
  | "mixed"
  | "inconclusive";

export type Decision = "adopt" | "reject" | "defer" | "monitor";

export type IntegrationStatus =
  | "planned"
  | "active"
  | "parked"
  | "removed";

export interface IntegrationProof {
  execution: {
    ok: true;
    method: string;
    reference: string;
    timestamp: string;
  };
  artifact: {
    reportId: string | null;
    reportHref: string | null;
    artifactPath: string | null;
    summary: string | null;
  };
}

export type IntegrationMode = "reimplement" | "adapt" | "wrap";

function normalizeString(value: unknown) {
  return String(value || "").trim();
}

function hasNonEmptyString(value: unknown) {
  return normalizeString(value).length > 0;
}

export function parseDirectiveIntegrationProof(
  value: unknown,
): IntegrationProof | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  if (!raw.execution || typeof raw.execution !== "object") return null;
  if (!raw.artifact || typeof raw.artifact !== "object") return null;

  const execution = raw.execution as Record<string, unknown>;
  const artifact = raw.artifact as Record<string, unknown>;

  if (execution.ok !== true) return null;
  if (!hasNonEmptyString(execution.method)) return null;
  if (!hasNonEmptyString(execution.reference)) return null;
  if (!hasNonEmptyString(execution.timestamp)) return null;

  const parsedTimestamp = new Date(normalizeString(execution.timestamp));
  if (Number.isNaN(parsedTimestamp.getTime())) return null;

  const reportId = normalizeString(artifact.reportId) || null;
  const reportHref = normalizeString(artifact.reportHref) || null;
  const artifactPath = normalizeString(artifact.artifactPath) || null;
  const summary = normalizeString(artifact.summary) || null;

  if (!reportId && !reportHref && !artifactPath) return null;

  return {
    execution: {
      ok: true,
      method: normalizeString(execution.method),
      reference: normalizeString(execution.reference),
      timestamp: parsedTimestamp.toISOString(),
    },
    artifact: {
      reportId,
      reportHref,
      artifactPath,
      summary,
    },
  };
}

function createNormalizer<T extends string>(
  typeName: string,
  validValues: readonly T[],
  errorDetail?: string,
): (value: unknown) => T {
  return (value: unknown): T => {
    const normalized = normalizeString(value).toLowerCase();
    const match = validValues.find((v) => v === normalized);
    if (match !== undefined) return match;
    const detail = errorDetail ? `; ${errorDetail}` : "";
    throw new Error(
      `invalid_input: unsupported ${typeName}=${String(value || "")}${detail}`,
    );
  };
}

export const normalizeDirectiveSourceType = createNormalizer<CapabilitySourceType>(
  "sourceType",
  DIRECTIVE_SUPPORTED_SOURCE_TYPES,
  `supported source types: ${DIRECTIVE_SUPPORTED_SOURCE_TYPES.join(", ")}`,
);

export const normalizeDirectiveRecommendation = createNormalizer<CapabilityRecommendation>(
  "recommendation", ["ignore", "monitor", "test"],
);

export const normalizeDirectiveEvaluationOutcome = createNormalizer<EvaluationOutcome>(
  "evaluation outcome", ["positive", "negative", "mixed", "inconclusive"],
);

export const normalizeDirectiveDecision = createNormalizer<Decision>(
  "decision", ["adopt", "reject", "defer", "monitor"],
);

export const normalizeDirectiveCapabilityStatus = createNormalizer<CapabilityStatus>(
  "capability status", ["intake", "analyzed", "experimenting", "evaluated", "decided", "integrated"],
);

export const normalizeDirectiveExperimentStatus = createNormalizer<ExperimentStatus>(
  "experiment status", ["proposed", "running", "completed", "aborted"],
);

export const normalizeDirectiveIntegrationStatus = createNormalizer<IntegrationStatus>(
  "integration status", ["planned", "active", "parked", "removed"],
);

export const normalizeDirectiveFrameworkStatus = createNormalizer<FrameworkStatus>(
  "framework status", ["intake", "analyzed", "experimenting", "evaluated", "decided"],
);

export const normalizeDirectiveRuntimeStatus = createNormalizer<RuntimeStatus>(
  "runtime status", ["none", "planned", "implementing", "callable", "parked", "removed"],
);

export const normalizeDirectiveIntegrationMode = createNormalizer<IntegrationMode>(
  "integrationMode", ["reimplement", "adapt", "wrap"],
);

export function normalizeDirectiveNotes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

export function inferDirectiveCapabilityTitle(sourceRef: string) {
  const trimmed = normalizeString(sourceRef).replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }

  const slashParts = trimmed.split(/[\\/]/).filter(Boolean);
  const tail = slashParts[slashParts.length - 1] || trimmed;
  return tail.replace(/\.git$/i, "") || trimmed;
}
