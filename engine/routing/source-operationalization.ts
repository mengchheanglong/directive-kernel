import type { EngineMissionContext, EngineSourceItem } from "../types.ts";

export type SourceOperationalizationDecision =
  | "reject"
  | "note_only"
  | "capability_candidate"
  | "architecture_experiment"
  | "training_lab_only"
  | "fine_tune_later";

export type SourceOperationalizationRecommendedLane =
  | "discovery"
  | "runtime"
  | "architecture"
  | "external";

export type SourceOperationalizationInput = {
  source: EngineSourceItem;
  mission?: Pick<
    EngineMissionContext,
    "currentObjective" | "usefulnessSignals" | "capabilityLanes"
  > | null;
  signals?: {
    repoStars?: number | null;
    citationCount?: number | null;
    referenceCount?: number | null;
    hasCallableCli?: boolean | null;
    hasCallableApi?: boolean | null;
    hasInstallablePackage?: boolean | null;
    hasRunnableExample?: boolean | null;
    documentationOnly?: boolean | null;
    localSystemPatchPossible?: boolean | null;
    localWorkflowAdaptation?: boolean | null;
    measurableExperiment?: boolean | null;
    hasKillCriteria?: boolean | null;
    experimentKillCriteria?: string | null;
    requiresModelArchitectureChange?: boolean | null;
    requiresPretraining?: boolean | null;
    requiresTokenizerChange?: boolean | null;
    requiresLargeScalePostTraining?: boolean | null;
    requiresFineTuningData?: boolean | null;
    fineTuneOnly?: boolean | null;
    requiresExternalService?: boolean | null;
    noteTarget?: string | null;
  };
};

