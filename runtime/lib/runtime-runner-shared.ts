import {
  appendDirectiveActionRunnerEvents,
  nextDirectiveActionRunnerEventSequence,
  type DirectiveActionRunnerEvent,
  type DirectiveActionRunnerRecord,
  type DirectiveRunnerActionKind,
  type DirectiveRunnerActionResult,
  writeDirectiveActionRunnerRecord,
} from "../../engine/execution/directive-runner-state.ts";

export type DirectiveRuntimeCheckpointRunnerInterruptionPoint =
  | "after_before_action_checkpoint"
  | "after_after_action_checkpoint";

export type DirectiveRuntimeCheckpointRunnerSuccessResult = {
  ok: true;
  runnerId: string;
  caseId: string;
  resumed: boolean;
  replayedFromCheckpoint: boolean;
  lifecycleState: "completed";
  checkpointStage: "completed";
  actionResult: DirectiveRunnerActionResult;
};

export type DirectiveRuntimeCheckpointRunnerInterruptedResult = {
  ok: false;
  interrupted: true;
  runnerId: string;
  caseId: string;
  resumed: boolean;
  lifecycleState: "interrupted";
  checkpointStage: "before_action" | "after_action";
  reason: string;
};

export type DirectiveRuntimeCheckpointRunnerResult =
  | DirectiveRuntimeCheckpointRunnerSuccessResult
  | DirectiveRuntimeCheckpointRunnerInterruptedResult;

export function buildDirectiveRuntimeRunnerId(prefix: string, caseId: string) {
  return `${prefix}-${caseId}`;
}

export function appendDirectiveRuntimeRunnerEvent(input: {
  directiveRoot: string;
  runnerId: string;
  caseId: string;
  actionKind: DirectiveActionRunnerRecord["actionKind"];
  record: DirectiveActionRunnerRecord;
  eventType: DirectiveActionRunnerEvent["eventType"];
  occurredAt: string;
  message: string;
}) {
  const sequence = nextDirectiveActionRunnerEventSequence({
    directiveRoot: input.directiveRoot,
    runnerId: input.runnerId,
  });
  appendDirectiveActionRunnerEvents({
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
  actionKind: DirectiveActionRunnerRecord["actionKind"];
  actionPath: string;
  startedAt: string;
  updatedAt: string;
  attempts: number;
  lifecycleState: DirectiveActionRunnerRecord["lifecycleState"];
  checkpointStage: DirectiveActionRunnerRecord["checkpointStage"];
  lastError: DirectiveActionRunnerRecord["lastError"];
  actionResult: DirectiveActionRunnerRecord["actionResult"];
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
  } satisfies DirectiveActionRunnerRecord;
}

export function writeDirectiveRuntimeRunnerRecord(input: {
  directiveRoot: string;
  record: DirectiveActionRunnerRecord;
}) {
  return writeDirectiveActionRunnerRecord({
    directiveRoot: input.directiveRoot,
    record: input.record,
  }).record;
}

export function writeInterruptedDirectiveRuntimeRunnerRecord(input: {
  directiveRoot: string;
  runnerId: string;
  caseId: string;
  actionKind: DirectiveActionRunnerRecord["actionKind"];
  record: DirectiveActionRunnerRecord;
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

export function runDirectiveRuntimeCheckpointRunner(input: {
  directiveRoot: string;
  runnerId: string;
  caseId: string;
  actionKind: DirectiveRunnerActionKind;
  actionPath: string;
  existingRecord: DirectiveActionRunnerRecord | null;
  testInterruptPoint?: DirectiveRuntimeCheckpointRunnerInterruptionPoint;
  resumedFromAfterActionMessage: string;
  completedFromAfterActionMessage: string;
  resumedBeforeActionMessage: string;
  firstInvocationMessage: string;
  beforeActionCheckpointMessage: string;
  afterActionCheckpointMessage: string;
  completedAfterActionMessage: string;
  action: () => DirectiveRunnerActionResult;
}): DirectiveRuntimeCheckpointRunnerResult {
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
    const actionResult = input.action();
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
