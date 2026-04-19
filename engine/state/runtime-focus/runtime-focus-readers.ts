import fs from "node:fs";
import path from "node:path";

import {
  readDirectiveRuntimeFollowUpArtifact,
  type DirectiveRuntimeFollowUpArtifact,
} from "../../../runtime/lib/openers/runtime-follow-up-opener.ts";
import type {
  GenericLegacyRuntimeRegistryArtifact,
  GenericRuntimePromotionReadinessArtifactBase,
  GenericRuntimeProofArtifact,
  GenericRuntimeRecordArtifact,
  GenericRuntimeRuntimeCapabilityBoundaryArtifact,
} from "../runtime-artifact-types.ts";
import {
  deriveRuntimeCandidateNameFromTitle,
  extractBulletValue,
  extractTitle,
  extractNestedBulletValue,
  readUtf8,
  requiredString,
  resolveDirectiveRelativePath,
  stripInlineBackticks,
} from "../shared-state-helpers.ts";

export type {
  GenericRuntimeProofArtifact,
  GenericRuntimeRecordArtifact,
  GenericRuntimeRuntimeCapabilityBoundaryArtifact,
} from "../runtime-artifact-types.ts";

export type GenericRuntimePromotionReadinessArtifact =
  GenericRuntimePromotionReadinessArtifactBase & {
    linkedPromotionRecordPath: string | null;
  };

export type GenericRuntimePromotionRecordArtifact = {
  candidateId: string;
  candidateName: string;
  promotionRecordPath: string;
  linkedRuntimeRecordPath: string | null;
  sourceIntentArtifactPath: string | null;
  proofArtifactPath: string | null;
  targetHost: string | null;
  targetRuntimeSurface: string | null;
  proposedRuntimeStatus: string;
};

export const RUNTIME_REGISTRY_ACCEPTANCE_GATE_VERSION =
  "runtime_registry_acceptance_gate.v1";

export function isAcceptedRuntimeRegistryArtifact(
  artifact: GenericLegacyRuntimeRegistryArtifact,
) {
  return artifact.runtimeStatus.startsWith("registry.accepted")
    && artifact.registryAcceptanceGateVersion === RUNTIME_REGISTRY_ACCEPTANCE_GATE_VERSION;
}

export function readGenericRuntimeRecordArtifact(input: {
  directiveRoot: string;
  runtimeRecordPath: string;
}): GenericRuntimeRecordArtifact {
  const runtimeRecordRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.runtimeRecordPath,
    "runtimeRecordPath",
  );
  const absolutePath = path.join(input.directiveRoot, runtimeRecordRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: runtimeRecordPath not found: ${runtimeRecordRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);
  const candidateId = requiredString(extractBulletValue(content, "Candidate id"), "candidate id");
  const candidateName = extractBulletValue(content, "Candidate name")
    ?? requiredString(deriveRuntimeCandidateNameFromTitle(title), "candidate name");
  const currentStatus = requiredString(extractBulletValue(content, "Current status"), "current status");

  if (content.includes("## follow-up review decision")) {
    return {
      kind: "follow_up_review",
      candidateId,
      candidateName,
      currentStatus,
      runtimeRecordRelativePath,
      linkedFollowUpRecord: requiredString(
        extractBulletValue(content, "Source follow-up record"),
        "source follow-up record",
      ),
      linkedRoutingPath: extractBulletValue(content, "Linked Discovery routing record"),
      runtimeProofRelativePath: extractBulletValue(
        content,
        "Next Runtime proof artifact if later approved",
      ),
      runtimeRuntimeCapabilityBoundaryPath: null,
      callableStubPath: null,
      sourceIntegrationRecordPath: null,
    };
  }

  return {
    kind: "callable_integration_record",
    candidateId,
    candidateName,
    currentStatus,
    runtimeRecordRelativePath,
    linkedFollowUpRecord: null,
    linkedRoutingPath: null,
    runtimeProofRelativePath: extractBulletValue(content, "Runtime proof artifact"),
    runtimeRuntimeCapabilityBoundaryPath: extractBulletValue(
      content,
      "Runtime runtime capability boundary",
    ),
    callableStubPath: extractBulletValue(content, "Callable stub path"),
    sourceIntegrationRecordPath: extractBulletValue(content, "Source integration record"),
  };
}

