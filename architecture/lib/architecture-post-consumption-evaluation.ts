import {
  optionalString,
  prepareDirectiveArchitectureDeepTailWrite,
  readDirectiveArchitectureDeepTailDetailArtifact,
  resolveArchitectureDeepTailRelativePath,
  writeDirectiveArchitectureDeepTailArtifact,
} from "./architecture-deep-tail-artifact-helpers.ts";
import {
  readDirectiveArchitectureConsumptionRecordDetail,
} from "./architecture-consumption-record.ts";
import { ARCHITECTURE_DEEP_TAIL_STAGE } from "./architecture-deep-tail-stage-map.ts";

export type EvaluateDirectiveArchitectureConsumptionInput = {
  consumptionPath: string;
  directiveRoot?: string;
  evaluatedBy?: string | null;
  decision?: "keep" | "reopen";
  rationale?: string | null;
  observedStability?: string | null;
  retainedUsefulnessAssessment?: string | null;
  nextBoundedAction?: string | null;
  rollbackNote?: string | null;
};

export type DirectiveArchitecturePostConsumptionEvaluationResult = {
  ok: true;
  created: boolean;
  snapshotAt: string;
  directiveRoot: string;
  consumptionRelativePath: string;
  consumptionAbsolutePath: string;
  evaluationRelativePath: string;
  evaluationAbsolutePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  decision: "keep" | "reopen";
};

export type DirectiveArchitecturePostConsumptionEvaluationDetail = {
  directiveRoot: string;
  evaluationRelativePath: string;
  evaluationAbsolutePath: string;
  consumptionRelativePath: string;
  consumptionAbsolutePath: string;
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
  decision: "keep" | "reopen";
  rationale: string;
  observedStability: string;
  retainedUsefulnessAssessment: string;
  nextBoundedAction: string;
  rollbackNote: string;
  content: string;
};

function resolveEvaluationRelativePath(consumptionRelativePath: string) {
  return resolveArchitectureDeepTailRelativePath({
    sourceRelativePath: consumptionRelativePath,
    expectedSourceSuffix: "-consumption.md",
    targetStage: "post_consumption_evaluation",
    inputFieldName: "consumptionPath",
  });
}

function renderEvaluationMarkdown(input: {
  snapshotAt: string;
  evaluatedBy: string;
  evaluationRelativePath: string;
  consumptionRelativePath: string;
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
  decision: "keep" | "reopen";
  rationale: string;
  observedStability: string;
  retainedUsefulnessAssessment: string;
  nextBoundedAction: string;
  rollbackNote: string;
}) {
  return [
    `# Post-Consumption Evaluation: ${input.candidateName} (${input.snapshotAt.slice(0, 10)})`,
    "",
    "## consumption reference",
    `- Candidate id: \`${input.candidateId}\``,
    `- Candidate name: ${input.candidateName}`,
    `- Source consumption record: \`${input.consumptionRelativePath}\``,
    `- Source integration record: \`${input.integrationRelativePath}\``,
    `- Source retained artifact: \`${input.retainedRelativePath}\``,
    `- Source implementation result: \`${input.resultRelativePath}\``,
    `- Source implementation target: \`${input.targetRelativePath}\``,
    `- Source adoption artifact: \`${input.adoptionRelativePath}\``,
    `- Source bounded result artifact: \`${input.sourceResultRelativePath}\``,
    `- Usefulness level: \`${input.usefulnessLevel}\``,
    `- Retained objective: ${input.objective}`,
    "",
    "## keep or reopen decision",
    `- Decision: \`${input.decision}\``,
    `- Evaluation approval: \`${input.evaluatedBy}\``,
    "",
    "## rationale",
    `- ${input.rationale}`,
    "",
    "## observed stability",
    `- ${input.observedStability}`,
    "",
    "## retained usefulness assessment",
    `- ${input.retainedUsefulnessAssessment}`,
    "",
    "## next bounded action if reopen",
    `- ${input.nextBoundedAction}`,
    "",
    "## rollback note",
    `- ${input.rollbackNote}`,
    "",
    "## artifact linkage",
    `- This post-consumption evaluation is now stored at \`${input.evaluationRelativePath}\`.`,
    `- If this judgment later proves wrong, resume from \`${input.consumptionRelativePath}\` instead of reconstructing the applied chain by hand.`,
    "",
  ].join("\n");
}

