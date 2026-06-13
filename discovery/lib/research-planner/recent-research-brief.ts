import {
  retrieveRecentResearchEvidence,
  type RecentResearchEvidenceReport,
  type RecentResearchRetrievalOptions,
  type RecentResearchWebSearchAdapter,
} from "./recent-research-brief-evidence.ts";
import {
  buildRecentResearchBriefReport,
  validateRecentResearchSynthesis,
  type RecentResearchBriefReport,
  type RecentResearchSynthesisValidation,
} from "./recent-research-brief-report.ts";

export type ResearchBriefIntent =
  | "auto"
  | "factual"
  | "product"
  | "concept"
  | "opinion"
  | "how_to"
  | "comparison"
  | "breaking_news"
  | "prediction";

export type ResolvedResearchBriefIntent =
  Exclude<ResearchBriefIntent, "auto">;

export type ResearchBriefDepth = "quick" | "default" | "deep";

export type ResearchBriefFreshnessMode =
  | "strict_recent"
  | "balanced_recent"
  | "evergreen_ok";

export type ResearchSource = "github" | "hackernews" | "polymarket" | "reddit_public" | "web";

export interface RecentResearchBriefInput {
  topic: string;
  lookbackDays?: number;
  intent?: ResearchBriefIntent;
  sources?: string[];
  depth?: ResearchBriefDepth;
  requireCitations?: boolean;
}

export interface RecentResearchSubquery {
  label: string;
  searchQuery: string;
  rankingQuery: string;
  sources: ResearchSource[];
  weight: number;
}

export interface ResearchSourceWeight {
  source: ResearchSource;
  weight: number;
}

export interface ExcludedResearchSource {
  source: string;
  reason: string;
}

export interface RecentResearchBriefPlan {
  schemaVersion: "1.0.0";
  topic: string;
  requestedIntent: ResearchBriefIntent;
  intent: ResolvedResearchBriefIntent;
  lookbackDays: number;
  depth: ResearchBriefDepth;
  freshnessMode: ResearchBriefFreshnessMode;
  subqueries: RecentResearchSubquery[];
  sourceWeights: ResearchSourceWeight[];
  excludedSources: ExcludedResearchSource[];
  warnings: string[];
  clarifyingQuestions: string[];
  reframe?: string;
  requireCitations: boolean;
}

export interface RecentResearchBriefRunOptions {
  fetch?: typeof fetch;
  now?: Date;
  timeoutMs?: number;
  perSourceLimit?: number;
  totalLimit?: number;
  webSearchAdapter?: RecentResearchWebSearchAdapter;
  maxClusters?: number;
  validateSynthesis?: (report: RecentResearchBriefReport) => RecentResearchSynthesisValidation;
}

export interface RecentResearchBriefRunResult {
  schemaVersion: "1.0.0";
  topic: string;
  plan: RecentResearchBriefPlan;
  evidenceReport: RecentResearchEvidenceReport;
  report: RecentResearchBriefReport;
  validation: RecentResearchSynthesisValidation;
  warnings: string[];
  degradedSources: RecentResearchEvidenceReport["degradedSources"];
  ok: boolean;
}

const SAFE_SOURCE_SYNONYMS: Record<string, ResearchSource> = {
  github: "github",
  gh: "github",
  "github.com": "github",
  hackernews: "hackernews",
  hn: "hackernews",
  polymarket: "polymarket",
  "polymarket.com": "polymarket",
  reddit_public: "reddit_public",
  reddit: "reddit_public",
  "reddit-public": "reddit_public",
  web: "web",
  "web-search": "web",
  host_search: "web",
};

const UNSAFE_SOURCE_REASONS: Record<string, string> = {
  x_twitter: "Blocked in BUILD R1 due X/Twitter credential/cookie dependency",
  x: "Blocked in BUILD R1 due X/Twitter credential/cookie dependency",
  twitter: "Blocked in BUILD R1 due X/Twitter credential/cookie dependency",
  tiktok: "Blocked in BUILD R1 due unsafe content and credential implications",
  instagram: "Blocked in BUILD R1 due privacy/cookie risk",
  threads: "Blocked in BUILD R1 per safety boundary",
  pinterest: "Blocked in BUILD R1 per safety boundary",
  scrapecreators: "Blocked in BUILD R1 by policy",
  brave: "Blocked in BUILD R1 without private provider keys",
  webhook: "Blocked in BUILD R1 because cron/webhook behavior is deferred",
  webhooks: "Blocked in BUILD R1 because cron/webhook behavior is deferred",
  cookie: "Blocked in BUILD R1 due browser-cookie extraction constraints",
  cookies: "Blocked in BUILD R1 due browser-cookie extraction constraints",
  cron: "Blocked in BUILD R1 as persistence/cron behavior is deferred",
  app_password: "Blocked in BUILD R1 due credential storage policy",
  apppassword: "Blocked in BUILD R1 due credential storage policy",
};

