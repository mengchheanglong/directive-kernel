import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

import {
  readDecisionPolicyLedger,
} from "../../engine/decision-policy-ledger.ts";
import type { DecisionPolicyEvent } from "../../engine/decision-policy-ledger-types.ts";
import { ledgerEntryArb } from "./_arbitraries/ledger-entry.ts";

function makeIsolatedRoot(): string {
  const root = path.join(os.tmpdir(), `dk-segmented-ledger-prop-${randomUUID()}`);
  fs.mkdirSync(path.join(root, "engine"), { recursive: true });
  return root;
}

function eventToJsonlLine(event: DecisionPolicyEvent): string {
  return `${JSON.stringify(event)}\n`;
}

function getMonthKey(event: DecisionPolicyEvent): string {
  const d = new Date(event.recordedAt);
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function eventsEqual(a: DecisionPolicyEvent[], b: DecisionPolicyEvent[]): boolean {
  if (a.length !== b.length) return false;
  const aKeys = a.map((e) => `${e.candidateId}::${e.recordedAt}`).sort();
  const bKeys = b.map((e) => `${e.candidateId}::${e.recordedAt}`).sort();
  return aKeys.every((k, i) => k === bKeys[i]);
}

describe("segmented-ledger-reader", () => {
  it("Property: lookback 'all' returns the same set of events as unsegmented form", () => {
    fc.assert(
      fc.property(
        fc.array(ledgerEntryArb, { minLength: 1, maxLength: 20 }),
        (entries) => {
          const directiveRoot = makeIsolatedRoot();
          const engineDir = path.join(directiveRoot, "engine");

          const fullJsonlContent = entries.map(eventToJsonlLine).join("");

          const byMonth = new Map<string, DecisionPolicyEvent[]>();
          for (const event of entries) {
            const mk = getMonthKey(event);
            if (!byMonth.has(mk)) byMonth.set(mk, []);
            byMonth.get(mk)!.push(event);
          }

          for (const [monthKey, monthEvents] of byMonth) {
            const segPath = path.join(engineDir, `decision-policy-ledger.${monthKey}.jsonl`);
            fs.writeFileSync(segPath, monthEvents.map(eventToJsonlLine).join(""), "utf8");
          }

          const activePath = path.join(engineDir, "decision-policy-ledger.jsonl");
          fs.writeFileSync(activePath, "", "utf8");

          const fromSegmented = readDecisionPolicyLedger(directiveRoot, { lookback: "all" });

          const unsegmentedRoot = makeIsolatedRoot();
          const unsegmentedEngineDir = path.join(unsegmentedRoot, "engine");
          const unsegmentedActivePath = path.join(unsegmentedEngineDir, "decision-policy-ledger.jsonl");
          fs.writeFileSync(unsegmentedActivePath, fullJsonlContent, "utf8");
          const fromUnsegmented = readDecisionPolicyLedger(unsegmentedRoot);

          expect(fromSegmented.events).toHaveLength(entries.length);
          expect(fromSegmented.events).toHaveLength(fromUnsegmented.events.length);
          expect(eventsEqual(fromSegmented.events, fromUnsegmented.events)).toBe(true);
          expect(fromSegmented.schemaVersion).toBe(fromUnsegmented.schemaVersion);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property: lookback 'sinceMonth' returns only events from >= month", () => {
    fc.assert(
      fc.property(
        fc.array(ledgerEntryArb, { minLength: 2, maxLength: 15 }),
        (entries) => {
          const directiveRoot = makeIsolatedRoot();
          const engineDir = path.join(directiveRoot, "engine");

          const sorted = [...entries].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
          const minMonthKey = getMonthKey(sorted[0]!);

          const byMonth = new Map<string, DecisionPolicyEvent[]>();
          for (const event of entries) {
            const mk = getMonthKey(event);
            if (!byMonth.has(mk)) byMonth.set(mk, []);
            byMonth.get(mk)!.push(event);
          }

          for (const [monthKey, monthEvents] of byMonth) {
            const segPath = path.join(engineDir, `decision-policy-ledger.${monthKey}.jsonl`);
            fs.writeFileSync(segPath, monthEvents.map(eventToJsonlLine).join(""), "utf8");
          }

          const activePath = path.join(engineDir, "decision-policy-ledger.jsonl");
          fs.writeFileSync(activePath, "", "utf8");

          const fromSince = readDecisionPolicyLedger(directiveRoot, { lookback: { sinceMonth: minMonthKey } });

          const expected = entries.filter((e) => getMonthKey(e) >= minMonthKey);
          expect(fromSince.events).toHaveLength(expected.length);
          expect(eventsEqual(fromSince.events, expected)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property: lookback 'active-only' returns only events from active file (not rotated)", () => {
    fc.assert(
      fc.property(
        fc.array(ledgerEntryArb, { minLength: 0, maxLength: 5 }),
        fc.array(ledgerEntryArb, { minLength: 1, maxLength: 8 }),
        (rotatedEntries, activeEntries) => {
          const directiveRoot = makeIsolatedRoot();
          const engineDir = path.join(directiveRoot, "engine");

          for (const event of rotatedEntries) {
            const mk = getMonthKey(event);
            const segPath = path.join(engineDir, `decision-policy-ledger.${mk}.jsonl`);
            const existing = fs.existsSync(segPath) ? fs.readFileSync(segPath, "utf8") : "";
            fs.writeFileSync(segPath, `${existing}${eventToJsonlLine(event)}`, "utf8");
          }

          const activePath = path.join(engineDir, "decision-policy-ledger.jsonl");
          fs.writeFileSync(activePath, activeEntries.map(eventToJsonlLine).join(""), "utf8");

          const fromActiveOnly = readDecisionPolicyLedger(directiveRoot, { lookback: "active-only" });

          // Assert count matches — active-only should NOT include rotated entries
          expect(fromActiveOnly.events).toHaveLength(activeEntries.length);
          const resultIds = new Set(fromActiveOnly.events.map((e) => e.candidateId));
          const activeIds = new Set(activeEntries.map((e) => e.candidateId));
          expect(resultIds).toEqual(activeIds);
        },
      ),
      { numRuns: 100 },
    );
  });
});
