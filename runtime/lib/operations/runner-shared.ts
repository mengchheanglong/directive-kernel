import {
  appendActionRunnerEvents,
  nextActionRunnerEventSequence,
  type ActionRunnerEvent,
  type ActionRunnerRecord,
  type RunnerActionKind,
  type RunnerActionResult,
  writeActionRunnerRecord,
} from "../../../engine/orchestration/runner-state.ts";

export type RuntimeCheckpointRunnerInterruptionPoint =
  | "after_before_action_checkpoint"
  | "after_after_action_checkpoint";

export type RuntimeCheckpointRunnerSuccessResult = {
  ok: true;
  runnerId: string;
  caseId: string;
  resumed: boolean;
  replayedFromCheckpoint: boolean;
  lifecycleState: "completed";
  checkpointStage: "completed";
  actionResult: RunnerActionResult;
};

export type RuntimeCheckpointRunnerInterruptedResult = {
  ok: false;
  interrupted: true;
  runnerId: string;
  caseId: string;
  resumed: boolean;
  lifecycleState: "interrupted";
  checkpointStage: "before_action" | "after_action";
  reason: string;
};

export type RuntimeCheckpointRunnerResult =
  | RuntimeCheckpointRunnerSuccessResult
  | RuntimeCheckpointRunnerInterruptedResult;

export function buildDirectiveRuntimeRunnerId(prefix: string, caseId: string) {
  return `${prefix}-${caseId}`;
}

