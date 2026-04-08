import path from "node:path";

import { readDirectiveCaseMirrorEvents } from "../../engine/cases/case-event-log.ts";
import { readDirectiveMirroredDiscoveryCaseRecord } from "../../engine/cases/case-store.ts";
import {
  renderDirectiveProjectionListOrPlaceholder,
  sortDirectiveProjectionEvents,
  writeDirectiveProjectionUtf8,
} from "./runtime-projection-shared.ts";

function toSentenceCase(value: string) {
  return value.replace(/[_-]+/g, " ").trim();
}

export type DirectiveMirroredRuntimeFollowUpOpenProjectionInput = {
  snapshotAt: string;
  approvedBy: string;
  followUpDate: string;
  candidateId: string;
  candidateName: string;
  followUpRelativePath: string;
  runtimeRecordRelativePath: string;
  runtimeProofRelativePath: string;
  currentDecisionState: string;
  originTrack: string;
  runtimeValueToOperationalize: string;
  proposedHost: string;
  proposedIntegrationMode: string;
  allowedExportSurfaces: string[];
  excludedBaggage: string[];
  requiredProof: string[];
  requiredGates: string[];
  risks: string[];
  rollback: string;
  noOpPath: string;
  reviewCadence: string;
  linkedHandoffPath: string | null;
};

export type DirectiveRuntimeFollowUpOpenProjectionSet =
  | {
      ok: false;
      reason:
        | "missing_case_record"
        | "missing_projection_input"
        | "missing_runtime_record_path";
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
        followUpPath: string | null;
        runtimeRecordPath: string;
        runtimeProofPath: string;
      };
      compatibility: {
        followUpPath: string | null;
        routingPath: string | null;
      };
      markdown: {
        runtimeRecord: string;
      };
    };

function renderDirectiveRuntimeFollowUpOpenProjection(input: {
  projectionInput: DirectiveMirroredRuntimeFollowUpOpenProjectionInput;
}) {
  const capabilityShape = input.projectionInput.allowedExportSurfaces.length > 0
    ? input.projectionInput.allowedExportSurfaces
    : ["bounded runtime capability"];
  const boundedSurface = capabilityShape
    .map((value) => `\`${value}\``)
    .join(", ");
  const proofSummary = input.projectionInput.requiredProof.length > 0
    ? input.projectionInput.requiredProof.join("; ")
    : "n/a";

  return `# Legacy Runtime Record: ${input.projectionInput.candidateName} (${input.projectionInput.followUpDate})

## follow-up review decision
- Candidate id: \`${input.projectionInput.candidateId}\`
- Candidate name: \`${input.projectionInput.candidateName}\`
- Source follow-up record: \`${input.projectionInput.followUpRelativePath}\`
- Review decision: \`approved_for_bounded_runtime_conversion_record\`
- Reviewed by: \`${input.projectionInput.approvedBy}\`
- Review date: \`${input.projectionInput.followUpDate}\`
- Current status: \`pending_proof_boundary\`

## bounded runtime usefulness
- Runtime value to operationalize: ${input.projectionInput.runtimeValueToOperationalize}
- Proposed host: \`${input.projectionInput.proposedHost}\`
- Proposed integration mode: ${toSentenceCase(input.projectionInput.proposedIntegrationMode)}
- Reusable capability target surface: ${boundedSurface}
- Origin track: \`${input.projectionInput.originTrack}\`
- Source decision state: \`${input.projectionInput.currentDecisionState}\`

## expected effect
- Convert this approved Runtime follow-up into one explicit Directive-owned runtime-capability record without opening execution, host integration, or automation.
- Keep the capability bounded to the follow-up objective and the approved reusable export surface only.

## proof required before any further Runtime move
- Required proof summary: ${proofSummary}
- Required proof:
${renderDirectiveProjectionListOrPlaceholder(input.projectionInput.requiredProof)}
- Required gates:
${renderDirectiveProjectionListOrPlaceholder(input.projectionInput.requiredGates.map((value) => `\`${value}\``))}

