import fs from "node:fs";
import path from "node:path";
import {
  normalizeDirectiveApprovalActor,
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveString,
  resolveDirectiveWorkspaceRelativePath,
  writeDirectiveArtifactIfMissing,
} from "../../engine/approval-boundary.ts";

import {
  readDirectiveArchitectureBoundedResultArtifact,
  type DirectiveArchitectureBoundedResultArtifact,
} from "./architecture-bounded-closeout.ts";
import {
  readDirectiveArchitecturePostConsumptionEvaluationDetail,
} from "./architecture-post-consumption-evaluation.ts";

export type ReopenDirectiveArchitectureFromEvaluationInput = {
  evaluationPath: string;
  directiveRoot?: string;
  reopenedBy?: string | null;
};

export type DirectiveArchitectureReopenedStartResult = {
  ok: true;
  created: boolean;
  snapshotAt: string;
  directiveRoot: string;
  evaluationRelativePath: string;
  evaluationAbsolutePath: string;
  reopenedStartRelativePath: string;
  reopenedStartAbsolutePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  objective: string;
};

function resolveReopenedStartRelativePath(evaluationRelativePath: string) {
  const fileName = path.posix.basename(evaluationRelativePath);
  if (!fileName.endsWith("-evaluation.md")) {
    throw new Error("invalid_input: evaluationPath must point to a post-consumption evaluation artifact");
  }

  return path.posix.join(
    "architecture/01-experiments",
    fileName.replace(/-evaluation\.md$/u, "-reopened-bounded-start.md"),
  );
}

function renderReopenedBoundedStartMarkdown(input: {
  snapshotAt: string;
  reopenedBy: string;
  evaluationRelativePath: string;
  evaluationDetail: ReturnType<typeof readDirectiveArchitecturePostConsumptionEvaluationDetail>;
  sourceResult: DirectiveArchitectureBoundedResultArtifact;
  reopenedStartRelativePath: string;
}) {
  const sourceResult = input.sourceResult;
  const evaluation = input.evaluationDetail;
  const boundedScope = [
    "Reopen only the bounded Architecture slice implicated by the post-consumption evaluation.",
    evaluation.nextBoundedAction,
    ...sourceResult.boundedScope,
  ].filter(Boolean).map((item) => `- ${item}`).join("\n");
  const inputs = [
    `Post-consumption rationale: ${evaluation.rationale}`,
    `Observed stability: ${evaluation.observedStability}`,
    `Retained usefulness assessment: ${evaluation.retainedUsefulnessAssessment}`,
    `Previous bounded result summary: ${sourceResult.resultSummary}`,
    ...sourceResult.inputs,
  ].map((item) => `- ${item}`).join("\n");
  const validationGates = [
    ...sourceResult.validationGates,
    "decision_review",
  ]
    .filter((value, index, all) => value && all.indexOf(value) === index)
    .map((item) => `- \`${item}\``)
    .join("\n");

  return [
    `# ${sourceResult.title} Reopened Bounded Architecture Start`,
    "",
    `- Candidate id: ${sourceResult.candidateId}`,
    `- Candidate name: ${sourceResult.candidateName}`,
    `- Experiment date: ${input.snapshotAt.slice(0, 10)}`,
    "- Owning track: Architecture",
    "- Experiment type: post-consumption reopened bounded start",
    `- Start approval: approved by ${input.reopenedBy} from post-consumption evaluation \`${input.evaluationRelativePath}\``,
    "",
    `- Objective: ${evaluation.objective}`,
    "- Bounded scope:",
    boundedScope,
    "- Inputs:",
    inputs,
    "- Expected output:",
    "- One reopened bounded Architecture slice that resolves the post-consumption reopen decision without reconstructing prior state by hand.",
    "- Validation gate(s):",
    validationGates || "- `decision_review`",
    "- Transition policy profile: `decision_review`",
    "- Scoring policy profile: `architecture_self_improvement`",
    "- Blocked recovery path: Keep the post-consumption evaluation as the authoritative reopen boundary and stop before any new adoption step.",
    "- Failure criteria: The reopened slice still cannot resolve the keep-versus-reopen pressure inside the bounded Architecture scope.",
    `- Rollback: ${evaluation.rollbackNote}`,
    "- Result summary: pending_execution",
    "- Evidence path:",
    `- Source evaluation ref: \`${input.evaluationRelativePath}\``,
    `- Source consumption record: \`${evaluation.consumptionRelativePath}\``,
    `- Source integration record: \`${evaluation.integrationRelativePath}\``,
    `- Source retained artifact: \`${evaluation.retainedRelativePath}\``,
    `- Previous bounded result: \`${evaluation.sourceResultRelativePath}\``,
    `- Handoff stub: \`${sourceResult.handoffStubPath}\``,
    `- Engine run record: \`${sourceResult.engineRunRecordPath}\``,
    `- Engine run report: \`${sourceResult.engineRunReportPath}\``,
    `- Discovery routing record: \`${sourceResult.discoveryRoutingRecordPath}\``,
    "- Next decision: `needs-more-evidence`",
    "",
    "## Lifecycle classification (per `architecture-artifact-lifecycle` contract)",
    "",
    "- Origin: `source-driven`",
    `- Usefulness level: \`${sourceResult.usefulnessLevel}\``,
    `- Runtime threshold check: ${sourceResult.runtimeThresholdCheck}`,
    "",
    "## Source adaptation fields (Architecture source-driven experiments only)",
    "",
    `- Source analysis ref: ${input.evaluationRelativePath}`,
    `- Adaptation decision ref: ${evaluation.consumptionRelativePath}`,
    "- Adaptation quality: `skipped`",
    "- Improvement quality: `skipped`",
    `- Meta-useful: \`${sourceResult.usefulnessLevel === "meta" ? "yes" : "no"}\``,
    "- Meta-usefulness category: `n/a`",
    "- Transformation artifact gate result: `partial`",
    "- Transformed artifacts produced:",
    `- \`${input.evaluationRelativePath}\``,
    "",
    "## artifact linkage",
    `- This reopened bounded-start artifact is now stored at \`${input.reopenedStartRelativePath}\`.`,
    `- If the reopen decision later proves wrong, resume from \`${input.evaluationRelativePath}\` instead of reconstructing the post-consumption chain by hand.`,
    "",
  ].join("\n");
}

