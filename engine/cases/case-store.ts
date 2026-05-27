import fs from "node:fs";
import path from "node:path";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

import {
  appendCaseMirrorEvents,
  readCaseMirrorEvents,
  type CaseMirrorEvent,
} from "./case-event-log.ts";
import type { MirroredNoteArchitectureCloseoutProjectionInput } from "../../architecture/lib/control/note-closeout-projections.ts";
import type { MirroredDiscoveryFrontDoorProjectionInput } from "../../discovery/lib/front-door/projections.ts";
import type { MirroredRuntimeFollowUpOpenProjectionInput } from "../../runtime/lib/projections/follow-up-projections.ts";
import type { MirroredRuntimeProofOpenProjectionInput } from "../../runtime/lib/projections/proof-open-projections.ts";
import type { MirroredRuntimeCapabilityBoundaryOpenProjectionInput } from "../../runtime/lib/projections/capability-boundary-projections.ts";
import type { MirroredRuntimePromotionReadinessOpenProjectionInput } from "../../runtime/lib/projections/promotion-readiness-projections.ts";
import { readJson, writeJson as writeJsonPretty, withPerFileLock } from "../../shared/lib/file-io.ts";

export type MirroredDiscoveryCaseRecord = {
  schemaVersion: 1;
  mirrorKind: "discovery_front_door_submission";
  caseId: string;
  candidateId: string;
  candidateName: string;
  sourceType: string;
  sourceReference: string;
  decisionState: string;
  routeTarget: string | null;
  operatingMode: string | null;
  queueStatus: string | null;
  createdAt: string;
  updatedAt: string;
  linkedArtifacts: {
    intakeRecordPath: string | null;
    triageRecordPath: string | null;
    routingRecordPath: string | null;
    engineRunRecordPath: string | null;
    engineRunReportPath: string | null;
    architectureHandoffPath?: string | null;
    architectureDecisionPath?: string | null;
    runtimeFollowUpPath?: string | null;
    runtimeRecordPath?: string | null;
    runtimeProofPath?: string | null;
    runtimeCapabilityBoundaryPath?: string | null;
    runtimePromotionReadinessPath?: string | null;
    resultRecordPath?: string | null;
  };
  projectionInputs?: {
    discoveryFrontDoor?: MirroredDiscoveryFrontDoorProjectionInput;
    noteArchitectureCloseout?: MirroredNoteArchitectureCloseoutProjectionInput;
    runtimeFollowUpOpen?: MirroredRuntimeFollowUpOpenProjectionInput;
    runtimeProofOpen?: MirroredRuntimeProofOpenProjectionInput;
    runtimeCapabilityBoundaryOpen?: MirroredRuntimeCapabilityBoundaryOpenProjectionInput;
    runtimePromotionReadinessOpen?: MirroredRuntimePromotionReadinessOpenProjectionInput;
  } | null;
};

export type MirrorDirectiveDiscoveryFrontDoorSubmissionInput = {
  directiveRoot: string;
  caseId: string;
  candidateId: string;
  candidateName: string;
  sourceType: string;
  sourceReference: string;
  receivedAt: string;
  decisionState: string;
  routeTarget: string | null;
  operatingMode: string | null;
  queueStatus: string | null;
  linkedArtifacts: MirroredDiscoveryCaseRecord["linkedArtifacts"];
  projectionInputs?: MirroredDiscoveryCaseRecord["projectionInputs"];
};

export type MirrorDirectiveNoteArchitectureCloseoutInput = {
  directiveRoot: string;
  caseId: string;
  receivedAt: string;
  queueStatus: string | null;
  linkedArtifacts: MirroredDiscoveryCaseRecord["linkedArtifacts"];
  projectionInput: MirroredNoteArchitectureCloseoutProjectionInput;
};

export type MirrorDirectiveRuntimeFollowUpOpenInput = {
  directiveRoot: string;
  caseId: string;
  receivedAt: string;
  queueStatus: string | null;
  linkedArtifacts: MirroredDiscoveryCaseRecord["linkedArtifacts"];
  projectionInput: MirroredRuntimeFollowUpOpenProjectionInput;
};

