import path from "node:path";

import { writeUtf8 } from "../../shared/lib/file-io.ts";

import { readDirectiveCaseMirrorEvents } from "../../engine/cases/case-event-log.ts";
import { readDirectiveMirroredDiscoveryCaseRecord } from "../../engine/cases/case-store.ts";
import {
  renderDiscoveryIntakeRecord,
  renderDiscoveryTriageRecord,
  type DiscoveryCaseIntakeSection,
  type DiscoveryCaseTriageSection,
} from "./discovery-case-record-writer.ts";
import {
  renderDiscoveryRoutingRecord,
  type DiscoveryRoutingDecisionState,
  type DiscoveryRoutingRecordRequest,
} from "./discovery-routing-record-writer.ts";

export type DirectiveMirroredDiscoveryFrontDoorProjectionInput = {
  routeDate: string;
  decisionState: DiscoveryRoutingDecisionState;
  intake: DiscoveryCaseIntakeSection;
  triage: DiscoveryCaseTriageSection;
  routing: Omit<DiscoveryRoutingRecordRequest, "candidate_id" | "candidate_name">;
};

export type DirectiveDiscoveryFrontDoorProjectionSet =
  | {
      ok: false;
      reason: "missing_case_record" | "missing_projection_input";
      caseId: string;
    }
  | {
      ok: true;
      caseId: string;
      queueStatus: string | null;
      routeTarget: string | null;
      operatingMode: string | null;
      latestEventType: string | null;
      paths: {
        intakeRecordPath: string;
        triageRecordPath: string;
        routingRecordPath: string;
      };
      markdown: {
        intake: string;
        triage: string;
        routing: string;
      };
    };



export function materializeDirectiveDiscoveryFrontDoorProjectionSet(input: {
  directiveRoot: string;
  caseId: string;
}): DirectiveDiscoveryFrontDoorProjectionSet {
  const mirrored = readDirectiveMirroredDiscoveryCaseRecord(input);
  if (!mirrored.record) {
    return {
      ok: false,
      reason: "missing_case_record",
      caseId: input.caseId,
    };
  }

  const projectionInput = mirrored.record.projectionInputs?.discoveryFrontDoor ?? null;
  if (!projectionInput) {
    return {
      ok: false,
      reason: "missing_projection_input",
      caseId: input.caseId,
    };
  }

  const eventLog = readDirectiveCaseMirrorEvents(input);
  const latestEvent = [...eventLog.events]
    .sort((left, right) => left.sequence - right.sequence || left.occurredAt.localeCompare(right.occurredAt))
    .at(-1) ?? null;

  const intakeRecordPath =
    mirrored.record.linkedArtifacts.intakeRecordPath
    ?? projectionInput.routing.linked_intake_record;
  const triageRecordPath =
    mirrored.record.linkedArtifacts.triageRecordPath
    ?? projectionInput.routing.linked_triage_record
    ?? null;
  const routingRecordPath = mirrored.record.linkedArtifacts.routingRecordPath;

  if (!intakeRecordPath || !triageRecordPath || !routingRecordPath) {
    return {
      ok: false,
      reason: "missing_projection_input",
      caseId: input.caseId,
    };
  }

  return {
    ok: true,
    caseId: mirrored.record.caseId,
    queueStatus: latestEvent?.queueStatus ?? mirrored.record.queueStatus,
    routeTarget: latestEvent?.routeTarget ?? mirrored.record.routeTarget,
    operatingMode: latestEvent?.operatingMode ?? mirrored.record.operatingMode,
    latestEventType: latestEvent?.eventType ?? null,
    paths: {
      intakeRecordPath,
      triageRecordPath,
      routingRecordPath,
    },
    markdown: {
      intake: renderDiscoveryIntakeRecord({
        candidate_id: mirrored.record.candidateId,
        candidate_name: mirrored.record.candidateName,
        intake: projectionInput.intake,
        linked_triage_record: triageRecordPath,
      }),
      triage: renderDiscoveryTriageRecord({
        candidate_id: mirrored.record.candidateId,
        candidate_name: mirrored.record.candidateName,
        triage: projectionInput.triage,
        linked_intake_record: intakeRecordPath,
      }),
      routing: renderDiscoveryRoutingRecord({
        candidate_id: mirrored.record.candidateId,
        candidate_name: mirrored.record.candidateName,
        ...projectionInput.routing,
        linked_intake_record: intakeRecordPath,
        linked_triage_record: triageRecordPath,
      }),
    },
  };
}

export function writeDirectiveDiscoveryFrontDoorProjectionSet(input: {
  directiveRoot: string;
  caseId: string;
}) {
  const projectionSet = materializeDirectiveDiscoveryFrontDoorProjectionSet(input);
  if (!projectionSet.ok) {
    return projectionSet;
  }

  writeUtf8(
    path.resolve(input.directiveRoot, projectionSet.paths.intakeRecordPath),
    projectionSet.markdown.intake,
  );
  writeUtf8(
    path.resolve(input.directiveRoot, projectionSet.paths.triageRecordPath),
    projectionSet.markdown.triage,
  );
  writeUtf8(
    path.resolve(input.directiveRoot, projectionSet.paths.routingRecordPath),
    projectionSet.markdown.routing,
  );

  return projectionSet;
}
