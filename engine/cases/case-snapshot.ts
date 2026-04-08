import {
  readDirectiveCaseMirrorEvents,
  type DirectiveCaseMirrorEvent,
} from "./case-event-log.ts";
import {
  readDirectiveMirroredDiscoveryCaseRecord,
  type DirectiveMirroredDiscoveryCaseRecord,
} from "./case-store.ts";

export type DirectiveMirroredCaseSnapshot = {
  ok: true;
  caseId: string;
  candidateId: string;
  candidateName: string;
  routeTarget: string | null;
  operatingMode: string | null;
  queueStatus: string | null;
  decisionState: string | null;
  currentHeadPath: string | null;
  currentStage: string | null;
  nextLegalStep: string | null;
  latestEventType: DirectiveCaseMirrorEvent["eventType"] | null;
  materializedFromEventId: string | null;
  linkedArtifacts: DirectiveMirroredDiscoveryCaseRecord["linkedArtifacts"];
};

export type DirectiveMirroredCaseSnapshotResult =
  | DirectiveMirroredCaseSnapshot
  | {
      ok: false;
      caseId: string;
      reason: "missing_case_record";
    };

function sortEvents(events: DirectiveCaseMirrorEvent[]) {
  return [...events].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }
    return left.occurredAt.localeCompare(right.occurredAt);
  });
}

function findLatestStateMaterializedEvent(events: DirectiveCaseMirrorEvent[]) {
  return [...events]
    .reverse()
    .find((event) => event.eventType === "state_materialized")
    ?? null;
}

export function materializeDirectiveMirroredCaseSnapshot(input: {
  directiveRoot: string;
  caseId: string;
}): DirectiveMirroredCaseSnapshotResult {
  const mirrored = readDirectiveMirroredDiscoveryCaseRecord(input);
  if (!mirrored.record) {
    return {
      ok: false,
      caseId: input.caseId,
      reason: "missing_case_record",
    };
  }

  const eventLog = readDirectiveCaseMirrorEvents(input);
  const orderedEvents = sortEvents(eventLog.events);
  const latestEvent = orderedEvents.at(-1) ?? null;
  const stateMaterializedEvent = findLatestStateMaterializedEvent(orderedEvents);
  const currentHeadPath =
    stateMaterializedEvent?.currentHeadPath
    ?? mirrored.record.linkedArtifacts.resultRecordPath
    ?? mirrored.record.linkedArtifacts.routingRecordPath
    ?? null;

  return {
    ok: true,
    caseId: mirrored.record.caseId,
    candidateId: mirrored.record.candidateId,
    candidateName: mirrored.record.candidateName,
    routeTarget: stateMaterializedEvent?.routeTarget
      ?? latestEvent?.routeTarget
      ?? mirrored.record.routeTarget,
    operatingMode: stateMaterializedEvent?.operatingMode
      ?? latestEvent?.operatingMode
      ?? mirrored.record.operatingMode,
    queueStatus: stateMaterializedEvent?.queueStatus
      ?? latestEvent?.queueStatus
      ?? mirrored.record.queueStatus,
    decisionState: stateMaterializedEvent?.decisionState
      ?? mirrored.record.decisionState,
    currentHeadPath,
    currentStage: stateMaterializedEvent?.currentStage ?? null,
    nextLegalStep: stateMaterializedEvent?.nextLegalStep ?? null,
    latestEventType: latestEvent?.eventType ?? null,
    materializedFromEventId: stateMaterializedEvent?.eventId ?? latestEvent?.eventId ?? null,
    linkedArtifacts: {
      ...mirrored.record.linkedArtifacts,
      resultRecordPath: mirrored.record.linkedArtifacts.resultRecordPath ?? null,
    },
  };
}
