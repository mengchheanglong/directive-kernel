import { describe, it, expect } from "vitest";
import { assessEngineRouting } from "../../engine/routing/assessment.ts";
import { validateRoutingJudgment, applyRoutingJudgment } from "../../engine/routing/judgment.ts";
import type { RoutingJudgment } from "../../engine/routing/judgment.ts";

const MOCK_SOURCE = {
  title: "Improve routing with LLM judgment for Discovery lane",
  sourceRef: "https://github.com/example/routing-judgment",
  summary:
    "This proposal adds a structured judgment seam that lets an LLM operator override keyword-based routing decisions. The keyword engine stays as the deterministic prior and the ledger records disagreements.",
  sourceType: "internal-signal" as const,
  receivedAt: "2026-06-12T00:00:00.000Z",
  sourceOrigin: "github-repo" as const,
};

const MOCK_MISSION = {
  missionId: null,
  currentObjective: "Improve routing infrastructure with structured LLM judgment overrides",
  usefulnessSignals: [],
  constraints: [],
  capabilityLanes: [],
  successSignal: "",
  adoptionTarget: null,
  activeMissionMarkdown: "",
};

const VALID_JUDGMENT: RoutingJudgment = {
  schemaVersion: 1,
  judgmentId: "rj-abc12345",
  judgedAt: "2026-06-12T12:00:00.000Z",
  judge: { kind: "llm_operator", identifier: "hermes-v4", model: "deepseek-v4-pro" },
  laneId: "architecture",
  confidence: "high",
  rationale:
    "The source describes a structural improvement to routing infrastructure that belongs in the Architecture lane rather than Discovery. The keyword engine scored Discovery higher because of 'routing' keyword matches, but the actual work is an engine-level change.",
  citedEvidence: [
    {
      field: "summary",
      excerpt:
        "structured judgment seam that lets an LLM operator override keyword-based routing",
    },
  ],
  rejectedLanes: [
    {
      laneId: "discovery",
      reason: "Despite keyword matches, the work is an engine change, not a new source intake",
    },
  ],
};

describe("validateRoutingJudgment", () => {
  it("accepts a valid judgment with evidence found in source", () => {
    const result = validateRoutingJudgment(VALID_JUDGMENT, MOCK_SOURCE);
    expect(result.ok).toBe(true);
  });

  it("rejects a judgment with evidence NOT in source", () => {
    const badJudgment = {
      ...VALID_JUDGMENT,
      citedEvidence: [
        { field: "summary", excerpt: "this text DOES NOT EXIST anywhere in the source" },
      ],
    };
    const result = validateRoutingJudgment(badJudgment, MOCK_SOURCE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("judgment_evidence_not_found"))).toBe(true);
    }
  });

  it("rejects malformed judgment (missing rationale)", () => {
    const { rationale: _, ...bad } = VALID_JUDGMENT;
    const result = validateRoutingJudgment(bad, MOCK_SOURCE);
    expect(result.ok).toBe(false);
  });
});

describe("assessEngineRouting with judgment", () => {
  it("produces identical output when judgment is undefined", () => {
    const result1 = assessEngineRouting({
      source: MOCK_SOURCE,
      mission: MOCK_MISSION,
      openGaps: [],
      judgment: undefined,
    });
    const result2 = assessEngineRouting({
      source: MOCK_SOURCE,
      mission: MOCK_MISSION,
      openGaps: [],
      judgment: undefined,
    });
    expect(result1).toEqual(result2);
    expect((result1 as Record<string, unknown>).routingPrior).toBeUndefined();
    expect((result1 as Record<string, unknown>).routingJudgment).toBeUndefined();
    expect((result1 as Record<string, unknown>).routingDisagreement).toBeUndefined();
  });

  it("overrides routing when valid judgment is provided", () => {
    const result = assessEngineRouting({
      source: MOCK_SOURCE,
      mission: MOCK_MISSION,
      openGaps: [],
      judgment: VALID_JUDGMENT,
    });
    expect(result.recommendedLaneId).toBe("architecture");
    expect(result.confidence).toBe("high");
    expect(result.routingPrior).toBeDefined();
    expect((result as Record<string, unknown>).routingJudgment).toBeDefined();
    expect((result as Record<string, unknown>).routingDisagreement).toBeDefined();
  });

  it("throws on judgment with hallucinated evidence", () => {
    const badJudgment = {
      ...VALID_JUDGMENT,
      citedEvidence: [{ field: "summary", excerpt: "nonexistent text not in source" }],
    };
    expect(() =>
      assessEngineRouting({
        source: MOCK_SOURCE,
        mission: MOCK_MISSION,
        openGaps: [],
        judgment: badJudgment,
      }),
    ).toThrow(/anti-hallucination/);
  });
});

describe("applyRoutingJudgment", () => {
  it("returns disagreement when lane differs", () => {
    const prior = {
      recommendedLaneId: "discovery" as const,
      confidence: "medium" as const,
      needsHumanReview: false,
      laneScores: { discovery: 8, architecture: 3, runtime: 1 },
    };
    const result = applyRoutingJudgment(prior, VALID_JUDGMENT);
    expect(result.disagreement.kind).toBe("lane");
    expect(result.disagreement.priorLaneId).toBe("discovery");
    expect(result.disagreement.judgmentLaneId).toBe("architecture");
    expect(result.disagreement.resolution).toBe("judgment_wins");
  });

  it("returns no disagreement when everything matches", () => {
    const matchingJudgment: RoutingJudgment = {
      ...VALID_JUDGMENT,
      laneId: "discovery",
      confidence: "medium",
    };
    const prior = {
      recommendedLaneId: "discovery" as const,
      confidence: "medium" as const,
      needsHumanReview: false,
      laneScores: { discovery: 8, architecture: 3, runtime: 1 },
    };
    const result = applyRoutingJudgment(prior, matchingJudgment);
    expect(result.disagreement.kind).toBe("none");
  });
});
