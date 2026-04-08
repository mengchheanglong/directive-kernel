import {
  appendDirectiveRuntimeTwoStepSequenceEvents,
  nextDirectiveRuntimeTwoStepSequenceEventSequence,
  readDirectiveRuntimeTwoStepSequenceRecord,
  resolveDirectiveTwoStepSequenceRecordPath,
  type DirectiveRunnerActionResult,
  type DirectiveRuntimeTwoStepSequenceActionKind,
  type DirectiveRuntimeTwoStepSequenceCheckpointStage,
  type DirectiveRuntimeTwoStepSequenceEvent,
  type DirectiveRuntimeTwoStepSequenceRecord,
  type DirectiveRuntimeTwoStepSequenceStepRecord,
  writeDirectiveRuntimeTwoStepSequenceRecord,
} from "../../engine/execution/directive-runner-state.ts";
import {
  runDirectiveRuntimeActionByExplicitInvocation,
  type DirectiveRuntimeSharedInvocationSuccessResult,
} from "./runtime-runner-invocation.ts";

export type DirectiveRuntimeTwoStepSequenceInterruptionPoint =
  | "after_before_step_1_checkpoint"
  | "after_step_1_checkpoint"
  | "after_step_2_checkpoint";

export type DirectiveRuntimeTwoStepSequenceSuccessResult =
  {
    ok: true;
    sequenceId: string;
    caseId: string;
    resumed: boolean;
    declaredActionCount: 2;
    executedActionCount: 0 | 1 | 2;
    completedStepCount: 2;
    lifecycleState: "completed";
    checkpointStage: "completed";
    sequenceRecordPath: string;
    sequenceRecord: DirectiveRuntimeTwoStepSequenceRecord;
    replayedFromCheckpoint: boolean;
    stepResults: [
      DirectiveRunnerActionResult,
      DirectiveRunnerActionResult,
    ];
  };

export type DirectiveRuntimeTwoStepSequenceInterruptedResult =
  {
    ok: false;
    interrupted: true;
    sequenceId: string;
    caseId: string;
    resumed: boolean;
    declaredActionCount: 2;
    executedActionCount: 0 | 1 | 2;
    completedStepCount: 0 | 1 | 2;
    lifecycleState: "interrupted";
    checkpointStage: "before_step_1" | "after_step_1" | "after_step_2";
    sequenceRecordPath: string;
    sequenceRecord: DirectiveRuntimeTwoStepSequenceRecord;
    reason: string;
  };

export type DirectiveRuntimeTwoStepSequenceResult =
  | DirectiveRuntimeTwoStepSequenceSuccessResult
  | DirectiveRuntimeTwoStepSequenceInterruptedResult;

export type NormalizedDirectiveRuntimeTwoStepSequence<
  TActionKind extends DirectiveRuntimeTwoStepSequenceActionKind = DirectiveRuntimeTwoStepSequenceActionKind,
> = {
  caseId: string;
  sequenceId: string;
  steps: [
    DirectiveRuntimeTwoStepSequenceStepRecord & { actionKind: TActionKind },
    DirectiveRuntimeTwoStepSequenceStepRecord & { actionKind: TActionKind },
  ];
};

export function buildDirectiveRuntimeTwoStepSequenceRunnerId(input: {
  sequenceId: string;
  stepIndex: 1 | 2;
  actionKind: DirectiveRuntimeTwoStepSequenceActionKind;
}) {
  return `${input.sequenceId}-step-${input.stepIndex}-${input.actionKind}`;
}

export function createDirectiveRuntimeTwoStepSequenceRecord(input: {
  sequenceId: string;
  caseId: string;
  steps: [
    DirectiveRuntimeTwoStepSequenceStepRecord,
    DirectiveRuntimeTwoStepSequenceStepRecord,
  ];
  startedAt: string;
  updatedAt: string;
  attempts: number;
  lifecycleState: DirectiveRuntimeTwoStepSequenceRecord["lifecycleState"];
  checkpointStage: DirectiveRuntimeTwoStepSequenceRecord["checkpointStage"];
  completedStepCount: 0 | 1 | 2;
  lastError: DirectiveRuntimeTwoStepSequenceRecord["lastError"];
}) {
  return {
    schemaVersion: 1,
    sequenceId: input.sequenceId,
    caseId: input.caseId,
    lifecycleState: input.lifecycleState,
    checkpointStage: input.checkpointStage,
    startedAt: input.startedAt,
    updatedAt: input.updatedAt,
    attempts: input.attempts,
    declaredActionCount: 2,
    completedStepCount: input.completedStepCount,
    steps: input.steps,
    lastError: input.lastError,
  } satisfies DirectiveRuntimeTwoStepSequenceRecord;
}

