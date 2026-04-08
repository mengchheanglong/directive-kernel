import fs from "node:fs";

import {
  normalizePath,
  optionalString,
  prepareDirectiveArchitectureDeepTailWrite,
  readDirectiveArchitectureDeepTailDetailArtifact,
  requiredString,
  resolveArchitectureDeepTailRelativePath,
  resolveDirectiveRelativePath,
  writeDirectiveArchitectureDeepTailArtifact,
} from "./architecture-deep-tail-artifact-helpers.ts";
import {
  readDirectiveArchitectureImplementationTargetDetail,
} from "./architecture-implementation-target.ts";
import { ARCHITECTURE_DEEP_TAIL_STAGE } from "./architecture-deep-tail-stage-map.ts";
import { resolveDirectiveWorkspaceArtifactAbsolutePath } from "../../shared/lib/directive-workspace-artifact-storage.ts";

export type CreateDirectiveArchitectureImplementationResultInput = {
  targetPath: string;
  directiveRoot?: string;
  completedBy?: string | null;
  resultSummary: string;
  outcome?: "success" | "failure";
  deviations?: string | null;
  evidence?: string | null;
  validationResult?: string | null;
  rollbackNote?: string | null;
};

export type DirectiveArchitectureImplementationResultCreateResult = {
  ok: true;
  created: boolean;
  snapshotAt: string;
  directiveRoot: string;
  targetRelativePath: string;
  targetAbsolutePath: string;
  resultRelativePath: string;
  resultAbsolutePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  outcome: "success" | "failure";
};

export type DirectiveArchitectureImplementationResultDetail = {
  directiveRoot: string;
  resultRelativePath: string;
  resultAbsolutePath: string;
  targetRelativePath: string;
  targetAbsolutePath: string;
  adoptionRelativePath: string;
  sourceResultRelativePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  sourceDecisionFormat: string;
  sourceCompletionStatus: string;
  sourceVerificationMethod: string;
  sourceVerificationResult: string;
  sourceRuntimeThresholdCheck: string;
  sourceAdoptionVerdict: string;
  sourceReadinessPassed: boolean;
  sourceFailedReadinessChecks: string[];
  sourceRuntimeHandoffRequired: boolean;
  sourceRuntimeHandoffRationale: string;
  sourceArtifactPath: string;
  sourcePrimaryEvidencePath: string;
  sourceSelfImprovementCategory: string;
  sourceSelfImprovementVerificationMethod: string;
  sourceSelfImprovementVerificationResult: string;
  objective: string;
  selectedBoundedSlice: string[];
  mechanicalSuccessCriteria: string[];
  explicitLimitations: string[];
  outcome: "success" | "failure";
  resultSummary: string;
  validationResult: string;
  rollbackNote: string;
  content: string;
};

function extractSectionBullets(content: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`## ${escapedHeading}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`));
  if (!match) {
    return [] as string[];
  }

  return match[1]
    .split(/\r?\n/)
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /u, "").trim())
    .filter((line) => line.length > 0);
}

