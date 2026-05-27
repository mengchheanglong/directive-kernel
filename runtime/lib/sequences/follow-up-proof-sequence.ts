import {
  normalizeDirectiveApprovalActor,
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveExplicitApproval,
  requireDirectiveString,
  resolveDirectiveWorkspaceRelativePath,
} from "../../../engine/approval-boundary.ts";
import type {
  RunnerActionResult,
  RuntimeTwoStepSequenceStepRecord,
} from "../../../engine/execution/runner-state.ts";
import { readRuntimeFollowUpArtifact } from "../openers/follow-up.ts";
import {
  buildDirectiveRuntimeTwoStepSequenceRunnerId,
  runDirectiveRuntimeTwoStepSequence,
  type RuntimeTwoStepSequenceInterruptionPoint,
  type RuntimeTwoStepSequenceInterruptedResult,
  type RuntimeTwoStepSequenceSuccessResult,
} from "./sequence-shared.ts";

export type RuntimeFollowUpProofSequenceAction =
  | "runtime_follow_up_open"
  | "runtime_proof_open";

export type RuntimeFollowUpProofSequenceStepInput = {
  actionKind: RuntimeFollowUpProofSequenceAction;
  targetPath: string;
  approvedBy: string;
};

export type RuntimeFollowUpProofSequenceInterruptionPoint =
  RuntimeTwoStepSequenceInterruptionPoint;

export type RuntimeFollowUpProofSequenceInput = {
  steps: [
    RuntimeFollowUpProofSequenceStepInput,
    RuntimeFollowUpProofSequenceStepInput,
  ];
  approved?: boolean;
  directiveRoot?: string;
  sequenceId?: string | null;
  testInterruptPoint?: RuntimeFollowUpProofSequenceInterruptionPoint;
};

export type RuntimeFollowUpProofSequenceSuccessResult =
  RuntimeTwoStepSequenceSuccessResult;

export type RuntimeFollowUpProofSequenceInterruptedResult =
  RuntimeTwoStepSequenceInterruptedResult;

export type RuntimeFollowUpProofSequenceResult =
  | RuntimeFollowUpProofSequenceSuccessResult
  | RuntimeFollowUpProofSequenceInterruptedResult;

const REQUIRED_SEQUENCE: [
  RuntimeFollowUpProofSequenceAction,
  RuntimeFollowUpProofSequenceAction,
] = [
  "runtime_follow_up_open",
  "runtime_proof_open",
] as const;

function buildDefaultSequenceId(caseId: string) {
  return `runtime-follow-up-proof-sequence-${caseId}`;
}

