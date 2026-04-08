import {
  optionalString,
  prepareDirectiveArchitectureDeepTailWrite,
  readDirectiveArchitectureDeepTailDetailArtifact,
  resolveArchitectureDeepTailRelativePath,
  writeDirectiveArchitectureDeepTailArtifact,
} from "./architecture-deep-tail-artifact-helpers.ts";
import {
  readDirectiveArchitectureRetentionDetail,
} from "./architecture-retention.ts";
import { ARCHITECTURE_DEEP_TAIL_STAGE } from "./architecture-deep-tail-stage-map.ts";

export type CreateDirectiveArchitectureIntegrationRecordInput = {
  retainedPath: string;
  directiveRoot?: string;
  createdBy?: string | null;
  integrationTargetSurface?: string | null;
  readinessSummary?: string | null;
  expectedEffect?: string | null;
  validationBoundary?: string | null;
  integrationDecision?: string | null;
  rollbackBoundary?: string | null;
};

export type DirectiveArchitectureIntegrationRecordCreateResult = {
  ok: true;
  created: boolean;
  snapshotAt: string;
  directiveRoot: string;
  retainedRelativePath: string;
  retainedAbsolutePath: string;
  integrationRelativePath: string;
  integrationAbsolutePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
};

export type DirectiveArchitectureIntegrationRecordDetail = {
  directiveRoot: string;
  integrationRelativePath: string;
  integrationAbsolutePath: string;
  retainedRelativePath: string;
  retainedAbsolutePath: string;
  resultRelativePath: string;
  targetRelativePath: string;
  adoptionRelativePath: string;
  sourceResultRelativePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  objective: string;
  integrationTargetSurface: string;
  readinessSummary: string;
  expectedEffect: string;
  validationBoundary: string;
  integrationDecision: string;
  rollbackBoundary: string;
  content: string;
};

function resolveIntegrationRecordRelativePath(retainedRelativePath: string) {
  return resolveArchitectureDeepTailRelativePath({
    sourceRelativePath: retainedRelativePath,
    expectedSourceSuffix: "-retained.md",
    targetStage: "integration_record",
    inputFieldName: "retainedPath",
  });
}

function renderIntegrationRecordMarkdown(input: {
  snapshotAt: string;
  createdBy: string;
  integrationRelativePath: string;
  retainedRelativePath: string;
  resultRelativePath: string;
  targetRelativePath: string;
  adoptionRelativePath: string;
  sourceResultRelativePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  objective: string;
  integrationTargetSurface: string;
  readinessSummary: string;
  expectedEffect: string;
  validationBoundary: string;
  integrationDecision: string;
  rollbackBoundary: string;
}) {
  return [
    `# Architecture Integration Record: ${input.candidateName} (${input.snapshotAt.slice(0, 10)})`,
    "",
    "## retained objective",
    `- Candidate id: \`${input.candidateId}\``,
    `- Candidate name: ${input.candidateName}`,
    `- Source retained artifact: \`${input.retainedRelativePath}\``,
    `- Source implementation result: \`${input.resultRelativePath}\``,
    `- Source implementation target: \`${input.targetRelativePath}\``,
    `- Source adoption artifact: \`${input.adoptionRelativePath}\``,
    `- Source bounded result artifact: \`${input.sourceResultRelativePath}\``,
    `- Usefulness level: \`${input.usefulnessLevel}\``,
    `- Objective retained: ${input.objective}`,
    "",
    "## integration target/surface",
    `- ${input.integrationTargetSurface}`,
    "",
    "## readiness summary",
    `- ${input.readinessSummary}`,
    "",
    "## expected effect",
    `- ${input.expectedEffect}`,
    "",
    "## validation boundary",
    `- ${input.validationBoundary}`,
    "",
    "## evidence links",
    `- Retained artifact: \`${input.retainedRelativePath}\``,
    `- Implementation result: \`${input.resultRelativePath}\``,
    `- Implementation target: \`${input.targetRelativePath}\``,
    `- Adoption artifact: \`${input.adoptionRelativePath}\``,
    `- Upstream bounded result: \`${input.sourceResultRelativePath}\``,
    "",
    "## integration decision",
    `- Decision approval: \`${input.createdBy}\``,
    `- Decision: ${input.integrationDecision}`,
    "",
    "## rollback boundary",
    `- ${input.rollbackBoundary}`,
    "",
    "## artifact linkage",
    `- This integration-ready Architecture record is now retained at \`${input.integrationRelativePath}\`.`,
    `- If integration readiness later proves premature, resume from \`${input.retainedRelativePath}\` instead of reconstructing the chain by hand.`,
    "",
  ].join("\n");
}

