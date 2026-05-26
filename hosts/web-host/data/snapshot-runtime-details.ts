import { normalizeRelativePath } from "../../../shared/lib/path-normalization.ts";
import {
  readDirectiveRuntimeRecordArtifact,
} from "../../../runtime/lib/openers/record-proof-opener.ts";
import {
  readDirectiveRuntimeProofArtifact,
} from "../../../runtime/lib/openers/proof-runtime-capability-boundary-opener.ts";
import {
  readDirectiveRuntimeRuntimeCapabilityBoundaryArtifact,
} from "../../../runtime/lib/openers/promotion-readiness.ts";
import { resolveDirectiveWorkspaceState } from "../../../engine/state/index.ts";
import { readRuntimeApprovalAllowedFromCurrentHead } from "./shared.ts";
import type {
  FrontendRuntimePromotionReadinessDetail,
  FrontendRuntimeProofDetail,
  FrontendRuntimeRecordDetail,
  FrontendRuntimeRuntimeCapabilityBoundaryDetail,
} from "./snapshot.ts";

type ArtifactText = {
  relativePath: string;
  absolutePath: string;
  content: string;
};

type RuntimeDetailHelpers = {
  readDirectiveFrontendArtifactText: (input: {
    directiveRoot: string;
    relativePath: string;
  }) => ArtifactText;
  extractMarkdownTitle: (markdown: string) => string;
  extractBulletValue: (markdown: string, label: string) => string;
};

export function readDirectiveFrontendRuntimeRecordDetail(
  input: {
    directiveRoot: string;
    relativePath: string;
  },
): FrontendRuntimeRecordDetail {
  const relativePath = normalizeRelativePath(String(input.relativePath || "").trim());
  if (!relativePath) {
    return {
      ok: false,
      error: "missing_relative_path",
      relativePath,
    };
  }

  if (
    !relativePath.startsWith("runtime/02-records/")
    || !relativePath.endsWith("-runtime-record.md")
  ) {
    return {
      ok: false,
      error: "invalid_runtime_record_path",
      relativePath,
    };
  }

  try {
    const artifact = readDirectiveRuntimeRecordArtifact({
      directiveRoot: input.directiveRoot,
      runtimeRecordPath: relativePath,
    });

    return {
      ok: true,
      relativePath,
      absolutePath: artifact.runtimeRecordAbsolutePath,
      title: artifact.title,
      candidateId: artifact.candidateId,
      candidateName: artifact.candidateName,
      runtimeObjective: artifact.runtimeObjective,
      proposedHost: artifact.proposedHost,
      proposedRuntimeSurface: artifact.proposedRuntimeSurface,
      requiredProofSummary: artifact.requiredProofSummary,
      currentStatus: artifact.currentStatus,
      linkedFollowUpRecord: artifact.linkedFollowUpRecord,
      linkedRoutingPath: artifact.followUpArtifact.linkedHandoffPath,
      runtimeProofRelativePath: artifact.runtimeProofRelativePath,
      proofExists: artifact.proofExists,
      approvalAllowed:
        artifact.approvalAllowed
        && readRuntimeApprovalAllowedFromCurrentHead({
          directiveRoot: input.directiveRoot,
          relativePath,
          allowedCurrentStages: ["runtime.record."],
        }),
      content: artifact.content,
      artifact,
    };
  } catch (error) {
    return {
      ok: false,
      error: String((error as Error).message || error),
      relativePath,
    };
  }
}

export function readDirectiveFrontendRuntimeProofDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendRuntimeProofDetail {
  const relativePath = normalizeRelativePath(String(input.relativePath || "").trim());
  if (!relativePath) {
    return {
      ok: false,
      error: "missing_relative_path",
      relativePath,
    };
  }

  if (
    !relativePath.startsWith("runtime/03-proof/")
    || !relativePath.endsWith("-proof.md")
  ) {
    return {
      ok: false,
      error: "invalid_runtime_proof_path",
      relativePath,
    };
  }

  try {
    const artifact = readDirectiveRuntimeProofArtifact({
      directiveRoot: input.directiveRoot,
      runtimeProofPath: relativePath,
    });

    return {
      ok: true,
      relativePath,
      absolutePath: artifact.runtimeProofAbsolutePath,
      title: artifact.title,
      candidateId: artifact.candidateId,
      candidateName: artifact.candidateName,
      runtimeObjective: artifact.runtimeObjective,
      proposedHost: artifact.proposedHost,
      proposedRuntimeSurface: artifact.proposedRuntimeSurface,
      currentStatus: artifact.currentStatus,
      linkedRuntimeRecordPath: artifact.linkedRuntimeRecordPath,
      linkedFollowUpPath: artifact.linkedFollowUpPath,
      linkedRoutingPath: artifact.linkedRoutingPath,
      runtimeCapabilityBoundaryRelativePath: artifact.runtimeCapabilityBoundaryRelativePath,
      runtimeCapabilityBoundaryExists: artifact.runtimeCapabilityBoundaryExists,
      approvalAllowed:
        artifact.approvalAllowed
        && readRuntimeApprovalAllowedFromCurrentHead({
          directiveRoot: input.directiveRoot,
          relativePath,
          allowedCurrentStages: ["runtime.proof."],
        }),
      content: artifact.content,
      artifact,
    };
  } catch (error) {
    return {
      ok: false,
      error: String((error as Error).message || error),
      relativePath,
    };
  }
}

export function readDirectiveFrontendRuntimeRuntimeCapabilityBoundaryDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendRuntimeRuntimeCapabilityBoundaryDetail {
  const relativePath = normalizeRelativePath(String(input.relativePath || "").trim());
  if (!relativePath) {
    return {
      ok: false,
      error: "missing_relative_path",
      relativePath,
    };
  }

  if (
    !relativePath.startsWith("runtime/04-capability-boundaries/")
    || !relativePath.endsWith("-runtime-capability-boundary.md")
  ) {
    return {
      ok: false,
      error: "invalid_runtime_runtime_capability_boundary_path",
      relativePath,
    };
  }

  try {
    const artifact = readDirectiveRuntimeRuntimeCapabilityBoundaryArtifact({
      directiveRoot: input.directiveRoot,
      capabilityBoundaryPath: relativePath,
    });

    return {
      ok: true,
      relativePath,
      absolutePath: artifact.capabilityBoundaryAbsolutePath,
      title: artifact.title,
      candidateId: artifact.candidateId,
      candidateName: artifact.candidateName,
      runtimeObjective: artifact.runtimeObjective,
      proposedHost: artifact.proposedHost,
      proposedRuntimeSurface: artifact.proposedRuntimeSurface,
      currentProofStatus: artifact.currentProofStatus,
      linkedRuntimeProofPath: artifact.linkedRuntimeProofPath,
      linkedRuntimeRecordPath: artifact.linkedRuntimeRecordPath,
      linkedFollowUpPath: artifact.linkedFollowUpPath,
      linkedRoutingPath: artifact.linkedRoutingPath,
      promotionReadinessRelativePath: artifact.promotionReadinessRelativePath,
      promotionReadinessExists: artifact.promotionReadinessExists,
      approvalAllowed:
        artifact.approvalAllowed
        && readRuntimeApprovalAllowedFromCurrentHead({
          directiveRoot: input.directiveRoot,
          relativePath,
          allowedCurrentStages: ["runtime.runtime_capability_boundary.opened"],
        }),
      content: artifact.content,
      artifact,
    };
  } catch (error) {
    return {
      ok: false,
      error: String((error as Error).message || error),
      relativePath,
    };
  }
}

