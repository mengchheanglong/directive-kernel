import {
  optionalString,
  prepareDirectiveArchitectureDeepTailWrite,
  readDirectiveArchitectureDeepTailDetailArtifact,
  resolveArchitectureDeepTailRelativePath,
  writeDirectiveArchitectureDeepTailArtifact,
} from "./architecture-deep-tail-artifact-helpers.ts";
import {
  readDirectiveArchitectureImplementationResultDetail,
} from "./architecture-implementation-result.ts";
import {
  resolveArchitectureReview,
  type ArchitectureReviewResolution,
} from "./architecture-review-resolution.ts";
import { ARCHITECTURE_DEEP_TAIL_STAGE } from "./architecture-deep-tail-stage-map.ts";

export type ConfirmDirectiveArchitectureRetentionInput = {
  resultPath: string;
  directiveRoot?: string;
  confirmedBy?: string | null;
  usefulnessAssessment?: string | null;
  stabilityLevel?: "stable" | "bounded-stable" | "provisional";
  reuseScope?: string | null;
  confirmationDecision?: string | null;
  rollbackBoundary?: string | null;
};

export type DirectiveArchitectureRetentionConfirmResult = {
  ok: true;
  created: boolean;
  snapshotAt: string;
  directiveRoot: string;
  resultRelativePath: string;
  resultAbsolutePath: string;
  retainedRelativePath: string;
  retainedAbsolutePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  stabilityLevel: "stable" | "bounded-stable" | "provisional";
};

export type DirectiveArchitectureRetentionDetail = {
  directiveRoot: string;
  retainedRelativePath: string;
  retainedAbsolutePath: string;
  resultRelativePath: string;
  resultAbsolutePath: string;
  targetRelativePath: string;
  adoptionRelativePath: string;
  sourceResultRelativePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  objective: string;
  reviewScore: string;
  reviewResult: string;
  lifecycleOutcome: string;
  transitionRequest: string;
  stabilityLevel: string;
  reuseScope: string;
  confirmationDecision: string;
  rollbackBoundary: string;
  content: string;
};

function resolveRetentionRelativePath(resultRelativePath: string) {
  return resolveArchitectureDeepTailRelativePath({
    sourceRelativePath: resultRelativePath,
    expectedSourceSuffix: "-implementation-result.md",
    targetStage: "retained",
    inputFieldName: "resultPath",
  });
}