function normalizeDeclaredSequence(input: {
  directiveRoot: string;
  sequenceId?: string | null;
  steps: [
    RuntimeFollowUpProofSequenceStepInput,
    RuntimeFollowUpProofSequenceStepInput,
  ];
}) {
  if (input.steps.length !== 2) {
    throw new Error("invalid_input: this experiment requires exactly two predeclared Runtime actions");
  }

  const normalizedStep1Action = input.steps[0].actionKind;
  const normalizedStep2Action = input.steps[1].actionKind;
  if (
    normalizedStep1Action !== REQUIRED_SEQUENCE[0]
    || normalizedStep2Action !== REQUIRED_SEQUENCE[1]
  ) {
    throw new Error(
      `invalid_input: this experiment only supports the ordered Runtime action pair ${REQUIRED_SEQUENCE.join(" -> ")}`,
    );
  }

  const followUpTargetPath = resolveDirectiveWorkspaceRelativePath(
    input.directiveRoot,
    input.steps[0].targetPath,
    "steps[0].targetPath",
  );
  const followUpArtifact = readRuntimeFollowUpArtifact({
    directiveRoot: input.directiveRoot,
    followUpPath: followUpTargetPath,
  });
  const proofTargetPath = resolveDirectiveWorkspaceRelativePath(
    input.directiveRoot,
    input.steps[1].targetPath,
    "steps[1].targetPath",
  );
  if (proofTargetPath !== followUpArtifact.runtimeRecordRelativePath) {
    throw new Error(
      `invalid_input: steps[1].targetPath must exactly match the Runtime record opened by step 1 (${followUpArtifact.runtimeRecordRelativePath})`,
    );
  }

  const caseId = followUpArtifact.candidateId;
  const sequenceId = (input.sequenceId || "").trim() || buildDefaultSequenceId(caseId);
  return {
    caseId,
    sequenceId,
    steps: [
      {
        stepIndex: 1,
        actionKind: "runtime_follow_up_open",
        targetPath: followUpTargetPath,
        approvedBy: normalizeDirectiveApprovalActor(
          requireDirectiveString(input.steps[0].approvedBy, "steps[0].approvedBy"),
        ),
        runnerId: buildDirectiveRuntimeTwoStepSequenceRunnerId({
          sequenceId,
          stepIndex: 1,
          actionKind: "runtime_follow_up_open",
        }),
        completedAt: null,
        actionResult: null,
      },
      {
        stepIndex: 2,
        actionKind: "runtime_proof_open",
        targetPath: proofTargetPath,
        approvedBy: normalizeDirectiveApprovalActor(
          requireDirectiveString(input.steps[1].approvedBy, "steps[1].approvedBy"),
        ),
        runnerId: buildDirectiveRuntimeTwoStepSequenceRunnerId({
          sequenceId,
          stepIndex: 2,
          actionKind: "runtime_proof_open",
        }),
        completedAt: null,
        actionResult: null,
      },
    ] satisfies [
      RuntimeTwoStepSequenceStepRecord,
      RuntimeTwoStepSequenceStepRecord,
    ],
  };
}

function buildStep2MismatchError(runtimeResult: RunnerActionResult) {
  return `invalid_input: declared step 2 target does not match step 1 opened Runtime record ${runtimeResult.runtimeRecordRelativePath}`;
}

export async function runDirectiveRuntimeFollowUpProofTwoStepSequence(
  input: RuntimeFollowUpProofSequenceInput,
): Promise<RuntimeFollowUpProofSequenceResult> {
  requireDirectiveExplicitApproval({
    approved: input.approved,
    action: "run the explicit Runtime follow-up -> proof two-step sequence",
  });

  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const declared = normalizeDeclaredSequence({
    directiveRoot,
    sequenceId: input.sequenceId,
    steps: input.steps,
  });

  return await runDirectiveRuntimeTwoStepSequence({
    directiveRoot,
    approved: input.approved,
    declared,
    testInterruptPoint: input.testInterruptPoint,
    existingRecordGuardError:
      `invalid_input: sequence ${declared.sequenceId} already exists for a different declared two-step Runtime sequence`,
    resumedFromAfterStep2Message:
      "Two-step sequence resumed from after_step_2 checkpoint without re-executing any step.",
    completedFromAfterStep2Message:
      "Two-step sequence completed from stored after_step_2 checkpoint.",
    resumedSequenceMessage:
      "Two-step sequence resumed from stored sequence state.",
    firstInvocationMessage:
      "Two-step sequence invoked for the first time.",
    beforeStep1CheckpointMessage:
      "Two-step sequence checkpointed before step 1.",
    afterStep1CheckpointMessage:
      "Two-step sequence checkpointed after step 1 completed.",
    afterStep2CheckpointMessage:
      "Two-step sequence checkpointed after step 2 completed.",
    completedMessage:
      "Two-step explicit Runtime sequence completed.",
    afterStep1PrerequisiteError:
      `invalid_state: two-step sequence ${declared.sequenceId} cannot continue to step 2 without a completed step 1 result`,
    expectedStep2TargetPath: (runtimeResult) => runtimeResult.runtimeRecordRelativePath,
    afterStep1MismatchError: buildStep2MismatchError,
  });
}
