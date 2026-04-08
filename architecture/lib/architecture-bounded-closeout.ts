import fs from "node:fs";
import path from "node:path";

import {
  buildDirectiveArchitectureCloseoutFile,
  type DirectiveArchitectureCloseoutWriteRequest,
} from "./architecture-closeout.ts";
import {
  getDefaultDirectiveWorkspaceRoot,
  normalizePath,
  normalizeRelativePath,
  optionalString,
  requiredString,
  resolveDirectiveRelativePath,
  writeJsonPretty,
} from "./architecture-deep-tail-artifact-helpers.ts";
import {
  readDirectiveArchitectureHandoffArtifact,
  type DirectiveArchitectureHandoffArtifact,
} from "./architecture-handoff-start.ts";
import {
  upsertDirectiveArchitectureAdoptionDecisionArtifact,
} from "./architecture-adoption-decision-store.ts";
import {
  mirrorDirectiveNoteArchitectureCloseout,
  readDirectiveMirroredDiscoveryCaseRecord,
  writeDirectiveMirroredDiscoveryCaseRecord,
} from "../../engine/cases/case-store.ts";
import { appendDirectiveCaseMirrorEvents, readDirectiveCaseMirrorEvents } from "../../engine/cases/case-event-log.ts";
import {
  syncDiscoveryIntakeLifecycle,
} from "../../discovery/lib/discovery-intake-lifecycle-sync.ts";
import { readDirectiveDiscoveryRoutingArtifact } from "../../discovery/lib/discovery-route-opener.ts";
import { resolveDirectiveWorkspaceState } from "../../engine/state/index.ts";
import type {
  DiscoveryIntakeQueueDocument,
} from "../../discovery/lib/discovery-intake-queue-writer.ts";
import type {
  DirectiveArchitectureSelfImprovementArtifact,
} from "./architecture-adoption-artifacts.ts";
import type {
  ArchitectureSelfImprovementCategory,
  ArchitectureUsefulnessLevel,
  ArchitectureValueShape,
} from "./architecture-adoption-resolution.ts";
import {
  writeDirectiveNoteArchitectureCloseoutProjectionSet,
  type DirectiveMirroredNoteArchitectureCloseoutProjectionInput,
} from "./architecture-note-closeout-projections.ts";
import { readRuntimeOpenerJson as readJson } from "../../runtime/lib/runtime-opener-shared.ts";

export type DirectiveArchitectureBoundedStartArtifact = {
  title: string;
  candidateId: string;
  candidateName: string;
  experimentDate: string;
  startApproval: string;
  objective: string;
  boundedScope: string[];
  inputs: string[];
  validationGates: string[];
  blockedRecoveryPath: string;
  failureCriteria: string;
  rollback: string;
  resultSummary: string;
  expectedOutput: string[];
  handoffStubPath: string;
  engineRunRecordPath: string;
  engineRunReportPath: string;
  discoveryRoutingRecordPath: string;
  nextDecision: string;
  usefulnessLevel: ArchitectureUsefulnessLevel;
  runtimeThresholdCheck: string;
  sourceAnalysisRef: string;
  adaptationDecisionRef: string;
  adaptationQuality: "strong" | "adequate" | "weak" | "skipped";
  improvementQuality: "strong" | "adequate" | "weak" | "skipped";
  metaUseful: boolean;
  metaUsefulnessCategory: string;
  transformationArtifactGateResult: string;
  transformedArtifactsProduced: string[];
  directiveRoot: string;
  startRelativePath: string;
  startAbsolutePath: string;
  resultRelativePath: string;
  resultAbsolutePath: string;
  resultExists: boolean;
  decisionRelativePath: string;
  decisionAbsolutePath: string;
  decisionExists: boolean;
};

export type DirectiveArchitectureBoundedResultArtifact = {
  title: string;
  candidateId: string;
  candidateName: string;
  experimentDate: string;
  closeoutApproval: string;
  objective: string;
  boundedScope: string[];
  inputs: string[];
  validationGates: string[];
  resultSummary: string;
  nextDecision: string;
  handoffStubPath: string;
  startRelativePath: string | null;
  engineRunRecordPath: string;
  engineRunReportPath: string;
  discoveryRoutingRecordPath: string;
  decisionRelativePath: string;
  usefulnessLevel: ArchitectureUsefulnessLevel;
  runtimeThresholdCheck: string;
  rollback: string;
  verdict: string;
  rationale: string;
  primaryEvidencePath: string | null;
  transformedArtifactsProduced: string[];
  directiveRoot: string;
  resultRelativePath: string;
  resultAbsolutePath: string;
  decisionAbsolutePath: string;
  decisionExists: boolean;
  continuationStartRelativePath: string;
  continuationStartAbsolutePath: string;
  continuationStartExists: boolean;
};

export type ContinueDirectiveArchitectureBoundedResultInput = {
  resultPath: string;
  directiveRoot?: string;
  continuedBy?: string | null;
};

export type DirectiveArchitectureContinuationStartResult = {
  ok: true;
  created: boolean;
  snapshotAt: string;
  directiveRoot: string;
  resultRelativePath: string;
  resultAbsolutePath: string;
  continuationStartRelativePath: string;
  continuationStartAbsolutePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: ArchitectureUsefulnessLevel;
  objective: string;
  continuationState: "continued";
};

export type CloseDirectiveArchitectureBoundedStartInput = {
  startPath: string;
  directiveRoot?: string;
  closedBy?: string | null;
  resultSummary: string;
  primaryEvidencePath?: string | null;
  transformedArtifactsProduced?: string[] | null;
  nextDecision?: "needs-more-evidence" | "adopt" | "defer" | "reject";
  valueShape?: ArchitectureValueShape;
  adaptationQuality?: "strong" | "adequate" | "weak" | "skipped";
  improvementQuality?: "strong" | "adequate" | "weak" | "skipped";
  proofExecuted?: boolean;
  targetArtifactClarified?: boolean;
  deltaEvidencePresent?: boolean;
  noUnresolvedBaggage?: boolean;
  productArtifactMaterialized?: boolean;
};

export type CloseDirectiveArchitectureNoteHandoffInput = {
  handoffPath: string;
  directiveRoot?: string;
  closedBy?: string | null;
  snapshotAt?: string | null;
  resultSummary: string;
  primaryEvidencePath?: string | null;
  transformedArtifactsProduced?: string[] | null;
  nextDecision?: "needs-more-evidence" | "adopt" | "defer" | "reject";
  valueShape?: ArchitectureValueShape;
  adaptationQuality?: "strong" | "adequate" | "weak" | "skipped";
  improvementQuality?: "strong" | "adequate" | "weak" | "skipped";
  proofExecuted?: boolean;
  targetArtifactClarified?: boolean;
  deltaEvidencePresent?: boolean;
  noUnresolvedBaggage?: boolean;
  productArtifactMaterialized?: boolean;
};

export type DirectiveArchitectureBoundedCloseoutResult = {
  ok: true;
  created: boolean;
  snapshotAt: string;
  directiveRoot: string;
  handoffRelativePath: string;
  handoffAbsolutePath: string;
  startRelativePath: string | null;
  startAbsolutePath: string | null;
  resultRelativePath: string;
  resultAbsolutePath: string;
  decisionRelativePath: string;
  decisionAbsolutePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: ArchitectureUsefulnessLevel;
  objective: string;
  resultSummary: string;
  nextDecision: string;
  verdict: string;
  closeoutState: string;
};

