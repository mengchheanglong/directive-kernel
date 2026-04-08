import path from "node:path";

import { readDirectiveCaseMirrorEvents } from "../../engine/cases/case-event-log.ts";
import { readDirectiveMirroredDiscoveryCaseRecord } from "../../engine/cases/case-store.ts";
import {
  renderDirectiveProjectionListOrPlaceholder,
  sortDirectiveProjectionEvents,
  writeDirectiveProjectionUtf8,
} from "./runtime-projection-shared.ts";

export type DirectiveMirroredRuntimePromotionReadinessOpenProjectionInput = {
  snapshotAt: string;
  approvedBy: string;
  boundaryDate: string;
  candidateId: string;
  candidateName: string;
  capabilityBoundaryRelativePath: string;
  linkedRuntimeProofPath: string;
  linkedRuntimeRecordPath: string;
  linkedFollowUpPath: string;
  linkedRoutingPath: string | null;
  linkedCallableStubPath: string | null;
  promotionReadinessRelativePath: string;
  runtimeObjective: string;
  proposedHost: string;
  proposedRuntimeSurface: string;
  requiredProofItems: string[];
  requiredGates: string[];
  rollback: string;
  noOpPath: string;
  reviewCadence: string;
  templateMarkdown?: string | null;
};

export type DirectiveRuntimePromotionReadinessProjectionSet =
  | {
      ok: false;
      reason:
        | "missing_case_record"
        | "missing_projection_input"
        | "missing_runtime_promotion_readiness_path";
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
        promotionReadinessPath: string;
        capabilityBoundaryPath: string | null;
      };
      compatibility: {
        capabilityBoundaryPath: string | null;
        runtimeProofPath: string | null;
        runtimeRecordPath: string | null;
        followUpPath: string | null;
      };
      markdown: {
        promotionReadiness: string;
      };
    };

function renderDirectiveRuntimePromotionReadinessProjection(input: {
  projectionInput: DirectiveMirroredRuntimePromotionReadinessOpenProjectionInput;
}) {
  if (
    typeof input.projectionInput.templateMarkdown === "string"
    && input.projectionInput.templateMarkdown.trim().length > 0
  ) {
    return input.projectionInput.templateMarkdown;
  }

  return `# Runtime Promotion-Readiness Artifact: ${input.projectionInput.candidateName} (${input.projectionInput.boundaryDate})

## runtime capability boundary identity
- Candidate id: \`${input.projectionInput.candidateId}\`
- Candidate name: \`${input.projectionInput.candidateName}\`
- Runtime capability boundary path: \`${input.projectionInput.capabilityBoundaryRelativePath}\`
- Source Runtime proof artifact: \`${input.projectionInput.linkedRuntimeProofPath}\`
- Source Legacy Runtime record: \`${input.projectionInput.linkedRuntimeRecordPath}\`
- Source Runtime follow-up record: \`${input.projectionInput.linkedFollowUpPath}\`
${input.projectionInput.linkedRoutingPath ? `- Linked Discovery routing record: \`${input.projectionInput.linkedRoutingPath}\`\n` : ""}- Promotion-readiness decision: \`approved_for_non_executing_promotion_readiness\`
- Opened by: \`${input.projectionInput.approvedBy}\`
- Opened on: \`${input.projectionInput.boundaryDate}\`
- Current status: \`promotion_readiness_opened\`

## bounded runtime usefulness preserved
- Runtime objective: ${input.projectionInput.runtimeObjective}
- Proposed host: \`${input.projectionInput.proposedHost}\`
- Proposed runtime surface: ${input.projectionInput.proposedRuntimeSurface}
- Capability form: non-executing promotion-readiness artifact
- Execution state: not executing, not host-integrated, not implemented, not promoted

## what is now explicit
- The bounded runtime capability boundary has been explicitly reviewed as a possible future promotion candidate.
- Required proof items remain explicit:
${renderDirectiveProjectionListOrPlaceholder(input.projectionInput.requiredProofItems)}
- Required gates remain explicit:
${renderDirectiveProjectionListOrPlaceholder(input.projectionInput.requiredGates.map((value) => `\`${value}\``))}
- This artifact does not approve host-facing promotion, runtime execution, callable implementation, or host integration.

