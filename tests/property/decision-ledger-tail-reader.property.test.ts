import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

import {
  appendDecisionPolicyEvent,
  readDecisionPolicyLedger,
  regenerateDecisionPolicyLedgerJson,
  resolveDecisionPolicyLedgerPath,
} from "../../engine/decision-policy-ledger.ts";
import { ledgerEntryArb } from "./_arbitraries/ledger-entry.ts";

function makeIsolatedRoot(): string {
  const root = path.join(os.tmpdir(), `dk-ledger-jsonl-prop-${randomUUID()}`);
  fs.mkdirSync(path.join(root, "engine"), { recursive: true });
  return root;
}

describe("decision-ledger-tail-reader", () => {
  it("Property: JSONL tail-reader reconstructs same shape as legacy JSON", () => {
    fc.assert(
      fc.property(
        fc.array(ledgerEntryArb, { minLength: 1, maxLength: 8 }),
        (entries) => {
          const directiveRoot = makeIsolatedRoot();

          for (const event of entries) {
            appendDecisionPolicyEvent({ directiveRoot, event });
          }

          const fromJsonl = readDecisionPolicyLedger(directiveRoot);
          expect(fromJsonl.events).toHaveLength(entries.length);

          regenerateDecisionPolicyLedgerJson(directiveRoot);
          const jsonPath = resolveDecisionPolicyLedgerPath(directiveRoot);
          const legacyRaw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

          expect(fromJsonl.events).toEqual(legacyRaw.events);
          expect(fromJsonl.suggestions).toEqual(legacyRaw.suggestions);
          expect(fromJsonl.schemaVersion).toBe(legacyRaw.schemaVersion);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property: mtime cache hit avoids re-reading the file", () => {
    fc.assert(
      fc.property(
        fc.array(ledgerEntryArb, { minLength: 1, maxLength: 4 }),
        (entries) => {
          const directiveRoot = makeIsolatedRoot();

          for (const event of entries) {
            appendDecisionPolicyEvent({ directiveRoot, event });
          }

          const first = readDecisionPolicyLedger(directiveRoot);
          const second = readDecisionPolicyLedger(directiveRoot);

          expect(first.events).toHaveLength(entries.length);
          expect(second).toBe(first);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property: appending after a cached read busts the cache", () => {
    fc.assert(
      fc.property(
        fc.array(ledgerEntryArb, { minLength: 1, maxLength: 4 }),
        ledgerEntryArb,
        (entries, extra) => {
          const directiveRoot = makeIsolatedRoot();

          for (const event of entries) {
            appendDecisionPolicyEvent({ directiveRoot, event });
          }

          const first = readDecisionPolicyLedger(directiveRoot);
          expect(first.events).toHaveLength(entries.length);

          appendDecisionPolicyEvent({ directiveRoot, event: extra });
          const second = readDecisionPolicyLedger(directiveRoot);

          expect(second.events).toHaveLength(entries.length + 1);
          expect(second).not.toBe(first);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property: appending N events preserves all entries in append order", () => {
    fc.assert(
      fc.property(
        fc.array(ledgerEntryArb, { minLength: 1, maxLength: 8 }),
        (entries) => {
          const directiveRoot = makeIsolatedRoot();

          for (const event of entries) {
            appendDecisionPolicyEvent({ directiveRoot, event });
          }

          const ledger = readDecisionPolicyLedger(directiveRoot);
          expect(ledger.events).toHaveLength(entries.length);

          for (let i = 0; i < entries.length; i++) {
            expect(ledger.events[i]!.candidateId).toBe(entries[i]!.candidateId);
            expect(ledger.events[i]!.recordedAt).toBe(entries[i]!.recordedAt);
            expect(ledger.events[i]!.decision).toBe(entries[i]!.decision);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
