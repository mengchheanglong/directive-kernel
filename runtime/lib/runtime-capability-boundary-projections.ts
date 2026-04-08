import path from "node:path";

import { readDirectiveCaseMirrorEvents } from "../../engine/cases/case-event-log.ts";
import { readDirectiveMirroredDiscoveryCaseRecord } from "../../engine/cases/case-store.ts";
import {
  renderDirectiveProjectionListOrPlaceholder,
  sortDirectiveProjectionEvents,
  writeDirectiveProjectionUtf8,
} from "./runtime-projection-shared.ts";

export type DirectiveMirroredRuntimeCapabilityBoundaryOpenProjectionInput = {
  snapshotAt: string;
  approvedBy: string;
  boundaryDate: string;
  candidateId: string;
  candidateName: string;
  runtimeProofRelativePath: string;
  runtimeRecordRelativePath: string;
  linkedFollowUpRecord: string;
  linkedRoutingPath: string | null;
  runtimeCapabilityBoundaryRelativePath: string;
  runtimeObjective: string;
  proposedHost: string;
  proposedRuntimeSurface: string;
  currentProofStatus: string;
  requiredProofItems: string[];
  requiredGates: string[];
  rollback: string;
  noOpPath: string;
  reviewCadence: string;
};

export type DirectiveRuntimeCapabilityBoundaryProjectionSet =
  | {
      ok: false;
      reason:
        | "missing_case_record"
        | "missing_projection_input"
        | "missing_runtime_capability_boundary_path";
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
        runtimeCapabilityBoundaryPath: string;
        runtimeProofPath: string | null;
      };
      compatibility: {
        runtimeProofPath: string | null;
        runtimeRecordPath: string | null;
        followUpPath: string | null;
      };
      markdown: {
        runtimeCapabilityBoundary: string;
      };
    };

function renderDirectiveRuntimeCapabilityBoundaryProjection(input: {
  projectionInput: DirectiveMirroredRuntimeCapabilityBoundaryOpenProjectionInput;
}) {
  return `# Legacy Runtime Runtime Capability Boundary: ${input.projectionInput.candidateName} (${input.projectionInput.boundaryDate})

## bounded runtime usefulness being converted
- Convert the approved Runtime proof scope into one bounded runtime capability boundary for Directive Workspace runtime-usefulness conversion.
- Keep the boundary constrained to the approved runtime objective and proposed runtime surface only.
- Do not widen into runtime execution, host integration, callable implementation, orchestration, or promotion.

## reusable capability shape
- Candidate id: \`${input.projectionInput.candidateId}\`
- Candidate name: \`${input.projectionInput.candidateName}\`
- Capability form: bounded runtime capability boundary
- Runtime objective: ${input.projectionInput.runtimeObjective}
- Proposed host: \`${input.projectionInput.proposedHost}\`
- Proposed runtime surface: ${input.projectionInput.proposedRuntimeSurface}
- Execution state: not executing, not host-integrated, not implemented, not promoted

## source inputs
- Runtime proof artifact: \`${input.projectionInput.runtimeProofRelativePath}\`
- Legacy Runtime record: \`${input.projectionInput.runtimeRecordRelativePath}\`
- Source Runtime follow-up record: \`${input.projectionInput.linkedFollowUpRecord}\`
${input.projectionInput.linkedRoutingPath ? `- Linked Discovery routing record: \`${input.projectionInput.linkedRoutingPath}\`\n` : ""}- Runtime objective: ${input.projectionInput.runtimeObjective}
- Proposed host: \`${input.projectionInput.proposedHost}\`
- Proposed runtime surface: ${input.projectionInput.proposedRuntimeSurface}

## capability boundary
- Preserve the approved runtime objective only.
- Preserve the bounded proof items:
${renderDirectiveProjectionListOrPlaceholder(input.projectionInput.requiredProofItems)}
- Preserve the required gates:
${renderDirectiveProjectionListOrPlaceholder(input.projectionInput.requiredGates.map((value) => `\`${value}\``))}
- Do not add runtime triggers, host adapters, scheduling, background work, or callable implementation.
- Do not claim promotion readiness, runtime execution, or host integration from this artifact.

