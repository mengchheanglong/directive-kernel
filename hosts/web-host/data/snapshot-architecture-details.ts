import fs from "node:fs";
import path from "node:path";

import { normalizeRelativePath } from "../../../shared/lib/path-normalization.ts";
import {
  readDirectiveArchitectureImplementationTargetDetail,
  readDirectiveArchitectureImplementationTargetPathForAdoption,
} from "../../../architecture/lib/architecture-implementation-target.ts";
import {
  readDirectiveArchitectureImplementationResultDetail,
  readDirectiveArchitectureImplementationResultPathForTarget,
} from "../../../architecture/lib/architecture-implementation-result.ts";
import {
  readDirectiveArchitectureRetentionDetail,
} from "../../../architecture/lib/architecture-retention.ts";
import {
  readDirectiveArchitectureIntegrationRecordDetail,
} from "../../../architecture/lib/architecture-integration-record.ts";
import {
  readDirectiveArchitectureConsumptionRecordDetail,
} from "../../../architecture/lib/architecture-consumption-record.ts";
import {
  readDirectiveArchitecturePostConsumptionEvaluationDetail,
} from "../../../architecture/lib/architecture-post-consumption-evaluation.ts";
import { resolveDirectiveWorkspaceState } from "../../../engine/state/index.ts";
import {
  resolveDirectiveWorkspaceArtifactAbsolutePath,
} from "../../../engine/state/artifact-storage.ts";
import {
  ARCHITECTURE_DEEP_TAIL_STAGE,
  matchesArchitectureDeepTailStagePath,
  type ArchitectureDeepTailStageId,
} from "../../../architecture/lib/control/architecture-deep-tail-stage-map.ts";
import { buildDirectiveFrontendCurrentHead } from "./shared.ts";
import type {
  DirectiveFrontendArchitectureConsumptionRecordDetail,
  DirectiveFrontendArchitectureImplementationResultDetail,
  DirectiveFrontendArchitectureImplementationTargetDetail,
  DirectiveFrontendArchitectureIntegrationRecordDetail,
  DirectiveFrontendArchitecturePostConsumptionEvaluationDetail,
  DirectiveFrontendArchitectureRetentionDetail,
} from "./snapshot.ts";

type ArtifactText = {
  relativePath: string;
  absolutePath: string;
  content: string;
};

type SnapshotArchitectureHelpers = {
  readDirectiveFrontendArtifactText: (input: {
    directiveRoot: string;
    relativePath: string;
  }) => ArtifactText;
};

