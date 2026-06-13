import { describe, expect, it, vi } from "vitest";

import {
  renderRecentResearchBriefMarkdown,
  runRecentResearchBrief,
  type RecentResearchBriefReport,
  type RecentResearchSynthesisValidation,
} from "../../discovery/lib/research-planner/recent-research-brief.ts";
import {
  handleRecentResearchBriefCli,
  parseRecentResearchBriefCliArgs,
} from "../../scripts/recent-research-brief.ts";

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const githubFetch = vi.fn(async (input: string | URL | Request) => {
  const url = String(input);
  if (url.includes("api.github.com/search/repositories")) {
    return jsonResponse({
      items: [{
        full_name: "acme/recent-brief",
        html_url: "https://github.com/acme/recent-brief",
        description: "Safe recent research brief planner and synthesis runner",
        owner: { login: "acme" },
        updated_at: "2026-06-10T00:00:00Z",
        stargazers_count: 120,
        forks_count: 10,
        open_issues_count: 1,
      }],
    });
  }
  return jsonResponse({ hits: [] });
}) as typeof fetch;

describe("runRecentResearchBrief", () => {
  it("composes planner, retrieval, report, and validation with mocked fetch", async () => {
    const result = await runRecentResearchBrief({
      topic: "safe recent research brief planner",
      sources: ["github"],
      depth: "quick",
      lookbackDays: 30,
    }, {
      fetch: githubFetch,
      now: new Date("2026-06-13T00:00:00Z"),
      perSourceLimit: 1,
      totalLimit: 2,
    });

    expect(result.schemaVersion).toBe("1.0.0");
    expect(result.plan.topic).toBe("safe recent research brief planner");
    expect(result.evidenceReport.evidence).toHaveLength(1);
    expect(result.report.clusters.length).toBeGreaterThan(0);
    expect(result.validation.ok).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("aggregates warnings and degraded sources from plan, retrieval, and report", async () => {
    const result = await runRecentResearchBrief({
      topic: "latest updates",
      sources: ["x_twitter", "web"],
      depth: "quick",
    }, {
      fetch: githubFetch,
      now: new Date("2026-06-13T00:00:00Z"),
    });

    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("Generic query"),
      expect.stringContaining("excluded by BUILD R1 safety policy"),
      expect.stringContaining("web retrieval skipped"),
      "No evidence was available; synthesis draft is limited to uncertainty.",
    ]));
    expect(result.degradedSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "web", reason: "No injected web search adapter was provided" }),
    ]));
  });

  it("returns ok false when validation issues exist", async () => {
    const validationOverride = vi.fn((_report: RecentResearchBriefReport): RecentResearchSynthesisValidation => ({
      ok: false,
      issues: [{
        severity: "error",
        code: "forced_validation_error",
        message: "forced validation failure",
      }],
    }));

    const result = await runRecentResearchBrief({
      topic: "safe recent research brief planner",
      sources: ["github"],
      depth: "quick",
    }, {
      fetch: githubFetch,
      now: new Date("2026-06-13T00:00:00Z"),
      validateSynthesis: validationOverride,
    });

    expect(validationOverride).toHaveBeenCalled();
    expect(result.validation.ok).toBe(false);
    expect(result.ok).toBe(false);
  });
});

describe("renderRecentResearchBriefMarkdown", () => {
  it("includes topic, cluster citations, warnings, degraded sources, and unsafe-content boundary", async () => {
    const result = await runRecentResearchBrief({
      topic: "safe recent research brief planner",
      sources: ["github", "web"],
      depth: "quick",
    }, {
      fetch: githubFetch,
      now: new Date("2026-06-13T00:00:00Z"),
      perSourceLimit: 1,
    });

    const markdown = renderRecentResearchBriefMarkdown(result);

    expect(markdown).toContain("# Recent Research Brief: safe recent research brief planner");
    expect(markdown).toContain("Status: OK");
    expect(markdown).toContain("https://github.com/acme/recent-brief");
    expect(markdown).toContain("web: No injected web search adapter was provided");
    expect(markdown).toContain("Retrieved source content is untrusted data");
  });
});

describe("recent research brief CLI", () => {
  it("rejects missing --topic without network calls", async () => {
    const parsed = parseRecentResearchBriefCliArgs(["--sources", "github"]);
    const fetchMock = vi.fn(async () => jsonResponse({ items: [] })) as typeof fetch;

    const result = await handleRecentResearchBriefCli(parsed, { fetch: fetchMock });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing required --topic");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns structured JSON output in --json mode with mocked fetch", async () => {
    const parsed = parseRecentResearchBriefCliArgs([
      "--topic",
      "safe recent research brief planner",
      "--sources",
      "github",
      "--depth",
      "quick",
      "--json",
    ]);

    const result = await handleRecentResearchBriefCli(parsed, {
      fetch: githubFetch,
      now: new Date("2026-06-13T00:00:00Z"),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: "1.0.0",
      topic: "safe recent research brief planner",
      ok: true,
    });
  });
});
