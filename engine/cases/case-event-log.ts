import path from "node:path";
import { readJsonLines, appendJsonLine } from "../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

export type CaseMirrorEventType =
  | "source_submitted"
  | "triaged"
  | "routed"
  | "note_architecture_closed"
  | "runtime_follow_up_opened"
  | "runtime_proof_opened"
  | "runtime_capability_boundary_opened"
  | "runtime_promotion_readiness_opened"
  | "state_materialized";

export type CaseMirrorEvent = {
  schemaVersion: 1;
  eventId: string;
  caseId: string;
  candidateId: string;
  candidateName: string;
  sequence: number;
  eventType: CaseMirrorEventType;
  occurredAt: string;
  queueStatus: string | null;
  routeTarget: string | null;
  operatingMode: string | null;
  linkedArtifactPath: string | null;
  decisionState?: string | null;
  currentHeadPath?: string | null;
  currentStage?: string | null;
  nextLegalStep?: string | null;
};

function sanitizeCaseId(value: string) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function resolveDirectiveCaseEventLogPath(input: {
  directiveRoot: string;
  caseId: string;
}) {
  const fileName = `${sanitizeCaseId(input.caseId) || "directive-case"}.jsonl`;
  return normalizeAbsolutePath(
    path.join(input.directiveRoot, "state", "case-events", fileName),
  );
}

export function readCaseMirrorEvents(input: {
  directiveRoot: string;
  caseId: string;
}) {
  const eventLogPath = resolveDirectiveCaseEventLogPath(input);
  return {
    eventLogPath,
    events: readJsonLines<CaseMirrorEvent>(eventLogPath),
  };
}

export function appendCaseMirrorEvents(input: {
  directiveRoot: string;
  caseId: string;
  events: CaseMirrorEvent[];
}) {
  const { eventLogPath, events: existingEvents } = readCaseMirrorEvents({
    directiveRoot: input.directiveRoot,
    caseId: input.caseId,
  });
  const existingIds = new Set(existingEvents.map((event) => event.eventId));
  const appendedEvents: CaseMirrorEvent[] = [];

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
