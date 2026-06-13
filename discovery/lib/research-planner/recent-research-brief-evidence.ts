import type {
  RecentResearchBriefPlan,
  RecentResearchSubquery,
  ResearchSource,
} from "./recent-research-brief.ts";

type FetchLike = typeof fetch;

export interface RecentResearchEvidenceScores {
  relevance: number;
  freshness: number;
  engagement: number;
  sourceQuality: number;
  finalLocalScore: number;
}

export interface RecentResearchEvidenceItem {
  id: string;
  source: ResearchSource;
  title: string;
  url: string;
  author?: string;
  container?: string;
  publishedAt?: string;
  dateConfidence: "exact" | "derived" | "unknown";
  snippet: string;
  engagement?: Record<string, number>;
  relevanceHint: string;
  retrievedAt: string;
  queryPlanId: string;
  subqueryLabel: string;
  unsafeContentWarning: true;
  scores: RecentResearchEvidenceScores;
}

export interface RecentResearchEvidenceReport {
  schemaVersion: "1.0.0";
  topic: string;
  plan: RecentResearchBriefPlan;
  evidence: RecentResearchEvidenceItem[];
  degradedSources: { source: string; reason: string; subqueryLabel?: string }[];
  warnings: string[];
  retrievedAt: string;
}

export interface RecentResearchWebSearchResult {
  title: string;
  url: string;
  snippet?: string;
  author?: string;
  container?: string;
  publishedAt?: string;
  engagement?: Record<string, number>;
}

export type RecentResearchWebSearchAdapter = (input: {
  plan: RecentResearchBriefPlan;
  subquery: RecentResearchSubquery;
  limit: number;
  signal: AbortSignal;
}) => Promise<RecentResearchWebSearchResult[]>;

export interface RecentResearchRetrievalOptions {
  fetch?: FetchLike;
  now?: Date;
  timeoutMs?: number;
  perSourceLimit?: number;
  totalLimit?: number;
  webSearchAdapter?: RecentResearchWebSearchAdapter;
}

interface AdapterContext {
  plan: RecentResearchBriefPlan;
  subquery: RecentResearchSubquery;
  limit: number;
  fetchFn: FetchLike;
  signal: AbortSignal;
  now: Date;
  retrievedAt: string;
}

interface RawEvidence {
  source: ResearchSource;
  title: string;
  url: string;
  snippet: string;
  author?: string;
  container?: string;
  publishedAt?: string;
  dateConfidence: "exact" | "derived" | "unknown";
  engagement?: Record<string, number>;
}

const DEFAULT_TIMEOUT_MS = 4_000;
const DEFAULT_PER_SOURCE_LIMIT = 3;
const DEFAULT_TOTAL_LIMIT = 12;
const MAX_PER_SOURCE_LIMIT = 10;
const MAX_TOTAL_LIMIT = 30;
const MIN_USEFUL_RELEVANCE = 0.05;
const MIN_USEFUL_FINAL_SCORE = 0.1;

const SOURCE_QUALITY: Record<ResearchSource, number> = {
  github: 0.9,
  web: 0.78,
  polymarket: 0.62,
  hackernews: 0.58,
  reddit_public: 0.45,
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "for",
  "from",
  "how",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
};

const boundedInteger = (value: number | undefined, fallback: number, max: number): number => {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return fallback;
  }
  return Math.min(max, Math.max(1, Math.floor(value!)));
};

const tokenSet = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9]/g, ""))
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const numberValue = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const json = async (response: Response): Promise<unknown> => {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<unknown>;
};

const getRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const trimRepoToken = (value: string): string => value.replace(/[),.;:]+$/g, "");

