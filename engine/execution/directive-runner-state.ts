import fs from "node:fs";
import path from "node:path";

import {
  readJson,
  writeJson as writeJsonPretty,
  readJsonLines,
  appendJsonLine,
} from "../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

export type DirectiveRunnerActionKind =
  | "runtime_follow_up_open"
  | "runtime_proof_open"
  | "runtime_capability_boundary_open"
  | "runtime_promotion_readiness_open";

export type DirectiveRunnerLifecycleState =
  | "ready"
  | "running"
  | "interrupted"
  | "failed"
  | "completed";

export type DirectiveRunnerCheckpointStage =
  | "initialized"
  | "before_action"
  | "after_action"
  | "completed";

export type DirectiveRunnerActionResult = {
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

export type DirectiveActionRunnerRecord = {
  schemaVersion: 1;
  runnerId: string;
  caseId: string;
  actionKind: DirectiveRunnerActionKind;
  lifecycleState: DirectiveRunnerLifecycleState;
  checkpointStage: DirectiveRunnerCheckpointStage;
  actionPath: string;
  startedAt: string;
  updatedAt: string;
  attempts: number;
  lastError: {
    name: string;
    message: string;
    at: string;
    stage: DirectiveRunnerCheckpointStage;
  } | null;
  actionResult: DirectiveRunnerActionResult | null;
};

export type DirectiveActionRunnerEventType =
  | "runner_invoked"
  | "runner_resumed"
  | "before_action_checkpointed"
  | "after_action_checkpointed"
  | "runner_interrupted"
  | "runner_failed"
  | "runner_completed";

export type DirectiveActionRunnerEvent = {
  schemaVersion: 1;
  eventId: string;
  runnerId: string;
  caseId: string;
  actionKind: DirectiveRunnerActionKind;
  sequence: number;
  eventType: DirectiveActionRunnerEventType;
  occurredAt: string;
  lifecycleState: DirectiveRunnerLifecycleState;
  checkpointStage: DirectiveRunnerCheckpointStage;
  message: string;
};

export type DirectiveRuntimeTwoStepSequenceActionKind =
  | "runtime_follow_up_open"
  | "runtime_proof_open"
  | "runtime_capability_boundary_open";

export type DirectiveRuntimeTwoStepSequenceCheckpointStage =
  | "before_step_1"
  | "after_step_1"
  | "after_step_2"
  | "completed";

export type DirectiveRuntimeTwoStepSequenceStepRecord = {
  stepIndex: 1 | 2;
  actionKind: DirectiveRuntimeTwoStepSequenceActionKind;
  targetPath: string;
  approvedBy: string | null;
  runnerId: string;
  completedAt: string | null;
  actionResult: DirectiveRunnerActionResult | null;
};

export type DirectiveRuntimeTwoStepSequenceRecord = {
  schemaVersion: 1;
  sequenceId: string;
  caseId: string;
  lifecycleState: DirectiveRunnerLifecycleState;
  checkpointStage: DirectiveRuntimeTwoStepSequenceCheckpointStage;
  startedAt: string;
  updatedAt: string;
  attempts: number;
  declaredActionCount: 2;
  completedStepCount: 0 | 1 | 2;
  steps: [
    DirectiveRuntimeTwoStepSequenceStepRecord,
    DirectiveRuntimeTwoStepSequenceStepRecord,
  ];
  lastError: {
    name: string;
    message: string;
    at: string;
    stage: DirectiveRuntimeTwoStepSequenceCheckpointStage;
  } | null;
};

export type DirectiveRuntimeTwoStepSequenceEventType =
  | "sequence_invoked"
  | "sequence_resumed"
  | "before_step_1_checkpointed"
  | "after_step_1_checkpointed"
  | "after_step_2_checkpointed"
  | "sequence_interrupted"
  | "sequence_failed"
  | "sequence_completed";

export type DirectiveRuntimeTwoStepSequenceEvent = {
  schemaVersion: 1;
  eventId: string;
  sequenceId: string;
  caseId: string;
  sequence: number;
  eventType: DirectiveRuntimeTwoStepSequenceEventType;
  occurredAt: string;
  lifecycleState: DirectiveRunnerLifecycleState;
  checkpointStage: DirectiveRuntimeTwoStepSequenceCheckpointStage;
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

export function readDirectiveActionRunnerRecord(input: {
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
    record: readJson<DirectiveActionRunnerRecord>(runnerRecordPath),
  };
}

export function writeDirectiveActionRunnerRecord(input: {
  directiveRoot: string;
  record: DirectiveActionRunnerRecord;
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

export function readDirectiveActionRunnerEvents(input: {
  directiveRoot: string;
  runnerId: string;
}) {
  const eventLogPath = resolveDirectiveRunnerEventLogPath(input);
  return {
    eventLogPath,
    events: readJsonLines<DirectiveActionRunnerEvent>(eventLogPath),
  };
}

export function nextDirectiveActionRunnerEventSequence(input: {
  directiveRoot: string;
  runnerId: string;
}) {
  const { events } = readDirectiveActionRunnerEvents(input);
  return events.reduce(
    (highest, event) => Math.max(highest, event.sequence),
    0,
  ) + 1;
}

export function appendDirectiveActionRunnerEvents(input: {
  directiveRoot: string;
  runnerId: string;
  events: DirectiveActionRunnerEvent[];
}) {
  const { eventLogPath, events: existingEvents } = readDirectiveActionRunnerEvents({
    directiveRoot: input.directiveRoot,
    runnerId: input.runnerId,
  });
  const existingIds = new Set(existingEvents.map((event) => event.eventId));
  const appendedEvents: DirectiveActionRunnerEvent[] = [];

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

export function readDirectiveRuntimeTwoStepSequenceRecord(input: {
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
    record: readJson<DirectiveRuntimeTwoStepSequenceRecord>(sequenceRecordPath),
  };
}

export function writeDirectiveRuntimeTwoStepSequenceRecord(input: {
  directiveRoot: string;
  record: DirectiveRuntimeTwoStepSequenceRecord;
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

export function readDirectiveRuntimeTwoStepSequenceEvents(input: {
  directiveRoot: string;
  sequenceId: string;
}) {
  const eventLogPath = resolveDirectiveTwoStepSequenceEventLogPath(input);
  return {
    eventLogPath,
    events: readJsonLines<DirectiveRuntimeTwoStepSequenceEvent>(eventLogPath),
  };
}

export function nextDirectiveRuntimeTwoStepSequenceEventSequence(input: {
  directiveRoot: string;
  sequenceId: string;
}) {
  const { events } = readDirectiveRuntimeTwoStepSequenceEvents(input);
  return events.reduce(
    (highest, event) => Math.max(highest, event.sequence),
    0,
  ) + 1;
}

export function appendDirectiveRuntimeTwoStepSequenceEvents(input: {
  directiveRoot: string;
  sequenceId: string;
  events: DirectiveRuntimeTwoStepSequenceEvent[];
}) {
  const { eventLogPath, events: existingEvents } = readDirectiveRuntimeTwoStepSequenceEvents({
    directiveRoot: input.directiveRoot,
    sequenceId: input.sequenceId,
  });
  const existingIds = new Set(existingEvents.map((event) => event.eventId));
  const appendedEvents: DirectiveRuntimeTwoStepSequenceEvent[] = [];

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