function extractMarkdownTitleOrFilename(content: string, relativePath: string) {
  return content.split(/\r?\n/).find((line) => line.startsWith("# "))?.replace(/^# /, "").trim()
    || path.basename(relativePath);
}

type DirectiveFrontendArchitectureDeepTailError = {
  ok: false;
  error: string;
  relativePath: string;
};

function readExistingArchitectureDeepTailPath(input: {
  directiveRoot: string;
  sourceRelativePath: string;
  sourceStage: ArchitectureDeepTailStageId;
  targetStage: ArchitectureDeepTailStageId;
  sourceSuffix?: string;
  targetSuffix?: string;
}) {
  try {
    const fileName = path.posix.basename(input.sourceRelativePath);
    const sourceStage = ARCHITECTURE_DEEP_TAIL_STAGE[input.sourceStage];
    const sourceSuffix = input.sourceSuffix ?? sourceStage.artifactSuffix;
    if (!fileName.endsWith(sourceSuffix)) {
      return null;
    }

    const targetStage = ARCHITECTURE_DEEP_TAIL_STAGE[input.targetStage];
    const candidateRelativePath = path.posix.join(
      targetStage.relativeDir,
      fileName.replace(
        new RegExp(`${escapeRegExp(sourceSuffix)}$`, "u"),
        input.targetSuffix ?? targetStage.artifactSuffix,
      ),
    );
    const absolutePath = resolveDirectiveWorkspaceArtifactAbsolutePath({
      directiveRoot: input.directiveRoot,
      relativePath: candidateRelativePath,
      mode: "read",
    });

    return fs.existsSync(absolutePath) ? normalizeRelativePath(candidateRelativePath) : null;
  } catch {
    return null;
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readDirectiveArchitectureReopenedStartPathForEvaluation(input: {
  directiveRoot: string;
  evaluationRelativePath: string;
}) {
  const startsRoot = path.join(input.directiveRoot, "architecture", "01-experiments");
  if (!fs.existsSync(startsRoot)) {
    return null;
  }

  const fileName = path.basename(input.evaluationRelativePath);
  if (!fileName.endsWith("-evaluation.md")) {
    return null;
  }

  const candidate = fileName.replace(/-evaluation\.md$/u, "-reopened-bounded-start.md");
  const absolute = path.join(startsRoot, candidate);
  if (!fs.existsSync(absolute)) {
    return null;
  }

  return normalizeRelativePath(path.join("architecture", "01-experiments", candidate));
}

function readDirectiveFrontendArchitectureDeepTailDetail<
  TDetail extends { ok: true; relativePath: string } | DirectiveFrontendArchitectureDeepTailError,
  TSuccess extends Extract<TDetail, { ok: true }> = Extract<TDetail, { ok: true }>,
>(input: {
  directiveRoot: string;
  relativePath: string;
  stage: ArchitectureDeepTailStageId;
  invalidPathError: string;
  focusError: string;
  readDetail: (relativePath: string) => Record<string, unknown>;
  absolutePath: (detail: Record<string, unknown>) => string;
  buildSuccess: (detail: Record<string, unknown>, context: {
    directiveRoot: string;
    relativePath: string;
    focus: NonNullable<ReturnType<typeof resolveDirectiveWorkspaceState>["focus"]>;
  }) => Omit<TSuccess, "ok" | "relativePath" | "absolutePath" | "artifactStage" | "artifactNextLegalStep" | "currentStage" | "nextLegalStep" | "currentHead">;
}): TDetail {
  const relativePath = normalizeRelativePath(String(input.relativePath || "").trim());
  if (!relativePath) {
    return {
      ok: false,
      error: "missing_relative_path",
      relativePath,
    } as unknown as TDetail;
  }

  const stage = ARCHITECTURE_DEEP_TAIL_STAGE[input.stage];
  if (!matchesArchitectureDeepTailStagePath(stage, relativePath) || !relativePath.endsWith(".md")) {
    return {
      ok: false,
      error: input.invalidPathError,
      relativePath,
    } as unknown as TDetail;
  }

  try {
    const focus = resolveDirectiveWorkspaceState({
      directiveRoot: input.directiveRoot,
      artifactPath: relativePath,
      includeAnchors: false,
    }).focus;
    const detail = input.readDetail(relativePath);

    if (!focus || focus.lane !== "architecture") {
      throw new Error(input.focusError);
    }

    return {
      ok: true,
      relativePath,
      absolutePath: input.absolutePath(detail),
      artifactStage: focus.artifactStage,
      artifactNextLegalStep: focus.artifactNextLegalStep,
      currentStage: focus.currentStage,
      nextLegalStep: focus.nextLegalStep,
      currentHead: buildDirectiveFrontendCurrentHead(focus.currentHead),
      ...input.buildSuccess(detail, {
        directiveRoot: input.directiveRoot,
        relativePath,
        focus,
      }),
    } as unknown as TDetail;
  } catch (error) {
    return {
      ok: false,
      error: String((error as Error).message || error),
      relativePath,
    } as TDetail;
  }
}

export function readDirectiveFrontendArchitectureImplementationTargetDetail(
  input: {
    directiveRoot: string;
    relativePath: string;
  },
): DirectiveFrontendArchitectureImplementationTargetDetail {
  return readDirectiveFrontendArchitectureDeepTailDetail<DirectiveFrontendArchitectureImplementationTargetDetail>({
    directiveRoot: input.directiveRoot,
    relativePath: input.relativePath,
    stage: "implementation_target",
    invalidPathError: "invalid_implementation_target_path",
    focusError: "architecture_implementation_target_focus_not_resolved",
    readDetail: (relativePath) => readDirectiveArchitectureImplementationTargetDetail({
      directiveRoot: input.directiveRoot,
      targetPath: relativePath,
    }),
    absolutePath: (detail) => String(detail.targetAbsolutePath),
    buildSuccess: (detail, context) => ({
      title: extractMarkdownTitleOrFilename(String(detail.content), context.relativePath),
      candidateId: String(detail.candidateId),
      candidateName: String(detail.candidateName),
      usefulnessLevel: String(detail.usefulnessLevel),
      artifactType: String(detail.artifactType),
      finalStatus: String(detail.finalStatus),
      objective: String(detail.objective),
      expectedOutcome: String(detail.expectedOutcome),
      selectedBoundedSlice: detail.selectedBoundedSlice as string[],
      mechanicalSuccessCriteria: detail.mechanicalSuccessCriteria as string[],
      explicitLimitations: detail.explicitLimitations as string[],
      sourceAdoptionVerdict: String(detail.sourceAdoptionVerdict),
      sourceReadinessPassed: Boolean(detail.sourceReadinessPassed),
      sourceFailedReadinessChecks: detail.sourceFailedReadinessChecks as string[],
      sourceRuntimeHandoffRequired: Boolean(detail.sourceRuntimeHandoffRequired),
      sourceRuntimeHandoffRationale: String(detail.sourceRuntimeHandoffRationale),
      sourceArtifactPath: String(detail.sourceArtifactPath),
      sourcePrimaryEvidencePath: String(detail.sourcePrimaryEvidencePath),
      sourceSelfImprovementCategory: String(detail.sourceSelfImprovementCategory),
      sourceSelfImprovementVerificationMethod: String(detail.sourceSelfImprovementVerificationMethod),
      sourceSelfImprovementVerificationResult: String(detail.sourceSelfImprovementVerificationResult),
      adoptionRelativePath: String(detail.adoptionRelativePath),
      decisionRelativePath: String(detail.decisionRelativePath),
      sourceResultRelativePath: String(detail.sourceResultRelativePath),
      implementationResultRelativePath: readDirectiveArchitectureImplementationResultPathForTarget({
        directiveRoot: context.directiveRoot,
        targetRelativePath: context.relativePath,
      }),
      content: String(detail.content),
    }),
  });
}

export function readDirectiveFrontendArchitectureImplementationResultDetail(
  input: {
    directiveRoot: string;
    relativePath: string;
  },
): DirectiveFrontendArchitectureImplementationResultDetail {
  return readDirectiveFrontendArchitectureDeepTailDetail<DirectiveFrontendArchitectureImplementationResultDetail>({
    directiveRoot: input.directiveRoot,
    relativePath: input.relativePath,
    stage: "implementation_result",
    invalidPathError: "invalid_implementation_result_path",
    focusError: "architecture_implementation_result_focus_not_resolved",
    readDetail: (relativePath) => readDirectiveArchitectureImplementationResultDetail({
      directiveRoot: input.directiveRoot,
      resultPath: relativePath,
    }),
    absolutePath: (detail) => String(detail.resultAbsolutePath),
    buildSuccess: (detail, context) => ({
      candidateId: String(detail.candidateId),
      candidateName: String(detail.candidateName),
      usefulnessLevel: String(detail.usefulnessLevel),
      objective: String(detail.objective),
      selectedBoundedSlice: detail.selectedBoundedSlice as string[],
      mechanicalSuccessCriteria: detail.mechanicalSuccessCriteria as string[],
      explicitLimitations: detail.explicitLimitations as string[],
      sourceAdoptionVerdict: String(detail.sourceAdoptionVerdict),
      sourceReadinessPassed: Boolean(detail.sourceReadinessPassed),
      sourceFailedReadinessChecks: detail.sourceFailedReadinessChecks as string[],
      sourceRuntimeHandoffRequired: Boolean(detail.sourceRuntimeHandoffRequired),
      sourceRuntimeHandoffRationale: String(detail.sourceRuntimeHandoffRationale),
      sourceArtifactPath: String(detail.sourceArtifactPath),
      sourcePrimaryEvidencePath: String(detail.sourcePrimaryEvidencePath),
      sourceSelfImprovementCategory: String(detail.sourceSelfImprovementCategory),
      sourceSelfImprovementVerificationMethod: String(detail.sourceSelfImprovementVerificationMethod),
      sourceSelfImprovementVerificationResult: String(detail.sourceSelfImprovementVerificationResult),
      outcome: detail.outcome as "success" | "failure",
      resultSummary: String(detail.resultSummary),
      validationResult: String(detail.validationResult),
      rollbackNote: String(detail.rollbackNote),
      targetRelativePath: String(detail.targetRelativePath),
      adoptionRelativePath: String(detail.adoptionRelativePath),
      sourceResultRelativePath: String(detail.sourceResultRelativePath),
      retainedRelativePath: readExistingArchitectureDeepTailPath({
        directiveRoot: context.directiveRoot,
        sourceRelativePath: context.relativePath,
        sourceStage: "implementation_result",
        targetStage: "retained",
      }),
      content: String(detail.content),
    }),
  });
}

export function readDirectiveFrontendArchitectureRetentionDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): DirectiveFrontendArchitectureRetentionDetail {
  return readDirectiveFrontendArchitectureDeepTailDetail<DirectiveFrontendArchitectureRetentionDetail>({
    directiveRoot: input.directiveRoot,
    relativePath: input.relativePath,
    stage: "retained",
    invalidPathError: "invalid_retained_path",
    focusError: "architecture_retention_focus_not_resolved",
    readDetail: (relativePath) => readDirectiveArchitectureRetentionDetail({
      directiveRoot: input.directiveRoot,
      retainedPath: relativePath,
    }),
    absolutePath: (detail) => String(detail.retainedAbsolutePath),
    buildSuccess: (detail, context) => ({
      candidateId: String(detail.candidateId),
      candidateName: String(detail.candidateName),
      usefulnessLevel: String(detail.usefulnessLevel),
      objective: String(detail.objective),
      stabilityLevel: String(detail.stabilityLevel),
      reuseScope: String(detail.reuseScope),
      confirmationDecision: String(detail.confirmationDecision),
      rollbackBoundary: String(detail.rollbackBoundary),
      resultRelativePath: String(detail.resultRelativePath),
      targetRelativePath: String(detail.targetRelativePath),
      adoptionRelativePath: String(detail.adoptionRelativePath),
      sourceResultRelativePath: String(detail.sourceResultRelativePath),
      integrationRecordRelativePath: readExistingArchitectureDeepTailPath({
        directiveRoot: context.directiveRoot,
        sourceRelativePath: context.relativePath,
        sourceStage: "retained",
        targetStage: "integration_record",
      }),
      content: String(detail.content),
    }),
  });
}

export function readDirectiveFrontendArchitectureIntegrationRecordDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): DirectiveFrontendArchitectureIntegrationRecordDetail {
  return readDirectiveFrontendArchitectureDeepTailDetail<DirectiveFrontendArchitectureIntegrationRecordDetail>({
    directiveRoot: input.directiveRoot,
    relativePath: input.relativePath,
    stage: "integration_record",
    invalidPathError: "invalid_integration_record_path",
    focusError: "architecture_integration_record_focus_not_resolved",
    readDetail: (relativePath) => readDirectiveArchitectureIntegrationRecordDetail({
      directiveRoot: input.directiveRoot,
      integrationPath: relativePath,
    }),
    absolutePath: (detail) => String(detail.integrationAbsolutePath),
    buildSuccess: (detail, context) => ({
      candidateId: String(detail.candidateId),
      candidateName: String(detail.candidateName),
      usefulnessLevel: String(detail.usefulnessLevel),
      objective: String(detail.objective),
      integrationTargetSurface: String(detail.integrationTargetSurface),
      readinessSummary: String(detail.readinessSummary),
      expectedEffect: String(detail.expectedEffect),
      validationBoundary: String(detail.validationBoundary),
      integrationDecision: String(detail.integrationDecision),
      rollbackBoundary: String(detail.rollbackBoundary),
      retainedRelativePath: String(detail.retainedRelativePath),
      resultRelativePath: String(detail.resultRelativePath),
      targetRelativePath: String(detail.targetRelativePath),
      adoptionRelativePath: String(detail.adoptionRelativePath),
      sourceResultRelativePath: String(detail.sourceResultRelativePath),
      consumptionRelativePath: readExistingArchitectureDeepTailPath({
        directiveRoot: context.directiveRoot,
        sourceRelativePath: context.relativePath,
        sourceStage: "integration_record",
        targetStage: "consumption_record",
        targetSuffix: "-consumption.md",
      }),
      content: String(detail.content),
    }),
  });
}

export function readDirectiveFrontendArchitectureConsumptionRecordDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): DirectiveFrontendArchitectureConsumptionRecordDetail {
  return readDirectiveFrontendArchitectureDeepTailDetail<DirectiveFrontendArchitectureConsumptionRecordDetail>({
    directiveRoot: input.directiveRoot,
    relativePath: input.relativePath,
    stage: "consumption_record",
    invalidPathError: "invalid_consumption_record_path",
    focusError: "architecture_consumption_record_focus_not_resolved",
    readDetail: (relativePath) => readDirectiveArchitectureConsumptionRecordDetail({
      directiveRoot: input.directiveRoot,
      consumptionPath: relativePath,
    }),
    absolutePath: (detail) => String(detail.consumptionAbsolutePath),
    buildSuccess: (detail, context) => ({
      candidateId: String(detail.candidateId),
      candidateName: String(detail.candidateName),
      usefulnessLevel: String(detail.usefulnessLevel),
      objective: String(detail.objective),
      appliedSurface: String(detail.appliedSurface),
      applicationSummary: String(detail.applicationSummary),
      observedEffect: String(detail.observedEffect),
      validationResult: String(detail.validationResult),
      outcome: detail.outcome as "success" | "failure",
      rollbackNote: String(detail.rollbackNote),
      integrationRelativePath: String(detail.integrationRelativePath),
      retainedRelativePath: String(detail.retainedRelativePath),
      resultRelativePath: String(detail.resultRelativePath),
      targetRelativePath: String(detail.targetRelativePath),
      adoptionRelativePath: String(detail.adoptionRelativePath),
      sourceResultRelativePath: String(detail.sourceResultRelativePath),
      evaluationRelativePath: readExistingArchitectureDeepTailPath({
        directiveRoot: context.directiveRoot,
        sourceRelativePath: context.relativePath,
        sourceStage: "consumption_record",
        sourceSuffix: "-consumption.md",
        targetStage: "post_consumption_evaluation",
      }),
      content: String(detail.content),
    }),
  });
}