export type MirrorDirectiveRuntimeProofOpenInput = {
  directiveRoot: string;
  caseId: string;
  receivedAt: string;
  queueStatus: string | null;
  linkedArtifacts: MirroredDiscoveryCaseRecord["linkedArtifacts"];
  projectionInput: MirroredRuntimeProofOpenProjectionInput;
};

export type MirrorDirectiveRuntimeCapabilityBoundaryOpenInput = {
  directiveRoot: string;
  caseId: string;
  receivedAt: string;
  queueStatus: string | null;
  linkedArtifacts: MirroredDiscoveryCaseRecord["linkedArtifacts"];
  projectionInput: MirroredRuntimeCapabilityBoundaryOpenProjectionInput;
};

export type MirrorDirectiveRuntimePromotionReadinessOpenInput = {
  directiveRoot: string;
  caseId: string;
  receivedAt: string;
  queueStatus: string | null;
  linkedArtifacts: MirroredDiscoveryCaseRecord["linkedArtifacts"];
  projectionInput: MirroredRuntimePromotionReadinessOpenProjectionInput;
};

function sanitizeCaseId(value: string) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function resolveDirectiveCaseRecordPath(input: {
  directiveRoot: string;
  caseId: string;
}) {
  const fileName = `${sanitizeCaseId(input.caseId) || "directive-case"}.json`;
  return normalizeAbsolutePath(
    path.join(input.directiveRoot, "state", "cases", fileName),
  );
}

export function readMirroredDiscoveryCaseRecord(input: {
  directiveRoot: string;
  caseId: string;
}) {
  const caseRecordPath = resolveDirectiveCaseRecordPath(input);
  if (!fs.existsSync(caseRecordPath)) {
    return {
      caseRecordPath,
      record: null,
    };
  }

  return {
    caseRecordPath,
    record: readJson<MirroredDiscoveryCaseRecord>(caseRecordPath),
  };
}

export function writeMirroredDiscoveryCaseRecord(input: {
  directiveRoot: string;
  record: MirroredDiscoveryCaseRecord;
}) {
  const caseRecordPath = resolveDirectiveCaseRecordPath({
    directiveRoot: input.directiveRoot,
    caseId: input.record.caseId,
  });
  writeJsonPretty(caseRecordPath, input.record);
  return {
    caseRecordPath,
    record: input.record,
  };
}

function buildDiscoveryMirrorEvents(
  input: MirrorDirectiveDiscoveryFrontDoorSubmissionInput,
) {
  const base = {
    schemaVersion: 1 as const,
    caseId: input.caseId,
    candidateId: input.candidateId,
    candidateName: input.candidateName,
    occurredAt: input.receivedAt,
    routeTarget: input.routeTarget,
    operatingMode: input.operatingMode,
  };

  return [
    {
      ...base,
      eventId: `${input.caseId}:source_submitted:v1`,
      sequence: 1,
      eventType: "source_submitted",
      queueStatus: "pending",
      linkedArtifactPath: input.linkedArtifacts.intakeRecordPath,
    },
    {
      ...base,
      eventId: `${input.caseId}:triaged:v1`,
      sequence: 2,
      eventType: "triaged",
      queueStatus: "pending",
      linkedArtifactPath: input.linkedArtifacts.triageRecordPath,
    },
    {
      ...base,
      eventId: `${input.caseId}:routed:v1`,
      sequence: 3,
      eventType: "routed",
      queueStatus: input.queueStatus,
      linkedArtifactPath: input.linkedArtifacts.routingRecordPath,
    },
  ] satisfies CaseMirrorEvent[];
}

function nextDirectiveMirrorEventSequence(input: {
  directiveRoot: string;
  caseId: string;
}) {
  const eventLog = readCaseMirrorEvents(input);
  return eventLog.events.reduce(
    (highest, event) => Math.max(highest, event.sequence),
    0,
  ) + 1;
}

