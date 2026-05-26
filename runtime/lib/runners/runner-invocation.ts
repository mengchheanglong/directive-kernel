import {
  normalizeDirectiveWorkspaceRoot,
} from "../../../engine/approval-boundary.ts";
import {
  readActionRunnerRecord,
  resolveDirectiveRunnerRecordPath,
  type ActionRunnerRecord,
  type RunnerActionKind,
  type RunnerActionResult,
} from "../../../engine/execution/runner-state.ts";
import {
  runDirectiveRuntimeCapabilityBoundaryWithRunner,
  type RuntimeCapabilityBoundaryRunnerResult,
} from "./capability-boundary-runner.ts";
import {
  runDirectiveRuntimeFollowUpWithRunner,
  type RuntimeFollowUpRunnerResult,
} from "./follow-up-runner.ts";
import {
  runDirectiveRuntimePromotionReadinessWithRunner,
  type RuntimePromotionReadinessRunnerResult,
} from "./promotion-readiness-runner.ts";
import {
  runDirectiveRuntimeProofOpenWithRunner,
  type RuntimeProofOpenRunnerResult,
} from "./proof-open-runner.ts";

export const DIRECTIVE_RUNTIME_SHARED_INVOCATION_ACTIONS = [
  "runtime_follow_up_open",
  "runtime_proof_open",
  "runtime_capability_boundary_open",
  "runtime_promotion_readiness_open",
] as const satisfies RunnerActionKind[];

export type RuntimeSharedInvocationActionKind =
  (typeof DIRECTIVE_RUNTIME_SHARED_INVOCATION_ACTIONS)[number];

export type RuntimeSharedInvocationInterruptionPoint =
  | "after_before_action_checkpoint"
  | "after_after_action_checkpoint";

export type RuntimeSharedInvocationInput = {
  actionKind: RuntimeSharedInvocationActionKind;
  targetPath: string;
  approved?: boolean;
  approvedBy?: string | null;
  directiveRoot?: string;
  runnerId?: string | null;
  testInterruptPoint?: RuntimeSharedInvocationInterruptionPoint;
};

type DirectiveRuntimeSharedInvocationBaseResult = {
  actionKind: RuntimeSharedInvocationActionKind;
  dispatchCount: 1;
  targetPath: string;
  runnerId: string;
  caseId: string;
  resumed: boolean;
  lifecycleState: ActionRunnerRecord["lifecycleState"];
  checkpointStage: ActionRunnerRecord["checkpointStage"];
  runnerRecordPath: string;
  runnerRecord: ActionRunnerRecord;
};

export type RuntimeSharedInvocationSuccessResult =
  DirectiveRuntimeSharedInvocationBaseResult & {
    ok: true;
    replayedFromCheckpoint: boolean;
    lifecycleState: "completed";
    checkpointStage: "completed";
    actionResult: RunnerActionResult;
  };

export type RuntimeSharedInvocationInterruptedResult =
  DirectiveRuntimeSharedInvocationBaseResult & {
    ok: false;
    interrupted: true;
    lifecycleState: "interrupted";
    checkpointStage: "before_action" | "after_action";
    reason: string;
  };

export type RuntimeSharedInvocationResult =
  | RuntimeSharedInvocationSuccessResult
  | RuntimeSharedInvocationInterruptedResult;

function readRunnerRecordOrThrow(input: {
  directiveRoot: string;
  runnerId: string;
  actionKind: RuntimeSharedInvocationActionKind;
}) {
  const runnerRecordPath = resolveDirectiveRunnerRecordPath({
    directiveRoot: input.directiveRoot,
    runnerId: input.runnerId,
  });
  const runnerRecord = readActionRunnerRecord({
    directiveRoot: input.directiveRoot,
    runnerId: input.runnerId,
  }).record;
  if (!runnerRecord) {
    throw new Error(
      `invalid_state: shared invocation expected runner record for ${input.actionKind} (${input.runnerId})`,
    );
  }
  if (runnerRecord.actionKind !== input.actionKind) {
    throw new Error(
      `invalid_state: shared invocation dispatched ${input.actionKind} but runner ${input.runnerId} stored ${runnerRecord.actionKind}`,
    );
  }
  return {
    runnerRecordPath,
    runnerRecord,
  };
}

