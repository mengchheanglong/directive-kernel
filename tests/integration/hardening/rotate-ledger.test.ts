import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

import { rotateDecisionPolicyLedger } from "../../../engine/maintenance/archive.ts";

function makeIsolatedRoot(): string {
  const root = path.join(os.tmpdir(), `dk-rotate-ledger-${randomUUID()}`);
  fs.mkdirSync(path.join(root, "engine"), { recursive: true });
  return root;
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    recordedAt: new Date().toISOString(),
    source: "discovery_routing_review",
    candidateId: `candidate-${randomUUID()}`,
    sourceType: "workflow-writeup",
    decision: "confirm_architecture",
    originalLaneId: "discovery",
    resolvedLaneId: "architecture",
    originalConfidence: null,
    resolvedConfidence: "high",
    originalNeedsHumanReview: null,
    resolvedNeedsHumanReview: false,
    matchedGapId: null,
    missionSpecificityWarning: null,
    goalCopilotWarnings: [],
    followUpRequestedFields: [],
    sourceSignalTokens: ["test"],
    rationale: "Integration test event.",
    ...overrides,
  };
}

describe("rotate-ledger", () => {
  it("rotates ledger with events from a previous month", async () => {
    const directiveRoot = makeIsolatedRoot();
    const activePath = path.join(directiveRoot, "engine", "decision-policy-ledger.jsonl");

    const previousMonth = new Date("2025-03-15T12:00:00.000Z");
    const events = [
      makeEvent({ recordedAt: "2025-03-01T10:00:00.000Z" }),
      makeEvent({ recordedAt: "2025-03-10T10:00:00.000Z" }),
      makeEvent({ recordedAt: "2025-03-15T10:00:00.000Z" }),
    ];

    const lines = events.map((e) => `${JSON.stringify(e)}\n`).join("");
    fs.writeFileSync(activePath, lines, "utf8");

    const result = await rotateDecisionPolicyLedger(directiveRoot, {
      now: new Date("2026-05-27T12:00:00.000Z"),
    });

    expect(result.rotated).toBe(true);
    expect(result.rotatedTo).toBe("decision-policy-ledger.2025-03.jsonl");

    const rotatedPath = path.join(directiveRoot, "engine", "decision-policy-ledger.2025-03.jsonl");
    expect(fs.existsSync(rotatedPath)).toBe(true);

    const activeContent = fs.readFileSync(activePath, "utf8");
    expect(activeContent.trim()).toBe("");
  });

  it("returns rotated=false when active file is empty", async () => {
    const directiveRoot = makeIsolatedRoot();
    const activePath = path.join(directiveRoot, "engine", "decision-policy-ledger.jsonl");
    fs.writeFileSync(activePath, "", "utf8");

    const result = await rotateDecisionPolicyLedger(directiveRoot, {
      now: new Date("2026-05-27T12:00:00.000Z"),
    });

    expect(result.rotated).toBe(false);
  });

  it("returns rotated=false when last event is in the same month", async () => {
    const directiveRoot = makeIsolatedRoot();
    const activePath = path.join(directiveRoot, "engine", "decision-policy-ledger.jsonl");

    const events = [makeEvent({ recordedAt: "2026-05-10T10:00:00.000Z" })];
    const lines = events.map((e) => `${JSON.stringify(e)}\n`).join("");
    fs.writeFileSync(activePath, lines, "utf8");

    const result = await rotateDecisionPolicyLedger(directiveRoot, {
      now: new Date("2026-05-27T12:00:00.000Z"),
    });

    expect(result.rotated).toBe(false);
    expect(fs.existsSync(activePath)).toBe(true);
  });

  it("no-op when ledger file does not exist", async () => {
    const directiveRoot = makeIsolatedRoot();

    const result = await rotateDecisionPolicyLedger(directiveRoot);

    expect(result.rotated).toBe(false);
  });

  it("no-op when active file exists but is empty after previous rotation", async () => {
    const directiveRoot = makeIsolatedRoot();
    const activePath = path.join(directiveRoot, "engine", "decision-policy-ledger.jsonl");

    const events = [makeEvent({ recordedAt: "2025-03-01T10:00:00.000Z" })];
    const lines = events.map((e) => `${JSON.stringify(e)}\n`).join("");
    fs.writeFileSync(activePath, lines, "utf8");

    const first = await rotateDecisionPolicyLedger(directiveRoot, {
      now: new Date("2026-05-27T12:00:00.000Z"),
    });
    expect(first.rotated).toBe(true);

    const second = await rotateDecisionPolicyLedger(directiveRoot, {
      now: new Date("2026-05-27T12:00:00.000Z"),
    });
    expect(second.rotated).toBe(false);
  });

  it("throws rotate_collision when destination file already exists", async () => {
    const directiveRoot = makeIsolatedRoot();
    const activePath = path.join(directiveRoot, "engine", "decision-policy-ledger.jsonl");

    const events = [makeEvent({ recordedAt: "2025-03-01T10:00:00.000Z" })];
    const lines = events.map((e) => `${JSON.stringify(e)}\n`).join("");
    fs.writeFileSync(activePath, lines, "utf8");

    const collisionPath = path.join(directiveRoot, "engine", "decision-policy-ledger.2025-03.jsonl");
    fs.writeFileSync(collisionPath, "", "utf8");

    await expect(
      rotateDecisionPolicyLedger(directiveRoot, {
        now: new Date("2026-05-27T12:00:00.000Z"),
      }),
    ).rejects.toThrow("rotate_collision");
  });
});