export async function mirrorDirectiveDiscoveryFrontDoorSubmission(
  input: MirrorDirectiveDiscoveryFrontDoorSubmissionInput,
) {
  const caseRecordPath = resolveDirectiveCaseRecordPath({
    directiveRoot: input.directiveRoot,
    caseId: input.caseId,
  });

  return await withPerFileLock(caseRecordPath, async () => {
    const { record: existingRecord } = readMirroredDiscoveryCaseRecord({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
    });

    const nextRecord: MirroredDiscoveryCaseRecord = {
      schemaVersion: 1,
      mirrorKind: "discovery_front_door_submission",
      caseId: input.caseId,
      candidateId: input.candidateId,
      candidateName: input.candidateName,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference,
      decisionState: input.decisionState,
      routeTarget: input.routeTarget,
      operatingMode: input.operatingMode,
      queueStatus: input.queueStatus,
      createdAt: existingRecord?.createdAt ?? input.receivedAt,
      updatedAt: input.receivedAt,
      linkedArtifacts: {
        ...input.linkedArtifacts,
        architectureHandoffPath: input.linkedArtifacts.architectureHandoffPath ?? null,
        architectureDecisionPath: input.linkedArtifacts.architectureDecisionPath ?? null,
        runtimeFollowUpPath: input.linkedArtifacts.runtimeFollowUpPath ?? null,
        runtimeRecordPath: input.linkedArtifacts.runtimeRecordPath ?? null,
        runtimeProofPath: input.linkedArtifacts.runtimeProofPath ?? null,
        runtimeCapabilityBoundaryPath: input.linkedArtifacts.runtimeCapabilityBoundaryPath ?? null,
        runtimePromotionReadinessPath: input.linkedArtifacts.runtimePromotionReadinessPath ?? null,
        resultRecordPath: input.linkedArtifacts.resultRecordPath ?? null,
      },
      projectionInputs: input.projectionInputs ?? existingRecord?.projectionInputs ?? null,
    };

    writeMirroredDiscoveryCaseRecord({
      directiveRoot: input.directiveRoot,
      record: nextRecord,
    });
    const appendedEvents = appendCaseMirrorEvents({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
      events: buildDiscoveryMirrorEvents(input),
    });

    return {
      caseRecordPath,
      record: nextRecord,
      eventLogPath: appendedEvents.eventLogPath,
      events: appendedEvents.events,
      appendedEvents: appendedEvents.appendedEvents,
    };
  });
}

export async function mirrorDirectiveNoteArchitectureCloseout(
  input: MirrorDirectiveNoteArchitectureCloseoutInput,
) {
  const caseRecordPath = resolveDirectiveCaseRecordPath({
    directiveRoot: input.directiveRoot,
    caseId: input.caseId,
  });

  return await withPerFileLock(caseRecordPath, async () => {
    const mirrored = readMirroredDiscoveryCaseRecord({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
    });
    if (!mirrored.record) {
      throw new Error(
        `invalid_input: mirrored discovery case record not found for ${input.caseId}`,
      );
    }

    const nextRecord: MirroredDiscoveryCaseRecord = {
      ...mirrored.record,
      routeTarget: mirrored.record.routeTarget ?? "architecture",
      operatingMode: mirrored.record.operatingMode ?? "note",
      queueStatus: input.queueStatus,
      updatedAt: input.receivedAt,
      linkedArtifacts: {
        ...mirrored.record.linkedArtifacts,
        ...input.linkedArtifacts,
        architectureHandoffPath:
          input.linkedArtifacts.architectureHandoffPath
          ?? mirrored.record.linkedArtifacts.architectureHandoffPath
          ?? null,
        architectureDecisionPath:
          input.linkedArtifacts.architectureDecisionPath
          ?? mirrored.record.linkedArtifacts.architectureDecisionPath
          ?? null,
        runtimeFollowUpPath:
          input.linkedArtifacts.runtimeFollowUpPath
          ?? mirrored.record.linkedArtifacts.runtimeFollowUpPath
          ?? null,
        runtimeRecordPath:
          input.linkedArtifacts.runtimeRecordPath
          ?? mirrored.record.linkedArtifacts.runtimeRecordPath
          ?? null,
        runtimeProofPath:
          input.linkedArtifacts.runtimeProofPath
          ?? mirrored.record.linkedArtifacts.runtimeProofPath
          ?? null,
        runtimeCapabilityBoundaryPath:
          input.linkedArtifacts.runtimeCapabilityBoundaryPath
          ?? mirrored.record.linkedArtifacts.runtimeCapabilityBoundaryPath
          ?? null,
        resultRecordPath:
          input.linkedArtifacts.resultRecordPath
          ?? mirrored.record.linkedArtifacts.resultRecordPath
          ?? null,
      },
      projectionInputs: {
        ...(mirrored.record.projectionInputs ?? {}),
        noteArchitectureCloseout: input.projectionInput,
      },
    };

    writeMirroredDiscoveryCaseRecord({
      directiveRoot: input.directiveRoot,
      record: nextRecord,
    });

    const sequence = nextDirectiveMirrorEventSequence({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
    });
    const appendedEvents = appendCaseMirrorEvents({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
      events: [
        {
          schemaVersion: 1,
          eventId: `${input.caseId}:note_architecture_closed:v1`,
          caseId: input.caseId,
          candidateId: nextRecord.candidateId,
          candidateName: nextRecord.candidateName,
          sequence,
          eventType: "note_architecture_closed",
          occurredAt: input.receivedAt,
          queueStatus: input.queueStatus,
          routeTarget: nextRecord.routeTarget,
          operatingMode: nextRecord.operatingMode,
          linkedArtifactPath: nextRecord.linkedArtifacts.resultRecordPath ?? null,
          decisionState: nextRecord.decisionState,
        },
      ],
    });

    return {
      caseRecordPath: mirrored.caseRecordPath,
      record: nextRecord,
      eventLogPath: appendedEvents.eventLogPath,
      events: appendedEvents.events,
      appendedEvents: appendedEvents.appendedEvents,
    };
  });
}