export type DirectiveArchitectureBoundedCloseoutAssist = {
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

export type DirectiveArchitectureResultEvidenceSlot = {
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

const START_FIELD_LABELS = new Set([
  "Candidate id",
  "Candidate name",
  "Experiment date",
  "Owning track",
  "Experiment type",
  "Start approval",
  "Objective",
  "Bounded scope",
  "Inputs",
  "Expected output",
  "Validation gate(s)",
  "Transition policy profile",
  "Scoring policy profile",
  "Blocked recovery path",
  "Failure criteria",
  "Rollback",
  "Result summary",
  "Evidence path",
  "Primary evidence path",
  "Handoff stub",
  "Bounded start",
  "Engine run record",
  "Engine run report",
  "Discovery routing record",
  "Previous bounded result",
  "Continuation trigger",
  "Source evaluation ref",
  "Source consumption record",
  "Source integration record",
  "Source retained artifact",
  "Closeout approval",
  "Closeout decision artifact",
  "Next decision",
  "Origin",
  "Usefulness level",
  "Runtime threshold check",
  "Source analysis ref",
  "Adaptation decision ref",
  "Adaptation quality",
  "Improvement quality",
  "Meta-useful",
  "Meta-usefulness category",
  "Transformation artifact gate result",
  "Transformed artifacts produced",
  "Verdict",
  "Rationale",
]);

const VALUE_SHAPES: ArchitectureValueShape[] = [
  "interface_or_handoff",
  "data_shape",
  "working_document",
  "behavior_rule",
  "design_pattern",
  "executable_logic",
  "operating_model_change",
];

const QUALITY_LEVELS = new Set(["strong", "adequate", "weak", "skipped"]);
const SELF_IMPROVEMENT_CATEGORIES = new Set<ArchitectureSelfImprovementCategory>([
  "analysis_quality",
  "extraction_quality",
  "adaptation_quality",
  "improvement_quality",
  "routing_quality",
  "evaluation_quality",
  "handoff_quality",
]);

const STRUCTURAL_STAGE_PATTERNS: Array<[string, RegExp]> = [
  ["planning", /\bplanning\b/i],
  ["analysis", /\banalysis\b/i],
  ["mutation", /\bmutation\b/i],
  ["evaluation", /\bevaluation\b/i],
  ["selection", /\bselection\b/i],
  ["code generation", /\bcode generation\b/i],
  ["generation", /\bgeneration\b/i],
];

const EVALUATOR_PROOF_SIGNAL_PATTERNS = [
  /\breviewer\b/i,
  /\bcriteria\b/i,
  /\bsimpleqa\b/i,
  /\bhallucination\b/i,
  /\bbenchmark\b/i,
  /\bgrader\b/i,
  /\bgrading\b/i,
  /\bfactual(?:ity)?\b/i,
  /\bvalidation\b/i,
  /\bverify\b/i,
  /\bverification\b/i,
  /\bproof quality\b/i,
];

const EXPLICIT_PROOF_METHOD_PATTERNS = [
  /\bsimpleqa\b/i,
  /\bhallucination\b/i,
  /\bbenchmark\b/i,
  /\bcriteria\b/i,
  /\breviewer\b/i,
  /\bgrader\b/i,
  /\bgrading\b/i,
  /\bvalidation\b/i,
  /\bverify\b/i,
  /\bverified\b/i,
  /\bverification\b/i,
  /\bcheck\b/i,
  /\btest(?:s|ed|ing)?\b/i,
  /\binspection\b/i,
  /\bcomparison\b/i,
  /\bcommand\b/i,
];

type DirectiveArchitectureCloseoutAssistEngineRun = {
  analysis?: {
    missionFitSummary?: string;
    primaryAdoptionQuestion?: string;
  };
  extractionPlan?: {
    extractedValue?: string[];
    excludedBaggage?: string[];
  };
  adaptationPlan?: {
    directiveOwnedForm?: string;
    adaptedValue?: string[];
  };
  improvementPlan?: {
    improvementGoals?: string[];
    intendedDelta?: string;
  };
};

function optionalStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value
    .map((entry) => optionalString(typeof entry === "string" ? entry : null))
    .filter((entry): entry is string => Boolean(entry));
}

function stripBackticks(value: string) {
  return value.trim().replace(/^`|`$/g, "");
}

function parseLabeledBulletFields(markdown: string) {
  const result = new Map<string, string[]>();
  let currentLabel: string | null = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("- ")) {
      continue;
    }

    const labeledMatch = /^- ([^:]+):(.*)$/.exec(line);
    if (labeledMatch && START_FIELD_LABELS.has(labeledMatch[1].trim())) {
      currentLabel = labeledMatch[1].trim();
      const firstValue = stripBackticks(labeledMatch[2].trim());
      result.set(currentLabel, firstValue ? [firstValue] : []);
      continue;
    }

    if (!currentLabel) {
      continue;
    }

    const values = result.get(currentLabel) || [];
    values.push(stripBackticks(line.replace(/^- /, "").trim()));
    result.set(currentLabel, values);
  }

  return result;
}

function firstField(fields: Map<string, string[]>, label: string, fieldName: string) {
  const value = fields.get(label)?.[0];
  return requiredString(value, fieldName);
}

function optionalFirstField(fields: Map<string, string[]>, label: string) {
  const value = optionalString(fields.get(label)?.[0]);
  if (!value || /^n\/a$/i.test(value) || /^not resolved$/i.test(value)) {
    return null;
  }
  return value;
}

function listField(fields: Map<string, string[]>, label: string) {
  return (fields.get(label) || []).filter(Boolean);
}

function resolveResultRelativePath(startRelativePath: string) {
  if (!startRelativePath.endsWith("-bounded-start.md")) {
    throw new Error("invalid_input: startPath must point to an Architecture bounded-start artifact");
  }
  return startRelativePath.replace(/-bounded-start\.md$/u, "-bounded-result.md");
}

function resolveContinuationStartRelativePath(resultRelativePath: string) {
  if (!resultRelativePath.endsWith("-bounded-result.md")) {
    throw new Error("invalid_input: resultPath must point to an Architecture bounded-result artifact");
  }
  return resultRelativePath.replace(/-bounded-result\.md$/u, "-continuation-bounded-start.md");
}

function resolveCloseoutStateFromVerdict(verdict: string) {
  if (verdict === "adopt") {
    return "adopted";
  }
  if (verdict === "hand_off_to_runtime") {
    return "runtime_handoff";
  }
  return "stay_experimental";
}

function readDiscoveryQueueDocument(directiveRoot: string) {
  const queuePath = normalizePath(path.join(directiveRoot, "discovery", "intake-queue.json"));
  if (!fs.existsSync(queuePath)) {
    throw new Error(`invalid_input: discovery intake queue not found: ${queuePath}`);
  }
  return {
    queuePath,
    queue: readJson<DiscoveryIntakeQueueDocument>(queuePath),
  };
}

function parseQualityLevel(value: string | null, fallback: "strong" | "adequate" | "weak" | "skipped") {
  if (value && QUALITY_LEVELS.has(value)) {
    return value as "strong" | "adequate" | "weak" | "skipped";
  }
  return fallback;
}

function inferArchitectureSelfImprovementCategoryFromText(
  text: string,
): ArchitectureSelfImprovementCategory {
  const normalized = text.toLowerCase();
  if (normalized.includes("routing")) return "routing_quality";
  if (
    normalized.includes("evaluate")
    || normalized.includes("evaluation")
    || normalized.includes("review")
    || normalized.includes("proof")
  ) {
    return "evaluation_quality";
  }
  if (normalized.includes("handoff")) return "handoff_quality";
  if (normalized.includes("extract")) return "extraction_quality";
  if (normalized.includes("improve")) return "improvement_quality";
  if (normalized.includes("analysis")) return "analysis_quality";
  return "adaptation_quality";
}

function collectStructuralStages(text: string) {
  const stages: string[] = [];
  for (const [label, pattern] of STRUCTURAL_STAGE_PATTERNS) {
    if (pattern.test(text)) {
      stages.push(label);
    }
  }
  return stages;
}

function hasEvaluatorOrProofSignals(text: string) {
  return EVALUATOR_PROOF_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

function hasExplicitProofMethod(text: string) {
  return EXPLICIT_PROOF_METHOD_PATTERNS.some((pattern) => pattern.test(text));
}

function collectDirectiveWorkspaceFilePathMentions(text: string) {
  const matches = text.match(/[A-Za-z0-9._/-]+\.(?:ts|tsx|js|jsx|json|md)/g) || [];
  return Array.from(new Set(matches));
}

function resolveExistingDirectiveWorkspaceRelativePath(input: {
  directiveRoot: string;
  candidatePath: string;
}) {
  const normalized = input.candidatePath.replace(/\\/g, "/").replace(/^`|`$/g, "");
  if (!normalized || normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return null;
  }

  try {
    const relativePath = resolveDirectiveRelativePath(input.directiveRoot, normalized);
    const absolutePath = normalizePath(path.join(input.directiveRoot, relativePath));
    if (!fs.existsSync(absolutePath)) {
      return null;
    }
    return relativePath;
  } catch {
    return null;
  }
}

function resolveDirectiveArchitecturePrimaryDirectEvidencePath(input: {
  directiveRoot: string;
  resultSummary: string;
  rationale: string;
}) {
  const candidates = collectDirectiveWorkspaceFilePathMentions(
    `${input.resultSummary} ${input.rationale}`,
  )
    .map((candidatePath) =>
      resolveExistingDirectiveWorkspaceRelativePath({
        directiveRoot: input.directiveRoot,
        candidatePath,
      }))
    .filter((candidatePath): candidatePath is string => Boolean(candidatePath));

  const codePath = candidates.find((candidatePath) =>
    /\.(?:ts|tsx|js|jsx)$/i.test(candidatePath),
  );
  if (codePath) {
    return codePath;
  }

  return candidates[0] || null;
}

function resolveRecordedDirectiveArchitecturePrimaryEvidencePath(input: {
  directiveRoot: string;
  primaryEvidencePath?: string | null;
}) {
  const candidatePath = optionalString(input.primaryEvidencePath);
  if (!candidatePath) {
    return null;
  }

  const relativePath = resolveDirectiveRelativePath(input.directiveRoot, candidatePath);
  const absolutePath = normalizePath(path.join(input.directiveRoot, relativePath));
  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `invalid_input: primaryEvidencePath not found within directive-workspace: ${relativePath}`,
    );
  }
  return relativePath;
}

