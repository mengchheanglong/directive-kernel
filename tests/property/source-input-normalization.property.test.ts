import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import type { EngineSourceItem } from "../../engine/types.ts";
import { normalizeText } from "../../engine/source-utils.ts";
import { normalizeEngineSourceType } from "../../engine/source-type-normalization.ts";
import {
  normalizeOptionalBoolean,
  normalizePrimaryAdoptionTarget,
  normalizeWorkflowBoundaryShape,
  validateEngineSource,
} from "../../engine/source-input-normalization.ts";
import { sourceInputArb } from "./_arbitraries/source-input.ts";

// Property 6 formulation choice — option (c) from the design prompt.
//
// `engine/source-input-normalization.ts` does not export a single
// `normalize(source) → source` function. It exports per-field normalizers
// (`normalizeOptionalBoolean`, `normalizePrimaryAdoptionTarget`,
// `normalizeWorkflowBoundaryShape`) and a validator
// (`validateEngineSource`) that throws on bad input. The composite
// source-record normalization that production code actually performs lives
// inline in `prepareProcessSourceInput` in `engine/process-source-record.ts`,
// where it combines the field normalizers from this module with
// `normalizeText` from `source-utils.ts` and
// `normalizeEngineSourceType` from `source-type-normalization.ts`,
// then runs `validateEngineSource` at the end.
//
// To make Property 6 well-defined we mirror that exact pipeline in this
// file as the local `normalizeSource` helper. With this shape the
// normalizer accepts a `EngineSourceItem` and returns a
// `EngineSourceItem`, so `normalize(normalize(x))` type-checks
// and the idempotence assertion is meaningful — we exercise the same
// transformations production runs, only without the surrounding
// mission/receivedAt machinery that `prepareProcessSourceInput` also
// handles.
//
// Validates: Requirements 6.2, 6.3 (see requirements.md → Requirement 6).
// Design reference: design.md → "Correctness Properties → Property 6:
//   Source-input normalization idempotence".

function normalizeNotes(notes: string[] | null | undefined): string[] {
  return (notes ?? []).map((note) => normalizeText(note)).filter(Boolean);
}

function normalizeSource(input: EngineSourceItem): EngineSourceItem {
  const normalized: EngineSourceItem = {
    ...input,
    sourceId: normalizeText(input.sourceId) || null,
    sourceType: normalizeEngineSourceType(input.sourceType),
    sourceRef: normalizeText(input.sourceRef),
    title:
      normalizeText(input.title)
      || normalizeText(input.sourceId)
      || normalizeText(input.sourceRef),
    summary: normalizeText(input.summary) || null,
    missionAlignmentHint: normalizeText(input.missionAlignmentHint) || null,
    capabilityGapId: normalizeText(input.capabilityGapId) || null,
    primaryAdoptionTarget: normalizePrimaryAdoptionTarget(input.primaryAdoptionTarget),
    containsExecutableCode: normalizeOptionalBoolean(input.containsExecutableCode),
    containsWorkflowPattern: normalizeOptionalBoolean(input.containsWorkflowPattern),
    improvesDirectiveWorkspace: normalizeOptionalBoolean(input.improvesDirectiveWorkspace),
    workflowBoundaryShape: normalizeWorkflowBoundaryShape(input.workflowBoundaryShape),
    notes: normalizeNotes(input.notes),
  };
  validateEngineSource(normalized);
  return normalized;
}

describe("source-input-normalization", () => {
  // Property 6: Source-input normalization idempotence — see design.md
  // ("Correctness Properties → Property 6: Source-input normalization
  // idempotence"). For any input `x` accepted by the normalizer,
  // `normalizeSource(normalizeSource(x))` is deeply equal to
  // `normalizeSource(x)`.
  //
  // `sourceInputArb` is designed to stay inside the accepted surface area,
  // but a generated input may still trim to all-empty fields (e.g. a
  // whitespace-only `sourceRef`) and trip the validator. We catch that
  // first-pass rejection and use `fc.pre(false)` to skip the iteration so
  // the property is asserted only on inputs the normalizer actually
  // accepts.
  it("Property 6: normalize(normalize(x)) deep-equals normalize(x)", () => {
    fc.assert(
      fc.property(sourceInputArb, (input) => {
        let once: EngineSourceItem;
        try {
          once = normalizeSource(input);
        } catch {
          fc.pre(false);
          return;
        }
        const twice = normalizeSource(once);
        expect(twice).toEqual(once);
      }),
      { numRuns: 100 },
    );
  });
});