export async function mirrorDirectiveRuntimeFollowUpOpen(
  input: MirrorDirectiveRuntimeFollowUpOpenInput,
) {
  const caseRecordPath = resolveDirectiveCaseRecordPath({
    directiveRoot: input.directiveRoot,
    caseId: input.caseId,
  });

  return await withPerFileLock(caseRecordPath, async () => {
    const mirrored = readMirroredDiscoveryCaseRecord({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
    });
    if (!mirrored.record) {
      throw new Error(
        `invalid_input: mirrored discovery case record not found for ${input.caseId}`,
      );
    }

    const nextRecord: MirroredDiscoveryCaseRecord = {
      ...mirrored.record,
      routeTarget: mirrored.record.routeTarget ?? "runtime",
      queueStatus: input.queueStatus,
      updatedAt: input.receivedAt,
      linkedArtifacts: {
        ...mirrored.record.linkedArtifacts,
        ...input.linkedArtifacts,
        architectureHandoffPath:
          input.linkedArtifacts.architectureHandoffPath
          ?? mirrored.record.linkedArtifacts.architectureHandoffPath
          ?? null,
        architectureDecisionPath:
          input.linkedArtifacts.architectureDecisionPath
          ?? mirrored.record.linkedArtifacts.architectureDecisionPath
          ?? null,
        runtimeFollowUpPath:
          input.linkedArtifacts.runtimeFollowUpPath
          ?? mirrored.record.linkedArtifacts.runtimeFollowUpPath
          ?? null,
        runtimeRecordPath:
          input.linkedArtifacts.runtimeRecordPath
          ?? mirrored.record.linkedArtifacts.runtimeRecordPath
          ?? null,
        runtimeProofPath:
          input.linkedArtifacts.runtimeProofPath
          ?? mirrored.record.linkedArtifacts.runtimeProofPath
          ?? null,
        runtimeCapabilityBoundaryPath:
          input.linkedArtifacts.runtimeCapabilityBoundaryPath
          ?? mirrored.record.linkedArtifacts.runtimeCapabilityBoundaryPath
          ?? null,
        resultRecordPath:
          input.linkedArtifacts.resultRecordPath
          ?? mirrored.record.linkedArtifacts.resultRecordPath
          ?? null,
      },
      projectionInputs: {
        ...(mirrored.record.projectionInputs ?? {}),
        runtimeFollowUpOpen: input.projectionInput,
      },
    };

    writeMirroredDiscoveryCaseRecord({
      directiveRoot: input.directiveRoot,
      record: nextRecord,
    });

    const sequence = nextDirectiveMirrorEventSequence({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
    });
    const appendedEvents = appendCaseMirrorEvents({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
      events: [
        {
          schemaVersion: 1,
          eventId: `${input.caseId}:runtime_follow_up_opened:v1`,
          caseId: input.caseId,
          candidateId: nextRecord.candidateId,
          candidateName: nextRecord.candidateName,
          sequence,
          eventType: "runtime_follow_up_opened",
          occurredAt: input.receivedAt,
          queueStatus: input.queueStatus,
          routeTarget: nextRecord.routeTarget,
          operatingMode: nextRecord.operatingMode,
          linkedArtifactPath: nextRecord.linkedArtifacts.runtimeRecordPath ?? null,
          decisionState: nextRecord.decisionState,
        },
      ],
    });

    return {
      caseRecordPath: mirrored.caseRecordPath,
      record: nextRecord,
      eventLogPath: appendedEvents.eventLogPath,
      events: appendedEvents.events,
      appendedEvents: appendedEvents.appendedEvents,
    };
  });
}

