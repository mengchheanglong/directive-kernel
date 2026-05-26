import type { EngineRoutingAssessment } from "../types.ts";

export function deriveDirectiveRoutingDiff(input: {
  before: EngineRoutingAssessment;
  after: EngineRoutingAssessment;
}) {
  const diff: string[] = [];

  if (input.before.recommendedLaneId !== input.after.recommendedLaneId) {
    diff.push(
      `Lane changed from ${input.before.recommendedLaneId} to ${input.after.recommendedLaneId}.`,
    );
  }
  if (input.before.confidence !== input.after.confidence) {
    diff.push(
      `Confidence changed from ${input.before.confidence} to ${input.after.confidence}.`,
    );
  }
  if (input.before.needsHumanReview !== input.after.needsHumanReview) {
    diff.push(
      `Needs-human-review changed from ${input.before.needsHumanReview} to ${input.after.needsHumanReview}.`,
    );
  }
  if (input.before.routeConflict !== input.after.routeConflict) {
    diff.push(
      `Route conflict changed from ${input.before.routeConflict} to ${input.after.routeConflict}.`,
    );
  }
  if (input.before.matchedGapId !== input.after.matchedGapId) {
    diff.push(
      `Matched gap changed from ${input.before.matchedGapId ?? "none"} to ${input.after.matchedGapId ?? "none"}.`,
    );
  }
  if (
    input.before.digest.primaryConcern?.kind !== input.after.digest.primaryConcern?.kind
  ) {
    diff.push(
      `Primary concern changed from ${input.before.digest.primaryConcern?.kind ?? "none"} to ${input.after.digest.primaryConcern?.kind ?? "none"}.`,
    );
  }
  if (diff.length === 0) {
    diff.push("Routing digest stayed materially the same.");
  }

  return diff;
}