export function appendDirectiveRuntimeRunnerEvent(input: {
  directiveRoot: string;
  runnerId: string;
  caseId: string;
  actionKind: ActionRunnerRecord["actionKind"];
  record: ActionRunnerRecord;
  eventType: ActionRunnerEvent["eventType"];
  occurredAt: string;
  message: string;
}) {
  const sequence = nextActionRunnerEventSequence({
    directiveRoot: input.directiveRoot,
    runnerId: input.runnerId,
  });
  appendActionRunnerEvents({
    directiveRoot: input.directiveRoot,
    runnerId: input.runnerId,
    events: [
      {
        schemaVersion: 1,
        eventId: `${input.runnerId}:${sequence}:${input.eventType}`,
        runnerId: input.runnerId,
        caseId: input.caseId,
        actionKind: input.actionKind,
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

export function createDirectiveRuntimeRunnerRecord(input: {
  runnerId: string;
  caseId: string;
  actionKind: ActionRunnerRecord["actionKind"];
  actionPath: string;
  startedAt: string;
  updatedAt: string;
  attempts: number;
  lifecycleState: ActionRunnerRecord["lifecycleState"];
  checkpointStage: ActionRunnerRecord["checkpointStage"];
  lastError: ActionRunnerRecord["lastError"];
  actionResult: ActionRunnerRecord["actionResult"];
}) {
  return {
    schemaVersion: 1,
    runnerId: input.runnerId,
    caseId: input.caseId,
    actionKind: input.actionKind,
    lifecycleState: input.lifecycleState,
    checkpointStage: input.checkpointStage,
    actionPath: input.actionPath,
    startedAt: input.startedAt,
    updatedAt: input.updatedAt,
    attempts: input.attempts,
    lastError: input.lastError,
    actionResult: input.actionResult,
  } satisfies ActionRunnerRecord;
}

export function writeDirectiveRuntimeRunnerRecord(input: {
  directiveRoot: string;
  record: ActionRunnerRecord;
}) {
  return writeActionRunnerRecord({
    directiveRoot: input.directiveRoot,
    record: input.record,
  }).record;
}

export function writeInterruptedDirectiveRuntimeRunnerRecord(input: {
  directiveRoot: string;
  runnerId: string;
  caseId: string;
  actionKind: ActionRunnerRecord["actionKind"];
  record: ActionRunnerRecord;
  checkpointStage: "before_action" | "after_action";
  occurredAt: string;
  reason: string;
}) {
  const interruptedRecord = writeDirectiveRuntimeRunnerRecord({
    directiveRoot: input.directiveRoot,
    record: {
      ...input.record,
      lifecycleState: "interrupted",
      checkpointStage: input.checkpointStage,
      updatedAt: input.occurredAt,
    },
  });

  appendDirectiveRuntimeRunnerEvent({
    directiveRoot: input.directiveRoot,
    runnerId: input.runnerId,
    caseId: input.caseId,
    actionKind: input.actionKind,
    record: interruptedRecord,
    eventType: "runner_interrupted",
    occurredAt: input.occurredAt,
    message: input.reason,
  });

  return interruptedRecord;
}

export async function runDirectiveRuntimeCheckpointRunner(input: {
  directiveRoot: string;
  runnerId: string;
  caseId: string;
  actionKind: RunnerActionKind;
  actionPath: string;
  existingRecord: ActionRunnerRecord | null;
  testInterruptPoint?: RuntimeCheckpointRunnerInterruptionPoint;
  resumedFromAfterActionMessage: string;
  completedFromAfterActionMessage: string;
  resumedBeforeActionMessage: string;
  firstInvocationMessage: string;
  beforeActionCheckpointMessage: string;
  afterActionCheckpointMessage: string;
  completedAfterActionMessage: string;
  action: () => Promise<RunnerActionResult>;
}): Promise<RuntimeCheckpointRunnerResult> {
  const resumed = input.existingRecord !== null;

  if (input.existingRecord?.lifecycleState === "completed" && input.existingRecord.actionResult) {
    return {
      ok: true,
      runnerId: input.runnerId,
      caseId: input.caseId,
      resumed,
      replayedFromCheckpoint: true,
      lifecycleState: "completed",
      checkpointStage: "completed",
      actionResult: input.existingRecord.actionResult,
    };
  }

  if (input.existingRecord?.checkpointStage === "after_action" && input.existingRecord.actionResult) {
    const completedAt = new Date().toISOString();
    const completedRecord = writeDirectiveRuntimeRunnerRecord({
      directiveRoot: input.directiveRoot,
      record: {
        ...input.existingRecord,
        lifecycleState: "completed",
        checkpointStage: "completed",
        updatedAt: completedAt,
        lastError: null,
      },
    });

    if (resumed) {
      appendDirectiveRuntimeRunnerEvent({
        directiveRoot: input.directiveRoot,
        runnerId: input.runnerId,
        caseId: input.caseId,
        actionKind: input.actionKind,
        record: completedRecord,
        eventType: "runner_resumed",
        occurredAt: completedAt,
        message: input.resumedFromAfterActionMessage,
      });
    }
    appendDirectiveRuntimeRunnerEvent({
      directiveRoot: input.directiveRoot,
      runnerId: input.runnerId,
      caseId: input.caseId,
      actionKind: input.actionKind,
      record: completedRecord,
      eventType: "runner_completed",
      occurredAt: completedAt,
      message: input.completedFromAfterActionMessage,
    });

    return {
      ok: true,
      runnerId: input.runnerId,
      caseId: input.caseId,
      resumed,
      replayedFromCheckpoint: true,
      lifecycleState: "completed",
      checkpointStage: "completed",
      actionResult: completedRecord.actionResult!,
    };
  }

  const startedAt = input.existingRecord?.startedAt ?? new Date().toISOString();
  const beforeActionAt = new Date().toISOString();
  const beforeActionRecord = writeDirectiveRuntimeRunnerRecord({
    directiveRoot: input.directiveRoot,
    record: createDirectiveRuntimeRunnerRecord({
      runnerId: input.runnerId,
      caseId: input.caseId,
      actionKind: input.actionKind,
      actionPath: input.actionPath,
      startedAt,
      updatedAt: beforeActionAt,
      attempts: (input.existingRecord?.attempts ?? 0) + 1,
      lifecycleState: "running",
      checkpointStage: "before_action",
      lastError: null,
      actionResult: null,
    }),
  });

  appendDirectiveRuntimeRunnerEvent({
    directiveRoot: input.directiveRoot,
    runnerId: input.runnerId,
    caseId: input.caseId,
    actionKind: input.actionKind,
    record: beforeActionRecord,
    eventType: resumed ? "runner_resumed" : "runner_invoked",
    occurredAt: beforeActionAt,
    message: resumed
      ? input.resumedBeforeActionMessage
      : input.firstInvocationMessage,
  });
  appendDirectiveRuntimeRunnerEvent({
    directiveRoot: input.directiveRoot,
    runnerId: input.runnerId,
    caseId: input.caseId,
    actionKind: input.actionKind,
    record: beforeActionRecord,
    eventType: "before_action_checkpointed",
    occurredAt: beforeActionAt,
    message: input.beforeActionCheckpointMessage,
  });

  if (input.testInterruptPoint === "after_before_action_checkpoint") {
    const reason = "Interrupted immediately after before_action checkpoint.";
    writeInterruptedDirectiveRuntimeRunnerRecord({
      directiveRoot: input.directiveRoot,
      runnerId: input.runnerId,
      caseId: input.caseId,
      actionKind: input.actionKind,
      record: beforeActionRecord,
      checkpointStage: "before_action",
      occurredAt: new Date().toISOString(),
      reason,
    });
    return {
      ok: false,
      interrupted: true,
      runnerId: input.runnerId,
      caseId: input.caseId,
      resumed,
      lifecycleState: "interrupted",
      checkpointStage: "before_action",
      reason,
    };
  }

  try {
    const actionResult = await input.action();
    const afterActionAt = new Date().toISOString();
    const afterActionRecord = writeDirectiveRuntimeRunnerRecord({
      directiveRoot: input.directiveRoot,
      record: {
        ...beforeActionRecord,
        lifecycleState: "running",
        checkpointStage: "after_action",
        updatedAt: afterActionAt,
        lastError: null,
        actionResult,
      },
    });

    appendDirectiveRuntimeRunnerEvent({
      directiveRoot: input.directiveRoot,
      runnerId: input.runnerId,
      caseId: input.caseId,
      actionKind: input.actionKind,
      record: afterActionRecord,
      eventType: "after_action_checkpointed",
      occurredAt: afterActionAt,
      message: input.afterActionCheckpointMessage,
    });

    if (input.testInterruptPoint === "after_after_action_checkpoint") {
      const reason = "Interrupted immediately after after_action checkpoint.";
      writeInterruptedDirectiveRuntimeRunnerRecord({
        directiveRoot: input.directiveRoot,
        runnerId: input.runnerId,
        caseId: input.caseId,
        actionKind: input.actionKind,
        record: afterActionRecord,
        checkpointStage: "after_action",
        occurredAt: new Date().toISOString(),
        reason,
      });
      return {
        ok: false,
        interrupted: true,
        runnerId: input.runnerId,
        caseId: input.caseId,
        resumed,
        lifecycleState: "interrupted",
        checkpointStage: "after_action",
        reason,
      };
    }

    const completedAt = new Date().toISOString();
    const completedRecord = writeDirectiveRuntimeRunnerRecord({
      directiveRoot: input.directiveRoot,
      record: {
        ...afterActionRecord,
        lifecycleState: "completed",
        checkpointStage: "completed",
        updatedAt: completedAt,
      },
    });

    appendDirectiveRuntimeRunnerEvent({
      directiveRoot: input.directiveRoot,
      runnerId: input.runnerId,
      caseId: input.caseId,
      actionKind: input.actionKind,
      record: completedRecord,
      eventType: "runner_completed",
      occurredAt: completedAt,
      message: input.completedAfterActionMessage,
    });

    return {
      ok: true,
      runnerId: input.runnerId,
      caseId: input.caseId,
      resumed,
      replayedFromCheckpoint: false,
      lifecycleState: "completed",
      checkpointStage: "completed",
      actionResult: completedRecord.actionResult!,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "unknown runner failure";
    const failedRecord = writeDirectiveRuntimeRunnerRecord({
      directiveRoot: input.directiveRoot,
      record: {
        ...beforeActionRecord,
        lifecycleState: "failed",
        checkpointStage: "before_action",
        updatedAt: failedAt,
        lastError: {
          name: error instanceof Error ? error.name || "Error" : "Error",
          message,
          at: failedAt,
          stage: "before_action",
        },
      },
    });

    appendDirectiveRuntimeRunnerEvent({
      directiveRoot: input.directiveRoot,
      runnerId: input.runnerId,
      caseId: input.caseId,
      actionKind: input.actionKind,
      record: failedRecord,
      eventType: "runner_failed",
      occurredAt: failedAt,
      message,
    });
    throw error;
  }
}
