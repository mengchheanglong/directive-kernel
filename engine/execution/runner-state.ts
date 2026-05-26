import fs from "node:fs";
import path from "node:path";

import {
  readJson,
  writeJson as writeJsonPretty,
  readJsonLines,
  appendJsonLine,
} from "../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

export type RunnerActionKind =
  | "runtime_follow_up_open"
  | "runtime_proof_open"
  | "runtime_capability_boundary_open"
  | "runtime_promotion_readiness_open";

export type RunnerLifecycleState =
  | "ready"
  | "running"
  | "interrupted"
  | "failed"
  | "completed";

export type RunnerCheckpointStage =
  | "initialized"
  | "before_action"
  | "after_action"
  | "completed";

export type RunnerActionResult = {
  created: boolean;
  directiveRoot: string;
  followUpRelativePath: string;
  runtimeRecordRelativePath: string;
  runtimeRecordAbsolutePath: string;
  runtimeProofRelativePath?: string | null;
  runtimeProofAbsolutePath?: string | null;
  runtimeCapabilityBoundaryRelativePath?: string | null;
  runtimeCapabilityBoundaryAbsolutePath?: string | null;
  runtimePromotionReadinessRelativePath?: string | null;
  runtimePromotionReadinessAbsolutePath?: string | null;
  candidateId: string;
  candidateName: string;
};

export type ActionRunnerRecord = {
  schemaVersion: 1;
  runnerId: string;
  caseId: string;
  actionKind: RunnerActionKind;
  lifecycleState: RunnerLifecycleState;
  checkpointStage: RunnerCheckpointStage;
  actionPath: string;
  startedAt: string;
  updatedAt: string;
  attempts: number;
  lastError: {
    name: string;
    message: string;
    at: string;
    stage: RunnerCheckpointStage;
  } | null;
  actionResult: RunnerActionResult | null;
};

export type ActionRunnerEventType =
  | "runner_invoked"
  | "runner_resumed"
  | "before_action_checkpointed"
  | "after_action_checkpointed"
  | "runner_interrupted"
  | "runner_failed"
  | "runner_completed";

export type ActionRunnerEvent = {
  schemaVersion: 1;
  eventId: string;
  runnerId: string;
  caseId: string;
  actionKind: RunnerActionKind;
  sequence: number;
  eventType: ActionRunnerEventType;
  occurredAt: string;
  lifecycleState: RunnerLifecycleState;
  checkpointStage: RunnerCheckpointStage;
  message: string;
};

export type RuntimeTwoStepSequenceActionKind =
  | "runtime_follow_up_open"
  | "runtime_proof_open"
  | "runtime_capability_boundary_open";

export type RuntimeTwoStepSequenceCheckpointStage =
  | "before_step_1"
  | "after_step_1"
  | "after_step_2"
  | "completed";

export type RuntimeTwoStepSequenceStepRecord = {
  stepIndex: 1 | 2;
  actionKind: RuntimeTwoStepSequenceActionKind;
  targetPath: string;
  approvedBy: string | null;
  runnerId: string;
  completedAt: string | null;
  actionResult: RunnerActionResult | null;
};

export type RuntimeTwoStepSequenceRecord = {
  schemaVersion: 1;
  sequenceId: string;
  caseId: string;
  lifecycleState: RunnerLifecycleState;
  checkpointStage: RuntimeTwoStepSequenceCheckpointStage;
  startedAt: string;
  updatedAt: string;
  attempts: number;
  declaredActionCount: 2;
  completedStepCount: 0 | 1 | 2;
  steps: [
    RuntimeTwoStepSequenceStepRecord,
    RuntimeTwoStepSequenceStepRecord,
  ];
  lastError: {
    name: string;
    message: string;
    at: string;
    stage: RuntimeTwoStepSequenceCheckpointStage;
  } | null;
};

export type RuntimeTwoStepSequenceEventType =
  | "sequence_invoked"
  | "sequence_resumed"
  | "before_step_1_checkpointed"
  | "after_step_1_checkpointed"
  | "after_step_2_checkpointed"
  | "sequence_interrupted"
  | "sequence_failed"
  | "sequence_completed";

export type RuntimeTwoStepSequenceEvent = {
  schemaVersion: 1;
  eventId: string;
  sequenceId: string;
  caseId: string;
  sequence: number;
  eventType: RuntimeTwoStepSequenceEventType;
  occurredAt: string;
  lifecycleState: RunnerLifecycleState;
  checkpointStage: RuntimeTwoStepSequenceCheckpointStage;
  message: string;
};

function sanitizeId(value: string) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}


export function resolveDirectiveRunnerRecordPath(input: {
  directiveRoot: string;
  runnerId: string;
}) {
  const fileName = `${sanitizeId(input.runnerId) || "directive-runner"}.json`;
  return normalizeAbsolutePath(
    path.join(input.directiveRoot, "state", "runners", fileName),
  );
}

export function resolveDirectiveRunnerEventLogPath(input: {
  directiveRoot: string;
  runnerId: string;
}) {
  const fileName = `${sanitizeId(input.runnerId) || "directive-runner"}.jsonl`;
  return normalizeAbsolutePath(
    path.join(input.directiveRoot, "state", "runner-events", fileName),
  );
}

