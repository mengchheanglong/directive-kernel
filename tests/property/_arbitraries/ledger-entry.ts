import * as fc from "fast-check";

import type { DecisionPolicyEvent } from "../../../engine/decision-policy-ledger-types.ts";
import { ENGINE_SUPPORTED_SOURCE_TYPES } from "../../../engine/types.ts";

// Allowed values mirrored from the production sites that build
// `DecisionPolicyEvent`s — see `discovery/lib/routing/discovery-review-resolution.ts`,
// `scripts/hardening/policy-checks.ts`, and the suggestion compiler in
// `engine/decision-policy-ledger-suggestions.ts`. Every field on the type is
// required, so optional-style `fc.option(..., { nil: undefined })` is not
// needed here; nullable fields use `fc.option(..., { nil: null })`.

const REVIEW_DECISIONS = [
  "confirm_architecture",
  "confirm_runtime",
  "redirect_to_architecture",
  "redirect_to_runtime",
  "reject",
  "defer",
] as const;

const ORIGINAL_LANE_IDS = ["discovery", "architecture", "runtime"] as const;
const RESOLVED_LANE_IDS = ["discovery", "architecture", "runtime", "reject"] as const;
const ROUTING_CONFIDENCES = ["high", "medium", "low"] as const;

// Field names that the suggestion compiler keys off (`mission.currentObjective`,
// `source.primaryAdoptionTarget`, `source.capabilityGapId`); generating real
// values keeps property tests inside the semantically meaningful surface area.
const FOLLOW_UP_FIELDS = [
  "mission.currentObjective",
  "source.primaryAdoptionTarget",
  "source.capabilityGapId",
] as const;

const nonEmptyText = fc.string({ minLength: 1, maxLength: 80 });
const isoTimestamp = fc.date({
  min: new Date("2020-01-01T00:00:00.000Z"),
  max: new Date("2035-12-31T23:59:59.999Z"),
}).map((d) => d.toISOString());

export const ledgerEntryArb: fc.Arbitrary<DecisionPolicyEvent> = fc.record({
  recordedAt: isoTimestamp,
  source: fc.constant("discovery_routing_review" as const),
  candidateId: nonEmptyText,
  sourceType: fc.constantFrom(...ENGINE_SUPPORTED_SOURCE_TYPES),
  decision: fc.constantFrom(...REVIEW_DECISIONS),
  originalLaneId: fc.constantFrom(...ORIGINAL_LANE_IDS),
  resolvedLaneId: fc.constantFrom(...RESOLVED_LANE_IDS),
  originalConfidence: fc.option(fc.constantFrom(...ROUTING_CONFIDENCES), { nil: null }),
  resolvedConfidence: fc.option(fc.constantFrom(...ROUTING_CONFIDENCES), { nil: null }),
  originalNeedsHumanReview: fc.option(fc.boolean(), { nil: null }),
  resolvedNeedsHumanReview: fc.option(fc.boolean(), { nil: null }),
  matchedGapId: fc.option(nonEmptyText, { nil: null }),
  missionSpecificityWarning: fc.option(nonEmptyText, { nil: null }),
  goalCopilotWarnings: fc.array(nonEmptyText, { maxLength: 4 }),
  followUpRequestedFields: fc.array(fc.constantFrom(...FOLLOW_UP_FIELDS), { maxLength: 3 }),
  sourceSignalTokens: fc.array(nonEmptyText, { maxLength: 6 }),
  rationale: nonEmptyText,
});
