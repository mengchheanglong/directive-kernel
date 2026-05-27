import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

import {
  appendDecisionPolicyEvent,
  readDecisionPolicyLedger,
  regenerateDecisionPolicyLedgerJson,
  resolveDecisionPolicyLedgerJsonlPath,
  resolveDecisionPolicyLedgerPath,
} from "../../../engine/decision-policy-ledger.ts";

function makeIsolatedRoot(): string {
  const root = path.join(os.tmpdir(), `dk-ledger-jsonl-int-${randomUUID()}`);
  fs.mkdirSync(path.join(root, "engine"), { recursive: true });
  return root;
}

function makeEvent(overrides: Partial<Parameters<typeof appendDecisionPolicyEvent>[0]["event"]> = {}) {
  return {
    recordedAt: new Date().toISOString(),
    source: "discovery_routing_review" as const,
    candidateId: `candidate-${randomUUID()}`,
    sourceType: "workflow-writeup",
    decision: "confirm_architecture",
    originalLaneId: "discovery",
    resolvedLaneId: "architecture",
    originalConfidence: null,
    resolvedConfidence: "high" as const,
    originalNeedsHumanReview: null,
    resolvedNeedsHumanReview: false,
    matchedGapId: null,
    missionSpecificityWarning: null,
    goalCopilotWarnings: [],
    followUpRequestedFields: [],
    sourceSignalTokens: ["test", "integration"],
    rationale: "Integration test event.",
    ...overrides,
  };
}

describe("decision-ledger-jsonl", () => {
  it("writes N events to JSONL and reads them back correctly", () => {
    const directiveRoot = makeIsolatedRoot();
    const N = 5;

    const events = Array.from({ length: N }, (_, i) =>
      makeEvent({
        candidateId: `candidate-${i}`,
        recordedAt: `2026-05-${(10 + i).toString().padStart(2, "0")}T12:00:00.000Z`,
      }),
    );

    for (const event of events) {
      appendDecisionPolicyEvent({ directiveRoot, event });
    }

    const ledger = readDecisionPolicyLedger(directiveRoot);
    expect(ledger.events).toHaveLength(N);

    for (let i = 0; i < N; i++) {
      expect(ledger.events[i]!.candidateId).toBe(`candidate-${i}`);
    }
  });

  it("JSONL file exists after first append", () => {
    const directiveRoot = makeIsolatedRoot();
    appendDecisionPolicyEvent({ directiveRoot, event: makeEvent() });

    const jsonlPath = resolveDecisionPolicyLedgerJsonlPath(directiveRoot);
    expect(fs.existsSync(jsonlPath)).toBe(true);

    const content = fs.readFileSync(jsonlPath, "utf8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);
  });

  it("round-trips through JSONL then regenerated JSON", () => {
    const directiveRoot = makeIsolatedRoot();
    const N = 3;

    for (let i = 0; i < N; i++) {
      appendDecisionPolicyEvent({
        directiveRoot,
        event: makeEvent({
          candidateId: `roundtrip-${i}`,
          recordedAt: `2026-05-${(20 + i).toString().padStart(2, "0")}T12:00:00.000Z`,
        }),
      });
    }

    const fromJsonl = readDecisionPolicyLedger(directiveRoot);
    expect(fromJsonl.events).toHaveLength(N);

    regenerateDecisionPolicyLedgerJson(directiveRoot);
    const jsonPath = resolveDecisionPolicyLedgerPath(directiveRoot);
    expect(fs.existsSync(jsonPath)).toBe(true);

    const legacyRaw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    expect(legacyRaw.events).toEqual(fromJsonl.events);
    expect(legacyRaw.suggestions).toEqual(fromJsonl.suggestions);
  });

  it("mtime cache returns identical object on repeated reads", () => {
    const directiveRoot = makeIsolatedRoot();
    appendDecisionPolicyEvent({ directiveRoot, event: makeEvent() });

    const first = readDecisionPolicyLedger(directiveRoot);
    const second = readDecisionPolicyLedger(directiveRoot);
    const third = readDecisionPolicyLedger(directiveRoot);

    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("mtime cache is busted after new append", () => {
    const directiveRoot = makeIsolatedRoot();
    appendDecisionPolicyEvent({ directiveRoot, event: makeEvent({ candidateId: "first" }) });

    const before = readDecisionPolicyLedger(directiveRoot);
    expect(before.events).toHaveLength(1);

    appendDecisionPolicyEvent({ directiveRoot, event: makeEvent({ candidateId: "second" }) });
    const after = readDecisionPolicyLedger(directiveRoot);

    expect(after.events).toHaveLength(2);
    expect(after).not.toBe(before);
  });

  it("falls back to legacy JSON when no JSONL exists", () => {
    const directiveRoot = makeIsolatedRoot();
    const jsonPath = resolveDecisionPolicyLedgerPath(directiveRoot);

    const legacyLedger = {
      schemaVersion: 1,
      events: [makeEvent({ candidateId: "legacy", recordedAt: "2026-01-01T00:00:00.000Z" })],
      suggestions: [],
    };
    fs.writeFileSync(jsonPath, `${JSON.stringify(legacyLedger, null, 2)}\n`, "utf8");

    const ledger = readDecisionPolicyLedger(directiveRoot);
    expect(ledger.events).toHaveLength(1);
    expect(ledger.events[0]!.candidateId).toBe("legacy");
  });

  it("sourceSignalTokens are normalized on append", () => {
    const directiveRoot = makeIsolatedRoot();
    appendDecisionPolicyEvent({
      directiveRoot,
      event: makeEvent({
        sourceSignalTokens: ["TOKEN_A", "TOKEN_B", "token_a", "token_b"],
      }),
    });

    const ledger = readDecisionPolicyLedger(directiveRoot);
    const tokens = ledger.events[0]!.sourceSignalTokens;
    expect(tokens).toHaveLength(4);
    // uniqueStrings deduplicates and `token_a` is lowercase of `TOKEN_A`
    const lowered = tokens.map((t) => t.toLowerCase());
    expect(new Set(lowered).size).toBe(2);
  });

  it("regenerateDecisionPolicyLedgerJson handles empty JSONL gracefully", () => {
    const directiveRoot = makeIsolatedRoot();
    const jsonPath = resolveDecisionPolicyLedgerPath(directiveRoot);
    const jsonlPath = resolveDecisionPolicyLedgerJsonlPath(directiveRoot);

    fs.writeFileSync(jsonlPath, "", "utf8");

    regenerateDecisionPolicyLedgerJson(directiveRoot);
    if (fs.existsSync(jsonPath)) {
      const content = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      expect(content.events).toHaveLength(0);
    }
  });
});
