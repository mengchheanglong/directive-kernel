import fs from "node:fs";
import path from "node:path";

export const DIRECTIVE_RUNTIME_TO_HOST_CONTRACT_PATH =
  "shared/contracts/runtime-to-host.md";

export type DirectiveRuntimePromotionSpecificationLinkedArtifacts = {
  capabilityBoundaryPath: string | null;
  runtimeProofPath: string | null;
  runtimeRecordPath: string | null;
  followUpPath: string | null;
  routingPath: string | null;
  callableStubPath: string | null;
  promotionRecordPath: string | null;
};

export type DirectiveRuntimePromotionReadinessFields = {
  candidateId: string;
  candidateName: string;
  sourcePromotionReadinessPath: string;
  integrationMode: string | null;
  targetRuntimeSurface: string | null;
  proposedHost: string | null;
  executionState: string | null;
  rollbackPlan: string | null;
  requiredGates: string[];
  linkedArtifacts: DirectiveRuntimePromotionSpecificationLinkedArtifacts;
};

export type DirectiveRuntimePromotionSpecification = {
  schemaVersion: 1;
  generatedAt: string;
  candidateId: string;
  candidateName: string;
  sourcePromotionReadinessPath: string;
  integrationMode: string | null;
  targetRuntimeSurface: string | null;
  owner: string;
  sourceIntentArtifact: string | null;
  compileContractArtifact: string;
  runtimePermissionsProfile: {
    readOnlyLane: string;
    writeLane: string | null;
  };
  safeOutputScope: string | null;
  sanitizePolicy: string | null;
  requiredGates: string[];
  rollbackPlan: string | null;
  proofArtifactPath: string | null;
  proposedHost: string | null;
  hostDependence: string;
  executionState: string | null;
  linkedArtifacts: DirectiveRuntimePromotionSpecificationLinkedArtifacts;
  openDecisions: string[];
  hostConsumableDescription: string;
};

function extractBulletValue(content: string, label: string): string | null {
  const lines = content.split(/\r?\n/);
  const bulletPrefix = `- ${label}:`;
  const plainPrefix = `${label}:`;
  const startIndex = lines.findIndex((entry) => {
    const trimmed = entry.trim();
    return trimmed.startsWith(bulletPrefix) || trimmed.startsWith(plainPrefix);
  });
  if (startIndex === -1) {
    return null;
  }

  const trimmedStart = lines[startIndex].trim();
  const inlineValue = (
    trimmedStart.startsWith(bulletPrefix)
      ? trimmedStart.replace(bulletPrefix, "").trim()
      : trimmedStart.replace(plainPrefix, "").trim()
  ).replace(/^`|`$/g, "");
  if (inlineValue) {
    return inlineValue || null;
  }

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith("## ")) {
      break;
    }
    if (trimmed.startsWith("- ")) {
      const bulletValue = trimmed.replace(/^- /u, "").trim().replace(/^`|`$/g, "");
      if (!bulletValue || bulletValue.endsWith(":")) {
        break;
      }
      return bulletValue || null;
    }
    if (!line.startsWith("  ") && !line.startsWith("\t")) {
      break;
    }
  }

  return null;
}

function extractListAfterHeading(content: string, heading: string): string[] {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^## ${escaped}\\r?\\n([\\s\\S]*?)(?=^##\\s|$)`, "m");
  const match = content.match(pattern);
  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-\s+/, "").replace(/^`|`$/g, "").trim())
    .filter((line) => line.length > 0);
}