## proof and promotion boundary
- Current Runtime proof status: \`${input.projectionInput.currentProofStatus}\`
- Boundary opening decision: \`approved_for_bounded_runtime_capability_boundary\`
- Opened by: \`${input.projectionInput.approvedBy}\`
- Opened on: \`${input.projectionInput.boundaryDate}\`
- Host-facing promotion remains out of scope and unopened.

## rollback boundary
- Rollback: ${input.projectionInput.rollback}
- No-op path: ${input.projectionInput.noOpPath}
- Review cadence: ${input.projectionInput.reviewCadence}

## artifact linkage
- Runtime capability boundary: \`${input.projectionInput.runtimeCapabilityBoundaryRelativePath}\`
- Proof artifact: \`${input.projectionInput.runtimeProofRelativePath}\`
- Runtime record: \`${input.projectionInput.runtimeRecordRelativePath}\`
- Source Runtime follow-up record: \`${input.projectionInput.linkedFollowUpRecord}\`
${input.projectionInput.linkedRoutingPath ? `- Linked Discovery routing record: \`${input.projectionInput.linkedRoutingPath}\`\n` : ""}`;
}

export function materializeDirectiveRuntimeCapabilityBoundaryProjectionSet(input: {
  directiveRoot: string;
  caseId: string;
}): DirectiveRuntimeCapabilityBoundaryProjectionSet {
  const mirrored = readDirectiveMirroredDiscoveryCaseRecord(input);
  if (!mirrored.record) {
    return {
      ok: false,
      reason: "missing_case_record",
      caseId: input.caseId,
    };
  }

  const projectionInput =
    mirrored.record.projectionInputs?.runtimeCapabilityBoundaryOpen ?? null;
  if (!projectionInput) {
    return {
      ok: false,
      reason: "missing_projection_input",
      caseId: input.caseId,
    };
  }

  const runtimeCapabilityBoundaryPath =
    mirrored.record.linkedArtifacts.runtimeCapabilityBoundaryPath
    ?? projectionInput.runtimeCapabilityBoundaryRelativePath
    ?? null;
  if (!runtimeCapabilityBoundaryPath) {
    return {
      ok: false,
      reason: "missing_runtime_capability_boundary_path",
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
      runtimeCapabilityBoundaryPath,
      runtimeProofPath:
        mirrored.record.linkedArtifacts.runtimeProofPath
        ?? projectionInput.runtimeProofRelativePath,
    },
    compatibility: {
      runtimeProofPath:
        mirrored.record.linkedArtifacts.runtimeProofPath
        ?? projectionInput.runtimeProofRelativePath,
      runtimeRecordPath:
        mirrored.record.linkedArtifacts.runtimeRecordPath
        ?? projectionInput.runtimeRecordRelativePath,
      followUpPath: mirrored.record.linkedArtifacts.runtimeFollowUpPath ?? null,
    },
    markdown: {
      runtimeCapabilityBoundary: renderDirectiveRuntimeCapabilityBoundaryProjection({
        projectionInput,
      }),
    },
  };
}

export function writeDirectiveRuntimeCapabilityBoundaryProjectionSet(input: {
  directiveRoot: string;
  caseId: string;
}) {
  const projectionSet = materializeDirectiveRuntimeCapabilityBoundaryProjectionSet(input);
  if (!projectionSet.ok) {
    return projectionSet;
  }

  writeDirectiveProjectionUtf8(
    path.resolve(input.directiveRoot, projectionSet.paths.runtimeCapabilityBoundaryPath),
    projectionSet.markdown.runtimeCapabilityBoundary,
  );

  return projectionSet;
}

