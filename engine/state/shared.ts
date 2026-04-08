import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeAbsolutePath,
} from "../../shared/lib/path-normalization.ts";
import {
  normalizeDirectiveRelativePath as normalizeRelativePath,
  resolveDirectiveRelativePath,
} from "../../shared/lib/directive-relative-path.ts";

import type {
  DirectiveWorkspaceArtifactKind,
  DirectiveWorkspaceCurrentHead,
  DirectiveWorkspaceLinkedArtifacts,
  DirectiveWorkspaceResolvedFocus,
} from "./index.ts";
import {
  readDirectiveEngineRunsOverview,
  type StoredDirectiveEngineRunRecord,
} from "../execution/engine-run-artifacts.ts";
import { applyDirectiveWorkspaceIntegrityGate } from "../workspace-truth.ts";
import {
  fileExistsInDirectiveWorkspace,
  isDirectiveWorkspaceArtifactReference,
} from "../artifact-link-validation.ts";
import { listDirectiveWorkspaceArtifactRelativePaths } from "../../shared/lib/directive-workspace-artifact-storage.ts";
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
type QueueEntry = {
  candidate_id: string;
  candidate_name: string;
  source_type: string;
  source_reference: string;
  received_at: string;
  status: string;
  routing_target: string | null;
  mission_alignment?: string | null;
  capability_gap_id?: string | null;
  intake_record_path?: string | null;
  fast_path_record_path?: string | null;
  routing_record_path?: string | null;
  result_record_path?: string | null;
  notes?: string | null;
  operating_mode?: string | null;
};

type GenericDiscoveryMonitorArtifact = {
  candidateId: string;
  candidateName: string;
  monitorRelativePath: string;
  currentDecisionState: string;
  whyKeptInMonitor: string;
  reviewCadence: string | null;
  nextReviewDate: string | null;
  linkedIntakeRecord: string;
  linkedTriageRecord: string | null;
  linkedRoutingRecord: string;
};

type GenericRuntimePromotionReadinessArtifact = GenericRuntimePromotionReadinessArtifactBase;

export { normalizeAbsolutePath as normalizePath };

export { normalizeRelativePath };

export function getDefaultDirectiveWorkspaceRoot() {
  return normalizePath(fileURLToPath(new URL("../../shared", import.meta.url)));
}

export function requiredString(value: string | null | undefined, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`invalid_input: ${fieldName} is required`);
  }
  return value.trim();
}

export function optionalString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === "n/a" || normalized.toLowerCase() === "pending") {
    return null;
  }
  return normalized.replace(/^`|`$/g, "");
}

function optionalUnknownString(value: unknown) {
  return typeof value === "string" ? optionalString(value) : null;
}