function resolveRecordedDirectiveArchitectureProducedArtifacts(input: {
  directiveRoot: string;
  transformedArtifactsProduced?: string[] | null;
}) {
  if (input.transformedArtifactsProduced == null) {
    return null;
  }

  const resolved = input.transformedArtifactsProduced
    .map((entry) => optionalString(typeof entry === "string" ? entry : null))
    .filter((entry): entry is string => Boolean(entry))
    .map((candidatePath) => {
      const relativePath = resolveDirectiveRelativePath(input.directiveRoot, candidatePath);
      const absolutePath = normalizePath(path.join(input.directiveRoot, relativePath));
      if (!fs.existsSync(absolutePath)) {
        throw new Error(
          `invalid_input: transformedArtifactsProduced entry not found within directive-workspace: ${relativePath}`,
        );
      }
      return relativePath;
    });

  return Array.from(new Set(resolved));
}

function readDirectiveArchitectureCloseoutAssistEngineRun(input: {
  artifact: DirectiveArchitectureBoundedStartArtifact;
}) {
  const engineRunAbsolutePath = normalizePath(
    path.join(input.artifact.directiveRoot, input.artifact.engineRunRecordPath),
  );

  if (!fs.existsSync(engineRunAbsolutePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(engineRunAbsolutePath, "utf8"),
    ) as DirectiveArchitectureCloseoutAssistEngineRun;
    return parsed;
  } catch {
    return null;
  }
}

function buildDirectiveArchitectureSuggestedResultSummary(input: {
  artifact: DirectiveArchitectureBoundedStartArtifact;
  stages: string[];
  directiveOwnedForm: string;
  intendedDelta: string;
  excludedBaggage: string[];
  explicitProofMethodRequired: boolean;
}) {
  const directiveOwnedForm = optionalString(input.directiveOwnedForm)
    || "the concrete Directive-owned Engine logic or product artifact";
  const intendedDelta = optionalString(input.intendedDelta)
    || "the intended Engine-owned improvement";
  const excludedBaggage =
    input.excludedBaggage.length > 0
      ? `Keep ${input.excludedBaggage[0]} out of scope.`
      : "Keep source-specific baggage out of scope.";

  if (input.stages.length >= 2) {
    const stageList = input.stages.join(" -> ");
    return [
      `Record the concrete Engine-owned delta from this bounded slice. Name the code or product artifact that changed, record its primary evidence path explicitly when one exists, and state whether the explicit ${stageList} structure remained visible in the adapted Directive-owned form (${directiveOwnedForm}).`,
      `Tie the closeout back to the intended delta: ${intendedDelta}.`,
      input.explicitProofMethodRequired
        ? "If you ran proof, name the concrete validation method, review criteria, benchmark, or checker used instead of saying proof happened generically."
        : null,
      excludedBaggage,
      "Then state explicitly whether this bounded result should adopt now or stay experimental.",
    ].filter(Boolean).join(" ");
  }

  return [
    "Record the concrete Engine-owned delta from this bounded slice.",
    `Name the code or product artifact that changed, record its primary evidence path explicitly when one exists, and describe the retained structural value in Directive-owned form (${directiveOwnedForm}) without inventing a fake stage sequence.`,
    `Tie the closeout back to the intended delta: ${intendedDelta}.`,
    input.explicitProofMethodRequired
      ? "If you ran proof, name the concrete validation method, review criteria, benchmark, or checker used instead of saying proof happened generically."
      : null,
    excludedBaggage,
    "Then state explicitly whether this bounded result should adopt now or stay experimental.",
  ].filter(Boolean).join(" ");
}

export function readDirectiveArchitectureBoundedCloseoutAssist(input: {
  startPath: string;
  directiveRoot?: string;
}): DirectiveArchitectureBoundedCloseoutAssist {
  const artifact = readDirectiveArchitectureBoundedStartArtifact({
    directiveRoot: input.directiveRoot,
    startPath: input.startPath,
  });
  const engineRun = readDirectiveArchitectureCloseoutAssistEngineRun({ artifact });
  const missionFitSummary =
    optionalString(engineRun?.analysis?.missionFitSummary) || artifact.objective;
  const primaryAdoptionQuestion =
    optionalString(engineRun?.analysis?.primaryAdoptionQuestion)
    || "What concrete Engine-owned improvement or operating asset should this bounded slice produce?";
  const extractedValue = optionalStringList(engineRun?.extractionPlan?.extractedValue);
  const excludedBaggage = optionalStringList(engineRun?.extractionPlan?.excludedBaggage);
  const directiveOwnedForm =
    optionalString(engineRun?.adaptationPlan?.directiveOwnedForm)
    || "Directive-owned Engine logic or operating-code asset.";
  const adaptedValue = optionalStringList(engineRun?.adaptationPlan?.adaptedValue);
  const improvementGoals = optionalStringList(engineRun?.improvementPlan?.improvementGoals);
  const intendedDelta =
    optionalString(engineRun?.improvementPlan?.intendedDelta)
    || artifact.objective;
  const structuralStages = collectStructuralStages(
    [
      artifact.objective,
      ...artifact.inputs,
      missionFitSummary,
      primaryAdoptionQuestion,
      ...extractedValue,
      directiveOwnedForm,
      ...adaptedValue,
      ...improvementGoals,
      intendedDelta,
    ].join(" "),
  );
  const explicitProofMethodRequired = hasEvaluatorOrProofSignals(
    [
      artifact.objective,
      ...artifact.inputs,
      missionFitSummary,
      ...extractedValue,
      ...improvementGoals,
      intendedDelta,
    ].join(" "),
  );
  const stagePreservationExpectation =
    structuralStages.length >= 2
      ? "preserve_explicit_stages"
      : "not_applicable";
  const stagePreservationSummary =
    structuralStages.length >= 2
      ? `This source carries an explicit structural stage pattern (${structuralStages.join(" -> ")}). Closeout should say whether those stages stayed visible in the adapted Engine result instead of collapsing into generic Architecture text.`
      : "No explicit multi-stage pattern was detected here. Preserve the structural value, but do not invent a stage sequence during closeout.";
  const decisionGuidance =
    structuralStages.length >= 2
      ? `Close as adopt only if the bounded slice produced a concrete Engine-owned delta and the explicit ${structuralStages.join(" -> ")} structure stayed visible in the resulting code or product artifact. Otherwise keep it experimental.`
      : "Close as adopt only if the bounded slice produced a concrete Engine-owned delta with clear evidence and bounded source baggage. Otherwise keep it experimental.";
  const readinessGuidance = [
    "target artifact clarified: check this only when you can name the concrete Engine-owned code or product artifact the slice changed.",
    "delta evidence present: check this only when the bounded slice produced a concrete artifact or code delta you can point to directly. If one or more concrete artifacts were produced, record them explicitly in transformed artifacts produced instead of inferring them later.",
    explicitProofMethodRequired
      ? "proof executed: if you ran a proof or check on this slice, name the concrete validation method, benchmark, reviewer criteria, or checker in the closeout summary."
      : structuralStages.length >= 2
      ? `proof executed: if you ran a proof or check on this slice, make sure the closeout summary mentions whether ${structuralStages.join(" -> ")} stayed explicit.`
      : "proof executed: check this only if you actually ran a proof or check tied to this bounded slice.",
    "unresolved baggage cleared: check this only when the remaining source baggage is explicitly excluded rather than silently carried forward.",
    "product artifact materialized: check this only when the Engine-owned artifact or code delta already exists, not when it is still only a plan.",
  ];

  return {
    missionFitSummary,
    primaryAdoptionQuestion,
    extractedValue,
    excludedBaggage,
    directiveOwnedForm,
    adaptedValue,
    improvementGoals,
    intendedDelta,
    structuralStages,
    stagePreservationExpectation,
    stagePreservationSummary,
    decisionGuidance,
    readinessGuidance,
    suggestedResultSummary: buildDirectiveArchitectureSuggestedResultSummary({
      artifact,
      stages: structuralStages,
      directiveOwnedForm,
      intendedDelta,
      excludedBaggage,
      explicitProofMethodRequired,
    }),
  };
}