export function readGenericRuntimeProofArtifact(input: {
  directiveRoot: string;
  runtimeProofPath: string;
}): GenericRuntimeProofArtifact {
  const runtimeProofRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.runtimeProofPath,
    "runtimeProofPath",
  );
  const absolutePath = path.join(input.directiveRoot, runtimeProofRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: runtimeProofPath not found: ${runtimeProofRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);
  const candidateId = requiredString(extractBulletValue(content, "Candidate id"), "candidate id");
  const candidateName = extractBulletValue(content, "Candidate name")
    ?? requiredString(deriveRuntimeCandidateNameFromTitle(title), "candidate name");

  if (content.includes("## runtime record identity")) {
    return {
      kind: "follow_up_review",
      candidateId,
      candidateName,
      runtimeProofRelativePath,
      linkedRuntimeRecordPath: requiredString(
        extractBulletValue(content, "Legacy Runtime record path")
          || extractBulletValue(content, "Runtime v0 record path"),
        "Legacy Runtime record path",
      ),
      linkedFollowUpPath: requiredString(
        extractBulletValue(content, "Source follow-up record path"),
        "source follow-up record path",
      ),
      linkedRoutingPath: extractBulletValue(content, "Linked Discovery routing record"),
      promotionStatus: null,
      runtimeRuntimeCapabilityBoundaryPath: null,
      callableStubPath: null,
    };
  }

  return {
    kind: "callable_integration",
    candidateId,
    candidateName,
    runtimeProofRelativePath,
    linkedRuntimeRecordPath: requiredString(
      extractBulletValue(content, "Runtime record path"),
      "runtime record path",
    ),
    linkedFollowUpPath: null,
    linkedRoutingPath: null,
    promotionStatus: extractBulletValue(content, "Status"),
    runtimeRuntimeCapabilityBoundaryPath: extractBulletValue(
      content,
      "Runtime runtime capability boundary",
    ),
    callableStubPath: extractBulletValue(content, "Callable stub path"),
  };
}

export function readGenericRuntimeRuntimeCapabilityBoundaryArtifact(input: {
  directiveRoot: string;
  capabilityBoundaryPath: string;
}): GenericRuntimeRuntimeCapabilityBoundaryArtifact {
  const runtimeRuntimeCapabilityBoundaryPath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.capabilityBoundaryPath,
    "capabilityBoundaryPath",
  );
  const absolutePath = path.join(input.directiveRoot, runtimeRuntimeCapabilityBoundaryPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `invalid_input: capabilityBoundaryPath not found: ${runtimeRuntimeCapabilityBoundaryPath}`,
    );
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);
  const candidateId = path.basename(runtimeRuntimeCapabilityBoundaryPath)
    .replace(/-runtime-capability-boundary\.md$/u, "");

  return {
    candidateId,
    title,
    runtimeRuntimeCapabilityBoundaryPath,
    linkedRuntimeProofPath: extractBulletValue(content, "Proof artifact"),
    linkedRuntimeRecordPath: extractBulletValue(content, "Runtime record"),
    linkedCallableStubPath: extractBulletValue(content, "Callable stub"),
    currentProofStatus: extractBulletValue(content, "Current Runtime proof status"),
  };
}