export function stripInlineBackticks(value: string | null | undefined) {
  return typeof value === "string" ? value.replace(/`/g, "").trim() : null;
}

export { resolveDirectiveRelativePath };

export function readUtf8(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

export function extractTitle(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .find((line) => line.startsWith("# "))
    ?.replace(/^# /, "")
    .trim()
    || "";
}

export function deriveRuntimeCandidateNameFromTitle(title: string) {
  return title
    .replace(/^Legacy Runtime Record:\s*/u, "")
    .replace(/^Runtime v0 Record:\s*/u, "")
    .replace(/^Legacy Runtime Proof Artifact:\s*/u, "")
    .replace(/^Runtime v0 Proof Artifact:\s*/u, "")
    .replace(/^Legacy Runtime Runtime Capability Boundary:\s*/u, "")
    .replace(/^Runtime v0 Runtime Capability Boundary:\s*/u, "")
    .replace(/\s+\(\d{4}-\d{2}-\d{2}\)\s*$/u, "")
    .trim();
}

function deriveLegacyRuntimeFollowUpCandidateName(title: string) {
  return title
    .replace(/^CLI-Anything Runtime Follow-up Record:\s*/u, "")
    .replace(/^Runtime Follow-up Record:\s*/u, "")
    .replace(/\s+Runtime Follow-up\s*$/u, "")
    .trim();
}

function deriveLegacyRuntimeFollowUpCandidateId(followUpRelativePath: string) {
  return path.basename(followUpRelativePath)
    .replace(/-(runtime-follow-up-record|runtime-followup)\.md$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function deriveLegacyRuntimeRegistryCandidateName(title: string) {
  return title
    .replace(/\s+Registry Entry\s*$/u, "")
    .trim();
}

function deriveLegacyRuntimeRegistryCandidateId(registryRelativePath: string) {
  return path.basename(registryRelativePath)
    .replace(/-registry-entry\.md$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function deriveLegacyRuntimePromotionRecordCandidateName(title: string) {
  return title
    .replace(/\s+Promotion Record\s*$/u, "")
    .trim();
}

function deriveLegacyRuntimePromotionRecordCandidateId(promotionRecordRelativePath: string) {
  return path.basename(promotionRecordRelativePath)
    .replace(/-promotion-record\.md$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function deriveLegacyRuntimeRecordCandidateId(runtimeRecordRelativePath: string) {
  return path.basename(runtimeRecordRelativePath)
    .replace(/-runtime-record\.md$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function deriveLegacyRuntimeSliceProofCandidateName(title: string) {
  return title
    .replace(/\s+Runtime Slice 01 Proof\s*$/u, "")
    .trim();
}

function deriveLegacyRuntimeSliceProofCandidateId(runtimeSliceProofRelativePath: string) {
  return path.basename(runtimeSliceProofRelativePath)
    .replace(/-runtime-slice-01-proof\.md$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function inferLegacyRuntimeRecordPathFromSliceProof(runtimeSliceProofRelativePath: string) {
  return normalizeRelativePath(
    runtimeSliceProofRelativePath.replace(/-runtime-slice-01-proof\.md$/u, "-runtime-record.md"),
  );
}

function deriveLegacyRuntimeSliceExecutionCandidateName(title: string) {
  return title
    .replace(/\s+Fallback Rehearsal\s+\(Bounded\)\s*$/u, "")
    .replace(/\s+Runtime Slice 01 Execution\s*$/u, "")
    .trim();
}

function deriveLegacyRuntimeSliceExecutionCandidateId(runtimeSliceExecutionRelativePath: string) {
  return path.basename(runtimeSliceExecutionRelativePath)
    .replace(/-fallback-rehearsal\.md$/u, "")
    .replace(/-runtime-slice-01-execution\.md$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function inferLegacyRuntimeSliceProofPathFromExecution(runtimeSliceExecutionRelativePath: string) {
  if (!/-runtime-slice-01-execution\.md$/u.test(runtimeSliceExecutionRelativePath)) {
    return null;
  }
  return normalizeRelativePath(
    runtimeSliceExecutionRelativePath.replace(/-runtime-slice-01-execution\.md$/u, "-runtime-slice-01-proof.md"),
  );
}

function deriveLegacyRuntimeProofChecklistCandidateName(title: string) {
  return title
    .replace(/\s+Runtime Slice 01 Proof Checklist\s*$/u, "")
    .trim();
}

function deriveLegacyRuntimeProofChecklistCandidateId(proofChecklistRelativePath: string) {
  return path.basename(proofChecklistRelativePath)
    .replace(/-runtime-slice-01-proof-checklist\.md$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function deriveLegacyRuntimeLiveFetchProofCandidateName(title: string) {
  return title
    .replace(/\s+Runtime Slice 02 Live Fetch Proof\s*$/u, "")
    .trim();
}

function deriveLegacyRuntimeLiveFetchProofCandidateId(liveFetchProofRelativePath: string) {
  return path.basename(liveFetchProofRelativePath)
    .replace(/-runtime-slice-02-live-fetch-proof\.md$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function humanizeSlugIdentifier(value: string) {
  return value
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => (part.length <= 2 ? part.toUpperCase() : `${part[0]!.toUpperCase()}${part.slice(1)}`))
    .join(" ");
}

function deriveLegacyRuntimeLiveFetchGateSnapshotCandidateId(gateSnapshotRelativePath: string) {
  return path.basename(gateSnapshotRelativePath)
    .replace(/-live-fetch-gate-snapshot\.json$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function inferLegacyRuntimeLiveFetchProofPathFromGateSnapshot(gateSnapshotRelativePath: string) {
  return normalizeRelativePath(
    gateSnapshotRelativePath.replace(
      /-live-fetch-gate-snapshot\.json$/u,
      "-runtime-slice-02-live-fetch-proof.md",
    ),
  );
}

function deriveLegacyRuntimeLivePoolCandidateId(livePoolRelativePath: string) {
  return path.basename(livePoolRelativePath)
    .replace(/-live-qualified-pool\.json$/u, "")
    .replace(/-live-degraded-pool\.json$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function inferLegacyRuntimeLiveFetchGateSnapshotPathFromLivePool(livePoolRelativePath: string) {
  return normalizeRelativePath(
    livePoolRelativePath
      .replace(/-live-qualified-pool\.json$/u, "-live-fetch-gate-snapshot.json")
      .replace(/-live-degraded-pool\.json$/u, "-live-fetch-gate-snapshot.json"),
  );
}

function deriveLegacyRuntimeSamplePoolCandidateId(samplePoolRelativePath: string) {
  return path.basename(samplePoolRelativePath)
    .replace(/-qualified-pool-sample\.json$/u, "")
    .replace(/-degraded-quality-sample\.json$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function deriveLegacyRuntimeSystemBundleCandidateId(systemBundleRelativePath: string) {
  return path.basename(systemBundleRelativePath)
    .replace(/\.md$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function deriveLegacyRuntimeSystemBundleCandidateName(title: string) {
  return title
    .replace(/^Runtime System Bundle \d{2}:\s*/u, "")
    .trim();
}

function deriveLegacyRuntimeValidationNoteCandidateId(validationNoteRelativePath: string) {
  return path.basename(validationNoteRelativePath)
    .replace(/\.md$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function deriveLegacyRuntimePreconditionDecisionNoteCandidateId(noteRelativePath: string) {
  return path.basename(noteRelativePath)
    .replace(/-cli-precondition-proof\.md$/u, "")
    .replace(/-precondition-correction\.md$/u, "")
    .replace(/-host-adapter-decision\.md$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function deriveLegacyRuntimePreconditionDecisionNoteCandidateName(title: string) {
  return title
    .replace(/\s+CLI Precondition Proof\s*$/u, "")
    .replace(/\s+Precondition Correction\s*$/u, "")
    .replace(/\s+Host Adapter Decision\s*$/u, "")
    .trim();
}

function deriveLegacyRuntimeTransformationCandidateName(title: string) {
  return title
    .replace(/^Transformation Record:\s*/u, "")
    .trim();
}

function deriveLegacyRuntimeTransformationCandidateId(relativePath: string) {
  return path.basename(relativePath)
    .replace(/-transformation-record\.md$/u, "")
    .replace(/-transformation-proof\.json$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "")
    .trim();
}

function inferLegacyRuntimeTransformationRecordPath(proofRelativePath: string) {
  return normalizeRelativePath(
    proofRelativePath.replace(/-transformation-proof\.json$/u, "-transformation-record.md"),
  );
}

function deriveLegacyRuntimeHandoffCandidateName(title: string) {
  return title
    .replace(/^Architecture to Runtime Handoff:\s*/u, "")
    .trim();
}

export function isLegacyRuntimeFollowUpDeferred(input: {
  currentDecisionState: string | null;
  currentStatus: string;
}) {
  return /defer/i.test(input.currentDecisionState ?? "") || /deferred/i.test(input.currentStatus);
}

function normalizeLegacyRuntimeReentryContractPath(input: {
  directiveRoot: string;
  value: string | null | undefined;
}) {
  const rawValue = optionalString(input.value);
  if (!rawValue || /^(n\/a|pending)\b/i.test(rawValue)) {
    return null;
  }
  return resolveDirectiveRelativePath(
    input.directiveRoot,
    rawValue,
    "re-entry contract path (if deferred)",
  );
}

function normalizeLegacyRuntimeTransformationArtifactPath(input: {
  directiveRoot: string;
  value: string | null | undefined;
  label: string;
}) {
  const rawValue = optionalString(input.value);
  if (!rawValue || !isDirectiveWorkspaceArtifactReference(rawValue)) {
    return null;
  }
  return resolveDirectiveRelativePath(input.directiveRoot, rawValue, input.label);
}

function normalizeLegacyRuntimeOptionalArtifactPath(input: {
  directiveRoot: string;
  value: string | null | undefined;
  label: string;
}) {
  const rawValue = optionalString(input.value);
  if (!rawValue) {
    return null;
  }
  const looksAbsolutePath = path.isAbsolute(rawValue);
  if (!looksAbsolutePath && !isDirectiveWorkspaceArtifactReference(rawValue)) {
    return null;
  }
  try {
    return resolveDirectiveRelativePath(input.directiveRoot, rawValue, input.label);
  } catch {
    return null;
  }
}

export function extractBulletValue(markdown: string, label: string) {
  const prefix = `- ${label}:`;
  const line = markdown
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(prefix));
  if (!line) {
    return null;
  }
  return optionalString(line.trim().replace(prefix, "").trim());
}

export function extractColonValue(markdown: string, label: string) {
  const prefix = `${label}:`;
  const line = markdown
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(prefix));
  if (!line) {
    return null;
  }
  return optionalString(line.trim().replace(prefix, "").trim());
}

export function extractNestedBulletValue(markdown: string, label: string) {
  const lines = markdown.split(/\r?\n/);
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
  const inlineValue = optionalString(
    trimmedStart.startsWith(bulletPrefix)
      ? trimmedStart.replace(bulletPrefix, "").trim()
      : trimmedStart.replace(plainPrefix, "").trim(),
  );
  if (inlineValue) {
    return inlineValue;
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
      const bulletValue = optionalString(trimmed.replace(/^- /u, "").trim());
      if (!bulletValue || bulletValue.endsWith(":")) {
        break;
      }
      return bulletValue;
    }
    if (!line.startsWith("  ") && !line.startsWith("\t")) {
      break;
    }
  }

  return null;
}

export function extractMarkdownSectionSummary(markdown: string, heading: string) {
  const lines = markdown.split(/\r?\n/);
  const headingLine = `## ${heading}`;
  const startIndex = lines.findIndex((line) => line.trim() === headingLine);
  if (startIndex === -1) {
    return null;
  }

  const values: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      break;
    }
    if (!trimmed) {
      continue;
    }
    values.push(trimmed.replace(/^- /u, "").trim());
  }

  return optionalString(values.join(" "));
}

export function zeroLinkedArtifacts(): DirectiveWorkspaceLinkedArtifacts {
  return {
    discoveryIntakePath: null,
    discoveryTriagePath: null,
    discoveryRoutingPath: null,
    discoveryRoutingReviewResolutionPath: null,
    discoveryMonitorPath: null,
    engineRunRecordPath: null,
    engineRunReportPath: null,
    architectureHandoffPath: null,
    architectureBoundedStartPath: null,
    architectureBoundedResultPath: null,
    architectureContinuationStartPath: null,
    architectureAdoptionPath: null,
    architectureImplementationTargetPath: null,
    architectureImplementationResultPath: null,
    architectureRetainedPath: null,
    architectureIntegrationRecordPath: null,
    architectureConsumptionRecordPath: null,
    architectureEvaluationPath: null,
    architectureReopenedStartPath: null,
    runtimeFollowUpPath: null,
    runtimeRecordPath: null,
    runtimeProofPath: null,
    runtimeRuntimeCapabilityBoundaryPath: null,
    runtimePromotionReadinessPath: null,
    runtimePromotionRecordPath: null,
    runtimeRegistryEntryPath: null,
    runtimePromotionSpecificationPath: null,
    runtimeHostSelectionResolutionPath: null,
    runtimeCallableStubPath: null,
    runtimeHostConsumptionReportPath: null,
    runtimeCallableStatus: null as "callable" | "not_implemented" | null,
  };
}

function matchStagePrefix(currentStage: string, prefix: string, fallback: string) {
  return currentStage.startsWith(prefix) ? currentStage : fallback;
}

