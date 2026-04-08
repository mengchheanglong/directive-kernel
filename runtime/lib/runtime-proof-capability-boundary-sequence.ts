import {
  normalizeDirectiveApprovalActor,
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveExplicitApproval,
  requireDirectiveString,
  resolveDirectiveWorkspaceRelativePath,
} from "../../engine/approval-boundary.ts";
import type {
  DirectiveRunnerActionResult,
  DirectiveRuntimeTwoStepSequenceStepRecord,
} from "../../engine/execution/directive-runner-state.ts";
import { readDirectiveRuntimeRecordArtifact } from "./runtime-record-proof-opener.ts";
import {
  buildDirectiveRuntimeTwoStepSequenceRunnerId,
  runDirectiveRuntimeTwoStepSequence,
  type DirectiveRuntimeTwoStepSequenceInterruptionPoint,
  type DirectiveRuntimeTwoStepSequenceInterruptedResult,
  type DirectiveRuntimeTwoStepSequenceSuccessResult,
} from "./runtime-sequence-shared.ts";

export type DirectiveRuntimeProofCapabilityBoundarySequenceAction =
  | "runtime_proof_open"
  | "runtime_capability_boundary_open";

export type DirectiveRuntimeProofCapabilityBoundarySequenceStepInput = {
  actionKind: DirectiveRuntimeProofCapabilityBoundarySequenceAction;
  targetPath: string;
  approvedBy: string;
};

export type DirectiveRuntimeProofCapabilityBoundarySequenceInterruptionPoint =
  DirectiveRuntimeTwoStepSequenceInterruptionPoint;

export type DirectiveRuntimeProofCapabilityBoundarySequenceInput = {
  steps: [
    DirectiveRuntimeProofCapabilityBoundarySequenceStepInput,
    DirectiveRuntimeProofCapabilityBoundarySequenceStepInput,
  ];
  approved?: boolean;
  directiveRoot?: string;
  sequenceId?: string | null;
  testInterruptPoint?: DirectiveRuntimeProofCapabilityBoundarySequenceInterruptionPoint;
};

export type DirectiveRuntimeProofCapabilityBoundarySequenceSuccessResult =
  DirectiveRuntimeTwoStepSequenceSuccessResult;

export type DirectiveRuntimeProofCapabilityBoundarySequenceInterruptedResult =
  DirectiveRuntimeTwoStepSequenceInterruptedResult;

export type DirectiveRuntimeProofCapabilityBoundarySequenceResult =
  | DirectiveRuntimeProofCapabilityBoundarySequenceSuccessResult
  | DirectiveRuntimeProofCapabilityBoundarySequenceInterruptedResult;

const REQUIRED_SEQUENCE: [
  DirectiveRuntimeProofCapabilityBoundarySequenceAction,
  DirectiveRuntimeProofCapabilityBoundarySequenceAction,
] = [
  "runtime_proof_open",
  "runtime_capability_boundary_open",
] as const;

function buildDefaultSequenceId(caseId: string) {
  return `runtime-proof-capability-boundary-sequence-${caseId}`;
}

function normalizeDeclaredSequence(input: {
  directiveRoot: string;
  sequenceId?: string | null;
  steps: [
    DirectiveRuntimeProofCapabilityBoundarySequenceStepInput,
    DirectiveRuntimeProofCapabilityBoundarySequenceStepInput,
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

  const runtimeRecordTargetPath = resolveDirectiveWorkspaceRelativePath(
    input.directiveRoot,
    input.steps[0].targetPath,
    "steps[0].targetPath",
  );
  const runtimeRecordArtifact = readDirectiveRuntimeRecordArtifact({
    directiveRoot: input.directiveRoot,
    runtimeRecordPath: runtimeRecordTargetPath,
  });
  const capabilityBoundaryTargetPath = resolveDirectiveWorkspaceRelativePath(
    input.directiveRoot,
    input.steps[1].targetPath,
    "steps[1].targetPath",
  );
  if (capabilityBoundaryTargetPath !== runtimeRecordArtifact.runtimeProofRelativePath) {
    throw new Error(
      `invalid_input: steps[1].targetPath must exactly match the Runtime proof opened by step 1 (${runtimeRecordArtifact.runtimeProofRelativePath})`,
    );
  }

  const caseId = runtimeRecordArtifact.candidateId;
  const sequenceId = (input.sequenceId || "").trim() || buildDefaultSequenceId(caseId);
  return {
    caseId,
    sequenceId,
    steps: [
      {
        stepIndex: 1,
        actionKind: "runtime_proof_open",
        targetPath: runtimeRecordTargetPath,
        approvedBy: normalizeDirectiveApprovalActor(
          requireDirectiveString(input.steps[0].approvedBy, "steps[0].approvedBy"),
        ),
        runnerId: buildDirectiveRuntimeTwoStepSequenceRunnerId({
          sequenceId,
          stepIndex: 1,
          actionKind: "runtime_proof_open",
        }),
        completedAt: null,
        actionResult: null,
      },
      {
        stepIndex: 2,
        actionKind: "runtime_capability_boundary_open",
        targetPath: capabilityBoundaryTargetPath,
        approvedBy: normalizeDirectiveApprovalActor(
          requireDirectiveString(input.steps[1].approvedBy, "steps[1].approvedBy"),
        ),
        runnerId: buildDirectiveRuntimeTwoStepSequenceRunnerId({
          sequenceId,
          stepIndex: 2,
          actionKind: "runtime_capability_boundary_open",
        }),
        completedAt: null,
        actionResult: null,
      },
    ] satisfies [
      DirectiveRuntimeTwoStepSequenceStepRecord,
      DirectiveRuntimeTwoStepSequenceStepRecord,
    ],
  };
}

function buildStep2MismatchError(runtimeResult: DirectiveRunnerActionResult) {
  return `invalid_input: declared step 2 target does not match step 1 opened Runtime proof ${runtimeResult.runtimeProofRelativePath}`;
}

export function runDirectiveRuntimeProofCapabilityBoundaryTwoStepSequence(
  input: DirectiveRuntimeProofCapabilityBoundarySequenceInput,
): DirectiveRuntimeProofCapabilityBoundarySequenceResult {
  requireDirectiveExplicitApproval({
    approved: input.approved,
    action: "run the explicit Runtime proof -> capability-boundary two-step sequence",
  });

  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const declared = normalizeDeclaredSequence({
    directiveRoot,
    sequenceId: input.sequenceId,
    steps: input.steps,
  });

  return runDirectiveRuntimeTwoStepSequence({
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
    expectedStep2TargetPath: (runtimeResult) => runtimeResult.runtimeProofRelativePath,
    afterStep1MismatchError: buildStep2MismatchError,
  });
}