export async function mirrorDirectiveRuntimeProofOpen(
  input: MirrorDirectiveRuntimeProofOpenInput,
) {
  const caseRecordPath = resolveDirectiveCaseRecordPath({
    directiveRoot: input.directiveRoot,
    caseId: input.caseId,
  });

  return await withPerFileLock(caseRecordPath, async () => {
    const mirrored = readMirroredDiscoveryCaseRecord({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
    });
    if (!mirrored.record) {
      throw new Error(
        `invalid_input: mirrored discovery case record not found for ${input.caseId}`,
      );
    }

    const nextRecord: MirroredDiscoveryCaseRecord = {
      ...mirrored.record,
      routeTarget: mirrored.record.routeTarget ?? "runtime",
      queueStatus: input.queueStatus,
      updatedAt: input.receivedAt,
      linkedArtifacts: {
        ...mirrored.record.linkedArtifacts,
        ...input.linkedArtifacts,
        architectureHandoffPath:
          input.linkedArtifacts.architectureHandoffPath
          ?? mirrored.record.linkedArtifacts.architectureHandoffPath
          ?? null,
        architectureDecisionPath:
          input.linkedArtifacts.architectureDecisionPath
          ?? mirrored.record.linkedArtifacts.architectureDecisionPath
          ?? null,
        runtimeFollowUpPath:
          input.linkedArtifacts.runtimeFollowUpPath
          ?? mirrored.record.linkedArtifacts.runtimeFollowUpPath
          ?? null,
        runtimeRecordPath:
          input.linkedArtifacts.runtimeRecordPath
          ?? mirrored.record.linkedArtifacts.runtimeRecordPath
          ?? null,
        runtimeProofPath:
          input.linkedArtifacts.runtimeProofPath
          ?? mirrored.record.linkedArtifacts.runtimeProofPath
          ?? null,
        runtimeCapabilityBoundaryPath:
          input.linkedArtifacts.runtimeCapabilityBoundaryPath
          ?? mirrored.record.linkedArtifacts.runtimeCapabilityBoundaryPath
          ?? null,
        resultRecordPath:
          input.linkedArtifacts.resultRecordPath
          ?? mirrored.record.linkedArtifacts.resultRecordPath
          ?? null,
      },
      projectionInputs: {
        ...(mirrored.record.projectionInputs ?? {}),
        runtimeProofOpen: input.projectionInput,
      },
    };

    writeMirroredDiscoveryCaseRecord({
      directiveRoot: input.directiveRoot,
      record: nextRecord,
    });

    const sequence = nextDirectiveMirrorEventSequence({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
    });
    const appendedEvents = appendCaseMirrorEvents({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
      events: [
        {
          schemaVersion: 1,
          eventId: `${input.caseId}:runtime_proof_opened:v1`,
          caseId: input.caseId,
          candidateId: nextRecord.candidateId,
          candidateName: nextRecord.candidateName,
          sequence,
          eventType: "runtime_proof_opened",
          occurredAt: input.receivedAt,
          queueStatus: input.queueStatus,
          routeTarget: nextRecord.routeTarget,
          operatingMode: nextRecord.operatingMode,
          linkedArtifactPath: nextRecord.linkedArtifacts.runtimeProofPath ?? null,
          decisionState: nextRecord.decisionState,
        },
      ],
    });

    return {
      caseRecordPath: mirrored.caseRecordPath,
      record: nextRecord,
      eventLogPath: appendedEvents.eventLogPath,
      events: appendedEvents.events,
      appendedEvents: appendedEvents.appendedEvents,
    };
  });
}