function dispatchRuntimeAction(input: {
  actionKind: RuntimeSharedInvocationActionKind;
  targetPath: string;
  approved?: boolean;
  approvedBy?: string | null;
  directiveRoot: string;
  runnerId?: string | null;
  testInterruptPoint?: RuntimeSharedInvocationInterruptionPoint;
}):
  | RuntimeFollowUpRunnerResult
  | RuntimeProofOpenRunnerResult
  | RuntimeCapabilityBoundaryRunnerResult
  | RuntimePromotionReadinessRunnerResult {
  switch (input.actionKind) {
    case "runtime_follow_up_open":
      return runDirectiveRuntimeFollowUpWithRunner({
        directiveRoot: input.directiveRoot,
        runnerId: input.runnerId,
        followUpPath: input.targetPath,
        approved: input.approved,
        approvedBy: input.approvedBy,
        testInterruptPoint: input.testInterruptPoint,
      });
    case "runtime_proof_open":
      return runDirectiveRuntimeProofOpenWithRunner({
        directiveRoot: input.directiveRoot,
        runnerId: input.runnerId,
        runtimeRecordPath: input.targetPath,
        approved: input.approved,
        approvedBy: input.approvedBy,
        testInterruptPoint: input.testInterruptPoint,
      });
    case "runtime_capability_boundary_open":
      return runDirectiveRuntimeCapabilityBoundaryWithRunner({
        directiveRoot: input.directiveRoot,
        runnerId: input.runnerId,
        runtimeProofPath: input.targetPath,
        approved: input.approved,
        approvedBy: input.approvedBy,
        testInterruptPoint: input.testInterruptPoint,
      });
    case "runtime_promotion_readiness_open":
      return runDirectiveRuntimePromotionReadinessWithRunner({
        directiveRoot: input.directiveRoot,
        runnerId: input.runnerId,
        capabilityBoundaryPath: input.targetPath,
        approved: input.approved,
        approvedBy: input.approvedBy,
        testInterruptPoint: input.testInterruptPoint,
      });
    default: {
      const exhaustiveCheck: never = input.actionKind;
      throw new Error(`invalid_input: unsupported Runtime action kind: ${exhaustiveCheck}`);
    }
  }
}

export function runDirectiveRuntimeActionByExplicitInvocation(
  input: RuntimeSharedInvocationInput,
): RuntimeSharedInvocationResult {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const dispatched = dispatchRuntimeAction({
    actionKind: input.actionKind,
    targetPath: input.targetPath,
    approved: input.approved,
    approvedBy: input.approvedBy,
    directiveRoot,
    runnerId: input.runnerId,
    testInterruptPoint: input.testInterruptPoint,
  });
  const { runnerRecordPath, runnerRecord } = readRunnerRecordOrThrow({
    directiveRoot,
    runnerId: dispatched.runnerId,
    actionKind: input.actionKind,
  });

  if (dispatched.ok) {
    return {
      ok: true,
      actionKind: input.actionKind,
      dispatchCount: 1,
      targetPath: input.targetPath,
      runnerId: dispatched.runnerId,
      caseId: dispatched.caseId,
      resumed: dispatched.resumed,
      replayedFromCheckpoint: dispatched.replayedFromCheckpoint,
      lifecycleState: "completed",
      checkpointStage: "completed",
      runnerRecordPath,
      runnerRecord,
      actionResult: dispatched.actionResult,
    };
  }

  return {
    ok: false,
    interrupted: true,
    actionKind: input.actionKind,
    dispatchCount: 1,
    targetPath: input.targetPath,
    runnerId: dispatched.runnerId,
    caseId: dispatched.caseId,
    resumed: dispatched.resumed,
    lifecycleState: "interrupted",
    checkpointStage: dispatched.checkpointStage,
    runnerRecordPath,
    runnerRecord,
    reason: dispatched.reason,
  };
}