export function readDirectiveArchitectureResultEvidenceForResult(input: {
  resultPath: string;
  directiveRoot?: string;
}): DirectiveArchitectureResultEvidenceSlot {
  const artifact = readDirectiveArchitectureBoundedResultArtifact({
    directiveRoot: input.directiveRoot,
    resultPath: input.resultPath,
  });
  const primaryDirectEvidencePath =
    artifact.primaryEvidencePath
    ?? resolveDirectiveArchitecturePrimaryDirectEvidencePath({
      directiveRoot: artifact.directiveRoot,
      resultSummary: artifact.resultSummary,
      rationale: artifact.rationale,
    });

  if (primaryDirectEvidencePath) {
    return {
      availability: "direct_evidence",
      primaryKind: /\.(?:ts|tsx|js|jsx)$/i.test(primaryDirectEvidencePath)
        ? "code_path"
        : "artifact_path",
      primaryPath: primaryDirectEvidencePath,
      primaryLabel: /\.(?:ts|tsx|js|jsx)$/i.test(primaryDirectEvidencePath)
        ? "Most relevant changed code location"
        : "Most relevant changed artifact",
      summary:
        artifact.primaryEvidencePath
          ? "A direct primary evidence path is explicitly recorded in the bounded closeout contract. Inspect that path first when reviewing what changed."
          : "A direct evidence path is explicitly recorded in the bounded result text. Inspect that path first when reviewing what changed.",
      supportingEvidence: [
        {
          kind: "bounded_result",
          path: artifact.resultRelativePath,
          label: "Bounded result artifact",
        },
        {
          kind: "closeout_decision",
          path: artifact.decisionRelativePath,
          label: "Closeout decision artifact",
        },
      ],
    };
  }

  return {
    availability: "artifact_only",
    primaryKind: "artifact_path",
    primaryPath: artifact.resultRelativePath,
    primaryLabel: "Best available result evidence",
    summary:
      "No direct changed code or artifact path is explicitly recorded in this bounded result. The bounded result artifact itself is the best available evidence for what changed.",
    supportingEvidence: [
      {
        kind: "closeout_decision",
        path: artifact.decisionRelativePath,
        label: "Closeout decision artifact",
      },
      {
        kind: "engine_run_record",
        path: artifact.engineRunRecordPath,
        label: "Linked Engine run record",
      },
    ],
  };
}

export function readDirectiveArchitectureResultEvidenceForStart(input: {
  startPath: string;
  directiveRoot?: string;
}): DirectiveArchitectureResultEvidenceSlot {
  const artifact = readDirectiveArchitectureBoundedStartArtifact({
    directiveRoot: input.directiveRoot,
    startPath: input.startPath,
  });

  if (!artifact.resultExists) {
    return {
      availability: "not_available",
      primaryKind: "none",
      primaryPath: null,
      primaryLabel: "No result evidence yet",
      summary:
        "No bounded result artifact exists yet, so no direct result evidence is available for this start artifact.",
      supportingEvidence: [
        {
          kind: "engine_run_record",
          path: artifact.engineRunRecordPath,
          label: "Linked Engine run record",
        },
      ],
    };
  }

  return readDirectiveArchitectureResultEvidenceForResult({
    directiveRoot: artifact.directiveRoot,
    resultPath: artifact.resultRelativePath,
  });
}

function resolveStructuralStagePreservation(input: {
  artifact: DirectiveArchitectureBoundedStartArtifact;
  resultSummary: string;
}) {
  const sourceStages = collectStructuralStages(
    `${input.artifact.objective} ${input.artifact.inputs.join(" ")}`,
  );
  if (sourceStages.length < 2) {
    return {
      required: false,
      preserved: true,
    };
  }

  const resultStages = new Set(collectStructuralStages(input.resultSummary));
  const preservedStageCount = sourceStages.filter((stage) => resultStages.has(stage)).length;

  return {
    required: true,
    preserved: preservedStageCount >= 2,
  };
}

function resolveArchitectureSelfImprovementCategory(
  artifact: DirectiveArchitectureBoundedStartArtifact,
  resultSummary: string,
): ArchitectureSelfImprovementCategory {
  const explicit = artifact.metaUsefulnessCategory.trim();
  if (SELF_IMPROVEMENT_CATEGORIES.has(explicit as ArchitectureSelfImprovementCategory)) {
    return explicit as ArchitectureSelfImprovementCategory;
  }

  return inferArchitectureSelfImprovementCategoryFromText(
    `${artifact.objective} ${resultSummary} ${artifact.sourceAnalysisRef} ${artifact.adaptationDecisionRef}`,
  );
}

function buildArchitectureSelfImprovementEvidence(input: {
  artifact: DirectiveArchitectureBoundedStartArtifact;
  resultSummary: string;
  category: ArchitectureSelfImprovementCategory;
}): DirectiveArchitectureSelfImprovementArtifact {
  return {
    category: input.category,
    claim:
      "Directive Workspace can carry this bounded Architecture slice forward into direct adoption without reopening the prior Engine, handoff, and post-consumption evidence chain by hand.",
    mechanism:
      "The bounded closeout now records an adoption-ready Architecture result and paired decision artifact directly on the bounded-result record.",
    baselineObservation:
      "Before this closeout, the reopened bounded slice still depended on manual interpretation to decide whether it could move forward as retained Directive-owned Architecture output.",
    expectedEffect:
      `The bounded result '${input.resultSummary}' can now move directly into the normal adoption/materialization path as Architecture-owned output.`,
    verificationMethod: "structural_inspection",
  };
}

