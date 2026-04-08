import path from "node:path";

import { readDirectiveCaseMirrorEvents } from "../../engine/cases/case-event-log.ts";
import { readDirectiveMirroredDiscoveryCaseRecord } from "../../engine/cases/case-store.ts";
import {
  renderDirectiveProjectionListOrPlaceholder,
  sortDirectiveProjectionEvents,
  writeDirectiveProjectionUtf8,
} from "./runtime-projection-shared.ts";

export type DirectiveMirroredRuntimeProofOpenProjectionInput = {
  snapshotAt: string;
  approvedBy: string;
  runtimeRecordDate: string;
  candidateId: string;
  candidateName: string;
  runtimeRecordRelativePath: string;
  runtimeProofRelativePath: string;
  linkedFollowUpRecord: string;
  runtimeObjective: string;
  proposedHost: string;
  proposedRuntimeSurface: string;
  requiredProof: string[];
  requiredGates: string[];
  excludedBaggage: string[];
  rollback: string;
  noOpPath: string;
  reviewCadence: string;
  linkedHandoffPath: string | null;
  sourceRecordStatus: string;
  nextDecisionPoint: string;
};

export type DirectiveRuntimeProofOpenProjectionSet =
  | {
      ok: false;
      reason:
        | "missing_case_record"
        | "missing_projection_input"
        | "missing_runtime_proof_path";
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
        runtimeRecordPath: string | null;
        runtimeProofPath: string;
      };
      compatibility: {
        runtimeRecordPath: string | null;
        followUpPath: string | null;
      };
      markdown: {
        runtimeProof: string;
      };
    };

function renderDirectiveRuntimeProofOpenProjection(input: {
  projectionInput: DirectiveMirroredRuntimeProofOpenProjectionInput;
}) {
  return `# Legacy Runtime Proof Artifact: ${input.projectionInput.candidateName} (${input.projectionInput.runtimeRecordDate})

## runtime record identity
- Candidate id: \`${input.projectionInput.candidateId}\`
- Candidate name: \`${input.projectionInput.candidateName}\`
- Legacy Runtime record path: \`${input.projectionInput.runtimeRecordRelativePath}\`
- Source follow-up record path: \`${input.projectionInput.linkedFollowUpRecord}\`
- Proof opening decision: \`approved_for_bounded_proof_artifact\`
- Opened by: \`${input.projectionInput.approvedBy}\`
- Opened on: \`${input.projectionInput.runtimeRecordDate}\`
- Current status: \`proof_scope_opened\`

## source inputs required
- Legacy Runtime record: \`${input.projectionInput.runtimeRecordRelativePath}\`
- Source Runtime follow-up record: \`${input.projectionInput.linkedFollowUpRecord}\`
${input.projectionInput.linkedHandoffPath ? `- Linked Discovery routing record: \`${input.projectionInput.linkedHandoffPath}\`\n` : ""}- Runtime objective: ${input.projectionInput.runtimeObjective}
- Proposed host: \`${input.projectionInput.proposedHost}\`
- Proposed runtime surface: ${input.projectionInput.proposedRuntimeSurface}

## what must be proven before bounded runtime conversion
${renderDirectiveProjectionListOrPlaceholder(input.projectionInput.requiredProof)}

## expected outputs
- One bounded Runtime proof artifact that keeps the runtime-usefulness conversion scope inspectable and non-executing.
- One explicit proof boundary that preserves the approved Runtime record objective, required gates, and rollback boundary.
- No runtime execution, no host integration, no callable implementation, and no promotion record creation from this step.

## validation method
- Artifact inspection only.
- Confirm the Legacy Runtime record and source follow-up record describe the same bounded runtime objective and reversible boundary.
- Confirm the required proof items and gates remain explicit and do not require hidden runtime context.
- Reject proof readiness if host integration, execution, or orchestration would need to be inferred from outside the existing Runtime artifacts.

## minimal success criteria
- The runtime objective is explicit and remains bounded to reusable runtime usefulness conversion.
- Required proof items are explicit and reviewable.
- Required gates are explicit and bounded:
${renderDirectiveProjectionListOrPlaceholder(input.projectionInput.requiredGates.map((value) => `\`${value}\``))}
- Rollback remains explicit and returns cleanly to the Legacy Runtime record and follow-up record.
- Excluded baggage remains outside the proof boundary:
${renderDirectiveProjectionListOrPlaceholder(input.projectionInput.excludedBaggage)}

## proof opening boundary
- Source record status: \`${input.projectionInput.sourceRecordStatus}\`
- Next decision point from Legacy Runtime record: ${input.projectionInput.nextDecisionPoint}
- This artifact opens bounded proof review only. It does not authorize execution, host integration, or promotion.

## rollback boundary
- Rollback: ${input.projectionInput.rollback}
- No-op path: ${input.projectionInput.noOpPath}
- Review cadence: ${input.projectionInput.reviewCadence}

## artifact linkage
- Runtime proof artifact: \`${input.projectionInput.runtimeProofRelativePath}\`
- Legacy Runtime record: \`${input.projectionInput.runtimeRecordRelativePath}\`
- Source Runtime follow-up record: \`${input.projectionInput.linkedFollowUpRecord}\`
${input.projectionInput.linkedHandoffPath ? `- Linked Discovery routing record: \`${input.projectionInput.linkedHandoffPath}\`\n` : ""}`;
}

export function materializeDirectiveRuntimeProofOpenProjectionSet(input: {
  directiveRoot: string;
  caseId: string;
}): DirectiveRuntimeProofOpenProjectionSet {
  const mirrored = readDirectiveMirroredDiscoveryCaseRecord(input);
  if (!mirrored.record) {
    return {
      ok: false,
      reason: "missing_case_record",
      caseId: input.caseId,
    };
  }

  const projectionInput =
    mirrored.record.projectionInputs?.runtimeProofOpen ?? null;
  if (!projectionInput) {
    return {
      ok: false,
      reason: "missing_projection_input",
      caseId: input.caseId,
    };
  }

  const runtimeProofPath =
    mirrored.record.linkedArtifacts.runtimeProofPath
    ?? projectionInput.runtimeProofRelativePath
    ?? null;
  if (!runtimeProofPath) {
    return {
      ok: false,
      reason: "missing_runtime_proof_path",
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
      runtimeRecordPath:
        mirrored.record.linkedArtifacts.runtimeRecordPath
        ?? projectionInput.runtimeRecordRelativePath,
      runtimeProofPath,
    },
    compatibility: {
      runtimeRecordPath:
        mirrored.record.linkedArtifacts.runtimeRecordPath
        ?? projectionInput.runtimeRecordRelativePath,
      followUpPath: mirrored.record.linkedArtifacts.runtimeFollowUpPath ?? null,
    },
    markdown: {
      runtimeProof: renderDirectiveRuntimeProofOpenProjection({
        projectionInput,
      }),
    },
  };
}

export function writeDirectiveRuntimeProofOpenProjectionSet(input: {
  directiveRoot: string;
  caseId: string;
}) {
  const projectionSet = materializeDirectiveRuntimeProofOpenProjectionSet(input);
  if (!projectionSet.ok) {
    return projectionSet;
  }

  writeDirectiveProjectionUtf8(
    path.resolve(input.directiveRoot, projectionSet.paths.runtimeProofPath),
    projectionSet.markdown.runtimeProof,
  );

  return projectionSet;
}