const KEYWORD_TRAP_TOKENS = new Set([
  "latest",
  "update",
  "updates",
  "news",
  "interesting",
  "anything",
  "topics",
  "new",
  "trending",
  "status",
  "help",
]);

const PREDICTION_TOKENS = new Set([
  "prediction",
  "predict",
  "probability",
  "forecast",
  "odds",
  "market",
  "will",
  "might",
]);

const COMPARISON_PATTERNS = [
  /\s+vs\.?\s+/i,
  /\s+versus\s+/i,
  /\s+compared with\s+/i,
];

const FALLBACK_SAFE_SOURCE: ResearchSource = "web";

const DEDUPE_SOURCES = (sources: ResearchSource[]): ResearchSource[] => [...new Set(sources)];

const ensureNonEmptySources = (sources: ResearchSource[]): ResearchSource[] =>
  sources.length === 0 ? [FALLBACK_SAFE_SOURCE] : DEDUPE_SOURCES(sources);

const normalizeSubquerySources = (
  candidateSources: ResearchSource[],
  selectedSourceSet: ReadonlySet<ResearchSource>,
): ResearchSource[] => {
  const allowedSources = DEDUPE_SOURCES(
    candidateSources.filter((source) => selectedSourceSet.has(source)),
  );
  if (allowedSources.length > 0) {
    return allowedSources;
  }
  return ensureNonEmptySources(toArray(selectedSourceSet));
};

const DEPTH_LIMITS: Record<ResearchBriefDepth, number> = {
  quick: 2,
  default: 3,
  deep: 4,
};

const WEIGHT_PROFILES: Record<ResolvedResearchBriefIntent, Record<ResearchSource, number>> = {
  factual: { github: 0.35, hackernews: 0.2, polymarket: 0, reddit_public: 0.12, web: 0.33 },
  product: { github: 0.55, hackernews: 0.18, polymarket: 0, reddit_public: 0.07, web: 0.2 },
  concept: { github: 0.3, hackernews: 0.35, polymarket: 0, reddit_public: 0.15, web: 0.2 },
  opinion: { github: 0.18, hackernews: 0.5, polymarket: 0, reddit_public: 0.14, web: 0.18 },
  how_to: { github: 0.4, hackernews: 0.2, polymarket: 0, reddit_public: 0.1, web: 0.3 },
  comparison: { github: 0.42, hackernews: 0.26, polymarket: 0, reddit_public: 0.08, web: 0.24 },
  breaking_news: { github: 0.2, hackernews: 0.45, polymarket: 0.1, reddit_public: 0.1, web: 0.25 },
  prediction: { github: 0.18, hackernews: 0.22, polymarket: 0.4, reddit_public: 0.05, web: 0.15 },
};

const toArray = (sourceSet: ReadonlySet<ResearchSource>): ResearchSource[] => [...sourceSet];

const normalize = (topic: string): string => topic.trim().replace(/\s+/g, " ");

const tokenize = (topic: string): string[] =>
  topic
    .toLowerCase()
    .replace(/[^a-z0-9\s\-\/]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/[^a-z0-9]/g, ""));

const hasAnyToken = (topic: string, terms: Set<string>): boolean =>
  tokenize(topic).some((token) => terms.has(token));

const isKeywordTrap = (topic: string): boolean => {
  const words = tokenize(topic);
  if (words.length <= 2) {
    return words.every((word) => KEYWORD_TRAP_TOKENS.has(word));
  }
  const hitCount = words.filter((word) => KEYWORD_TRAP_TOKENS.has(word)).length;
  return hitCount >= Math.max(1, Math.floor(words.length / 3));
};

const detectComparison = (topic: string): [string, string] | null => {
  for (const pattern of COMPARISON_PATTERNS) {
    if (!pattern.test(topic)) {
      continue;
    }
    const parts = topic.split(pattern);
    const left = parts[0]?.trim();
    const right = parts[1]?.trim();
    if (left && right && left.length > 2 && right.length > 2) {
      return [left, right];
    }
  }
  return null;
};