export function readGenericRuntimePromotionReadinessArtifact(input: {
  directiveRoot: string;
  promotionReadinessPath: string;
}): GenericRuntimePromotionReadinessArtifact {
  const promotionReadinessPath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.promotionReadinessPath,
    "promotionReadinessPath",
  );
  const absolutePath = path.join(input.directiveRoot, promotionReadinessPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: promotionReadinessPath not found: ${promotionReadinessPath}`);
  }

  const content = readUtf8(absolutePath);
  return {
    candidateId: requiredString(extractBulletValue(content, "Candidate id"), "candidate id"),
    candidateName: requiredString(extractBulletValue(content, "Candidate name"), "candidate name"),
    promotionReadinessPath,
    linkedCapabilityBoundaryPath: requiredString(
      extractBulletValue(content, "Runtime capability boundary"),
      "runtime capability boundary",
    ),
    linkedRuntimeProofPath: extractBulletValue(content, "Runtime proof artifact"),
    linkedRuntimeRecordPath: extractBulletValue(content, "Legacy Runtime record")
      || extractBulletValue(content, "Runtime v0 record"),
    linkedCallableStubPath: extractBulletValue(content, "Linked callable stub"),
    linkedPromotionRecordPath:
      extractNestedBulletValue(content, "Host-facing promotion record")
      ?? extractNestedBulletValue(content, "Runtime promotion record")
      ?? extractBulletValue(content, "Host-facing promotion record")
      ?? extractBulletValue(content, "Runtime promotion record"),
    proposedHost: extractBulletValue(content, "Proposed host"),
    executionState: extractBulletValue(content, "Execution state"),
    currentStatus: extractBulletValue(content, "Current status"),
  };
}

export function readGenericRuntimePromotionRecordArtifact(input: {
  directiveRoot: string;
  promotionRecordPath: string;
}): GenericRuntimePromotionRecordArtifact {
  const promotionRecordPath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.promotionRecordPath,
    "promotionRecordPath",
  );
  const absolutePath = path.join(input.directiveRoot, promotionRecordPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: promotionRecordPath not found: ${promotionRecordPath}`);
  }

  const content = readUtf8(absolutePath);
  const candidateId = requiredString(
    stripInlineBackticks(extractBulletValue(content, "Candidate id")),
    "candidate id",
  );
  const candidateName = requiredString(
    stripInlineBackticks(extractBulletValue(content, "Candidate name")),
    "candidate name",
  );

  return {
    candidateId,
    candidateName,
    promotionRecordPath,
    linkedRuntimeRecordPath: extractBulletValue(content, "Linked Runtime record"),
    sourceIntentArtifactPath: extractBulletValue(content, "Source intent artifact"),
    proofArtifactPath: extractBulletValue(content, "Proof path"),
    targetHost: stripInlineBackticks(extractBulletValue(content, "Target host")),
    targetRuntimeSurface: stripInlineBackticks(
      extractBulletValue(content, "Target runtime surface"),
    ),
    proposedRuntimeStatus: requiredString(
      stripInlineBackticks(extractBulletValue(content, "Proposed runtime status")),
      "proposed runtime status",
    ),
  };
}

export function readGenericCallableIntegrationArtifact(input: {
  directiveRoot: string;
  callablePath: string;
}) {
  const callableRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.callablePath,
    "callablePath",
  );
  const absolutePath = path.join(input.directiveRoot, callableRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: callablePath not found: ${callableRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const candidateId =
    /capabilityId:\s*"([^"]+)"/.exec(content)?.[1]
    ?? path.basename(callableRelativePath).replace(/-callable-integration\.ts$/u, "");

  const statusMatch = /status:\s*"(callable|not_implemented)"/.exec(content);
  const callableStatus: "callable" | "not_implemented" =
    statusMatch?.[1] === "callable" ? "callable" : "not_implemented";

  return {
    candidateId,
    callableRelativePath,
    callableStatus,
    runtimeRecordRelativePath:
      /runtimeRecordPath:\s*"([^"]+)"/.exec(content)?.[1] ?? null,
    runtimeProofRelativePath:
      /runtimeProofPath:\s*"([^"]+)"/.exec(content)?.[1] ?? null,
    runtimeRuntimeCapabilityBoundaryPath:
      /runtimeRuntimeCapabilityBoundaryPath:\s*"([^"]+)"/.exec(content)?.[1] ?? null,
    integrationRecordPath:
      /integrationRecordPath:\s*"([^"]+)"/.exec(content)?.[1] ?? null,
  };
}