export function readDirectiveFrontendRuntimePromotionReadinessDetail(
  input: {
    directiveRoot: string;
    relativePath: string;
  },
  helpers: RuntimeDetailHelpers,
): FrontendRuntimePromotionReadinessDetail {
  const relativePath = normalizeRelativePath(String(input.relativePath || "").trim());
  if (!relativePath) {
    return {
      ok: false,
      error: "missing_relative_path",
      relativePath,
    };
  }

  if (
    !relativePath.startsWith("runtime/05-promotion-readiness/")
    || !relativePath.endsWith("-promotion-readiness.md")
  ) {
    return {
      ok: false,
      error: "invalid_runtime_promotion_readiness_path",
      relativePath,
    };
  }

  try {
    const artifact = helpers.readDirectiveFrontendArtifactText({
      directiveRoot: input.directiveRoot,
      relativePath,
    });
    const focus = resolveDirectiveWorkspaceState({
      directiveRoot: input.directiveRoot,
      artifactPath: relativePath,
      includeAnchors: false,
    }).focus;

    if (!focus || focus.lane !== "runtime") {
      throw new Error("runtime_promotion_readiness_focus_not_resolved");
    }

    return {
      ok: true,
      relativePath,
      absolutePath: artifact.absolutePath,
      title: helpers.extractMarkdownTitle(artifact.content),
      candidateId: helpers.extractBulletValue(artifact.content, "Candidate id"),
      candidateName: helpers.extractBulletValue(artifact.content, "Candidate name"),
      runtimeObjective: helpers.extractBulletValue(artifact.content, "Runtime objective"),
      proposedHost: helpers.extractBulletValue(artifact.content, "Proposed host"),
      proposedRuntimeSurface: helpers.extractBulletValue(artifact.content, "Proposed runtime surface"),
      executionState: helpers.extractBulletValue(artifact.content, "Execution state"),
      currentStatus: helpers.extractBulletValue(artifact.content, "Current status"),
      promotionReadinessDecision: helpers.extractBulletValue(artifact.content, "Promotion-readiness decision"),
      hostFacingPromotionDecision: helpers.extractBulletValue(artifact.content, "Reviewed decision"),
      frontendCapabilityDecision: helpers.extractBulletValue(artifact.content, "Frontend capability decision"),
      openedRuntimeImplementationSlicePath:
        helpers.extractBulletValue(artifact.content, "Explicit opened runtime-implementation slice")
        || helpers.extractBulletValue(artifact.content, "Opened runtime-implementation slice"),
      prePromotionImplementationSlicePath:
        helpers.extractBulletValue(artifact.content, "Explicit pre-promotion implementation slice"),
      promotionInputPackagePath:
        helpers.extractBulletValue(artifact.content, "Explicit promotion-input package for that slice"),
      profileCheckerDecisionPath:
        helpers.extractBulletValue(artifact.content, "Explicit profile/checker decision for that slice"),
      compileContractPath:
        helpers.extractBulletValue(artifact.content, "Explicit compile-contract artifact for that slice"),
      promotionGoNoGoDecisionPath:
        helpers.extractBulletValue(artifact.content, "Explicit go / no-go decision after the pre-promotion bundle")
        || helpers.extractBulletValue(artifact.content, "Explicit promotion go / no-go decision after opening that slice"),
      linkedCapabilityBoundaryPath:
        helpers.extractBulletValue(artifact.content, "Runtime capability boundary path")
        || helpers.extractBulletValue(artifact.content, "Runtime capability boundary"),
      linkedRuntimeProofPath:
        helpers.extractBulletValue(artifact.content, "Source Runtime proof artifact")
        || helpers.extractBulletValue(artifact.content, "Runtime proof artifact"),
      linkedRuntimeRecordPath:
        helpers.extractBulletValue(artifact.content, "Source Legacy Runtime record")
        || helpers.extractBulletValue(artifact.content, "Source Runtime v0 record")
        || helpers.extractBulletValue(artifact.content, "Legacy Runtime record")
        || helpers.extractBulletValue(artifact.content, "Runtime v0 record"),
      linkedFollowUpPath: helpers.extractBulletValue(artifact.content, "Source Runtime follow-up record"),
      linkedRoutingPath: helpers.extractBulletValue(artifact.content, "Linked Discovery routing record") || null,
      artifactStage: focus.artifactStage,
      artifactNextLegalStep: focus.artifactNextLegalStep,
      currentStage: focus.currentStage,
      nextLegalStep: focus.nextLegalStep,
      promotionReadinessBlockers: [...(focus.runtime?.promotionReadinessBlockers ?? [])],
      content: artifact.content,
    };
  } catch (error) {
    return {
      ok: false,
      error: String((error as Error).message || error),
      relativePath,
    };
  }
}
