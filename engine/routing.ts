import type {
  DirectiveEngineCapabilityGap,
  DirectiveEngineCapabilityGapPriority,
  DirectiveEngineMissionContext,
  DirectiveEngineRoutingAssessment,
  DirectiveEngineRoutingConfidence,
  DirectiveEngineRunRecord,
  DirectiveEngineSourceItem,
} from "./types.ts";
import type { DecisionPolicyEvent } from "./decision-policy-ledger.ts";
import type { RoutingCorrectionEntry } from "./routing-correction-ledger.ts";
import { deriveRoutingCorrectionAdjustments } from "./routing-correction-ledger.ts";
import {
  deriveDirectiveGapRadarAssessment,
  compileDirectiveGapRadarSuggestions,
} from "./gap-radar.ts";
import { deriveDirectiveEngineEarnedAutonomyAssessment } from "./earned-autonomy.ts";
import { createDirectiveSourceMemorySnapshot, deriveDirectiveSourceMemoryAssessment } from "./source-memory.ts";
import { deriveDirectiveSourceSimilarityAssessment } from "./source-similarity.ts";
import { deriveDirectiveMissionHealth } from "./mission-health.ts";
import { deriveDirectiveFollowUpQuestionSet } from "./follow-up-questions.ts";
import { deriveDirectiveSourceNarrativeContext } from "./source-narrative-threading.ts";

/**
 * Weighted keyword lists.  Each entry is [keyword, weight].
 *
 * Weight guidelines:
 *   3 = highly discriminative, almost never ambiguous across lanes
 *   2 = moderately discriminative
 *   1 = low-weight or shared with another lane (prevents double-counting inflation)
 *
 * Multi-word phrases are checked first (longer match wins), so
 * "runtime capability" scores as one phrase hit, not two singles.
 */
const DISCOVERY_KEYWORDS_WEIGHTED: Array<[string, number]> = [
  ["discovery intake", 3],
  ["front door", 3],
  ["intake queue", 3],
  ["review cadence", 3],
  ["discovery", 2],
  ["intake", 2],
  ["queue", 1],
  ["routing", 1],
  ["route", 1],
  ["monitor", 1],
  ["coverage", 1],
  ["gap", 1],
];

const ARCHITECTURE_KEYWORDS_WEIGHTED: Array<[string, number]> = [
  ["operating logic", 3],
  ["operating code", 3],
  ["self-improvement", 3],
  ["architecture", 2],
  ["contract", 2],
  ["schema", 2],
  ["policy", 2],
  ["workflow", 2],
  ["doctrine", 2],
  ["adaptation", 2],
  ["evaluation", 1],
  ["evaluator", 1],
  ["analysis", 1],
  ["structure", 1],
  ["engine", 1],
];

const RUNTIME_KEYWORDS_WEIGHTED: Array<[string, number]> = [
  ["runtime capability", 3],
  ["source-pack", 3],
  ["runtime", 2],
  ["callable", 3],
  ["skill", 2],
  ["automation", 2],
  ["latency", 1],
  ["performance", 1],
  ["cost", 1],
  ["reliability", 1],
  ["import", 1],
];

// Flat keyword lists kept for backward-compat with countKeywordHits callers
// (gap scoring, meta-usefulness, etc.) that don't need weighting.
const DISCOVERY_KEYWORDS = DISCOVERY_KEYWORDS_WEIGHTED.map(([kw]) => kw);
const ARCHITECTURE_KEYWORDS = ARCHITECTURE_KEYWORDS_WEIGHTED.map(([kw]) => kw);
const RUNTIME_KEYWORDS = RUNTIME_KEYWORDS_WEIGHTED.map(([kw]) => kw);

const TRANSFORMATION_KEYWORDS = [
  "transform",
  "transformation",
  "behavior-preserving",
  "faster",
  "slower",
  "latency",
  "cost",
  "reliability",
  "same behavior",
  "same capability",
  "better implementation",
  "maintainability",
];

const META_USEFULNESS_KEYWORDS = [
  "engine",
  "routing",
  "adaptation",
  "self-improvement",
  "evaluation",
  "proof",
  "schema",
  "contract",
  "policy",
];

const PATTERN_EXTRACTION_KEYWORDS = [
  "without adopting",
  "rather than direct runtime reuse",
  "not the library as a dependency",
  "not the library as dependency",
];

const RUNTIME_SOURCE_TYPES = new Set([
  "github-repo",
  "external-system",
]);

const STRUCTURAL_SOURCE_TYPES = new Set([
  "paper",
  "product-doc",
  "technical-essay",
  "workflow-writeup",
  "theory",
]);

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "into",
  "through",
  "when",
  "only",
  "have",
  "will",
  "would",
  "should",
  "about",
  "candidate",
  "current",
  "active",
  "mission",
  "source",
]);

const GENERIC_MISSION_TOKENS = new Set([
  "active",
  "better",
  "bounded",
  "capability",
  "current",
  "direction",
  "directive",
  "goal",
  "improve",
  "kernel",
  "product",
  "project",
  "system",
  "useful",
  "workspace",
]);

const GENERIC_GOAL_COPILOT_TOKENS = new Set([
  ...GENERIC_MISSION_TOKENS,
  "change",
  "changes",
  "clarity",
  "clearer",
  "confidence",
  "constraint",
  "constraints",
  "explicit",
  "focus",
  "goal",
  "goals",
  "guidance",
  "means",
  "matter",
  "objective",
  "provided",
  "quality",
  "result",
  "results",
  "review",
  "signal",
  "signals",
  "success",
  "target",
  "targets",
]);

