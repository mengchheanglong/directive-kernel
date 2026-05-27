import {
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveExplicitApproval,
} from "../../../engine/approval-boundary.ts";
import {
  readActionRunnerRecord,
} from "../../../engine/orchestration/runner-state.ts";
import {
  openDirectiveRuntimeFollowUp,
  readRuntimeFollowUpArtifact,
} from "./follow-up.ts";
import {
  buildDirectiveRuntimeRunnerId,
  runDirectiveRuntimeCheckpointRunner,
  type RuntimeCheckpointRunnerInterruptedResult,
  type RuntimeCheckpointRunnerInterruptionPoint,
  type RuntimeCheckpointRunnerSuccessResult,
} from "./runner-shared.ts";

export type RuntimeFollowUpRunnerInterruptionPoint =
  RuntimeCheckpointRunnerInterruptionPoint;

export type RuntimeFollowUpRunnerSuccessResult =
  RuntimeCheckpointRunnerSuccessResult;

export type RuntimeFollowUpRunnerInterruptedResult =
  RuntimeCheckpointRunnerInterruptedResult;

export type RuntimeFollowUpRunnerResult =
  | RuntimeFollowUpRunnerSuccessResult
  | RuntimeFollowUpRunnerInterruptedResult;

const RUNNER_ID_PREFIX = "runtime-follow-up-open";
const RUNNER_ACTION_KIND = "runtime_follow_up_open";

function toRunnerActionResult(input: Awaited<ReturnType<typeof openDirectiveRuntimeFollowUp>>) {
  return {
    created: input.created,
    directiveRoot: input.directiveRoot,
    followUpRelativePath: input.followUpRelativePath,
    runtimeRecordRelativePath: input.runtimeRecordRelativePath,
    runtimeRecordAbsolutePath: input.runtimeRecordAbsolutePath,
    candidateId: input.candidateId,
    candidateName: input.candidateName,
  };
}

export async function runDirectiveRuntimeFollowUpWithRunner(input: {
  followUpPath: string;
  approved?: boolean;
  approvedBy?: string | null;
  directiveRoot?: string;
  runnerId?: string | null;
  testInterruptPoint?: RuntimeFollowUpRunnerInterruptionPoint;
}): Promise<RuntimeFollowUpRunnerResult> {
  requireDirectiveExplicitApproval({
    approved: input.approved,
    action: "run the Runtime follow-up opener through the checkpoint runner",
  });

  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const artifact = readRuntimeFollowUpArtifact({
    directiveRoot,
    followUpPath: input.followUpPath,
  });
  const caseId = artifact.candidateId;
  const runnerId = (input.runnerId || "").trim() || buildDirectiveRuntimeRunnerId(RUNNER_ID_PREFIX, caseId);
  const existing = readActionRunnerRecord({
    directiveRoot,
    runnerId,
  }).record;
  if (existing && existing.actionKind !== "runtime_follow_up_open") {
    throw new Error(`invalid_input: runner ${runnerId} is not a Runtime follow-up runner`);
  }

  return await runDirectiveRuntimeCheckpointRunner({
    directiveRoot,
    runnerId,
    caseId,
    actionKind: RUNNER_ACTION_KIND,
    actionPath: artifact.followUpRelativePath,
    existingRecord: existing,
    testInterruptPoint: input.testInterruptPoint,
    resumedFromAfterActionMessage:
      "Runner resumed from after_action checkpoint without re-executing the opener.",
    completedFromAfterActionMessage:
      "Runner completed from stored after_action checkpoint.",
    resumedBeforeActionMessage:
      "Runner resumed and restored the before_action checkpoint.",
    firstInvocationMessage:
      "Runner invoked for the first time.",
    beforeActionCheckpointMessage:
      "Runner checkpointed before calling the Runtime follow-up opener.",
    afterActionCheckpointMessage:
      "Runner checkpointed after the Runtime follow-up opener completed.",
    completedAfterActionMessage:
      "Runner completed after the after_action checkpoint.",
    action: async () => toRunnerActionResult(
      await openDirectiveRuntimeFollowUp({
        directiveRoot,
        followUpPath: artifact.followUpRelativePath,
        approved: input.approved,
        approvedBy: input.approvedBy,
      }),
    ),
  });
}
