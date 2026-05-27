import {
  appendRuntimeTwoStepSequenceEvents,
  nextRuntimeTwoStepSequenceEventSequence,
  readRuntimeTwoStepSequenceRecord,
  resolveDirectiveTwoStepSequenceRecordPath,
  type RunnerActionResult,
  type RuntimeTwoStepSequenceActionKind,
  type RuntimeTwoStepSequenceCheckpointStage,
  type RuntimeTwoStepSequenceEvent,
  type RuntimeTwoStepSequenceRecord,
  type RuntimeTwoStepSequenceStepRecord,
  writeRuntimeTwoStepSequenceRecord,
} from "../../../engine/orchestration/runner-state.ts";
import {
  runDirectiveRuntimeActionByExplicitInvocation,
  type RuntimeSharedInvocationSuccessResult,
} from "./runner-invocation.ts";

export type RuntimeTwoStepSequenceInterruptionPoint =
  | "after_before_step_1_checkpoint"
  | "after_step_1_checkpoint"
  | "after_step_2_checkpoint";

export type RuntimeTwoStepSequenceSuccessResult =
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
    sequenceRecord: RuntimeTwoStepSequenceRecord;
    replayedFromCheckpoint: boolean;
    stepResults: [
      RunnerActionResult,
      RunnerActionResult,
    ];
  };

export type RuntimeTwoStepSequenceInterruptedResult =
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
    sequenceRecord: RuntimeTwoStepSequenceRecord;
    reason: string;
  };

export type RuntimeTwoStepSequenceResult =
  | RuntimeTwoStepSequenceSuccessResult
  | RuntimeTwoStepSequenceInterruptedResult;

export type NormalizedDirectiveRuntimeTwoStepSequence<
  TActionKind extends RuntimeTwoStepSequenceActionKind = RuntimeTwoStepSequenceActionKind,
> = {
  caseId: string;
  sequenceId: string;
  steps: [
    RuntimeTwoStepSequenceStepRecord & { actionKind: TActionKind },
    RuntimeTwoStepSequenceStepRecord & { actionKind: TActionKind },
  ];
};

export function buildDirectiveRuntimeTwoStepSequenceRunnerId(input: {
  sequenceId: string;
  stepIndex: 1 | 2;
  actionKind: RuntimeTwoStepSequenceActionKind;
}) {
  return `${input.sequenceId}-step-${input.stepIndex}-${input.actionKind}`;
}

export function createRuntimeTwoStepSequenceRecord(input: {
  sequenceId: string;
  caseId: string;
  steps: [
    RuntimeTwoStepSequenceStepRecord,
    RuntimeTwoStepSequenceStepRecord,
  ];
  startedAt: string;
  updatedAt: string;
  attempts: number;
  lifecycleState: RuntimeTwoStepSequenceRecord["lifecycleState"];
  checkpointStage: RuntimeTwoStepSequenceRecord["checkpointStage"];
  completedStepCount: 0 | 1 | 2;
  lastError: RuntimeTwoStepSequenceRecord["lastError"];
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
  } satisfies RuntimeTwoStepSequenceRecord;
}

export function writeDirectiveRuntimeTwoStepSequenceState(input: {
  directiveRoot: string;
  record: RuntimeTwoStepSequenceRecord;
}) {
  return writeRuntimeTwoStepSequenceRecord({
    directiveRoot: input.directiveRoot,
    record: input.record,
  }).record;
}

