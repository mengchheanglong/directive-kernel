import * as fc from "fast-check";

import type { EngineSourceItem } from "../../../engine/types.ts";
import { ENGINE_SUPPORTED_SOURCE_TYPES } from "../../../engine/types.ts";

// Allowed enum values mirrored from `normalizePrimaryAdoptionTarget` and
// `normalizeWorkflowBoundaryShape` in `engine/source-input-normalization.ts`.
const PRIMARY_ADOPTION_TARGETS = ["discovery", "architecture", "runtime"] as const;
const WORKFLOW_BOUNDARY_SHAPES = ["bounded_protocol", "iterative_loop"] as const;

// `validateEngineSource` rejects records whose `sourceRef` trims to
// the empty string, so all string fields use `minLength: 1` to keep generated
// inputs inside the accepted surface area. Optional fields use
// `fc.option(..., { nil: undefined })` so property tests exercise both the
// present and absent branches consumed by the fingerprint and normalizer.
const nonEmptyText = fc.string({ minLength: 1, maxLength: 80 });

export const sourceInputArb: fc.Arbitrary<EngineSourceItem> = fc.record({
  sourceId: fc.option(nonEmptyText, { nil: undefined }),
  sourceType: fc.constantFrom(...ENGINE_SUPPORTED_SOURCE_TYPES),
  sourceRef: nonEmptyText,
  title: nonEmptyText,
  summary: fc.option(nonEmptyText, { nil: undefined }),
  notes: fc.option(fc.array(nonEmptyText, { maxLength: 5 }), { nil: undefined }),
  missionAlignmentHint: fc.option(nonEmptyText, { nil: undefined }),
  capabilityGapId: fc.option(nonEmptyText, { nil: undefined }),
  primaryAdoptionTarget: fc.option(
    fc.constantFrom(...PRIMARY_ADOPTION_TARGETS),
    { nil: undefined },
  ),
  containsExecutableCode: fc.option(fc.boolean(), { nil: undefined }),
  containsWorkflowPattern: fc.option(fc.boolean(), { nil: undefined }),
  improvesDirectiveWorkspace: fc.option(fc.boolean(), { nil: undefined }),
  workflowBoundaryShape: fc.option(
    fc.constantFrom(...WORKFLOW_BOUNDARY_SHAPES),
    { nil: undefined },
  ),
});
