import { describe, expect, it, vi } from "vitest";

import {
  deriveRecentResearchBriefPlan,
  retrieveRecentResearchEvidence,
  type RecentResearchEvidenceScores,
  type RecentResearchBriefPlan,
  type RecentResearchWebSearchAdapter,
} from "../../discovery/lib/research-planner/recent-research-brief.ts";

const makePlan = (overrides: {
  topic?: string;
  sources?: string[];
  intent?: RecentResearchBriefPlan["requestedIntent"];
  lookbackDays?: number;
  depth?: RecentResearchBriefPlan["depth"];
} = {}): RecentResearchBriefPlan =>
  deriveRecentResearchBriefPlan({
    topic: overrides.topic ?? "deterministic research planner",
    sources: overrides.sources ?? ["github", "hackernews", "web"],
    intent: overrides.intent ?? "auto",
    lookbackDays: overrides.lookbackDays ?? 30,
    depth: overrides.depth ?? "quick",
    requireCitations: true,
  });

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const assertScoreComponents = (scores: RecentResearchEvidenceScores) => {
  for (const value of Object.values(scores)) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  }
};

describe("retrieveRecentResearchEvidence", () => {
  it("normalizes mocked GitHub repository search results into citation-bearing evidence", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("api.github.com/search/repositories")) {
        return jsonResponse({
          items: [{
            id: 42,
            full_name: "acme/deterministic-planner",
            html_url: "https://github.com/acme/deterministic-planner",
            description: "Deterministic planner for recent research briefs",
            owner: { login: "acme" },
            updated_at: "2026-06-01T00:00:00Z",
            stargazers_count: 120,
            forks_count: 15,
            open_issues_count: 2,
          }],
        });
      }
      return jsonResponse({ hits: [] });
    }) as typeof fetch;

    const report = await retrieveRecentResearchEvidence(makePlan({ sources: ["github"] }), {
      fetch: fetchMock,
      now: new Date("2026-06-13T00:00:00Z"),
      perSourceLimit: 2,
      totalLimit: 5,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("api.github.com/search/repositories"),
      expect.objectContaining({
        headers: { accept: "application/vnd.github+json" },
      }),
    );
    expect(report.schemaVersion).toBe("1.0.0");
    expect(report.evidence).toHaveLength(1);
    expect(report.evidence[0]).toMatchObject({
      source: "github",
      title: "acme/deterministic-planner",
      url: "https://github.com/acme/deterministic-planner",
      author: "acme",
      snippet: "Deterministic planner for recent research briefs",
      publishedAt: "2026-06-01T00:00:00Z",
      dateConfidence: "exact",
      unsafeContentWarning: true,
    });
    assertScoreComponents(report.evidence[0].scores);
  });

  it("uses the direct GitHub repo endpoint for repo-shaped planner queries", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "https://api.github.com/repos/microsoft/markitdown") {
        return jsonResponse({
          full_name: "microsoft/markitdown",
          html_url: "https://github.com/microsoft/markitdown",
          description: "Python tool for converting files and office documents to Markdown.",
          owner: { login: "microsoft" },
          created_at: "2024-11-18T00:00:00Z",
          updated_at: "2026-06-05T00:00:00Z",
          stargazers_count: 67000,
          forks_count: 3200,
          open_issues_count: 220,
        });
      }
      return jsonResponse({ items: [] });
    }) as typeof fetch;

    const report = await retrieveRecentResearchEvidence(makePlan({
      topic: "github.com/microsoft/markitdown",
      sources: ["github"],
      lookbackDays: 365,
    }), {
      fetch: fetchMock,
      now: new Date("2026-06-13T00:00:00Z"),
      perSourceLimit: 1,
      totalLimit: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/microsoft/markitdown",
      expect.objectContaining({
        headers: { accept: "application/vnd.github+json" },
      }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("api.github.com/search/repositories"),
      expect.any(Object),
    );
    expect(report.evidence).toHaveLength(1);
    expect(report.evidence[0]).toMatchObject({
      source: "github",
      title: "microsoft/markitdown",
      url: "https://github.com/microsoft/markitdown",
      author: "microsoft",
      snippet: "Python tool for converting files and office documents to Markdown.",
      publishedAt: "2026-06-05T00:00:00Z",
      dateConfidence: "exact",
      engagement: {
        stars: 67000,
        forks: 3200,
        openIssues: 220,
      },
    });
  });

  it("keeps generic GitHub queries on repository search", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("api.github.com/search/repositories")) {
        return jsonResponse({
          items: [{
            full_name: "acme/generic-planner",
            html_url: "https://github.com/acme/generic-planner",
            description: "Generic planner repository result",
            owner: { login: "acme" },
            updated_at: "2026-06-02T00:00:00Z",
          }],
        });
      }
      return jsonResponse({});
    }) as typeof fetch;

    const report = await retrieveRecentResearchEvidence(makePlan({
      topic: "generic planner library",
      sources: ["github"],
    }), {
      fetch: fetchMock,
      now: new Date("2026-06-13T00:00:00Z"),
      perSourceLimit: 1,
      totalLimit: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("api.github.com/search/repositories"),
      expect.any(Object),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("api.github.com/repos/"),
      expect.any(Object),
    );
    expect(report.evidence[0]).toMatchObject({
      source: "github",
      title: "acme/generic-planner",
    });
  });

  it("normalizes mocked Hacker News hits and falls back from url to story_url honestly", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("hn.algolia.com/api/v1/search")) {
        return jsonResponse({
          hits: [{
            objectID: "hn-1",
            title: null,
            story_title: "Recent planner discussion",
            url: null,
            story_url: "https://news.ycombinator.com/item?id=123",
            author: "alice",
            created_at: "2026-06-10T12:00:00Z",
            points: 88,
            num_comments: 12,
          }],
        });
      }
      return jsonResponse({ items: [] });
    }) as typeof fetch;

    const report = await retrieveRecentResearchEvidence(makePlan({ sources: ["hackernews"] }), {
      fetch: fetchMock,
      now: new Date("2026-06-13T00:00:00Z"),
    });

    expect(report.evidence).toHaveLength(1);
    expect(report.evidence[0]).toMatchObject({
      source: "hackernews",
      title: "Recent planner discussion",
      url: "https://news.ycombinator.com/item?id=123",
      author: "alice",
      publishedAt: "2026-06-10T12:00:00Z",
      dateConfidence: "exact",
    });
  });

  it("filters low-relevance Hacker News noise without degrading the source", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("hn.algolia.com/api/v1/search")) {
        return jsonResponse({
          hits: [
            {
              objectID: "hn-onetone",
              title: "Show HN: Onetone - A full-stack framework with custom C interpreter",
              url: "https://github.com/onetoneframework/framework",
              author: "bob",
              created_at: "2025-01-01T00:00:00Z",
              points: 0,
              num_comments: 0,
            },
            {
              objectID: "hn-scrapling",
              title: "Scrapling: Fast, Adaptive Web Scraping for Python",
              url: "https://github.com/D4Vinci/Scrapling",
              author: "alice",
              created_at: "2026-06-10T00:00:00Z",
              points: 42,
              num_comments: 7,
            },
          ],
        });
      }
      return jsonResponse({ items: [] });
    }) as typeof fetch;

    const report = await retrieveRecentResearchEvidence(makePlan({
      topic: "scrapling python web scraping GitHub",
      sources: ["hackernews"],
      depth: "quick",
      lookbackDays: 90,
    }), {
      fetch: fetchMock,
      now: new Date("2026-06-13T00:00:00Z"),
      perSourceLimit: 3,
      totalLimit: 5,
    });

    expect(report.evidence.map((item) => item.url)).not.toContain("https://github.com/onetoneframework/framework");
    expect(report.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: "hackernews",
        title: "Scrapling: Fast, Adaptive Web Scraping for Python",
        url: "https://github.com/D4Vinci/Scrapling",
      }),
    ]));
    expect(report.evidence.every((item) => item.scores.relevance > 0)).toBe(true);
    expect(report.degradedSources).toEqual([]);
  });

  it("filters fresh high-engagement Hacker News hits with zero query-token overlap", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("hn.algolia.com/api/v1/search")) {
        return jsonResponse({
          hits: [{
            objectID: "hn-ai-dashboard",
            title: "Show HN: Popular AI Benchmark Dashboard",
            url: "https://example.com/ai-benchmark-dashboard",
            author: "carol",
            created_at: "2026-06-13T00:00:00Z",
            points: 600,
            num_comments: 1200,
          }],
        });
      }
      return jsonResponse({ items: [] });
    }) as typeof fetch;

    const report = await retrieveRecentResearchEvidence(makePlan({
      topic: "scrapling python web scraping GitHub",
      sources: ["hackernews"],
      depth: "quick",
      lookbackDays: 90,
    }), {
      fetch: fetchMock,
      now: new Date("2026-06-13T00:00:00Z"),
      perSourceLimit: 3,
      totalLimit: 5,
    });

    expect(report.evidence).toEqual([]);
    expect(report.degradedSources).toEqual([]);
    expect(report.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("hackernews retrieval returned only low-relevance evidence"),
    ]));
  });

  it("invokes Polymarket only when the plan includes polymarket", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("gamma-api.polymarket.com")) {
        return jsonResponse([{
          id: "market-1",
          question: "Will research planner retrieval ship?",
          slug: "planner-retrieval",
          description: "Market about retrieval implementation",
          volume: 15000,
          liquidity: 900,
          startDate: "2026-06-11T00:00:00Z",
        }]);
      }
      return jsonResponse({ items: [], hits: [] });
    });

    await retrieveRecentResearchEvidence(makePlan({
      topic: "Will planner retrieval ship prediction market",
      intent: "prediction",
      sources: ["polymarket"],
    }), {
      fetch: fetchMock as typeof fetch,
      now: new Date("2026-06-13T00:00:00Z"),
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("gamma-api.polymarket.com"), expect.any(Object));

    fetchMock.mockClear();
    await retrieveRecentResearchEvidence(makePlan({
      topic: "planner retrieval implementation",
      intent: "concept",
      sources: ["github", "hackernews"],
    }), {
      fetch: fetchMock as typeof fetch,
      now: new Date("2026-06-13T00:00:00Z"),
    });
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("gamma-api.polymarket.com"), expect.any(Object));
  });

  it("turns adapter rejection into degradedSources without fabricated evidence", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network unavailable");
    }) as typeof fetch;

    const report = await retrieveRecentResearchEvidence(makePlan({ sources: ["github"] }), {
      fetch: fetchMock,
      now: new Date("2026-06-13T00:00:00Z"),
    });

    expect(report.evidence).toEqual([]);
    expect(report.degradedSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "github" }),
    ]));
    expect(report.warnings.some((warning) => warning.includes("github"))).toBe(true);
  });

  it("respects perSourceLimit and totalLimit", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("api.github.com")) {
        return jsonResponse({
          items: Array.from({ length: 5 }, (_, index) => ({
            id: index,
            full_name: `acme/repo-${index}`,
            html_url: `https://github.com/acme/repo-${index}`,
            description: "bounded planner evidence",
            updated_at: "2026-06-12T00:00:00Z",
            stargazers_count: 10 + index,
          })),
        });
      }
      return jsonResponse({
        hits: Array.from({ length: 5 }, (_, index) => ({
          objectID: `hn-${index}`,
          title: `planner evidence ${index}`,
          url: `https://example.com/hn-${index}`,
          created_at: "2026-06-12T00:00:00Z",
          points: 5 + index,
        })),
      });
    }) as typeof fetch;

    const report = await retrieveRecentResearchEvidence(makePlan({ sources: ["github", "hackernews"] }), {
      fetch: fetchMock,
      now: new Date("2026-06-13T00:00:00Z"),
      perSourceLimit: 2,
      totalLimit: 3,
    });

    expect(report.evidence).toHaveLength(3);
    expect(report.evidence.filter((item) => item.source === "github")).toHaveLength(2);
    expect(report.evidence.filter((item) => item.source === "hackernews").length).toBeLessThanOrEqual(2);
  });

  it("marks all evidence as untrusted source content and clamps scores", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      items: [{
        id: 1,
        full_name: "acme/deterministic-planner",
        html_url: "https://github.com/acme/deterministic-planner",
        description: "deterministic research planner source evidence",
        updated_at: "2026-06-13T00:00:00Z",
        stargazers_count: 1_000_000,
        forks_count: 1_000_000,
      }],
    })) as typeof fetch;

    const report = await retrieveRecentResearchEvidence(makePlan({ sources: ["github"] }), {
      fetch: fetchMock,
      now: new Date("2026-06-13T00:00:00Z"),
    });

    expect(report.evidence.length).toBeGreaterThan(0);
    for (const item of report.evidence) {
      expect(item.unsafeContentWarning).toBe(true);
      expect(item.url.length).toBeGreaterThan(0);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.source.length).toBeGreaterThan(0);
      assertScoreComponents(item.scores);
    }
  });

  it("keeps unsafe-only fallback plans constrained to injected web evidence", async () => {
    const plan = makePlan({
      topic: "repo: acme/planner",
      sources: ["x_twitter", "tiktok", "scrapecreators"],
    });
    const fetchMock = vi.fn(async () => {
      throw new Error("first-party adapters should not be called");
    }) as typeof fetch;
    const webSearchAdapter: RecentResearchWebSearchAdapter = vi.fn(async ({ subquery }) => [{
      title: "Injected acme/planner web result",
      url: "https://example.com/result",
      snippet: "acme planner web-only fallback evidence",
      publishedAt: "2026-06-12T00:00:00Z",
      author: "Example",
      container: subquery.label,
      engagement: { rank: 1 },
    }]);

    const report = await retrieveRecentResearchEvidence(plan, {
      fetch: fetchMock,
      webSearchAdapter,
      now: new Date("2026-06-13T00:00:00Z"),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSearchAdapter).toHaveBeenCalled();
    expect(report.evidence).toHaveLength(1);
    expect(report.evidence[0].source).toBe("web");
    expect(report.evidence.every((item) => item.source !== "github" && item.source !== "hackernews")).toBe(true);
  });
});