export function evaluateDirectiveArchitectureConsumption(
  input: EvaluateDirectiveArchitectureConsumptionInput,
): DirectiveArchitecturePostConsumptionEvaluationResult {
  const writePreparation = prepareDirectiveArchitectureDeepTailWrite({
    directiveRoot: input.directiveRoot,
    sourcePath: input.consumptionPath,
    sourceFieldName: "consumptionPath",
    resolveTargetRelativePath: resolveEvaluationRelativePath,
    actor: input.evaluatedBy,
  });
  const directiveRoot = writePreparation.directiveRoot;
  const consumptionRelativePath = writePreparation.sourceRelativePath;
  const consumptionDetail = readDirectiveArchitectureConsumptionRecordDetail({
    directiveRoot,
    consumptionPath: consumptionRelativePath,
  });
  const evaluationRelativePath = writePreparation.targetRelativePath;
  const evaluationAbsolutePath = writePreparation.targetAbsolutePath;
  const created = writePreparation.created;
  const snapshotAt = writePreparation.snapshotAt;
  const evaluatedBy = writePreparation.actor;
  const decision = input.decision === "reopen" ? "reopen" : "keep";
  const rationale = optionalString(input.rationale)
    || (decision === "keep"
      ? "Real bounded use validated this applied Architecture output strongly enough to keep it as valid retained Directive Workspace Architecture output."
      : "Real bounded use exposed enough uncertainty that this applied Architecture output should reopen a bounded Architecture slice.");
  const observedStability = optionalString(input.observedStability)
    || (decision === "keep"
      ? "Observed behavior stayed stable within the applied integration boundary."
      : "Observed behavior indicates the applied integration should not yet be treated as stable retained output.");
  const retainedUsefulnessAssessment = optionalString(input.retainedUsefulnessAssessment)
    || (decision === "keep"
      ? "The retained Architecture output still appears useful and valid after real bounded consumption."
      : "The retained Architecture output needs another bounded Architecture pass before it should remain valid retained output.");
  const nextBoundedAction = optionalString(input.nextBoundedAction)
    || (decision === "keep"
      ? "No reopen action required within the current bounded scope."
      : "Reopen one bounded Architecture slice from the retained or integration artifact and re-evaluate the applied boundary.");
  const rollbackNote = optionalString(input.rollbackNote)
    || "If this evaluation later proves inaccurate, return to the consumption record and reassess keep versus reopen before any further step.";

  const markdown = renderEvaluationMarkdown({
    snapshotAt,
    evaluatedBy,
    evaluationRelativePath,
    consumptionRelativePath,
    integrationRelativePath: consumptionDetail.integrationRelativePath,
    retainedRelativePath: consumptionDetail.retainedRelativePath,
    resultRelativePath: consumptionDetail.resultRelativePath,
    targetRelativePath: consumptionDetail.targetRelativePath,
    adoptionRelativePath: consumptionDetail.adoptionRelativePath,
    sourceResultRelativePath: consumptionDetail.sourceResultRelativePath,
    candidateId: consumptionDetail.candidateId,
    candidateName: consumptionDetail.candidateName,
    usefulnessLevel: consumptionDetail.usefulnessLevel,
    objective: consumptionDetail.objective,
    decision,
    rationale,
    observedStability,
    retainedUsefulnessAssessment,
    nextBoundedAction,
    rollbackNote,
  });

  writeDirectiveArchitectureDeepTailArtifact({
    directiveRoot,
    stageId: "post_consumption_evaluation",
    sourceRelativePath: consumptionRelativePath,
    targetRelativePath: evaluationRelativePath,
    targetAbsolutePath: evaluationAbsolutePath,
    markdown,
  });

  return {
    ok: true,
    created,
    snapshotAt,
    directiveRoot,
    consumptionRelativePath,
    consumptionAbsolutePath: consumptionDetail.consumptionAbsolutePath,
    evaluationRelativePath,
    evaluationAbsolutePath,
    candidateId: consumptionDetail.candidateId,
    candidateName: consumptionDetail.candidateName,
    usefulnessLevel: consumptionDetail.usefulnessLevel,
    decision,
  };
}

export function readDirectiveArchitecturePostConsumptionEvaluationDetail(input: {
  evaluationPath: string;
  directiveRoot?: string;
}): DirectiveArchitecturePostConsumptionEvaluationDetail {
  const evaluationArtifact = readDirectiveArchitectureDeepTailDetailArtifact({
    directiveRoot: input.directiveRoot,
    artifactPath: input.evaluationPath,
    stage: ARCHITECTURE_DEEP_TAIL_STAGE.post_consumption_evaluation,
    fieldName: "evaluationPath",
  });
  const directiveRoot = evaluationArtifact.directiveRoot;
  const evaluationRelativePath = evaluationArtifact.relativePath;
  const evaluationAbsolutePath = evaluationArtifact.absolutePath;
  const content = evaluationArtifact.content;
  const consumptionRelativePath = content.match(/- Source consumption record: `([^`]+)`/)?.[1] || "";
  const consumptionDetail = readDirectiveArchitectureConsumptionRecordDetail({
    directiveRoot,
    consumptionPath: consumptionRelativePath,
  });

  return {
    directiveRoot,
    evaluationRelativePath,
    evaluationAbsolutePath,
    consumptionRelativePath,
    consumptionAbsolutePath: consumptionDetail.consumptionAbsolutePath,
    integrationRelativePath: consumptionDetail.integrationRelativePath,
    retainedRelativePath: consumptionDetail.retainedRelativePath,
    resultRelativePath: consumptionDetail.resultRelativePath,
    targetRelativePath: consumptionDetail.targetRelativePath,
    adoptionRelativePath: consumptionDetail.adoptionRelativePath,
    sourceResultRelativePath: consumptionDetail.sourceResultRelativePath,
    candidateId: consumptionDetail.candidateId,
    candidateName: consumptionDetail.candidateName,
    usefulnessLevel: consumptionDetail.usefulnessLevel,
    objective: content.match(/- Retained objective: (.+)$/m)?.[1]?.trim() || "",
    decision: (content.match(/- Decision: `([^`]+)`/)?.[1] || "keep") as "keep" | "reopen",
    rationale: content.match(/^## rationale\r?\n- (.+)$/m)?.[1]?.trim() || "",
    observedStability: content.match(/^## observed stability\r?\n- (.+)$/m)?.[1]?.trim() || "",
    retainedUsefulnessAssessment: content.match(/^## retained usefulness assessment\r?\n- (.+)$/m)?.[1]?.trim() || "",
    nextBoundedAction: content.match(/^## next bounded action if reopen\r?\n- (.+)$/m)?.[1]?.trim() || "",
    rollbackNote: content.match(/^## rollback note\r?\n- (.+)$/m)?.[1]?.trim() || "",
    content,
  };
}