function deriveDirectiveWorkspaceCurrentHead(
  focus: Omit<DirectiveWorkspaceResolvedFocus, "integrityState" | "currentHead">,
): DirectiveWorkspaceCurrentHead {
  const linked = focus.linkedArtifacts;
  const currentStage = focus.currentStage;
  const candidates: DirectiveWorkspaceCurrentHead[] = [];

  if (linked.architectureReopenedStartPath) {
    candidates.push({
      artifactPath: linked.architectureReopenedStartPath,
      artifactKind: "architecture_bounded_start",
      lane: "architecture",
      artifactStage: "architecture.bounded_start.opened",
    });
  }
  if (linked.architectureEvaluationPath) {
    candidates.push({
      artifactPath: linked.architectureEvaluationPath,
      artifactKind: "architecture_post_consumption_evaluation",
      lane: "architecture",
      artifactStage: matchStagePrefix(
        currentStage,
        "architecture.post_consumption_evaluation.",
        "architecture.post_consumption_evaluation.unknown",
      ),
    });
  }
  if (linked.architectureConsumptionRecordPath) {
    candidates.push({
      artifactPath: linked.architectureConsumptionRecordPath,
      artifactKind: "architecture_consumption_record",
      lane: "architecture",
      artifactStage: matchStagePrefix(
        currentStage,
        "architecture.consumption.",
        "architecture.consumption.unknown",
      ),
    });
  }
  if (linked.architectureIntegrationRecordPath) {
    candidates.push({
      artifactPath: linked.architectureIntegrationRecordPath,
      artifactKind: "architecture_integration_record",
      lane: "architecture",
      artifactStage: "architecture.integration_record.ready",
    });
  }
  if (linked.architectureRetainedPath) {
    candidates.push({
      artifactPath: linked.architectureRetainedPath,
      artifactKind: "architecture_retained",
      lane: "architecture",
      artifactStage: "architecture.retained.confirmed",
    });
  }
  if (linked.architectureImplementationResultPath) {
    candidates.push({
      artifactPath: linked.architectureImplementationResultPath,
      artifactKind: "architecture_implementation_result",
      lane: "architecture",
      artifactStage: matchStagePrefix(
        currentStage,
        "architecture.implementation_result.",
        "architecture.implementation_result.unknown",
      ),
    });
  }
  if (linked.architectureImplementationTargetPath) {
    candidates.push({
      artifactPath: linked.architectureImplementationTargetPath,
      artifactKind: "architecture_implementation_target",
      lane: "architecture",
      artifactStage: "architecture.implementation_target.opened",
    });
  }
  if (linked.architectureAdoptionPath) {
    candidates.push({
      artifactPath: linked.architectureAdoptionPath,
      artifactKind: "architecture_adoption",
      lane: "architecture",
      artifactStage: matchStagePrefix(
        currentStage,
        "architecture.adoption.",
        "architecture.adoption.unknown",
      ),
    });
  }
  if (linked.architectureContinuationStartPath) {
    candidates.push({
      artifactPath: linked.architectureContinuationStartPath,
      artifactKind: "architecture_bounded_start",
      lane: "architecture",
      artifactStage: "architecture.bounded_start.opened",
    });
  }
  if (linked.architectureBoundedResultPath) {
    candidates.push({
      artifactPath: linked.architectureBoundedResultPath,
      artifactKind: "architecture_bounded_result",
      lane: "architecture",
      artifactStage: matchStagePrefix(
        currentStage,
        "architecture.bounded_result.",
        "architecture.bounded_result.unknown",
      ),
    });
  }
  if (linked.architectureBoundedStartPath) {
    candidates.push({
      artifactPath: linked.architectureBoundedStartPath,
      artifactKind: "architecture_bounded_start",
      lane: "architecture",
      artifactStage: "architecture.bounded_start.opened",
    });
  }
  if (linked.architectureHandoffPath) {
    candidates.push({
      artifactPath: linked.architectureHandoffPath,
      artifactKind: "architecture_handoff",
      lane: "architecture",
      artifactStage: "architecture.handoff.pending_review",
    });
  }

  if (linked.runtimeRegistryEntryPath) {
    candidates.push({
      artifactPath: linked.runtimeRegistryEntryPath,
      artifactKind: focus.artifactKind === "runtime_registry_legacy"
        ? "runtime_registry_legacy"
        : "runtime_registry_accepted",
      lane: "runtime",
      artifactStage: matchStagePrefix(
        currentStage,
        "runtime.registry.",
        "runtime.registry.accepted",
      ),
    });
  }
  if (linked.runtimePromotionRecordPath) {
    candidates.push({
      artifactPath: linked.runtimePromotionRecordPath,
      artifactKind: "runtime_promotion_record",
      lane: "runtime",
      artifactStage: matchStagePrefix(
        currentStage,
        "runtime.promotion_record.",
        "runtime.promotion_record.opened",
      ),
    });
  }
  if (linked.runtimePromotionReadinessPath) {
    candidates.push({
      artifactPath: linked.runtimePromotionReadinessPath,
      artifactKind: "runtime_promotion_readiness",
      lane: "runtime",
      artifactStage: "runtime.promotion_readiness.opened",
    });
  }
  if (linked.runtimeRuntimeCapabilityBoundaryPath) {
    candidates.push({
      artifactPath: linked.runtimeRuntimeCapabilityBoundaryPath,
      artifactKind: "runtime_runtime_capability_boundary",
      lane: "runtime",
      artifactStage: "runtime.runtime_capability_boundary.opened",
    });
  }
  if (focus.artifactKind === "runtime_sample_pool_artifact_legacy") {
    candidates.push({
      artifactPath: focus.artifactPath,
      artifactKind: "runtime_sample_pool_artifact_legacy",
      lane: "runtime",
      artifactStage: matchStagePrefix(
        currentStage,
        "runtime.sample_",
        "runtime.sample_qualified_pool.legacy_recorded",
      ),
    });
  }
  if (focus.artifactKind === "runtime_system_bundle_note_legacy") {
    candidates.push({
      artifactPath: focus.artifactPath,
      artifactKind: "runtime_system_bundle_note_legacy",
      lane: "runtime",
      artifactStage: matchStagePrefix(
        currentStage,
        "runtime.system_bundle.",
        "runtime.system_bundle.legacy_recorded",
      ),
    });
  }
  if (focus.artifactKind === "runtime_validation_note_legacy") {
    candidates.push({
      artifactPath: focus.artifactPath,
      artifactKind: "runtime_validation_note_legacy",
      lane: "runtime",
      artifactStage: matchStagePrefix(
        currentStage,
        "runtime.validation_note.",
        "runtime.validation_note.legacy_recorded",
      ),
    });
  }
  if (focus.artifactKind === "runtime_precondition_decision_note_legacy") {
    candidates.push({
      artifactPath: focus.artifactPath,
      artifactKind: "runtime_precondition_decision_note_legacy",
      lane: "runtime",
      artifactStage: currentStage.startsWith("runtime.host_adapter_decision.")
        ? currentStage
        : matchStagePrefix(
            currentStage,
            "runtime.precondition_",
            "runtime.precondition_proof.legacy_recorded",
          ),
    });
  }
  if (focus.artifactKind === "runtime_live_pool_artifact_legacy") {
    candidates.push({
      artifactPath: focus.artifactPath,
      artifactKind: "runtime_live_pool_artifact_legacy",
      lane: "runtime",
      artifactStage: matchStagePrefix(
        currentStage,
        "runtime.live_",
        "runtime.live_qualified_pool.legacy_recorded",
      ),
    });
  }
  if (focus.artifactKind === "runtime_live_fetch_gate_snapshot_legacy") {
    candidates.push({
      artifactPath: focus.artifactPath,
      artifactKind: "runtime_live_fetch_gate_snapshot_legacy",
      lane: "runtime",
      artifactStage: matchStagePrefix(
        currentStage,
        "runtime.live_fetch_gate_snapshot.",
        "runtime.live_fetch_gate_snapshot.legacy_recorded",
      ),
    });
  }
  if (focus.artifactKind === "runtime_live_fetch_proof_legacy") {
    candidates.push({
      artifactPath: focus.artifactPath,
      artifactKind: "runtime_live_fetch_proof_legacy",
      lane: "runtime",
      artifactStage: matchStagePrefix(
        currentStage,
        "runtime.live_fetch_proof.",
        "runtime.live_fetch_proof.legacy_recorded",
      ),
    });
  }
  if (focus.artifactKind === "runtime_proof_checklist_legacy") {
    candidates.push({
      artifactPath: focus.artifactPath,
      artifactKind: "runtime_proof_checklist_legacy",
      lane: "runtime",
      artifactStage: matchStagePrefix(
        currentStage,
        "runtime.proof_checklist.",
        "runtime.proof_checklist.legacy_recorded",
      ),
    });
  }
  if (focus.artifactKind === "runtime_slice_execution_legacy") {
    candidates.push({
      artifactPath: focus.artifactPath,
      artifactKind: "runtime_slice_execution_legacy",
      lane: "runtime",
      artifactStage: matchStagePrefix(
        currentStage,
        "runtime.slice_execution.",
        "runtime.slice_execution.legacy_recorded",
      ),
    });
  }
  if (linked.runtimeProofPath) {
    candidates.push({
      artifactPath: linked.runtimeProofPath,
      artifactKind: focus.artifactKind === "runtime_proof_callable_integration"
        ? "runtime_proof_callable_integration"
        : "runtime_proof_follow_up_review",
      lane: "runtime",
      artifactStage: matchStagePrefix(currentStage, "runtime.proof.", "runtime.proof.opened"),
    });
  }
  if (focus.artifactKind === "runtime_slice_proof_legacy") {
    candidates.push({
      artifactPath: focus.artifactPath,
      artifactKind: "runtime_slice_proof_legacy",
      lane: "runtime",
      artifactStage: matchStagePrefix(currentStage, "runtime.slice_proof.", "runtime.slice_proof.legacy_recorded"),
    });
  }
  if (linked.runtimeRecordPath) {
    candidates.push({
      artifactPath: linked.runtimeRecordPath,
      artifactKind: focus.artifactKind === "runtime_record_callable_integration"
        ? "runtime_record_callable_integration"
        : "runtime_record_follow_up_review",
      lane: "runtime",
      artifactStage: matchStagePrefix(currentStage, "runtime.record.", "runtime.record.pending_proof_boundary"),
    });
  }
  if (linked.runtimeFollowUpPath) {
    candidates.push({
      artifactPath: linked.runtimeFollowUpPath,
      artifactKind: "runtime_follow_up",
      lane: "runtime",
      artifactStage: "runtime.follow_up.pending_review",
    });
  }
  if (linked.runtimeCallableStubPath) {
    candidates.push({
      artifactPath: linked.runtimeCallableStubPath,
      artifactKind: "runtime_callable_integration",
      lane: "runtime",
      artifactStage: linked.runtimeCallableStatus === "callable"
        ? "runtime.callable.executing"
        : "runtime.callable_stub.not_implemented",
    });
  }

  if (linked.discoveryMonitorPath) {
    candidates.push({
      artifactPath: linked.discoveryMonitorPath,
      artifactKind: "discovery_monitor_record",
      lane: "discovery",
      artifactStage: matchStagePrefix(
        currentStage,
        "discovery.monitor.",
        "discovery.monitor.active",
      ),
    });
  }
  if (linked.discoveryRoutingPath) {
    candidates.push({
      artifactPath: linked.discoveryRoutingPath,
      artifactKind: "discovery_routing_record",
      lane: "discovery",
      artifactStage: focus.routeTarget
        ? `discovery.route.${focus.routeTarget}`
        : "discovery.route.unknown",
    });
  }
  if (linked.engineRunRecordPath) {
    candidates.push({
      artifactPath: linked.engineRunRecordPath,
      artifactKind: "engine_run",
      lane: "engine",
      artifactStage: focus.engine.selectedLane
        ? `engine.route.${focus.engine.selectedLane}`
        : "engine.route.unknown",
    });
  }

  return candidates[0] ?? {
    artifactPath: focus.artifactPath,
    artifactKind: focus.artifactKind,
    lane: focus.lane,
    artifactStage: focus.artifactStage,
  };
}