const detectGithubRepoQuery = (query: string): { owner: string; repo: string } | null => {
  const patterns = [
    /\brepo:([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)/i,
    /(?:https?:\/\/)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)/i,
    /\b([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (!match?.[1] || !match[2]) {
      continue;
    }
    return {
      owner: trimRepoToken(match[1]),
      repo: trimRepoToken(match[2]),
    };
  }
  return null;
};

const withTimeout = async <T>(
  timeoutMs: number,
  action: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await action(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const buildId = (
  source: ResearchSource,
  subqueryLabel: string,
  index: number,
  url: string,
): string => {
  const key = `${source}:${subqueryLabel}:${index}:${url}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return `${source}-${subqueryLabel}-${hash.toString(36)}`;
};

const relevance = (query: string, title: string, snippet: string): number => {
  const queryTokens = tokenSet(query);
  if (queryTokens.size === 0) {
    return 0;
  }
  const bodyTokens = tokenSet(`${title} ${snippet}`);
  let hits = 0;
  for (const token of queryTokens) {
    if (bodyTokens.has(token)) {
      hits += 1;
    }
  }
  return clamp01(hits / queryTokens.size);
};

const freshness = (
  publishedAt: string | undefined,
  dateConfidence: RawEvidence["dateConfidence"],
  now: Date,
  lookbackDays: number,
): number => {
  if (!publishedAt || dateConfidence === "unknown") {
    return 0.25;
  }
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) {
    return 0.25;
  }
  const ageDays = Math.max(0, (now.getTime() - timestamp) / 86_400_000);
  const windowDays = Math.max(1, lookbackDays);
  const base = clamp01(1 - ageDays / windowDays);
  return dateConfidence === "derived" ? base * 0.8 : base;
};

const engagementScore = (source: ResearchSource, engagement: Record<string, number> | undefined): number => {
  const values = engagement ?? {};
  if (source === "github") {
    return clamp01(
      numberValue(values.stars) / 2_000
      + numberValue(values.forks) / 5_000
      + Math.min(numberValue(values.openIssues), 250) / 10_000,
    );
  }
  if (source === "hackernews") {
    return clamp01(numberValue(values.points) / 500 + numberValue(values.comments) / 1_000);
  }
  if (source === "polymarket") {
    return clamp01(numberValue(values.volume) / 100_000 + numberValue(values.liquidity) / 50_000);
  }
  return clamp01(numberValue(values.rank) > 0 ? 1 / Math.max(1, numberValue(values.rank)) : 0);
};

const scoreEvidence = (
  source: ResearchSource,
  plan: RecentResearchBriefPlan,
  subquery: RecentResearchSubquery,
  raw: RawEvidence,
  now: Date,
): RecentResearchEvidenceScores => {
  const relevanceScore = relevance(`${subquery.searchQuery} ${subquery.rankingQuery}`, raw.title, raw.snippet);
  const freshnessScore = freshness(raw.publishedAt, raw.dateConfidence, now, plan.lookbackDays);
  const engagement = engagementScore(source, raw.engagement);
  const sourceQuality = SOURCE_QUALITY[source];
  const finalLocalScore = clamp01(
    0.6 * relevanceScore
    + 0.25 * freshnessScore
    + 0.1 * engagement
    + 0.05 * sourceQuality,
  );
  return {
    relevance: Number(relevanceScore.toFixed(4)),
    freshness: Number(freshnessScore.toFixed(4)),
    engagement: Number(engagement.toFixed(4)),
    sourceQuality: Number(sourceQuality.toFixed(4)),
    finalLocalScore: Number(finalLocalScore.toFixed(4)),
  };
};

const normalizeEvidence = (
  raw: RawEvidence,
  context: AdapterContext,
  index: number,
): RecentResearchEvidenceItem => ({
  id: buildId(raw.source, context.subquery.label, index, raw.url),
  source: raw.source,
  title: raw.title,
  url: raw.url,
  author: raw.author,
  container: raw.container,
  publishedAt: raw.publishedAt,
  dateConfidence: raw.dateConfidence,
  snippet: raw.snippet,
  engagement: raw.engagement,
  relevanceHint: context.subquery.rankingQuery,
  retrievedAt: context.retrievedAt,
  queryPlanId: `${context.plan.schemaVersion}:${context.plan.topic}`,
  subqueryLabel: context.subquery.label,
  unsafeContentWarning: true,
  scores: scoreEvidence(raw.source, context.plan, context.subquery, raw, context.now),
});

const isUsefulEvidence = (item: RecentResearchEvidenceItem): boolean =>
  item.scores.relevance >= MIN_USEFUL_RELEVANCE
  && item.scores.finalLocalScore >= MIN_USEFUL_FINAL_SCORE;

const normalizeGithubRepository = (value: unknown): RawEvidence[] => {
  const record = getRecord(value);
  const owner = getRecord(record.owner);
  const title = text(record.full_name) ?? text(record.name);
  const url = text(record.html_url);
  if (!title || !url) {
    return [];
  }
  return [{
    source: "github",
    title,
    url,
    author: text(owner.login),
    container: "GitHub repository",
    publishedAt: text(record.updated_at) ?? text(record.created_at),
    dateConfidence: text(record.updated_at) || text(record.created_at) ? "exact" : "unknown",
    snippet: text(record.description) ?? "GitHub repository result",
    engagement: {
      stars: numberValue(record.stargazers_count),
      forks: numberValue(record.forks_count),
      openIssues: numberValue(record.open_issues_count),
    },
  }];
};

const githubAdapter = async (context: AdapterContext): Promise<RawEvidence[]> => {
  const repoQuery = detectGithubRepoQuery(context.subquery.searchQuery);
  if (repoQuery) {
    const owner = encodeURIComponent(repoQuery.owner);
    const repo = encodeURIComponent(repoQuery.repo);
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const payload = await json(await context.fetchFn(url, {
      headers: { accept: "application/vnd.github+json" },
      signal: context.signal,
    }));
    return normalizeGithubRepository(payload).slice(0, context.limit);
  }

  const query = encodeURIComponent(`${context.subquery.searchQuery} in:name,description`);
  const url = `https://api.github.com/search/repositories?q=${query}&sort=updated&order=desc&per_page=${context.limit}`;
  const payload = getRecord(await json(await context.fetchFn(url, {
    headers: { accept: "application/vnd.github+json" },
    signal: context.signal,
  })));
  const items = Array.isArray(payload.items) ? payload.items.slice(0, context.limit) : [];
  return items.flatMap((item): RawEvidence[] => normalizeGithubRepository(item));
};

const hackerNewsAdapter = async (context: AdapterContext): Promise<RawEvidence[]> => {
  const query = encodeURIComponent(context.subquery.searchQuery);
  const tags = "story";
  const url = `https://hn.algolia.com/api/v1/search?query=${query}&tags=${tags}&hitsPerPage=${context.limit}`;
  const payload = getRecord(await json(await context.fetchFn(url, { signal: context.signal })));
  const hits = Array.isArray(payload.hits) ? payload.hits.slice(0, context.limit) : [];
  return hits.flatMap((hit): RawEvidence[] => {
    const record = getRecord(hit);
    const title = text(record.title) ?? text(record.story_title);
    const url = text(record.url) ?? text(record.story_url);
    if (!title || !url) {
      return [];
    }
    return [{
      source: "hackernews",
      title,
      url,
      author: text(record.author),
      container: text(record.objectID) ? `Hacker News ${text(record.objectID)}` : "Hacker News",
      publishedAt: text(record.created_at),
      dateConfidence: text(record.created_at) ? "exact" : "unknown",
      snippet: text(record.comment_text) ?? title,
      engagement: {
        points: numberValue(record.points),
        comments: numberValue(record.num_comments),
      },
    }];
  });
};

const polymarketAdapter = async (context: AdapterContext): Promise<RawEvidence[]> => {
  const query = encodeURIComponent(context.subquery.searchQuery);
  const url = `https://gamma-api.polymarket.com/markets?search=${query}&limit=${context.limit}&closed=false`;
  const payload = await json(await context.fetchFn(url, { signal: context.signal }));
  const markets = Array.isArray(payload)
    ? payload.slice(0, context.limit)
    : Array.isArray(getRecord(payload).markets)
      ? (getRecord(payload).markets as unknown[]).slice(0, context.limit)
      : [];
  return markets.flatMap((market): RawEvidence[] => {
    const record = getRecord(market);
    const title = text(record.question) ?? text(record.title);
    const slug = text(record.slug);
    const id = text(record.id);
    const url = slug
      ? `https://polymarket.com/event/${slug}`
      : id
        ? `https://polymarket.com/market/${id}`
        : undefined;
    if (!title || !url) {
      return [];
    }
    const date = text(record.startDate) ?? text(record.createdAt) ?? text(record.created_at);
    return [{
      source: "polymarket",
      title,
      url,
      container: "Polymarket market",
      publishedAt: date,
      dateConfidence: date ? "exact" : "unknown",
      snippet: text(record.description) ?? title,
      engagement: {
        volume: numberValue(record.volume),
        liquidity: numberValue(record.liquidity),
      },
    }];
  });
};

const webAdapter = async (
  context: AdapterContext,
  adapter: RecentResearchWebSearchAdapter | undefined,
): Promise<RawEvidence[]> => {
  if (!adapter) {
    return [];
  }
  const results = (await adapter({
    plan: context.plan,
    subquery: context.subquery,
    limit: context.limit,
    signal: context.signal,
  })).slice(0, context.limit);
  return results.flatMap((result): RawEvidence[] => {
    if (!result.title.trim() || !result.url.trim()) {
      return [];
    }
    return [{
      source: "web",
      title: result.title.trim(),
      url: result.url.trim(),
      author: result.author,
      container: result.container,
      publishedAt: result.publishedAt,
      dateConfidence: result.publishedAt ? "derived" : "unknown",
      snippet: result.snippet?.trim() || result.title.trim(),
      engagement: result.engagement,
    }];
  });
};

const retrieveForSource = async (
  source: ResearchSource,
  context: AdapterContext,
  webSearchAdapter: RecentResearchWebSearchAdapter | undefined,
): Promise<RawEvidence[]> => {
  if (source === "github") {
    return githubAdapter(context);
  }
  if (source === "hackernews") {
    return hackerNewsAdapter(context);
  }
  if (source === "polymarket") {
    return polymarketAdapter(context);
  }
  if (source === "web") {
    return webAdapter(context, webSearchAdapter);
  }
  throw new Error(`${source} retrieval adapter is not implemented in BUILD R2`);
};

export async function retrieveRecentResearchEvidence(
  plan: RecentResearchBriefPlan,
  options: RecentResearchRetrievalOptions = {},
): Promise<RecentResearchEvidenceReport> {
  const now = options.now ?? new Date();
  const retrievedAt = now.toISOString();
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 30_000);
  const perSourceLimit = boundedInteger(options.perSourceLimit, DEFAULT_PER_SOURCE_LIMIT, MAX_PER_SOURCE_LIMIT);
  const totalLimit = boundedInteger(options.totalLimit, DEFAULT_TOTAL_LIMIT, MAX_TOTAL_LIMIT);
  const fetchFn = options.fetch ?? globalThis.fetch;
  const evidence: RecentResearchEvidenceItem[] = [];
  const degradedSources: RecentResearchEvidenceReport["degradedSources"] = [];
  const warnings: string[] = [];
  const perSourceCounts = new Map<ResearchSource, number>();
  const seenUrls = new Set<string>();

  if (!fetchFn) {
    warnings.push("No fetch implementation was available for first-party source adapters.");
  }

  for (const subquery of plan.subqueries) {
    for (const source of subquery.sources) {
      if (evidence.length >= totalLimit) {
        break;
      }

      const usedForSource = perSourceCounts.get(source) ?? 0;
      const remainingForSource = perSourceLimit - usedForSource;
      if (remainingForSource <= 0) {
        continue;
      }
      if (source !== "web" && !fetchFn) {
        degradedSources.push({ source, reason: "No fetch implementation available", subqueryLabel: subquery.label });
        warnings.push(`${source} retrieval degraded for ${subquery.label}: no fetch implementation available.`);
        continue;
      }

      const limit = Math.min(remainingForSource, totalLimit - evidence.length);
      const contextBase = {
        plan,
        subquery,
        limit,
        fetchFn,
        now,
        retrievedAt,
      };

      try {
        const rawItems = await withTimeout(timeoutMs, (signal) =>
          retrieveForSource(source, { ...contextBase, signal }, options.webSearchAdapter));
        if (rawItems.length === 0) {
          if (source === "web" && !options.webSearchAdapter) {
            degradedSources.push({
              source,
              reason: "No injected web search adapter was provided",
              subqueryLabel: subquery.label,
            });
            warnings.push(`web retrieval skipped for ${subquery.label}: no injected web search adapter.`);
          }
          continue;
        }
        const normalized = rawItems
          .filter((item) => {
            const key = item.url.toLowerCase();
            if (seenUrls.has(key)) {
              return false;
            }
            seenUrls.add(key);
            return true;
          })
          .slice(0, limit)
          .map((item, index) => normalizeEvidence(item, { ...contextBase, signal: new AbortController().signal }, index));
        const useful = normalized.filter(isUsefulEvidence);
        if (normalized.length > 0 && useful.length === 0) {
          warnings.push(`${source} retrieval returned only low-relevance evidence for ${subquery.label}.`);
        }
        evidence.push(...useful);
        perSourceCounts.set(source, usedForSource + useful.length);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown adapter failure";
        degradedSources.push({ source, reason, subqueryLabel: subquery.label });
        warnings.push(`${source} retrieval degraded for ${subquery.label}: ${reason}`);
      }
    }
  }

  evidence.sort((left, right) => right.scores.finalLocalScore - left.scores.finalLocalScore);

  return {
    schemaVersion: "1.0.0",
    topic: plan.topic,
    plan,
    evidence: evidence.slice(0, totalLimit),
    degradedSources,
    warnings,
    retrievedAt,
  };
}
