import {
  normalizeDirectiveWorkspaceRoot,
} from "../../../engine/approval-boundary.ts";
import {
  runDirectiveRuntimeFollowUpProofTwoStepSequence,
  type RuntimeFollowUpProofSequenceInput,
  type RuntimeFollowUpProofSequenceResult,
  type RuntimeFollowUpProofSequenceSuccessResult,
} from "./follow-up-proof-sequence.ts";
import {
  runDirectiveRuntimeProofCapabilityBoundaryTwoStepSequence,
  type RuntimeProofCapabilityBoundarySequenceInput,
  type RuntimeProofCapabilityBoundarySequenceResult,
  type RuntimeProofCapabilityBoundarySequenceSuccessResult,
} from "./proof-capability-boundary-sequence.ts";

export const DIRECTIVE_RUNTIME_NAMED_SEQUENCE_KINDS = [
  "runtime_follow_up_to_proof",
  "runtime_proof_to_capability_boundary",
] as const;

export type RuntimeNamedSequenceKind =
  (typeof DIRECTIVE_RUNTIME_NAMED_SEQUENCE_KINDS)[number];

export type RuntimeNamedSequenceInterruptionPoint =
  | "after_before_step_1_checkpoint"
  | "after_step_1_checkpoint"
  | "after_step_2_checkpoint";

export type RuntimeNamedSequenceInput =
  | {
    sequenceKind: "runtime_follow_up_to_proof";
    steps: RuntimeFollowUpProofSequenceInput["steps"];
    approved?: boolean;
    directiveRoot?: string;
    sequenceId?: string | null;
    testInterruptPoint?: RuntimeNamedSequenceInterruptionPoint;
  }
  | {
    sequenceKind: "runtime_proof_to_capability_boundary";
    steps: RuntimeProofCapabilityBoundarySequenceInput["steps"];
    approved?: boolean;
    directiveRoot?: string;
    sequenceId?: string | null;
    testInterruptPoint?: RuntimeNamedSequenceInterruptionPoint;
  };

type DirectiveRuntimeNamedSequenceBaseResult = {
  sequenceKind: RuntimeNamedSequenceKind;
  dispatchCount: 1;
  sequenceId: string;
  caseId: string;
  resumed: boolean;
  declaredActionCount: 2;
  executedActionCount: 0 | 1 | 2;
  completedStepCount: 0 | 1 | 2;
  lifecycleState: "running" | "interrupted" | "failed" | "completed";
  checkpointStage: "before_step_1" | "after_step_1" | "after_step_2" | "completed";
  sequenceRecordPath: string;
  sequenceRecord:
    | RuntimeFollowUpProofSequenceResult["sequenceRecord"]
    | RuntimeProofCapabilityBoundarySequenceResult["sequenceRecord"];
};

export type RuntimeNamedSequenceSuccessResult =
  DirectiveRuntimeNamedSequenceBaseResult & {
    ok: true;
    replayedFromCheckpoint: boolean;
    lifecycleState: "completed";
    checkpointStage: "completed";
    stepResults:
      | RuntimeFollowUpProofSequenceSuccessResult["stepResults"]
      | RuntimeProofCapabilityBoundarySequenceSuccessResult["stepResults"];
  };

export type RuntimeNamedSequenceInterruptedResult =
  DirectiveRuntimeNamedSequenceBaseResult & {
    ok: false;
    interrupted: true;
    lifecycleState: "interrupted";
    checkpointStage: "before_step_1" | "after_step_1" | "after_step_2";
    reason: string;
  };

export type RuntimeNamedSequenceResult =
  | RuntimeNamedSequenceSuccessResult
  | RuntimeNamedSequenceInterruptedResult;

function dispatchNamedSequence(input: RuntimeNamedSequenceInput & { directiveRoot: string }) {
  switch (input.sequenceKind) {
    case "runtime_follow_up_to_proof":
      return runDirectiveRuntimeFollowUpProofTwoStepSequence({
        directiveRoot: input.directiveRoot,
        steps: input.steps,
        approved: input.approved,
        sequenceId: input.sequenceId,
        testInterruptPoint: input.testInterruptPoint,
      });
    case "runtime_proof_to_capability_boundary":
      return runDirectiveRuntimeProofCapabilityBoundaryTwoStepSequence({
        directiveRoot: input.directiveRoot,
        steps: input.steps,
        approved: input.approved,
        sequenceId: input.sequenceId,
        testInterruptPoint: input.testInterruptPoint,
      });
  }
}

export function runDirectiveRuntimeNamedSequenceByExplicitInvocation(
  input: RuntimeNamedSequenceInput,
): RuntimeNamedSequenceResult {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const dispatched = dispatchNamedSequence({
    ...input,
    directiveRoot,
  });

  if ("stepResults" in dispatched) {
    return {
      ok: true,
      sequenceKind: input.sequenceKind,
      dispatchCount: 1,
      sequenceId: dispatched.sequenceId,
      caseId: dispatched.caseId,
      resumed: dispatched.resumed,
      replayedFromCheckpoint: dispatched.replayedFromCheckpoint,
      declaredActionCount: dispatched.declaredActionCount,
      executedActionCount: dispatched.executedActionCount,
      completedStepCount: dispatched.completedStepCount,
      lifecycleState: "completed",
      checkpointStage: "completed",
      sequenceRecordPath: dispatched.sequenceRecordPath,
      sequenceRecord: dispatched.sequenceRecord,
      stepResults: dispatched.stepResults,
    };
  }

  return {
    ok: false,
    interrupted: true,
    sequenceKind: input.sequenceKind,
    dispatchCount: 1,
    sequenceId: dispatched.sequenceId,
    caseId: dispatched.caseId,
    resumed: dispatched.resumed,
    declaredActionCount: dispatched.declaredActionCount,
    executedActionCount: dispatched.executedActionCount,
    completedStepCount: dispatched.completedStepCount,
    lifecycleState: "interrupted",
    checkpointStage: dispatched.checkpointStage,
    sequenceRecordPath: dispatched.sequenceRecordPath,
    sequenceRecord: dispatched.sequenceRecord,
    reason: dispatched.reason,
  };
}
