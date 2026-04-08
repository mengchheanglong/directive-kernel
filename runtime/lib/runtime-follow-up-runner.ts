import {
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveExplicitApproval,
} from "../../engine/approval-boundary.ts";
import {
  readDirectiveActionRunnerRecord,
} from "../../engine/execution/directive-runner-state.ts";
import {
  openDirectiveRuntimeFollowUp,
  readDirectiveRuntimeFollowUpArtifact,
} from "./runtime-follow-up-opener.ts";
import {
  buildDirectiveRuntimeRunnerId,
  runDirectiveRuntimeCheckpointRunner,
  type DirectiveRuntimeCheckpointRunnerInterruptedResult,
  type DirectiveRuntimeCheckpointRunnerInterruptionPoint,
  type DirectiveRuntimeCheckpointRunnerSuccessResult,
} from "./runtime-runner-shared.ts";

export type DirectiveRuntimeFollowUpRunnerInterruptionPoint =
  DirectiveRuntimeCheckpointRunnerInterruptionPoint;

export type DirectiveRuntimeFollowUpRunnerSuccessResult =
  DirectiveRuntimeCheckpointRunnerSuccessResult;

export type DirectiveRuntimeFollowUpRunnerInterruptedResult =
  DirectiveRuntimeCheckpointRunnerInterruptedResult;

export type DirectiveRuntimeFollowUpRunnerResult =
  | DirectiveRuntimeFollowUpRunnerSuccessResult
  | DirectiveRuntimeFollowUpRunnerInterruptedResult;

const RUNNER_ID_PREFIX = "runtime-follow-up-open";
const RUNNER_ACTION_KIND = "runtime_follow_up_open";

function toRunnerActionResult(input: ReturnType<typeof openDirectiveRuntimeFollowUp>) {
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

export function runDirectiveRuntimeFollowUpWithRunner(input: {
  followUpPath: string;
  approved?: boolean;
  approvedBy?: string | null;
  directiveRoot?: string;
  runnerId?: string | null;
  testInterruptPoint?: DirectiveRuntimeFollowUpRunnerInterruptionPoint;
}): DirectiveRuntimeFollowUpRunnerResult {
  requireDirectiveExplicitApproval({
    approved: input.approved,
    action: "run the Runtime follow-up opener through the checkpoint runner",
  });

  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const artifact = readDirectiveRuntimeFollowUpArtifact({
    directiveRoot,
    followUpPath: input.followUpPath,
  });
  const caseId = artifact.candidateId;
  const runnerId = (input.runnerId || "").trim() || buildDirectiveRuntimeRunnerId(RUNNER_ID_PREFIX, caseId);
  const existing = readDirectiveActionRunnerRecord({
    directiveRoot,
    runnerId,
  }).record;
  if (existing && existing.actionKind !== "runtime_follow_up_open") {
    throw new Error(`invalid_input: runner ${runnerId} is not a Runtime follow-up runner`);
  }

  return runDirectiveRuntimeCheckpointRunner({
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
    action: () => toRunnerActionResult(
      openDirectiveRuntimeFollowUp({
        directiveRoot,
        followUpPath: artifact.followUpRelativePath,
        approved: input.approved,
        approvedBy: input.approvedBy,
      }),
    ),
  });
}
