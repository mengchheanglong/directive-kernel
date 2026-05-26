import type { EngineMissionContext } from "../types.ts";
import { clampInt, deriveRecommendedLane } from "./shared.ts";

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

function countWeightedKeywordHits(
  text: string,
  weightedKeywords: Array<[string, number]>,
) {
  const lowered = text.toLowerCase();
  const sorted = [...weightedKeywords].sort(
    (a, b) => b[0].length - a[0].length,
  );
  let remaining = lowered;
  let rawScore = 0;
  for (const [keyword, weight] of sorted) {
    if (remaining.includes(keyword)) {
      rawScore += weight;
      remaining = remaining.replace(keyword, " ");
    }
  }
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

function collectMissionSpecificTokens(mission: EngineMissionContext) {
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

function inferMissionFocusLane(mission: EngineMissionContext) {
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
  mission: EngineMissionContext;
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
  mission: EngineMissionContext;
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

function buildSuggestedConstraints(mission: EngineMissionContext) {
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
  mission: EngineMissionContext;
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

function deriveGoalCopilotAssessment(mission: EngineMissionContext) {
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

type GoalCopilotAssessment = ReturnType<typeof deriveGoalCopilotAssessment>;

export {
  ARCHITECTURE_KEYWORDS,
  ARCHITECTURE_KEYWORDS_WEIGHTED,
  DISCOVERY_KEYWORDS,
  DISCOVERY_KEYWORDS_WEIGHTED,
  META_USEFULNESS_KEYWORDS,
  PATTERN_EXTRACTION_KEYWORDS,
  RUNTIME_KEYWORDS,
  RUNTIME_KEYWORDS_WEIGHTED,
  RUNTIME_SOURCE_TYPES,
  STRUCTURAL_SOURCE_TYPES,
  TRANSFORMATION_KEYWORDS,
  countKeywordHits,
  countTokenOverlap,
  countWeightedKeywordHits,
  deriveGoalCopilotAssessment,
  deriveMissionObjectiveSpecificity,
};

export type {
  GoalCopilotAssessment,
};
