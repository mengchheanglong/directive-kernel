import fs from "node:fs";
import path from "node:path";

import {
  normalizeDirectiveApprovalActor,
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveString,
  resolveDirectiveWorkspaceRelativePath,
} from "../../engine/approval-boundary.ts";

export type RuntimeHostSelectionDecision =
  | "select_standalone"
  | "select_web"
  | "confirm_inferred"
  | "override"
  | "defer";

export type RuntimeHostSelectionResolutionInput = {
  directiveRoot?: string;
  promotionReadinessPath: string;
  decision: RuntimeHostSelectionDecision;
  selectedHost: string;
  rationale: string;
  reviewedBy: string;
  resolvedConfidence?: "high" | "medium" | "low";
};

export type RuntimeHostSelectionResolution = {
  candidateId: string;
  promotionReadinessPath: string;
  hostSelectionResolutionPath: string;
  decision: RuntimeHostSelectionDecision;
  resolvedHost: string;
  resolvedConfidence: string;
  rationale: string;
  reviewedBy: string;
  reviewDate: string;
  originalProposedHost: string | null;
  originalHostSelectionMode: string | null;
  originalHostConfidence: string | null;
};

export type WriteRuntimeHostSelectionResolutionResult = {
  ok: true;
  created: boolean;
  resolution: RuntimeHostSelectionResolution;
  hostSelectionResolutionRelativePath: string;
};

function deriveHostSelectionResolutionPath(promotionReadinessPath: string): string {
  if (!promotionReadinessPath.includes("promotion-readiness")) {
    throw new Error(
      `invalid_input: promotionReadinessPath must contain "promotion-readiness", got "${promotionReadinessPath}"`,
    );
  }
  return promotionReadinessPath.replace(
    /promotion-readiness\.md$/,
    "host-selection-resolution.md",
  );
}

