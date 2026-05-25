import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

import {
  appendDecisionPolicyEvent,
  compileDecisionPolicySuggestions,
  readDecisionPolicyLedger,
} from "../../engine/decision-policy-ledger.ts";
import { ledgerEntryArb } from "./_arbitraries/ledger-entry.ts";

// The decision-policy ledger persists to
// `<directiveRoot>/engine/decision-policy-ledger.json` via synchronous
// `fs.writeFileSync`. To make Property 3 meaningful, every property
// iteration must run against a fresh empty ledger; we allocate a unique
// temp directory under `os.tmpdir()` per iteration. Vitest's `pool:
// "forks"` plus `isolate: true` already gives the test file a clean
// process, but isolation across the 100 generated examples within one
// property requires this per-iteration root. Cleanup is intentionally
// skipped per `tests/README.md` — CI runners discard the workspace and
// local leftovers stay for forensics.
function makeIsolatedRoot(): string {
  const root = path.join(os.tmpdir(), `dk-ledger-prop-${randomUUID()}`);
  fs.mkdirSync(path.join(root, "engine"), { recursive: true });
  return root;
}

describe("decision-policy-ledger", () => {
  // Property 3: Decision-policy ledger append-only invariant — see
  // design.md ("Correctness Properties → Property 3: Decision-policy
  // ledger append-only invariant"). Appending entries one at a time to a
  // fresh empty ledger preserves every previously appended entry in its
  // original position. After each append we read the ledger back and
  // assert that the prefix of length k equals the read-back result from
  // the previous append, and that exactly one new entry was added at the
  // tail. This formulation does not depend on how
  // `appendDecisionPolicyEvent` post-processes
  // `sourceSignalTokens` — what matters is that prior entries stay
  // byte-identical as new ones land.
  it("Property 3: appending preserves every prefix", () => {
    fc.assert(
      fc.property(
        fc.array(ledgerEntryArb, { minLength: 1, maxLength: 6 }),
        (entries) => {
          const directiveRoot = makeIsolatedRoot();
          let previous: typeof entries = [];

          for (let i = 0; i < entries.length; i++) {
            appendDecisionPolicyEvent({
              directiveRoot,
              event: entries[i]!,
            });
            const after = readDecisionPolicyLedger(directiveRoot).events;

            expect(after.slice(0, i)).toEqual(previous);
            expect(after.length).toBe(i + 1);

            previous = after;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 4: Decision-policy suggestion compilation determinism — see
  // design.md ("Correctness Properties → Property 4: Decision-policy
  // suggestion compilation determinism"). For any ledger contents `L`,
  // calling `compileDecisionPolicySuggestions` twice on `L` produces
  // deeply equal suggestion outputs. We build `L` by appending generated
  // entries to a fresh ledger and reading it back, then compile twice
  // off the same `events` array.
  it("Property 4: suggestion compiler is deterministic", () => {
    fc.assert(
      fc.property(
        fc.array(ledgerEntryArb, { minLength: 1, maxLength: 6 }),
        (entries) => {
          const directiveRoot = makeIsolatedRoot();
          for (const event of entries) {
            appendDecisionPolicyEvent({ directiveRoot, event });
          }
          const ledger = readDecisionPolicyLedger(directiveRoot);
          const first = compileDecisionPolicySuggestions(ledger.events);
          const second = compileDecisionPolicySuggestions(ledger.events);

          expect(first).toEqual(second);
        },
      ),
      { numRuns: 100 },
    );
  });
});
