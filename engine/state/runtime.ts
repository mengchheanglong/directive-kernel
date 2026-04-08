import fs from "node:fs";
import path from "node:path";

import type { DirectiveWorkspaceArtifactKind } from "./index.ts";
import {
  readDirectiveRuntimeFollowUpArtifact,
  type DirectiveRuntimeFollowUpArtifact,
} from "../../runtime/lib/runtime-follow-up-opener.ts";
import {
  deriveRuntimeCandidateNameFromTitle,
  extractBulletValue,
  extractColonValue,
  extractMarkdownSectionSummary,
  extractNestedBulletValue,
  extractTitle,
  isLegacyRuntimeFollowUpDeferred,
  normalizeRelativePath,
  optionalString,
  readGenericLegacyRuntimeFollowUpArtifact,
  readGenericLegacyRuntimeHandoffArtifact,
  readGenericLegacyRuntimeLiveFetchGateSnapshotArtifact,
  readGenericLegacyRuntimeLiveFetchProofArtifact,
  readGenericLegacyRuntimeLivePoolArtifact,
  readGenericLegacyRuntimePreconditionDecisionNoteArtifact,
  readGenericLegacyRuntimeProofChecklistArtifact,
  readGenericLegacyRuntimePromotionRecordArtifact,
  readGenericLegacyRuntimeRecordArtifact,
  readGenericLegacyRuntimeRegistryArtifact,
  readGenericLegacyRuntimeSamplePoolArtifact,
  readGenericLegacyRuntimeSliceExecutionArtifact,
  readGenericLegacyRuntimeSliceProofArtifact,
  readGenericLegacyRuntimeSystemBundleArtifact,
  readGenericLegacyRuntimeTransformationProofArtifact,
  readGenericLegacyRuntimeTransformationRecordArtifact,
  readGenericLegacyRuntimeValidationNoteArtifact,
  readUtf8,
  requiredString,
  resolveDirectiveRelativePath,
  stripInlineBackticks,
  zeroLinkedArtifacts,
} from "./shared.ts";
import {
  fileExistsInDirectiveWorkspace,
  readLinkedArtifactIfPresent,
  recordInconsistentLink,
  recordMissingExpectedArtifact,
  recordMissingLinkedArtifactIfAbsent,
} from "../artifact-link-validation.ts";
import { resolveDirectiveRuntimePromotionSpecificationPath } from "../../runtime/lib/runtime-promotion-specification.ts";
import { resolveRuntimeHostSelectionResolutionPath } from "../../runtime/lib/runtime-host-selection-resolution.ts";
import type {
  GenericLegacyRuntimeFollowUpArtifact,
  GenericLegacyRuntimeHandoffArtifact,
  GenericLegacyRuntimeLiveFetchGateSnapshotArtifact,
  GenericLegacyRuntimeLiveFetchProofArtifact,
  GenericLegacyRuntimeLivePoolArtifact,
  GenericLegacyRuntimePreconditionDecisionNoteArtifact,
  GenericLegacyRuntimeProofChecklistArtifact,
  GenericLegacyRuntimePromotionRecordArtifact,
  GenericLegacyRuntimeRecordArtifact,
  GenericLegacyRuntimeRegistryArtifact,
  GenericLegacyRuntimeSamplePoolArtifact,
  GenericLegacyRuntimeSliceExecutionArtifact,
  GenericLegacyRuntimeSliceProofArtifact,
  GenericLegacyRuntimeSystemBundleArtifact,
  GenericLegacyRuntimeTransformationProofArtifact,
  GenericLegacyRuntimeTransformationRecordArtifact,
  GenericLegacyRuntimeValidationNoteArtifact,
  GenericRuntimePromotionReadinessArtifactBase,
  GenericRuntimeProofArtifact,
  GenericRuntimeRecordArtifact,
  GenericRuntimeRuntimeCapabilityBoundaryArtifact,
} from "./runtime-artifact-types.ts";

type GenericRuntimePromotionReadinessArtifact = GenericRuntimePromotionReadinessArtifactBase & {
  linkedPromotionRecordPath: string | null;
};