export async function mirrorDirectiveRuntimeCapabilityBoundaryOpen(
  input: MirrorDirectiveRuntimeCapabilityBoundaryOpenInput,
) {
  const caseRecordPath = resolveDirectiveCaseRecordPath({
    directiveRoot: input.directiveRoot,
    caseId: input.caseId,
  });

  return await withPerFileLock(caseRecordPath, async () => {
    const mirrored = readMirroredDiscoveryCaseRecord({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
    });
    if (!mirrored.record) {
      throw new Error(
        `invalid_input: mirrored discovery case record not found for ${input.caseId}`,
      );
    }

    const nextRecord: MirroredDiscoveryCaseRecord = {
      ...mirrored.record,
      routeTarget: mirrored.record.routeTarget ?? "runtime",
      queueStatus: input.queueStatus,
      updatedAt: input.receivedAt,
      linkedArtifacts: {
        ...mirrored.record.linkedArtifacts,
        ...input.linkedArtifacts,
        architectureHandoffPath:
          input.linkedArtifacts.architectureHandoffPath
          ?? mirrored.record.linkedArtifacts.architectureHandoffPath
          ?? null,
        architectureDecisionPath:
          input.linkedArtifacts.architectureDecisionPath
          ?? mirrored.record.linkedArtifacts.architectureDecisionPath
          ?? null,
        runtimeFollowUpPath:
          input.linkedArtifacts.runtimeFollowUpPath
          ?? mirrored.record.linkedArtifacts.runtimeFollowUpPath
          ?? null,
        runtimeRecordPath:
          input.linkedArtifacts.runtimeRecordPath
          ?? mirrored.record.linkedArtifacts.runtimeRecordPath
          ?? null,
        runtimeProofPath:
          input.linkedArtifacts.runtimeProofPath
          ?? mirrored.record.linkedArtifacts.runtimeProofPath
          ?? null,
        runtimeCapabilityBoundaryPath:
          input.linkedArtifacts.runtimeCapabilityBoundaryPath
          ?? mirrored.record.linkedArtifacts.runtimeCapabilityBoundaryPath
          ?? null,
        resultRecordPath:
          input.linkedArtifacts.resultRecordPath
          ?? mirrored.record.linkedArtifacts.resultRecordPath
          ?? null,
      },
      projectionInputs: {
        ...(mirrored.record.projectionInputs ?? {}),
        runtimeCapabilityBoundaryOpen: input.projectionInput,
      },
    };

    writeMirroredDiscoveryCaseRecord({
      directiveRoot: input.directiveRoot,
      record: nextRecord,
    });

    const sequence = nextDirectiveMirrorEventSequence({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
    });
    const appendedEvents = appendCaseMirrorEvents({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
      events: [
        {
          schemaVersion: 1,
          eventId: `${input.caseId}:runtime_capability_boundary_opened:v1`,
          caseId: input.caseId,
          candidateId: nextRecord.candidateId,
          candidateName: nextRecord.candidateName,
          sequence,
          eventType: "runtime_capability_boundary_opened",
          occurredAt: input.receivedAt,
          queueStatus: input.queueStatus,
          routeTarget: nextRecord.routeTarget,
          operatingMode: nextRecord.operatingMode,
          linkedArtifactPath: nextRecord.linkedArtifacts.runtimeCapabilityBoundaryPath ?? null,
          decisionState: nextRecord.decisionState,
        },
      ],
    });

    return {
      caseRecordPath: mirrored.caseRecordPath,
      record: nextRecord,
      eventLogPath: appendedEvents.eventLogPath,
      events: appendedEvents.events,
      appendedEvents: appendedEvents.appendedEvents,
    };
  });
}