export function readDirectiveFrontendArchitecturePostConsumptionEvaluationDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): DirectiveFrontendArchitecturePostConsumptionEvaluationDetail {
  return readDirectiveFrontendArchitectureDeepTailDetail<DirectiveFrontendArchitecturePostConsumptionEvaluationDetail>({
    directiveRoot: input.directiveRoot,
    relativePath: input.relativePath,
    stage: "post_consumption_evaluation",
    invalidPathError: "invalid_post_consumption_evaluation_path",
    focusError: "architecture_post_consumption_evaluation_focus_not_resolved",
    readDetail: (relativePath) => readDirectiveArchitecturePostConsumptionEvaluationDetail({
      directiveRoot: input.directiveRoot,
      evaluationPath: relativePath,
    }),
    absolutePath: (detail) => String(detail.evaluationAbsolutePath),
    buildSuccess: (detail, context) => ({
      candidateId: String(detail.candidateId),
      candidateName: String(detail.candidateName),
      usefulnessLevel: String(detail.usefulnessLevel),
      objective: String(detail.objective),
      decision: detail.decision as "keep" | "reopen",
      rationale: String(detail.rationale),
      observedStability: String(detail.observedStability),
      retainedUsefulnessAssessment: String(detail.retainedUsefulnessAssessment),
      nextBoundedAction: String(detail.nextBoundedAction),
      rollbackNote: String(detail.rollbackNote),
      reopenedStartRelativePath: readDirectiveArchitectureReopenedStartPathForEvaluation({
        directiveRoot: context.directiveRoot,
        evaluationRelativePath: context.relativePath,
      }),
      consumptionRelativePath: String(detail.consumptionRelativePath),
      integrationRelativePath: String(detail.integrationRelativePath),
      retainedRelativePath: String(detail.retainedRelativePath),
      resultRelativePath: String(detail.resultRelativePath),
      targetRelativePath: String(detail.targetRelativePath),
      adoptionRelativePath: String(detail.adoptionRelativePath),
      sourceResultRelativePath: String(detail.sourceResultRelativePath),
      content: String(detail.content),
    }),
  });
}
