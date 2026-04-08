import {
  optionalString,
  prepareDirectiveArchitectureDeepTailWrite,
  readDirectiveArchitectureDeepTailDetailArtifact,
  resolveArchitectureDeepTailRelativePath,
  writeDirectiveArchitectureDeepTailArtifact,
} from "./architecture-deep-tail-artifact-helpers.ts";
import {
  readDirectiveArchitectureIntegrationRecordDetail,
} from "./architecture-integration-record.ts";
import { ARCHITECTURE_DEEP_TAIL_STAGE } from "./architecture-deep-tail-stage-map.ts";

export type RecordDirectiveArchitectureConsumptionInput = {
  integrationPath: string;
  directiveRoot?: string;
  recordedBy?: string | null;
  appliedSurface?: string | null;
  applicationSummary?: string | null;
  observedEffect?: string | null;
  validationResult?: string | null;
  outcome?: "success" | "failure";
  rollbackNote?: string | null;
};

export type DirectiveArchitectureConsumptionRecordResult = {
  ok: true;
  created: boolean;
  snapshotAt: string;
  directiveRoot: string;
  integrationRelativePath: string;
  integrationAbsolutePath: string;
  consumptionRelativePath: string;
  consumptionAbsolutePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  outcome: "success" | "failure";
};

export type DirectiveArchitectureConsumptionRecordDetail = {
  directiveRoot: string;
  consumptionRelativePath: string;
  consumptionAbsolutePath: string;
  integrationRelativePath: string;
  integrationAbsolutePath: string;
  retainedRelativePath: string;
  resultRelativePath: string;
  targetRelativePath: string;
  adoptionRelativePath: string;
  sourceResultRelativePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  objective: string;
  appliedSurface: string;
  applicationSummary: string;
  observedEffect: string;
  validationResult: string;
  outcome: "success" | "failure";
  rollbackNote: string;
  content: string;
};

function resolveConsumptionRelativePath(integrationRelativePath: string) {
  return resolveArchitectureDeepTailRelativePath({
    sourceRelativePath: integrationRelativePath,
    expectedSourceSuffix: "-integration-record.md",
    targetStage: "consumption_record",
    inputFieldName: "integrationPath",
    targetSuffix: "-consumption.md",
  });
}

function renderConsumptionMarkdown(input: {
  snapshotAt: string;
  recordedBy: string;
  integrationRelativePath: string;
  consumptionRelativePath: string;
  retainedRelativePath: string;
  resultRelativePath: string;
  targetRelativePath: string;
  adoptionRelativePath: string;
  sourceResultRelativePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  objective: string;
  appliedSurface: string;
  applicationSummary: string;
  observedEffect: string;
  validationResult: string;
  outcome: "success" | "failure";
  rollbackNote: string;
}) {
  return [
    `# Architecture Consumption Record: ${input.candidateName} (${input.snapshotAt.slice(0, 10)})`,
    "",
    "## integration reference",
    `- Candidate id: \`${input.candidateId}\``,
    `- Candidate name: ${input.candidateName}`,
    `- Source integration record: \`${input.integrationRelativePath}\``,
    `- Source retained artifact: \`${input.retainedRelativePath}\``,
    `- Source implementation result: \`${input.resultRelativePath}\``,
    `- Source implementation target: \`${input.targetRelativePath}\``,
    `- Source adoption artifact: \`${input.adoptionRelativePath}\``,
    `- Source bounded result artifact: \`${input.sourceResultRelativePath}\``,
    `- Usefulness level: \`${input.usefulnessLevel}\``,
    `- Retained objective: ${input.objective}`,
    "",
    "## where it was applied",
    `- ${input.appliedSurface}`,
    "",
    "## application summary",
    `- ${input.applicationSummary}`,
    "",
    "## observed effect",
    `- ${input.observedEffect}`,
    "",
    "## validation result",
    `- ${input.validationResult}`,
    "",
    "## consumption decision",
    `- Outcome: \`${input.outcome}\``,
    `- Recorded by: \`${input.recordedBy}\``,
    "",
    "## rollback note",
    `- ${input.rollbackNote}`,
    "",
    "## artifact linkage",
    `- This applied-integration Architecture record is now stored at \`${input.consumptionRelativePath}\`.`,
    `- If this consumption record later proves inaccurate or premature, resume from \`${input.integrationRelativePath}\` instead of reconstructing the chain by hand.`,
    "",
  ].join("\n");
}