const detectRepo = (topic: string): string | null => {
  const explicit = topic.match(/(?:https?:\/\/)?github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i);
  if (explicit?.[1]) {
    return explicit[1];
  }
  if (/\b(?:tool|repo|library|package|cli)\b/i.test(topic)) {
    const embedded = topic.match(/\b([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\b/);
    return embedded?.[1] ?? null;
  }
  return null;
};

const normalizeWeight = (entries: ResearchSourceWeight[]): ResearchSourceWeight[] => {
  const sum = entries.reduce((total, entry) => total + entry.weight, 0);
  if (sum <= 0) {
    return entries.map((entry) => ({ ...entry, weight: 0 }));
  }
  return entries.map((entry) => ({ ...entry, weight: Number((entry.weight / sum).toFixed(3)) }));
};

const classifyIntent = (topic: string, requested: ResearchBriefIntent): ResolvedResearchBriefIntent => {
  if (requested !== "auto") {
    return requested;
  }
  if (hasAnyToken(topic, PREDICTION_TOKENS)) {
    return "prediction";
  }
  if (detectComparison(topic)) {
    return "comparison";
  }
  const repo = detectRepo(topic);
  if (repo) {
    return "product";
  }
  if (/\bhow to\b/i.test(topic)) {
    return "how_to";
  }
  if (/\b(opinion|review|critic|perspective)\b/i.test(topic)) {
    return "opinion";
  }
  if (/\b(api|architecture|implementation|design|pattern|tool|framework)\b/i.test(topic)) {
    return "concept";
  }
  if (/\b(hn|hacker.?news|github)\b/i.test(topic)) {
    return "concept";
  }
  if (hasAnyToken(topic, new Set(["today", "breaking", "latest"]))) {
    return "breaking_news";
  }
  return "factual";
};

const deriveFreshnessMode = (intent: ResolvedResearchBriefIntent, lookbackDays: number): ResearchBriefFreshnessMode => {
  if (intent === "breaking_news" || lookbackDays <= 7) {
    return "strict_recent";
  }
  if (intent === "prediction" || lookbackDays <= 30) {
    return "balanced_recent";
  }
  return "evergreen_ok";
};

const buildSourcePolicy = (
  request: RecentResearchBriefInput,
  resolvedIntent: ResolvedResearchBriefIntent,
): {
  selectedSources: Set<ResearchSource>;
  excludedSources: ExcludedResearchSource[];
  excludedSet: Set<string>;
} => {
  const requested = request.sources ?? [];
  const selected = new Set<ResearchSource>();
  const exclusions: ExcludedResearchSource[] = [];
  const excludedSet = new Set<string>();
  const pushExclusion = (source: string, reason: string) => {
    if (excludedSet.has(source)) {
      return;
    }
    excludedSet.add(source);
    exclusions.push({ source, reason });
  };

  if (requested.length === 0) {
    ["github", "hackernews", "web"].forEach((source) => selected.add(source as ResearchSource));
  } else {
    requested.forEach((raw) => {
      const normalized = normalize(raw).toLowerCase();
      if (Object.prototype.hasOwnProperty.call(SAFE_SOURCE_SYNONYMS, normalized)) {
        selected.add(SAFE_SOURCE_SYNONYMS[normalized]);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(UNSAFE_SOURCE_REASONS, normalized)) {
        pushExclusion(raw, UNSAFE_SOURCE_REASONS[normalized]);
        return;
      }
      pushExclusion(raw, "Not in BUILD R1 safe source allow-list");
    });
  }

  if (resolvedIntent !== "prediction" && selected.has("polymarket")) {
    selected.delete("polymarket");
    pushExclusion("polymarket", "R1 allows polymarket only for prediction-shaped planning");
  }

  if (resolvedIntent === "prediction" && !selected.has("polymarket")) {
    selected.add("polymarket");
  }

  return { selectedSources: selected, excludedSources: exclusions, excludedSet };
};

const buildSourceWeights = (
  resolvedIntent: ResolvedResearchBriefIntent,
  selectedSources: Set<ResearchSource>,
): ResearchSourceWeight[] =>
  normalizeWeight(
    [...selectedSources].map((source) => ({
      source,
      weight: WEIGHT_PROFILES[resolvedIntent][source] ?? 0,
    })),
  );

const buildSubqueries = (
  resolvedIntent: ResolvedResearchBriefIntent,
  topic: string,
  sourceSet: Set<ResearchSource>,
  depth: ResearchBriefDepth,
): RecentResearchSubquery[] => {
  const limit = DEPTH_LIMITS[depth];
  const selectedSources = toArray(sourceSet);
  const subqueries: RecentResearchSubquery[] = [];

  if (isKeywordTrap(topic)) {
    return [{
      label: "clarify_topic",
      searchQuery: `clarify research scope before searching: ${normalize(topic)}`,
      rankingQuery: "clarification only",
      sources: normalizeSubquerySources(["web"], sourceSet),
      weight: 1,
    }];
  }

  const comparison = detectComparison(topic);
  if (comparison) {
    const [left, right] = comparison;
    const comparisonBaseSources: ResearchSource[] = [
      ...selectedSources.filter((source) => source !== "polymarket"),
      "github",
      "hackernews",
      "web",
    ];
    const compareSources = normalizeSubquerySources(
      comparisonBaseSources,
      sourceSet,
    );
    subqueries.push({
      label: "compare_entities_left",
      searchQuery: `${left} overview`,
      rankingQuery: `"${left}"`,
      sources: compareSources,
      weight: 0.45,
    });
    if (limit >= 2) {
      const comparisonBaseSourcesRight: ResearchSource[] = [
        ...selectedSources.filter((source) => source !== "polymarket"),
        "github",
        "hackernews",
        "web",
      ];
      const compareSourcesRight = normalizeSubquerySources(
        comparisonBaseSourcesRight,
        sourceSet,
      );
      subqueries.push({
        label: "compare_entities_right",
        searchQuery: `${right} overview`,
        rankingQuery: `"${right}"`,
        sources: compareSourcesRight,
        weight: 0.35,
      });
    }
    if (limit >= 3) {
      subqueries.push({
        label: "compare_side_by_side",
        searchQuery: `${left} vs ${right} comparison`,
        rankingQuery: `${left} ${right} feature comparison`,
        sources: normalizeSubquerySources(
          ["github", "hackernews", "web"],
          sourceSet,
        ),
        weight: 0.2,
      });
    }
    return subqueries.slice(0, limit);
  }

  const repoCandidate = detectRepo(topic);
  if (repoCandidate) {
    subqueries.push({
      label: "repo_tool_primary",
      searchQuery: `repo:${repoCandidate} releases docs`,
      rankingQuery: repoCandidate,
      sources: normalizeSubquerySources(["github", "web"], sourceSet),
      weight: 0.55,
    });
    if (limit >= 2) {
      subqueries.push({
        label: "repo_tool_examples",
        searchQuery: `${repoCandidate} usage examples`,
        rankingQuery: "usage examples",
        sources: normalizeSubquerySources(["github", "web"], sourceSet),
        weight: 0.25,
      });
    }
    if (limit >= 3) {
      subqueries.push({
        label: "repo_tool_signals",
        searchQuery: `${repoCandidate} stars forks activity`,
        rankingQuery: "repository signals",
        sources: normalizeSubquerySources(
          ["github", "hackernews", "web"],
          sourceSet,
        ),
        weight: 0.2,
      });
    }
    return subqueries.slice(0, limit);
  }

  if (resolvedIntent === "prediction") {
    const predictionPrimarySources: ResearchSource[] = ["polymarket", "hackernews", "web"];
    const predictionSecondarySources: ResearchSource[] = ["web", "hackernews"];
    subqueries.push({
      label: "prediction_markets",
      searchQuery: `${topic} market`,
      rankingQuery: "prediction odds",
      sources: normalizeSubquerySources(predictionPrimarySources, sourceSet),
      weight: 0.45,
    });
    if (limit >= 2) {
      subqueries.push({
        label: "prediction_signal_events",
        searchQuery: `${topic} key events`,
        rankingQuery: "event timeline",
        sources: normalizeSubquerySources(predictionSecondarySources, sourceSet),
        weight: 0.25,
      });
    }
    if (limit >= 3) {
      subqueries.push({
        label: "prediction_developer_discussion",
        searchQuery: `${topic} developer discussion`,
        rankingQuery: "evidence quality",
        sources: normalizeSubquerySources(predictionSecondarySources, sourceSet),
        weight: 0.2,
      });
    }
    return subqueries.slice(0, limit);
  }

  if (limit >= 1) {
    subqueries.push({
      label: "seed",
      searchQuery: `${topic} official references`,
      rankingQuery: topic,
      sources: normalizeSubquerySources(selectedSources.slice(0, 2), sourceSet),
      weight: 0.5,
    });
  }
  if (limit >= 2) {
    subqueries.push({
      label: "developer_signals",
      searchQuery: `${topic} implementation pattern`,
      rankingQuery: "implementation details",
      sources: normalizeSubquerySources(
        selectedSources.includes("hackernews")
          ? ["hackernews", ...selectedSources.slice(0, 1)]
          : ["web"],
        sourceSet,
      ),
      weight: 0.3,
    });
  }
  if (limit >= 3) {
    subqueries.push({
      label: "secondary_signals",
      searchQuery: `${topic} discussion and adoption signals`,
      rankingQuery: "community signal",
      sources: normalizeSubquerySources(
        selectedSources.includes("reddit_public") ? ["reddit_public"] : ["web"],
        sourceSet,
      ),
      weight: 0.2,
    });
  }
  if (limit >= 4 && resolvedIntent === "comparison") {
    subqueries.push({
      label: "extra_signals",
      searchQuery: `${topic} adoption metrics`,
      rankingQuery: "adoption and maintenance signals",
      sources: normalizeSubquerySources(
        ["github", "web", "hackernews"],
        sourceSet,
      ),
      weight: 0.1,
    });
  }

  return subqueries.slice(0, limit);
};

export function deriveRecentResearchBriefPlan(rawInput: RecentResearchBriefInput): RecentResearchBriefPlan {
  const input: Required<RecentResearchBriefInput> = {
    topic: normalize(rawInput.topic ?? ""),
    lookbackDays: Number.isFinite(rawInput.lookbackDays ?? 30)
      ? Math.min(3650, Math.max(1, Math.round(rawInput.lookbackDays ?? 30)))
      : 30,
    intent: rawInput.intent ?? "auto",
    sources: rawInput.sources ?? [],
    depth: rawInput.depth ?? "default",
    requireCitations: rawInput.requireCitations ?? true,
  };

  const warnings: string[] = [];
  const clarifyingQuestions: string[] = [];
  let reframe: string | undefined;

  if (!input.topic) {
    warnings.push("Empty topic is not actionable and requires a clarifying question.");
  }

  const resolvedIntent = classifyIntent(input.topic, input.intent);
  const freshnessMode = deriveFreshnessMode(resolvedIntent, input.lookbackDays);

  const policy = buildSourcePolicy(input, resolvedIntent);
  const selectedSources = policy.selectedSources;
  if (!selectedSources.size) {
    selectedSources.add(FALLBACK_SAFE_SOURCE);
    warnings.push("All requested sources were unsafe or unsupported; falling back to safe defaults.");
  }
  const sourceWeights = buildSourceWeights(resolvedIntent, selectedSources);
  const subqueries = buildSubqueries(resolvedIntent, input.topic, selectedSources, input.depth);

  if (isKeywordTrap(input.topic)) {
    reframe = `Could you narrow the query to one concrete objective, such as a specific repository, product, or event?`;
    clarifyingQuestions.push("Do you want evidence discovery, source comparison, or probability tracking?");
    warnings.push("Generic query detected; clarification before retrieval is recommended.");
  }

  if (!input.requireCitations) {
    warnings.push("requireCitations is false; downstream synthesis should still surface explicit caveats.");
  }

  if (policy.excludedSources.length) {
    warnings.push("Some requested sources were excluded by BUILD R1 safety policy.");
  }

  return {
    schemaVersion: "1.0.0",
    topic: input.topic,
    requestedIntent: input.intent,
    intent: resolvedIntent,
    lookbackDays: input.lookbackDays,
    depth: input.depth,
    freshnessMode,
    subqueries,
    sourceWeights,
    excludedSources: policy.excludedSources,
    warnings,
    clarifyingQuestions,
    reframe,
    requireCitations: input.requireCitations,
  };
}

const uniqueStrings = (values: string[]): string[] => [...new Set(values.filter((value) => value.trim().length > 0))];

export async function runRecentResearchBrief(
  input: RecentResearchBriefInput,
  options: RecentResearchBriefRunOptions = {},
): Promise<RecentResearchBriefRunResult> {
  const plan = deriveRecentResearchBriefPlan(input);
  const retrievalOptions: RecentResearchRetrievalOptions = {
    fetch: options.fetch,
    now: options.now,
    timeoutMs: options.timeoutMs,
    perSourceLimit: options.perSourceLimit,
    totalLimit: options.totalLimit,
    webSearchAdapter: options.webSearchAdapter,
  };
  const evidenceReport = await retrieveRecentResearchEvidence(plan, retrievalOptions);
  const report = buildRecentResearchBriefReport(evidenceReport, {
    now: options.now,
    maxClusters: options.maxClusters,
  });
  const validation = options.validateSynthesis
    ? options.validateSynthesis(report)
    : validateRecentResearchSynthesis(report);

  return {
    schemaVersion: "1.0.0",
    topic: plan.topic,
    plan,
    evidenceReport,
    report,
    validation,
    warnings: uniqueStrings([
      ...plan.warnings,
      ...evidenceReport.warnings,
      ...report.warnings,
      ...validation.issues
        .filter((issue) => issue.severity === "warning")
        .map((issue) => `${issue.code}: ${issue.message}`),
    ]),
    degradedSources: report.degradedSources,
    ok: validation.ok,
  };
}

const markdownList = (items: string[]): string[] =>
  items.length === 0 ? ["- None"] : items.map((item) => `- ${item}`);

const renderCitations = (urls: string[]): string => urls.length ? urls.join(", ") : "no citations";

export function renderRecentResearchBriefMarkdown(result: RecentResearchBriefRunResult): string {
  const lines: string[] = [
    `# Recent Research Brief: ${result.topic}`,
    "",
    `Status: ${result.ok ? "OK" : "validation failed"}`,
  ];

  if (result.warnings.length > 0 || result.degradedSources.length > 0) {
    lines.push("", "## Warnings and Degraded Sources");
    lines.push(...markdownList(result.warnings));
    for (const degraded of result.degradedSources) {
      const scope = degraded.subqueryLabel ? ` (${degraded.subqueryLabel})` : "";
      lines.push(`- ${degraded.source}: ${degraded.reason}${scope}`);
    }
  }

  lines.push(
    "",
    "## Plan Summary",
    `- Intent: ${result.plan.intent} (requested: ${result.plan.requestedIntent})`,
    `- Sources: ${result.plan.sourceWeights.map((entry) => entry.source).join(", ") || "none"}`,
    `- Subqueries: ${result.plan.subqueries.length}`,
  );

  lines.push("", "## Top Clusters");
  if (result.report.clusters.length === 0) {
    lines.push("- None");
  } else {
    for (const cluster of result.report.clusters.slice(0, 5)) {
      lines.push(`- ${cluster.label} (score ${cluster.score}): ${renderCitations(cluster.sourceUrls)}`);
    }
  }

  lines.push("", "## Synthesis Draft");
  for (const paragraph of result.report.synthesisDraft.paragraphs) {
    const citations = renderCitations(paragraph.citationUrls);
    lines.push(`- ${paragraph.kind}: ${paragraph.text} [${citations}]`);
  }

  if (result.validation.issues.length > 0) {
    lines.push("", "## Validation Issues");
    for (const issue of result.validation.issues) {
      lines.push(`- ${issue.severity}: ${issue.code} - ${issue.message}`);
    }
  }

  lines.push(
    "",
    "## Untrusted Content Boundary",
    result.report.synthesisDraft.unsafeContentBoundary,
  );

  return `${lines.join("\n")}\n`;
}

export { retrieveRecentResearchEvidence } from "./recent-research-brief-evidence.ts";
export type {
  RecentResearchEvidenceItem,
  RecentResearchEvidenceReport,
  RecentResearchEvidenceScores,
  RecentResearchRetrievalOptions,
  RecentResearchWebSearchAdapter,
  RecentResearchWebSearchResult,
} from "./recent-research-brief-evidence.ts";

export { buildRecentResearchBriefReport, validateRecentResearchSynthesis } from "./recent-research-brief-report.ts";
export type {
  RecentResearchBriefReport,
  RecentResearchEvidenceCluster,
  RecentResearchReportOptions,
  RecentResearchSynthesisDraft,
  RecentResearchSynthesisValidation,
} from "./recent-research-brief-report.ts";