type GenericRuntimePromotionRecordArtifact = {
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

const RUNTIME_REGISTRY_ACCEPTANCE_GATE_VERSION =
  "runtime_registry_acceptance_gate.v1";

function isAcceptedRuntimeRegistryArtifact(
  artifact: GenericLegacyRuntimeRegistryArtifact,
) {
  return artifact.runtimeStatus.startsWith("registry.accepted")
    && artifact.registryAcceptanceGateVersion === RUNTIME_REGISTRY_ACCEPTANCE_GATE_VERSION;
}

function readGenericRuntimeRecordArtifact(input: {
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
      runtimeProofRelativePath: extractBulletValue(content, "Next Runtime proof artifact if later approved"),
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
    runtimeRuntimeCapabilityBoundaryPath: extractBulletValue(content, "Runtime runtime capability boundary"),
    callableStubPath: extractBulletValue(content, "Callable stub path"),
    sourceIntegrationRecordPath: extractBulletValue(content, "Source integration record"),
  };
}

function readGenericRuntimeProofArtifact(input: {
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
    linkedRuntimeRecordPath: requiredString(extractBulletValue(content, "Runtime record path"), "runtime record path"),
    linkedFollowUpPath: null,
    linkedRoutingPath: null,
    promotionStatus: extractBulletValue(content, "Status"),
    runtimeRuntimeCapabilityBoundaryPath: extractBulletValue(content, "Runtime runtime capability boundary"),
    callableStubPath: extractBulletValue(content, "Callable stub path"),
  };
}

function readGenericRuntimeRuntimeCapabilityBoundaryArtifact(input: {
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
    throw new Error(`invalid_input: capabilityBoundaryPath not found: ${runtimeRuntimeCapabilityBoundaryPath}`);
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

function readGenericRuntimePromotionReadinessArtifact(input: {
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

function readGenericRuntimePromotionRecordArtifact(input: {
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
    targetRuntimeSurface: stripInlineBackticks(extractBulletValue(content, "Target runtime surface")),
    proposedRuntimeStatus: requiredString(
      stripInlineBackticks(extractBulletValue(content, "Proposed runtime status")),
      "proposed runtime status",
    ),
  };
}

export function buildRuntimePromotionReadinessBlockers(input: {
  promotionReadiness: GenericRuntimePromotionReadinessArtifact | null;
}) {
  if (!input.promotionReadiness) {
    return [];
  }

  const blockers: string[] = [];
  if (input.promotionReadiness.proposedHost === "pending_host_selection") {
    blockers.push("proposed_host_pending_selection");
  }
  if (input.promotionReadiness.executionState?.includes("not implemented")) {
    blockers.push("runtime_implementation_unopened");
  }
  if (
    input.promotionReadiness.executionState?.includes("not promoted")
    && !input.promotionReadiness.linkedPromotionRecordPath
  ) {
    blockers.push("host_facing_promotion_unopened");
  }

  return blockers;
}

function buildLegacyRuntimeFollowUpState(input: {
  directiveRoot: string;
  legacyFollowUp: GenericLegacyRuntimeFollowUpArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];
  const legacyDeferred = isLegacyRuntimeFollowUpDeferred({
    currentDecisionState: input.legacyFollowUp.currentDecisionState,
    currentStatus: input.legacyFollowUp.currentStatus,
  });

  if (legacyDeferred) {
    if (input.legacyFollowUp.reentryContractPath) {
      recordMissingLinkedArtifactIfAbsent({
        directiveRoot: input.directiveRoot,
        state: { missingExpectedArtifacts, inconsistentLinks },
        relativePath: input.legacyFollowUp.reentryContractPath,
        label: "Runtime re-entry contract",
      });
    } else {
      recordInconsistentLink(
        { missingExpectedArtifacts, inconsistentLinks },
        "missing linked Runtime re-entry contract: re-entry contract path (if deferred) was not recorded",
      );
    }
  }

  return {
    currentStage: legacyDeferred
      ? "runtime.follow_up.legacy_deferred"
      : "runtime.follow_up.legacy_recorded",
    nextLegalStep: legacyDeferred
      ? "No automatic Runtime step is open; this historical deferred Runtime follow-up remains parked unless a new bounded Legacy Runtime re-entry is explicitly opened."
      : "No automatic Runtime step is open; this historical Runtime follow-up remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeHandoffState(input: {
  directiveRoot: string;
  legacyHandoff: GenericLegacyRuntimeHandoffArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  for (const [label, relativePath] of [
    ["Originating Architecture record", input.legacyHandoff.originatingArchitectureRecordPath],
    ["Runtime follow-up", input.legacyHandoff.runtimeFollowUpPath],
    ["Runtime record", input.legacyHandoff.runtimeRecordPath],
    ["Runtime proof artifact", input.legacyHandoff.runtimeProofPath],
    ["Runtime promotion record", input.legacyHandoff.promotionRecordPath],
    ["Runtime registry entry", input.legacyHandoff.registryEntryPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  return {
    currentStage: "runtime.handoff.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical architecture-to-runtime handoff remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeRegistryState(input: {
  directiveRoot: string;
  legacyRuntimeRegistry: GenericLegacyRuntimeRegistryArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];
  const registryAccepted = isAcceptedRuntimeRegistryArtifact(input.legacyRuntimeRegistry);
  linked.runtimeRegistryEntryPath = input.legacyRuntimeRegistry.registryEntryRelativePath;
  linked.runtimePromotionRecordPath = input.legacyRuntimeRegistry.linkedPromotionRecordPath;
  linked.runtimeHostConsumptionReportPath = input.legacyRuntimeRegistry.proofArtifactPath;

  for (const [label, relativePath] of [
    ["Runtime promotion record", input.legacyRuntimeRegistry.linkedPromotionRecordPath],
    ["Runtime proof artifact", input.legacyRuntimeRegistry.proofArtifactPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  return {
    currentStage: registryAccepted
      ? "runtime.registry.accepted"
      : "runtime.registry.legacy_recorded",
    nextLegalStep:
      registryAccepted
        ? "No automatic Runtime step is open; this Runtime registry entry is manually accepted through a bounded registry gate; promotion automation remains intentionally unopened."
        : "No automatic Runtime step is open; this historical Runtime registry entry remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimePromotionRecordState(input: {
  directiveRoot: string;
  legacyRuntimePromotionRecord: GenericLegacyRuntimePromotionRecordArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  for (const [label, relativePath] of [
    ["Runtime record", input.legacyRuntimePromotionRecord.linkedRuntimeRecordPath],
    ["Source intent artifact", input.legacyRuntimePromotionRecord.sourceIntentArtifactPath],
    ["Runtime proof artifact", input.legacyRuntimePromotionRecord.proofArtifactPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  return {
    currentStage: "runtime.promotion_record.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime promotion record remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeRecordState(input: {
  directiveRoot: string;
  legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  for (const [label, relativePath] of [
    ["Runtime origin path", input.legacyRuntimeRecord.originPath],
    ["Runtime follow-up", input.legacyRuntimeRecord.linkedFollowUpPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  return {
    currentStage: "runtime.record.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime record remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeSliceProofState(input: {
  directiveRoot: string;
  legacyRuntimeSliceProof: GenericLegacyRuntimeSliceProofArtifact;
  legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeRecordPath = input.legacyRuntimeSliceProof.linkedRuntimeRecordPath;

  for (const [label, relativePath] of [
    ["Runtime record", input.legacyRuntimeSliceProof.linkedRuntimeRecordPath],
    ["Runtime execution record", input.legacyRuntimeSliceProof.linkedExecutionRecordPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  if (
    input.legacyRuntimeRecord
    && input.legacyRuntimeRecord.candidateId !== input.legacyRuntimeSliceProof.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime slice proof candidate "${input.legacyRuntimeSliceProof.candidateId}" does not match runtime record "${input.legacyRuntimeRecord.candidateId}"`,
    );
  }

  return {
    currentStage: "runtime.slice_proof.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime slice proof remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeSliceExecutionState(input: {
  directiveRoot: string;
  legacyRuntimeSliceExecution: GenericLegacyRuntimeSliceExecutionArtifact;
  legacyRuntimeSliceProof: GenericLegacyRuntimeSliceProofArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeProofPath = input.legacyRuntimeSliceExecution.linkedRuntimeProofPath;

  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.legacyRuntimeSliceExecution.linkedRuntimeProofPath,
    label: "Runtime slice proof",
  });

  if (
    input.legacyRuntimeSliceProof
    && input.legacyRuntimeSliceProof.candidateId !== input.legacyRuntimeSliceExecution.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime slice execution candidate "${input.legacyRuntimeSliceExecution.candidateId}" does not match runtime slice proof "${input.legacyRuntimeSliceProof.candidateId}"`,
    );
  }

  return {
    currentStage: "runtime.slice_execution.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime slice execution remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeProofChecklistState(input: {
  directiveRoot: string;
  legacyRuntimeProofChecklist: GenericLegacyRuntimeProofChecklistArtifact;
  legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact | null;
  legacyRuntimeSliceProof: GenericLegacyRuntimeSliceProofArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeRecordPath = input.legacyRuntimeProofChecklist.linkedRuntimeRecordPath;
  linked.runtimeProofPath = input.legacyRuntimeProofChecklist.linkedRuntimeProofPath;

  for (const [label, relativePath] of [
    ["Runtime record", input.legacyRuntimeProofChecklist.linkedRuntimeRecordPath],
    ["Primary Runtime proof", input.legacyRuntimeProofChecklist.linkedRuntimeProofPath],
    ["Supplemental Runtime proof", input.legacyRuntimeProofChecklist.linkedSupplementalProofPath],
    ["Gate snapshot", input.legacyRuntimeProofChecklist.gateSnapshotPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  if (
    input.legacyRuntimeRecord
    && input.legacyRuntimeRecord.candidateId !== input.legacyRuntimeProofChecklist.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime proof checklist candidate "${input.legacyRuntimeProofChecklist.candidateId}" does not match runtime record "${input.legacyRuntimeRecord.candidateId}"`,
    );
  }
  if (
    input.legacyRuntimeSliceProof
    && input.legacyRuntimeSliceProof.candidateId !== input.legacyRuntimeProofChecklist.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime proof checklist candidate "${input.legacyRuntimeProofChecklist.candidateId}" does not match runtime slice proof "${input.legacyRuntimeSliceProof.candidateId}"`,
    );
  }

  return {
    currentStage: "runtime.proof_checklist.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime proof checklist remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeLiveFetchProofState(input: {
  directiveRoot: string;
  legacyRuntimeLiveFetchProof: GenericLegacyRuntimeLiveFetchProofArtifact;
  legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact | null;
  legacyRuntimeProofChecklist: GenericLegacyRuntimeProofChecklistArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeRecordPath = input.legacyRuntimeLiveFetchProof.linkedRuntimeRecordPath;
  linked.runtimeProofPath = input.legacyRuntimeLiveFetchProof.linkedProofChecklistPath;

  for (const [label, relativePath] of [
    ["Runtime record", input.legacyRuntimeLiveFetchProof.linkedRuntimeRecordPath],
    ["Proof checklist", input.legacyRuntimeLiveFetchProof.linkedProofChecklistPath],
    ["Gate snapshot", input.legacyRuntimeLiveFetchProof.gateSnapshotPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  if (
    input.legacyRuntimeRecord
    && input.legacyRuntimeRecord.candidateId !== input.legacyRuntimeLiveFetchProof.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live-fetch proof candidate "${input.legacyRuntimeLiveFetchProof.candidateId}" does not match runtime record "${input.legacyRuntimeRecord.candidateId}"`,
    );
  }
  if (
    input.legacyRuntimeProofChecklist
    && input.legacyRuntimeProofChecklist.candidateId !== input.legacyRuntimeLiveFetchProof.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live-fetch proof candidate "${input.legacyRuntimeLiveFetchProof.candidateId}" does not match runtime proof checklist "${input.legacyRuntimeProofChecklist.candidateId}"`,
    );
  }

  return {
    currentStage: "runtime.live_fetch_proof.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime live-fetch proof remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeLiveFetchGateSnapshotState(input: {
  directiveRoot: string;
  legacyRuntimeLiveFetchGateSnapshot: GenericLegacyRuntimeLiveFetchGateSnapshotArtifact;
  legacyRuntimeLiveFetchProof: GenericLegacyRuntimeLiveFetchProofArtifact | null;
  legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeProofPath = input.legacyRuntimeLiveFetchGateSnapshot.linkedLiveFetchProofPath;
  linked.runtimeRecordPath = input.legacyRuntimeLiveFetchProof?.linkedRuntimeRecordPath ?? null;

  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.legacyRuntimeLiveFetchGateSnapshot.linkedLiveFetchProofPath,
    label: "Live-fetch proof",
  });

  if (
    input.legacyRuntimeLiveFetchProof
    && input.legacyRuntimeLiveFetchProof.candidateId !== input.legacyRuntimeLiveFetchGateSnapshot.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live-fetch gate snapshot candidate "${input.legacyRuntimeLiveFetchGateSnapshot.candidateId}" does not match live-fetch proof "${input.legacyRuntimeLiveFetchProof.candidateId}"`,
    );
  }
  if (
    input.legacyRuntimeLiveFetchProof?.gateSnapshotPath
    && input.legacyRuntimeLiveFetchProof.gateSnapshotPath
      !== input.legacyRuntimeLiveFetchGateSnapshot.gateSnapshotRelativePath
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live-fetch gate snapshot "${input.legacyRuntimeLiveFetchGateSnapshot.gateSnapshotRelativePath}" does not match live-fetch proof snapshot "${input.legacyRuntimeLiveFetchProof.gateSnapshotPath}"`,
    );
  }
  if (
    input.legacyRuntimeRecord
    && input.legacyRuntimeRecord.candidateId !== input.legacyRuntimeLiveFetchGateSnapshot.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live-fetch gate snapshot candidate "${input.legacyRuntimeLiveFetchGateSnapshot.candidateId}" does not match runtime record "${input.legacyRuntimeRecord.candidateId}"`,
    );
  }

  return {
    currentStage: "runtime.live_fetch_gate_snapshot.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime live-fetch gate snapshot remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeLivePoolArtifactState(input: {
  directiveRoot: string;
  legacyRuntimeLivePoolArtifact: GenericLegacyRuntimeLivePoolArtifact;
  legacyRuntimeLiveFetchGateSnapshot: GenericLegacyRuntimeLiveFetchGateSnapshotArtifact | null;
  legacyRuntimeLiveFetchProof: GenericLegacyRuntimeLiveFetchProofArtifact | null;
  legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeProofPath = input.legacyRuntimeLivePoolArtifact.linkedLiveFetchProofPath;
  linked.runtimeRecordPath = input.legacyRuntimeLiveFetchProof?.linkedRuntimeRecordPath ?? null;

  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.legacyRuntimeLivePoolArtifact.linkedGateSnapshotPath,
    label: "Live-fetch gate snapshot",
  });
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.legacyRuntimeLivePoolArtifact.linkedLiveFetchProofPath,
    label: "Live-fetch proof",
  });

  if (
    input.legacyRuntimeLiveFetchGateSnapshot
    && input.legacyRuntimeLiveFetchGateSnapshot.candidateId !== input.legacyRuntimeLivePoolArtifact.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live pool artifact candidate "${input.legacyRuntimeLivePoolArtifact.candidateId}" does not match gate snapshot "${input.legacyRuntimeLiveFetchGateSnapshot.candidateId}"`,
    );
  }
  if (
    input.legacyRuntimeLiveFetchProof
    && input.legacyRuntimeLiveFetchProof.candidateId !== input.legacyRuntimeLivePoolArtifact.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live pool artifact candidate "${input.legacyRuntimeLivePoolArtifact.candidateId}" does not match live-fetch proof "${input.legacyRuntimeLiveFetchProof.candidateId}"`,
    );
  }
  if (
    input.legacyRuntimeRecord
    && input.legacyRuntimeRecord.candidateId !== input.legacyRuntimeLivePoolArtifact.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live pool artifact candidate "${input.legacyRuntimeLivePoolArtifact.candidateId}" does not match runtime record "${input.legacyRuntimeRecord.candidateId}"`,
    );
  }

  return {
    currentStage: input.legacyRuntimeLivePoolArtifact.degraded
      ? "runtime.live_degraded_pool.legacy_recorded"
      : "runtime.live_qualified_pool.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime live pool artifact remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeSamplePoolArtifactState(input: {
  legacyRuntimeSamplePoolArtifact: GenericLegacyRuntimeSamplePoolArtifact;
}) {
  return {
    currentStage: input.legacyRuntimeSamplePoolArtifact.degraded
      ? "runtime.sample_degraded_pool.legacy_recorded"
      : "runtime.sample_qualified_pool.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime sample pool artifact remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts: [] as string[],
    inconsistentLinks: [] as string[],
    linked: zeroLinkedArtifacts(),
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeSystemBundleState() {
  return {
    currentStage: "runtime.system_bundle.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime system-bundle note remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts: [] as string[],
    inconsistentLinks: [] as string[],
    linked: zeroLinkedArtifacts(),
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeValidationNoteState() {
  return {
    currentStage: "runtime.validation_note.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime validation note remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts: [] as string[],
    inconsistentLinks: [] as string[],
    linked: zeroLinkedArtifacts(),
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimePreconditionDecisionNoteState(input: {
  directiveRoot: string;
  legacyRuntimePreconditionDecisionNote: GenericLegacyRuntimePreconditionDecisionNoteArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeFollowUpPath = input.legacyRuntimePreconditionDecisionNote.linkedFollowUpPath;
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: linked.runtimeFollowUpPath,
    label: "Runtime follow-up record",
  });

  const currentStage =
    input.legacyRuntimePreconditionDecisionNote.noteKind === "precondition_proof"
      ? "runtime.precondition_proof.legacy_recorded"
      : input.legacyRuntimePreconditionDecisionNote.noteKind === "precondition_correction"
        ? "runtime.precondition_correction.legacy_recorded"
        : "runtime.host_adapter_decision.legacy_recorded";
  const nextLegalStep =
    input.legacyRuntimePreconditionDecisionNote.noteKind === "precondition_proof"
      ? "No automatic Runtime step is open; this historical Runtime CLI precondition proof remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened."
      : input.legacyRuntimePreconditionDecisionNote.noteKind === "precondition_correction"
        ? "No automatic Runtime step is open; this historical Runtime precondition correction remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened."
        : "No automatic Runtime step is open; this historical Runtime host-adapter decision remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.";

  return {
    currentStage,
    nextLegalStep,
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeTransformationRecordState(input: {
  directiveRoot: string;
  legacyRuntimeTransformationRecord: GenericLegacyRuntimeTransformationRecordArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  for (const [label, relativePath] of [
    ["Discovery intake record", input.legacyRuntimeTransformationRecord.discoveryIntakePath],
    ["Transformation baseline artifact", input.legacyRuntimeTransformationRecord.baselineArtifactPath],
    ["Transformation result artifact", input.legacyRuntimeTransformationRecord.resultArtifactPath],
    ["Runtime promotion record", input.legacyRuntimeTransformationRecord.promotionRecordPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  return {
    currentStage: "runtime.transformation_record.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime transformation record remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function buildLegacyRuntimeTransformationProofState(input: {
  directiveRoot: string;
  legacyRuntimeTransformationProof: GenericLegacyRuntimeTransformationProofArtifact;
  legacyRuntimeTransformationRecord: GenericLegacyRuntimeTransformationRecordArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.legacyRuntimeTransformationProof.linkedTransformationRecordPath,
    label: "Transformation record",
  });

  if (
    input.legacyRuntimeTransformationRecord
    && input.legacyRuntimeTransformationRecord.candidateId !== input.legacyRuntimeTransformationProof.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `transformation proof candidate "${input.legacyRuntimeTransformationProof.candidateId}" does not match transformation record "${input.legacyRuntimeTransformationRecord.candidateId}"`,
    );
  }

  return {
    currentStage: "runtime.transformation_proof.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime transformation proof remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

function inferRuntimeRuntimeCapabilityBoundaryPathFromProof(input: {
  directiveRoot: string;
  runtimeProofRelativePath: string | null | undefined;
}) {
  if (!input.runtimeProofRelativePath) {
    return null;
  }
  if (
    !input.runtimeProofRelativePath.startsWith("runtime/03-proof/")
    || !input.runtimeProofRelativePath.endsWith("-proof.md")
  ) {
    return null;
  }

  const candidatePath = normalizeRelativePath(
    input.runtimeProofRelativePath
      .replace(/^runtime\/03-proof\//u, "runtime/04-capability-boundaries/")
      .replace(/-proof\.md$/u, "-runtime-capability-boundary.md"),
  );

  return fileExistsInDirectiveWorkspace(input.directiveRoot, candidatePath) ? candidatePath : null;
}

function inferRuntimePromotionReadinessPathFromCapabilityBoundary(input: {
  directiveRoot: string;
  capabilityBoundaryPath: string | null | undefined;
}) {
  if (!input.capabilityBoundaryPath) {
    return null;
  }
  if (
    !input.capabilityBoundaryPath.startsWith("runtime/04-capability-boundaries/")
    || !input.capabilityBoundaryPath.endsWith("-runtime-capability-boundary.md")
  ) {
    return null;
  }

  const candidatePath = normalizeRelativePath(
    input.capabilityBoundaryPath
      .replace(/^runtime\/04-capability-boundaries\//u, "runtime/05-promotion-readiness/")
      .replace(/-runtime-capability-boundary\.md$/u, "-promotion-readiness.md"),
  );

  return fileExistsInDirectiveWorkspace(input.directiveRoot, candidatePath) ? candidatePath : null;
}

function inferRuntimePromotionSpecificationPathFromPromotionReadiness(input: {
  directiveRoot: string;
  promotionReadinessPath: string | null | undefined;
}) {
  if (!input.promotionReadinessPath) {
    return null;
  }
  if (
    !input.promotionReadinessPath.startsWith("runtime/05-promotion-readiness/")
    || !input.promotionReadinessPath.endsWith("-promotion-readiness.md")
  ) {
    return null;
  }

  const candidatePath = resolveDirectiveRuntimePromotionSpecificationPath({
    promotionReadinessPath: input.promotionReadinessPath,
  });
  return fileExistsInDirectiveWorkspace(input.directiveRoot, candidatePath) ? candidatePath : null;
}

function inferRuntimeHostSelectionResolutionPath(input: {
  directiveRoot: string;
  promotionReadinessPath: string | null | undefined;
}) {
  if (!input.promotionReadinessPath) {
    return null;
  }
  if (
    !input.promotionReadinessPath.includes("promotion-readiness")
    || !input.promotionReadinessPath.endsWith("-promotion-readiness.md")
  ) {
    return null;
  }

  const candidatePath = resolveRuntimeHostSelectionResolutionPath({
    promotionReadinessPath: input.promotionReadinessPath,
  });
  return fileExistsInDirectiveWorkspace(input.directiveRoot, candidatePath) ? candidatePath : null;
}

function findRuntimePromotionReadinessPathForCandidate(input: {
  directiveRoot: string;
  candidateId: string | null | undefined;
}) {
  const candidateId = input.candidateId?.trim();
  if (!candidateId) {
    return null;
  }

  const promotionReadinessDir = path.join(input.directiveRoot, "runtime", "05-promotion-readiness");
  if (!fs.existsSync(promotionReadinessDir)) {
    return null;
  }

  const matches = fs
    .readdirSync(promotionReadinessDir, { withFileTypes: true })
    .filter((entry) =>
      entry.isFile() && entry.name.endsWith(`-${candidateId}-promotion-readiness.md`)
    )
    .map((entry) => path.join("runtime", "05-promotion-readiness", entry.name).replace(/\\/g, "/"))
    .sort((left, right) => left.localeCompare(right));

  return matches.at(-1) ?? null;
}

function findRuntimePromotionRecordPathForCandidate(input: {
  directiveRoot: string;
  candidateId: string | null | undefined;
}) {
  const candidateId = input.candidateId?.trim();
  if (!candidateId) {
    return null;
  }

  const promotionRecordDir = path.join(input.directiveRoot, "runtime", "07-promotion-records");
  if (!fs.existsSync(promotionRecordDir)) {
    return null;
  }

  const matches = fs
    .readdirSync(promotionRecordDir, { withFileTypes: true })
    .filter((entry) =>
      entry.isFile() && entry.name.endsWith(`-${candidateId}-promotion-record.md`)
    )
    .map((entry) => path.join("runtime", "07-promotion-records", entry.name).replace(/\\/g, "/"))
    .sort((left, right) => left.localeCompare(right));

  return matches.at(-1) ?? null;
}

function findRuntimeRegistryEntryPathForCandidate(input: {
  directiveRoot: string;
  candidateId: string | null | undefined;
}) {
  const candidateId = input.candidateId?.trim();
  if (!candidateId) {
    return null;
  }

  const registryDir = path.join(input.directiveRoot, "runtime", "08-registry");
  if (!fs.existsSync(registryDir)) {
    return null;
  }

  const matches = fs
    .readdirSync(registryDir, { withFileTypes: true })
    .filter((entry) =>
      entry.isFile() && entry.name.endsWith(`-${candidateId}-registry-entry.md`)
    )
    .map((entry) => path.join("runtime", "08-registry", entry.name).replace(/\\/g, "/"))
    .filter((relativePath) => {
      try {
        return isAcceptedRuntimeRegistryArtifact(
          readGenericLegacyRuntimeRegistryArtifact({
            directiveRoot: input.directiveRoot,
            registryEntryPath: relativePath,
          }),
        );
      } catch {
        return false;
      }
    })
    .sort((left, right) => left.localeCompare(right));

  return matches.at(-1) ?? null;
}

function findRuntimeStandaloneHostConsumptionReportPathForCandidate(input: {
  directiveRoot: string;
  candidateId: string | null | undefined;
}) {
  const candidateId = input.candidateId?.trim();
  if (!candidateId) {
    return null;
  }

  const reportDir = path.join(
    input.directiveRoot,
    "runtime",
    "standalone-host",
    "host-consumption",
  );
  if (!fs.existsSync(reportDir)) {
    return null;
  }

  const matches = fs
    .readdirSync(reportDir, { withFileTypes: true })
    .filter((entry) =>
      entry.isFile() && entry.name.endsWith(`-${candidateId}-host-consumption-report.json`)
    )
    .map((entry) =>
      path.join("runtime", "standalone-host", "host-consumption", entry.name).replace(/\\/g, "/")
    )
    .sort((left, right) => left.localeCompare(right));

  return matches.at(-1) ?? null;
}

function readGenericCallableIntegrationArtifact(input: {
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
  const callableStatus: "callable" | "not_implemented" = statusMatch?.[1] === "callable" ? "callable" : "not_implemented";

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

function buildRuntimeState(input: {
  directiveRoot: string;
  followUp: DirectiveRuntimeFollowUpArtifact | null;
  runtimeRecord: GenericRuntimeRecordArtifact | null;
  runtimeProof: GenericRuntimeProofArtifact | null;
  capabilityBoundary: GenericRuntimeRuntimeCapabilityBoundaryArtifact | null;
  promotionReadiness: GenericRuntimePromotionReadinessArtifact | null;
  promotionRecord: GenericRuntimePromotionRecordArtifact | null;
  callableIntegration: ReturnType<typeof readGenericCallableIntegrationArtifact> | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeFollowUpPath = input.followUp?.followUpRelativePath ?? input.runtimeRecord?.linkedFollowUpRecord ?? null;
  linked.runtimeRecordPath = input.runtimeRecord?.runtimeRecordRelativePath ?? input.runtimeProof?.linkedRuntimeRecordPath ?? null;
  linked.runtimeProofPath = input.runtimeProof?.runtimeProofRelativePath ?? input.runtimeRecord?.runtimeProofRelativePath ?? null;
  linked.runtimeRuntimeCapabilityBoundaryPath =
    input.capabilityBoundary?.runtimeRuntimeCapabilityBoundaryPath
    ?? input.runtimeProof?.runtimeRuntimeCapabilityBoundaryPath
    ?? input.runtimeRecord?.runtimeRuntimeCapabilityBoundaryPath
    ?? input.callableIntegration?.runtimeRuntimeCapabilityBoundaryPath
    ?? null;
  linked.runtimePromotionReadinessPath =
    input.promotionReadiness?.promotionReadinessPath
    ?? inferRuntimePromotionReadinessPathFromCapabilityBoundary({
      directiveRoot: input.directiveRoot,
      capabilityBoundaryPath:
        input.capabilityBoundary?.runtimeRuntimeCapabilityBoundaryPath
        ?? input.runtimeProof?.runtimeRuntimeCapabilityBoundaryPath
        ?? input.runtimeRecord?.runtimeRuntimeCapabilityBoundaryPath
        ?? input.callableIntegration?.runtimeRuntimeCapabilityBoundaryPath
        ?? null,
    })
    ?? null;
  linked.runtimePromotionRecordPath =
    input.promotionRecord?.promotionRecordPath
    ?? input.promotionReadiness?.linkedPromotionRecordPath
    ?? findRuntimePromotionRecordPathForCandidate({
      directiveRoot: input.directiveRoot,
      candidateId:
        input.promotionReadiness?.candidateId
        ?? input.runtimeRecord?.candidateId
        ?? input.runtimeProof?.candidateId
        ?? input.capabilityBoundary?.candidateId
        ?? input.followUp?.candidateId
        ?? input.callableIntegration?.candidateId
        ?? null,
    })
    ?? null;
  linked.runtimePromotionSpecificationPath = inferRuntimePromotionSpecificationPathFromPromotionReadiness({
    directiveRoot: input.directiveRoot,
    promotionReadinessPath: linked.runtimePromotionReadinessPath,
  });
  linked.runtimeHostSelectionResolutionPath = linked.runtimePromotionReadinessPath
    ? inferRuntimeHostSelectionResolutionPath({
      directiveRoot: input.directiveRoot,
      promotionReadinessPath: linked.runtimePromotionReadinessPath,
    })
    : null;
  linked.runtimeCallableStubPath =
    input.callableIntegration?.callableRelativePath
    ?? input.runtimeRecord?.callableStubPath
    ?? input.runtimeProof?.callableStubPath
    ?? input.capabilityBoundary?.linkedCallableStubPath
    ?? input.promotionReadiness?.linkedCallableStubPath
    ?? null;
  linked.runtimeCallableStatus =
    input.callableIntegration?.callableStatus ?? null;
  linked.runtimeHostConsumptionReportPath =
    findRuntimeStandaloneHostConsumptionReportPathForCandidate({
      directiveRoot: input.directiveRoot,
      candidateId:
        input.promotionRecord?.candidateId
        ?? input.promotionReadiness?.candidateId
        ?? input.runtimeRecord?.candidateId
        ?? input.runtimeProof?.candidateId
        ?? input.capabilityBoundary?.candidateId
        ?? input.followUp?.candidateId
        ?? input.callableIntegration?.candidateId
        ?? null,
    });
  linked.discoveryRoutingPath =
    input.followUp?.linkedHandoffPath
    ?? input.runtimeRecord?.linkedRoutingPath
    ?? input.runtimeProof?.linkedRoutingPath
    ?? null;
  linked.architectureIntegrationRecordPath =
    input.callableIntegration?.integrationRecordPath
    ?? input.runtimeRecord?.sourceIntegrationRecordPath
    ?? null;

  if (linked.runtimePromotionReadinessPath && !linked.runtimePromotionSpecificationPath) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      resolveDirectiveRuntimePromotionSpecificationPath({
        promotionReadinessPath: linked.runtimePromotionReadinessPath,
      }),
    );
  }
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: linked.runtimePromotionRecordPath,
    label: "Runtime promotion record",
  });

  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: linked.discoveryRoutingPath,
    label: "Discovery routing record",
  });
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.followUp?.linkedHandoffPath,
    label: "Discovery routing record",
  });
  if (input.followUp && !input.runtimeRecord && input.followUp.currentStatus === "pending_review") {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      input.followUp.runtimeRecordRelativePath,
    );
  }
  if (input.runtimeRecord?.kind === "follow_up_review" && !input.runtimeProof && input.runtimeRecord.currentStatus === "pending_proof_boundary") {
    if (input.runtimeRecord.runtimeProofRelativePath) {
      recordMissingExpectedArtifact(
        { missingExpectedArtifacts, inconsistentLinks },
        input.runtimeRecord.runtimeProofRelativePath,
      );
    }
  }
  if (
    input.runtimeProof?.kind === "callable_integration"
    && input.runtimeProof.promotionStatus === "ready_for_bounded_runtime_conversion"
    && !input.capabilityBoundary
  ) {
    recordMissingExpectedArtifact({ missingExpectedArtifacts, inconsistentLinks }, "runtime/04-capability-boundaries/*.md");
  }
  if (input.runtimeRecord?.kind === "follow_up_review" && !input.followUp) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      "Runtime follow-up review record is missing its linked follow-up artifact",
    );
  }
  if (
    input.runtimeRecord?.kind === "callable_integration_record"
    && input.runtimeRecord.callableStubPath
    && !fileExistsInDirectiveWorkspace(input.directiveRoot, input.runtimeRecord.callableStubPath)
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked callable stub: ${input.runtimeRecord.callableStubPath}`,
    );
  }
  if (
    input.runtimeRecord?.kind === "callable_integration_record"
    && input.runtimeRecord.sourceIntegrationRecordPath
    && !fileExistsInDirectiveWorkspace(input.directiveRoot, input.runtimeRecord.sourceIntegrationRecordPath)
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked Architecture integration record: ${input.runtimeRecord.sourceIntegrationRecordPath}`,
    );
  }
  if (input.runtimeProof?.kind === "follow_up_review" && !input.runtimeRecord) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      "Runtime proof artifact is missing its linked Legacy Runtime record",
    );
  }
  if (input.runtimeProof?.kind === "callable_integration" && !input.runtimeRecord) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      "Runtime proof artifact is missing its linked Legacy Runtime record",
    );
  }
  if (input.capabilityBoundary?.linkedRuntimeProofPath && !input.runtimeProof) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked Runtime proof artifact: ${input.capabilityBoundary.linkedRuntimeProofPath}`,
    );
  }
  if (input.capabilityBoundary?.linkedRuntimeRecordPath && !input.runtimeRecord) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked Runtime record: ${input.capabilityBoundary.linkedRuntimeRecordPath}`,
    );
  }
  if (input.promotionReadiness?.linkedCapabilityBoundaryPath && !input.capabilityBoundary) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked Runtime runtime capability boundary: ${input.promotionReadiness.linkedCapabilityBoundaryPath}`,
    );
  }
  if (input.promotionReadiness?.linkedRuntimeProofPath && !input.runtimeProof) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked Runtime proof artifact: ${input.promotionReadiness.linkedRuntimeProofPath}`,
    );
  }
  if (input.promotionReadiness?.linkedRuntimeRecordPath && !input.runtimeRecord) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked Runtime record: ${input.promotionReadiness.linkedRuntimeRecordPath}`,
    );
  }
  if (
    input.promotionReadiness?.linkedCallableStubPath
    && !fileExistsInDirectiveWorkspace(input.directiveRoot, input.promotionReadiness.linkedCallableStubPath)
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked callable stub: ${input.promotionReadiness.linkedCallableStubPath}`,
    );
  }
  if (
    input.promotionReadiness?.linkedPromotionRecordPath
    && !input.promotionRecord
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked Runtime promotion record: ${input.promotionReadiness.linkedPromotionRecordPath}`,
    );
  }
  if (input.promotionRecord?.linkedRuntimeRecordPath && !input.runtimeRecord) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked Runtime record: ${input.promotionRecord.linkedRuntimeRecordPath}`,
    );
  }
  if (input.promotionRecord?.sourceIntentArtifactPath && !input.capabilityBoundary) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked Runtime capability boundary: ${input.promotionRecord.sourceIntentArtifactPath}`,
    );
  }
  if (input.promotionRecord?.proofArtifactPath && !input.runtimeProof) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked Runtime proof artifact: ${input.promotionRecord.proofArtifactPath}`,
    );
  }
  if (input.callableIntegration?.runtimeRecordRelativePath && !input.runtimeRecord) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked Runtime record: ${input.callableIntegration.runtimeRecordRelativePath}`,
    );
  }
  if (
    input.capabilityBoundary?.linkedCallableStubPath
    && !fileExistsInDirectiveWorkspace(input.directiveRoot, input.capabilityBoundary.linkedCallableStubPath)
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing linked callable stub: ${input.capabilityBoundary.linkedCallableStubPath}`,
    );
  }

  const hasExecutingCallable = input.callableIntegration?.callableStatus === "callable";
  const runtimeCandidateId =
    input.promotionRecord?.candidateId
    ?? input.runtimeRecord?.candidateId
    ?? input.runtimeProof?.candidateId
    ?? input.capabilityBoundary?.candidateId
    ?? input.callableIntegration?.candidateId
    ?? null;
  const hasHostConsumedCallable =
    hasExecutingCallable && Boolean(linked.runtimeHostConsumptionReportPath);
  const runtimeRegistryEntryPath = findRuntimeRegistryEntryPathForCandidate({
    directiveRoot: input.directiveRoot,
    candidateId: runtimeCandidateId,
  });
  const hasRegistryAccepted =
    Boolean(runtimeRegistryEntryPath);
  linked.runtimeRegistryEntryPath = runtimeRegistryEntryPath;
  let currentStage = "runtime.follow_up.pending_review";
  let nextLegalStep = "Explicitly review the Runtime follow-up and approve one bounded Runtime record if justified.";

  if (input.runtimeRecord) {
    currentStage =
      input.runtimeRecord.kind === "follow_up_review"
        ? "runtime.record.pending_proof_boundary"
        : "runtime.record.callable_boundary_defined";
    nextLegalStep =
      input.runtimeRecord.kind === "follow_up_review"
        ? "Explicitly review the Legacy Runtime record and approve one bounded Runtime proof artifact if justified."
        : hasHostConsumedCallable
          ? "Callable capability is executing and one bounded host adapter path is already proven. Next legal step is explicit evidence feedback or later registry acceptance if intentionally reopened."
        : hasExecutingCallable
          ? "Callable capability is executing. Next legal step is host integration through a bounded adapter path."
          : "No automatic Runtime step is open; callable implementation, promotion, and host work remain intentionally unopened.";
  }
  if (input.runtimeProof) {
    currentStage =
      input.runtimeProof.kind === "follow_up_review"
        ? "runtime.proof.opened"
        : `runtime.proof.${input.runtimeProof.promotionStatus ?? "opened"}`;
    nextLegalStep =
      input.runtimeProof.kind === "follow_up_review"
        ? "Explicitly review and, if justified, open one bounded runtime capability boundary; execution and host integration remain closed."
        : "Explicitly review the bounded runtime capability boundary only if later Runtime conversion work is intentionally reopened.";
  }
  if (input.capabilityBoundary) {
    const promotionReadinessEligible = !input.callableIntegration && !input.capabilityBoundary.linkedCallableStubPath;
    currentStage = "runtime.runtime_capability_boundary.opened";
    nextLegalStep =
      promotionReadinessEligible
        ? "Explicitly review the bounded runtime capability boundary and, if justified, open one non-executing promotion-readiness artifact; host-facing promotion and runtime execution remain closed."
        : hasHostConsumedCallable
          ? "Callable capability is executing and one bounded host adapter path is already proven. Next legal step is explicit evidence feedback or later registry acceptance if intentionally reopened."
        : hasExecutingCallable
          ? "Callable capability is executing. Next legal step is host integration through a bounded adapter path."
          : "No automatic Runtime step is open; callable implementation, host integration, and runtime execution remain intentionally unopened.";
  }
  if (input.promotionReadiness) {
    currentStage = "runtime.promotion_readiness.opened";
    nextLegalStep =
      hasHostConsumedCallable
        ? "No automatic Runtime step is open; host-facing promotion remains historical, while callable execution and one bounded host integration path are already proven."
        : hasExecutingCallable
        ? "No automatic Runtime step is open; host-facing promotion and host integration remain intentionally unopened while callable execution is already proven."
        : "No automatic Runtime step is open; host-facing promotion, callable implementation, host integration, and runtime execution remain intentionally unopened.";
  }
  if (input.promotionRecord) {
    currentStage = "runtime.promotion_record.opened";
    nextLegalStep =
      hasHostConsumedCallable && hasRegistryAccepted
        ? "No automatic Runtime step is open; one registry entry, callable execution, and one bounded standalone-host integration path are already proven. Reopen only for explicit evidence feedback or later broader host work."
        : hasHostConsumedCallable
        ? "No automatic Runtime step is open; registry acceptance and promotion automation remain intentionally unopened while callable execution and one bounded host integration path are already proven."
        : hasExecutingCallable
        ? "No automatic Runtime step is open; registry acceptance, host integration, and promotion automation remain intentionally unopened while callable execution is already proven."
        : "No automatic Runtime step is open; registry acceptance, host integration, runtime execution, and promotion automation remain intentionally unopened.";
  }

  const intentionallyUnbuiltDownstreamStages = [
    ...(hasExecutingCallable ? [] : ["runtime execution", "callable implementation"]),
    ...(input.promotionRecord
      ? (hasRegistryAccepted ? [] : ["registry acceptance"])
      : ["host-facing promotion"]),
    ...(hasHostConsumedCallable ? [] : ["host integration"]),
    "promotion automation",
  ];

  return {
    currentStage,
    nextLegalStep,
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages,
  };
}

export function buildRuntimeArtifactStage(input: {
  directiveRoot: string;
  artifactKind: DirectiveWorkspaceArtifactKind;
  legacyFollowUp: GenericLegacyRuntimeFollowUpArtifact | null;
  legacyHandoff: GenericLegacyRuntimeHandoffArtifact | null;
  legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact | null;
  legacyRuntimeSliceProof: GenericLegacyRuntimeSliceProofArtifact | null;
  legacyRuntimeSliceExecution: GenericLegacyRuntimeSliceExecutionArtifact | null;
  legacyRuntimeProofChecklist: GenericLegacyRuntimeProofChecklistArtifact | null;
  legacyRuntimeLiveFetchProof: GenericLegacyRuntimeLiveFetchProofArtifact | null;
  legacyRuntimeLiveFetchGateSnapshot: GenericLegacyRuntimeLiveFetchGateSnapshotArtifact | null;
  legacyRuntimeLivePoolArtifact: GenericLegacyRuntimeLivePoolArtifact | null;
  legacyRuntimeSamplePoolArtifact: GenericLegacyRuntimeSamplePoolArtifact | null;
  legacyRuntimeSystemBundleArtifact: GenericLegacyRuntimeSystemBundleArtifact | null;
  legacyRuntimeValidationNoteArtifact: GenericLegacyRuntimeValidationNoteArtifact | null;
  legacyRuntimePreconditionDecisionNoteArtifact: GenericLegacyRuntimePreconditionDecisionNoteArtifact | null;
  legacyRuntimeTransformationRecord: GenericLegacyRuntimeTransformationRecordArtifact | null;
  legacyRuntimeTransformationProof: GenericLegacyRuntimeTransformationProofArtifact | null;
  legacyRuntimeRegistry: GenericLegacyRuntimeRegistryArtifact | null;
  legacyRuntimePromotionRecord: GenericLegacyRuntimePromotionRecordArtifact | null;
  promotionRecord: GenericRuntimePromotionRecordArtifact | null;
  runtimeRecord: GenericRuntimeRecordArtifact | null;
  runtimeProof: GenericRuntimeProofArtifact | null;
  capabilityBoundary: GenericRuntimeRuntimeCapabilityBoundaryArtifact | null;
  callableIntegration: ReturnType<typeof readGenericCallableIntegrationArtifact> | null;
}) {
  const hasExecutingCallable = input.callableIntegration?.callableStatus === "callable";
  const runtimeCandidateId =
    input.promotionRecord?.candidateId
    ?? input.runtimeRecord?.candidateId
    ?? input.runtimeProof?.candidateId
    ?? input.capabilityBoundary?.candidateId
    ?? input.callableIntegration?.candidateId
    ?? null;
  const hasHostConsumedCallable =
    hasExecutingCallable
    && Boolean(
      findRuntimeStandaloneHostConsumptionReportPathForCandidate({
        directiveRoot: input.directiveRoot,
        candidateId: runtimeCandidateId,
      }),
    );
  const runtimeRegistryEntryPath = findRuntimeRegistryEntryPathForCandidate({
    directiveRoot: input.directiveRoot,
    candidateId: runtimeCandidateId,
  });
  const hasRegistryAccepted =
    Boolean(runtimeRegistryEntryPath);
  switch (input.artifactKind) {
    case "runtime_follow_up":
      return {
        artifactStage: "runtime.follow_up.pending_review",
        artifactNextLegalStep: "Explicitly review the Runtime follow-up and approve one bounded Runtime record if justified.",
      };
    case "runtime_follow_up_legacy":
      return {
        artifactStage:
          /defer/i.test(input.legacyFollowUp?.currentDecisionState ?? "")
          || /deferred/i.test(input.legacyFollowUp?.currentStatus ?? "")
            ? "runtime.follow_up.legacy_deferred"
            : "runtime.follow_up.legacy_recorded",
        artifactNextLegalStep:
          /defer/i.test(input.legacyFollowUp?.currentDecisionState ?? "")
          || /deferred/i.test(input.legacyFollowUp?.currentStatus ?? "")
            ? "No automatic Runtime step is open; this historical deferred Runtime follow-up remains parked unless a new bounded Legacy Runtime re-entry is explicitly opened."
            : "No automatic Runtime step is open; this historical Runtime follow-up remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_handoff_legacy":
      return {
        artifactStage: "runtime.handoff.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical architecture-to-runtime handoff remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_record_legacy":
      return {
        artifactStage: "runtime.record.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical Runtime record remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_slice_proof_legacy":
      return {
        artifactStage: "runtime.slice_proof.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical Runtime slice proof remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_slice_execution_legacy":
      return {
        artifactStage: "runtime.slice_execution.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical Runtime slice execution remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_proof_checklist_legacy":
      return {
        artifactStage: "runtime.proof_checklist.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical Runtime proof checklist remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_live_fetch_proof_legacy":
      return {
        artifactStage: "runtime.live_fetch_proof.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical Runtime live-fetch proof remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_live_fetch_gate_snapshot_legacy":
      return {
        artifactStage: "runtime.live_fetch_gate_snapshot.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical Runtime live-fetch gate snapshot remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_live_pool_artifact_legacy":
      return {
        artifactStage: input.legacyRuntimeLivePoolArtifact?.degraded
          ? "runtime.live_degraded_pool.legacy_recorded"
          : "runtime.live_qualified_pool.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical Runtime live pool artifact remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_sample_pool_artifact_legacy":
      return {
        artifactStage: input.legacyRuntimeSamplePoolArtifact?.degraded
          ? "runtime.sample_degraded_pool.legacy_recorded"
          : "runtime.sample_qualified_pool.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical Runtime sample pool artifact remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_system_bundle_note_legacy":
      return {
        artifactStage: "runtime.system_bundle.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical Runtime system-bundle note remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_validation_note_legacy":
      return {
        artifactStage: "runtime.validation_note.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical Runtime validation note remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_precondition_decision_note_legacy":
      return {
        artifactStage: input.legacyRuntimePreconditionDecisionNoteArtifact?.noteKind === "precondition_correction"
          ? "runtime.precondition_correction.legacy_recorded"
          : input.legacyRuntimePreconditionDecisionNoteArtifact?.noteKind === "host_adapter_decision"
            ? "runtime.host_adapter_decision.legacy_recorded"
            : "runtime.precondition_proof.legacy_recorded",
        artifactNextLegalStep: input.legacyRuntimePreconditionDecisionNoteArtifact?.noteKind === "precondition_correction"
          ? "No automatic Runtime step is open; this historical Runtime precondition correction remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened."
          : input.legacyRuntimePreconditionDecisionNoteArtifact?.noteKind === "host_adapter_decision"
            ? "No automatic Runtime step is open; this historical Runtime host-adapter decision remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened."
            : "No automatic Runtime step is open; this historical Runtime CLI precondition proof remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_transformation_record_legacy":
      return {
        artifactStage: "runtime.transformation_record.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical Runtime transformation record remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_transformation_proof_legacy":
      return {
        artifactStage: "runtime.transformation_proof.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical Runtime transformation proof remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_registry_legacy":
    case "runtime_registry_accepted":
      return {
        artifactStage: input.artifactKind === "runtime_registry_accepted"
          ? "runtime.registry.accepted"
          : "runtime.registry.legacy_recorded",
        artifactNextLegalStep:
          input.artifactKind === "runtime_registry_accepted"
            ? "No automatic Runtime step is open; this Runtime registry entry is manually accepted through a bounded registry gate; promotion automation remains intentionally unopened."
            : "No automatic Runtime step is open; this historical Runtime registry entry remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_promotion_record_legacy":
      return {
        artifactStage: "runtime.promotion_record.legacy_recorded",
        artifactNextLegalStep:
          "No automatic Runtime step is open; this historical Runtime promotion record remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
      };
    case "runtime_record_follow_up_review":
      return {
        artifactStage: "runtime.record.pending_proof_boundary",
        artifactNextLegalStep: "Explicitly review the Legacy Runtime record and approve one bounded Runtime proof artifact if justified.",
      };
    case "runtime_record_callable_integration":
      return {
        artifactStage: "runtime.record.callable_boundary_defined",
        artifactNextLegalStep: hasHostConsumedCallable
          ? "Callable capability is executing and one bounded host adapter path is already proven. Next legal step is explicit evidence feedback or later registry acceptance if intentionally reopened."
          : hasExecutingCallable
          ? "Callable capability is executing. Next legal step is host integration through a bounded adapter path."
          : "No automatic Runtime step is open; callable implementation, promotion, and host work remain intentionally unopened.",
      };
    case "runtime_proof_follow_up_review":
      return {
        artifactStage: "runtime.proof.opened",
        artifactNextLegalStep: "Explicitly review and, if justified, open one bounded runtime capability boundary; execution and host integration remain closed.",
      };
    case "runtime_proof_callable_integration":
      return {
        artifactStage: `runtime.proof.${input.runtimeProof?.promotionStatus ?? "opened"}`,
        artifactNextLegalStep: "Explicitly review the bounded runtime capability boundary only if later Runtime conversion work is intentionally reopened.",
      };
    case "runtime_runtime_capability_boundary":
      return {
        artifactStage: "runtime.runtime_capability_boundary.opened",
        artifactNextLegalStep:
          (!input.callableIntegration && !input.capabilityBoundary?.linkedCallableStubPath)
            ? "Explicitly review the bounded runtime capability boundary and, if justified, open one non-executing promotion-readiness artifact; host-facing promotion and runtime execution remain closed."
            : hasHostConsumedCallable
              ? "Callable capability is executing and one bounded host adapter path is already proven. Next legal step is explicit evidence feedback or later registry acceptance if intentionally reopened."
            : hasExecutingCallable
              ? "Callable capability is executing. Next legal step is host integration through a bounded adapter path."
              : "No automatic Runtime step is open; callable implementation, host integration, and runtime execution remain intentionally unopened.",
      };
    case "runtime_promotion_readiness":
      return {
        artifactStage: "runtime.promotion_readiness.opened",
        artifactNextLegalStep: hasHostConsumedCallable
          ? "No automatic Runtime step is open; host-facing promotion remains historical, while callable execution and one bounded host integration path are already proven."
          : hasExecutingCallable
          ? "No automatic Runtime step is open; host-facing promotion and host integration remain intentionally unopened while callable execution is already proven."
          : "No automatic Runtime step is open; host-facing promotion, callable implementation, host integration, and runtime execution remain intentionally unopened.",
      };
    case "runtime_promotion_record":
      return {
        artifactStage: "runtime.promotion_record.opened",
        artifactNextLegalStep: hasHostConsumedCallable && hasRegistryAccepted
          ? "No automatic Runtime step is open; one registry entry, callable execution, and one bounded standalone-host integration path are already proven. Reopen only for explicit evidence feedback or later broader host work."
          : hasHostConsumedCallable
          ? "No automatic Runtime step is open; registry acceptance and promotion automation remain intentionally unopened while callable execution and one bounded host integration path are already proven."
          : hasExecutingCallable
          ? "No automatic Runtime step is open; registry acceptance, host integration, and promotion automation remain intentionally unopened while callable execution is already proven."
          : "No automatic Runtime step is open; registry acceptance, host integration, runtime execution, and promotion automation remain intentionally unopened.",
      };
    case "runtime_callable_integration":
      return {
        artifactStage: input.callableIntegration?.callableStatus === "callable"
          ? "runtime.callable.executing"
          : "runtime.callable_stub.not_implemented",
        artifactNextLegalStep: hasHostConsumedCallable
          ? "Callable capability is executing and one bounded host adapter path is already proven. Next legal step is explicit evidence feedback or later registry acceptance if intentionally reopened."
          : input.callableIntegration?.callableStatus === "callable"
          ? "Callable capability is executing. Next legal step is host integration through a bounded adapter path."
          : "No automatic Runtime step is open; bounded runtime conversion remains explicit and non-executing.",
      };
    default:
      return {
        artifactStage: "runtime.unknown",
        artifactNextLegalStep: "Inspect the Runtime artifact chain directly.",
      };
  }
}

export function resolveRuntimeFocusFromAnyPath(input: {
  directiveRoot: string;
  artifactPath: string;
}) {
  const relativePath = resolveDirectiveRelativePath(input.directiveRoot, input.artifactPath, "artifactPath");

  let followUp: DirectiveRuntimeFollowUpArtifact | null = null;
  let legacyFollowUp: GenericLegacyRuntimeFollowUpArtifact | null = null;
  let legacyHandoff: GenericLegacyRuntimeHandoffArtifact | null = null;
  let legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact | null = null;
  let legacyRuntimeSliceProof: GenericLegacyRuntimeSliceProofArtifact | null = null;
  let legacyRuntimeSliceExecution: GenericLegacyRuntimeSliceExecutionArtifact | null = null;
  let legacyRuntimeProofChecklist: GenericLegacyRuntimeProofChecklistArtifact | null = null;
  let legacyRuntimeLiveFetchProof: GenericLegacyRuntimeLiveFetchProofArtifact | null = null;
  let legacyRuntimeLiveFetchGateSnapshot: GenericLegacyRuntimeLiveFetchGateSnapshotArtifact | null = null;
  let legacyRuntimeLivePoolArtifact: GenericLegacyRuntimeLivePoolArtifact | null = null;
  let legacyRuntimeSamplePoolArtifact: GenericLegacyRuntimeSamplePoolArtifact | null = null;
  let legacyRuntimeSystemBundleArtifact: GenericLegacyRuntimeSystemBundleArtifact | null = null;
  let legacyRuntimeValidationNoteArtifact: GenericLegacyRuntimeValidationNoteArtifact | null = null;
  let legacyRuntimePreconditionDecisionNoteArtifact: GenericLegacyRuntimePreconditionDecisionNoteArtifact | null = null;
  let legacyRuntimeTransformationRecord: GenericLegacyRuntimeTransformationRecordArtifact | null = null;
  let legacyRuntimeTransformationProof: GenericLegacyRuntimeTransformationProofArtifact | null = null;
  let legacyRuntimeRegistry: GenericLegacyRuntimeRegistryArtifact | null = null;
  let legacyRuntimePromotionRecord: GenericLegacyRuntimePromotionRecordArtifact | null = null;
  let runtimeRecord: GenericRuntimeRecordArtifact | null = null;
  let runtimeProof: GenericRuntimeProofArtifact | null = null;
  let capabilityBoundary: GenericRuntimeRuntimeCapabilityBoundaryArtifact | null = null;
  let promotionReadiness: GenericRuntimePromotionReadinessArtifact | null = null;
  let promotionRecord: GenericRuntimePromotionRecordArtifact | null = null;
  let callableIntegration: ReturnType<typeof readGenericCallableIntegrationArtifact> | null = null;
  let artifactKind: DirectiveWorkspaceArtifactKind = "unknown";

  if (relativePath.startsWith("runtime/legacy-handoff/")) {
    legacyHandoff = readGenericLegacyRuntimeHandoffArtifact({
      directiveRoot: input.directiveRoot,
      handoffPath: relativePath,
    });
    artifactKind = "runtime_handoff_legacy";
  } else if (relativePath.startsWith("runtime/00-follow-up/")) {
    try {
      followUp = readDirectiveRuntimeFollowUpArtifact({
        directiveRoot: input.directiveRoot,
        followUpPath: relativePath,
      });
      artifactKind = "runtime_follow_up";
      if (followUp.runtimeRecordExists) {
        runtimeRecord = readGenericRuntimeRecordArtifact({
          directiveRoot: input.directiveRoot,
          runtimeRecordPath: followUp.runtimeRecordRelativePath,
        });
      }
    } catch {
      legacyFollowUp = readGenericLegacyRuntimeFollowUpArtifact({
        directiveRoot: input.directiveRoot,
        followUpPath: relativePath,
      });
      artifactKind = "runtime_follow_up_legacy";
    }
  } else if (relativePath.startsWith("runtime/legacy-records/") && relativePath.endsWith("-runtime-slice-01-proof.md")) {
    legacyRuntimeSliceProof = readGenericLegacyRuntimeSliceProofArtifact({
      directiveRoot: input.directiveRoot,
      runtimeSliceProofPath: relativePath,
    });
    artifactKind = "runtime_slice_proof_legacy";
    if (
      legacyRuntimeSliceProof.linkedRuntimeRecordPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeSliceProof.linkedRuntimeRecordPath)
    ) {
      legacyRuntimeRecord = readGenericLegacyRuntimeRecordArtifact({
        directiveRoot: input.directiveRoot,
        runtimeRecordPath: legacyRuntimeSliceProof.linkedRuntimeRecordPath,
      });
    }
  } else if (
    relativePath.startsWith("runtime/legacy-records/")
    && (
      relativePath.endsWith("-runtime-slice-01-execution.md")
      || relativePath.endsWith("-fallback-rehearsal.md")
    )
  ) {
    legacyRuntimeSliceExecution = readGenericLegacyRuntimeSliceExecutionArtifact({
      directiveRoot: input.directiveRoot,
      runtimeSliceExecutionPath: relativePath,
    });
    artifactKind = "runtime_slice_execution_legacy";
    if (
      legacyRuntimeSliceExecution.linkedRuntimeProofPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeSliceExecution.linkedRuntimeProofPath)
    ) {
      legacyRuntimeSliceProof = readGenericLegacyRuntimeSliceProofArtifact({
        directiveRoot: input.directiveRoot,
        runtimeSliceProofPath: legacyRuntimeSliceExecution.linkedRuntimeProofPath,
      });
      if (
        legacyRuntimeSliceProof.linkedRuntimeRecordPath
        && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeSliceProof.linkedRuntimeRecordPath)
      ) {
        legacyRuntimeRecord = readGenericLegacyRuntimeRecordArtifact({
          directiveRoot: input.directiveRoot,
          runtimeRecordPath: legacyRuntimeSliceProof.linkedRuntimeRecordPath,
        });
      }
    }
  } else if (relativePath.startsWith("runtime/legacy-records/") && relativePath.endsWith("-proof-checklist.md")) {
    legacyRuntimeProofChecklist = readGenericLegacyRuntimeProofChecklistArtifact({
      directiveRoot: input.directiveRoot,
      proofChecklistPath: relativePath,
    });
    artifactKind = "runtime_proof_checklist_legacy";
    if (
      legacyRuntimeProofChecklist.linkedRuntimeRecordPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeProofChecklist.linkedRuntimeRecordPath)
    ) {
      legacyRuntimeRecord = readGenericLegacyRuntimeRecordArtifact({
        directiveRoot: input.directiveRoot,
        runtimeRecordPath: legacyRuntimeProofChecklist.linkedRuntimeRecordPath,
      });
    }
    if (
      legacyRuntimeProofChecklist.linkedRuntimeProofPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeProofChecklist.linkedRuntimeProofPath)
    ) {
      legacyRuntimeSliceProof = readGenericLegacyRuntimeSliceProofArtifact({
        directiveRoot: input.directiveRoot,
        runtimeSliceProofPath: legacyRuntimeProofChecklist.linkedRuntimeProofPath,
      });
    }
  } else if (relativePath.startsWith("runtime/legacy-records/") && relativePath.endsWith("-live-fetch-proof.md")) {
    legacyRuntimeLiveFetchProof = readGenericLegacyRuntimeLiveFetchProofArtifact({
      directiveRoot: input.directiveRoot,
      liveFetchProofPath: relativePath,
    });
    artifactKind = "runtime_live_fetch_proof_legacy";
    if (
      legacyRuntimeLiveFetchProof.linkedRuntimeRecordPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeLiveFetchProof.linkedRuntimeRecordPath)
    ) {
      legacyRuntimeRecord = readGenericLegacyRuntimeRecordArtifact({
        directiveRoot: input.directiveRoot,
        runtimeRecordPath: legacyRuntimeLiveFetchProof.linkedRuntimeRecordPath,
      });
    }
    if (
      legacyRuntimeLiveFetchProof.linkedProofChecklistPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeLiveFetchProof.linkedProofChecklistPath)
    ) {
      legacyRuntimeProofChecklist = readGenericLegacyRuntimeProofChecklistArtifact({
        directiveRoot: input.directiveRoot,
        proofChecklistPath: legacyRuntimeLiveFetchProof.linkedProofChecklistPath,
      });
    }
  } else if (relativePath.startsWith("runtime/legacy-records/") && relativePath.endsWith("-live-fetch-gate-snapshot.json")) {
    legacyRuntimeLiveFetchGateSnapshot = readGenericLegacyRuntimeLiveFetchGateSnapshotArtifact({
      directiveRoot: input.directiveRoot,
      gateSnapshotPath: relativePath,
    });
    artifactKind = "runtime_live_fetch_gate_snapshot_legacy";
    if (
      legacyRuntimeLiveFetchGateSnapshot.linkedLiveFetchProofPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeLiveFetchGateSnapshot.linkedLiveFetchProofPath)
    ) {
      legacyRuntimeLiveFetchProof = readGenericLegacyRuntimeLiveFetchProofArtifact({
        directiveRoot: input.directiveRoot,
        liveFetchProofPath: legacyRuntimeLiveFetchGateSnapshot.linkedLiveFetchProofPath,
      });
      if (
        legacyRuntimeLiveFetchProof.linkedRuntimeRecordPath
        && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeLiveFetchProof.linkedRuntimeRecordPath)
      ) {
        legacyRuntimeRecord = readGenericLegacyRuntimeRecordArtifact({
          directiveRoot: input.directiveRoot,
          runtimeRecordPath: legacyRuntimeLiveFetchProof.linkedRuntimeRecordPath,
        });
      }
      if (
        legacyRuntimeLiveFetchProof.linkedProofChecklistPath
        && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeLiveFetchProof.linkedProofChecklistPath)
      ) {
        legacyRuntimeProofChecklist = readGenericLegacyRuntimeProofChecklistArtifact({
          directiveRoot: input.directiveRoot,
          proofChecklistPath: legacyRuntimeLiveFetchProof.linkedProofChecklistPath,
        });
      }
    }
  } else if (
    relativePath.startsWith("runtime/legacy-records/")
    && (relativePath.endsWith("-live-qualified-pool.json") || relativePath.endsWith("-live-degraded-pool.json"))
  ) {
    legacyRuntimeLivePoolArtifact = readGenericLegacyRuntimeLivePoolArtifact({
      directiveRoot: input.directiveRoot,
      livePoolPath: relativePath,
    });
    artifactKind = "runtime_live_pool_artifact_legacy";
    if (
      legacyRuntimeLivePoolArtifact.linkedGateSnapshotPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeLivePoolArtifact.linkedGateSnapshotPath)
    ) {
      legacyRuntimeLiveFetchGateSnapshot = readGenericLegacyRuntimeLiveFetchGateSnapshotArtifact({
        directiveRoot: input.directiveRoot,
        gateSnapshotPath: legacyRuntimeLivePoolArtifact.linkedGateSnapshotPath,
      });
    }
    if (
      legacyRuntimeLivePoolArtifact.linkedLiveFetchProofPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeLivePoolArtifact.linkedLiveFetchProofPath)
    ) {
      legacyRuntimeLiveFetchProof = readGenericLegacyRuntimeLiveFetchProofArtifact({
        directiveRoot: input.directiveRoot,
        liveFetchProofPath: legacyRuntimeLivePoolArtifact.linkedLiveFetchProofPath,
      });
      if (
        legacyRuntimeLiveFetchProof.linkedRuntimeRecordPath
        && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeLiveFetchProof.linkedRuntimeRecordPath)
      ) {
        legacyRuntimeRecord = readGenericLegacyRuntimeRecordArtifact({
          directiveRoot: input.directiveRoot,
          runtimeRecordPath: legacyRuntimeLiveFetchProof.linkedRuntimeRecordPath,
        });
      }
      if (
        legacyRuntimeLiveFetchProof.linkedProofChecklistPath
        && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeLiveFetchProof.linkedProofChecklistPath)
      ) {
        legacyRuntimeProofChecklist = readGenericLegacyRuntimeProofChecklistArtifact({
          directiveRoot: input.directiveRoot,
          proofChecklistPath: legacyRuntimeLiveFetchProof.linkedProofChecklistPath,
        });
      }
    }
  } else if (
    relativePath.startsWith("runtime/legacy-records/")
    && (
      relativePath.endsWith("-qualified-pool-sample.json")
      || relativePath.endsWith("-degraded-quality-sample.json")
    )
  ) {
    legacyRuntimeSamplePoolArtifact = readGenericLegacyRuntimeSamplePoolArtifact({
      directiveRoot: input.directiveRoot,
      samplePoolPath: relativePath,
    });
    artifactKind = "runtime_sample_pool_artifact_legacy";
  } else if (
    relativePath.startsWith("runtime/legacy-records/")
    && /-runtime-system-bundle-\d{2}-.*\.md$/u.test(relativePath)
  ) {
    legacyRuntimeSystemBundleArtifact = readGenericLegacyRuntimeSystemBundleArtifact({
      directiveRoot: input.directiveRoot,
      systemBundlePath: relativePath,
    });
    artifactKind = "runtime_system_bundle_note_legacy";
  } else if (
    relativePath.startsWith("runtime/legacy-records/")
    && /-agentics-docs-maintenance-validation(?:-rerun)?\.md$/u.test(relativePath)
  ) {
    legacyRuntimeValidationNoteArtifact = readGenericLegacyRuntimeValidationNoteArtifact({
      directiveRoot: input.directiveRoot,
      validationNotePath: relativePath,
    });
    artifactKind = "runtime_validation_note_legacy";
  } else if (
    relativePath.startsWith("runtime/legacy-records/")
    && /-(cli-precondition-proof|precondition-correction|host-adapter-decision)\.md$/u.test(relativePath)
  ) {
    legacyRuntimePreconditionDecisionNoteArtifact = readGenericLegacyRuntimePreconditionDecisionNoteArtifact({
      directiveRoot: input.directiveRoot,
      notePath: relativePath,
    });
    artifactKind = "runtime_precondition_decision_note_legacy";
  } else if (
    relativePath.startsWith("runtime/legacy-records/")
    && (
      relativePath.endsWith("-runtime-record.md")
      || /-reentry-preconditions-slice-\d+\.md$/u.test(relativePath)
    )
  ) {
    legacyRuntimeRecord = readGenericLegacyRuntimeRecordArtifact({
      directiveRoot: input.directiveRoot,
      runtimeRecordPath: relativePath,
    });
    artifactKind = "runtime_record_legacy";
  } else if (relativePath.startsWith("runtime/legacy-records/") && relativePath.endsWith("-transformation-record.md")) {
    legacyRuntimeTransformationRecord = readGenericLegacyRuntimeTransformationRecordArtifact({
      directiveRoot: input.directiveRoot,
      transformationRecordPath: relativePath,
    });
    artifactKind = "runtime_transformation_record_legacy";
    if (
      legacyRuntimeTransformationRecord.promotionRecordPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeTransformationRecord.promotionRecordPath)
    ) {
      legacyRuntimePromotionRecord = readGenericLegacyRuntimePromotionRecordArtifact({
        directiveRoot: input.directiveRoot,
        promotionRecordPath: legacyRuntimeTransformationRecord.promotionRecordPath,
      });
    }
  } else if (relativePath.startsWith("runtime/legacy-records/") && relativePath.endsWith("-transformation-proof.json")) {
    legacyRuntimeTransformationProof = readGenericLegacyRuntimeTransformationProofArtifact({
      directiveRoot: input.directiveRoot,
      transformationProofPath: relativePath,
    });
    artifactKind = "runtime_transformation_proof_legacy";
    if (
      legacyRuntimeTransformationProof.linkedTransformationRecordPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeTransformationProof.linkedTransformationRecordPath)
    ) {
      legacyRuntimeTransformationRecord = readGenericLegacyRuntimeTransformationRecordArtifact({
        directiveRoot: input.directiveRoot,
        transformationRecordPath: legacyRuntimeTransformationProof.linkedTransformationRecordPath,
      });
      if (
        legacyRuntimeTransformationRecord.promotionRecordPath
        && fileExistsInDirectiveWorkspace(input.directiveRoot, legacyRuntimeTransformationRecord.promotionRecordPath)
      ) {
        legacyRuntimePromotionRecord = readGenericLegacyRuntimePromotionRecordArtifact({
          directiveRoot: input.directiveRoot,
          promotionRecordPath: legacyRuntimeTransformationRecord.promotionRecordPath,
        });
      }
    }
  } else if (relativePath.startsWith("runtime/08-registry/") && relativePath.endsWith("-registry-entry.md")) {
    legacyRuntimeRegistry = readGenericLegacyRuntimeRegistryArtifact({
      directiveRoot: input.directiveRoot,
      registryEntryPath: relativePath,
    });
    artifactKind = isAcceptedRuntimeRegistryArtifact(legacyRuntimeRegistry)
      ? "runtime_registry_accepted"
      : "runtime_registry_legacy";
  } else if (relativePath.startsWith("runtime/07-promotion-records/") && relativePath.endsWith("-promotion-record.md")) {
    const candidatePromotionRecord = readGenericRuntimePromotionRecordArtifact({
      directiveRoot: input.directiveRoot,
      promotionRecordPath: relativePath,
    });
    const linkedPromotionReadinessPath = findRuntimePromotionReadinessPathForCandidate({
      directiveRoot: input.directiveRoot,
      candidateId: candidatePromotionRecord.candidateId,
    });
    if (linkedPromotionReadinessPath) {
      promotionRecord = candidatePromotionRecord;
      artifactKind = "runtime_promotion_record";
      promotionReadiness = readGenericRuntimePromotionReadinessArtifact({
        directiveRoot: input.directiveRoot,
        promotionReadinessPath: linkedPromotionReadinessPath,
      });
    } else {
      legacyRuntimePromotionRecord = readGenericLegacyRuntimePromotionRecordArtifact({
        directiveRoot: input.directiveRoot,
        promotionRecordPath: relativePath,
      });
      artifactKind = "runtime_promotion_record_legacy";
    }
  } else if (relativePath.startsWith("runtime/02-records/")) {
    runtimeRecord = readGenericRuntimeRecordArtifact({
      directiveRoot: input.directiveRoot,
      runtimeRecordPath: relativePath,
    });
    artifactKind =
      runtimeRecord.kind === "follow_up_review"
        ? "runtime_record_follow_up_review"
        : "runtime_record_callable_integration";
    followUp = readLinkedArtifactIfPresent({
      directiveRoot: input.directiveRoot,
      relativePath: runtimeRecord.linkedFollowUpRecord,
      read: (followUpPath) => readDirectiveRuntimeFollowUpArtifact({
        directiveRoot: input.directiveRoot,
        followUpPath,
      }),
    });
  } else if (relativePath.startsWith("runtime/03-proof/")) {
    runtimeProof = readGenericRuntimeProofArtifact({
      directiveRoot: input.directiveRoot,
      runtimeProofPath: relativePath,
    });
    artifactKind =
      runtimeProof.kind === "follow_up_review"
        ? "runtime_proof_follow_up_review"
        : "runtime_proof_callable_integration";
    runtimeRecord = readLinkedArtifactIfPresent({
      directiveRoot: input.directiveRoot,
      relativePath: runtimeProof.linkedRuntimeRecordPath,
      read: (runtimeRecordPath) => readGenericRuntimeRecordArtifact({
        directiveRoot: input.directiveRoot,
        runtimeRecordPath,
      }),
    });
    followUp = readLinkedArtifactIfPresent({
      directiveRoot: input.directiveRoot,
      relativePath: runtimeProof.linkedFollowUpPath,
      read: (followUpPath) => readDirectiveRuntimeFollowUpArtifact({
        directiveRoot: input.directiveRoot,
        followUpPath,
      }),
    });
  } else if (relativePath.startsWith("runtime/04-capability-boundaries/")) {
    capabilityBoundary = readGenericRuntimeRuntimeCapabilityBoundaryArtifact({
      directiveRoot: input.directiveRoot,
      capabilityBoundaryPath: relativePath,
    });
    artifactKind = "runtime_runtime_capability_boundary";
    runtimeProof = readLinkedArtifactIfPresent({
      directiveRoot: input.directiveRoot,
      relativePath: capabilityBoundary.linkedRuntimeProofPath,
      read: (runtimeProofPath) => readGenericRuntimeProofArtifact({
        directiveRoot: input.directiveRoot,
        runtimeProofPath,
      }),
    });
    runtimeRecord = readLinkedArtifactIfPresent({
      directiveRoot: input.directiveRoot,
      relativePath: capabilityBoundary.linkedRuntimeRecordPath,
      read: (runtimeRecordPath) => readGenericRuntimeRecordArtifact({
        directiveRoot: input.directiveRoot,
        runtimeRecordPath,
      }),
    });
    if (capabilityBoundary.linkedCallableStubPath && fileExistsInDirectiveWorkspace(input.directiveRoot, capabilityBoundary.linkedCallableStubPath)) {
      callableIntegration = readGenericCallableIntegrationArtifact({
        directiveRoot: input.directiveRoot,
        callablePath: capabilityBoundary.linkedCallableStubPath,
      });
    }
  } else if (relativePath.startsWith("runtime/05-promotion-readiness/")) {
    promotionReadiness = readGenericRuntimePromotionReadinessArtifact({
      directiveRoot: input.directiveRoot,
      promotionReadinessPath: relativePath,
    });
    artifactKind = "runtime_promotion_readiness";
    capabilityBoundary = readLinkedArtifactIfPresent({
      directiveRoot: input.directiveRoot,
      relativePath: promotionReadiness.linkedCapabilityBoundaryPath,
      read: (capabilityBoundaryPath) => readGenericRuntimeRuntimeCapabilityBoundaryArtifact({
        directiveRoot: input.directiveRoot,
        capabilityBoundaryPath,
      }),
    });
    runtimeProof = readLinkedArtifactIfPresent({
      directiveRoot: input.directiveRoot,
      relativePath: promotionReadiness.linkedRuntimeProofPath,
      read: (runtimeProofPath) => readGenericRuntimeProofArtifact({
        directiveRoot: input.directiveRoot,
        runtimeProofPath,
      }),
    });
    runtimeRecord = readLinkedArtifactIfPresent({
      directiveRoot: input.directiveRoot,
      relativePath: promotionReadiness.linkedRuntimeRecordPath,
      read: (runtimeRecordPath) => readGenericRuntimeRecordArtifact({
        directiveRoot: input.directiveRoot,
        runtimeRecordPath,
      }),
    });
    if (
      promotionReadiness.linkedCallableStubPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, promotionReadiness.linkedCallableStubPath)
    ) {
      callableIntegration = readGenericCallableIntegrationArtifact({
        directiveRoot: input.directiveRoot,
        callablePath: promotionReadiness.linkedCallableStubPath,
      });
    }
    if (
      promotionReadiness.linkedPromotionRecordPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, promotionReadiness.linkedPromotionRecordPath)
    ) {
      promotionRecord = readGenericRuntimePromotionRecordArtifact({
        directiveRoot: input.directiveRoot,
        promotionRecordPath: promotionReadiness.linkedPromotionRecordPath,
      });
    }
  } else if (relativePath.startsWith("runtime/01-callable-integrations/")) {
    callableIntegration = readGenericCallableIntegrationArtifact({
      directiveRoot: input.directiveRoot,
      callablePath: relativePath,
    });
    artifactKind = "runtime_callable_integration";
    if (callableIntegration.runtimeRecordRelativePath && fileExistsInDirectiveWorkspace(input.directiveRoot, callableIntegration.runtimeRecordRelativePath)) {
      runtimeRecord = readGenericRuntimeRecordArtifact({
        directiveRoot: input.directiveRoot,
        runtimeRecordPath: callableIntegration.runtimeRecordRelativePath,
      });
    }
    if (callableIntegration.runtimeProofRelativePath && fileExistsInDirectiveWorkspace(input.directiveRoot, callableIntegration.runtimeProofRelativePath)) {
      runtimeProof = readGenericRuntimeProofArtifact({
        directiveRoot: input.directiveRoot,
        runtimeProofPath: callableIntegration.runtimeProofRelativePath,
      });
    }
    if (
      callableIntegration.runtimeRuntimeCapabilityBoundaryPath
      && fileExistsInDirectiveWorkspace(input.directiveRoot, callableIntegration.runtimeRuntimeCapabilityBoundaryPath)
    ) {
      capabilityBoundary = readGenericRuntimeRuntimeCapabilityBoundaryArtifact({
        directiveRoot: input.directiveRoot,
        capabilityBoundaryPath: callableIntegration.runtimeRuntimeCapabilityBoundaryPath,
      });
    }
  } else {
    throw new Error(`unsupported Runtime artifact path: ${relativePath}`);
  }

  if (runtimeRecord?.linkedFollowUpRecord && !followUp && fileExistsInDirectiveWorkspace(input.directiveRoot, runtimeRecord.linkedFollowUpRecord)) {
    followUp = readDirectiveRuntimeFollowUpArtifact({
      directiveRoot: input.directiveRoot,
      followUpPath: runtimeRecord.linkedFollowUpRecord,
    });
  }
  if (runtimeRecord?.runtimeProofRelativePath && !runtimeProof && fileExistsInDirectiveWorkspace(input.directiveRoot, runtimeRecord.runtimeProofRelativePath)) {
    runtimeProof = readGenericRuntimeProofArtifact({
      directiveRoot: input.directiveRoot,
      runtimeProofPath: runtimeRecord.runtimeProofRelativePath,
    });
  }
  if (
    runtimeProof?.runtimeRuntimeCapabilityBoundaryPath
    && !capabilityBoundary
    && fileExistsInDirectiveWorkspace(input.directiveRoot, runtimeProof.runtimeRuntimeCapabilityBoundaryPath)
  ) {
    capabilityBoundary = readGenericRuntimeRuntimeCapabilityBoundaryArtifact({
      directiveRoot: input.directiveRoot,
      capabilityBoundaryPath: runtimeProof.runtimeRuntimeCapabilityBoundaryPath,
    });
  }
  if (!capabilityBoundary) {
    const inferredCapabilityBoundaryPath = inferRuntimeRuntimeCapabilityBoundaryPathFromProof({
      directiveRoot: input.directiveRoot,
      runtimeProofRelativePath: runtimeProof?.runtimeProofRelativePath ?? runtimeRecord?.runtimeProofRelativePath ?? null,
    });
    if (inferredCapabilityBoundaryPath) {
      capabilityBoundary = readGenericRuntimeRuntimeCapabilityBoundaryArtifact({
        directiveRoot: input.directiveRoot,
        capabilityBoundaryPath: inferredCapabilityBoundaryPath,
      });
    }
  }
  if (!promotionReadiness) {
    const inferredPromotionReadinessPath = inferRuntimePromotionReadinessPathFromCapabilityBoundary({
      directiveRoot: input.directiveRoot,
      capabilityBoundaryPath: capabilityBoundary?.runtimeRuntimeCapabilityBoundaryPath ?? null,
    });
    if (inferredPromotionReadinessPath) {
      promotionReadiness = readGenericRuntimePromotionReadinessArtifact({
        directiveRoot: input.directiveRoot,
        promotionReadinessPath: inferredPromotionReadinessPath,
      });
    }
  }
  if (!promotionReadiness && promotionRecord) {
    const inferredPromotionReadinessPath = findRuntimePromotionReadinessPathForCandidate({
      directiveRoot: input.directiveRoot,
      candidateId: promotionRecord.candidateId,
    });
    if (inferredPromotionReadinessPath) {
      promotionReadiness = readGenericRuntimePromotionReadinessArtifact({
        directiveRoot: input.directiveRoot,
        promotionReadinessPath: inferredPromotionReadinessPath,
      });
    }
  }
  if (
    !promotionRecord
    && promotionReadiness?.linkedPromotionRecordPath
    && fileExistsInDirectiveWorkspace(input.directiveRoot, promotionReadiness.linkedPromotionRecordPath)
  ) {
    promotionRecord = readGenericRuntimePromotionRecordArtifact({
      directiveRoot: input.directiveRoot,
      promotionRecordPath: promotionReadiness.linkedPromotionRecordPath,
    });
  }
  if (
    promotionReadiness?.linkedRuntimeRecordPath
    && !runtimeRecord
    && fileExistsInDirectiveWorkspace(input.directiveRoot, promotionReadiness.linkedRuntimeRecordPath)
  ) {
    runtimeRecord = readGenericRuntimeRecordArtifact({
      directiveRoot: input.directiveRoot,
      runtimeRecordPath: promotionReadiness.linkedRuntimeRecordPath,
    });
  }
  if (
    promotionReadiness?.linkedRuntimeProofPath
    && !runtimeProof
    && fileExistsInDirectiveWorkspace(input.directiveRoot, promotionReadiness.linkedRuntimeProofPath)
  ) {
    runtimeProof = readGenericRuntimeProofArtifact({
      directiveRoot: input.directiveRoot,
      runtimeProofPath: promotionReadiness.linkedRuntimeProofPath,
    });
  }
  if (
    promotionReadiness?.linkedCapabilityBoundaryPath
    && !capabilityBoundary
    && fileExistsInDirectiveWorkspace(input.directiveRoot, promotionReadiness.linkedCapabilityBoundaryPath)
  ) {
    capabilityBoundary = readGenericRuntimeRuntimeCapabilityBoundaryArtifact({
      directiveRoot: input.directiveRoot,
      capabilityBoundaryPath: promotionReadiness.linkedCapabilityBoundaryPath,
    });
  }
  if (
    promotionReadiness?.linkedCallableStubPath
    && !callableIntegration
    && fileExistsInDirectiveWorkspace(input.directiveRoot, promotionReadiness.linkedCallableStubPath)
  ) {
    callableIntegration = readGenericCallableIntegrationArtifact({
      directiveRoot: input.directiveRoot,
      callablePath: promotionReadiness.linkedCallableStubPath,
    });
  }
  if (
    runtimeRecord?.linkedFollowUpRecord
    && !followUp
    && fileExistsInDirectiveWorkspace(input.directiveRoot, runtimeRecord.linkedFollowUpRecord)
  ) {
    followUp = readDirectiveRuntimeFollowUpArtifact({
      directiveRoot: input.directiveRoot,
      followUpPath: runtimeRecord.linkedFollowUpRecord,
    });
  }
  if (
    runtimeRecord?.runtimeProofRelativePath
    && !runtimeProof
    && fileExistsInDirectiveWorkspace(input.directiveRoot, runtimeRecord.runtimeProofRelativePath)
  ) {
    runtimeProof = readGenericRuntimeProofArtifact({
      directiveRoot: input.directiveRoot,
      runtimeProofPath: runtimeRecord.runtimeProofRelativePath,
    });
  }
  if (
    runtimeProof?.runtimeRuntimeCapabilityBoundaryPath
    && !capabilityBoundary
    && fileExistsInDirectiveWorkspace(input.directiveRoot, runtimeProof.runtimeRuntimeCapabilityBoundaryPath)
  ) {
    capabilityBoundary = readGenericRuntimeRuntimeCapabilityBoundaryArtifact({
      directiveRoot: input.directiveRoot,
      capabilityBoundaryPath: runtimeProof.runtimeRuntimeCapabilityBoundaryPath,
    });
  }

  const candidateId =
    promotionRecord?.candidateId
    ?? promotionReadiness?.candidateId
    ?? capabilityBoundary?.candidateId
    ?? runtimeProof?.candidateId
    ?? runtimeRecord?.candidateId
    ?? followUp?.candidateId
    ?? legacyFollowUp?.candidateId
    ?? legacyHandoff?.candidateId
    ?? legacyRuntimeSystemBundleArtifact?.candidateId
    ?? legacyRuntimeValidationNoteArtifact?.candidateId
    ?? legacyRuntimePreconditionDecisionNoteArtifact?.candidateId
    ?? legacyRuntimeSamplePoolArtifact?.candidateId
    ?? legacyRuntimeLivePoolArtifact?.candidateId
    ?? legacyRuntimeLiveFetchGateSnapshot?.candidateId
    ?? legacyRuntimeLiveFetchProof?.candidateId
    ?? legacyRuntimeProofChecklist?.candidateId
    ?? legacyRuntimeSliceExecution?.candidateId
    ?? legacyRuntimeSliceProof?.candidateId
    ?? legacyRuntimeRecord?.candidateId
    ?? legacyRuntimeTransformationRecord?.candidateId
    ?? legacyRuntimeTransformationProof?.candidateId
    ?? legacyRuntimeRegistry?.candidateId
    ?? legacyRuntimePromotionRecord?.candidateId
    ?? callableIntegration?.candidateId
    ?? null;
  const candidateName =
    promotionRecord?.candidateName
    ?? promotionReadiness?.candidateName
    ?? runtimeProof?.candidateName
    ?? runtimeRecord?.candidateName
    ?? followUp?.candidateName
    ?? legacyFollowUp?.candidateName
    ?? legacyHandoff?.candidateName
    ?? legacyRuntimeSystemBundleArtifact?.candidateName
    ?? legacyRuntimeValidationNoteArtifact?.candidateName
    ?? legacyRuntimePreconditionDecisionNoteArtifact?.candidateName
    ?? legacyRuntimeSamplePoolArtifact?.candidateName
    ?? legacyRuntimeLivePoolArtifact?.candidateName
    ?? legacyRuntimeLiveFetchGateSnapshot?.candidateName
    ?? legacyRuntimeLiveFetchProof?.candidateName
    ?? legacyRuntimeProofChecklist?.candidateName
    ?? legacyRuntimeSliceExecution?.candidateName
    ?? legacyRuntimeSliceProof?.candidateName
    ?? legacyRuntimeRecord?.candidateName
    ?? legacyRuntimeTransformationRecord?.candidateName
    ?? legacyRuntimeTransformationProof?.candidateId
    ?? legacyRuntimeRegistry?.candidateName
    ?? legacyRuntimePromotionRecord?.candidateName
    ?? (capabilityBoundary?.title
      ? capabilityBoundary.title
        .replace(/^Legacy Runtime Runtime Capability Boundary:\s*/u, "")
        .replace(/^Runtime v0 Runtime Capability Boundary:\s*/u, "")
        .replace(/\s+\(\d{4}-\d{2}-\d{2}\)\s*$/u, "")
        .trim()
      : null)
    ?? null;

  return {
    artifactKind,
    candidateId,
    candidateName,
    legacyFollowUp,
    legacyHandoff,
    legacyRuntimeSystemBundleArtifact,
    legacyRuntimeValidationNoteArtifact,
    legacyRuntimePreconditionDecisionNoteArtifact,
    legacyRuntimeSamplePoolArtifact,
    legacyRuntimeLivePoolArtifact,
    legacyRuntimeLiveFetchGateSnapshot,
    legacyRuntimeLiveFetchProof,
    legacyRuntimeProofChecklist,
    legacyRuntimeSliceProof,
    legacyRuntimeSliceExecution,
    legacyProposedHost:
      legacyFollowUp?.proposedHost
      ?? legacyHandoff?.proposedHost
      ?? legacyRuntimeRecord?.proposedHost
      ?? legacyRuntimePromotionRecord?.targetHost
      ?? legacyRuntimeRegistry?.proposedHost
      ?? null,
    legacyRuntimeRecord,
    legacyRuntimeTransformationRecord,
    legacyRuntimeTransformationProof,
    legacyRuntimeRegistry,
    legacyRuntimePromotionRecord,
    promotionRecord,
    runtimeRecord,
    runtimeProof,
    capabilityBoundary,
    promotionReadiness,
    callableIntegration,
    ...(legacyFollowUp
      ? buildLegacyRuntimeFollowUpState({
          directiveRoot: input.directiveRoot,
          legacyFollowUp,
        })
      : legacyRuntimeSystemBundleArtifact
        ? buildLegacyRuntimeSystemBundleState()
      : legacyRuntimeValidationNoteArtifact
        ? buildLegacyRuntimeValidationNoteState()
      : legacyRuntimePreconditionDecisionNoteArtifact
        ? buildLegacyRuntimePreconditionDecisionNoteState({
            directiveRoot: input.directiveRoot,
            legacyRuntimePreconditionDecisionNote: legacyRuntimePreconditionDecisionNoteArtifact,
          })
      : legacyRuntimeSamplePoolArtifact
        ? buildLegacyRuntimeSamplePoolArtifactState({
            legacyRuntimeSamplePoolArtifact,
          })
      : legacyRuntimeLivePoolArtifact
        ? buildLegacyRuntimeLivePoolArtifactState({
            directiveRoot: input.directiveRoot,
            legacyRuntimeLivePoolArtifact,
            legacyRuntimeLiveFetchGateSnapshot,
            legacyRuntimeLiveFetchProof,
            legacyRuntimeRecord,
          })
      : legacyRuntimeLiveFetchGateSnapshot
        ? buildLegacyRuntimeLiveFetchGateSnapshotState({
            directiveRoot: input.directiveRoot,
            legacyRuntimeLiveFetchGateSnapshot,
            legacyRuntimeLiveFetchProof,
            legacyRuntimeRecord,
          })
      : legacyHandoff
        ? buildLegacyRuntimeHandoffState({
            directiveRoot: input.directiveRoot,
            legacyHandoff,
          })
      : legacyRuntimeLiveFetchProof
        ? buildLegacyRuntimeLiveFetchProofState({
            directiveRoot: input.directiveRoot,
            legacyRuntimeLiveFetchProof,
            legacyRuntimeRecord,
            legacyRuntimeProofChecklist,
          })
      : legacyRuntimeProofChecklist
        ? buildLegacyRuntimeProofChecklistState({
            directiveRoot: input.directiveRoot,
            legacyRuntimeProofChecklist,
            legacyRuntimeRecord,
            legacyRuntimeSliceProof,
          })
      : legacyRuntimeSliceExecution
        ? buildLegacyRuntimeSliceExecutionState({
            directiveRoot: input.directiveRoot,
            legacyRuntimeSliceExecution,
            legacyRuntimeSliceProof,
          })
      : legacyRuntimeSliceProof
        ? buildLegacyRuntimeSliceProofState({
            directiveRoot: input.directiveRoot,
            legacyRuntimeSliceProof,
            legacyRuntimeRecord,
          })
      : legacyRuntimeRecord
        ? buildLegacyRuntimeRecordState({
            directiveRoot: input.directiveRoot,
            legacyRuntimeRecord,
          })
      : legacyRuntimeTransformationProof
        ? buildLegacyRuntimeTransformationProofState({
            directiveRoot: input.directiveRoot,
            legacyRuntimeTransformationProof,
            legacyRuntimeTransformationRecord,
          })
      : legacyRuntimeTransformationRecord
        ? buildLegacyRuntimeTransformationRecordState({
            directiveRoot: input.directiveRoot,
            legacyRuntimeTransformationRecord,
          })
      : legacyRuntimeRegistry
        ? buildLegacyRuntimeRegistryState({
            directiveRoot: input.directiveRoot,
            legacyRuntimeRegistry,
          })
      : legacyRuntimePromotionRecord
        ? buildLegacyRuntimePromotionRecordState({
            directiveRoot: input.directiveRoot,
            legacyRuntimePromotionRecord,
          })
      : buildRuntimeState({
          directiveRoot: input.directiveRoot,
          followUp,
          runtimeRecord,
          runtimeProof,
          capabilityBoundary,
          promotionReadiness,
          promotionRecord,
          callableIntegration,
        })),
  };
}