export function recordDirectiveArchitectureConsumption(
  input: RecordDirectiveArchitectureConsumptionInput,
): DirectiveArchitectureConsumptionRecordResult {
  const writePreparation = prepareDirectiveArchitectureDeepTailWrite({
    directiveRoot: input.directiveRoot,
    sourcePath: input.integrationPath,
    sourceFieldName: "integrationPath",
    resolveTargetRelativePath: resolveConsumptionRelativePath,
    actor: input.recordedBy,
  });
  const directiveRoot = writePreparation.directiveRoot;
  const integrationRelativePath = writePreparation.sourceRelativePath;
  const integrationDetail = readDirectiveArchitectureIntegrationRecordDetail({
    directiveRoot,
    integrationPath: integrationRelativePath,
  });
  const consumptionRelativePath = writePreparation.targetRelativePath;
  const consumptionAbsolutePath = writePreparation.targetAbsolutePath;
  const created = writePreparation.created;
  const snapshotAt = writePreparation.snapshotAt;
  const recordedBy = writePreparation.actor;
  const outcome = input.outcome === "failure" ? "failure" : "success";
  const appliedSurface = optionalString(input.appliedSurface)
    || "Directive Workspace engine-owned product logic within the current bounded Architecture surface.";
  const applicationSummary = optionalString(input.applicationSummary)
    || "This integration-ready Architecture output has now been explicitly consumed as engine-owned Directive Workspace product input within the bounded scope.";
  const observedEffect = optionalString(input.observedEffect)
    || "Directive Workspace now has an explicit applied-integration record for this retained Architecture output without re-reading the prior chain.";
  const validationResult = optionalString(input.validationResult)
    || (outcome === "success"
      ? "Consumption stayed within the integration-ready boundary and remained linked to the retained Architecture chain."
      : "Consumption did not hold within the intended boundary and should be reconsidered from the integration record.");
  const rollbackNote = optionalString(input.rollbackNote)
    || "If this applied integration proves premature or inaccurate, fall back to the integration record and reopen a bounded Architecture review before any further step.";

  const markdown = renderConsumptionMarkdown({
    snapshotAt,
    recordedBy,
    integrationRelativePath,
    consumptionRelativePath,
    retainedRelativePath: integrationDetail.retainedRelativePath,
    resultRelativePath: integrationDetail.resultRelativePath,
    targetRelativePath: integrationDetail.targetRelativePath,
    adoptionRelativePath: integrationDetail.adoptionRelativePath,
    sourceResultRelativePath: integrationDetail.sourceResultRelativePath,
    candidateId: integrationDetail.candidateId,
    candidateName: integrationDetail.candidateName,
    usefulnessLevel: integrationDetail.usefulnessLevel,
    objective: integrationDetail.objective,
    appliedSurface,
    applicationSummary,
    observedEffect,
    validationResult,
    outcome,
    rollbackNote,
  });

  writeDirectiveArchitectureDeepTailArtifact({
    directiveRoot,
    stageId: "consumption_record",
    sourceRelativePath: integrationRelativePath,
    targetRelativePath: consumptionRelativePath,
    targetAbsolutePath: consumptionAbsolutePath,
    markdown,
  });

  return {
    ok: true,
    created,
    snapshotAt,
    directiveRoot,
    integrationRelativePath,
    integrationAbsolutePath: integrationDetail.integrationAbsolutePath,
    consumptionRelativePath,
    consumptionAbsolutePath,
    candidateId: integrationDetail.candidateId,
    candidateName: integrationDetail.candidateName,
    usefulnessLevel: integrationDetail.usefulnessLevel,
    outcome,
  };
}

export function readDirectiveArchitectureConsumptionRecordDetail(input: {
  consumptionPath: string;
  directiveRoot?: string;
}): DirectiveArchitectureConsumptionRecordDetail {
  const consumptionArtifact = readDirectiveArchitectureDeepTailDetailArtifact({
    directiveRoot: input.directiveRoot,
    artifactPath: input.consumptionPath,
    stage: ARCHITECTURE_DEEP_TAIL_STAGE.consumption_record,
    fieldName: "consumptionPath",
  });
  const directiveRoot = consumptionArtifact.directiveRoot;
  const consumptionRelativePath = consumptionArtifact.relativePath;
  const consumptionAbsolutePath = consumptionArtifact.absolutePath;
  const content = consumptionArtifact.content;
  const integrationRelativePath = content.match(/- Source integration record: `([^`]+)`/)?.[1] || "";
  const integrationDetail = readDirectiveArchitectureIntegrationRecordDetail({
    directiveRoot,
    integrationPath: integrationRelativePath,
  });

  return {
    directiveRoot,
    consumptionRelativePath,
    consumptionAbsolutePath,
    integrationRelativePath,
    integrationAbsolutePath: integrationDetail.integrationAbsolutePath,
    retainedRelativePath: integrationDetail.retainedRelativePath,
    resultRelativePath: integrationDetail.resultRelativePath,
    targetRelativePath: integrationDetail.targetRelativePath,
    adoptionRelativePath: integrationDetail.adoptionRelativePath,
    sourceResultRelativePath: integrationDetail.sourceResultRelativePath,
    candidateId: integrationDetail.candidateId,
    candidateName: integrationDetail.candidateName,
    usefulnessLevel: integrationDetail.usefulnessLevel,
    objective: content.match(/- Retained objective: (.+)$/m)?.[1]?.trim() || "",
    appliedSurface: content.match(/^## where it was applied\r?\n- (.+)$/m)?.[1]?.trim() || "",
    applicationSummary: content.match(/^## application summary\r?\n- (.+)$/m)?.[1]?.trim() || "",
    observedEffect: content.match(/^## observed effect\r?\n- (.+)$/m)?.[1]?.trim() || "",
    validationResult: content.match(/^## validation result\r?\n- (.+)$/m)?.[1]?.trim() || "",
    outcome: (content.match(/- Outcome: `([^`]+)`/)?.[1] || "success") as "success" | "failure",
    rollbackNote: content.match(/^## rollback note\r?\n- (.+)$/m)?.[1]?.trim() || "",
    content,
  };
}
