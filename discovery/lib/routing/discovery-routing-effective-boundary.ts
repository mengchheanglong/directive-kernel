import type { DiscoveryRoutingReviewResolution } from "./discovery-routing-review-resolution.ts";

export type DiscoveryRouteDestination =
  | "architecture"
  | "runtime"
  | "monitor"
  | "defer"
  | "reject"
  | "reference";

function isClearedReviewDecision(decision: DiscoveryRoutingReviewResolution["decision"] | null | undefined) {
  return (
    decision === "confirm_architecture"
    || decision === "confirm_runtime"
    || decision === "redirect_to_architecture"
    || decision === "redirect_to_runtime"
  );
}

function deriveReviewedNextArtifact(input: {
  candidateId: string;
  routingDate: string;
  effectiveRouteDestination: DiscoveryRouteDestination;
  requiredNextArtifact: string;
}) {
  if (input.effectiveRouteDestination === "architecture") {
    return input.requiredNextArtifact.endsWith("-engine-handoff.md")
      ? input.requiredNextArtifact
      : `architecture/01-experiments/${input.routingDate}-${input.candidateId}-engine-handoff.md`;
  }

  if (input.effectiveRouteDestination === "runtime") {
    return input.requiredNextArtifact.endsWith("-runtime-follow-up-record.md")
      ? input.requiredNextArtifact
      : `runtime/00-follow-up/${input.routingDate}-${input.candidateId}-runtime-follow-up-record.md`;
  }

  return input.requiredNextArtifact;
}

export function deriveEffectiveDiscoveryRouteBoundary(input: {
  candidateId: string;
  routingDate: string;
  routeDestination: DiscoveryRouteDestination;
  decisionState: string;
  requiredNextArtifact: string;
  reviewResolution?: Pick<
    DiscoveryRoutingReviewResolution,
    "decision" | "resolvedRouteDestination"
  > | null;
}) {
  const reviewClearsRoute = isClearedReviewDecision(input.reviewResolution?.decision);
  const effectiveRouteDestination =
    (input.reviewResolution?.resolvedRouteDestination as DiscoveryRouteDestination | undefined)
    ?? input.routeDestination;
  const effectiveDecisionState =
    reviewClearsRoute && (effectiveRouteDestination === "architecture" || effectiveRouteDestination === "runtime")
      ? "adopt"
      : input.decisionState;
  const effectiveRequiredNextArtifact = reviewClearsRoute
    ? deriveReviewedNextArtifact({
        candidateId: input.candidateId,
        routingDate: input.routingDate,
        effectiveRouteDestination,
        requiredNextArtifact: input.requiredNextArtifact,
      })
    : input.requiredNextArtifact;

  return {
    reviewClearsRoute,
    effectiveRouteDestination,
    effectiveDecisionState,
    effectiveRequiredNextArtifact,
    approvalAllowed:
      effectiveDecisionState === "adopt"
      && (effectiveRouteDestination === "architecture" || effectiveRouteDestination === "runtime"),
  };
}
