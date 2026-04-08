import fs from "node:fs";
import path from "node:path";

import {
  normalizeDirectiveApprovalActor,
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveString,
  resolveDirectiveWorkspaceRelativePath,
} from "../../engine/approval-boundary.ts";
import {
  readDirectiveDiscoveryRoutingArtifact,
  type DirectiveDiscoveryRoutingArtifact,
} from "./discovery-route-opener.ts";

export type DiscoveryRoutingReviewDecision =
  | "confirm_architecture"
  | "confirm_runtime"
  | "redirect_to_architecture"
  | "redirect_to_runtime"
  | "reject"
  | "defer";

export type DiscoveryRoutingReviewResolutionInput = {
  directiveRoot?: string;
  routingRecordPath: string;
  decision: DiscoveryRoutingReviewDecision;
  rationale: string;
  reviewedBy: string;
  resolvedConfidence?: "high" | "medium" | "low";
};

export type DiscoveryRoutingReviewResolution = {
  candidateId: string;
  candidateName: string;
  routingRecordPath: string;
  reviewResolutionPath: string;
  decision: DiscoveryRoutingReviewDecision;
  resolvedRouteDestination: string;
  resolvedConfidence: string;
  resolvedRouteConflict: boolean;
  resolvedNeedsHumanReview: boolean;
  rationale: string;
  reviewedBy: string;
  reviewDate: string;
  originalRouteDestination: string;
  originalConfidence: string | null;
  originalRouteConflict: boolean | null;
  originalNeedsHumanReview: boolean | null;
};

export type WriteDiscoveryRoutingReviewResolutionResult = {
  ok: true;
  created: boolean;
  resolution: DiscoveryRoutingReviewResolution;
  reviewResolutionRelativePath: string;
};

function deriveReviewResolutionPath(routingRecordPath: string): string {
  if (!routingRecordPath.endsWith("routing-record.md")) {
    throw new Error(
      `invalid_input: routingRecordPath must end with "routing-record.md", got "${routingRecordPath}"`,
    );
  }
  return routingRecordPath.replace(/routing-record\.md$/, "routing-review-resolution.md");
}

function resolveRouteDestination(
  decision: DiscoveryRoutingReviewDecision,
  originalDestination: string,
): string {
  switch (decision) {
    case "confirm_architecture":
    case "redirect_to_architecture":
      return "architecture";
    case "confirm_runtime":
    case "redirect_to_runtime":
      return "runtime";
    case "reject":
      return "reject";
    case "defer":
      return originalDestination;
  }
}

function isRouteCleared(decision: DiscoveryRoutingReviewDecision): boolean {
  return (
    decision === "confirm_architecture"
    || decision === "confirm_runtime"
    || decision === "redirect_to_architecture"
    || decision === "redirect_to_runtime"
  );
}

function validateDecisionAgainstRoute(
  decision: DiscoveryRoutingReviewDecision,
  routing: DirectiveDiscoveryRoutingArtifact,
) {
  if (decision === "confirm_architecture" && routing.routeDestination !== "architecture") {
    throw new Error(
      `invalid_input: cannot confirm_architecture when original route destination is "${routing.routeDestination}"`,
    );
  }
  if (decision === "confirm_runtime" && routing.routeDestination !== "runtime") {
    throw new Error(
      `invalid_input: cannot confirm_runtime when original route destination is "${routing.routeDestination}"`,
    );
  }
}

function renderReviewResolution(resolution: DiscoveryRoutingReviewResolution): string {
  const boolText = (value: boolean | null) =>
    value === true ? "yes" : value === false ? "no" : "n/a";

  return [
    `# Discovery Routing Review Resolution: ${resolution.candidateName}`,
    "",
    `Date: ${resolution.reviewDate}`,
    "",
    `- Candidate id: ${resolution.candidateId}`,
    `- Candidate name: ${resolution.candidateName}`,
    `- Review date: ${resolution.reviewDate}`,
    `- Reviewed by: ${resolution.reviewedBy}`,
    `- Linked routing record: ${resolution.routingRecordPath}`,
    "",
    "## Original routing state",
    "",
    `- Original route destination: ${resolution.originalRouteDestination}`,
    `- Original routing confidence: ${resolution.originalConfidence ?? "n/a"}`,
    `- Original route conflict: ${boolText(resolution.originalRouteConflict)}`,
    `- Original needs human review: ${boolText(resolution.originalNeedsHumanReview)}`,
    "",
    "## Review decision",
    "",
    `- Decision: ${resolution.decision}`,
    `- Rationale: ${resolution.rationale}`,
    "",
    "## Resolved routing state",
    "",
    `- Resolved route destination: ${resolution.resolvedRouteDestination}`,
    `- Resolved routing confidence: ${resolution.resolvedConfidence}`,
    `- Resolved route conflict: ${resolution.resolvedRouteConflict ? "yes" : "no"}`,
    `- Resolved needs human review: ${resolution.resolvedNeedsHumanReview ? "yes" : "no"}`,
    "",
    "## Validation boundary",
    "",
    "- This review resolution is an explicit operator decision artifact.",
    "- The original routing record is preserved unchanged.",
    "- Engine state reads this resolution alongside the original routing record to compute effective routing state.",
    "",
    "## Rollback boundary",
    "",
    "- Rollback: Delete this review resolution artifact. The original routing record remains unchanged and the system returns to its pre-resolution state.",
    "- No-op path: Leave the review resolution in place; downstream lane work proceeds based on the resolved state.",
    "",
  ].join("\n");
}