function shouldDowngradeStaleArtifactNextStep(input: {
  artifactKind: DirectiveWorkspaceArtifactKind;
  artifactPath: string;
  currentHead: DirectiveWorkspaceCurrentHead;
}) {
  if (input.currentHead.artifactPath === input.artifactPath) {
    return false;
  }

  return input.artifactKind === "runtime_follow_up"
    || input.artifactKind === "runtime_record_follow_up_review"
    || input.artifactKind === "runtime_proof_follow_up_review"
    || input.artifactKind === "runtime_runtime_capability_boundary"
    || input.artifactKind === "runtime_promotion_readiness"
    || input.artifactKind === "architecture_handoff"
    || input.artifactKind === "architecture_bounded_start"
    || input.artifactKind === "architecture_bounded_result"
    || input.artifactKind === "architecture_adoption"
    || input.artifactKind === "architecture_implementation_target"
    || input.artifactKind === "architecture_implementation_result"
    || input.artifactKind === "architecture_retained"
    || input.artifactKind === "architecture_integration_record"
    || input.artifactKind === "architecture_consumption_record"
    || input.artifactKind === "architecture_post_consumption_evaluation";
}

function buildStaleCurrentHeadArtifactNextStepMessage(currentHead: DirectiveWorkspaceCurrentHead) {
  return `This artifact is no longer the live continuation point; continue from currentHead "${currentHead.artifactPath}" instead.`;
}

export function finalizeResolvedFocus(
  focus: Omit<DirectiveWorkspaceResolvedFocus, "integrityState" | "currentHead">,
): DirectiveWorkspaceResolvedFocus {
  const currentHead = deriveDirectiveWorkspaceCurrentHead(focus);
  const artifactNextLegalStep = shouldDowngradeStaleArtifactNextStep({
    artifactKind: focus.artifactKind,
    artifactPath: focus.artifactPath,
    currentHead,
  })
    ? buildStaleCurrentHeadArtifactNextStepMessage(currentHead)
    : focus.artifactNextLegalStep;

  return applyDirectiveWorkspaceIntegrityGate({
    ...focus,
    artifactNextLegalStep,
    currentHead,
  });
}

export function mergeNonNullLinkedArtifacts(
  target: DirectiveWorkspaceLinkedArtifacts,
  source: DirectiveWorkspaceLinkedArtifacts | null | undefined,
) {
  if (!source) {
    return;
  }

  for (const [key, value] of Object.entries(source)) {
    if (value) {
      target[key as keyof DirectiveWorkspaceLinkedArtifacts] = value;
    }
  }
}

export function isDiscoveryHeldRouteDestination(routeDestination: string) {
  return routeDestination === "monitor"
    || routeDestination === "defer"
    || routeDestination === "reject"
    || routeDestination === "reference";
}

export function listFiles(input: {
  directiveRoot: string;
  relativeDir: string;
  suffix: string;
}) {
  return listDirectiveWorkspaceArtifactRelativePaths({
    directiveRoot: input.directiveRoot,
    relativeDir: input.relativeDir,
    suffix: input.suffix,
  });
}

function loadQueueEntries(directiveRoot: string) {
  const queuePath = path.join(directiveRoot, "discovery", "intake-queue.json");
  if (!fs.existsSync(queuePath)) {
    return [] as QueueEntry[];
  }
  const payload = JSON.parse(readUtf8(queuePath)) as { entries?: QueueEntry[] };
  return Array.isArray(payload.entries) ? payload.entries : [];
}

export function findQueueEntryByCandidateId(directiveRoot: string, candidateId: string | null | undefined) {
  if (!candidateId) {
    return null;
  }
  return loadQueueEntries(directiveRoot).find((entry) => entry.candidate_id === candidateId) ?? null;
}

