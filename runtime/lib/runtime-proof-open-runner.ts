import {
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveExplicitApproval,
} from "../../engine/approval-boundary.ts";
import {
  readDirectiveActionRunnerRecord,
} from "../../engine/execution/directive-runner-state.ts";
import {
  openDirectiveRuntimeRecordProof,
  readDirectiveRuntimeRecordArtifact,
} from "./runtime-record-proof-opener.ts";
import {
  buildDirectiveRuntimeRunnerId,
  runDirectiveRuntimeCheckpointRunner,
  type DirectiveRuntimeCheckpointRunnerInterruptedResult,
  type DirectiveRuntimeCheckpointRunnerInterruptionPoint,
  type DirectiveRuntimeCheckpointRunnerSuccessResult,
} from "./runtime-runner-shared.ts";

export type DirectiveRuntimeProofOpenRunnerInterruptionPoint =
  DirectiveRuntimeCheckpointRunnerInterruptionPoint;

export type DirectiveRuntimeProofOpenRunnerSuccessResult =
  DirectiveRuntimeCheckpointRunnerSuccessResult;

export type DirectiveRuntimeProofOpenRunnerInterruptedResult =
  DirectiveRuntimeCheckpointRunnerInterruptedResult;

export type DirectiveRuntimeProofOpenRunnerResult =
  | DirectiveRuntimeProofOpenRunnerSuccessResult
  | DirectiveRuntimeProofOpenRunnerInterruptedResult;

const RUNNER_ID_PREFIX = "runtime-proof-open";
const RUNNER_ACTION_KIND = "runtime_proof_open";

function toRunnerActionResult(input: {
  artifact: ReturnType<typeof readDirectiveRuntimeRecordArtifact>;
  result: ReturnType<typeof openDirectiveRuntimeRecordProof>;
}) {
  return {
    created: input.result.created,
    directiveRoot: input.result.directiveRoot,
    followUpRelativePath: input.artifact.linkedFollowUpRecord,
    runtimeRecordRelativePath: input.result.runtimeRecordRelativePath,
    runtimeRecordAbsolutePath: input.artifact.runtimeRecordAbsolutePath,
    runtimeProofRelativePath: input.result.runtimeProofRelativePath,
    runtimeProofAbsolutePath: input.result.runtimeProofAbsolutePath,
    candidateId: input.result.candidateId,
    candidateName: input.result.candidateName,
  };
}

export function runDirectiveRuntimeProofOpenWithRunner(input: {
  runtimeRecordPath: string;
  approved?: boolean;
  approvedBy?: string | null;
  directiveRoot?: string;
  runnerId?: string | null;
  testInterruptPoint?: DirectiveRuntimeProofOpenRunnerInterruptionPoint;
}): DirectiveRuntimeProofOpenRunnerResult {
  requireDirectiveExplicitApproval({
    approved: input.approved,
    action: "run the Runtime proof opener through the checkpoint runner",
  });

  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const artifact = readDirectiveRuntimeRecordArtifact({
    directiveRoot,
    runtimeRecordPath: input.runtimeRecordPath,
  });
  const caseId = artifact.candidateId;
  const runnerId = (input.runnerId || "").trim() || buildDirectiveRuntimeRunnerId(RUNNER_ID_PREFIX, caseId);
  const existing = readDirectiveActionRunnerRecord({
    directiveRoot,
    runnerId,
  }).record;
  if (existing && existing.actionKind !== "runtime_proof_open") {
    throw new Error(`invalid_input: runner ${runnerId} is not a Runtime proof runner`);
  }

  return runDirectiveRuntimeCheckpointRunner({
    directiveRoot,
    runnerId,
    caseId,
    actionKind: RUNNER_ACTION_KIND,
    actionPath: artifact.runtimeRecordRelativePath,
    existingRecord: existing,
    testInterruptPoint: input.testInterruptPoint,
    resumedFromAfterActionMessage:
      "Runner resumed from after_action checkpoint without re-executing the proof opener.",
    completedFromAfterActionMessage:
      "Runner completed from stored after_action checkpoint.",
    resumedBeforeActionMessage:
      "Runner resumed and restored the before_action checkpoint.",
    firstInvocationMessage:
      "Runner invoked for the first time.",
    beforeActionCheckpointMessage:
      "Runner checkpointed before calling the Runtime proof opener.",
    afterActionCheckpointMessage:
      "Runner checkpointed after the Runtime proof opener completed.",
    completedAfterActionMessage:
      "Runner completed after the after_action checkpoint.",
    action: () => toRunnerActionResult({
      artifact,
      result: openDirectiveRuntimeRecordProof({
        directiveRoot,
        runtimeRecordPath: artifact.runtimeRecordRelativePath,
        approved: input.approved,
        approvedBy: input.approvedBy,
      }),
    }),
  });
}