function parseOptionalBullet(markdown: string, label: string): string | null {
  const prefix = `- ${label}:`;
  const line = markdown
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(prefix));
  if (!line) return null;
  const value = line.trim().replace(prefix, "").trim().replace(/^`|`$/g, "");
  return value || null;
}

function parseYesNoBoolean(value: string | null): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") return true;
  if (normalized === "no") return false;
  return null;
}

export function resolveDiscoveryRoutingReviewResolutionPath(input: {
  routingRecordPath: string;
}): string {
  return deriveReviewResolutionPath(input.routingRecordPath);
}

export function readDiscoveryRoutingReviewResolution(input: {
  directiveRoot: string;
  routingRecordPath: string;
}): DiscoveryRoutingReviewResolution | null {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const routingRecordPath = resolveDirectiveWorkspaceRelativePath(
    directiveRoot,
    input.routingRecordPath,
    "routingRecordPath",
  );
  const resolutionRelativePath = deriveReviewResolutionPath(routingRecordPath);
  const resolutionAbsolutePath = path.join(directiveRoot, resolutionRelativePath);

  if (!fs.existsSync(resolutionAbsolutePath)) {
    return null;
  }

  const content = fs.readFileSync(resolutionAbsolutePath, "utf8");

  const candidateId = parseOptionalBullet(content, "Candidate id") ?? "";
  const candidateName = parseOptionalBullet(content, "Candidate name") ?? "";
  const reviewDate = parseOptionalBullet(content, "Review date") ?? "";
  const reviewedBy = parseOptionalBullet(content, "Reviewed by") ?? "";
  const linkedRoutingRecord = parseOptionalBullet(content, "Linked routing record") ?? routingRecordPath;

  const decision = (parseOptionalBullet(content, "Decision") ?? "defer") as DiscoveryRoutingReviewDecision;
  const rationale = parseOptionalBullet(content, "Rationale") ?? "";

  const resolvedRouteDestination = parseOptionalBullet(content, "Resolved route destination") ?? "";
  const resolvedConfidence = parseOptionalBullet(content, "Resolved routing confidence") ?? "medium";
  const resolvedRouteConflict = parseYesNoBoolean(
    parseOptionalBullet(content, "Resolved route conflict"),
  ) ?? false;
  const resolvedNeedsHumanReview = parseYesNoBoolean(
    parseOptionalBullet(content, "Resolved needs human review"),
  ) ?? false;

  const originalRouteDestination = parseOptionalBullet(content, "Original route destination") ?? "";
  const originalConfidence = parseOptionalBullet(content, "Original routing confidence");
  const originalRouteConflict = parseYesNoBoolean(
    parseOptionalBullet(content, "Original route conflict"),
  );
  const originalNeedsHumanReview = parseYesNoBoolean(
    parseOptionalBullet(content, "Original needs human review"),
  );

  return {
    candidateId,
    candidateName,
    routingRecordPath: linkedRoutingRecord,
    reviewResolutionPath: resolutionRelativePath,
    decision,
    resolvedRouteDestination,
    resolvedConfidence,
    resolvedRouteConflict,
    resolvedNeedsHumanReview,
    rationale,
    reviewedBy,
    reviewDate,
    originalRouteDestination,
    originalConfidence,
    originalRouteConflict,
    originalNeedsHumanReview,
  };
}

export function writeDiscoveryRoutingReviewResolution(
  input: DiscoveryRoutingReviewResolutionInput,
): WriteDiscoveryRoutingReviewResolutionResult {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const routingRecordPath = resolveDirectiveWorkspaceRelativePath(
    directiveRoot,
    input.routingRecordPath,
    "routingRecordPath",
  );
  const reviewedBy = normalizeDirectiveApprovalActor(input.reviewedBy);
  const rationale = requireDirectiveString(input.rationale, "rationale");

  const routing = readDirectiveDiscoveryRoutingArtifact({
    directiveRoot,
    routingPath: routingRecordPath,
  });

  validateDecisionAgainstRoute(input.decision, routing);

  const resolutionRelativePath = deriveReviewResolutionPath(routingRecordPath);
  const resolutionAbsolutePath = path.join(directiveRoot, resolutionRelativePath);
  const created = !fs.existsSync(resolutionAbsolutePath);
  const cleared = isRouteCleared(input.decision);
  const reviewDate = new Date().toISOString().slice(0, 10);

  const resolution: DiscoveryRoutingReviewResolution = {
    candidateId: routing.candidateId,
    candidateName: routing.candidateName,
    routingRecordPath,
    reviewResolutionPath: resolutionRelativePath,
    decision: input.decision,
    resolvedRouteDestination: resolveRouteDestination(input.decision, routing.routeDestination),
    resolvedConfidence: cleared ? (input.resolvedConfidence ?? "high") : (routing.routingConfidence ?? "medium"),
    resolvedRouteConflict: cleared ? false : (routing.routeConflict ?? false),
    resolvedNeedsHumanReview: cleared ? false : (routing.needsHumanReview ?? true),
    rationale,
    reviewedBy,
    reviewDate,
    originalRouteDestination: routing.routeDestination,
    originalConfidence: routing.routingConfidence,
    originalRouteConflict: routing.routeConflict,
    originalNeedsHumanReview: routing.needsHumanReview,
  };

  fs.mkdirSync(path.dirname(resolutionAbsolutePath), { recursive: true });
  fs.writeFileSync(resolutionAbsolutePath, renderReviewResolution(resolution), "utf8");

  return {
    ok: true,
    created,
    resolution,
    reviewResolutionRelativePath: resolutionRelativePath.replace(/\\/g, "/"),
  };
}
