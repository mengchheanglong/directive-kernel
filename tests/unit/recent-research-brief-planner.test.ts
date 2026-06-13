import { describe, expect, it } from "vitest";

import {
  deriveRecentResearchBriefPlan,
  type RecentResearchBriefInput,
} from "../../discovery/lib/research-planner/recent-research-brief.ts";

const makeInput = (overrides: Partial<RecentResearchBriefInput>): RecentResearchBriefInput => ({
  topic: "placeholder",
  lookbackDays: 30,
  intent: "auto",
  sources: [],
  depth: "default",
  requireCitations: true,
  ...overrides,
});

describe("deriveRecentResearchBriefPlan", () => {
  it("returns schemaVersion", () => {
    const plan = deriveRecentResearchBriefPlan(makeInput({ topic: "bounded source extraction plan" }));
    expect(plan.schemaVersion).toBe("1.0.0");
  });

  it("routes repository and tool queries toward github tooling", () => {
    const plan = deriveRecentResearchBriefPlan(
      makeInput({
        topic: "repo: acme/markdown-cli supports repo and tool publishing",
        sources: ["github", "hackernews", "web"],
      }),
    );

    expect(plan.intent).toBe("product");
    expect(plan.sourceWeights.find((item) => item.source === "github")?.weight).toBeGreaterThan(0.4);
    expect(plan.subqueries.some((subquery) => subquery.sources.includes("github"))).toBe(true);
    expect(plan.warnings).toHaveLength(0);
  });

  it("routes developer concept queries through hackernews-aware sources", () => {
    const plan = deriveRecentResearchBriefPlan(
      makeInput({
        topic: "How do developer teams design routing architecture for large language model pipelines?",
        sources: ["github", "hackernews"],
      }),
    );

    expect(plan.intent).toBe("concept");
    const hnEntry = plan.sourceWeights.find((item) => item.source === "hackernews");
    expect(hnEntry).toBeDefined();
    expect(hnEntry!.weight).toBeGreaterThan(0.2);
    expect(plan.subqueries.some((subquery) => subquery.sources.includes("hackernews"))).toBe(true);
  });

  it("enables prediction flow and includes polymarket only for prediction-shaped planning", () => {
    const plan = deriveRecentResearchBriefPlan(
      makeInput({
        topic: "What is the probability market says about next quarter inflation trend?",
        lookbackDays: 14,
        sources: ["github", "hackernews", "polymarket", "reddit_public"],
      }),
    );

    expect(plan.intent).toBe("prediction");
    expect(plan.sourceWeights.find((item) => item.source === "polymarket")).toBeDefined();
    expect(plan.subqueries.some((subquery) => subquery.sources.includes("polymarket"))).toBe(true);
    expect(plan.freshnessMode).toBe("balanced_recent");
  });

  it("produces entity-aware subqueries for comparison queries", () => {
    const plan = deriveRecentResearchBriefPlan(
      makeInput({
        topic: "LangChain vs CrewAI benchmark results",
        depth: "quick",
        sources: ["github", "hackernews", "web"],
      }),
    );

    expect(plan.intent).toBe("comparison");
    expect(plan.subqueries.length).toBeGreaterThanOrEqual(2);
    expect(plan.subqueries[0].label).toContain("compare");
    expect(plan.subqueries[0].searchQuery).toContain("LangChain");
    expect(plan.subqueries[1].searchQuery).toContain("CrewAI");
  });

  it("flags generic keyword-trap topics with reframe or clarification", () => {
    const plan = deriveRecentResearchBriefPlan(
      makeInput({
        topic: "latest updates",
        depth: "quick",
      }),
    );

    expect(plan.clarifyingQuestions.length).toBeGreaterThan(0);
    expect(plan.reframe).toBeDefined();
    expect(plan.warnings.some((warning) => warning.includes("Generic query"))).toBe(true);
    expect(plan.subqueries[0].label).toBe("clarify_topic");
  });

  it("excludes unsafe requested sources with explicit reasons", () => {
    const plan = deriveRecentResearchBriefPlan(
      makeInput({
        topic: "document pipeline for release notes",
        sources: ["github", "x_twitter", "scrapecreators", "tiktok"],
      }),
    );

    const excluded = plan.excludedSources.map((entry) => entry.source).sort();
    expect(excluded).toContain("x_twitter");
    expect(excluded).toContain("scrapecreators");
    expect(excluded).toContain("tiktok");
    expect(plan.excludedSources.every((entry) => entry.reason.length > 0)).toBe(true);
    expect(plan.sourceWeights.find((entry) => entry.source === "github")).toBeDefined();
    expect(plan.sourceWeights.find((item) => item.source === "polymarket")).toBeUndefined();
  });

  it("falls back to safe web source when all requested sources are unsafe", () => {
    const plan = deriveRecentResearchBriefPlan(
      makeInput({
        topic: "release notes comparison for framework updates",
        sources: ["x_twitter", "scrapecreators", "tiktok"],
      }),
    );

    const excluded = plan.excludedSources.map((entry) => entry.source).sort();
    expect(excluded).toEqual(["scrapecreators", "tiktok", "x_twitter"]);
    expect(plan.sourceWeights.find((entry) => entry.source === "web")).toBeDefined();
    expect(plan.sourceWeights.find((entry) => entry.source === "github")).toBeUndefined();
    expect(plan.sourceWeights.find((entry) => entry.source === "hackernews")).toBeUndefined();
    expect(plan.subqueries.every((subquery) => subquery.sources.length > 0)).toBe(true);
    expect(plan.subqueries.every((subquery) => subquery.sources.includes("web"))).toBe(true);
    expect(plan.warnings.some((warning) => warning.includes("falling back to safe defaults"))).toBe(true);
  });

  it("keeps unsafe-only comparison subqueries constrained to web", () => {
    const plan = deriveRecentResearchBriefPlan(
      makeInput({
        topic: "LangChain vs CrewAI benchmark results",
        sources: ["x_twitter", "tiktok", "scrapecreators"],
        depth: "default",
      }),
    );

    expect(plan.sourceWeights).toEqual([{ source: "web", weight: 1 }]);
    expect(plan.subqueries.length).toBeGreaterThan(0);
    expect(plan.subqueries.every((subquery) => subquery.sources.every((source) => source === "web"))).toBe(true);
  });

  it("does not reintroduce github or hackernews for unsafe-only repo requests", () => {
    const plan = deriveRecentResearchBriefPlan(
      makeInput({
        topic: "repo: acme/markdown-cli supports repo and tool publishing",
        sources: ["x_twitter", "tiktok", "scrapecreators"],
        depth: "default",
      }),
    );

    expect(plan.sourceWeights).toEqual([{ source: "web", weight: 1 }]);
    expect(plan.subqueries.length).toBeGreaterThan(0);
    expect(plan.subqueries.every((subquery) => subquery.sources.every((source) => source === "web"))).toBe(true);
  });

  it("keeps explicit web-only comparison requests constrained to web", () => {
    const plan = deriveRecentResearchBriefPlan(
      makeInput({
        topic: "LangChain vs CrewAI benchmark results",
        sources: ["web"],
        depth: "default",
      }),
    );

    expect(plan.sourceWeights).toEqual([{ source: "web", weight: 1 }]);
    expect(plan.subqueries.length).toBeGreaterThan(0);
    expect(plan.subqueries.every((subquery) => subquery.sources.every((source) => source === "web"))).toBe(true);
  });
});