function parseBoundedStartMarkdown(markdown: string) {
  const fields = parseLabeledBulletFields(markdown);
  const title = requiredString(
    markdown.split(/\r?\n/).find((line) => line.startsWith("# "))?.replace(/^# /, "").replace(/ Bounded Architecture Start$/, ""),
    "title",
  );

  return {
    title,
    candidateId: firstField(fields, "Candidate id", "candidate id"),
    candidateName: firstField(fields, "Candidate name", "candidate name"),
    experimentDate: firstField(fields, "Experiment date", "experiment date"),
    startApproval: firstField(fields, "Start approval", "start approval"),
    objective: firstField(fields, "Objective", "objective"),
    boundedScope: listField(fields, "Bounded scope"),
    inputs: listField(fields, "Inputs"),
    validationGates: listField(fields, "Validation gate(s)"),
    blockedRecoveryPath: firstField(fields, "Blocked recovery path", "blocked recovery path"),
    failureCriteria: firstField(fields, "Failure criteria", "failure criteria"),
    rollback: firstField(fields, "Rollback", "rollback"),
    resultSummary: firstField(fields, "Result summary", "result summary"),
    expectedOutput: listField(fields, "Expected output"),
    handoffStubPath: firstField(fields, "Handoff stub", "handoff stub"),
    engineRunRecordPath: firstField(fields, "Engine run record", "engine run record"),
    engineRunReportPath: firstField(fields, "Engine run report", "engine run report"),
    discoveryRoutingRecordPath: firstField(fields, "Discovery routing record", "discovery routing record"),
    nextDecision: firstField(fields, "Next decision", "next decision"),
    usefulnessLevel: firstField(fields, "Usefulness level", "usefulness level") as ArchitectureUsefulnessLevel,
    runtimeThresholdCheck: firstField(fields, "Runtime threshold check", "runtime threshold check"),
    sourceAnalysisRef: firstField(fields, "Source analysis ref", "source analysis ref"),
    adaptationDecisionRef: optionalFirstField(fields, "Adaptation decision ref") || "n/a",
    adaptationQuality: parseQualityLevel(optionalFirstField(fields, "Adaptation quality"), "skipped"),
    improvementQuality: parseQualityLevel(optionalFirstField(fields, "Improvement quality"), "skipped"),
    metaUseful: (optionalFirstField(fields, "Meta-useful") || "no").toLowerCase() === "yes",
    metaUsefulnessCategory: optionalFirstField(fields, "Meta-usefulness category") || "n/a",
    transformationArtifactGateResult: optionalFirstField(fields, "Transformation artifact gate result") || "partial",
    transformedArtifactsProduced: listField(fields, "Transformed artifacts produced"),
  };
}

function renderBoundedResultMarkdown(input: {
  startArtifact: DirectiveArchitectureBoundedStartArtifact;
  snapshotAt: string;
  closedBy: string;
  resultSummary: string;
  primaryEvidencePath: string | null;
  transformedArtifactsProduced: string[] | null;
  nextDecision: string;
  closeout: ReturnType<typeof buildDirectiveArchitectureCloseoutFile>;
}) {
  const artifact = input.startArtifact;
  const closeout = input.closeout;
  const boundedScope = artifact.boundedScope.length > 0
    ? artifact.boundedScope.map((item) => `- ${item}`).join("\n")
    : "- Keep the result bounded to the approved Architecture slice.";
  const inputs = artifact.inputs.length > 0
    ? artifact.inputs.map((item) => `- ${item}`).join("\n")
    : "- n/a";
  const gates = artifact.validationGates.length > 0
    ? artifact.validationGates.map((item) => `- \`${item}\``).join("\n")
    : "- n/a";
  const expectedOutput = artifact.expectedOutput.length > 0
    ? artifact.expectedOutput.map((item) => `- ${item}`).join("\n")
    : "- One bounded Architecture result artifact.";
  const transformedArtifacts = input.transformedArtifactsProduced !== null
    ? input.transformedArtifactsProduced.length > 0
      ? input.transformedArtifactsProduced.map((item) => `- \`${item}\``).join("\n")
      : "- none explicitly materialized in this bounded slice."
    : artifact.transformedArtifactsProduced.length > 0
      ? artifact.transformedArtifactsProduced.map((item) => `- \`${item}\``).join("\n")
      : `- \`${artifact.handoffStubPath}\``;

  return [
    `# ${artifact.title} Bounded Architecture Result`,
    "",
    `- Candidate id: ${artifact.candidateId}`,
    `- Candidate name: ${artifact.candidateName}`,
    `- Experiment date: ${input.snapshotAt.slice(0, 10)}`,
    "- Owning track: Architecture",
    "- Experiment type: engine-routed bounded result",
    `- Closeout approval: reviewed by ${input.closedBy} from bounded start \`${artifact.startRelativePath}\``,
    "",
    `- Objective: ${artifact.objective}`,
    "- Bounded scope:",
    boundedScope,
    "- Inputs:",
    inputs,
    "- Expected output:",
    expectedOutput,
    "- Validation gate(s):",
    gates,
    "- Transition policy profile: `decision_review`",
    "- Scoring policy profile: `architecture_self_improvement`",
    `- Blocked recovery path: ${artifact.blockedRecoveryPath}`,
    `- Failure criteria: ${artifact.failureCriteria}`,
    `- Rollback: ${artifact.rollback}`,
    `- Result summary: ${input.resultSummary}`,
    "- Evidence path:",
    ...(input.primaryEvidencePath
      ? [`- Primary evidence path: \`${input.primaryEvidencePath}\``]
      : []),
    `- Bounded start: \`${artifact.startRelativePath}\``,
    `- Handoff stub: \`${artifact.handoffStubPath}\``,
    `- Engine run record: \`${artifact.engineRunRecordPath}\``,
    `- Engine run report: \`${artifact.engineRunReportPath}\``,
    `- Discovery routing record: \`${artifact.discoveryRoutingRecordPath}\``,
    `- Closeout decision artifact: \`${closeout.relativePath}\``,
    `- Next decision: \`${input.nextDecision}\``,
    "",
    "## Lifecycle classification (per `architecture-artifact-lifecycle` contract)",
    "",
    "- Origin: `source-driven`",
    `- Usefulness level: \`${artifact.usefulnessLevel}\``,
    `- Runtime threshold check: ${artifact.runtimeThresholdCheck}`,
    "",
    "## Source adaptation fields (Architecture source-driven experiments only)",
    "",
    `- Source analysis ref: ${artifact.sourceAnalysisRef}`,
    `- Adaptation decision ref: ${artifact.adaptationDecisionRef}`,
    `- Adaptation quality: \`${closeout.artifact.adaptation_quality}\``,
    `- Improvement quality: \`${closeout.artifact.improvement_quality || artifact.improvementQuality}\``,
    `- Meta-useful: \`${artifact.metaUseful ? "yes" : "no"}\``,
    `- Meta-usefulness category: \`${artifact.metaUsefulnessCategory}\``,
    `- Transformation artifact gate result: \`${artifact.transformationArtifactGateResult}\``,
    "- Transformed artifacts produced:",
    transformedArtifacts,
    "",
    "## Closeout decision",
    "",
    `- Verdict: \`${closeout.artifact.decision.verdict}\``,
    `- Rationale: ${closeout.artifact.decision.rationale}`,
    `- Review result: \`${closeout.reviewResolution?.reviewResult || "not_run"}\``,
    `- Review score: \`${String(closeout.reviewResolution?.reviewScore ?? "n/a")}\``,
    "",
  ].join("\n");
}

function renderNoteHandoffBoundedResultMarkdown(input: {
  handoffArtifact: DirectiveArchitectureHandoffArtifact;
  snapshotAt: string;
  closedBy: string;
  resultSummary: string;
  primaryEvidencePath: string | null;
  transformedArtifactsProduced: string[] | null;
  nextDecision: string;
  closeout: ReturnType<typeof buildDirectiveArchitectureCloseoutFile>;
}) {
  const artifact = input.handoffArtifact;
  const closeout = input.closeout;
  const boundedScope = artifact.boundedScope.length > 0
    ? artifact.boundedScope.map((item) => `- ${item}`).join("\n")
    : "- Keep the NOTE review bounded to one Architecture result.";
  const inputs = artifact.inputs.length > 0
    ? artifact.inputs.map((item) => `- ${item}`).join("\n")
    : "- n/a";
  const gates = artifact.validationGates.length > 0
    ? artifact.validationGates.map((item) => `- \`${item}\``).join("\n")
    : "- n/a";
  const transformedArtifacts =
    input.transformedArtifactsProduced && input.transformedArtifactsProduced.length > 0
      ? input.transformedArtifactsProduced.map((item) => `- \`${item}\``).join("\n")
      : "- none explicitly materialized in this NOTE review.";
  const metaCategory = closeout.artifact.self_improvement?.category ?? "n/a";

  return [
    `# ${artifact.title} Bounded Architecture Result`,
    "",
    `- Candidate id: ${artifact.candidateId}`,
    `- Candidate name: ${artifact.title}`,
    `- Experiment date: ${input.snapshotAt.slice(0, 10)}`,
    "- Owning track: Architecture",
    "- Experiment type: note-mode direct bounded result",
    `- Closeout approval: reviewed by ${input.closedBy} directly from NOTE-mode handoff \`${artifact.handoffRelativePath}\``,
    "",
    `- Objective: ${artifact.objective}`,
    "- Bounded scope:",
    boundedScope,
    "- Inputs:",
    inputs,
    "- Expected output:",
    "- One NOTE-mode bounded Architecture result artifact.",
    "- Validation gate(s):",
    gates,
    "- Transition policy profile: `decision_review`",
    "- Scoring policy profile: `architecture_self_improvement`",
    `- Rollback: ${artifact.rollback}`,
    `- Result summary: ${input.resultSummary}`,
    "- Evidence path:",
    ...(input.primaryEvidencePath
      ? [`- Primary evidence path: \`${input.primaryEvidencePath}\``]
      : []),
    "- Bounded start: `n/a`",
    `- Handoff stub: \`${artifact.handoffRelativePath}\``,
    `- Engine run record: ${artifact.engineRunRecordPath ? `\`${artifact.engineRunRecordPath}\`` : "n/a"}`,
    `- Engine run report: ${artifact.engineRunReportPath ? `\`${artifact.engineRunReportPath}\`` : "n/a"}`,
    `- Discovery routing record: ${artifact.discoveryRoutingRecordPath ? `\`${artifact.discoveryRoutingRecordPath}\`` : "n/a"}`,
    `- Closeout decision artifact: \`${closeout.relativePath}\``,
    `- Next decision: \`${input.nextDecision}\``,
    "",
    "## Lifecycle classification (per `architecture-artifact-lifecycle` contract)",
    "",
    "- Origin: `source-driven`",
    `- Usefulness level: \`${artifact.usefulnessLevel}\``,
    `- Runtime threshold check: ${artifact.runtimeThresholdCheck}`,
    "",
    "## Source adaptation fields (Architecture source-driven experiments only)",
    "",
    "- Source analysis ref: n/a",
    "- Adaptation decision ref: n/a",
    `- Adaptation quality: \`${closeout.artifact.adaptation_quality}\``,
    `- Improvement quality: \`${closeout.artifact.improvement_quality || "skipped"}\``,
    `- Meta-useful: \`${artifact.usefulnessLevel === "meta" ? "yes" : "no"}\``,
    `- Meta-usefulness category: \`${metaCategory}\``,
    "- Transformation artifact gate result: `not_applicable`",
    "- Transformed artifacts produced:",
    transformedArtifacts,
    "",
    "## Closeout decision",
    "",
    `- Verdict: \`${closeout.artifact.decision.verdict}\``,
    `- Rationale: ${closeout.artifact.decision.rationale}`,
    `- Review result: \`${closeout.reviewResolution?.reviewResult || "not_run"}\``,
    `- Review score: \`${String(closeout.reviewResolution?.reviewScore ?? "n/a")}\``,
    "",
  ].join("\n");
}

