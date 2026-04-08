import {
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveExplicitApproval,
} from "../../engine/approval-boundary.ts";
import {
  readDirectiveActionRunnerRecord,
} from "../../engine/execution/directive-runner-state.ts";
import {
  openDirectiveRuntimeProofRuntimeCapabilityBoundary,
  readDirectiveRuntimeProofArtifact,
} from "./runtime-proof-runtime-capability-boundary-opener.ts";
import {
  buildDirectiveRuntimeRunnerId,
  runDirectiveRuntimeCheckpointRunner,
  type DirectiveRuntimeCheckpointRunnerInterruptedResult,
  type DirectiveRuntimeCheckpointRunnerInterruptionPoint,
  type DirectiveRuntimeCheckpointRunnerSuccessResult,
} from "./runtime-runner-shared.ts";

export type DirectiveRuntimeCapabilityBoundaryRunnerInterruptionPoint =
  DirectiveRuntimeCheckpointRunnerInterruptionPoint;

export type DirectiveRuntimeCapabilityBoundaryRunnerSuccessResult =
  DirectiveRuntimeCheckpointRunnerSuccessResult;

export type DirectiveRuntimeCapabilityBoundaryRunnerInterruptedResult =
  DirectiveRuntimeCheckpointRunnerInterruptedResult;

export type DirectiveRuntimeCapabilityBoundaryRunnerResult =
  | DirectiveRuntimeCapabilityBoundaryRunnerSuccessResult
  | DirectiveRuntimeCapabilityBoundaryRunnerInterruptedResult;

const RUNNER_ID_PREFIX = "runtime-capability-boundary-open";
const RUNNER_ACTION_KIND = "runtime_capability_boundary_open";

function toRunnerActionResult(input: {
  artifact: ReturnType<typeof readDirectiveRuntimeProofArtifact>;
  result: ReturnType<typeof openDirectiveRuntimeProofRuntimeCapabilityBoundary>;
}) {
  return {
    created: input.result.created,
    directiveRoot: input.result.directiveRoot,
    followUpRelativePath: input.artifact.linkedFollowUpPath,
    runtimeRecordRelativePath: input.artifact.linkedRuntimeRecordPath,
    runtimeRecordAbsolutePath: input.artifact.runtimeRecordArtifact.runtimeRecordAbsolutePath,
    runtimeProofRelativePath: input.result.runtimeProofRelativePath,
    runtimeProofAbsolutePath: input.artifact.runtimeProofAbsolutePath,
    runtimeCapabilityBoundaryRelativePath: input.result.runtimeCapabilityBoundaryRelativePath,
    runtimeCapabilityBoundaryAbsolutePath: input.result.runtimeCapabilityBoundaryAbsolutePath,
    candidateId: input.result.candidateId,
    candidateName: input.result.candidateName,
  };
}

export function runDirectiveRuntimeCapabilityBoundaryWithRunner(input: {
  runtimeProofPath: string;
  approved?: boolean;
  approvedBy?: string | null;
  directiveRoot?: string;
  runnerId?: string | null;
  testInterruptPoint?: DirectiveRuntimeCapabilityBoundaryRunnerInterruptionPoint;
}): DirectiveRuntimeCapabilityBoundaryRunnerResult {
  requireDirectiveExplicitApproval({
    approved: input.approved,
    action: "run the Runtime capability-boundary opener through the checkpoint runner",
  });

  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const artifact = readDirectiveRuntimeProofArtifact({
    directiveRoot,
    runtimeProofPath: input.runtimeProofPath,
  });
  const caseId = artifact.candidateId;
  const runnerId = (input.runnerId || "").trim() || buildDirectiveRuntimeRunnerId(RUNNER_ID_PREFIX, caseId);
  const existing = readDirectiveActionRunnerRecord({
    directiveRoot,
    runnerId,
  }).record;
  if (existing && existing.actionKind !== "runtime_capability_boundary_open") {
    throw new Error(`invalid_input: runner ${runnerId} is not a Runtime capability-boundary runner`);
  }

  return runDirectiveRuntimeCheckpointRunner({
    directiveRoot,
    runnerId,
    caseId,
    actionKind: RUNNER_ACTION_KIND,
    actionPath: artifact.runtimeProofRelativePath,
    existingRecord: existing,
    testInterruptPoint: input.testInterruptPoint,
    resumedFromAfterActionMessage:
      "Runner resumed from after_action checkpoint without re-executing the capability-boundary opener.",
    completedFromAfterActionMessage:
      "Runner completed from stored after_action checkpoint.",
    resumedBeforeActionMessage:
      "Runner resumed and restored the before_action checkpoint.",
    firstInvocationMessage:
      "Runner invoked for the first time.",
    beforeActionCheckpointMessage:
      "Runner checkpointed before calling the Runtime capability-boundary opener.",
    afterActionCheckpointMessage:
      "Runner checkpointed after the Runtime capability-boundary opener completed.",
    completedAfterActionMessage:
      "Runner completed after the after_action checkpoint.",
    action: () => toRunnerActionResult({
      artifact,
      result: openDirectiveRuntimeProofRuntimeCapabilityBoundary({
        directiveRoot,
        runtimeProofPath: artifact.runtimeProofRelativePath,
        approved: input.approved,
        approvedBy: input.approvedBy,
      }),
    }),
  });
}