export function resolveDirectiveTwoStepSequenceRecordPath(input: {
  directiveRoot: string;
  sequenceId: string;
}) {
  const fileName = `${sanitizeId(input.sequenceId) || "directive-runner-sequence"}.json`;
  return normalizeAbsolutePath(
    path.join(input.directiveRoot, "state", "runner-sequences", fileName),
  );
}

export function resolveDirectiveTwoStepSequenceEventLogPath(input: {
  directiveRoot: string;
  sequenceId: string;
}) {
  const fileName = `${sanitizeId(input.sequenceId) || "directive-runner-sequence"}.jsonl`;
  return normalizeAbsolutePath(
    path.join(input.directiveRoot, "state", "runner-sequence-events", fileName),
  );
}

export function readActionRunnerRecord(input: {
  directiveRoot: string;
  runnerId: string;
}) {
  const runnerRecordPath = resolveDirectiveRunnerRecordPath(input);
  if (!fs.existsSync(runnerRecordPath)) {
    return {
      runnerRecordPath,
      record: null,
    };
  }

  return {
    runnerRecordPath,
    record: readJson<ActionRunnerRecord>(runnerRecordPath),
  };
}

export function writeActionRunnerRecord(input: {
  directiveRoot: string;
  record: ActionRunnerRecord;
}) {
  const runnerRecordPath = resolveDirectiveRunnerRecordPath({
    directiveRoot: input.directiveRoot,
    runnerId: input.record.runnerId,
  });
  writeJsonPretty(runnerRecordPath, input.record);
  return {
    runnerRecordPath,
    record: input.record,
  };
}

export function readActionRunnerEvents(input: {
  directiveRoot: string;
  runnerId: string;
}) {
  const eventLogPath = resolveDirectiveRunnerEventLogPath(input);
  return {
    eventLogPath,
    events: readJsonLines<ActionRunnerEvent>(eventLogPath),
  };
}

export function nextActionRunnerEventSequence(input: {
  directiveRoot: string;
  runnerId: string;
}) {
  const { events } = readActionRunnerEvents(input);
  return events.reduce(
    (highest, event) => Math.max(highest, event.sequence),
    0,
  ) + 1;
}

export function appendActionRunnerEvents(input: {
  directiveRoot: string;
  runnerId: string;
  events: ActionRunnerEvent[];
}) {
  const { eventLogPath, events: existingEvents } = readActionRunnerEvents({
    directiveRoot: input.directiveRoot,
    runnerId: input.runnerId,
  });
  const existingIds = new Set(existingEvents.map((event) => event.eventId));
  const appendedEvents: ActionRunnerEvent[] = [];

  for (const event of input.events) {
    if (existingIds.has(event.eventId)) {
      continue;
    }

    appendJsonLine(eventLogPath, event);
    existingIds.add(event.eventId);
    appendedEvents.push(event);
  }

  return {
    eventLogPath,
    appendedEvents,
    events: [...existingEvents, ...appendedEvents],
  };
}

export function readRuntimeTwoStepSequenceRecord(input: {
  directiveRoot: string;
  sequenceId: string;
}) {
  const sequenceRecordPath = resolveDirectiveTwoStepSequenceRecordPath(input);
  if (!fs.existsSync(sequenceRecordPath)) {
    return {
      sequenceRecordPath,
      record: null,
    };
  }

  return {
    sequenceRecordPath,
    record: readJson<RuntimeTwoStepSequenceRecord>(sequenceRecordPath),
  };
}

export function writeRuntimeTwoStepSequenceRecord(input: {
  directiveRoot: string;
  record: RuntimeTwoStepSequenceRecord;
}) {
  const sequenceRecordPath = resolveDirectiveTwoStepSequenceRecordPath({
    directiveRoot: input.directiveRoot,
    sequenceId: input.record.sequenceId,
  });
  writeJsonPretty(sequenceRecordPath, input.record);
  return {
    sequenceRecordPath,
    record: input.record,
  };
}

export function readRuntimeTwoStepSequenceEvents(input: {
  directiveRoot: string;
  sequenceId: string;
}) {
  const eventLogPath = resolveDirectiveTwoStepSequenceEventLogPath(input);
  return {
    eventLogPath,
    events: readJsonLines<RuntimeTwoStepSequenceEvent>(eventLogPath),
  };
}

export function nextRuntimeTwoStepSequenceEventSequence(input: {
  directiveRoot: string;
  sequenceId: string;
}) {
  const { events } = readRuntimeTwoStepSequenceEvents(input);
  return events.reduce(
    (highest, event) => Math.max(highest, event.sequence),
    0,
  ) + 1;
}

export function appendRuntimeTwoStepSequenceEvents(input: {
  directiveRoot: string;
  sequenceId: string;
  events: RuntimeTwoStepSequenceEvent[];
}) {
  const { eventLogPath, events: existingEvents } = readRuntimeTwoStepSequenceEvents({
    directiveRoot: input.directiveRoot,
    sequenceId: input.sequenceId,
  });
  const existingIds = new Set(existingEvents.map((event) => event.eventId));
  const appendedEvents: RuntimeTwoStepSequenceEvent[] = [];

  for (const event of input.events) {
    if (existingIds.has(event.eventId)) {
      continue;
    }

    appendJsonLine(eventLogPath, event);
    existingIds.add(event.eventId);
    appendedEvents.push(event);
  }

  return {
    eventLogPath,
    appendedEvents,
    events: [...existingEvents, ...appendedEvents],
  };
}