export async function mirrorDirectiveRuntimePromotionReadinessOpen(
  input: MirrorDirectiveRuntimePromotionReadinessOpenInput,
) {
  const caseRecordPath = resolveDirectiveCaseRecordPath({
    directiveRoot: input.directiveRoot,
    caseId: input.caseId,
  });

  return await withPerFileLock(caseRecordPath, async () => {
    const mirrored = readMirroredDiscoveryCaseRecord({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
    });
    if (!mirrored.record) {
      throw new Error(
        `invalid_input: mirrored discovery case record not found for ${input.caseId}`,
      );
    }

    const nextRecord: MirroredDiscoveryCaseRecord = {
      ...mirrored.record,
      routeTarget: mirrored.record.routeTarget ?? "runtime",
      queueStatus: input.queueStatus,
      updatedAt: input.receivedAt,
      linkedArtifacts: {
        ...mirrored.record.linkedArtifacts,
        ...input.linkedArtifacts,
        architectureHandoffPath:
          input.linkedArtifacts.architectureHandoffPath
          ?? mirrored.record.linkedArtifacts.architectureHandoffPath
          ?? null,
        architectureDecisionPath:
          input.linkedArtifacts.architectureDecisionPath
          ?? mirrored.record.linkedArtifacts.architectureDecisionPath
          ?? null,
        runtimeFollowUpPath:
          input.linkedArtifacts.runtimeFollowUpPath
          ?? mirrored.record.linkedArtifacts.runtimeFollowUpPath
          ?? null,
        runtimeRecordPath:
          input.linkedArtifacts.runtimeRecordPath
          ?? mirrored.record.linkedArtifacts.runtimeRecordPath
          ?? null,
        runtimeProofPath:
          input.linkedArtifacts.runtimeProofPath
          ?? mirrored.record.linkedArtifacts.runtimeProofPath
          ?? null,
        runtimeCapabilityBoundaryPath:
          input.linkedArtifacts.runtimeCapabilityBoundaryPath
          ?? mirrored.record.linkedArtifacts.runtimeCapabilityBoundaryPath
          ?? null,
        runtimePromotionReadinessPath:
          input.linkedArtifacts.runtimePromotionReadinessPath
          ?? mirrored.record.linkedArtifacts.runtimePromotionReadinessPath
          ?? null,
        resultRecordPath:
          input.linkedArtifacts.resultRecordPath
          ?? mirrored.record.linkedArtifacts.resultRecordPath
          ?? null,
      },
      projectionInputs: {
        ...(mirrored.record.projectionInputs ?? {}),
        runtimePromotionReadinessOpen: input.projectionInput,
      },
    };

    writeMirroredDiscoveryCaseRecord({
      directiveRoot: input.directiveRoot,
      record: nextRecord,
    });

    const sequence = nextDirectiveMirrorEventSequence({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
    });
    const appendedEvents = appendCaseMirrorEvents({
      directiveRoot: input.directiveRoot,
      caseId: input.caseId,
      events: [
        {
          schemaVersion: 1,
          eventId: `${input.caseId}:runtime_promotion_readiness_opened:v1`,
          caseId: input.caseId,
          candidateId: nextRecord.candidateId,
          candidateName: nextRecord.candidateName,
          sequence,
          eventType: "runtime_promotion_readiness_opened",
          occurredAt: input.receivedAt,
          queueStatus: input.queueStatus,
          routeTarget: nextRecord.routeTarget,
          operatingMode: nextRecord.operatingMode,
          linkedArtifactPath: nextRecord.linkedArtifacts.runtimePromotionReadinessPath ?? null,
          decisionState: nextRecord.decisionState,
        },
      ],
    });

    return {
      caseRecordPath: mirrored.caseRecordPath,
      record: nextRecord,
      eventLogPath: appendedEvents.eventLogPath,
      events: appendedEvents.events,
      appendedEvents: appendedEvents.appendedEvents,
    };
  });
}