export function reopenDirectiveArchitectureFromEvaluation(
  input: ReopenDirectiveArchitectureFromEvaluationInput,
): DirectiveArchitectureReopenedStartResult {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const evaluationRelativePath = resolveDirectiveWorkspaceRelativePath(
    directiveRoot,
    input.evaluationPath,
    "path",
  );
  const evaluationDetail = readDirectiveArchitecturePostConsumptionEvaluationDetail({
    directiveRoot,
    evaluationPath: evaluationRelativePath,
  });

  if (evaluationDetail.decision !== "reopen") {
    throw new Error("invalid_input: only post-consumption evaluations with decision reopen can open a reopened bounded start");
  }

  const sourceResult = readDirectiveArchitectureBoundedResultArtifact({
    directiveRoot,
    resultPath: evaluationDetail.sourceResultRelativePath,
  });
  const reopenedStartRelativePath = resolveReopenedStartRelativePath(evaluationRelativePath);
  const reopenedStartAbsolutePath = path.resolve(directiveRoot, reopenedStartRelativePath).replace(/\\/g, "/");
  const snapshotAt = new Date().toISOString();
  const reopenedBy = normalizeDirectiveApprovalActor(input.reopenedBy);
  const created = writeDirectiveArtifactIfMissing({
    absolutePath: reopenedStartAbsolutePath,
    content: renderReopenedBoundedStartMarkdown({
      snapshotAt,
      reopenedBy,
      evaluationRelativePath,
      evaluationDetail,
      sourceResult,
      reopenedStartRelativePath,
    }),
  });

  return {
    ok: true,
    created,
    snapshotAt,
    directiveRoot,
    evaluationRelativePath,
    evaluationAbsolutePath: path.resolve(directiveRoot, evaluationRelativePath).replace(/\\/g, "/"),
    reopenedStartRelativePath,
    reopenedStartAbsolutePath,
    candidateId: sourceResult.candidateId,
    candidateName: sourceResult.candidateName,
    usefulnessLevel: sourceResult.usefulnessLevel,
    objective: evaluationDetail.objective,
  };
}