function renderContinuationBoundedStartMarkdown(input: {
  resultArtifact: DirectiveArchitectureBoundedResultArtifact;
  snapshotAt: string;
  continuedBy: string;
}) {
  const artifact = input.resultArtifact;
  const boundedScope = artifact.boundedScope.length > 0
    ? artifact.boundedScope.map((item) => `- ${item}`).join("\n")
    : "- Keep the experiment bounded to one continuation slice.";
  const inputs = [
    `Previous bounded result summary: ${artifact.resultSummary}`,
    ...artifact.inputs,
  ].map((item) => `- ${item}`).join("\n");
  const gates = artifact.validationGates.length > 0
    ? artifact.validationGates.map((item) => `- \`${item}\``).join("\n")
    : "- n/a";

  return [
    `# ${artifact.title} Continuation Bounded Architecture Start`,
    "",
    `- Candidate id: ${artifact.candidateId}`,
    `- Candidate name: ${artifact.candidateName}`,
    `- Experiment date: ${input.snapshotAt.slice(0, 10)}`,
    "- Owning track: Architecture",
    "- Experiment type: engine-routed bounded continuation start",
    `- Start approval: approved by ${input.continuedBy} from bounded result \`${artifact.resultRelativePath}\``,
    "",
    `- Objective: ${artifact.objective}`,
    "- Bounded scope:",
    boundedScope,
    "- Inputs:",
    inputs,
    "- Expected output:",
    "- One next bounded Architecture slice that continues from the prior bounded result without reinterpreting the Engine run from scratch.",
    "- Validation gate(s):",
    gates,
    "- Transition policy profile: `decision_review`",
    "- Scoring policy profile: `architecture_self_improvement`",
    "- Blocked recovery path: Keep the bounded result artifact as the authoritative continuation boundary and stop before adoption.",
    `- Failure criteria: The continuation slice still cannot clarify the next Directive-owned mechanism beyond the prior bounded result.`,
    `- Rollback: ${artifact.rollback}`,
    "- Result summary: pending_execution",
    "- Evidence path:",
    `- Previous bounded result: \`${artifact.resultRelativePath}\``,
    `- Handoff stub: \`${artifact.handoffStubPath}\``,
    `- Engine run record: \`${artifact.engineRunRecordPath}\``,
    `- Engine run report: \`${artifact.engineRunReportPath}\``,
    `- Discovery routing record: \`${artifact.discoveryRoutingRecordPath}\``,
    `- Next decision: \`${artifact.nextDecision}\``,
    "",
    "## Lifecycle classification (per `architecture-artifact-lifecycle` contract)",
    "",
    "- Origin: `source-driven`",
    `- Usefulness level: \`${artifact.usefulnessLevel}\``,
    `- Runtime threshold check: ${artifact.runtimeThresholdCheck}`,
    "",
    "## Source adaptation fields (Architecture source-driven experiments only)",
    "",
    `- Source analysis ref: ${artifact.handoffStubPath}`,
    `- Adaptation decision ref: ${artifact.decisionRelativePath}`,
    "- Adaptation quality: `skipped`",
    "- Improvement quality: `skipped`",
    `- Meta-useful: \`${artifact.usefulnessLevel === "meta" ? "yes" : "no"}\``,
    "- Meta-usefulness category: `n/a`",
    "- Transformation artifact gate result: `partial`",
    "- Transformed artifacts produced:",
    `- \`${artifact.resultRelativePath}\``,
    "",
  ].join("\n");
}