export function resolveDirectiveRuntimePromotionSpecificationPath(input: {
  promotionReadinessPath: string;
}) {
  return input.promotionReadinessPath
    .replace(/^runtime\/05-promotion-readiness\//u, "runtime/06-promotion-specifications/")
    .replace(/-promotion-readiness\.md$/u, "-promotion-specification.json");
}

export function parseDirectiveRuntimePromotionReadinessFields(input: {
  directiveRoot: string;
  promotionReadinessPath: string;
}): DirectiveRuntimePromotionReadinessFields {
  const relativePath = input.promotionReadinessPath.replace(/\\/g, "/");
  const absolutePath = path.join(input.directiveRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`promotion_readiness_not_found:${relativePath}`);
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const candidateId =
    extractBulletValue(content, "Candidate id") || path.basename(relativePath, ".md");
  const candidateName = extractBulletValue(content, "Candidate name") || candidateId;
  const requiredGates = extractListAfterHeading(content, "what is now explicit")
    .filter((line) => line.startsWith("`") && line.endsWith("`"))
    .map((line) => line.replace(/^`|`$/g, ""));

  return {
    candidateId,
    candidateName,
    sourcePromotionReadinessPath: relativePath,
    integrationMode: extractBulletValue(content, "Proposed runtime surface"),
    targetRuntimeSurface: extractBulletValue(content, "Runtime objective"),
    proposedHost: extractBulletValue(content, "Proposed host"),
    executionState: extractBulletValue(content, "Execution state"),
    rollbackPlan: extractBulletValue(content, "Rollback"),
    requiredGates:
      requiredGates.length > 0
        ? requiredGates
        : [
            "behavior_preservation",
            "metric_improvement_or_equivalent_value",
            "runtime_boundary_review",
          ],
    linkedArtifacts: {
      capabilityBoundaryPath:
        extractBulletValue(content, "Runtime capability boundary path")
        || extractBulletValue(content, "Runtime capability boundary"),
      runtimeProofPath:
        extractBulletValue(content, "Source Runtime proof artifact")
        || extractBulletValue(content, "Runtime proof artifact"),
      runtimeRecordPath:
        extractBulletValue(content, "Source Legacy Runtime record")
        || extractBulletValue(content, "Source Runtime v0 record")
        || extractBulletValue(content, "Legacy Runtime record")
        || extractBulletValue(content, "Runtime v0 record"),
      followUpPath:
        extractBulletValue(content, "Source Runtime follow-up record")
        || extractBulletValue(content, "Runtime follow-up record"),
      routingPath:
        extractBulletValue(content, "Linked Discovery routing record")
        || extractBulletValue(content, "Discovery routing record"),
      callableStubPath:
        extractBulletValue(content, "Linked callable stub")
        || extractBulletValue(content, "Callable stub"),
      promotionRecordPath:
        extractBulletValue(content, "Host-facing promotion record")
        || extractBulletValue(content, "Runtime promotion record"),
    },
  };
}

export function buildDirectiveRuntimePromotionSpecification(input: {
  directiveRoot: string;
  promotionReadinessPath: string;
  generatedAt?: string;
}): DirectiveRuntimePromotionSpecification {
  const fields = parseDirectiveRuntimePromotionReadinessFields({
    directiveRoot: input.directiveRoot,
    promotionReadinessPath: input.promotionReadinessPath,
  });
  const hostIsKnown = Boolean(
    fields.proposedHost && fields.proposedHost !== "pending_host_selection",
  );
  const openDecisions: string[] = [];

  if (!hostIsKnown) {
    openDecisions.push("Host selection: no host has been chosen for this candidate.");
  }
  if (fields.executionState?.includes("not implemented")) {
    openDecisions.push("Implementation: runtime implementation has not been opened.");
  }
  if (
    fields.executionState?.includes("not promoted")
    && !fields.linkedArtifacts.promotionRecordPath
  ) {
    openDecisions.push("Promotion: host-facing promotion has not been opened.");
  }
  if (fields.executionState?.includes("not host-integrated")) {
    openDecisions.push("Host integration: host integration has not been opened.");
  }

  const gatesSummary = fields.requiredGates.join(", ");
  const hostConsumableDescription = hostIsKnown
    ? `If promoted, ${fields.proposedHost} would receive a ${fields.integrationMode || "runtime"} integration of "${fields.candidateName}" (${fields.targetRuntimeSurface || "runtime capability"}). The host would need to provide a runtime surface for the integration mode "${fields.integrationMode || "unknown"}" with the required gates: ${gatesSummary}.`
    : `Host selection is pending. Once a host is chosen, it would receive a ${fields.integrationMode || "runtime"} integration of "${fields.candidateName}" with the required gates: ${gatesSummary}.`;

  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    candidateId: fields.candidateId,
    candidateName: fields.candidateName,
    sourcePromotionReadinessPath: fields.sourcePromotionReadinessPath,
    integrationMode: fields.integrationMode,
    targetRuntimeSurface: fields.targetRuntimeSurface,
    owner: "directive-workspace",
    sourceIntentArtifact: fields.linkedArtifacts.capabilityBoundaryPath,
    compileContractArtifact: DIRECTIVE_RUNTIME_TO_HOST_CONTRACT_PATH,
    runtimePermissionsProfile: {
      readOnlyLane: "read_only",
      writeLane: null,
    },
    safeOutputScope: null,
    sanitizePolicy: null,
    requiredGates: [...fields.requiredGates],
    rollbackPlan: fields.rollbackPlan,
    proofArtifactPath: fields.linkedArtifacts.runtimeProofPath,
    proposedHost: fields.proposedHost,
    hostDependence: hostIsKnown ? "host_adapter_required" : "pending_host_selection",
    executionState: fields.executionState,
    linkedArtifacts: {
      ...fields.linkedArtifacts,
    },
    openDecisions,
    hostConsumableDescription,
  };
}

export function readDirectiveRuntimePromotionSpecification(input: {
  directiveRoot: string;
  promotionSpecificationPath: string;
}): DirectiveRuntimePromotionSpecification {
  const relativePath = input.promotionSpecificationPath.replace(/\\/g, "/");
  const absolutePath = path.join(input.directiveRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`promotion_specification_not_found:${relativePath}`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as DirectiveRuntimePromotionSpecification;
}