function renderBulletList(items: string[], fallback: string) {
  if (items.length === 0) {
    return `- ${fallback}`;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function formatYesNo(value: boolean) {
  return value ? "yes" : "no";
}

function resolveImplementationResultRelativePath(targetRelativePath: string) {
  return resolveArchitectureDeepTailRelativePath({
    sourceRelativePath: targetRelativePath,
    expectedSourceSuffix: "-implementation-target.md",
    targetStage: "implementation_result",
    inputFieldName: "targetPath",
  });
}

export function readDirectiveArchitectureImplementationResultPathForTarget(input: {
  directiveRoot: string;
  targetRelativePath: string;
}) {
  const directiveRoot = normalizePath(input.directiveRoot);
  const targetRelativePath = resolveDirectiveRelativePath(
    directiveRoot,
    input.targetRelativePath,
  );
  const resultRelativePath = resolveImplementationResultRelativePath(targetRelativePath);
  const resultAbsolutePath = resolveDirectiveWorkspaceArtifactAbsolutePath({
    directiveRoot,
    relativePath: resultRelativePath,
    mode: "read",
  });

  return fs.existsSync(resultAbsolutePath) ? resultRelativePath : null;
}

function renderImplementationResultMarkdown(input: {
  snapshotAt: string;
  completedBy: string;
  targetRelativePath: string;
  resultRelativePath: string;
  adoptionRelativePath: string;
  sourceResultRelativePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  sourceDecisionFormat: string;
  sourceCompletionStatus: string;
  sourceVerificationMethod: string;
  sourceVerificationResult: string;
  sourceRuntimeThresholdCheck: string;
  sourceAdoptionVerdict: string;
  sourceReadinessPassed: boolean;
  sourceFailedReadinessChecks: string[];
  sourceRuntimeHandoffRequired: boolean;
  sourceRuntimeHandoffRationale: string;
  sourceArtifactPath: string;
  sourcePrimaryEvidencePath: string;
  sourceSelfImprovementCategory: string;
  sourceSelfImprovementVerificationMethod: string;
  sourceSelfImprovementVerificationResult: string;
  objective: string;
  selectedBoundedSlice: string[];
  mechanicalSuccessCriteria: string[];
  explicitLimitations: string[];
  outcome: "success" | "failure";
  resultSummary: string;
  deviations: string | null;
  evidence: string | null;
  validationResult: string;
  rollbackNote: string;
}) {
  const selectedBoundedSlice = renderBulletList(
    input.selectedBoundedSlice,
    "The completed work stayed within one bounded tactical slice.",
  );
  const mechanicalSuccessCriteria = renderBulletList(
    input.mechanicalSuccessCriteria,
    "The completed work records one explicit mechanical success criterion.",
  );
  const explicitLimitations = renderBulletList(
    input.explicitLimitations,
    "The completed work stays within the explicit Architecture boundary.",
  );
  const failedReadinessChecks = renderBulletList(
    input.sourceFailedReadinessChecks,
    "none",
  );

  return [
    `# Implementation Result: ${input.candidateName} (${input.snapshotAt.slice(0, 10)})`,
    "",
    "## target closure",
    `- Candidate id: \`${input.candidateId}\``,
    `- Candidate name: ${input.candidateName}`,
    `- Source implementation target: \`${input.targetRelativePath}\``,
    `- Source adoption artifact: \`${input.adoptionRelativePath}\``,
    ...(input.sourceResultRelativePath
      ? [`- Source bounded result artifact: \`${input.sourceResultRelativePath}\``]
      : ["- Source bounded result artifact: not retained in this legacy adopted slice."]),
    `- Usefulness level: \`${input.usefulnessLevel}\``,
    `- Completion approval: \`${input.completedBy}\``,
    "",
    "## objective",
    `- Objective retained: ${input.objective}`,
    "",
    "## decision envelope continuity",
    `- Source decision format retained: \`${input.sourceDecisionFormat}\``,
    `- Source completion status retained: \`${input.sourceCompletionStatus}\``,
    `- Source verification method retained: \`${input.sourceVerificationMethod}\``,
    `- Source verification result retained: \`${input.sourceVerificationResult}\``,
    `- Source runtime threshold check retained: ${input.sourceRuntimeThresholdCheck}`,
    "",
    "## adoption resolution continuity",
    `- Source verdict retained: \`${input.sourceAdoptionVerdict}\``,
    `- Source readiness passed retained: ${formatYesNo(input.sourceReadinessPassed)}`,
    `- Source Runtime handoff required retained: ${formatYesNo(input.sourceRuntimeHandoffRequired)}`,
    `- Source Runtime handoff rationale retained: ${input.sourceRuntimeHandoffRationale || "none recorded"}`,
    `- Source artifact path retained: \`${input.sourceArtifactPath}\``,
    `- Source primary evidence path retained: ${input.sourcePrimaryEvidencePath ? `\`${input.sourcePrimaryEvidencePath}\`` : "not recorded"}`,
    `- Source self-improvement category retained: ${input.sourceSelfImprovementCategory ? `\`${input.sourceSelfImprovementCategory}\`` : "not recorded"}`,
    `- Source self-improvement verification method retained: \`${input.sourceSelfImprovementVerificationMethod}\``,
    `- Source self-improvement verification result retained: \`${input.sourceSelfImprovementVerificationResult}\``,
    "",
    "### failed readiness checks retained",
    failedReadinessChecks,
    "",
    "## completed tactical slice",
    selectedBoundedSlice,
    "",
    "## actual result summary",
    `- ${input.resultSummary}`,
    "",
    "## mechanical success criteria check",
    mechanicalSuccessCriteria,
    `- Recorded validation result: ${input.validationResult}`,
    "",
    "## explicit limitations carried forward",
    explicitLimitations,
    "",
    "## completion decision",
    `- Outcome: \`${input.outcome}\``,
    `- Validation result: ${input.validationResult}`,
    "",
    "## deviations",
    input.deviations ? `- ${input.deviations}` : "- none recorded",
    "",
    "## evidence",
    input.evidence ? `- ${input.evidence}` : "- evidence remains in the linked implementation target and upstream Architecture artifacts",
    "",
    "## rollback note",
    `- ${input.rollbackNote}`,
    "",
    "## artifact linkage",
    `- This bounded implementation slice is now retained at \`${input.resultRelativePath}\`.`,
    `- If further work is needed, continue from \`${input.targetRelativePath}\` instead of reconstructing the adoption chain by hand.`,
    "",
  ].join("\n");
}

export function createDirectiveArchitectureImplementationResult(
  input: CreateDirectiveArchitectureImplementationResultInput,
): DirectiveArchitectureImplementationResultCreateResult {
  const writePreparation = prepareDirectiveArchitectureDeepTailWrite({
    directiveRoot: input.directiveRoot,
    sourcePath: input.targetPath,
    sourceFieldName: "targetPath",
    resolveTargetRelativePath: resolveImplementationResultRelativePath,
    actor: input.completedBy,
  });
  const directiveRoot = writePreparation.directiveRoot;
  const targetRelativePath = writePreparation.sourceRelativePath;
  const targetDetail = readDirectiveArchitectureImplementationTargetDetail({
    directiveRoot,
    targetPath: targetRelativePath,
  });
  const resultRelativePath = writePreparation.targetRelativePath;
  const resultAbsolutePath = writePreparation.targetAbsolutePath;
  const created = writePreparation.created;
  const snapshotAt = writePreparation.snapshotAt;
  const completedBy = writePreparation.actor;
  const resultSummary = requiredString(input.resultSummary, "resultSummary");
  const outcome = input.outcome === "failure" ? "failure" : "success";
  const validationResult = optionalString(input.validationResult)
    || (outcome === "success"
      ? "The bounded implementation target was completed within scope and remained aligned with the adopted artifact and its retained decision envelope."
      : "The bounded implementation target did not complete successfully and should stay at implementation-result status for review.");
  const rollbackNote = optionalString(input.rollbackNote)
    || "Return to the implementation target artifact and adjust the bounded slice before attempting another completion.";

  const markdown = renderImplementationResultMarkdown({
    snapshotAt,
    completedBy,
    targetRelativePath,
    resultRelativePath,
    adoptionRelativePath: targetDetail.adoptionRelativePath,
    sourceResultRelativePath: targetDetail.sourceResultRelativePath,
    candidateId: targetDetail.candidateId,
    candidateName: targetDetail.candidateName,
    usefulnessLevel: targetDetail.usefulnessLevel,
    sourceDecisionFormat: targetDetail.sourceDecisionFormat,
    sourceCompletionStatus: targetDetail.sourceCompletionStatus,
    sourceVerificationMethod: targetDetail.sourceVerificationMethod,
    sourceVerificationResult: targetDetail.sourceVerificationResult,
    sourceRuntimeThresholdCheck: targetDetail.sourceRuntimeThresholdCheck,
    sourceAdoptionVerdict: targetDetail.sourceAdoptionVerdict,
    sourceReadinessPassed: targetDetail.sourceReadinessPassed,
    sourceFailedReadinessChecks: targetDetail.sourceFailedReadinessChecks,
    sourceRuntimeHandoffRequired: targetDetail.sourceRuntimeHandoffRequired,
    sourceRuntimeHandoffRationale: targetDetail.sourceRuntimeHandoffRationale,
    sourceArtifactPath: targetDetail.sourceArtifactPath,
    sourcePrimaryEvidencePath: targetDetail.sourcePrimaryEvidencePath,
    sourceSelfImprovementCategory: targetDetail.sourceSelfImprovementCategory,
    sourceSelfImprovementVerificationMethod: targetDetail.sourceSelfImprovementVerificationMethod,
    sourceSelfImprovementVerificationResult: targetDetail.sourceSelfImprovementVerificationResult,
    objective: targetDetail.objective,
    selectedBoundedSlice: targetDetail.selectedBoundedSlice,
    mechanicalSuccessCriteria: targetDetail.mechanicalSuccessCriteria,
    explicitLimitations: targetDetail.explicitLimitations,
    outcome,
    resultSummary,
    deviations: optionalString(input.deviations),
    evidence: optionalString(input.evidence),
    validationResult,
    rollbackNote,
  });

  writeDirectiveArchitectureDeepTailArtifact({
    directiveRoot,
    stageId: "implementation_result",
    sourceRelativePath: targetRelativePath,
    targetRelativePath: resultRelativePath,
    targetAbsolutePath: resultAbsolutePath,
    markdown,
  });

  return {
    ok: true,
    created,
    snapshotAt,
    directiveRoot,
    targetRelativePath,
    targetAbsolutePath: targetDetail.targetAbsolutePath,
    resultRelativePath,
    resultAbsolutePath,
    candidateId: targetDetail.candidateId,
    candidateName: targetDetail.candidateName,
    usefulnessLevel: targetDetail.usefulnessLevel,
    outcome,
  };
}

export function readDirectiveArchitectureImplementationResultDetail(input: {
  resultPath: string;
  directiveRoot?: string;
}): DirectiveArchitectureImplementationResultDetail {
  const resultArtifact = readDirectiveArchitectureDeepTailDetailArtifact({
    directiveRoot: input.directiveRoot,
    artifactPath: input.resultPath,
    stage: ARCHITECTURE_DEEP_TAIL_STAGE.implementation_result,
    fieldName: "resultPath",
  });
  const directiveRoot = resultArtifact.directiveRoot;
  const resultRelativePath = resultArtifact.relativePath;
  const resultAbsolutePath = resultArtifact.absolutePath;
  const content = resultArtifact.content;
  const targetRelativePath = content.match(/- Source implementation target: `([^`]+)`/)?.[1] || "";
  const targetDetail = readDirectiveArchitectureImplementationTargetDetail({
    directiveRoot,
    targetPath: targetRelativePath,
  });

  return {
    directiveRoot,
    resultRelativePath,
    resultAbsolutePath,
    targetRelativePath,
    targetAbsolutePath: targetDetail.targetAbsolutePath,
    adoptionRelativePath: targetDetail.adoptionRelativePath,
    sourceResultRelativePath: targetDetail.sourceResultRelativePath,
    candidateId: targetDetail.candidateId,
    candidateName: targetDetail.candidateName,
    usefulnessLevel: targetDetail.usefulnessLevel,
    sourceDecisionFormat: content.match(/- Source decision format retained: `([^`]+)`/)?.[1] || "",
    sourceCompletionStatus: content.match(/- Source completion status retained: `([^`]+)`/)?.[1] || "",
    sourceVerificationMethod: content.match(/- Source verification method retained: `([^`]+)`/)?.[1] || "",
    sourceVerificationResult: content.match(/- Source verification result retained: `([^`]+)`/)?.[1] || "",
    sourceRuntimeThresholdCheck: content.match(/- Source runtime threshold check retained: (.+)$/m)?.[1]?.trim() || "",
    sourceAdoptionVerdict: content.match(/- Source verdict retained: `([^`]+)`/)?.[1] || "",
    sourceReadinessPassed: (content.match(/- Source readiness passed retained: (.+)$/m)?.[1]?.trim() || "") === "yes",
    sourceFailedReadinessChecks: extractSectionBullets(content, "failed readiness checks retained"),
    sourceRuntimeHandoffRequired: (content.match(/- Source Runtime handoff required retained: (.+)$/m)?.[1]?.trim() || "") === "yes",
    sourceRuntimeHandoffRationale: content.match(/- Source Runtime handoff rationale retained: (.+)$/m)?.[1]?.trim() || "",
    sourceArtifactPath: content.match(/- Source artifact path retained: `([^`]+)`/)?.[1] || "",
    sourcePrimaryEvidencePath: content.match(/- Source primary evidence path retained: `([^`]+)`/)?.[1] || "",
    sourceSelfImprovementCategory: content.match(/- Source self-improvement category retained: `([^`]+)`/)?.[1] || "",
    sourceSelfImprovementVerificationMethod: content.match(/- Source self-improvement verification method retained: `([^`]+)`/)?.[1] || "",
    sourceSelfImprovementVerificationResult: content.match(/- Source self-improvement verification result retained: `([^`]+)`/)?.[1] || "",
    objective: content.match(/- Objective retained: (.+)$/m)?.[1]?.trim() || "",
    selectedBoundedSlice: extractSectionBullets(content, "completed tactical slice"),
    mechanicalSuccessCriteria: extractSectionBullets(content, "mechanical success criteria check")
      .filter((line) => !line.startsWith("Recorded validation result:")),
    explicitLimitations: extractSectionBullets(content, "explicit limitations carried forward"),
    outcome: (content.match(/- Outcome: `([^`]+)`/)?.[1] || "success") as "success" | "failure",
    resultSummary: content.match(/^## actual result summary\r?\n- (.+)$/m)?.[1]?.trim() || "",
    validationResult: content.match(/- Validation result: (.+)$/m)?.[1]?.trim() || "",
    rollbackNote: content.match(/^## rollback note\r?\n- (.+)$/m)?.[1]?.trim() || "",
    content,
  };
}