function renderOptionalBulletList(items: string[], fallback: string) {
  if (items.length === 0) {
    return `- ${fallback}`;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function resolveRetentionReviewResolution(
  resultDetail: ReturnType<typeof readDirectiveArchitectureImplementationResultDetail>,
): ArchitectureReviewResolution {
  return resolveArchitectureReview({
    candidateId: resultDetail.candidateId,
    checks: {
      state_visibility_check: "pass",
      rollback_check: resultDetail.rollbackNote ? "pass" : "fail",
      scope_isolation_check:
        resultDetail.explicitLimitations.length > 0 ? "pass" : "warning",
      validation_link_check: resultDetail.validationResult ? "pass" : "fail",
      ownership_boundary_check: "pass",
      packet_consumption_check: "not_applicable",
      artifact_evidence_continuity_check:
        resultDetail.targetRelativePath
        && resultDetail.adoptionRelativePath
          ? "pass"
          : "fail",
    },
    antiPatterns: {},
  });
}

function renderRetentionMarkdown(input: {
  snapshotAt: string;
  confirmedBy: string;
  retainedRelativePath: string;
  resultRelativePath: string;
  targetRelativePath: string;
  adoptionRelativePath: string;
  sourceResultRelativePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  objective: string;
  actualResultSummary: string;
  reviewResolution: ArchitectureReviewResolution;
  usefulnessAssessment: string;
  stabilityLevel: "stable" | "bounded-stable" | "provisional";
  reuseScope: string;
  confirmationDecision: string;
  rollbackBoundary: string;
}) {
  const requiredChanges = renderOptionalBulletList(
    input.reviewResolution.requiredChanges,
    "none",
  );
  const warningChecks = renderOptionalBulletList(
    input.reviewResolution.warningChecks,
    "none",
  );
  const failingChecks = renderOptionalBulletList(
    input.reviewResolution.failingChecks,
    "none",
  );

  return [
    `# Retained Architecture Output: ${input.candidateName} (${input.snapshotAt.slice(0, 10)})`,
    "",
    "## retained objective",
    `- Candidate id: \`${input.candidateId}\``,
    `- Candidate name: ${input.candidateName}`,
    `- Source implementation result: \`${input.resultRelativePath}\``,
    `- Source implementation target: \`${input.targetRelativePath}\``,
    `- Source adoption artifact: \`${input.adoptionRelativePath}\``,
    `- Source bounded result artifact: \`${input.sourceResultRelativePath}\``,
    `- Objective retained: ${input.objective}`,
    "",
    "## final usefulness assessment",
    `- Usefulness level: \`${input.usefulnessLevel}\``,
    `- Assessment: ${input.usefulnessAssessment}`,
    "",
    "## retained review resolution",
    `- Review score: \`${input.reviewResolution.reviewScore}\``,
    `- Review result: \`${input.reviewResolution.reviewResult}\``,
    `- Lifecycle outcome: \`${input.reviewResolution.lifecycleFeedback.outcome}\``,
    `- Transition request: \`${input.reviewResolution.transitionRequest.from} -> ${input.reviewResolution.transitionRequest.to}\` via \`${input.reviewResolution.transitionRequest.role}\``,
    "",
    "### warning checks",
    warningChecks,
    "",
    "### failing checks",
    failingChecks,
    "",
    "### required changes",
    requiredChanges,
    "",
    "## stability and reuse",
    `- Stability level: \`${input.stabilityLevel}\``,
    `- Reuse scope: ${input.reuseScope}`,
    "",
    "## evidence links",
    `- Actual implementation result summary: ${input.actualResultSummary}`,
    `- Implementation result artifact: \`${input.resultRelativePath}\``,
    `- Implementation target artifact: \`${input.targetRelativePath}\``,
    `- Adoption artifact: \`${input.adoptionRelativePath}\``,
    `- Upstream bounded result artifact: \`${input.sourceResultRelativePath}\``,
    "",
    "## confirmation decision",
    `- Confirmation approval: \`${input.confirmedBy}\``,
    `- Decision: ${input.confirmationDecision}`,
    "",
    "## rollback boundary",
    `- ${input.rollbackBoundary}`,
    "",
    "## artifact linkage",
    `- This retained Architecture output is now recorded at \`${input.retainedRelativePath}\`.`,
    `- If retention later proves premature, resume from \`${input.resultRelativePath}\` or \`${input.targetRelativePath}\` instead of reconstructing the chain by hand.`,
    "",
  ].join("\n");
}

export function confirmDirectiveArchitectureRetention(
  input: ConfirmDirectiveArchitectureRetentionInput,
): DirectiveArchitectureRetentionConfirmResult {
  const writePreparation = prepareDirectiveArchitectureDeepTailWrite({
    directiveRoot: input.directiveRoot,
    sourcePath: input.resultPath,
    sourceFieldName: "resultPath",
    resolveTargetRelativePath: resolveRetentionRelativePath,
    actor: input.confirmedBy,
  });
  const directiveRoot = writePreparation.directiveRoot;
  const resultRelativePath = writePreparation.sourceRelativePath;
  const resultDetail = readDirectiveArchitectureImplementationResultDetail({
    directiveRoot,
    resultPath: resultRelativePath,
  });
  const retainedRelativePath = writePreparation.targetRelativePath;
  const retainedAbsolutePath = writePreparation.targetAbsolutePath;
  const created = writePreparation.created;
  const snapshotAt = writePreparation.snapshotAt;
  const confirmedBy = writePreparation.actor;
  const stabilityLevel = input.stabilityLevel || "bounded-stable";
  const usefulnessAssessment = optionalString(input.usefulnessAssessment)
    || "The completed implementation result is worth retaining as Directive-owned Architecture output within the current bounded scope.";
  const reuseScope = optionalString(input.reuseScope)
    || "Retain for Directive Workspace Architecture use within the current engine-improvement boundary.";
  const confirmationDecision = optionalString(input.confirmationDecision)
    || "Retain this implementation result as valid Directive Workspace Architecture output for the current bounded scope.";
  const rollbackBoundary = optionalString(input.rollbackBoundary)
    || "If this retained output proves unstable or premature, return to the implementation result or implementation target and reopen a bounded Architecture slice.";
  const reviewResolution = resolveRetentionReviewResolution(resultDetail);

  const markdown = renderRetentionMarkdown({
    snapshotAt,
    confirmedBy,
    retainedRelativePath,
    resultRelativePath,
    targetRelativePath: resultDetail.targetRelativePath,
    adoptionRelativePath: resultDetail.adoptionRelativePath,
    sourceResultRelativePath: resultDetail.sourceResultRelativePath,
    candidateId: resultDetail.candidateId,
    candidateName: resultDetail.candidateName,
    usefulnessLevel: resultDetail.usefulnessLevel,
    objective: resultDetail.objective,
    actualResultSummary: resultDetail.resultSummary,
    reviewResolution,
    usefulnessAssessment,
    stabilityLevel,
    reuseScope,
    confirmationDecision,
    rollbackBoundary,
  });

  writeDirectiveArchitectureDeepTailArtifact({
    directiveRoot,
    stageId: "retained",
    sourceRelativePath: resultRelativePath,
    targetRelativePath: retainedRelativePath,
    targetAbsolutePath: retainedAbsolutePath,
    markdown,
  });

  return {
    ok: true,
    created,
    snapshotAt,
    directiveRoot,
    resultRelativePath,
    resultAbsolutePath: resultDetail.resultAbsolutePath,
    retainedRelativePath,
    retainedAbsolutePath,
    candidateId: resultDetail.candidateId,
    candidateName: resultDetail.candidateName,
    usefulnessLevel: resultDetail.usefulnessLevel,
    stabilityLevel,
  };
}

export function readDirectiveArchitectureRetentionDetail(input: {
  retainedPath: string;
  directiveRoot?: string;
}): DirectiveArchitectureRetentionDetail {
  const retainedArtifact = readDirectiveArchitectureDeepTailDetailArtifact({
    directiveRoot: input.directiveRoot,
    artifactPath: input.retainedPath,
    stage: ARCHITECTURE_DEEP_TAIL_STAGE.retained,
    fieldName: "retainedPath",
  });
  const directiveRoot = retainedArtifact.directiveRoot;
  const retainedRelativePath = retainedArtifact.relativePath;
  const retainedAbsolutePath = retainedArtifact.absolutePath;
  const content = retainedArtifact.content;
  const resultRelativePath = content.match(/- Source implementation result: `([^`]+)`/)?.[1] || "";
  const resultDetail = readDirectiveArchitectureImplementationResultDetail({
    directiveRoot,
    resultPath: resultRelativePath,
  });

  return {
    directiveRoot,
    retainedRelativePath,
    retainedAbsolutePath,
    resultRelativePath,
    resultAbsolutePath: resultDetail.resultAbsolutePath,
    targetRelativePath: resultDetail.targetRelativePath,
    adoptionRelativePath: resultDetail.adoptionRelativePath,
    sourceResultRelativePath: resultDetail.sourceResultRelativePath,
    candidateId: resultDetail.candidateId,
    candidateName: resultDetail.candidateName,
    usefulnessLevel: resultDetail.usefulnessLevel,
    objective: content.match(/- Objective retained: (.+)$/m)?.[1]?.trim() || "",
    reviewScore: content.match(/- Review score: `([^`]+)`/)?.[1] || "",
    reviewResult: content.match(/- Review result: `([^`]+)`/)?.[1] || "",
    lifecycleOutcome: content.match(/- Lifecycle outcome: `([^`]+)`/)?.[1] || "",
    transitionRequest: content.match(/- Transition request: `([^`]+)`/)?.[1] || "",
    stabilityLevel: content.match(/- Stability level: `([^`]+)`/)?.[1] || "",
    reuseScope: content.match(/- Reuse scope: (.+)$/m)?.[1]?.trim() || "",
    confirmationDecision: content.match(/- Decision: (.+)$/m)?.[1]?.trim() || "",
    rollbackBoundary: content.match(/^## rollback boundary\r?\n- (.+)$/m)?.[1]?.trim() || "",
    content,
  };
}