export function writeDirectiveRuntimeTwoStepSequenceState(input: {
  directiveRoot: string;
  record: DirectiveRuntimeTwoStepSequenceRecord;
}) {
  return writeDirectiveRuntimeTwoStepSequenceRecord({
    directiveRoot: input.directiveRoot,
    record: input.record,
  }).record;
}

export function appendDirectiveRuntimeTwoStepSequenceEvent(input: {
  directiveRoot: string;
  sequenceId: string;
  caseId: string;
  record: DirectiveRuntimeTwoStepSequenceRecord;
  eventType: DirectiveRuntimeTwoStepSequenceEvent["eventType"];
  occurredAt: string;
  message: string;
}) {
  const sequence = nextDirectiveRuntimeTwoStepSequenceEventSequence({
    directiveRoot: input.directiveRoot,
    sequenceId: input.sequenceId,
  });
  appendDirectiveRuntimeTwoStepSequenceEvents({
    directiveRoot: input.directiveRoot,
    sequenceId: input.sequenceId,
    events: [
      {
        schemaVersion: 1,
        eventId: `${input.sequenceId}:${sequence}:${input.eventType}`,
        sequenceId: input.sequenceId,
        caseId: input.caseId,
        sequence,
        eventType: input.eventType,
        occurredAt: input.occurredAt,
        lifecycleState: input.record.lifecycleState,
        checkpointStage: input.record.checkpointStage,
        message: input.message,
      },
    ],
  });
}

export function assertDirectiveRuntimeSharedStepSuccess(
  result: ReturnType<typeof runDirectiveRuntimeActionByExplicitInvocation>,
): asserts result is DirectiveRuntimeSharedInvocationSuccessResult {
  if (!result.ok) {
    throw new Error(
      `invalid_state: shared invocation unexpectedly interrupted at ${result.actionKind}: ${result.reason}`,
    );
  }
}

export function runDirectiveRuntimeTwoStepAction(input: {
  directiveRoot: string;
  approved: boolean | undefined;
  step: DirectiveRuntimeTwoStepSequenceStepRecord;
}) {
  const result = runDirectiveRuntimeActionByExplicitInvocation({
    directiveRoot: input.directiveRoot,
    actionKind: input.step.actionKind,
    targetPath: input.step.targetPath,
    approved: input.approved,
    approvedBy: input.step.approvedBy ?? undefined,
    runnerId: input.step.runnerId,
  });
  assertDirectiveRuntimeSharedStepSuccess(result);
  return result;
}

function recordsMatchDeclaredSequence(input: {
  declared: NormalizedDirectiveRuntimeTwoStepSequence;
  record: DirectiveRuntimeTwoStepSequenceRecord;
}) {
  return input.record.caseId === input.declared.caseId
    && input.record.steps[0].actionKind === input.declared.steps[0].actionKind
    && input.record.steps[0].targetPath === input.declared.steps[0].targetPath
    && input.record.steps[1].actionKind === input.declared.steps[1].actionKind
    && input.record.steps[1].targetPath === input.declared.steps[1].targetPath;
}

function interruptedResult(input: {
  sequenceRecordPath: string;
  record: DirectiveRuntimeTwoStepSequenceRecord;
  resumed: boolean;
  executedActionCount: 0 | 1 | 2;
  reason: string;
}): DirectiveRuntimeTwoStepSequenceInterruptedResult {
  return {
    ok: false,
    interrupted: true,
    sequenceId: input.record.sequenceId,
    caseId: input.record.caseId,
    resumed: input.resumed,
    declaredActionCount: 2,
    executedActionCount: input.executedActionCount,
    completedStepCount: input.record.completedStepCount,
    lifecycleState: "interrupted",
    checkpointStage: input.record.checkpointStage,
    sequenceRecordPath: input.sequenceRecordPath,
    sequenceRecord: input.record,
    reason: input.reason,
  };
}