export function readDirectiveArchitectureBoundedStartArtifact(input: {
  startPath: string;
  directiveRoot?: string;
}): DirectiveArchitectureBoundedStartArtifact {
  const directiveRoot = normalizePath(input.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const startRelativePath = resolveDirectiveRelativePath(directiveRoot, input.startPath);

  if (
    !startRelativePath.startsWith("architecture/01-experiments/")
    || !startRelativePath.endsWith("-bounded-start.md")
  ) {
    throw new Error("invalid_input: startPath must point to architecture/01-experiments/*-bounded-start.md");
  }

  const startAbsolutePath = normalizePath(path.join(directiveRoot, startRelativePath));
  if (!fs.existsSync(startAbsolutePath)) {
    throw new Error(`invalid_input: startPath not found: ${startRelativePath}`);
  }

  const parsed = parseBoundedStartMarkdown(fs.readFileSync(startAbsolutePath, "utf8"));
  const resultRelativePath = resolveResultRelativePath(startRelativePath);
  const resultAbsolutePath = normalizePath(path.join(directiveRoot, resultRelativePath));
  const decisionRelativePath = resultRelativePath.replace(/\.md$/u, "-adoption-decision.json");
  const decisionAbsolutePath = normalizePath(path.join(directiveRoot, decisionRelativePath));

  return {
    ...parsed,
    directiveRoot,
    startRelativePath,
    startAbsolutePath,
    resultRelativePath,
    resultAbsolutePath,
    resultExists: fs.existsSync(resultAbsolutePath),
    decisionRelativePath,
    decisionAbsolutePath,
    decisionExists: fs.existsSync(decisionAbsolutePath),
  };
}

export function readDirectiveArchitectureBoundedResultArtifact(input: {
  resultPath: string;
  directiveRoot?: string;
}): DirectiveArchitectureBoundedResultArtifact {
  const directiveRoot = normalizePath(input.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const resultRelativePath = resolveDirectiveRelativePath(directiveRoot, input.resultPath);

  if (
    !resultRelativePath.startsWith("architecture/01-experiments/")
    || !resultRelativePath.endsWith("-bounded-result.md")
  ) {
    throw new Error("invalid_input: resultPath must point to architecture/01-experiments/*-bounded-result.md");
  }

  const resultAbsolutePath = normalizePath(path.join(directiveRoot, resultRelativePath));
  if (!fs.existsSync(resultAbsolutePath)) {
    throw new Error(`invalid_input: resultPath not found: ${resultRelativePath}`);
  }

  const fields = parseLabeledBulletFields(fs.readFileSync(resultAbsolutePath, "utf8"));
  const decisionRelativePath = resultRelativePath.replace(/\.md$/u, "-adoption-decision.json");
  const decisionAbsolutePath = normalizePath(path.join(directiveRoot, decisionRelativePath));
  const continuationStartRelativePath = resolveContinuationStartRelativePath(resultRelativePath);
  const continuationStartAbsolutePath = normalizePath(
    path.join(directiveRoot, continuationStartRelativePath),
  );
  const title = requiredString(
    fs.readFileSync(resultAbsolutePath, "utf8")
      .split(/\r?\n/)
      .find((line) => line.startsWith("# "))
      ?.replace(/^# /, "")
      .replace(/ Bounded Architecture Result$/, ""),
    "title",
  );

  return {
    title,
    candidateId: firstField(fields, "Candidate id", "candidate id"),
    candidateName: firstField(fields, "Candidate name", "candidate name"),
    experimentDate: firstField(fields, "Experiment date", "experiment date"),
    closeoutApproval: firstField(fields, "Closeout approval", "closeout approval"),
    objective: firstField(fields, "Objective", "objective"),
    boundedScope: listField(fields, "Bounded scope"),
    inputs: listField(fields, "Inputs"),
    validationGates: listField(fields, "Validation gate(s)"),
    resultSummary: firstField(fields, "Result summary", "result summary"),
    nextDecision: firstField(fields, "Next decision", "next decision"),
    handoffStubPath: firstField(fields, "Handoff stub", "handoff stub"),
    startRelativePath: optionalFirstField(fields, "Bounded start"),
    engineRunRecordPath: firstField(fields, "Engine run record", "engine run record"),
    engineRunReportPath: firstField(fields, "Engine run report", "engine run report"),
    discoveryRoutingRecordPath: firstField(fields, "Discovery routing record", "discovery routing record"),
    decisionRelativePath: firstField(fields, "Closeout decision artifact", "closeout decision artifact"),
    usefulnessLevel: firstField(fields, "Usefulness level", "usefulness level") as ArchitectureUsefulnessLevel,
    runtimeThresholdCheck: firstField(fields, "Runtime threshold check", "runtime threshold check"),
    rollback: firstField(fields, "Rollback", "rollback"),
    verdict: firstField(fields, "Verdict", "verdict"),
    rationale: firstField(fields, "Rationale", "rationale"),
    primaryEvidencePath: optionalFirstField(fields, "Primary evidence path"),
    transformedArtifactsProduced: listField(fields, "Transformed artifacts produced"),
    directiveRoot,
    resultRelativePath,
    resultAbsolutePath,
    decisionAbsolutePath,
    decisionExists: fs.existsSync(decisionAbsolutePath),
    continuationStartRelativePath,
    continuationStartAbsolutePath,
    continuationStartExists: fs.existsSync(continuationStartAbsolutePath),
  };
}

export function continueDirectiveArchitectureFromBoundedResult(
  input: ContinueDirectiveArchitectureBoundedResultInput,
): DirectiveArchitectureContinuationStartResult {
  const resultArtifact = readDirectiveArchitectureBoundedResultArtifact({
    directiveRoot: input.directiveRoot,
    resultPath: input.resultPath,
  });

  if (!resultArtifact.startRelativePath) {
    throw new Error(
      "invalid_input: NOTE-mode direct bounded results cannot open a continuation start from a missing bounded start",
    );
  }

  if (
    resultArtifact.verdict !== "stay_experimental"
    || resultArtifact.nextDecision !== "needs-more-evidence"
  ) {
    throw new Error(
      "invalid_input: only stay_experimental bounded results with next decision needs-more-evidence can open a continuation start",
    );
  }

  const snapshotAt = new Date().toISOString();
  const continuedBy = String(input.continuedBy || "directive-frontend-operator").trim()
    || "directive-frontend-operator";
  const created = !resultArtifact.continuationStartExists;

  if (created) {
    const markdown = renderContinuationBoundedStartMarkdown({
      resultArtifact,
      snapshotAt,
      continuedBy,
    });
    fs.mkdirSync(path.dirname(resultArtifact.continuationStartAbsolutePath), { recursive: true });
    fs.writeFileSync(resultArtifact.continuationStartAbsolutePath, markdown, "utf8");
  }

  return {
    ok: true,
    created,
    snapshotAt,
    directiveRoot: resultArtifact.directiveRoot,
    resultRelativePath: resultArtifact.resultRelativePath,
    resultAbsolutePath: resultArtifact.resultAbsolutePath,
    continuationStartRelativePath: resultArtifact.continuationStartRelativePath,
    continuationStartAbsolutePath: resultArtifact.continuationStartAbsolutePath,
    candidateId: resultArtifact.candidateId,
    candidateName: resultArtifact.candidateName,
    usefulnessLevel: resultArtifact.usefulnessLevel,
    objective: resultArtifact.objective,
    continuationState: "continued",
  };
}

export function closeDirectiveArchitectureNoteHandoff(
  input: CloseDirectiveArchitectureNoteHandoffInput,
): DirectiveArchitectureBoundedCloseoutResult {
  const handoffArtifact = readDirectiveArchitectureHandoffArtifact({
    directiveRoot: input.directiveRoot,
    handoffPath: input.handoffPath,
  });
  const { queuePath, queue } = readDiscoveryQueueDocument(handoffArtifact.directiveRoot);
  const queueEntry = queue.entries.find((entry) => entry.candidate_id === handoffArtifact.candidateId) ?? null;

  if (!queueEntry) {
    throw new Error(`invalid_input: discovery queue entry not found for ${handoffArtifact.candidateId}`);
  }
  if (String(queueEntry.operating_mode ?? "").trim().toLowerCase() !== "note") {
    throw new Error("invalid_input: direct handoff closeout is only available for NOTE-mode Architecture cases");
  }
  if (queueEntry.routing_target !== "architecture") {
    throw new Error("invalid_input: direct handoff closeout only supports Architecture-routed Discovery cases");
  }
  if (handoffArtifact.startExists) {
    throw new Error("invalid_input: NOTE-mode direct handoff closeout is only valid before a bounded start exists");
  }

  const closedBy = String(input.closedBy || "directive-frontend-operator").trim()
    || "directive-frontend-operator";
  const snapshotAt = optionalString(input.snapshotAt) || new Date().toISOString();
  const transitionDate = snapshotAt.slice(0, 10);
  const resultSummary = requiredString(input.resultSummary, "resultSummary");
  const created = !handoffArtifact.resultExists;

  if (created) {
    const primaryEvidencePath = resolveRecordedDirectiveArchitecturePrimaryEvidencePath({
      directiveRoot: handoffArtifact.directiveRoot,
      primaryEvidencePath: input.primaryEvidencePath,
    });
    const transformedArtifactsProduced = resolveRecordedDirectiveArchitectureProducedArtifacts({
      directiveRoot: handoffArtifact.directiveRoot,
      transformedArtifactsProduced: input.transformedArtifactsProduced,
    });
    const nextDecision = input.nextDecision || "defer";
    const valueShape = input.valueShape && VALUE_SHAPES.includes(input.valueShape)
      ? input.valueShape
      : "working_document";
    const adaptationQuality = input.adaptationQuality && QUALITY_LEVELS.has(input.adaptationQuality)
      ? input.adaptationQuality
      : "adequate";
    const improvementQuality = input.improvementQuality && QUALITY_LEVELS.has(input.improvementQuality)
      ? input.improvementQuality
      : "skipped";
    const proofExecuted = input.proofExecuted === true;
    const targetArtifactClarified = input.targetArtifactClarified === true;
    const deltaEvidencePresent = input.deltaEvidencePresent === true;
    const noUnresolvedBaggage = input.noUnresolvedBaggage === true;
    const productArtifactMaterialized = input.productArtifactMaterialized === true;
    const projectionInput: DirectiveMirroredNoteArchitectureCloseoutProjectionInput = {
      snapshotAt,
      closedBy,
      resultSummary,
      primaryEvidencePath,
      transformedArtifactsProduced: transformedArtifactsProduced ?? [],
      nextDecision,
      valueShape,
      adaptationQuality,
      improvementQuality,
      proofExecuted,
      targetArtifactClarified,
      deltaEvidencePresent,
      noUnresolvedBaggage,
      productArtifactMaterialized,
    };

    const mirrored = readDirectiveMirroredDiscoveryCaseRecord({
      directiveRoot: handoffArtifact.directiveRoot,
      caseId: handoffArtifact.candidateId,
    });
    if (!mirrored.record) {
      const routing = readDirectiveDiscoveryRoutingArtifact({
        directiveRoot: handoffArtifact.directiveRoot,
        routingPath: queueEntry.routing_record_path,
      });
      writeDirectiveMirroredDiscoveryCaseRecord({
        directiveRoot: handoffArtifact.directiveRoot,
        record: {
          schemaVersion: 1,
          mirrorKind: "discovery_front_door_submission",
          caseId: handoffArtifact.candidateId,
          candidateId: handoffArtifact.candidateId,
          candidateName: handoffArtifact.title,
          sourceType: queueEntry.source_type,
          sourceReference: queueEntry.source_reference,
          decisionState: routing.decisionState,
          routeTarget: queueEntry.routing_target,
          operatingMode: queueEntry.operating_mode ?? null,
          queueStatus: queueEntry.status,
          createdAt: `${transitionDate}T00:00:00.000Z`,
          updatedAt: snapshotAt,
          linkedArtifacts: {
            intakeRecordPath: queueEntry.intake_record_path ?? routing.linkedIntakeRecord ?? null,
            triageRecordPath: routing.linkedTriageRecord,
            routingRecordPath: queueEntry.routing_record_path,
            engineRunRecordPath: handoffArtifact.engineRunRecordPath,
            engineRunReportPath: handoffArtifact.engineRunReportPath,
            architectureHandoffPath: handoffArtifact.handoffRelativePath,
            architectureDecisionPath: handoffArtifact.resultRelativePath.replace(/\.md$/u, "-adoption-decision.json"),
            resultRecordPath: null,
          },
          projectionInputs: null,
        },
      });
    }

    mirrorDirectiveNoteArchitectureCloseout({
      directiveRoot: handoffArtifact.directiveRoot,
      caseId: handoffArtifact.candidateId,
      receivedAt: snapshotAt,
      queueStatus: "completed",
      linkedArtifacts: {
        architectureHandoffPath: handoffArtifact.handoffRelativePath,
        architectureDecisionPath: handoffArtifact.resultRelativePath.replace(/\.md$/u, "-adoption-decision.json"),
        resultRecordPath: handoffArtifact.resultRelativePath,
      },
      projectionInput,
    });

    const projectionSet = writeDirectiveNoteArchitectureCloseoutProjectionSet({
      directiveRoot: handoffArtifact.directiveRoot,
      caseId: handoffArtifact.candidateId,
    });
    if (!projectionSet.ok) {
      throw new Error(
        `invalid_state: unable to generate NOTE Architecture closeout projections for ${handoffArtifact.candidateId}: ${projectionSet.reason}`,
      );
    }
  }

  const syncResult = syncDiscoveryIntakeLifecycle({
    directiveRoot: handoffArtifact.directiveRoot,
    queue,
    transitionDate,
    request: {
      candidate_id: handoffArtifact.candidateId,
      target_phase: "completed",
      routing_target: "architecture",
      intake_record_path: queueEntry.intake_record_path ?? null,
      routing_record_path: queueEntry.routing_record_path,
      result_record_path: handoffArtifact.resultRelativePath,
      note_append:
        `NOTE-mode Architecture closeout by ${closedBy} recorded ${handoffArtifact.resultRelativePath} directly from ${handoffArtifact.handoffRelativePath}`,
    },
  });
  writeJsonPretty(queuePath, syncResult.queue);

  const resolvedState = resolveDirectiveWorkspaceState({
    directiveRoot: handoffArtifact.directiveRoot,
    artifactPath: handoffArtifact.resultRelativePath,
  });
  if (resolvedState.focus?.ok) {
    const mirrored = readDirectiveMirroredDiscoveryCaseRecord({
      directiveRoot: handoffArtifact.directiveRoot,
      caseId: handoffArtifact.candidateId,
    });
    const eventLog = readDirectiveCaseMirrorEvents({
      directiveRoot: handoffArtifact.directiveRoot,
      caseId: handoffArtifact.candidateId,
    });
    const nextSequence = eventLog.events.reduce(
      (highest, event) => Math.max(highest, event.sequence),
      0,
    ) + 1;
    appendDirectiveCaseMirrorEvents({
      directiveRoot: handoffArtifact.directiveRoot,
      caseId: handoffArtifact.candidateId,
      events: [
        {
          schemaVersion: 1,
          eventId: `${handoffArtifact.candidateId}:state_materialized:note_closeout:v1`,
          caseId: handoffArtifact.candidateId,
          candidateId: handoffArtifact.candidateId,
          candidateName: handoffArtifact.title,
          sequence: nextSequence,
          eventType: "state_materialized",
          occurredAt: snapshotAt,
          queueStatus: resolvedState.focus.discovery.queueStatus,
          routeTarget: resolvedState.focus.routeTarget,
          operatingMode: resolvedState.focus.discovery.operatingMode,
          linkedArtifactPath: resolvedState.focus.currentHead.artifactPath,
          decisionState: mirrored.record?.decisionState ?? null,
          currentHeadPath: resolvedState.focus.currentHead.artifactPath,
          currentStage: resolvedState.focus.currentStage,
          nextLegalStep: resolvedState.focus.nextLegalStep,
        },
      ],
    });
  }

  const resultArtifact = readDirectiveArchitectureBoundedResultArtifact({
    directiveRoot: handoffArtifact.directiveRoot,
    resultPath: handoffArtifact.resultRelativePath,
  });

  return {
    ok: true,
    created,
    snapshotAt,
    directiveRoot: handoffArtifact.directiveRoot,
    handoffRelativePath: handoffArtifact.handoffRelativePath,
    handoffAbsolutePath: handoffArtifact.handoffAbsolutePath,
    startRelativePath: resultArtifact.startRelativePath,
    startAbsolutePath: resultArtifact.startRelativePath
      ? normalizePath(path.join(handoffArtifact.directiveRoot, resultArtifact.startRelativePath))
      : null,
    resultRelativePath: resultArtifact.resultRelativePath,
    resultAbsolutePath: resultArtifact.resultAbsolutePath,
    decisionRelativePath: resultArtifact.decisionRelativePath,
    decisionAbsolutePath: resultArtifact.decisionAbsolutePath,
    candidateId: resultArtifact.candidateId,
    candidateName: resultArtifact.candidateName,
    usefulnessLevel: resultArtifact.usefulnessLevel,
    objective: resultArtifact.objective,
    resultSummary: resultArtifact.resultSummary,
    nextDecision: resultArtifact.nextDecision,
    verdict: resultArtifact.verdict,
    closeoutState: resolveCloseoutStateFromVerdict(resultArtifact.verdict),
  };
}

export function closeDirectiveArchitectureBoundedStart(
  input: CloseDirectiveArchitectureBoundedStartInput,
): DirectiveArchitectureBoundedCloseoutResult {
  const startArtifact = readDirectiveArchitectureBoundedStartArtifact({
    directiveRoot: input.directiveRoot,
    startPath: input.startPath,
  });

  const closedBy = String(input.closedBy || "directive-frontend-operator").trim()
    || "directive-frontend-operator";
  const snapshotAt = new Date().toISOString();
  const created = !startArtifact.resultExists;
  const resultSummary = requiredString(input.resultSummary, "resultSummary");
  const primaryEvidencePath = resolveRecordedDirectiveArchitecturePrimaryEvidencePath({
    directiveRoot: startArtifact.directiveRoot,
    primaryEvidencePath: input.primaryEvidencePath,
  });
  const transformedArtifactsProduced = resolveRecordedDirectiveArchitectureProducedArtifacts({
    directiveRoot: startArtifact.directiveRoot,
    transformedArtifactsProduced: input.transformedArtifactsProduced,
  });
  const nextDecision = input.nextDecision || "needs-more-evidence";
  const valueShape = input.valueShape && VALUE_SHAPES.includes(input.valueShape)
    ? input.valueShape
    : "working_document";
  const adaptationQuality = input.adaptationQuality && QUALITY_LEVELS.has(input.adaptationQuality)
    ? input.adaptationQuality
    : "adequate";
  const improvementQuality = input.improvementQuality && QUALITY_LEVELS.has(input.improvementQuality)
    ? input.improvementQuality
    : "skipped";
  const proofExecuted = input.proofExecuted === true;
  const targetArtifactClarified = input.targetArtifactClarified !== false;
  const deltaEvidencePresent = input.deltaEvidencePresent !== false;
  const noUnresolvedBaggage = input.noUnresolvedBaggage === true;
  const productArtifactMaterialized = input.productArtifactMaterialized === true;
  const valuableWithoutRuntimeSurface = startArtifact.runtimeThresholdCheck.toLowerCase().includes("yes");
  const structuralStagePreservation = resolveStructuralStagePreservation({
    artifact: startArtifact,
    resultSummary,
  });
  const explicitProofMethodRequired = hasEvaluatorOrProofSignals(
    `${startArtifact.objective} ${startArtifact.inputs.join(" ")}`,
  );
  const proofMethodExplicit = !explicitProofMethodRequired || hasExplicitProofMethod(resultSummary);
  const metaSelfImprovementCategory =
    startArtifact.usefulnessLevel === "meta"
      ? resolveArchitectureSelfImprovementCategory(startArtifact, resultSummary)
      : undefined;
  const selfImprovement =
    startArtifact.usefulnessLevel === "meta" && metaSelfImprovementCategory
      ? buildArchitectureSelfImprovementEvidence({
          artifact: startArtifact,
          resultSummary,
          category: metaSelfImprovementCategory,
        })
      : undefined;

  const closeoutRequest: DirectiveArchitectureCloseoutWriteRequest = {
    recordRelativePath: startArtifact.resultRelativePath,
    sourceId: startArtifact.candidateId,
    usefulnessLevel: startArtifact.usefulnessLevel,
    valueShape,
    readinessCheck: {
      source_analysis_complete: true,
      adaptation_decision_complete: targetArtifactClarified,
      adaptation_quality_acceptable: adaptationQuality === "strong" || adaptationQuality === "adequate",
      delta_evidence_present: deltaEvidencePresent,
      no_unresolved_baggage: noUnresolvedBaggage,
    },
    adaptationQuality,
    improvementQuality,
    productArtifactMaterialized,
    proofExecuted,
    targetArtifactClarified,
    valuableWithoutRuntimeSurface,
    metaSelfImprovementCategory,
    sourceAnalysisRef: startArtifact.sourceAnalysisRef,
    adaptationDecisionRef:
      startArtifact.adaptationDecisionRef && startArtifact.adaptationDecisionRef !== "n/a"
        ? startArtifact.adaptationDecisionRef
        : undefined,
    artifactPath: startArtifact.resultRelativePath,
    primaryEvidencePath: primaryEvidencePath ?? undefined,
    selfImprovement,
    reviewInput: {
      candidateId: startArtifact.candidateId,
      checks: {
        state_visibility_check: "pass",
        rollback_check: "pass",
        scope_isolation_check: "pass",
        validation_link_check:
          proofExecuted && structuralStagePreservation.preserved && proofMethodExplicit
            ? "pass"
            : "warning",
        ownership_boundary_check: "pass",
        packet_consumption_check: "pass",
        artifact_evidence_continuity_check:
          deltaEvidencePresent && structuralStagePreservation.preserved ? "pass" : "warning",
      },
    },
  };

  const closeout = buildDirectiveArchitectureCloseoutFile(closeoutRequest);
  const markdown = renderBoundedResultMarkdown({
    startArtifact,
    snapshotAt,
    closedBy,
    resultSummary,
    primaryEvidencePath,
    transformedArtifactsProduced,
    nextDecision,
    closeout,
  });

  fs.mkdirSync(path.dirname(startArtifact.resultAbsolutePath), { recursive: true });
  fs.writeFileSync(startArtifact.resultAbsolutePath, markdown, "utf8");

  upsertDirectiveArchitectureAdoptionDecisionArtifact({
    directiveRoot: startArtifact.directiveRoot,
    recordRelativePath: startArtifact.resultRelativePath,
    outputRelativePath: closeout.relativePath,
    artifact: closeout.artifact,
  });

  return {
    ok: true,
    created,
    snapshotAt,
    directiveRoot: startArtifact.directiveRoot,
    handoffRelativePath: startArtifact.handoffStubPath,
    handoffAbsolutePath: normalizePath(path.join(startArtifact.directiveRoot, startArtifact.handoffStubPath)),
    startRelativePath: startArtifact.startRelativePath,
    startAbsolutePath: startArtifact.startAbsolutePath,
    resultRelativePath: startArtifact.resultRelativePath,
    resultAbsolutePath: startArtifact.resultAbsolutePath,
    decisionRelativePath: closeout.relativePath,
    decisionAbsolutePath: path.join(startArtifact.directiveRoot, closeout.relativePath).replace(/\\/g, "/"),
    candidateId: startArtifact.candidateId,
    candidateName: startArtifact.candidateName,
    usefulnessLevel: startArtifact.usefulnessLevel,
    objective: startArtifact.objective,
    resultSummary,
    nextDecision,
    verdict: closeout.artifact.decision.verdict,
    closeoutState: closeout.closeoutState,
  };
}