export function findLatestEngineRunByCandidateId(directiveRoot: string, candidateId: string | null | undefined) {
  if (!candidateId) {
    return null;
  }

  const engineRunsRoot = path.join(directiveRoot, "runtime", "standalone-host", "engine-runs");
  if (!fs.existsSync(engineRunsRoot)) {
    return null;
  }

  const matches = fs
    .readdirSync(engineRunsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(engineRunsRoot, entry.name))
    .map((recordPath) => {
      try {
        const parsed = JSON.parse(readUtf8(recordPath)) as StoredDirectiveEngineRunRecord;
        if (parsed.candidate?.candidateId !== candidateId) {
          return null;
        }
        const reportPath = recordPath.replace(/\.json$/i, ".md");
        return {
          record: parsed,
          recordRelativePath: normalizeRelativePath(path.relative(directiveRoot, recordPath)),
          reportRelativePath: fs.existsSync(reportPath)
            ? normalizeRelativePath(path.relative(directiveRoot, reportPath))
            : null,
        };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => right.record.receivedAt.localeCompare(left.record.receivedAt));

  return matches[0] ?? null;
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
    proposedHost: extractBulletValue(content, "Proposed host"),
    executionState: extractBulletValue(content, "Execution state"),
    currentStatus: extractBulletValue(content, "Current status"),
  };
}

export function readGenericLegacyRuntimeFollowUpArtifact(input: {
  directiveRoot: string;
  followUpPath: string;
}): GenericLegacyRuntimeFollowUpArtifact {
  const followUpRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.followUpPath,
    "followUpPath",
  );
  const absolutePath = path.join(input.directiveRoot, followUpRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: followUpPath not found: ${followUpRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);
  const candidateId = requiredString(
    extractBulletValue(content, "Candidate id")
      ?? extractColonValue(content, "Candidate id")
      ?? deriveLegacyRuntimeFollowUpCandidateId(followUpRelativePath),
    "candidate id",
  );
  const candidateName = extractBulletValue(content, "Candidate name")
    ?? requiredString(deriveLegacyRuntimeFollowUpCandidateName(title), "candidate name");
  const currentDecisionState =
    extractBulletValue(content, "Current decision state")
    ?? extractColonValue(content, "Current decision state");
  const currentStatus = requiredString(
    extractBulletValue(content, "Current status")
      ?? extractColonValue(content, "Status"),
    "current status",
  );
  const runtimeValueToOperationalize = requiredString(
    extractBulletValue(content, "Runtime value to operationalize")
      ?? extractMarkdownSectionSummary(content, "Runtime Value To Evaluate"),
    "runtime value to operationalize",
  );
  const reentryContractPath = normalizeLegacyRuntimeReentryContractPath({
    directiveRoot: input.directiveRoot,
    value: extractBulletValue(content, "Re-entry contract path (if deferred)"),
  });

  return {
    candidateId,
    candidateName,
    followUpRelativePath,
    currentDecisionState,
    runtimeValueToOperationalize,
    proposedHost: extractBulletValue(content, "Proposed host"),
    proposedIntegrationMode: extractBulletValue(content, "Proposed integration mode"),
    reentryContractPath,
    currentStatus,
    reviewCadence: extractBulletValue(content, "Review cadence"),
  };
}

export function readGenericLegacyRuntimeHandoffArtifact(input: {
  directiveRoot: string;
  handoffPath: string;
}): GenericLegacyRuntimeHandoffArtifact {
  const handoffRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.handoffPath,
    "handoffPath",
  );
  const absolutePath = path.join(input.directiveRoot, handoffRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: handoffPath not found: ${handoffRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);
  const candidateId = requiredString(extractBulletValue(content, "Candidate id"), "candidate id");
  const candidateName = extractBulletValue(content, "Candidate name")
    ?? requiredString(deriveLegacyRuntimeHandoffCandidateName(title), "candidate name");
  const runtimeValueToOperationalize = requiredString(
    extractBulletValue(content, "Runtime value to operationalize in Runtime")
      ?? extractBulletValue(content, "Runtime value to operationalize"),
    "runtime value to operationalize",
  );
  const proposedRuntimeSurface = requiredString(
    extractBulletValue(content, "Proposed runtime surface"),
    "proposed runtime surface",
  );

  return {
    candidateId,
    candidateName,
    handoffRelativePath,
    runtimeValueToOperationalize,
    proposedHost: stripInlineBackticks(extractBulletValue(content, "Proposed host")),
    proposedRuntimeSurface,
    originatingArchitectureRecordPath: (() => {
      const value = extractBulletValue(content, "Originating Architecture record");
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "originating architecture record") : null;
    })(),
    runtimeFollowUpPath: (() => {
      const value = extractBulletValue(content, "Runtime follow-up");
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "runtime follow-up") : null;
    })(),
    runtimeRecordPath: (() => {
      const value = extractBulletValue(content, "Runtime record");
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "runtime record") : null;
    })(),
    runtimeProofPath: (() => {
      const value = extractBulletValue(content, "Proof artifact");
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "proof artifact") : null;
    })(),
    promotionRecordPath: (() => {
      const value = extractBulletValue(content, "Promotion record (if promoted)")
        ?? extractBulletValue(content, "Promotion record");
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "promotion record") : null;
    })(),
    registryEntryPath: (() => {
      const value = extractBulletValue(content, "Registry entry");
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "registry entry") : null;
    })(),
  };
}

export function readGenericLegacyRuntimeRecordArtifact(input: {
  directiveRoot: string;
  runtimeRecordPath: string;
}): GenericLegacyRuntimeRecordArtifact {
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

  return {
    candidateId: requiredString(
      extractBulletValue(content, "Candidate id")
        ?? deriveLegacyRuntimeRecordCandidateId(runtimeRecordRelativePath),
      "candidate id",
    ),
    candidateName: extractBulletValue(content, "Candidate name")
      ?? requiredString(deriveRuntimeCandidateNameFromTitle(title), "candidate name"),
    runtimeRecordRelativePath,
    originPath: normalizeLegacyRuntimeOptionalArtifactPath({
      directiveRoot: input.directiveRoot,
      value: extractBulletValue(content, "Origin path"),
      label: "origin path",
    }),
    linkedFollowUpPath: (() => {
      const value = extractBulletValue(content, "Linked follow-up record");
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "linked follow-up record") : null;
    })(),
    runtimeObjective: requiredString(extractBulletValue(content, "Runtime objective"), "runtime objective"),
    proposedHost: extractBulletValue(content, "Proposed host"),
    proposedRuntimeSurface: extractBulletValue(content, "Proposed runtime surface"),
    executionSlice: extractBulletValue(content, "Execution slice"),
    currentStatus: requiredString(extractBulletValue(content, "Current status"), "current status"),
    nextDecisionPoint: extractBulletValue(content, "Next decision point"),
  };
}

export function readGenericLegacyRuntimeSliceProofArtifact(input: {
  directiveRoot: string;
  runtimeSliceProofPath: string;
}): GenericLegacyRuntimeSliceProofArtifact {
  const runtimeSliceProofRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.runtimeSliceProofPath,
    "runtimeSliceProofPath",
  );
  const absolutePath = path.join(input.directiveRoot, runtimeSliceProofRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: runtimeSliceProofPath not found: ${runtimeSliceProofRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);
  const explicitLinkedRuntimeRecordPath = normalizeLegacyRuntimeOptionalArtifactPath({
    directiveRoot: input.directiveRoot,
    value: extractBulletValue(content, "Linked Runtime record")
      ?? extractColonValue(content, "Linked Runtime record"),
    label: "linked runtime record",
  });
  const inferredLinkedRuntimeRecordPath = (() => {
    const inferred = inferLegacyRuntimeRecordPathFromSliceProof(runtimeSliceProofRelativePath);
    return fileExistsInDirectiveWorkspace(input.directiveRoot, inferred) ? inferred : null;
  })();

  return {
    candidateId: requiredString(
      stripInlineBackticks(
        extractBulletValue(content, "Candidate id")
          ?? extractColonValue(content, "Candidate id")
          ?? deriveLegacyRuntimeSliceProofCandidateId(runtimeSliceProofRelativePath),
      ),
      "candidate id",
    ),
    candidateName: stripInlineBackticks(
      extractBulletValue(content, "Candidate name")
        ?? extractColonValue(content, "Candidate name"),
    ) ?? requiredString(deriveLegacyRuntimeSliceProofCandidateName(title), "candidate name"),
    runtimeSliceProofRelativePath,
    proofDate: stripInlineBackticks(
      extractBulletValue(content, "Proof date")
        ?? extractColonValue(content, "Proof date")
        ?? extractBulletValue(content, "Runtime slice date")
        ?? extractColonValue(content, "Runtime slice date")
        ?? extractBulletValue(content, "Date")
        ?? extractColonValue(content, "Date"),
    ),
    linkedRuntimeRecordPath: explicitLinkedRuntimeRecordPath ?? inferredLinkedRuntimeRecordPath,
    linkedExecutionRecordPath: normalizeLegacyRuntimeOptionalArtifactPath({
      directiveRoot: input.directiveRoot,
      value: extractBulletValue(content, "Linked execution record")
        ?? extractColonValue(content, "Linked execution record"),
      label: "linked execution record",
    }),
    primaryHostChecker: stripInlineBackticks(
      extractBulletValue(content, "Primary host checker")
        ?? extractColonValue(content, "Primary host checker"),
    ),
    promotionProfileFamily: stripInlineBackticks(
      extractBulletValue(content, "Promotion profile family")
        ?? extractColonValue(content, "Promotion profile family"),
    ),
    result: stripInlineBackticks(
      extractBulletValue(content, "Result")
        ?? extractColonValue(content, "Result")
        ?? extractBulletValue(content, "Status")
        ?? extractColonValue(content, "Status"),
    ),
  };
}