## validation boundary
- Validate against the approved Runtime follow-up record, linked Discovery routing record, and Engine evidence only.
- Do not imply runtime execution, host integration, orchestration, or background automation.
- Keep excluded baggage out of the converted capability boundary:
${renderDirectiveProjectionListOrPlaceholder(input.projectionInput.excludedBaggage)}

## rollback boundary
- Rollback: ${input.projectionInput.rollback}
- No-op path: ${input.projectionInput.noOpPath}
- Review cadence: ${input.projectionInput.reviewCadence}

## known risks
${renderDirectiveProjectionListOrPlaceholder(input.projectionInput.risks)}

## artifact linkage
- Legacy Runtime record: \`${input.projectionInput.runtimeRecordRelativePath}\`
- Source Runtime follow-up record: \`${input.projectionInput.followUpRelativePath}\`
${input.projectionInput.linkedHandoffPath ? `- Linked Discovery routing record: \`${input.projectionInput.linkedHandoffPath}\`\n` : ""}- Next Runtime proof artifact if later approved: \`${input.projectionInput.runtimeProofRelativePath}\`

## boundary
- This record does not authorize execution.
- This record does not open host integration.
- This record only records that the follow-up has been explicitly reviewed and opened into one bounded non-executing Runtime artifact.
`;
}

export function materializeDirectiveRuntimeFollowUpOpenProjectionSet(input: {
  directiveRoot: string;
  caseId: string;
}): DirectiveRuntimeFollowUpOpenProjectionSet {
  const mirrored = readDirectiveMirroredDiscoveryCaseRecord(input);
  if (!mirrored.record) {
    return {
      ok: false,
      reason: "missing_case_record",
      caseId: input.caseId,
    };
  }

  const projectionInput =
    mirrored.record.projectionInputs?.runtimeFollowUpOpen ?? null;
  if (!projectionInput) {
    return {
      ok: false,
      reason: "missing_projection_input",
      caseId: input.caseId,
    };
  }

  const runtimeRecordPath =
    mirrored.record.linkedArtifacts.runtimeRecordPath
    ?? projectionInput.runtimeRecordRelativePath
    ?? null;
  if (!runtimeRecordPath) {
    return {
      ok: false,
      reason: "missing_runtime_record_path",
      caseId: input.caseId,
    };
  }

  const eventLog = readDirectiveCaseMirrorEvents(input);
  const latestEvent = sortDirectiveProjectionEvents(eventLog.events).at(-1) ?? null;

  return {
    ok: true,
    caseId: mirrored.record.caseId,
    queueStatus: latestEvent?.queueStatus ?? mirrored.record.queueStatus,
    routeTarget: latestEvent?.routeTarget ?? mirrored.record.routeTarget,
    operatingMode: latestEvent?.operatingMode ?? mirrored.record.operatingMode,
    latestEventType: latestEvent?.eventType ?? null,
    paths: {
      followUpPath:
        mirrored.record.linkedArtifacts.runtimeFollowUpPath
        ?? projectionInput.followUpRelativePath,
      runtimeRecordPath,
      runtimeProofPath: projectionInput.runtimeProofRelativePath,
    },
    compatibility: {
      followUpPath:
        mirrored.record.linkedArtifacts.runtimeFollowUpPath
        ?? projectionInput.followUpRelativePath,
      routingPath: mirrored.record.linkedArtifacts.routingRecordPath ?? null,
    },
    markdown: {
      runtimeRecord: renderDirectiveRuntimeFollowUpOpenProjection({
        projectionInput,
      }),
    },
  };
}

export function writeDirectiveRuntimeFollowUpOpenProjectionSet(input: {
  directiveRoot: string;
  caseId: string;
}) {
  const projectionSet = materializeDirectiveRuntimeFollowUpOpenProjectionSet(input);
  if (!projectionSet.ok) {
    return projectionSet;
  }

  writeDirectiveProjectionUtf8(
    path.resolve(input.directiveRoot, projectionSet.paths.runtimeRecordPath),
    projectionSet.markdown.runtimeRecord,
  );

  return projectionSet;
}