const SEMANTIC_TOKEN_ALIASES: Record<string, string> = {
  adaptable: "adaptation",
  adapting: "adaptation",
  adapts: "adaptation",
  adapter: "integration",
  adapters: "integration",
  architecture: "architecture",
  automation: "runtime",
  automations: "runtime",
  callable: "runtime",
  callables: "runtime",
  contracts: "contract",
  discovery: "discovery",
  evaluator: "evaluation",
  evaluators: "evaluation",
  execution: "runtime",
  executions: "runtime",
  integrating: "integration",
  integration: "integration",
  integrations: "integration",
  orchestration: "workflow",
  phase: "workflow",
  phases: "workflow",
  pipeline: "workflow",
  pipelines: "workflow",
  process: "workflow",
  processes: "workflow",
  processing: "workflow",
  protocol: "workflow",
  protocols: "workflow",
  queueing: "queue",
  queues: "queue",
  route: "routing",
  routed: "routing",
  router: "routing",
  routing: "routing",
  runtime: "runtime",
  scoring: "evaluation",
  schema: "contract",
  schemas: "contract",
  structure: "architecture",
  structured: "architecture",
  structures: "architecture",
  verification: "proof",
  verify: "proof",
  workflow: "workflow",
  workflows: "workflow",
};

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function priorityWeight(priority: DirectiveEngineCapabilityGapPriority) {
  switch (priority) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function semanticTokenize(input: string) {
  return tokenize(input)
    .map((token) => SEMANTIC_TOKEN_ALIASES[token] ?? token)
    .filter(Boolean);
}

function countKeywordHits(text: string, keywords: string[]) {
  const lowered = text.toLowerCase();
  return keywords.reduce(
    (count, keyword) => count + (lowered.includes(keyword.toLowerCase()) ? 1 : 0),
    0,
  );
}

/**
 * Weighted keyword scoring with phrase priority and diminishing returns.
 *
 * 1. Phrases are checked longest-first so "runtime capability" consumes
 *    both words before the single-word "runtime" entry can also fire.
 * 2. Each match adds its weight to a raw total.
 * 3. The raw total is softened via sqrt scaling: `floor(sqrt(raw) * 3)`.
 *    This means the first few matches contribute strongly but repeating
 *    the same vocabulary gives diminishing returns.
 */
function countWeightedKeywordHits(
  text: string,
  weightedKeywords: Array<[string, number]>,
) {
  const lowered = text.toLowerCase();
  // Sort by phrase length descending so longer phrases match first.
  const sorted = [...weightedKeywords].sort(
    (a, b) => b[0].length - a[0].length,
  );
  let remaining = lowered;
  let rawScore = 0;
  for (const [keyword, weight] of sorted) {
    if (remaining.includes(keyword)) {
      rawScore += weight;
      // Remove the first occurrence to prevent double-counting with
      // sub-phrases (e.g. "runtime capability" vs "runtime").
      remaining = remaining.replace(keyword, " ");
    }
  }
  // Diminishing returns: sqrt scaling keeps first matches valuable
  // but prevents keyword-stuffing from inflating scores.
  return Math.floor(Math.sqrt(rawScore) * 3);
}

function countTokenOverlap(left: string, right: string) {
  const leftTokens = new Set(semanticTokenize(left));
  const rightTokens = new Set(semanticTokenize(right));
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap;
}

function deriveMissionObjectiveSpecificity(currentObjective: string) {
  if (/not provided/i.test(currentObjective)) {
    return 0;
  }
  return semanticTokenize(currentObjective)
    .filter((token) => !GENERIC_MISSION_TOKENS.has(token))
    .length;
}

function uniqueNormalizedStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function collectMissionSpecificTokens(mission: DirectiveEngineMissionContext) {
  return uniqueNormalizedStrings([
    ...semanticTokenize(mission.currentObjective),
    ...mission.usefulnessSignals.flatMap((signal) => semanticTokenize(signal)),
    ...mission.constraints.flatMap((constraint) => semanticTokenize(constraint)),
    ...mission.capabilityLanes.flatMap((lane) => semanticTokenize(lane)),
    ...semanticTokenize(mission.successSignal ?? ""),
    ...semanticTokenize(mission.adoptionTarget ?? ""),
  ])
    .filter((token) => token.length >= 4)
    .filter((token) => !GENERIC_GOAL_COPILOT_TOKENS.has(token));
}

function inferMissionFocusLane(mission: DirectiveEngineMissionContext) {
  if (
    mission.adoptionTarget === "architecture"
    || mission.adoptionTarget === "runtime"
    || mission.adoptionTarget === "discovery"
  ) {
    return mission.adoptionTarget;
  }

  const missionText = [
    mission.currentObjective,
    ...mission.usefulnessSignals,
    ...mission.constraints,
    mission.successSignal ?? "",
    ...mission.capabilityLanes,
  ].join(" ");

  const laneScores = {
    discovery: countWeightedKeywordHits(missionText, DISCOVERY_KEYWORDS_WEIGHTED),
    architecture: countWeightedKeywordHits(missionText, ARCHITECTURE_KEYWORDS_WEIGHTED),
    runtime: countWeightedKeywordHits(missionText, RUNTIME_KEYWORDS_WEIGHTED),
  };
  const winner = deriveRecommendedLane(laneScores);
  return laneScores[winner] > 0 ? winner : (mission.capabilityLanes[0]?.toLowerCase() || null);
}

function buildSuggestedObjective(input: {
  mission: DirectiveEngineMissionContext;
  focusLane: string | null;
}) {
  const tokens = collectMissionSpecificTokens(input.mission).slice(0, 4);
  const tokenPhrase = tokens.length > 0
    ? tokens.join(", ")
    : input.focusLane === "architecture"
      ? "routing quality, workflow boundaries, and evaluation policy"
      : input.focusLane === "runtime"
        ? "runtime capability boundaries, repeated execution value, and integration clarity"
        : "intake quality, routing clarity, and gap alignment";
  const lanePhrase = input.focusLane ? ` for the ${input.focusLane} lane` : "";
  return `Improve ${tokenPhrase}${lanePhrase} with one bounded, reviewable change.`;
}

function buildSuggestedUsefulnessSignals(input: {
  mission: DirectiveEngineMissionContext;
  focusLane: string | null;
}) {
  const existing = uniqueNormalizedStrings(input.mission.usefulnessSignals);
  const suggestions = [...existing];

  const defaults = input.focusLane === "architecture"
    ? [
        "Prefer Engine workflow, routing, evaluation, or policy improvements when the source improves Directive Workspace itself.",
        "Keep runtime reuse secondary unless repeated executable value is clearly dominant.",
      ]
    : input.focusLane === "runtime"
      ? [
          "Prefer repeated runtime capability only when the value survives as reusable execution or transformation.",
          "Keep Architecture work secondary unless the source primarily improves Directive Workspace itself.",
        ]
      : [
          "Prefer clearer intake, routing, and gap evidence when downstream lane ownership is still ambiguous.",
          "Keep the candidate in Discovery until one stronger lane signal is recorded explicitly.",
        ];

  for (const suggestion of defaults) {
    if (suggestions.length >= 3) {
      break;
    }
    if (!suggestions.some((entry) => entry.toLowerCase() === suggestion.toLowerCase())) {
      suggestions.push(suggestion);
    }
  }

  return suggestions.slice(0, 3);
}

function buildSuggestedConstraints(mission: DirectiveEngineMissionContext) {
  const existing = uniqueNormalizedStrings(mission.constraints);
  const suggestions = [...existing];

  const defaults = [
    {
      test: /\b(review|approval|human)\b/i,
      value: "Keep review explicit until the route is high-confidence and bounded.",
    },
    {
      test: /\b(bound|scope|single|one slice)\b/i,
      value: "Keep the next change to one bounded slice.",
    },
    {
      test: /\b(rollback|revers|undo)\b/i,
      value: "Stay reversible and keep the rollback boundary explicit.",
    },
  ];

  for (const item of defaults) {
    if (suggestions.some((entry) => item.test.test(entry))) {
      continue;
    }
    suggestions.push(item.value);
  }

  return suggestions.slice(0, 3);
}

function buildSuggestedCapabilityLanes(input: {
  mission: DirectiveEngineMissionContext;
  focusLane: string | null;
}) {
  const normalized = uniqueNormalizedStrings(
    input.mission.capabilityLanes.map((lane) => lane.toLowerCase()),
  );
  const allowed = normalized.filter((lane) =>
    lane === "discovery" || lane === "architecture" || lane === "runtime"
  );

  if (!input.focusLane) {
    return allowed.slice(0, 3);
  }

  const ordered = [
    input.focusLane,
    ...allowed.filter((lane) => lane !== input.focusLane),
  ];
  return uniqueNormalizedStrings(ordered).slice(0, 3);
}

function deriveGoalCopilotAssessment(mission: DirectiveEngineMissionContext) {
  const objectiveSpecificity = deriveMissionObjectiveSpecificity(mission.currentObjective);
  const objectiveSpecificityScore = clampInt(
    objectiveSpecificity >= 4 ? 5 : objectiveSpecificity,
    0,
    5,
  );
  const usefulnessSignals = uniqueNormalizedStrings(mission.usefulnessSignals);
  const usefulSignalSpecificityCount = usefulnessSignals.filter((signal) =>
    semanticTokenize(signal)
      .filter((token) => !GENERIC_GOAL_COPILOT_TOKENS.has(token))
      .length >= 2
  ).length;
  const usefulnessSignalQualityScore = clampInt(
    (usefulnessSignals.length > 0 ? 1 : 0)
      + (usefulnessSignals.length >= 2 ? 1 : 0)
      + (usefulSignalSpecificityCount > 0 ? 1 : 0)
      + (usefulSignalSpecificityCount >= 2 ? 1 : 0)
      + (
        usefulnessSignals.some((signal) =>
          countWeightedKeywordHits(
            signal,
            DISCOVERY_KEYWORDS_WEIGHTED,
          )
          + countWeightedKeywordHits(signal, ARCHITECTURE_KEYWORDS_WEIGHTED)
          + countWeightedKeywordHits(signal, RUNTIME_KEYWORDS_WEIGHTED) > 0
        )
          ? 1
          : 0
      ),
    0,
    5,
  );
  const constraints = uniqueNormalizedStrings(mission.constraints);
  const constraintQualityScore = clampInt(
    (constraints.length > 0 ? 1 : 0)
      + (constraints.length >= 2 ? 1 : 0)
      + (
        constraints.some((constraint) =>
          /\b(keep|stay|avoid|require|preserve|limit|do not|never|only)\b/i.test(constraint)
        )
          ? 1
          : 0
      )
      + (
        constraints.some((constraint) =>
          /\b(bound|review|rollback|revers|scope|explicit|execute|automation|host)\b/i.test(constraint)
        )
          ? 1
          : 0
      )
      + (
        constraints.some((constraint) =>
          semanticTokenize(constraint)
            .filter((token) => !GENERIC_GOAL_COPILOT_TOKENS.has(token))
            .length >= 1
        )
          ? 1
          : 0
      ),
    0,
    5,
  );
  const normalizedLanes = uniqueNormalizedStrings(
    mission.capabilityLanes.map((lane) => lane.toLowerCase()),
  ).filter((lane) => lane === "discovery" || lane === "architecture" || lane === "runtime");
  const focusLane = inferMissionFocusLane(mission);
  const laneClarityScore = clampInt(
    (normalizedLanes.length > 0 ? 1 : 0)
      + (normalizedLanes.length === 1 ? 2 : 0)
      + (
        focusLane !== null && mission.adoptionTarget && mission.adoptionTarget === focusLane
          ? 1
          : 0
      )
      + (
        focusLane !== null && normalizedLanes[0] === focusLane
          ? 1
          : 0
      )
      + (
        normalizedLanes.length === 2 && !mission.adoptionTarget
          ? 1
          : 0
      ),
    0,
    5,
  );
  const overallScore = clampInt(
    (
      objectiveSpecificityScore
      + usefulnessSignalQualityScore
      + constraintQualityScore
      + laneClarityScore
    ) * 5,
    0,
    100,
  );

  const warnings: string[] = [];
  const rationale: string[] = [];

  if (objectiveSpecificityScore <= 1) {
    warnings.push("Current objective is too generic to guide routing reliably.");
  }
  if (usefulnessSignalQualityScore <= 2) {
    warnings.push("Usefulness signals are too sparse or generic; the Engine lacks a strong definition of what 'useful' means right now.");
  }
  if (constraintQualityScore <= 2) {
    warnings.push("Constraints are missing or too weak; the goal does not explain how the next change must stay bounded.");
  }
  if (normalizedLanes.length === 0) {
    warnings.push("Capability lanes are missing, so the mission does not state where value should land.");
  } else if (normalizedLanes.length === 3 && !mission.adoptionTarget) {
    warnings.push("Capability lanes list every lane without an explicit dominant target, which leaves lane ownership overly ambiguous.");
  }
  if (!mission.successSignal) {
    warnings.push("Success signal is missing, so the system has no explicit definition of what improvement would count as enough.");
  }

  rationale.push(
    `Goal Copilot scored objective specificity ${objectiveSpecificityScore}/5, usefulness signals ${usefulnessSignalQualityScore}/5, constraints ${constraintQualityScore}/5, and lane clarity ${laneClarityScore}/5.`,
  );
  if (mission.adoptionTarget) {
    rationale.push(
      `Mission adoption target is set to ${mission.adoptionTarget}, which improves lane clarity when it matches the actual goal focus.`,
    );
  }

  return {
    overallScore,
    objectiveSpecificityScore,
    usefulnessSignalQualityScore,
    constraintQualityScore,
    laneClarityScore,
    warnings,
    rationale,
    suggestedObjective: overallScore >= 85 ? null : buildSuggestedObjective({
      mission,
      focusLane,
    }),
    suggestedConstraints: buildSuggestedConstraints(mission),
    suggestedUsefulnessSignals: buildSuggestedUsefulnessSignals({
      mission,
      focusLane,
    }),
    suggestedCapabilityLanes: buildSuggestedCapabilityLanes({
      mission,
      focusLane,
    }),
  };
}

function deriveConfidenceRecovery(input: {
  source: DirectiveEngineSourceItem;
  mission: DirectiveEngineMissionContext;
  missionFit: number;
  missionSpecificityWarning: string | null;
  recommendedLaneId: "discovery" | "architecture" | "runtime";
  confidence: DirectiveEngineRoutingConfidence;
  routeConflict: boolean;
  matchedGap: DirectiveEngineCapabilityGap | null;
  openGaps: DirectiveEngineCapabilityGap[];
  conflictingLaneIds: Array<"discovery" | "architecture" | "runtime">;
  goalCopilot: ReturnType<typeof deriveGoalCopilotAssessment>;
}) {
  const runtimeInPlay =
    input.recommendedLaneId === "runtime" || input.conflictingLaneIds.includes("runtime");
  const architectureInPlay =
    input.recommendedLaneId === "architecture" || input.conflictingLaneIds.includes("architecture");
  const goalNeedsFollowUp =
    Boolean(input.missionSpecificityWarning)
    || input.goalCopilot.overallScore < 60
    || input.goalCopilot.objectiveSpecificityScore <= 1
    || input.goalCopilot.usefulnessSignalQualityScore <= 1
    || input.goalCopilot.constraintQualityScore <= 1
    || input.goalCopilot.laneClarityScore <= 2;
  const requestedInputs: Array<{
    field: string;
    question: string;
    whyItMatters: string;
    exampleAnswer: string | null;
  }> = [];

  const pushRequest = (request: {
    field: string;
    question: string;
    whyItMatters: string;
    exampleAnswer: string | null;
  }) => {
    if (requestedInputs.some((entry) => entry.field === request.field)) {
      return;
    }
    requestedInputs.push(request);
  };

  if (goalNeedsFollowUp) {
    if (input.missionSpecificityWarning || input.goalCopilot.objectiveSpecificityScore <= 1) {
      pushRequest({
        field: "mission.currentObjective",
        question: "Rewrite the mission objective with 2-3 concrete capability nouns instead of generic improvement language.",
        whyItMatters: "Generic mission text over-matches everything and keeps routing confidence artificially low.",
        exampleAnswer: input.goalCopilot.suggestedObjective,
      });
    }
    if (input.goalCopilot.usefulnessSignalQualityScore <= 1) {
      pushRequest({
        field: "mission.usefulnessSignals",
        question: "List 1-2 concrete usefulness signals that say what 'better' means for this mission.",
        whyItMatters: "Specific usefulness signals sharpen mission-fit and make downstream triage less subjective.",
        exampleAnswer: input.goalCopilot.suggestedUsefulnessSignals[0] ?? null,
      });
    }
    if (input.goalCopilot.constraintQualityScore <= 1) {
      pushRequest({
        field: "mission.constraints",
        question: "Add 1-3 explicit constraints that keep the next change bounded, reviewable, and reversible.",
        whyItMatters: "Constraints stop the mission from rewarding broad but unsafe changes.",
        exampleAnswer: input.goalCopilot.suggestedConstraints[0] ?? null,
      });
    }
    if (!input.mission.successSignal) {
      pushRequest({
        field: "mission.successSignal",
        question: "What observable outcome would count as a sufficient improvement for this mission?",
        whyItMatters: "An explicit success signal helps the Engine distinguish meaningful progress from generic relevance.",
        exampleAnswer: "One bounded routing decision becomes materially clearer and requires less manual review.",
      });
    }
    if (
      input.goalCopilot.laneClarityScore <= 2
      && !input.mission.adoptionTarget
      && input.goalCopilot.suggestedCapabilityLanes.length > 0
    ) {
      pushRequest({
        field: "mission.adoptionTarget",
        question: "Which lane should be treated as the default owner when the source matches this mission most strongly?",
        whyItMatters: "A default mission-level owner reduces avoidable cross-lane ambiguity before source metadata is available.",
        exampleAnswer: input.goalCopilot.suggestedCapabilityLanes[0] ?? null,
      });
    }
  }

  if (input.routeConflict || input.confidence === "low") {
    if (!input.source.primaryAdoptionTarget) {
      pushRequest({
        field: "source.primaryAdoptionTarget",
        question: "If you had to choose one owner now, should this land in Discovery, Architecture, or Runtime?",
        whyItMatters: "Explicit ownership metadata is the strongest structured routing signal and breaks many lane ties immediately.",
        exampleAnswer: architectureInPlay ? "architecture" : runtimeInPlay ? "runtime" : "discovery",
      });
    }
    if (runtimeInPlay && input.source.containsExecutableCode == null) {
      pushRequest({
        field: "source.containsExecutableCode",
        question: "Does the source contain executable code or a repeated operational mechanism that should become reusable runtime capability?",
        whyItMatters: "Executable repeated value is the cleanest separator between Runtime and non-Runtime routes.",
        exampleAnswer: "true - includes callable code that should be reused",
      });
    }
    if (architectureInPlay && input.source.improvesDirectiveWorkspace == null) {
      pushRequest({
        field: "source.improvesDirectiveWorkspace",
        question: "Is the primary value improving Directive Workspace itself rather than a host/runtime capability?",
        whyItMatters: "This is the strongest structured signal for Architecture ownership.",
        exampleAnswer: "true - improves routing, evaluation, or workflow logic",
      });
    }
    if (input.source.containsWorkflowPattern === true && !input.source.workflowBoundaryShape) {
      pushRequest({
        field: "source.workflowBoundaryShape",
        question: "Is the workflow value a bounded protocol or an iterative loop?",
        whyItMatters: "Boundary shape helps distinguish Architecture workflow logic from generic automation wording.",
        exampleAnswer: "bounded_protocol",
      });
    }
    if (!input.matchedGap && !input.source.capabilityGapId && input.openGaps.length > 0) {
      pushRequest({
        field: "source.capabilityGapId",
        question: "Which currently open capability gap does this source close most directly?",
        whyItMatters: "Explicit gap alignment often resolves low-confidence ties without adding more prose.",
        exampleAnswer: input.openGaps[0]?.gapId ?? null,
      });
    }
    if (!input.source.missionAlignmentHint || input.missionFit <= 1) {
      pushRequest({
        field: "source.missionAlignmentHint",
        question: "Give one sentence that ties this source directly to the current mission objective.",
        whyItMatters: "A crisp mission-alignment sentence raises mission-fit and reduces generic over-match.",
        exampleAnswer:
          "This improves directive workspace routing quality by clarifying bounded architecture ownership.",
      });
    }
  }

  if (requestedInputs.length === 0) {
    return null;
  }

  const summary = input.routeConflict
    ? "Answer one or two structured follow-up questions to break the current lane conflict."
    : input.missionSpecificityWarning
      ? "Sharpen the mission and one ownership signal so this route is backed by explicit, non-generic intent."
      : goalNeedsFollowUp
        ? "Fill the highest-leverage mission gaps so this route is supported by stronger explicit intent."
      : "Add one or two explicit structured signals to raise routing confidence.";
  const confidenceLift = input.routeConflict
    ? "Likely to resolve the current lane disagreement."
    : goalNeedsFollowUp && input.confidence !== "low"
      ? "Likely to harden this route by replacing weak goal inputs with explicit intent."
    : input.recommendedLaneId === "discovery"
      ? "Likely to move this from Discovery hold to a bounded lane recommendation."
      : "Likely to move this from low-confidence review to a clearer bounded route.";

  return {
    summary,
    confidenceLift,
    requestedInputs: requestedInputs.slice(0, 3),
  };
}

function flattenSourceText(source: DirectiveEngineSourceItem) {
  return [
    source.title,
    source.sourceRef,
    source.missionAlignmentHint ?? "",
    source.summary ?? "",
    source.improvesDirectiveWorkspace ? "improves directive workspace itself engine self-improvement" : "",
    source.workflowBoundaryShape ? `workflow boundary shape ${source.workflowBoundaryShape}` : "",
    ...(source.notes ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function sortOpenGaps(openGaps: DirectiveEngineCapabilityGap[]) {
  return [...openGaps]
    .filter((gap) => !gap.resolvedAt)
    .sort((left, right) => {
      const priorityDelta = priorityWeight(right.priority) - priorityWeight(left.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const detectedDelta = left.detectedAt.localeCompare(right.detectedAt);
      if (detectedDelta !== 0) {
        return detectedDelta;
      }
      return left.gapId.localeCompare(right.gapId);
    });
}

function buildGapText(gap: DirectiveEngineCapabilityGap) {
  return [
    gap.gapId,
    gap.description,
    gap.relatedMissionObjective,
    gap.currentState,
    gap.desiredState,
    gap.resolutionNotes ?? "",
  ].join(" ");
}

function deriveStructuredGapAlignmentScore(input: {
  source: DirectiveEngineSourceItem;
  gap: DirectiveEngineCapabilityGap;
}) {
  const gapText = buildGapText(input.gap);
  const discoveryGapSignal = countKeywordHits(gapText, DISCOVERY_KEYWORDS);
  const architectureGapSignal =
    countKeywordHits(gapText, ARCHITECTURE_KEYWORDS)
    + countKeywordHits(gapText, META_USEFULNESS_KEYWORDS);
  const runtimeGapSignal =
    countKeywordHits(gapText, RUNTIME_KEYWORDS)
    + countKeywordHits(gapText, TRANSFORMATION_KEYWORDS);

  let score = 0;

  if (input.source.primaryAdoptionTarget === "discovery" && discoveryGapSignal > 0) {
    score += 5;
  }
  if (input.source.primaryAdoptionTarget === "architecture" && architectureGapSignal > 0) {
    score += 5;
  }
  if (input.source.primaryAdoptionTarget === "runtime" && runtimeGapSignal > 0) {
    score += 5;
  }
  if (input.source.improvesDirectiveWorkspace && architectureGapSignal > 0) {
    score += 6;
  }
  if (input.source.workflowBoundaryShape && architectureGapSignal > 0) {
    score += 4;
  }
  if (input.source.containsExecutableCode && runtimeGapSignal > 0) {
    score += 3;
  }
  if (input.source.containsWorkflowPattern && (architectureGapSignal > 0 || runtimeGapSignal > 0)) {
    score += 2;
  }

  return score;
}

function findMatchedGap(input: {
  source: DirectiveEngineSourceItem;
  openGaps: DirectiveEngineCapabilityGap[];
  sourceText: string;
}) {
  const rankedGaps = sortOpenGaps(input.openGaps);

  if (input.source.capabilityGapId) {
    const directIndex = rankedGaps.findIndex((gap) => gap.gapId === input.source.capabilityGapId);
    if (directIndex >= 0) {
      return {
        gap: rankedGaps[directIndex] ?? null,
        rank: directIndex + 1,
        structuredSignalScore: 0,
        directReference: true,
      };
    }
  }

  let bestGap: DirectiveEngineCapabilityGap | null = null;
  let bestRank: number | null = null;
  let bestScore = 0;
  let bestStructuredSignalScore = 0;

  rankedGaps.forEach((gap, index) => {
    const overlap = countTokenOverlap(input.sourceText, buildGapText(gap));
    const structuredSignalScore = deriveStructuredGapAlignmentScore({
      source: input.source,
      gap,
    });
    const score = overlap + structuredSignalScore;
    if (score > bestScore) {
      bestScore = score;
      bestGap = gap;
      bestRank = index + 1;
      bestStructuredSignalScore = structuredSignalScore;
    }
  });

  if (bestScore < 3) {
    return {
      gap: null,
      rank: null,
      structuredSignalScore: 0,
      directReference: false,
    };
  }

  return {
    gap: bestGap,
    rank: bestRank,
    structuredSignalScore: bestStructuredSignalScore,
    directReference: false,
  };
}

function deriveMissionFit(
  source: DirectiveEngineSourceItem,
  sourceText: string,
  mission: DirectiveEngineMissionContext,
) {
  const objectiveSpecificity = deriveMissionObjectiveSpecificity(mission.currentObjective);
  const objectiveOverlap = countTokenOverlap(sourceText, mission.currentObjective);
  const usefulnessOverlap = mission.usefulnessSignals.reduce(
    (score, signal) => score + countTokenOverlap(sourceText, signal),
    0,
  );
  const laneOverlap = mission.capabilityLanes.reduce(
    (score, lane) => score + countTokenOverlap(sourceText, lane),
    0,
  );
  const structuredMissionBoost =
    (source.primaryAdoptionTarget
      && mission.capabilityLanes.some((lane) =>
        countTokenOverlap(source.primaryAdoptionTarget ?? "", lane) > 0
      )
      ? 1
      : 0)
    + (
      source.improvesDirectiveWorkspace === true
      && mission.usefulnessSignals.some((signal) =>
        countTokenOverlap("engine routing evaluation adaptation workflow", signal) > 0
      )
        ? 1
        : 0
    );
  const weightedObjectiveOverlap =
    objectiveSpecificity === 0
      ? 0
      : objectiveSpecificity === 1
        ? Math.min(objectiveOverlap, 1)
        : objectiveSpecificity === 2
          ? Math.min(objectiveOverlap, 2)
          : objectiveOverlap;

  return clampInt(
    weightedObjectiveOverlap + usefulnessOverlap + laneOverlap + structuredMissionBoost,
    0,
    5,
  );
}

function deriveLaneScores(input: {
  source: DirectiveEngineSourceItem;
  sourceText: string;
  matchedGap: DirectiveEngineCapabilityGap | null;
}) {
  const discoverySignal = countWeightedKeywordHits(input.sourceText, DISCOVERY_KEYWORDS_WEIGHTED);
  const architectureSignal = countWeightedKeywordHits(input.sourceText, ARCHITECTURE_KEYWORDS_WEIGHTED);
  const baseRuntimeSignal = countWeightedKeywordHits(input.sourceText, RUNTIME_KEYWORDS_WEIGHTED);
  const metaUsefulnessSignal = countKeywordHits(input.sourceText, META_USEFULNESS_KEYWORDS);
  const patternExtractionSignal = countKeywordHits(
    input.sourceText,
    PATTERN_EXTRACTION_KEYWORDS,
  );
  const transformationSignal = countKeywordHits(input.sourceText, TRANSFORMATION_KEYWORDS);
  const runtimeSignal =
    baseRuntimeSignal +
    (RUNTIME_SOURCE_TYPES.has(input.source.sourceType) ? 2 : 0);
  const structuralSignal =
    architectureSignal +
    (STRUCTURAL_SOURCE_TYPES.has(input.source.sourceType) ? 1 : 0);
  const matchedGapText = input.matchedGap
    ? [
      input.matchedGap.gapId,
      input.matchedGap.description,
      input.matchedGap.relatedMissionObjective,
      input.matchedGap.currentState,
      input.matchedGap.desiredState,
    ].join(" ")
    : "";

  const matchedGapDiscoverySignal = countKeywordHits(matchedGapText, DISCOVERY_KEYWORDS);
  const matchedGapArchitectureSignal = countKeywordHits(matchedGapText, ARCHITECTURE_KEYWORDS);
  const matchedGapRuntimeSignal =
    countKeywordHits(matchedGapText, RUNTIME_KEYWORDS)
    + countKeywordHits(matchedGapText, TRANSFORMATION_KEYWORDS);
  const runtimeOverreadCorrectionEligible =
    RUNTIME_SOURCE_TYPES.has(input.source.sourceType) &&
    patternExtractionSignal > 0 &&
    metaUsefulnessSignal > 0 &&
    transformationSignal === 0;
  const discoveryArchitectureCorrectionEligible =
    STRUCTURAL_SOURCE_TYPES.has(input.source.sourceType) &&
    transformationSignal === 0 &&
    metaUsefulnessSignal > 0 &&
    (
      input.source.containsWorkflowPattern === true
      || input.source.improvesDirectiveWorkspace === true
      || patternExtractionSignal > 0
    );
  const discoveryBoundaryPenalty = discoveryArchitectureCorrectionEligible
    ? 2 + Math.min(metaUsefulnessSignal, 2)
    : 0;
  const architectureBoundaryBonus = discoveryArchitectureCorrectionEligible
    ? 2
      + Math.min(metaUsefulnessSignal, 2)
      + (input.source.containsWorkflowPattern ? 1 : 0)
      + (input.source.improvesDirectiveWorkspace ? 1 : 0)
    : 0;
  const metadataRuntimeSignal =
    (input.source.primaryAdoptionTarget === "runtime" ? 6 : 0)
    + (input.source.containsExecutableCode ? 3 : 0)
    + (input.source.containsExecutableCode && input.source.containsWorkflowPattern ? 1 : 0)
    + (
      input.source.workflowBoundaryShape !== null
      && input.source.workflowBoundaryShape !== undefined
      && !input.source.improvesDirectiveWorkspace
        ? 1
        : 0
    );
  const metadataArchitectureSignal =
    (input.source.primaryAdoptionTarget === "architecture" ? 6 : 0)
    + (input.source.containsWorkflowPattern && !input.source.containsExecutableCode ? 3 : 0)
    + (input.source.improvesDirectiveWorkspace ? 5 : 0)
    + (
      input.source.workflowBoundaryShape !== null
      && input.source.workflowBoundaryShape !== undefined
        ? 2
        : 0
    )
    + (
      input.source.improvesDirectiveWorkspace
      && input.source.containsExecutableCode
        ? 1
        : 0
    );
  const metadataDiscoverySignal =
    input.source.primaryAdoptionTarget === "discovery" ? 6 : 0;

  const keywordLaneScores = {
    discovery: Math.max(
      0,
      discoverySignal +
        (input.source.sourceType === "internal-signal" ? 2 : 0) -
        discoveryBoundaryPenalty,
    ),
    architecture:
      structuralSignal +
      (runtimeOverreadCorrectionEligible ? patternExtractionSignal * 4 : 0) +
      architectureBoundaryBonus,
    runtime:
      runtimeSignal +
      transformationSignal * 2 -
      (runtimeOverreadCorrectionEligible ? patternExtractionSignal * 3 : 0),
  };
  const metadataLaneScores = {
    discovery: metadataDiscoverySignal,
    architecture: metadataArchitectureSignal,
    runtime: metadataRuntimeSignal,
  };
  const gapLaneScores = {
    discovery: matchedGapDiscoverySignal * 2,
    architecture: matchedGapArchitectureSignal * 2,
    runtime: matchedGapRuntimeSignal * 2,
  };
  const laneScores = {
    discovery:
      keywordLaneScores.discovery +
      metadataLaneScores.discovery +
      gapLaneScores.discovery,
    architecture:
      keywordLaneScores.architecture +
      metadataLaneScores.architecture +
      gapLaneScores.architecture,
    runtime:
      keywordLaneScores.runtime +
      metadataLaneScores.runtime +
      gapLaneScores.runtime,
  };

  return {
    laneScores,
    keywordLaneScores,
    metadataLaneScores,
    gapLaneScores,
    metaUsefulnessSignal: clampInt(metaUsefulnessSignal, 0, 5),
    patternExtractionSignal: clampInt(patternExtractionSignal, 0, 5),
    transformationSignal: clampInt(transformationSignal, 0, 5),
    runtimeSignal: clampInt(runtimeSignal, 0, 5),
    discoveryArchitectureCorrectionEligible,
    discoveryBoundaryPenalty,
    architectureBoundaryBonus,
  };
}

function deriveRecommendedLane(
  laneScores: Record<"discovery" | "architecture" | "runtime", number>,
) {
  return (Object.entries(laneScores).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0]?.[0] ?? "discovery") as "discovery" | "architecture" | "runtime";
}

function rankLaneScores(
  laneScores: Record<"discovery" | "architecture" | "runtime", number>,
) {
  return Object.entries(laneScores)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    }) as Array<["discovery" | "architecture" | "runtime", number]>;
}

function deriveLaneProportions(
  laneScores: Record<"discovery" | "architecture" | "runtime", number>,
) {
  const total = Object.values(laneScores).reduce((sum, score) => sum + Math.max(0, score), 0);
  if (total <= 0) {
    return {
      discovery: 34,
      architecture: 33,
      runtime: 33,
    };
  }
  const raw = {
    discovery: Math.round((Math.max(0, laneScores.discovery) / total) * 100),
    architecture: Math.round((Math.max(0, laneScores.architecture) / total) * 100),
    runtime: Math.round((Math.max(0, laneScores.runtime) / total) * 100),
  };
  const sum = raw.discovery + raw.architecture + raw.runtime;
  if (sum === 100) {
    return raw;
  }
  const winner = deriveRecommendedLane(laneScores);
  raw[winner] += 100 - sum;
  return raw;
}

function deriveAmbiguityPenalty(
  laneScores: Record<"discovery" | "architecture" | "runtime", number>,
) {
  const sortedScores = Object.values(laneScores).sort((left, right) => right - left);
  if (sortedScores.length < 2) {
    return 0;
  }
  const difference = sortedScores[0] - sortedScores[1];
  if (difference >= 4) return 0;
  if (difference >= 2) return 1;
  return 2;
}

function deriveConfidence(
  topLaneScore: number,
  ambiguityPenalty: number,
  routeConflict: boolean,
): DirectiveEngineRoutingConfidence {
  if (!routeConflict && ambiguityPenalty === 0 && topLaneScore >= 8) {
    return "high";
  }
  if (ambiguityPenalty <= 1 && topLaneScore >= 5) {
    return "medium";
  }
  return "low";
}

function deriveSignalWinner(
  laneScores: Record<"discovery" | "architecture" | "runtime", number>,
  minimumScore = 2,
) {
  const ranked = rankLaneScores(laneScores);
  if ((ranked[0]?.[1] ?? 0) < minimumScore) {
    return null;
  }
  return ranked[0]?.[0] ?? null;
}

function deriveRecommendedRecordShape(input: {
  recommendedLaneId: "discovery" | "architecture" | "runtime";
  confidence: DirectiveEngineRoutingConfidence;
  matchedGap: DirectiveEngineCapabilityGap | null;
  routeConflict: boolean;
  source: DirectiveEngineSourceItem;
  metaUsefulnessSignal: number;
  patternExtractionSignal: number;
  transformationSignal: number;
  runtimeSignal: number;
  discoveryArchitectureCorrectionEligible: boolean;
}) {
  if (input.confidence === "high" && input.matchedGap) {
    if (input.recommendedLaneId === "architecture") {
      return "split_case";
    }
    return "fast_path";
  }

  if (
    input.recommendedLaneId === "architecture" &&
    input.confidence === "high" &&
    !input.routeConflict &&
    (
      input.source.improvesDirectiveWorkspace === true ||
      input.source.containsWorkflowPattern === true ||
      input.source.workflowBoundaryShape !== null && input.source.workflowBoundaryShape !== undefined ||
      input.metaUsefulnessSignal > 0 ||
      input.patternExtractionSignal > 0 ||
      input.discoveryArchitectureCorrectionEligible
    )
  ) {
    return "split_case";
  }

  if (
    input.recommendedLaneId === "runtime" &&
    input.confidence === "high" &&
    !input.routeConflict &&
    (
      input.source.primaryAdoptionTarget === "runtime" ||
      input.source.containsExecutableCode === true ||
      input.transformationSignal > 0 ||
      input.runtimeSignal > 0
    )
  ) {
    return "fast_path";
  }

  if (input.routeConflict) {
    if (input.recommendedLaneId === "architecture") {
      return "split_case";
    }
    if (input.recommendedLaneId === "runtime") {
      return "queue_only";
    }
  }

  if (input.confidence === "medium" && input.recommendedLaneId !== "discovery") {
    return "fast_path";
  }

  return "queue_only";
}

function shouldFallbackLowConfidenceRouteToDiscovery(input: {
  confidence: DirectiveEngineRoutingConfidence;
  matchedGap: DirectiveEngineCapabilityGap | null;
  source: DirectiveEngineSourceItem;
}) {
  const hasExplicitOwnershipSignal =
    input.source.primaryAdoptionTarget != null
    || input.source.improvesDirectiveWorkspace === true
    || input.source.workflowBoundaryShape != null;
  return input.confidence === "low" && input.matchedGap === null && !hasExplicitOwnershipSignal;
}

function deriveReviewGuidance(input: {
  recommendedLaneId: "discovery" | "architecture" | "runtime";
  confidence: DirectiveEngineRoutingConfidence;
  matchedGap: DirectiveEngineCapabilityGap | null;
  routeConflict: boolean;
  needsHumanReview: boolean;
  recommendedRecordShape: string;
  confidenceRecoverySummary?: string | null;
}) {
  if (input.routeConflict && input.recommendedLaneId === "architecture") {
    return {
      guidanceKind: "conflicted_architecture_review" as const,
      summary: "Conflicted Architecture route requires explicit structural review before downstream adoption.",
      operatorAction:
        `Review the competing Runtime-vs-Architecture signals, confirm Architecture ownership explicitly, and keep the fuller split-case record until the conflict is resolved.${input.confidenceRecoverySummary ? ` ${input.confidenceRecoverySummary}` : ""}`,
      requiredChecks: [
        "Confirm why Architecture still owns the candidate despite the competing Runtime signal.",
        "Record why the alternative lane was rejected before any downstream adoption step.",
        "Keep the split-case structural record explicit during review.",
        ...(input.confidenceRecoverySummary
          ? ["Capture the requested confidence-recovery inputs before rerouting."]
          : []),
      ],
      stopLine:
        "Do not treat this as a fast-path Architecture adoption or open downstream Runtime follow-through until the conflict is explicitly resolved.",
    };
  }

  if (input.routeConflict && input.recommendedLaneId === "runtime") {
    return {
      guidanceKind: "conflicted_runtime_review" as const,
      summary: "Conflicted Runtime route requires explicit review before any bounded Runtime follow-up opens.",
      operatorAction:
        `Review the competing signals, confirm Runtime ownership explicitly, and keep the case queue-only until that review is recorded.${input.confidenceRecoverySummary ? ` ${input.confidenceRecoverySummary}` : ""}`,
      requiredChecks: [
        "Confirm why Runtime still owns the candidate despite the competing lane signal.",
        "Record why the alternative lane was rejected before opening follow-up.",
        "Keep the case queue-only until review completes.",
        ...(input.confidenceRecoverySummary
          ? ["Capture the requested confidence-recovery inputs before rerouting."]
          : []),
      ],
      stopLine:
        "Do not open fast-path Runtime follow-through while the route conflict remains unresolved.",
    };
  }

  if (input.needsHumanReview && input.recommendedLaneId === "discovery" && input.confidence === "low") {
    return {
      guidanceKind: "low_confidence_discovery_hold" as const,
      summary: "Low-confidence route stays in Discovery until routing clarity improves.",
      operatorAction:
        `Keep the candidate in Discovery, gather clearer routing evidence, and avoid assigning Architecture or Runtime ownership early.${input.confidenceRecoverySummary ? ` ${input.confidenceRecoverySummary}` : ""}`,
      requiredChecks: [
        "Record what evidence is still missing for lane ownership.",
        "Prefer new routing evidence or open-gap alignment before rerouting.",
        ...(input.confidenceRecoverySummary
          ? ["Capture the requested confidence-recovery inputs before rerouting."]
          : []),
      ],
      stopLine:
        "Do not assign downstream lane ownership while confidence remains low and no stronger routing signal exists.",
    };
  }

  if (input.needsHumanReview) {
    return {
      guidanceKind: "bounded_lane_review" as const,
      summary: "Bounded lane review remains required before downstream adoption.",
      operatorAction:
        `Keep the bounded lane recommendation visible, review the remaining uncertainty explicitly, and only proceed after that review is recorded.${input.confidenceRecoverySummary ? ` ${input.confidenceRecoverySummary}` : ""}`,
      requiredChecks: [
        "Confirm the lane still matches the best bounded interpretation.",
        "Record the remaining uncertainty before downstream advancement.",
        ...(input.confidenceRecoverySummary
          ? ["Capture the requested confidence-recovery inputs before rerouting."]
          : []),
      ],
      stopLine:
        "Do not widen downstream work while this bounded review requirement remains open.",
    };
  }

  return null;
}

export function assessDirectiveEngineRouting(input: {
  source: DirectiveEngineSourceItem;
  mission: DirectiveEngineMissionContext;
  openGaps: DirectiveEngineCapabilityGap[];
  corrections?: RoutingCorrectionEntry[];
  policyEvents?: DecisionPolicyEvent[];
  existingRuns?: DirectiveEngineRunRecord[];
  receivedAt?: string | null;
}): DirectiveEngineRoutingAssessment {
  const sourceText = flattenSourceText(input.source);
  const {
    gap: matchedGap,
    rank: matchedGapRank,
    structuredSignalScore: matchedGapStructuredSignalScore,
    directReference: matchedGapDirectReference,
  } = findMatchedGap({
    source: input.source,
    openGaps: input.openGaps,
    sourceText,
  });
  const missionFit = deriveMissionFit(input.source, sourceText, input.mission);
  const missionSpecificity = deriveMissionObjectiveSpecificity(input.mission.currentObjective);
  const missionSpecificityWarning =
    missionSpecificity === 0
      ? "Mission objective contains only generic tokens (e.g. \"improve the system\"). All sources will match equally, making routing unreliable. Add specific terms describing what the mission actually targets."
      : missionSpecificity === 1
        ? "Mission objective has very low specificity (1 meaningful token). Routing may over-match. Consider adding 2-3 specific terms describing the capability or area being improved."
        : null;
  const goalCopilot = deriveGoalCopilotAssessment(input.mission);
  const missionHealth = deriveDirectiveMissionHealth({
    mission: input.mission,
    existingRuns: [...(input.existingRuns ?? [])],
  });
  const gapAlignment = matchedGap ? priorityWeight(matchedGap.priority) + 1 : 0;
  const {
    laneScores,
    keywordLaneScores,
    metadataLaneScores,
    gapLaneScores,
    metaUsefulnessSignal,
    patternExtractionSignal,
    transformationSignal,
    runtimeSignal,
    discoveryArchitectureCorrectionEligible,
    discoveryBoundaryPenalty,
    architectureBoundaryBonus,
  } = deriveLaneScores({
    source: input.source,
    sourceText,
    matchedGap,
  });
  const correctionAdjustments = input.corrections?.length
    ? deriveRoutingCorrectionAdjustments({
      sourceText,
      corrections: input.corrections,
    })
    : {};
  for (const [laneId, adjustment] of Object.entries(correctionAdjustments)) {
    if (laneId in laneScores) {
      (laneScores as Record<string, number>)[laneId] = Math.max(
        0,
        (laneScores as Record<string, number>)[laneId] + adjustment,
      );
    }
  }
  const sourceMemorySnapshot = createDirectiveSourceMemorySnapshot({
    runs: [...(input.existingRuns ?? [])],
  });
  const provisionalLaneId = deriveRecommendedLane(laneScores);
  const sourceMemoryPreAssessment = deriveDirectiveSourceMemoryAssessment({
    snapshot: sourceMemorySnapshot,
    sourceText,
    recommendedLaneId: provisionalLaneId,
    source: input.source,
  });
  if (sourceMemoryPreAssessment) {
    for (const [laneId, adjustment] of Object.entries(sourceMemoryPreAssessment.biasAdjustments)) {
      if (adjustment > 0 && laneId in laneScores) {
        (laneScores as Record<string, number>)[laneId] += adjustment;
      }
    }
  }
  const narrativeContextPreAssessment = deriveDirectiveSourceNarrativeContext({
    source: input.source,
    sourceText,
    mission: input.mission,
    existingRuns: [...(input.existingRuns ?? [])],
    provisionalLaneId,
    currentMatchedGapId: matchedGap?.gapId ?? input.source.capabilityGapId ?? null,
    receivedAt: input.receivedAt,
  });
  if (narrativeContextPreAssessment) {
    for (const [laneId, adjustment] of Object.entries(narrativeContextPreAssessment.biasAdjustments)) {
      if (adjustment > 0 && laneId in laneScores) {
        (laneScores as Record<string, number>)[laneId] += adjustment;
      }
    }
  }
  const scoreWinnerLaneId = deriveRecommendedLane(laneScores);
  const ambiguityPenalty = deriveAmbiguityPenalty(laneScores);
  const rankedLaneScores = rankLaneScores(laneScores);
  const laneProportions = deriveLaneProportions(laneScores);
  const topLaneScore = laneScores[scoreWinnerLaneId];
  const runnerUpLaneId = rankedLaneScores[1]?.[0] ?? null;
  const scoreDelta = topLaneScore - (runnerUpLaneId ? laneScores[runnerUpLaneId] : 0);
  const keywordWinner = deriveSignalWinner(keywordLaneScores);
  const metadataWinner = deriveSignalWinner(metadataLaneScores);
  const gapWinner = matchedGapDirectReference
    ? null
    : deriveSignalWinner(gapLaneScores);
  // Metadata override: when metadata strongly favors the score winner (≥6 points,
  // indicating an explicit primaryAdoptionTarget or similarly strong structured signal),
  // keyword disagreement alone is not a meaningful conflict — the operator already
  // declared ownership via structured metadata, so noisy keyword overlap in the source
  // text shouldn't force human review.
  const metadataStronglySupportsWinner =
    metadataLaneScores[scoreWinnerLaneId] >= 6
    && (metadataWinner === scoreWinnerLaneId || metadataWinner === null);
  const conflictingSignalFamilies = [
    keywordWinner !== null && keywordWinner !== scoreWinnerLaneId
      && !metadataStronglySupportsWinner
      ? "keyword"
      : null,
    metadataWinner !== null && metadataWinner !== scoreWinnerLaneId ? "metadata" : null,
    gapWinner !== null && gapWinner !== scoreWinnerLaneId ? "gap" : null,
  ].filter((value): value is "keyword" | "metadata" | "gap" => value !== null);
  const conflictingLaneIds = Array.from(
    new Set(
      [keywordWinner, metadataWinner, gapWinner]
        .filter((value): value is "discovery" | "architecture" | "runtime" => value !== null)
        .filter((value) => value !== scoreWinnerLaneId),
    ),
  );
  const total =
    missionFit * 4 +
    gapAlignment * 5 +
    topLaneScore +
    transformationSignal -
    ambiguityPenalty * 4;
  const missionPriorityScore = clampInt(total, 0, 100);
  const routeConflict = conflictingSignalFamilies.length > 0;
  const confidence = deriveConfidence(topLaneScore, ambiguityPenalty, routeConflict);
  const recommendedLaneId = shouldFallbackLowConfidenceRouteToDiscovery({
    confidence,
    matchedGap,
    source: input.source,
  })
    ? "discovery"
    : scoreWinnerLaneId;
  const sourceMemory = deriveDirectiveSourceMemoryAssessment({
    snapshot: sourceMemorySnapshot,
    sourceText,
    recommendedLaneId,
    source: input.source,
  });
  const secondaryLanes = rankedLaneScores
    .filter(([laneId]) => laneId !== recommendedLaneId)
    .map(([laneId]) => ({
      laneId,
      proportion: laneProportions[laneId],
      reason:
        laneProportions[laneId] >= 25
          ? `${laneId} still claims ${laneProportions[laneId]}% of the route score, so this is a material secondary concern.`
          : `${laneId} remains visible but is not a material secondary owner.`,
    }))
    .filter((entry) => entry.proportion >= 25)
    .slice(0, 2);
  const recommendedRecordShape = deriveRecommendedRecordShape({
    recommendedLaneId,
    confidence,
    matchedGap,
    routeConflict,
    source: input.source,
    metaUsefulnessSignal,
    patternExtractionSignal,
    transformationSignal,
    runtimeSignal,
    discoveryArchitectureCorrectionEligible,
  });
  const noGapHighConfidenceBoundedRoute =
    matchedGap === null &&
    confidence === "high" &&
    !routeConflict &&
    (
      recommendedRecordShape === "fast_path" ||
      recommendedRecordShape === "split_case"
    );
  const baseNeedsHumanReview =
    routeConflict ||
    (confidence === "low" && recommendedLaneId !== "discovery") ||
    (matchedGap === null && !noGapHighConfidenceBoundedRoute && recommendedRecordShape === "fast_path") ||
    (recommendedRecordShape === "queue_only" && recommendedLaneId !== "discovery");
  const gapRadarSuggestions = compileDirectiveGapRadarSuggestions({
    events: [...(input.policyEvents ?? [])],
    openGaps: input.openGaps,
  });
  const gapRadar = deriveDirectiveGapRadarAssessment({
    sourceText,
    recommendedLaneId,
    matchedGapId: matchedGap?.gapId ?? null,
    suggestions: gapRadarSuggestions,
  });
  const earnedAutonomy = deriveDirectiveEngineEarnedAutonomyAssessment({
    source: input.source,
    recommendedLaneId,
    recommendedRecordShape,
    confidence,
    routeConflict,
    baseNeedsHumanReview,
    existingRuns: [...(input.existingRuns ?? [])],
    policyEvents: [...(input.policyEvents ?? [])],
  });
  const needsHumanReview =
    baseNeedsHumanReview && !earnedAutonomy.approvalReductionApplied;
  const sourceSimilarity = deriveDirectiveSourceSimilarityAssessment({
    source: input.source,
    sourceText,
    existingRuns: [...(input.existingRuns ?? [])],
    recommendedLaneId,
  });
  const narrativeContext = deriveDirectiveSourceNarrativeContext({
    source: input.source,
    sourceText,
    mission: input.mission,
    existingRuns: [...(input.existingRuns ?? [])],
    provisionalLaneId: recommendedLaneId,
    currentMatchedGapId: matchedGap?.gapId ?? input.source.capabilityGapId ?? null,
    receivedAt: input.receivedAt,
  });
  const followUpQuestions = deriveDirectiveFollowUpQuestionSet({
    source: input.source,
    mission: input.mission,
    missionHealth,
    goalCopilot,
    narrativeContext,
    recommendedLaneId,
    laneProportions,
    confidence,
    routeConflict,
    matchedGap,
    openGaps: input.openGaps,
  });
  const confidenceRecovery = deriveConfidenceRecovery({
    source: input.source,
    mission: input.mission,
    missionFit,
    missionSpecificityWarning,
    recommendedLaneId,
    confidence,
    routeConflict,
    matchedGap,
    openGaps: input.openGaps,
    conflictingLaneIds,
    goalCopilot,
  });
  const reviewGuidance = deriveReviewGuidance({
    recommendedLaneId,
    confidence,
    matchedGap,
    routeConflict,
    needsHumanReview,
    recommendedRecordShape,
    confidenceRecoverySummary: confidenceRecovery?.summary ?? null,
  });

  const rationale: string[] = [];
  const keywordSignals: string[] = [];
  const metadataSignals: string[] = [];
  const gapAlignmentSignals: string[] = [];
  const ambiguitySignals: string[] = [];
  if (missionSpecificityWarning) {
    rationale.push(missionSpecificityWarning);
    ambiguitySignals.push(missionSpecificityWarning);
  }
  if (missionHealth) {
    const missionHealthLine =
      `Mission Health scored ${missionHealth.overallScore}/100 (${missionHealth.healthGrade}); over-match risk ${missionHealth.overmatchRiskScore}/5 and staleness risk ${missionHealth.stalenessRiskScore}/5.`;
    rationale.push(missionHealthLine);
    metadataSignals.push(missionHealthLine);
    for (const warning of missionHealth.warnings) {
      const warningLine = `Mission Health warning: ${warning}`;
      rationale.push(warningLine);
      ambiguitySignals.push(warningLine);
    }
    for (const tensionLine of missionHealth.tensionSignals) {
      const fullLine = `Mission Health tension: ${tensionLine}`;
      rationale.push(fullLine);
      ambiguitySignals.push(fullLine);
    }
    if (missionHealth.suggestedObjectiveRewrite) {
      const rewriteLine = `Mission Health suggested rewrite: ${missionHealth.suggestedObjectiveRewrite}`;
      rationale.push(rewriteLine);
      metadataSignals.push(rewriteLine);
    }
  }
  rationale.push(
    `Goal Copilot overall score is ${goalCopilot.overallScore}/100.`,
  );
  if (goalCopilot.warnings.length > 0) {
    const goalWarningLine = `Goal Copilot warnings: ${goalCopilot.warnings.join(" ")}`;
    rationale.push(goalWarningLine);
    ambiguitySignals.push(goalWarningLine);
  }
  if (goalCopilot.suggestedObjective) {
    const goalRewriteLine = `Goal Copilot suggested objective rewrite: ${goalCopilot.suggestedObjective}`;
    rationale.push(goalRewriteLine);
    metadataSignals.push(goalRewriteLine);
  }
  const appliedCorrectionLanes = Object.entries(correctionAdjustments).filter(
    ([, adj]) => adj !== 0,
  );
  if (appliedCorrectionLanes.length > 0) {
    const correctionLine =
      `Routing correction ledger applied adjustments: ${appliedCorrectionLanes.map(([lane, adj]) => `${lane} ${adj > 0 ? "+" : ""}${adj}`).join(", ")}.`;
    rationale.push(correctionLine);
    keywordSignals.push(correctionLine);
  }
  if (matchedGap && matchedGapRank !== null) {
    const line =
      `Matched open gap ${matchedGap.gapId} (rank ${matchedGapRank}) as the closest current mission pressure.`;
    rationale.push(line);
    gapAlignmentSignals.push(line);
    if (matchedGapStructuredSignalScore > 0) {
      const structuredLine =
        `Structured source signals added ${matchedGapStructuredSignalScore} points of gap alignment for ${matchedGap.gapId}, so matching did not rely only on token overlap.`;
      rationale.push(structuredLine);
      gapAlignmentSignals.push(structuredLine);
    }
  } else {
    const line =
      "No unresolved gap matched strongly enough, so the assessment relied on mission-fit and lane-signal scoring.";
    rationale.push(line);
    gapAlignmentSignals.push(line);
  }
  if (sourceMemory) {
    rationale.push(`Source Memory summary: ${sourceMemory.summary}`);
    for (const line of sourceMemory.rationale) {
      const fullLine = `Source Memory: ${line}`;
      rationale.push(fullLine);
      keywordSignals.push(fullLine);
    }
  }
  if (gapRadar) {
    const gapRadarLine = `Gap Radar summary: ${gapRadar.summary}`;
    rationale.push(gapRadarLine);
    gapAlignmentSignals.push(gapRadarLine);
    for (const suggestion of gapRadar.suggestions) {
      const suggestionLine =
        `Gap Radar suggestion (${suggestion.confidence}, ${suggestion.evidenceCount} events): ${suggestion.summary} ${suggestion.recommendedChange}`;
      rationale.push(suggestionLine);
      gapAlignmentSignals.push(suggestionLine);
    }
  }
  rationale.push(`Earned Autonomy score is ${earnedAutonomy.overallScore}/100 for route class ${earnedAutonomy.routeClass}.`);
  for (const autonomyLine of earnedAutonomy.rationale) {
    rationale.push(`Earned Autonomy: ${autonomyLine}`);
    ambiguitySignals.push(`Earned Autonomy: ${autonomyLine}`);
  }
  if (earnedAutonomy.approvalReductionApplied) {
    const autonomyAppliedLine =
      "Earned Autonomy waived the extra human-review gate because this route class has enough clean operator-confirmed history.";
    rationale.push(autonomyAppliedLine);
    ambiguitySignals.push(autonomyAppliedLine);
  } else if (baseNeedsHumanReview) {
    const autonomyBlockedLine =
      "Earned Autonomy did not waive review because the route class still lacks enough clean history or has contrary evidence.";
    rationale.push(autonomyBlockedLine);
    ambiguitySignals.push(autonomyBlockedLine);
  }
  rationale.push(
    `Lane proportions: discovery=${laneProportions.discovery}%, architecture=${laneProportions.architecture}%, runtime=${laneProportions.runtime}%.`,
  );
  if (secondaryLanes.length > 0) {
    for (const secondaryLane of secondaryLanes) {
      const secondaryLine = `Secondary lane signal: ${secondaryLane.reason}`;
      rationale.push(secondaryLine);
      ambiguitySignals.push(secondaryLine);
    }
  }
  rationale.push(
    `Recommended ${scoreWinnerLaneId} because its lane score (${laneScores[scoreWinnerLaneId]}) exceeded the alternatives.`,
  );
  if (input.source.primaryAdoptionTarget) {
    const line =
      `Primary adoption target metadata is set to ${input.source.primaryAdoptionTarget}, which contributes directly to lane scoring instead of relying only on keyword overlap.`;
    rationale.push(line);
    metadataSignals.push(line);
  }
  if (input.source.containsExecutableCode) {
    const line =
      "Structured source metadata says executable code is present, which strengthens repeated-runtime usefulness scoring.";
    rationale.push(line);
    metadataSignals.push(line);
  }
  if (input.source.containsWorkflowPattern) {
    const line =
      "Structured source metadata says a workflow pattern is present, which strengthens architecture/runtime workflow interpretation beyond title keywords alone.";
    rationale.push(line);
    metadataSignals.push(line);
  }
  if (input.source.improvesDirectiveWorkspace) {
    const line =
      "Structured source metadata says the source primarily improves Directive Workspace itself, which strengthens Architecture scoring even when the source also contains executable code.";
    rationale.push(line);
    metadataSignals.push(line);
  }
  if (input.source.workflowBoundaryShape) {
    const line =
      `Structured workflow-boundary metadata is set to ${input.source.workflowBoundaryShape}, which strengthens Architecture interpretation of explicit reusable workflow boundaries instead of relying only on title/summary tokens.`;
    rationale.push(line);
    metadataSignals.push(line);
  }
  if (transformationSignal > 0) {
    const line =
      `Transformation signal is present (${transformationSignal}/5), which strengthens Runtime-style behavior-preserving work.`;
    rationale.push(line);
    keywordSignals.push(line);
  }
  if (metaUsefulnessSignal > 0) {
    const line =
      `Meta-usefulness signal is present (${metaUsefulnessSignal}/5), which strengthens Engine-improvement handling inside Architecture or Discovery.`;
    rationale.push(line);
    keywordSignals.push(line);
  }
  if (patternExtractionSignal > 0) {
    const line =
      `Pattern-extraction signal is present (${patternExtractionSignal}/5), which favors Architecture when the source text says to retain the pattern without adopting the source itself as runtime capability.`;
    rationale.push(line);
    keywordSignals.push(line);
  }
  if (discoveryArchitectureCorrectionEligible) {
    const line =
      `Structural-source correction is present: Discovery overread from intake/routing vocabulary was reduced by ${discoveryBoundaryPenalty} points while Architecture gained ${architectureBoundaryBonus} points because this source looks like Engine workflow logic, not front-door queue work.`;
    rationale.push(line);
    keywordSignals.push(line);
  }
  keywordSignals.push(
    `Keyword-derived lane scores: discovery=${keywordLaneScores.discovery}, architecture=${keywordLaneScores.architecture}, runtime=${keywordLaneScores.runtime}.`,
  );
  metadataSignals.push(
    `Metadata-derived lane scores: discovery=${metadataLaneScores.discovery}, architecture=${metadataLaneScores.architecture}, runtime=${metadataLaneScores.runtime}.`,
  );
  gapAlignmentSignals.push(
    `Gap-derived lane scores: discovery=${gapLaneScores.discovery}, architecture=${gapLaneScores.architecture}, runtime=${gapLaneScores.runtime}.`,
  );
  ambiguitySignals.push(
    `Top lane ${scoreWinnerLaneId} beat ${runnerUpLaneId ?? "none"} by ${scoreDelta} points after ambiguity penalties.`,
  );
  if (routeConflict) {
    const conflictLine =
      `Signal disagreement requires review: ${conflictingSignalFamilies.join(", ")} evidence pointed to ${conflictingLaneIds.join(", ")} instead of ${scoreWinnerLaneId}.`;
    rationale.push(conflictLine);
    ambiguitySignals.push(conflictLine);
  } else {
    ambiguitySignals.push(
      `No material signal-family disagreement remained after scoring; keyword, metadata, and gap alignment all supported ${scoreWinnerLaneId} or had no competing winner.`,
    );
  }
  if (confidenceRecovery) {
    const followUpLine =
      `Confidence recovery asks for: ${confidenceRecovery.requestedInputs.map((entry) => entry.field).join(", ")}.`;
    rationale.push(followUpLine);
    ambiguitySignals.push(followUpLine);
  }
  if (followUpQuestions) {
    const questionLine =
      `Follow-up questions target: ${followUpQuestions.questions.map((entry) => entry.field).join(", ")}.`;
    rationale.push(questionLine);
    ambiguitySignals.push(questionLine);
  }
  if (sourceSimilarity) {
    const similarityLine = `Source similarity summary: ${sourceSimilarity.summary}`;
    rationale.push(similarityLine);
    keywordSignals.push(similarityLine);
  }
  if (narrativeContext) {
    const narrativeLine = `Narrative Threading summary: ${narrativeContext.summary}`;
    rationale.push(narrativeLine);
    ambiguitySignals.push(narrativeLine);
    if (narrativeContext.primaryThread) {
      const primaryThreadLine =
        `Narrative Threading primary thread "${narrativeContext.primaryThread.name}" is ${narrativeContext.primaryThread.state} with ${narrativeContext.primaryThread.sourceCount} sources and ${narrativeContext.primaryThread.followThrough.followThroughRate}% follow-through.`;
      rationale.push(primaryThreadLine);
      ambiguitySignals.push(primaryThreadLine);
    }
    if (Object.values(narrativeContext.biasAdjustments).some((value) => value > 0)) {
      const biasLine =
        `Narrative Threading bias adjustments: ${Object.entries(narrativeContext.biasAdjustments).map(([laneId, value]) => `${laneId} ${value > 0 ? "+" : ""}${value}`).join(", ")}.`;
      rationale.push(biasLine);
      keywordSignals.push(biasLine);
    }
    for (const signal of narrativeContext.demandSignals) {
      const demandLine = `Narrative Threading demand (${signal.priority}): ${signal.summary}`;
      rationale.push(demandLine);
      ambiguitySignals.push(demandLine);
    }
  }
  rationale.push(
    `Route explanation breakdown for ${recommendedLaneId}: keyword=${keywordLaneScores[recommendedLaneId]}, metadata=${metadataLaneScores[recommendedLaneId]}, gap=${gapLaneScores[recommendedLaneId]}.`,
  );
  if (recommendedLaneId === "discovery" && scoreWinnerLaneId !== "discovery" && confidence === "low") {
    const fallbackLine =
      `Routing confidence remained low without an open gap, so the candidate stays in Discovery instead of assigning early ${scoreWinnerLaneId} ownership.`;
    rationale.push(fallbackLine);
    ambiguitySignals.push(fallbackLine);
  }
  if (recommendedRecordShape === "fast_path") {
    if (
      recommendedLaneId === "runtime" &&
      matchedGap === null &&
      confidence === "high" &&
      !routeConflict
    ) {
      rationale.push(
        "Fast-path is recommended because strong Runtime signals justify bounded follow-through even without an open gap match.",
      );
    } else {
      rationale.push(
        "Fast-path is recommended because the route appears bounded enough to avoid a full split-case path.",
      );
    }
  } else if (recommendedRecordShape === "split_case") {
    if (routeConflict) {
      rationale.push(
        "Split-case is recommended because a conflicted Architecture route needs the fuller structural record before downstream review.",
      );
    } else if (
      recommendedLaneId === "architecture" &&
      matchedGap === null &&
      confidence === "high" &&
      !routeConflict
    ) {
      rationale.push(
        "Split-case is recommended because strong Architecture signals justify a fuller structural record even without an open gap match.",
      );
    } else {
      rationale.push(
        "Split-case is recommended because the candidate looks structural or ambiguous enough to benefit from fuller Discovery records.",
      );
    }
  } else {
    if (routeConflict && recommendedLaneId === "runtime") {
      rationale.push(
        "Queue-only is recommended because a conflicted Runtime route should not open fast-path follow-through before explicit review.",
      );
    } else {
      rationale.push(
        "Queue-only is recommended because the candidate still needs more routing clarity before record expansion.",
      );
    }
  }

  return {
    recommendedLaneId,
    recommendedRecordShape,
    missionPriorityScore,
    confidence,
    matchedGapId: matchedGap?.gapId ?? null,
    matchedGapRank,
    explicitRouteDestination: null,
    routeConflict,
    needsHumanReview,
    missionSpecificityWarning,
    missionHealth,
    goalCopilot,
    confidenceRecovery,
    followUpQuestions,
    gapRadar,
    earnedAutonomy,
    sourceMemory,
    sourceSimilarity,
    narrativeContext,
    laneProportions,
    secondaryLanes,
    ambiguitySummary: {
      topLaneId: scoreWinnerLaneId,
      runnerUpLaneId,
      scoreDelta,
      conflictingSignalFamilies,
      conflictingLaneIds,
    },
    reviewGuidance,
    scoreBreakdown: {
      missionFit,
      gapAlignment,
      laneScores,
      keywordLaneScores,
      metadataLaneScores,
      gapLaneScores,
      metaUsefulnessSignal,
      patternExtractionSignal,
      transformationSignal,
      runtimeSignal,
      ambiguityPenalty,
      total: missionPriorityScore,
    },
    explanationBreakdown: {
      keywordSignals,
      metadataSignals,
      gapAlignmentSignals,
      ambiguitySignals,
    },
    rationale,
  };
}