function successResult(input: {
  sequenceRecordPath: string;
  record: DirectiveRuntimeTwoStepSequenceRecord;
  resumed: boolean;
  replayedFromCheckpoint: boolean;
  executedActionCount: 0 | 1 | 2;
}): DirectiveRuntimeTwoStepSequenceSuccessResult {
  const step1Result = input.record.steps[0].actionResult;
  const step2Result = input.record.steps[1].actionResult;
  if (!step1Result || !step2Result) {
    throw new Error(
      `invalid_state: completed sequence ${input.record.sequenceId} is missing one or more step results`,
    );
  }

  return {
    ok: true,
    sequenceId: input.record.sequenceId,
    caseId: input.record.caseId,
    resumed: input.resumed,
    replayedFromCheckpoint: input.replayedFromCheckpoint,
    declaredActionCount: 2,
    executedActionCount: input.executedActionCount,
    completedStepCount: 2,
    lifecycleState: "completed",
    checkpointStage: "completed",
    sequenceRecordPath: input.sequenceRecordPath,
    sequenceRecord: input.record,
    stepResults: [step1Result, step2Result],
  };
}

function writeInterruptedSequenceRecord(input: {
  directiveRoot: string;
  sequenceRecordPath: string;
  record: DirectiveRuntimeTwoStepSequenceRecord;
  resumed: boolean;
  checkpointStage: "before_step_1" | "after_step_1" | "after_step_2";
  occurredAt: string;
  reason: string;
  executedActionCount: 0 | 1 | 2;
}) {
  const interruptedRecord = writeDirectiveRuntimeTwoStepSequenceState({
    directiveRoot: input.directiveRoot,
    record: {
      ...input.record,
      lifecycleState: "interrupted",
      checkpointStage: input.checkpointStage,
      updatedAt: input.occurredAt,
    },
  });

  appendDirectiveRuntimeTwoStepSequenceEvent({
    directiveRoot: input.directiveRoot,
    sequenceId: interruptedRecord.sequenceId,
    caseId: interruptedRecord.caseId,
    record: interruptedRecord,
    eventType: "sequence_interrupted",
    occurredAt: input.occurredAt,
    message: input.reason,
  });

  return interruptedResult({
    sequenceRecordPath: input.sequenceRecordPath,
    record: interruptedRecord,
    resumed: input.resumed,
    executedActionCount: input.executedActionCount,
    reason: input.reason,
  });
}

function sequenceFailed(input: {
  directiveRoot: string;
  record: DirectiveRuntimeTwoStepSequenceRecord;
  checkpointStage: DirectiveRuntimeTwoStepSequenceCheckpointStage;
  error: unknown;
}) {
  const failedAt = new Date().toISOString();
  const message = input.error instanceof Error ? input.error.message : "unknown two-step sequence failure";
  const failedRecord = writeDirectiveRuntimeTwoStepSequenceState({
    directiveRoot: input.directiveRoot,
    record: {
      ...input.record,
      lifecycleState: "failed",
      checkpointStage: input.checkpointStage,
      updatedAt: failedAt,
      lastError: {
        name: input.error instanceof Error ? input.error.name || "Error" : "Error",
        message,
        at: failedAt,
        stage: input.checkpointStage,
      },
    },
  });
  appendDirectiveRuntimeTwoStepSequenceEvent({
    directiveRoot: input.directiveRoot,
    sequenceId: failedRecord.sequenceId,
    caseId: failedRecord.caseId,
    record: failedRecord,
    eventType: "sequence_failed",
    occurredAt: failedAt,
    message,
  });
  throw input.error;
}