export type SourceOperationalizationDecisionResult = {
  source_id: string;
  source_type: EngineSourceItem["sourceType"];
  decision: SourceOperationalizationDecision;
  classification: string;
  rationale: string;
  actionability_score: number;
  community_signal_score: number;
  hermes_relevance_score: number;
  requires_model_training: boolean;
  requires_external_service: boolean;
  recommended_lane: SourceOperationalizationRecommendedLane;
  next_artifact: string;
  kill_criteria?: string;
  note_target?: string;
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const TRAINING_LAB_PATTERNS = [
  /\bpre[- ]?training\b/,
  /\bmodel architecture\b/,
  /\btransformer\b/,
  /\btokenizer\b/,
  /\bbase model\b/,
  /\bfoundation model\b/,
  /\bweights?\b/,
  /\blarge[- ]scale post[- ]?training\b/,
  /\brlhf\b/,
];

const FINE_TUNE_PATTERNS = [
  /\bfine[- ]?tuning\b/,
  /\binstruction[- ]?tuning\b/,
  /\bsft\b/,
  /\bdpo\b/,
  /\bpreference data\b/,
  /\btraining dataset\b/,
  /\bsynthetic data\b/,
];

const CALLABLE_PATTERNS = [
  /\bcli\b/,
  /\bcommand line\b/,
  /\bapi\b/,
  /\bsdk\b/,
  /\blibrary\b/,
  /\bpackage\b/,
  /\bnpm\b/,
  /\bpip\b/,
];

const SYSTEM_LAYER_PATTERNS = [
  /\bworkflow\b/,
  /\brouting\b/,
  /\borchestrat(?:e|ion)\b/,
  /\bretrieval\b/,
  /\branking\b/,
  /\bcontext\b/,
  /\bmemory\b/,
  /\beval(?:uation)?\b/,
  /\bdashboard\b/,
  /\bprompt\b/,
];

const MEASUREMENT_PATTERNS = [
  /\bmeasure\b/,
  /\bbenchmark\b/,
  /\bab test\b/,
  /\bkill criteria\b/,
  /\brollback\b/,
  /\blatency\b/,
  /\bprecision\b/,
  /\brecall\b/,
];

const DOCS_ONLY_PATTERNS = [
  /\bguide\b/,
  /\btutorial\b/,
  /\breference\b/,
  /\bexplainer\b/,
  /\boverview\b/,
];

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function collectSourceText(source: EngineSourceItem): string {
  return [
    source.title,
    source.summary ?? "",
    source.missionAlignmentHint ?? "",
    ...(source.notes ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      (value.toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? []).filter((token) =>
        !STOPWORDS.has(token)
      ),
    ),
  );
}

function countMissionOverlap(input: SourceOperationalizationInput): number {
  const mission = input.mission;
  if (!mission) {
    return 0;
  }

  const missionTokens = new Set(
    tokenize(
      [
        mission.currentObjective ?? "",
        ...(mission.usefulnessSignals ?? []),
        ...(mission.capabilityLanes ?? []),
      ].join(" "),
    ),
  );
  if (missionTokens.size === 0) {
    return 0;
  }

  const sourceTokens = tokenize(
    [
      input.source.title,
      input.source.summary ?? "",
      input.source.missionAlignmentHint ?? "",
      ...(input.source.notes ?? []),
    ].join(" "),
  );
  return sourceTokens.filter((token) => missionTokens.has(token)).length;
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function deriveCommunitySignalScore(input: SourceOperationalizationInput): number {
  const signals = input.signals ?? {};
  let score = 0;

  const repoStars = Math.max(0, signals.repoStars ?? 0);
  if (repoStars >= 50000) {
    score = Math.max(score, 95);
  } else if (repoStars >= 10000) {
    score = Math.max(score, 85);
  } else if (repoStars >= 1000) {
    score = Math.max(score, 70);
  } else if (repoStars >= 100) {
    score = Math.max(score, 50);
  } else if (repoStars > 0) {
    score = Math.max(score, 30);
  }

  const citationCount = Math.max(0, signals.citationCount ?? 0);
  if (citationCount >= 1000) {
    score = Math.max(score, 90);
  } else if (citationCount >= 100) {
    score = Math.max(score, 75);
  } else if (citationCount >= 20) {
    score = Math.max(score, 55);
  } else if (citationCount > 0) {
    score = Math.max(score, 35);
  }

  const referenceCount = Math.max(0, signals.referenceCount ?? 0);
  if (referenceCount >= 20) {
    score = Math.max(score, 60);
  } else if (referenceCount >= 5) {
    score = Math.max(score, 40);
  } else if (referenceCount > 0) {
    score = Math.max(score, 20);
  }

  if (input.source.sourceType === "github-repo" && score === 0) {
    score = 15;
  }

  return clampScore(score);
}

function deriveHermesRelevanceScore(input: SourceOperationalizationInput, sourceText: string): number {
  let score = 0;
  const missionOverlap = countMissionOverlap(input);

  if (missionOverlap >= 4) {
    score += 35;
  } else if (missionOverlap === 3) {
    score += 28;
  } else if (missionOverlap === 2) {
    score += 22;
  } else if (missionOverlap === 1) {
    score += 12;
  }

  if (input.source.capabilityGapId) {
    score += 20;
  }
  if (input.source.missionAlignmentHint) {
    score += 12;
  }
  if (input.source.improvesDirectiveWorkspace) {
    score += 18;
  }
  if (input.source.containsWorkflowPattern) {
    score += 12;
  }
  if (input.source.primaryAdoptionTarget === "architecture") {
    score += 10;
  }
  if (input.source.primaryAdoptionTarget === "runtime") {
    score += 8;
  }
  if (input.source.workflowBoundaryShape === "bounded_protocol") {
    score += 8;
  }
  if (matchesAny(sourceText, SYSTEM_LAYER_PATTERNS)) {
    score += 10;
  }

  return clampScore(score);
}

function deriveActionabilityScore(
  input: SourceOperationalizationInput,
  sourceText: string,
  flags: {
    callableSurface: boolean;
    systemLayerCandidate: boolean;
    measurableExperiment: boolean;
    docsOnly: boolean;
    requiresModelTraining: boolean;
    fineTuneOnly: boolean;
    hasKillCriteria: boolean;
  },
): number {
  const signals = input.signals ?? {};
  let score = 0;

  if (flags.callableSurface) {
    score += 35;
  }
  if (signals.hasCallableCli) {
    score += 10;
  }
  if (signals.hasCallableApi) {
    score += 10;
  }
  if (signals.hasInstallablePackage) {
    score += 8;
  }
  if (input.source.containsExecutableCode) {
    score += 7;
  }
  if (signals.hasRunnableExample) {
    score += 8;
  }
  if (flags.systemLayerCandidate) {
    score += 25;
  }
  if (flags.measurableExperiment) {
    score += 15;
  }
  if (flags.hasKillCriteria) {
    score += 10;
  }
  if (input.source.workflowBoundaryShape === "bounded_protocol") {
    score += 8;
  }
  if (matchesAny(sourceText, CALLABLE_PATTERNS) && !flags.callableSurface) {
    score += 5;
  }
  if (flags.docsOnly) {
    score -= 15;
  }
  if (flags.requiresModelTraining) {
    score -= 35;
  }
  if (flags.fineTuneOnly) {
    score -= 20;
  }

  return clampScore(score);
}

function deriveNextArtifact(
  sourceId: string,
  decision: SourceOperationalizationDecision,
  noteTarget?: string | null,
): string {
  switch (decision) {
    case "capability_candidate":
      return `runtime/capabilities/${sourceId}`;
    case "architecture_experiment":
      return `architecture/experiments/${sourceId}`;
    case "fine_tune_later":
      return `discovery/backlog/fine-tune/${sourceId}`;
    case "training_lab_only":
      return `external/training-lab/${sourceId}`;
    case "note_only":
      return noteTarget?.trim() || `obsidian://sources/${sourceId}`;
    case "reject":
    default:
      return `discovery/rejected/${sourceId}`;
  }
}

function deriveClassification(decision: SourceOperationalizationDecision): string {
  switch (decision) {
    case "capability_candidate":
      return "callable capability candidate";
    case "architecture_experiment":
      return "local system-layer experiment";
    case "training_lab_only":
      return "model-training research only";
    case "fine_tune_later":
      return "fine-tune or dataset backlog item";
    case "note_only":
      return "reference or note-only source";
    case "reject":
    default:
      return "low-relevance rejected source";
  }
}

function deriveRecommendedLane(
  decision: SourceOperationalizationDecision,
): SourceOperationalizationRecommendedLane {
  switch (decision) {
    case "capability_candidate":
      return "runtime";
    case "architecture_experiment":
      return "architecture";
    case "note_only":
    case "training_lab_only":
      return "external";
    case "fine_tune_later":
    case "reject":
    default:
      return "discovery";
  }
}

export function deriveSourceOperationalizationDecision(
  input: SourceOperationalizationInput,
): SourceOperationalizationDecisionResult {
  const sourceText = collectSourceText(input.source);
  const signals = input.signals ?? {};
  const sourceId = input.source.sourceId?.trim() || input.source.sourceRef;

  const callableSurface =
    Boolean(input.source.containsExecutableCode) ||
    Boolean(signals.hasCallableCli) ||
    Boolean(signals.hasCallableApi) ||
    Boolean(signals.hasInstallablePackage) ||
    (
      input.source.sourceType === "github-repo" &&
      matchesAny(sourceText, CALLABLE_PATTERNS)
    );

  const systemLayerCandidate =
    Boolean(signals.localSystemPatchPossible) ||
    Boolean(signals.localWorkflowAdaptation) ||
    Boolean(input.source.improvesDirectiveWorkspace) ||
    Boolean(input.source.containsWorkflowPattern) ||
    input.source.primaryAdoptionTarget === "architecture" ||
    input.source.workflowBoundaryShape === "bounded_protocol" ||
    matchesAny(sourceText, SYSTEM_LAYER_PATTERNS);

  const hasKillCriteria =
    Boolean(signals.hasKillCriteria) ||
    Boolean(signals.experimentKillCriteria?.trim());

  const measurableExperiment =
    Boolean(signals.measurableExperiment) ||
    matchesAny(sourceText, MEASUREMENT_PATTERNS);

  const trainingSignalsPresent =
    Boolean(signals.requiresModelArchitectureChange) ||
    Boolean(signals.requiresPretraining) ||
    Boolean(signals.requiresTokenizerChange) ||
    Boolean(signals.requiresLargeScalePostTraining) ||
    matchesAny(sourceText, TRAINING_LAB_PATTERNS);

  const explicitLocalAdaptation = Boolean(signals.localWorkflowAdaptation);
  const requiresModelTraining = trainingSignalsPresent && !explicitLocalAdaptation;

  const fineTuneOnly =
    !requiresModelTraining &&
    (
      Boolean(signals.requiresFineTuningData) ||
      Boolean(signals.fineTuneOnly) ||
      matchesAny(sourceText, FINE_TUNE_PATTERNS)
    ) &&
    !systemLayerCandidate &&
    !callableSurface;

  const docsOnly =
    Boolean(signals.documentationOnly) ||
    (
      (input.source.sourceType === "product-doc" ||
        input.source.sourceType === "technical-essay" ||
        input.source.sourceType === "theory") &&
      !callableSurface &&
      !systemLayerCandidate &&
      !requiresModelTraining &&
      !fineTuneOnly
    ) ||
    (
      matchesAny(sourceText, DOCS_ONLY_PATTERNS) &&
      !callableSurface &&
      !systemLayerCandidate &&
      !requiresModelTraining &&
      !fineTuneOnly
    );

  const communitySignalScore = deriveCommunitySignalScore(input);
  const hermesRelevanceScore = deriveHermesRelevanceScore(input, sourceText);
  const actionabilityScore = deriveActionabilityScore(input, sourceText, {
    callableSurface,
    systemLayerCandidate,
    measurableExperiment,
    docsOnly,
    requiresModelTraining,
    fineTuneOnly,
    hasKillCriteria,
  });

  const lowSignalReject =
    hermesRelevanceScore < 25 &&
    communitySignalScore < 25 &&
    actionabilityScore < 25;

  const isCapabilityCandidate =
    !requiresModelTraining &&
    !fineTuneOnly &&
    callableSurface &&
    communitySignalScore >= 45 &&
    hermesRelevanceScore >= 35;

  const isArchitectureExperiment =
    !requiresModelTraining &&
    systemLayerCandidate &&
    measurableExperiment &&
    hasKillCriteria &&
    hermesRelevanceScore >= 40;

  let decision: SourceOperationalizationDecision;
  if (requiresModelTraining) {
    decision = "training_lab_only";
  } else if (fineTuneOnly && hermesRelevanceScore >= 30) {
    decision = "fine_tune_later";
  } else if (isCapabilityCandidate) {
    decision = "capability_candidate";
  } else if (isArchitectureExperiment) {
    decision = "architecture_experiment";
  } else if (docsOnly && hermesRelevanceScore >= 30) {
    decision = "note_only";
  } else if (lowSignalReject) {
    decision = "reject";
  } else if (hermesRelevanceScore >= 35 && actionabilityScore < 50) {
    decision = "note_only";
  } else {
    decision = "reject";
  }

  const rationaleFragments = [
    `Decision=${decision}.`,
    `Actionability ${actionabilityScore}/100, community signal ${communitySignalScore}/100, Hermes relevance ${hermesRelevanceScore}/100.`,
  ];

  if (requiresModelTraining) {
    rationaleFragments.push(
      "The source requires base-model training work such as model architecture, tokenizer, pretraining, or large-scale post-training changes.",
    );
  } else if (fineTuneOnly) {
    rationaleFragments.push(
      "The source is mainly a dataset or fine-tuning recipe and does not offer an immediate local system/workflow patch.",
    );
  } else if (isCapabilityCandidate) {
    rationaleFragments.push(
      "The source exposes a callable CLI/API/package surface with enough community signal to justify Runtime candidate follow-up.",
    );
  } else if (isArchitectureExperiment) {
    rationaleFragments.push(
      "The source supports a bounded local system-layer experiment with measurable evaluation and explicit kill criteria.",
    );
  } else if (docsOnly) {
    rationaleFragments.push(
      "The source is useful as explanation or reference material but lacks a callable tool surface or bounded experiment path.",
    );
  } else if (lowSignalReject) {
    rationaleFragments.push(
      "The source is too weak on relevance, actionability, and community signal to justify downstream work.",
    );
  }

  if (callableSurface) {
    rationaleFragments.push("Callable surface detected.");
  }
  if (systemLayerCandidate) {
    rationaleFragments.push("System-layer workflow relevance detected.");
  }
  if (measurableExperiment) {
    rationaleFragments.push("Measurable evaluation path detected.");
  }
  if (hasKillCriteria) {
    rationaleFragments.push("Kill criteria are present.");
  }
  if (signals.requiresExternalService) {
    rationaleFragments.push("External service dependency is required.");
  }

  const noteTarget = decision === "note_only"
    ? signals.noteTarget?.trim() || `obsidian://sources/${sourceId}`
    : undefined;
  const killCriteria = decision === "architecture_experiment"
    ? signals.experimentKillCriteria?.trim() || "Operator must define explicit kill criteria before implementation."
    : undefined;

  return {
    source_id: sourceId,
    source_type: input.source.sourceType,
    decision,
    classification: deriveClassification(decision),
    rationale: rationaleFragments.join(" "),
    actionability_score: actionabilityScore,
    community_signal_score: communitySignalScore,
    hermes_relevance_score: hermesRelevanceScore,
    requires_model_training: requiresModelTraining,
    requires_external_service: Boolean(signals.requiresExternalService),
    recommended_lane: deriveRecommendedLane(decision),
    next_artifact: deriveNextArtifact(sourceId, decision, noteTarget),
    ...(killCriteria ? { kill_criteria: killCriteria } : {}),
    ...(noteTarget ? { note_target: noteTarget } : {}),
  };
}