## validation boundary
- Validate against the bounded runtime capability boundary, Runtime proof artifact, Legacy Runtime record, source follow-up record, and linked Discovery routing record only.
- Do not infer runtime readiness, host readiness, or automatic promotion from this artifact.
- A separate host-facing promotion record remains unopened and out of scope.

## rollback boundary
- Rollback: ${input.projectionInput.rollback}
- No-op path: ${input.projectionInput.noOpPath}
- Review cadence: ${input.projectionInput.reviewCadence}

## artifact linkage
- Promotion-readiness artifact: \`${input.projectionInput.promotionReadinessRelativePath}\`
- Runtime capability boundary: \`${input.projectionInput.capabilityBoundaryRelativePath}\`
- Runtime proof artifact: \`${input.projectionInput.linkedRuntimeProofPath}\`
- Legacy Runtime record: \`${input.projectionInput.linkedRuntimeRecordPath}\`
- Source Runtime follow-up record: \`${input.projectionInput.linkedFollowUpPath}\`
${input.projectionInput.linkedRoutingPath ? `- Linked Discovery routing record: \`${input.projectionInput.linkedRoutingPath}\`\n` : ""}${input.projectionInput.linkedCallableStubPath ? `- Linked callable stub: \`${input.projectionInput.linkedCallableStubPath}\`\n` : ""}`;
}

export function materializeDirectiveRuntimePromotionReadinessProjectionSet(input: {
  directiveRoot: string;
  caseId: string;
}): DirectiveRuntimePromotionReadinessProjectionSet {
  const mirrored = readDirectiveMirroredDiscoveryCaseRecord(input);
  if (!mirrored.record) {
    return {
      ok: false,
      reason: "missing_case_record",
      caseId: input.caseId,
    };
  }

  const projectionInput =
    mirrored.record.projectionInputs?.runtimePromotionReadinessOpen ?? null;
  if (!projectionInput) {
    return {
      ok: false,
      reason: "missing_projection_input",
      caseId: input.caseId,
    };
  }

  const promotionReadinessPath =
    mirrored.record.linkedArtifacts.runtimePromotionReadinessPath
    ?? projectionInput.promotionReadinessRelativePath
    ?? null;
  if (!promotionReadinessPath) {
    return {
      ok: false,
      reason: "missing_runtime_promotion_readiness_path",
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
      promotionReadinessPath,
      capabilityBoundaryPath:
        mirrored.record.linkedArtifacts.runtimeCapabilityBoundaryPath
        ?? projectionInput.capabilityBoundaryRelativePath,
    },
    compatibility: {
      capabilityBoundaryPath:
        mirrored.record.linkedArtifacts.runtimeCapabilityBoundaryPath
        ?? projectionInput.capabilityBoundaryRelativePath,
      runtimeProofPath:
        mirrored.record.linkedArtifacts.runtimeProofPath
        ?? projectionInput.linkedRuntimeProofPath,
      runtimeRecordPath:
        mirrored.record.linkedArtifacts.runtimeRecordPath
        ?? projectionInput.linkedRuntimeRecordPath,
      followUpPath:
        mirrored.record.linkedArtifacts.runtimeFollowUpPath
        ?? projectionInput.linkedFollowUpPath,
    },
    markdown: {
      promotionReadiness: renderDirectiveRuntimePromotionReadinessProjection({
        projectionInput,
      }),
    },
  };
}

export function writeDirectiveRuntimePromotionReadinessProjectionSet(input: {
  directiveRoot: string;
  caseId: string;
}) {
  const projectionSet = materializeDirectiveRuntimePromotionReadinessProjectionSet(input);
  if (!projectionSet.ok) {
    return projectionSet;
  }

  writeDirectiveProjectionUtf8(
    path.resolve(input.directiveRoot, projectionSet.paths.promotionReadinessPath),
    projectionSet.markdown.promotionReadiness,
  );

  return projectionSet;
}