export function appendRuntimeTwoStepSequenceEvent(input: {
  directiveRoot: string;
  sequenceId: string;
  caseId: string;
  record: RuntimeTwoStepSequenceRecord;
  eventType: RuntimeTwoStepSequenceEvent["eventType"];
  occurredAt: string;
  message: string;
}) {
  const sequence = nextRuntimeTwoStepSequenceEventSequence({
    directiveRoot: input.directiveRoot,
    sequenceId: input.sequenceId,
  });
  appendRuntimeTwoStepSequenceEvents({
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
  result: Awaited<ReturnType<typeof runDirectiveRuntimeActionByExplicitInvocation>>,
): asserts result is RuntimeSharedInvocationSuccessResult {
  if (!result.ok) {
    throw new Error(
      `invalid_state: shared invocation unexpectedly interrupted at ${result.actionKind}: ${result.reason}`,
    );
  }
}

export async function runDirectiveRuntimeTwoStepAction(input: {
  directiveRoot: string;
  approved: boolean | undefined;
  step: RuntimeTwoStepSequenceStepRecord;
}) {
  const result = await runDirectiveRuntimeActionByExplicitInvocation({
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
  record: RuntimeTwoStepSequenceRecord;
}) {
  return input.record.caseId === input.declared.caseId
    && input.record.steps[0].actionKind === input.declared.steps[0].actionKind
    && input.record.steps[0].targetPath === input.declared.steps[0].targetPath
    && input.record.steps[1].actionKind === input.declared.steps[1].actionKind
    && input.record.steps[1].targetPath === input.declared.steps[1].targetPath;
}

function interruptedResult(input: {
  sequenceRecordPath: string;
  record: RuntimeTwoStepSequenceRecord;
  resumed: boolean;
  executedActionCount: 0 | 1 | 2;
  reason: string;
}): RuntimeTwoStepSequenceInterruptedResult {
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
    checkpointStage:
      input.record.checkpointStage === "completed"
        ? "after_step_2"
        : input.record.checkpointStage,
    sequenceRecordPath: input.sequenceRecordPath,
    sequenceRecord: input.record,
    reason: input.reason,
  };
}

function successResult(input: {
  sequenceRecordPath: string;
  record: RuntimeTwoStepSequenceRecord;
  resumed: boolean;
  replayedFromCheckpoint: boolean;
  executedActionCount: 0 | 1 | 2;
}): RuntimeTwoStepSequenceSuccessResult {
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
  record: RuntimeTwoStepSequenceRecord;
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

  appendRuntimeTwoStepSequenceEvent({
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
  record: RuntimeTwoStepSequenceRecord;
  checkpointStage: RuntimeTwoStepSequenceCheckpointStage;
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
  appendRuntimeTwoStepSequenceEvent({
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

export async function runDirectiveRuntimeTwoStepSequence(input: {
  directiveRoot: string;
  approved: boolean | undefined;
  declared: NormalizedDirectiveRuntimeTwoStepSequence;
  testInterruptPoint?: RuntimeTwoStepSequenceInterruptionPoint;
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
  expectedStep2TargetPath: (runtimeResult: RunnerActionResult) => string | null | undefined;
  afterStep1MismatchError: (runtimeResult: RunnerActionResult) => string;
}): Promise<RuntimeTwoStepSequenceResult> {
  const sequenceRecordPath = resolveDirectiveTwoStepSequenceRecordPath({
    directiveRoot: input.directiveRoot,
    sequenceId: input.declared.sequenceId,
  });
  const existing = readRuntimeTwoStepSequenceRecord({
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
    appendRuntimeTwoStepSequenceEvent({
      directiveRoot: input.directiveRoot,
      sequenceId: completedRecord.sequenceId,
      caseId: completedRecord.caseId,
      record: completedRecord,
      eventType: "sequence_resumed",
      occurredAt: completedAt,
      message: input.resumedFromAfterStep2Message,
    });
    appendRuntimeTwoStepSequenceEvent({
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
    record: createRuntimeTwoStepSequenceRecord({
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
  appendRuntimeTwoStepSequenceEvent({
    directiveRoot: input.directiveRoot,
    sequenceId: record.sequenceId,
    caseId: record.caseId,
    record,
    eventType: resumed ? "sequence_resumed" : "sequence_invoked",
    occurredAt: sequenceStartedAt,
    message: resumed ? input.resumedSequenceMessage : input.firstInvocationMessage,
  });

  if (record.completedStepCount === 0) {
    appendRuntimeTwoStepSequenceEvent({
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
      const step1Result = await runDirectiveRuntimeTwoStepAction({
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
      appendRuntimeTwoStepSequenceEvent({
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
      const step2Result = await runDirectiveRuntimeTwoStepAction({
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
      appendRuntimeTwoStepSequenceEvent({
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
    appendRuntimeTwoStepSequenceEvent({
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
    sequenceFailed({
      directiveRoot: input.directiveRoot,
      record,
      checkpointStage: record.checkpointStage,
      error,
    });
    throw new Error("unreachable");
  }
}