export function runDirectiveRuntimeTwoStepSequence(input: {
  directiveRoot: string;
  approved: boolean | undefined;
  declared: NormalizedDirectiveRuntimeTwoStepSequence;
  testInterruptPoint?: DirectiveRuntimeTwoStepSequenceInterruptionPoint;
  existingRecordGuardError: string;
  resumedFromAfterStep2Message: string;
  completedFromAfterStep2Message: string;
  resumedSequenceMessage: string;
  firstInvocationMessage: string;
  beforeStep1CheckpointMessage: string;
  afterStep1CheckpointMessage: string;
  afterStep2CheckpointMessage: string;
  completedMessage: string;
  afterStep1PrerequisiteError: string;
  expectedStep2TargetPath: (runtimeResult: DirectiveRunnerActionResult) => string | null | undefined;
  afterStep1MismatchError: (runtimeResult: DirectiveRunnerActionResult) => string;
}): DirectiveRuntimeTwoStepSequenceResult {
  const sequenceRecordPath = resolveDirectiveTwoStepSequenceRecordPath({
    directiveRoot: input.directiveRoot,
    sequenceId: input.declared.sequenceId,
  });
  const existing = readDirectiveRuntimeTwoStepSequenceRecord({
    directiveRoot: input.directiveRoot,
    sequenceId: input.declared.sequenceId,
  }).record;
  if (existing && !recordsMatchDeclaredSequence({
    declared: input.declared,
    record: existing,
  })) {
    throw new Error(input.existingRecordGuardError);
  }

  const resumed = existing !== null;
  if (existing?.lifecycleState === "completed") {
    return successResult({
      sequenceRecordPath,
      record: existing,
      resumed,
      replayedFromCheckpoint: true,
      executedActionCount: 0,
    });
  }

  if (existing?.checkpointStage === "after_step_2" && existing.completedStepCount === 2) {
    const completedAt = new Date().toISOString();
    const completedRecord = writeDirectiveRuntimeTwoStepSequenceState({
      directiveRoot: input.directiveRoot,
      record: {
        ...existing,
        lifecycleState: "completed",
        checkpointStage: "completed",
        updatedAt: completedAt,
        lastError: null,
      },
    });
    appendDirectiveRuntimeTwoStepSequenceEvent({
      directiveRoot: input.directiveRoot,
      sequenceId: completedRecord.sequenceId,
      caseId: completedRecord.caseId,
      record: completedRecord,
      eventType: "sequence_resumed",
      occurredAt: completedAt,
      message: input.resumedFromAfterStep2Message,
    });
    appendDirectiveRuntimeTwoStepSequenceEvent({
      directiveRoot: input.directiveRoot,
      sequenceId: completedRecord.sequenceId,
      caseId: completedRecord.caseId,
      record: completedRecord,
      eventType: "sequence_completed",
      occurredAt: completedAt,
      message: input.completedFromAfterStep2Message,
    });
    return successResult({
      sequenceRecordPath,
      record: completedRecord,
      resumed,
      replayedFromCheckpoint: true,
      executedActionCount: 0,
    });
  }

  const startedAt = existing?.startedAt ?? new Date().toISOString();
  let record = writeDirectiveRuntimeTwoStepSequenceState({
    directiveRoot: input.directiveRoot,
    record: createDirectiveRuntimeTwoStepSequenceRecord({
      sequenceId: input.declared.sequenceId,
      caseId: input.declared.caseId,
      steps: existing?.steps ?? input.declared.steps,
      startedAt,
      updatedAt: new Date().toISOString(),
      attempts: (existing?.attempts ?? 0) + 1,
      lifecycleState: "running",
      checkpointStage: existing?.checkpointStage === "after_step_1" && existing.completedStepCount === 1
        ? "after_step_1"
        : "before_step_1",
      completedStepCount: existing?.completedStepCount ?? 0,
      lastError: null,
    }),
  });

  const sequenceStartedAt = new Date().toISOString();
  appendDirectiveRuntimeTwoStepSequenceEvent({
    directiveRoot: input.directiveRoot,
    sequenceId: record.sequenceId,
    caseId: record.caseId,
    record,
    eventType: resumed ? "sequence_resumed" : "sequence_invoked",
    occurredAt: sequenceStartedAt,
    message: resumed ? input.resumedSequenceMessage : input.firstInvocationMessage,
  });

  if (record.completedStepCount === 0) {
    appendDirectiveRuntimeTwoStepSequenceEvent({
      directiveRoot: input.directiveRoot,
      sequenceId: record.sequenceId,
      caseId: record.caseId,
      record,
      eventType: "before_step_1_checkpointed",
      occurredAt: sequenceStartedAt,
      message: input.beforeStep1CheckpointMessage,
    });
    if (input.testInterruptPoint === "after_before_step_1_checkpoint") {
      return writeInterruptedSequenceRecord({
        directiveRoot: input.directiveRoot,
        sequenceRecordPath,
        record,
        resumed,
        checkpointStage: "before_step_1",
        occurredAt: new Date().toISOString(),
        reason: "Interrupted immediately after before_step_1 checkpoint.",
        executedActionCount: 0,
      });
    }
  }

  let executedActionCount = 0 as 0 | 1 | 2;

  try {
    if (record.completedStepCount === 0) {
      const step1Result = runDirectiveRuntimeTwoStepAction({
        directiveRoot: input.directiveRoot,
        approved: input.approved,
        step: record.steps[0],
      });
      executedActionCount = 1;
      const afterStep1At = new Date().toISOString();
      record = writeDirectiveRuntimeTwoStepSequenceState({
        directiveRoot: input.directiveRoot,
        record: {
          ...record,
          lifecycleState: "running",
          checkpointStage: "after_step_1",
          updatedAt: afterStep1At,
          completedStepCount: 1,
          steps: [
            {
              ...record.steps[0],
              completedAt: afterStep1At,
              actionResult: step1Result.actionResult,
            },
            record.steps[1],
          ],
        },
      });
      appendDirectiveRuntimeTwoStepSequenceEvent({
        directiveRoot: input.directiveRoot,
        sequenceId: record.sequenceId,
        caseId: record.caseId,
        record,
        eventType: "after_step_1_checkpointed",
        occurredAt: afterStep1At,
        message: input.afterStep1CheckpointMessage,
      });
      if (input.testInterruptPoint === "after_step_1_checkpoint") {
        return writeInterruptedSequenceRecord({
          directiveRoot: input.directiveRoot,
          sequenceRecordPath,
          record,
          resumed,
          checkpointStage: "after_step_1",
          occurredAt: new Date().toISOString(),
          reason: "Interrupted immediately after after_step_1 checkpoint.",
          executedActionCount,
        });
      }
    }

    const step1ActionResult = record.steps[0].actionResult;
    if (!step1ActionResult) {
      throw new Error(input.afterStep1PrerequisiteError);
    }
    const expectedStep2TargetPath = input.expectedStep2TargetPath(step1ActionResult);
    if (!expectedStep2TargetPath) {
      throw new Error(input.afterStep1MismatchError(step1ActionResult));
    }
    if (record.steps[1].targetPath !== expectedStep2TargetPath) {
      throw new Error(input.afterStep1MismatchError(step1ActionResult));
    }

    if (record.completedStepCount < 2) {
      const step2Result = runDirectiveRuntimeTwoStepAction({
        directiveRoot: input.directiveRoot,
        approved: input.approved,
        step: record.steps[1],
      });
      executedActionCount = (executedActionCount + 1) as 1 | 2;
      const afterStep2At = new Date().toISOString();
      record = writeDirectiveRuntimeTwoStepSequenceState({
        directiveRoot: input.directiveRoot,
        record: {
          ...record,
          lifecycleState: "running",
          checkpointStage: "after_step_2",
          updatedAt: afterStep2At,
          completedStepCount: 2,
          steps: [
            record.steps[0],
            {
              ...record.steps[1],
              completedAt: afterStep2At,
              actionResult: step2Result.actionResult,
            },
          ],
        },
      });
      appendDirectiveRuntimeTwoStepSequenceEvent({
        directiveRoot: input.directiveRoot,
        sequenceId: record.sequenceId,
        caseId: record.caseId,
        record,
        eventType: "after_step_2_checkpointed",
        occurredAt: afterStep2At,
        message: input.afterStep2CheckpointMessage,
      });
      if (input.testInterruptPoint === "after_step_2_checkpoint") {
        return writeInterruptedSequenceRecord({
          directiveRoot: input.directiveRoot,
          sequenceRecordPath,
          record,
          resumed,
          checkpointStage: "after_step_2",
          occurredAt: new Date().toISOString(),
          reason: "Interrupted immediately after after_step_2 checkpoint.",
          executedActionCount,
        });
      }
    }

    const completedAt = new Date().toISOString();
    const completedRecord = writeDirectiveRuntimeTwoStepSequenceState({
      directiveRoot: input.directiveRoot,
      record: {
        ...record,
        lifecycleState: "completed",
        checkpointStage: "completed",
        updatedAt: completedAt,
        lastError: null,
      },
    });
    appendDirectiveRuntimeTwoStepSequenceEvent({
      directiveRoot: input.directiveRoot,
      sequenceId: completedRecord.sequenceId,
      caseId: completedRecord.caseId,
      record: completedRecord,
      eventType: "sequence_completed",
      occurredAt: completedAt,
      message: input.completedMessage,
    });
    return successResult({
      sequenceRecordPath,
      record: completedRecord,
      resumed,
      replayedFromCheckpoint: false,
      executedActionCount,
    });
  } catch (error) {
    return sequenceFailed({
      directiveRoot: input.directiveRoot,
      record,
      checkpointStage: record.checkpointStage,
      error,
    });
  }
}