export function readGenericLegacyRuntimeSliceExecutionArtifact(input: {
  directiveRoot: string;
  runtimeSliceExecutionPath: string;
}): GenericLegacyRuntimeSliceExecutionArtifact {
  const runtimeSliceExecutionRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.runtimeSliceExecutionPath,
    "runtimeSliceExecutionPath",
  );
  const absolutePath = path.join(input.directiveRoot, runtimeSliceExecutionRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: runtimeSliceExecutionPath not found: ${runtimeSliceExecutionRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);
  const inferredLinkedRuntimeProofPath = (() => {
    const inferred = inferLegacyRuntimeSliceProofPathFromExecution(runtimeSliceExecutionRelativePath);
    return inferred && fileExistsInDirectiveWorkspace(input.directiveRoot, inferred) ? inferred : null;
  })();

  return {
    candidateId: requiredString(
      stripInlineBackticks(
        extractBulletValue(content, "Candidate id")
          ?? extractColonValue(content, "Candidate id")
          ?? deriveLegacyRuntimeSliceExecutionCandidateId(runtimeSliceExecutionRelativePath),
      ),
      "candidate id",
    ),
    candidateName: stripInlineBackticks(
      extractBulletValue(content, "Candidate name")
        ?? extractColonValue(content, "Candidate name"),
    ) ?? requiredString(deriveLegacyRuntimeSliceExecutionCandidateName(title), "candidate name"),
    runtimeSliceExecutionRelativePath,
    executionDate: stripInlineBackticks(
      extractBulletValue(content, "Execution date")
        ?? extractColonValue(content, "Execution date")
        ?? extractBulletValue(content, "Date")
        ?? extractColonValue(content, "Date"),
    ),
    linkedRuntimeProofPath: inferredLinkedRuntimeProofPath,
    status: stripInlineBackticks(
      extractBulletValue(content, "Status")
        ?? extractColonValue(content, "Status")
        ?? extractBulletValue(content, "Outcome")
        ?? extractColonValue(content, "Outcome"),
    ),
  };
}