function resolveHostFromDecision(
  decision: RuntimeHostSelectionDecision,
  selectedHost: string,
  originalHost: string | null,
): string {
  switch (decision) {
    case "select_standalone":
      return "Directive Kernel standalone host (hosts/standalone-host/)";
    case "select_web":
      return "Directive Kernel web host (hosts/web-host/)";
    case "confirm_inferred":
      return originalHost && originalHost !== "pending_host_selection"
        ? originalHost
        : "Directive Kernel standalone host (hosts/standalone-host/)";
    case "override":
      return selectedHost;
    case "defer":
      return "pending_host_selection";
  }
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

function extractOriginalHostFields(
  directiveRoot: string,
  promotionReadinessPath: string,
): {
  candidateId: string;
  proposedHost: string | null;
  hostSelectionMode: string | null;
  hostConfidence: string | null;
} {
  const absolutePath = path.join(directiveRoot, promotionReadinessPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `invalid_input: promotionReadinessPath not found: ${promotionReadinessPath}`,
    );
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  return {
    candidateId:
      parseOptionalBullet(content, "Candidate id")
      ?? path.basename(promotionReadinessPath, ".md"),
    proposedHost: parseOptionalBullet(content, "Proposed host"),
    hostSelectionMode: parseOptionalBullet(content, "Host selection mode"),
    hostConfidence: parseOptionalBullet(content, "Proposed host confidence"),
  };
}

function renderHostSelectionResolution(resolution: RuntimeHostSelectionResolution): string {
  return [
    `# Runtime Host Selection Resolution`,
    "",
    `Date: ${resolution.reviewDate}`,
    "",
    `- Candidate id: ${resolution.candidateId}`,
    `- Review date: ${resolution.reviewDate}`,
    `- Reviewed by: ${resolution.reviewedBy}`,
    `- Linked promotion readiness: ${resolution.promotionReadinessPath}`,
    "",
    "## Original host state",
    "",
    `- Original proposed host: ${resolution.originalProposedHost ?? "n/a"}`,
    `- Original host selection mode: ${resolution.originalHostSelectionMode ?? "n/a"}`,
    `- Original host confidence: ${resolution.originalHostConfidence ?? "n/a"}`,
    "",
    "## Host selection decision",
    "",
    `- Decision: ${resolution.decision}`,
    `- Resolved host: ${resolution.resolvedHost}`,
    `- Resolved confidence: ${resolution.resolvedConfidence}`,
    `- Rationale: ${resolution.rationale}`,
    "",
    "## Validation boundary",
    "",
    "- This host selection resolution is an explicit operator decision artifact.",
    "- The original promotion readiness record is preserved unchanged.",
    "- Promotion prerequisites read this resolution alongside the promotion readiness record to compute effective host state.",
    "",
    "## Rollback boundary",
    "",
    "- Rollback: Delete this host selection resolution artifact. The promotion readiness record remains unchanged and the system returns to its pre-resolution state.",
    "- No-op path: Leave this resolution in place; promotion prerequisites use the resolved host.",
    "",
  ].join("\n");
}

export function resolveRuntimeHostSelectionResolutionPath(input: {
  promotionReadinessPath: string;
}): string {
  return deriveHostSelectionResolutionPath(input.promotionReadinessPath);
}

export function readRuntimeHostSelectionResolution(input: {
  directiveRoot: string;
  promotionReadinessPath: string;
}): RuntimeHostSelectionResolution | null {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const promotionReadinessPath = resolveDirectiveWorkspaceRelativePath(
    directiveRoot,
    input.promotionReadinessPath,
    "promotionReadinessPath",
  );
  const resolutionRelativePath = deriveHostSelectionResolutionPath(promotionReadinessPath);
  const resolutionAbsolutePath = path.join(directiveRoot, resolutionRelativePath);

  if (!fs.existsSync(resolutionAbsolutePath)) {
    return null;
  }

  const content = fs.readFileSync(resolutionAbsolutePath, "utf8");

  return {
    candidateId: parseOptionalBullet(content, "Candidate id") ?? "",
    promotionReadinessPath,
    hostSelectionResolutionPath: resolutionRelativePath,
    decision: (parseOptionalBullet(content, "Decision") ?? "defer") as RuntimeHostSelectionDecision,
    resolvedHost: parseOptionalBullet(content, "Resolved host") ?? "pending_host_selection",
    resolvedConfidence: parseOptionalBullet(content, "Resolved confidence") ?? "medium",
    rationale: parseOptionalBullet(content, "Rationale") ?? "",
    reviewedBy: parseOptionalBullet(content, "Reviewed by") ?? "",
    reviewDate: parseOptionalBullet(content, "Review date") ?? "",
    originalProposedHost: parseOptionalBullet(content, "Original proposed host"),
    originalHostSelectionMode: parseOptionalBullet(content, "Original host selection mode"),
    originalHostConfidence: parseOptionalBullet(content, "Original host confidence"),
  };
}

export function writeRuntimeHostSelectionResolution(
  input: RuntimeHostSelectionResolutionInput,
): WriteRuntimeHostSelectionResolutionResult {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const promotionReadinessPath = resolveDirectiveWorkspaceRelativePath(
    directiveRoot,
    input.promotionReadinessPath,
    "promotionReadinessPath",
  );
  const reviewedBy = normalizeDirectiveApprovalActor(input.reviewedBy);
  const rationale = requireDirectiveString(input.rationale, "rationale");

  const original = extractOriginalHostFields(directiveRoot, promotionReadinessPath);
  const resolvedHost = resolveHostFromDecision(
    input.decision,
    input.selectedHost,
    original.proposedHost,
  );
  const isCleared = input.decision !== "defer";

  const resolutionRelativePath = deriveHostSelectionResolutionPath(promotionReadinessPath);
  const resolutionAbsolutePath = path.join(directiveRoot, resolutionRelativePath);
  const created = !fs.existsSync(resolutionAbsolutePath);
  const reviewDate = new Date().toISOString().slice(0, 10);

  const resolution: RuntimeHostSelectionResolution = {
    candidateId: original.candidateId,
    promotionReadinessPath,
    hostSelectionResolutionPath: resolutionRelativePath,
    decision: input.decision,
    resolvedHost,
    resolvedConfidence: isCleared ? (input.resolvedConfidence ?? "high") : "low",
    rationale,
    reviewedBy,
    reviewDate,
    originalProposedHost: original.proposedHost,
    originalHostSelectionMode: original.hostSelectionMode,
    originalHostConfidence: original.hostConfidence,
  };

  fs.mkdirSync(path.dirname(resolutionAbsolutePath), { recursive: true });
  fs.writeFileSync(resolutionAbsolutePath, renderHostSelectionResolution(resolution), "utf8");

  return {
    ok: true,
    created,
    resolution,
    hostSelectionResolutionRelativePath: resolutionRelativePath.replace(/\\/g, "/"),
  };
}