export function createDirectiveArchitectureIntegrationRecord(
  input: CreateDirectiveArchitectureIntegrationRecordInput,
): DirectiveArchitectureIntegrationRecordCreateResult {
  const writePreparation = prepareDirectiveArchitectureDeepTailWrite({
    directiveRoot: input.directiveRoot,
    sourcePath: input.retainedPath,
    sourceFieldName: "retainedPath",
    resolveTargetRelativePath: resolveIntegrationRecordRelativePath,
    actor: input.createdBy,
  });
  const directiveRoot = writePreparation.directiveRoot;
  const retainedRelativePath = writePreparation.sourceRelativePath;
  const retainedDetail = readDirectiveArchitectureRetentionDetail({
    directiveRoot,
    retainedPath: retainedRelativePath,
  });
  const integrationRelativePath = writePreparation.targetRelativePath;
  const integrationAbsolutePath = writePreparation.targetAbsolutePath;
  const created = writePreparation.created;
  const snapshotAt = writePreparation.snapshotAt;
  const createdBy = writePreparation.actor;
  const integrationTargetSurface = optionalString(input.integrationTargetSurface)
    || "Directive Workspace engine-owned product logic within the current Architecture boundary.";
  const readinessSummary = optionalString(input.readinessSummary)
    || "This retained Architecture output is stable enough within the bounded scope to be recorded as integration-ready product input.";
  const expectedEffect = optionalString(input.expectedEffect)
    || "Directive Workspace can consume this retained output as an explicit engine-owned integration candidate without re-reading the prior Architecture chain.";
  const validationBoundary = optionalString(input.validationBoundary)
    || "Validate against the retained artifact, implementation result, and bounded source chain only; do not imply execution or downstream automation.";
  const integrationDecision = optionalString(input.integrationDecision)
    || "Record this retained output as integration-ready Directive Workspace Architecture output for the current bounded scope.";
  const rollbackBoundary = optionalString(input.rollbackBoundary)
    || "If this integration-ready record proves premature, fall back to the retained artifact and reopen a bounded Architecture slice before any further integration step.";

  const markdown = renderIntegrationRecordMarkdown({
    snapshotAt,
    createdBy,
    integrationRelativePath,
    retainedRelativePath,
    resultRelativePath: retainedDetail.resultRelativePath,
    targetRelativePath: retainedDetail.targetRelativePath,
    adoptionRelativePath: retainedDetail.adoptionRelativePath,
    sourceResultRelativePath: retainedDetail.sourceResultRelativePath,
    candidateId: retainedDetail.candidateId,
    candidateName: retainedDetail.candidateName,
    usefulnessLevel: retainedDetail.usefulnessLevel,
    objective: retainedDetail.objective,
    integrationTargetSurface,
    readinessSummary,
    expectedEffect,
    validationBoundary,
    integrationDecision,
    rollbackBoundary,
  });

  writeDirectiveArchitectureDeepTailArtifact({
    directiveRoot,
    stageId: "integration_record",
    sourceRelativePath: retainedRelativePath,
    targetRelativePath: integrationRelativePath,
    targetAbsolutePath: integrationAbsolutePath,
    markdown,
  });

  return {
    ok: true,
    created,
    snapshotAt,
    directiveRoot,
    retainedRelativePath,
    retainedAbsolutePath: retainedDetail.retainedAbsolutePath,
    integrationRelativePath,
    integrationAbsolutePath,
    candidateId: retainedDetail.candidateId,
    candidateName: retainedDetail.candidateName,
    usefulnessLevel: retainedDetail.usefulnessLevel,
  };
}

export function readDirectiveArchitectureIntegrationRecordDetail(input: {
  integrationPath: string;
  directiveRoot?: string;
}): DirectiveArchitectureIntegrationRecordDetail {
  const integrationArtifact = readDirectiveArchitectureDeepTailDetailArtifact({
    directiveRoot: input.directiveRoot,
    artifactPath: input.integrationPath,
    stage: ARCHITECTURE_DEEP_TAIL_STAGE.integration_record,
    fieldName: "integrationPath",
  });
  const directiveRoot = integrationArtifact.directiveRoot;
  const integrationRelativePath = integrationArtifact.relativePath;
  const integrationAbsolutePath = integrationArtifact.absolutePath;
  const content = integrationArtifact.content;
  const retainedRelativePath = content.match(/- Source retained artifact: `([^`]+)`/)?.[1] || "";
  const retainedDetail = readDirectiveArchitectureRetentionDetail({
    directiveRoot,
    retainedPath: retainedRelativePath,
  });

  return {
    directiveRoot,
    integrationRelativePath,
    integrationAbsolutePath,
    retainedRelativePath,
    retainedAbsolutePath: retainedDetail.retainedAbsolutePath,
    resultRelativePath: retainedDetail.resultRelativePath,
    targetRelativePath: retainedDetail.targetRelativePath,
    adoptionRelativePath: retainedDetail.adoptionRelativePath,
    sourceResultRelativePath: retainedDetail.sourceResultRelativePath,
    candidateId: retainedDetail.candidateId,
    candidateName: retainedDetail.candidateName,
    usefulnessLevel: retainedDetail.usefulnessLevel,
    objective: content.match(/- Objective retained: (.+)$/m)?.[1]?.trim() || "",
    integrationTargetSurface: content.match(/^## integration target\/surface\r?\n- (.+)$/m)?.[1]?.trim() || "",
    readinessSummary: content.match(/^## readiness summary\r?\n- (.+)$/m)?.[1]?.trim() || "",
    expectedEffect: content.match(/^## expected effect\r?\n- (.+)$/m)?.[1]?.trim() || "",
    validationBoundary: content.match(/^## validation boundary\r?\n- (.+)$/m)?.[1]?.trim() || "",
    integrationDecision: content.match(/- Decision: (.+)$/m)?.[1]?.trim() || "",
    rollbackBoundary: content.match(/^## rollback boundary\r?\n- (.+)$/m)?.[1]?.trim() || "",
    content,
  };
}