export function readGenericLegacyRuntimeProofChecklistArtifact(input: {
  directiveRoot: string;
  proofChecklistPath: string;
}): GenericLegacyRuntimeProofChecklistArtifact {
  const proofChecklistRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.proofChecklistPath,
    "proofChecklistPath",
  );
  const absolutePath = path.join(input.directiveRoot, proofChecklistRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: proofChecklistPath not found: ${proofChecklistRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);
  const normalizedContent = content.replace(/\\/g, "/");
  const referencedMarkdownPaths = [...new Set(
    [...normalizedContent.matchAll(/runtime\/records\/[^`\r\n]+\.md/gu)]
      .map((match) => normalizeRelativePath(match[0])),
  )];
  const linkedRuntimeRecordPath = (() => {
    const value = stripInlineBackticks(
      extractBulletValue(content, "source_experiment_design_artifact")
        ?? extractColonValue(content, "source_experiment_design_artifact"),
    );
    return value
      ? resolveDirectiveRelativePath(input.directiveRoot, value, "source experiment design artifact")
      : null;
  })();
  const linkedProofPaths = referencedMarkdownPaths.filter((relativePath) =>
    relativePath.endsWith("-proof.md") || relativePath.endsWith("-live-fetch-proof.md")
  );
  const linkedRuntimeProofPath =
    linkedProofPaths.find((relativePath) => relativePath.endsWith("-runtime-slice-01-proof.md"))
    ?? linkedProofPaths[0]
    ?? null;
  const linkedSupplementalProofPath =
    linkedProofPaths.find((relativePath) => relativePath !== linkedRuntimeProofPath)
    ?? null;

  return {
    candidateId: requiredString(
      stripInlineBackticks(
        extractBulletValue(content, "capability_id")
          ?? extractColonValue(content, "capability_id")
          ?? deriveLegacyRuntimeProofChecklistCandidateId(proofChecklistRelativePath),
      ),
      "capability_id",
    ),
    candidateName: stripInlineBackticks(
      extractBulletValue(content, "capability_name")
        ?? extractColonValue(content, "capability_name"),
    ) ?? requiredString(deriveLegacyRuntimeProofChecklistCandidateName(title), "capability_name"),
    proofChecklistRelativePath,
    generatedAt: stripInlineBackticks(
      extractBulletValue(content, "generated_at")
        ?? extractColonValue(content, "generated_at")
        ?? extractBulletValue(content, "Date")
        ?? extractColonValue(content, "Date"),
    ),
    linkedRuntimeRecordPath,
    linkedRuntimeProofPath,
    linkedSupplementalProofPath,
    gateSnapshotPath: (() => {
      const value = stripInlineBackticks(
        extractBulletValue(content, "gate_snapshot")
          ?? extractColonValue(content, "gate_snapshot"),
      );
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "gate snapshot") : null;
    })(),
    status: stripInlineBackticks(
      extractBulletValue(content, "status")
        ?? extractColonValue(content, "status"),
    ),
  };
}

export function readGenericLegacyRuntimeLiveFetchProofArtifact(input: {
  directiveRoot: string;
  liveFetchProofPath: string;
}): GenericLegacyRuntimeLiveFetchProofArtifact {
  const liveFetchProofRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.liveFetchProofPath,
    "liveFetchProofPath",
  );
  const absolutePath = path.join(input.directiveRoot, liveFetchProofRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: liveFetchProofPath not found: ${liveFetchProofRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);
  const normalizedContent = content.replace(/\\/g, "/");
  const linkedRuntimeRecordPath = (() => {
    const value = stripInlineBackticks(
      extractNestedBulletValue(content, "Linked Runtime record")
        ?? extractBulletValue(content, "Linked Runtime record")
        ?? extractColonValue(content, "Linked Runtime record"),
    );
    return value
      ? resolveDirectiveRelativePath(input.directiveRoot, value, "linked runtime record")
      : null;
  })();
  const linkedProofChecklistPath = (() => {
    const value = stripInlineBackticks(
      extractNestedBulletValue(content, "Linked proof checklist")
        ?? extractBulletValue(content, "Linked proof checklist")
        ?? extractColonValue(content, "Linked proof checklist"),
    );
    return value
      ? resolveDirectiveRelativePath(input.directiveRoot, value, "linked proof checklist")
      : null;
  })();
  const gateSnapshotPath = (() => {
    const nestedValue = stripInlineBackticks(extractNestedBulletValue(content, "Snapshot JSON"));
    if (nestedValue) {
      return resolveDirectiveRelativePath(input.directiveRoot, nestedValue, "gate snapshot");
    }
    const match = normalizedContent.match(/runtime\/records\/[^`\r\n]+-gate-snapshot\.json/iu);
    return match ? normalizeRelativePath(match[0]) : null;
  })();

  return {
    candidateId: requiredString(
      stripInlineBackticks(
        extractBulletValue(content, "Candidate id")
          ?? extractColonValue(content, "Candidate id")
          ?? deriveLegacyRuntimeLiveFetchProofCandidateId(liveFetchProofRelativePath),
      ),
      "candidate id",
    ),
    candidateName: requiredString(
      deriveLegacyRuntimeLiveFetchProofCandidateName(title),
      "candidate name",
    ),
    liveFetchProofRelativePath,
    proofDate: stripInlineBackticks(
      extractBulletValue(content, "Date")
        ?? extractColonValue(content, "Date"),
    ),
    linkedRuntimeRecordPath,
    linkedProofChecklistPath,
    gateSnapshotPath,
    result: stripInlineBackticks(
      extractBulletValue(content, "Result")
        ?? extractColonValue(content, "Result"),
    ),
  };
}

export function readGenericLegacyRuntimeLiveFetchGateSnapshotArtifact(input: {
  directiveRoot: string;
  gateSnapshotPath: string;
}): GenericLegacyRuntimeLiveFetchGateSnapshotArtifact {
  const gateSnapshotRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.gateSnapshotPath,
    "gateSnapshotPath",
  );
  const absolutePath = path.join(input.directiveRoot, gateSnapshotRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: gateSnapshotPath not found: ${gateSnapshotRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const candidateId = requiredString(
    optionalUnknownString(parsed.candidate_id)
      ?? optionalUnknownString(parsed.candidateId)
      ?? deriveLegacyRuntimeLiveFetchGateSnapshotCandidateId(gateSnapshotRelativePath),
    "candidate id",
  );
  const inferredLinkedLiveFetchProofPath = inferLegacyRuntimeLiveFetchProofPathFromGateSnapshot(
    gateSnapshotRelativePath,
  );

  return {
    candidateId,
    candidateName: humanizeSlugIdentifier(candidateId),
    gateSnapshotRelativePath,
    generatedAt: optionalUnknownString(parsed.generated_at) ?? optionalUnknownString(parsed.generatedAt),
    workflowSurface: optionalUnknownString(parsed.workflow_surface) ?? optionalUnknownString(parsed.workflowSurface),
    deliveryTarget: optionalUnknownString(parsed.delivery_target) ?? optionalUnknownString(parsed.deliveryTarget),
    linkedLiveFetchProofPath: fileExistsInDirectiveWorkspace(input.directiveRoot, inferredLinkedLiveFetchProofPath)
      ? inferredLinkedLiveFetchProofPath
      : null,
  };
}

export function readGenericLegacyRuntimeLivePoolArtifact(input: {
  directiveRoot: string;
  livePoolPath: string;
}): GenericLegacyRuntimeLivePoolArtifact {
  const livePoolRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.livePoolPath,
    "livePoolPath",
  );
  const absolutePath = path.join(input.directiveRoot, livePoolRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: livePoolPath not found: ${livePoolRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const candidateId = requiredString(
    optionalUnknownString(parsed.candidate_id)
      ?? optionalUnknownString(parsed.candidateId)
      ?? deriveLegacyRuntimeLivePoolCandidateId(livePoolRelativePath),
    "candidate id",
  );
  const inferredGateSnapshotPath = inferLegacyRuntimeLiveFetchGateSnapshotPathFromLivePool(
    livePoolRelativePath,
  );
  const linkedGateSnapshotPath = fileExistsInDirectiveWorkspace(input.directiveRoot, inferredGateSnapshotPath)
    ? inferredGateSnapshotPath
    : null;

  return {
    candidateId,
    candidateName: humanizeSlugIdentifier(candidateId),
    livePoolRelativePath,
    artifactType: optionalUnknownString(parsed.artifact_type) ?? optionalUnknownString(parsed.artifactType),
    generatedAt: optionalUnknownString(parsed.generated_at) ?? optionalUnknownString(parsed.generatedAt),
    degraded: parsed.degraded === true,
    evidenceQualityResult:
      optionalUnknownString(parsed.evidence_quality_result) ?? optionalUnknownString(parsed.evidenceQualityResult),
    deliveryTarget: optionalUnknownString(parsed.delivery_target) ?? optionalUnknownString(parsed.deliveryTarget),
    withheldDelivery:
      typeof parsed.withheld_delivery === "boolean"
        ? parsed.withheld_delivery
        : typeof parsed.withheldDelivery === "boolean"
          ? parsed.withheldDelivery
          : null,
    linkedGateSnapshotPath,
    linkedLiveFetchProofPath: linkedGateSnapshotPath
      ? inferLegacyRuntimeLiveFetchProofPathFromGateSnapshot(linkedGateSnapshotPath)
      : null,
  };
}

export function readGenericLegacyRuntimeSamplePoolArtifact(input: {
  directiveRoot: string;
  samplePoolPath: string;
}): GenericLegacyRuntimeSamplePoolArtifact {
  const samplePoolRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.samplePoolPath,
    "samplePoolPath",
  );
  const absolutePath = path.join(input.directiveRoot, samplePoolRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: samplePoolPath not found: ${samplePoolRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const candidateId = requiredString(
    optionalUnknownString(parsed.candidate_id)
      ?? optionalUnknownString(parsed.candidateId)
      ?? deriveLegacyRuntimeSamplePoolCandidateId(samplePoolRelativePath),
    "candidate id",
  );

  return {
    candidateId,
    candidateName: humanizeSlugIdentifier(candidateId),
    samplePoolRelativePath,
    artifactType: optionalUnknownString(parsed.artifact_type) ?? optionalUnknownString(parsed.artifactType),
    generatedAt: optionalUnknownString(parsed.generated_at) ?? optionalUnknownString(parsed.generatedAt),
    degraded: parsed.degraded === true,
    evidenceQualityResult:
      optionalUnknownString(parsed.evidence_quality_result) ?? optionalUnknownString(parsed.evidenceQualityResult),
    deliveryTarget: optionalUnknownString(parsed.delivery_target) ?? optionalUnknownString(parsed.deliveryTarget),
    withheldDelivery:
      typeof parsed.withheld_delivery === "boolean"
        ? parsed.withheld_delivery
        : typeof parsed.withheldDelivery === "boolean"
          ? parsed.withheldDelivery
          : null,
  };
}

export function readGenericLegacyRuntimeSystemBundleArtifact(input: {
  directiveRoot: string;
  systemBundlePath: string;
}): GenericLegacyRuntimeSystemBundleArtifact {
  const systemBundleRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.systemBundlePath,
    "systemBundlePath",
  );
  const absolutePath = path.join(input.directiveRoot, systemBundleRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: systemBundlePath not found: ${systemBundleRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);
  const candidateId = requiredString(
    deriveLegacyRuntimeSystemBundleCandidateId(systemBundleRelativePath),
    "candidate id",
  );

  return {
    candidateId,
    candidateName:
      deriveLegacyRuntimeSystemBundleCandidateName(title)
      || humanizeSlugIdentifier(candidateId),
    systemBundleRelativePath,
    bundleDate: extractBulletValue(content, "Date"),
    owner: extractBulletValue(content, "Owner"),
    status: extractBulletValue(content, "Status"),
    decisionState: extractBulletValue(content, "Decision state"),
    adoptionTarget: extractBulletValue(content, "Adoption target"),
    nextStep:
      extractBulletValue(content, "Next active work")
      ?? extractBulletValue(content, "Next bounded candidate")
      ?? extractBulletValue(content, "Next"),
  };
}

export function readGenericLegacyRuntimeValidationNoteArtifact(input: {
  directiveRoot: string;
  validationNotePath: string;
}): GenericLegacyRuntimeValidationNoteArtifact {
  const validationNoteRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.validationNotePath,
    "validationNotePath",
  );
  const absolutePath = path.join(input.directiveRoot, validationNoteRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: validationNotePath not found: ${validationNoteRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  return {
    candidateId: requiredString(
      deriveLegacyRuntimeValidationNoteCandidateId(validationNoteRelativePath),
      "candidate id",
    ),
    candidateName: requiredString(extractTitle(content), "candidate name"),
    validationNoteRelativePath,
    noteDate: extractBulletValue(content, "Date"),
    mode: extractBulletValue(content, "Mode"),
    verdict: extractBulletValue(content, "verdict"),
    blocker: extractMarkdownSectionSummary(content, "Blocker"),
  };
}

export function readGenericLegacyRuntimePreconditionDecisionNoteArtifact(input: {
  directiveRoot: string;
  notePath: string;
}): GenericLegacyRuntimePreconditionDecisionNoteArtifact {
  const noteRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.notePath,
    "notePath",
  );
  const absolutePath = path.join(input.directiveRoot, noteRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: notePath not found: ${noteRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);
  const noteKind =
    noteRelativePath.endsWith("-cli-precondition-proof.md")
      ? "precondition_proof"
      : noteRelativePath.endsWith("-precondition-correction.md")
        ? "precondition_correction"
        : "host_adapter_decision";
  const linkedFollowUpRaw =
    extractBulletValue(content, "Linked follow-up record")
    ?? extractMarkdownSectionSummary(content, "Source Follow-up");
  const linkedFollowUpPath = normalizeLegacyRuntimeOptionalArtifactPath({
    directiveRoot: input.directiveRoot,
    value: linkedFollowUpRaw,
    label: "linked follow-up record",
  });

  return {
    candidateId: requiredString(
      deriveLegacyRuntimePreconditionDecisionNoteCandidateId(noteRelativePath),
      "candidate id",
    ),
    candidateName: requiredString(
      deriveLegacyRuntimePreconditionDecisionNoteCandidateName(title),
      "candidate name",
    ),
    noteRelativePath,
    noteKind,
    noteDate: extractBulletValue(content, "Date") ?? extractBulletValue(content, "Runtime record date"),
    status: extractBulletValue(content, "Status") ?? extractBulletValue(content, "Current Status"),
    linkedFollowUpPath,
  };
}

export function readGenericLegacyRuntimeTransformationRecordArtifact(input: {
  directiveRoot: string;
  transformationRecordPath: string;
}): GenericLegacyRuntimeTransformationRecordArtifact {
  const transformationRecordRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.transformationRecordPath,
    "transformationRecordPath",
  );
  const absolutePath = path.join(input.directiveRoot, transformationRecordRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: transformationRecordPath not found: ${transformationRecordRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);

  return {
    candidateId: requiredString(
      extractBulletValue(content, "Candidate id")
        ?? deriveLegacyRuntimeTransformationCandidateId(transformationRecordRelativePath),
      "candidate id",
    ),
    candidateName: extractBulletValue(content, "Candidate name")
      ?? requiredString(deriveLegacyRuntimeTransformationCandidateName(title), "candidate name"),
    transformationRecordRelativePath,
    recordDate: extractBulletValue(content, "Record date"),
    transformationType: requiredString(extractBulletValue(content, "Transformation type"), "transformation type"),
    discoveryIntakePath: (() => {
      const value = extractBulletValue(content, "Discovery intake path");
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "discovery intake path") : null;
    })(),
    baselineArtifactPath: normalizeLegacyRuntimeTransformationArtifactPath({
      directiveRoot: input.directiveRoot,
      value: extractBulletValue(content, "Baseline artifact path"),
      label: "baseline artifact path",
    }),
    resultArtifactPath: normalizeLegacyRuntimeTransformationArtifactPath({
      directiveRoot: input.directiveRoot,
      value: extractBulletValue(content, "Result artifact path"),
      label: "result artifact path",
    }),
    adoptionTarget: extractBulletValue(content, "Adoption target"),
    promotionRecordPath: (() => {
      const value = extractBulletValue(content, "Promotion record (if promoted)");
      return value && !/^(n\/a|none)\b/i.test(value)
        ? resolveDirectiveRelativePath(input.directiveRoot, value, "promotion record")
        : null;
    })(),
  };
}

export function readGenericLegacyRuntimeTransformationProofArtifact(input: {
  directiveRoot: string;
  transformationProofPath: string;
}): GenericLegacyRuntimeTransformationProofArtifact {
  const transformationProofRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.transformationProofPath,
    "transformationProofPath",
  );
  const absolutePath = path.join(input.directiveRoot, transformationProofRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: transformationProofPath not found: ${transformationProofRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const baselineMeasurement = (parsed.baseline_measurement ?? parsed.baseline) as Record<string, unknown> | undefined;

  return {
    candidateId: requiredString(
      optionalUnknownString(parsed.candidateId)
        ?? optionalUnknownString(parsed.candidate_id)
        ?? deriveLegacyRuntimeTransformationCandidateId(transformationProofRelativePath),
      "candidate id",
    ),
    transformationProofRelativePath,
    generatedAt: optionalUnknownString(parsed.generatedAt) ?? optionalUnknownString(parsed.generated_at),
    transformationType: optionalUnknownString(parsed.transformationType) ?? optionalUnknownString(parsed.transformation_type),
    metric: optionalUnknownString(parsed.metric) ?? optionalUnknownString(baselineMeasurement?.metric),
    linkedTransformationRecordPath: inferLegacyRuntimeTransformationRecordPath(transformationProofRelativePath),
  };
}

export function readGenericLegacyRuntimeRegistryArtifact(input: {
  directiveRoot: string;
  registryEntryPath: string;
}): GenericLegacyRuntimeRegistryArtifact {
  const registryEntryRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.registryEntryPath,
    "registryEntryPath",
  );
  const absolutePath = path.join(input.directiveRoot, registryEntryRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: registryEntryPath not found: ${registryEntryRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);

  return {
    candidateId: requiredString(
      extractBulletValue(content, "Candidate id")
        ?? deriveLegacyRuntimeRegistryCandidateId(registryEntryRelativePath),
      "candidate id",
    ),
    candidateName: extractBulletValue(content, "Candidate name")
      ?? requiredString(deriveLegacyRuntimeRegistryCandidateName(title), "candidate name"),
    registryEntryRelativePath,
    linkedPromotionRecordPath: (() => {
      const value = extractBulletValue(content, "Linked promotion record")
        ?? extractBulletValue(content, "Promotion artifact");
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "linked promotion record") : null;
    })(),
    proofArtifactPath: (() => {
      const value = extractBulletValue(content, "Proof path")
        ?? extractBulletValue(content, "Proof artifact");
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "proof artifact") : null;
    })(),
    proposedHost: extractBulletValue(content, "Host"),
    runtimeSurface: extractBulletValue(content, "Runtime surface")
      ?? extractBulletValue(content, "Target file"),
    runtimeStatus: requiredString(extractBulletValue(content, "Runtime status"), "runtime status"),
    registryAcceptanceGateVersion: stripInlineBackticks(extractBulletValue(content, "Gate version")),
  };
}

export function readGenericLegacyRuntimePromotionRecordArtifact(input: {
  directiveRoot: string;
  promotionRecordPath: string;
}): GenericLegacyRuntimePromotionRecordArtifact {
  const promotionRecordRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.promotionRecordPath,
    "promotionRecordPath",
  );
  const absolutePath = path.join(input.directiveRoot, promotionRecordRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: promotionRecordPath not found: ${promotionRecordRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  const title = extractTitle(content);

  return {
    candidateId: requiredString(
      extractBulletValue(content, "Candidate id")
        ?? deriveLegacyRuntimePromotionRecordCandidateId(promotionRecordRelativePath),
      "candidate id",
    ),
    candidateName: extractBulletValue(content, "Candidate name")
      ?? requiredString(deriveLegacyRuntimePromotionRecordCandidateName(title), "candidate name"),
    promotionRecordRelativePath,
    linkedRuntimeRecordPath: (() => {
      const value = extractBulletValue(content, "Linked Runtime record");
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "linked runtime record") : null;
    })(),
    sourceIntentArtifactPath: (() => {
      const value = extractBulletValue(content, "Source intent artifact");
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "source intent artifact") : null;
    })(),
    proofArtifactPath: (() => {
      const value = extractBulletValue(content, "Proof path");
      return value ? resolveDirectiveRelativePath(input.directiveRoot, value, "proof artifact") : null;
    })(),
    targetHost: extractBulletValue(content, "Target host"),
    targetRuntimeSurface: extractBulletValue(content, "Target runtime surface"),
    proposedRuntimeStatus: requiredString(
      extractBulletValue(content, "Proposed runtime status"),
      "proposed runtime status",
    ),
  };
}

export function readGenericDiscoveryMonitorArtifact(input: {
  directiveRoot: string;
  monitorPath: string;
}): GenericDiscoveryMonitorArtifact {
  const monitorRelativePath = resolveDirectiveRelativePath(
    input.directiveRoot,
    input.monitorPath,
    "monitorPath",
  );
  const absolutePath = path.join(input.directiveRoot, monitorRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: monitorPath not found: ${monitorRelativePath}`);
  }

  const content = readUtf8(absolutePath);
  return {
    candidateId: requiredString(extractBulletValue(content, "Candidate id"), "candidate id"),
    candidateName: requiredString(extractBulletValue(content, "Candidate name"), "candidate name"),
    monitorRelativePath,
    currentDecisionState: requiredString(
      extractBulletValue(content, "Current decision state"),
      "current decision state",
    ),
    whyKeptInMonitor: requiredString(extractBulletValue(content, "Why kept in monitor"), "why kept in monitor"),
    reviewCadence: extractBulletValue(content, "Review cadence"),
    nextReviewDate: extractBulletValue(content, "Next review date"),
    linkedIntakeRecord: resolveDirectiveRelativePath(
      input.directiveRoot,
      requiredString(extractBulletValue(content, "Linked intake record"), "linked intake record"),
      "linked intake record",
    ),
    linkedTriageRecord: (() => {
      const triagePath = extractBulletValue(content, "Linked triage record");
      return triagePath ? resolveDirectiveRelativePath(input.directiveRoot, triagePath, "linked triage record") : null;
    })(),
    linkedRoutingRecord: resolveDirectiveRelativePath(
      input.directiveRoot,
      requiredString(extractBulletValue(content, "Linked routing record"), "linked routing record"),
      "linked routing record",
    ),
  };
}

