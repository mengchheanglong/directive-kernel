import {
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveExplicitApproval,
} from "../../engine/approval-boundary.ts";
import {
  readDirectiveActionRunnerRecord,
} from "../../engine/execution/directive-runner-state.ts";
import {
  openDirectiveRuntimePromotionReadiness,
  readDirectiveRuntimeRuntimeCapabilityBoundaryArtifact,
} from "./runtime-runtime-capability-boundary-promotion-readiness-opener.ts";
import {
  buildDirectiveRuntimeRunnerId,
  runDirectiveRuntimeCheckpointRunner,
  type DirectiveRuntimeCheckpointRunnerInterruptedResult,
  type DirectiveRuntimeCheckpointRunnerInterruptionPoint,
  type DirectiveRuntimeCheckpointRunnerSuccessResult,
} from "./runtime-runner-shared.ts";

export type DirectiveRuntimePromotionReadinessRunnerInterruptionPoint =
  DirectiveRuntimeCheckpointRunnerInterruptionPoint;

export type DirectiveRuntimePromotionReadinessRunnerSuccessResult =
  DirectiveRuntimeCheckpointRunnerSuccessResult;

export type DirectiveRuntimePromotionReadinessRunnerInterruptedResult =
  DirectiveRuntimeCheckpointRunnerInterruptedResult;

export type DirectiveRuntimePromotionReadinessRunnerResult =
  | DirectiveRuntimePromotionReadinessRunnerSuccessResult
  | DirectiveRuntimePromotionReadinessRunnerInterruptedResult;

const RUNNER_ID_PREFIX = "runtime-promotion-readiness-open";
const RUNNER_ACTION_KIND = "runtime_promotion_readiness_open";

function toRunnerActionResult(input: {
  artifact: ReturnType<typeof readDirectiveRuntimeRuntimeCapabilityBoundaryArtifact>;
  result: ReturnType<typeof openDirectiveRuntimePromotionReadiness>;
}) {
  return {
    created: input.result.created,
    directiveRoot: input.result.directiveRoot,
    followUpRelativePath: input.artifact.linkedFollowUpPath,
    runtimeRecordRelativePath: input.artifact.linkedRuntimeRecordPath,
    runtimeRecordAbsolutePath: input.artifact.runtimeRecordArtifact.runtimeRecordAbsolutePath,
    runtimeProofRelativePath: input.artifact.linkedRuntimeProofPath,
    runtimeProofAbsolutePath: input.artifact.proofArtifact.runtimeProofAbsolutePath,
    runtimeCapabilityBoundaryRelativePath: input.result.capabilityBoundaryRelativePath,
    runtimeCapabilityBoundaryAbsolutePath: input.artifact.capabilityBoundaryAbsolutePath,
    runtimePromotionReadinessRelativePath: input.result.promotionReadinessRelativePath,
    runtimePromotionReadinessAbsolutePath: input.result.promotionReadinessAbsolutePath,
    candidateId: input.result.candidateId,
    candidateName: input.result.candidateName,
  };
}

export function runDirectiveRuntimePromotionReadinessWithRunner(input: {
  capabilityBoundaryPath: string;
  approved?: boolean;
  approvedBy?: string | null;
  directiveRoot?: string;
  runnerId?: string | null;
  testInterruptPoint?: DirectiveRuntimePromotionReadinessRunnerInterruptionPoint;
}): DirectiveRuntimePromotionReadinessRunnerResult {
  requireDirectiveExplicitApproval({
    approved: input.approved,
    action: "run the Runtime promotion-readiness opener through the checkpoint runner",
  });

  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const artifact = readDirectiveRuntimeRuntimeCapabilityBoundaryArtifact({
    directiveRoot,
    capabilityBoundaryPath: input.capabilityBoundaryPath,
  });
  const caseId = artifact.candidateId;
  const runnerId = (input.runnerId || "").trim() || buildDirectiveRuntimeRunnerId(RUNNER_ID_PREFIX, caseId);
  const existing = readDirectiveActionRunnerRecord({
    directiveRoot,
    runnerId,
  }).record;
  if (existing && existing.actionKind !== "runtime_promotion_readiness_open") {
    throw new Error(`invalid_input: runner ${runnerId} is not a Runtime promotion-readiness runner`);
  }

  return runDirectiveRuntimeCheckpointRunner({
    directiveRoot,
    runnerId,
    caseId,
    actionKind: RUNNER_ACTION_KIND,
    actionPath: artifact.capabilityBoundaryRelativePath,
    existingRecord: existing,
    testInterruptPoint: input.testInterruptPoint,
    resumedFromAfterActionMessage:
      "Runner resumed from after_action checkpoint without re-executing the promotion-readiness opener.",
    completedFromAfterActionMessage:
      "Runner completed from stored after_action checkpoint.",
    resumedBeforeActionMessage:
      "Runner resumed and restored the before_action checkpoint.",
    firstInvocationMessage:
      "Runner invoked for the first time.",
    beforeActionCheckpointMessage:
      "Runner checkpointed before calling the Runtime promotion-readiness opener.",
    afterActionCheckpointMessage:
      "Runner checkpointed after the Runtime promotion-readiness opener completed.",
    completedAfterActionMessage:
      "Runner completed after the after_action checkpoint.",
    action: () => toRunnerActionResult({
      artifact,
      result: openDirectiveRuntimePromotionReadiness({
        directiveRoot,
        capabilityBoundaryPath: artifact.capabilityBoundaryRelativePath,
        approved: input.approved,
        approvedBy: input.approvedBy,
      }),
    }),
  });
}
