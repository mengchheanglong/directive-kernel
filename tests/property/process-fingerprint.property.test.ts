import { describe, it } from "vitest";
import * as fc from "fast-check";

import { deriveProcessFingerprint } from "../../engine/process-fingerprint.ts";
import type { EngineMissionContext } from "../../engine/types.ts";
import { sourceInputArb } from "./_arbitraries/source-input.ts";

// Mission contexts are only consumed by this property test, so the
// arbitrary lives inline rather than under `_arbitraries/`. All string
// fields use `minLength: 1` because `deriveProcessFingerprint` runs them
// through `normalizeFingerprintText` (trim → lowercase → whitespace
// collapse) and we want generated inputs to fall inside the meaningful
// surface area rather than collapsing to empty strings.
const nonEmptyText = fc.string({ minLength: 1, maxLength: 64 });

const missionContextArb: fc.Arbitrary<EngineMissionContext> = fc.record({
  missionId: fc.option(nonEmptyText, { nil: null }),
  currentObjective: nonEmptyText,
  usefulnessSignals: fc.array(nonEmptyText, { maxLength: 5 }),
  capabilityLanes: fc.array(nonEmptyText, { maxLength: 5 }),
  constraints: fc.array(nonEmptyText, { maxLength: 5 }),
  successSignal: fc.option(nonEmptyText, { nil: null }),
  adoptionTarget: fc.option(nonEmptyText, { nil: null }),
  activeMissionMarkdown: fc.string({ maxLength: 200 }),
});

describe("process-fingerprint", () => {
  // Property 1: Fingerprint determinism — see design.md ("Correctness
  // Properties → Property 1: Fingerprint determinism"). For any accepted
  // (source, mission) input, calling `deriveProcessFingerprint` twice
  // returns identical hash values.
  it("Property 1: same input produces the same fingerprint", () => {
    fc.assert(
      fc.property(sourceInputArb, missionContextArb, (source, mission) => {
        const a = deriveProcessFingerprint({ source, mission });
        const b = deriveProcessFingerprint({ source, mission });
        return a === b;
      }),
      { numRuns: 100 },
    );
  });

  // Property 2: Fingerprint sensitivity to mutation — see design.md
  // ("Correctness Properties → Property 2: Fingerprint sensitivity to
  // mutation"). Mutating any single semantically-meaningful field changes
  // the fingerprint. We mutate `sourceRef` because the arbitrary
  // guarantees `minLength: 1` for it, and the mutation prefixes a
  // double-underscore plus a salt so the change survives the normalizer's
  // `trim → lowercase → whitespace collapse` pipeline.
  it("Property 2: a single-field mutation changes the fingerprint", () => {
    fc.assert(
      fc.property(
        sourceInputArb,
        missionContextArb,
        fc.string({ minLength: 1, maxLength: 32 }),
        (source, mission, salt) => {
          const mutatedSource = {
            ...source,
            sourceRef: `${source.sourceRef}__${salt}`,
          };
          const original = deriveProcessFingerprint({ source, mission });
          const mutated = deriveProcessFingerprint({ source: mutatedSource, mission });
          return original !== mutated;
        },
      ),
      { numRuns: 100 },
    );
  });
});
