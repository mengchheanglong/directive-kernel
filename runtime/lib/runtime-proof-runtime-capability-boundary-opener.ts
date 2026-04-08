import fs from "node:fs";
import path from "node:path";

import {
  normalizeDirectiveApprovalActor,
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveCurrentStageForOpening,
  requireDirectiveEligibleStatus,
  requireDirectiveExplicitApproval,
  resolveDirectiveWorkspaceRelativePath,
} from "../../engine/approval-boundary.ts";
import { appendDirectiveCaseMirrorEvents, readDirectiveCaseMirrorEvents } from "../../engine/cases/case-event-log.ts";
import {
  mirrorDirectiveRuntimeCapabilityBoundaryOpen,
  readDirectiveMirroredDiscoveryCaseRecord,
  writeDirectiveMirroredDiscoveryCaseRecord,
} from "../../engine/cases/case-store.ts";
import { resolveDirectiveWorkspaceState } from "../../engine/state/index.ts";
import {
  readDirectiveRuntimeRecordArtifact,
  type DirectiveRuntimeRecordArtifact,
} from "./runtime-record-proof-opener.ts";
import type { DiscoveryIntakeQueueEntry } from "../../discovery/lib/discovery-intake-queue-writer.ts";
import {
  writeDirectiveRuntimeCapabilityBoundaryProjectionSet,
  type DirectiveMirroredRuntimeCapabilityBoundaryOpenProjectionInput,
} from "./runtime-capability-boundary-projections.ts";
import {
  extractRuntimeOpenerMarkdownTitle as extractMarkdownTitle,
  extractRuntimeOpenerRequiredBulletValue as extractBulletValue,
  normalizeRuntimeOpenerRelativePath as normalizeRelativePath,
  readDirectiveRuntimeRoutingBackfillCompat,
  readRuntimeOpenerJson as readJson,
  readRuntimeOpenerUtf8 as readUtf8,
} from "./runtime-opener-shared.ts";

function buildRuntimeCapabilityBoundaryRelativePath(input: {
  proofDate: string;
  candidateId: string;
}) {
  return normalizeRelativePath(
    path.join(
      "runtime",
      "04-capability-boundaries",
      `${input.proofDate}-${input.candidateId}-runtime-capability-boundary.md`,
    ),
  );
}

function renderListOrPlaceholder(values: string[], placeholder = "  - n/a") {
  if (values.length === 0) {
    return placeholder;
  }
  return values.map((value) => `  - ${value}`).join("\n");
}

export type DirectiveRuntimeProofArtifact = {
  title: string;
  candidateId: string;
  candidateName: string;
  proofDate: string;
  currentStatus: string;
  runtimeObjective: string;
  proposedHost: string;
  proposedRuntimeSurface: string;
  linkedRuntimeRecordPath: string;
  linkedFollowUpPath: string;
  linkedRoutingPath: string | null;
  rollback: string;
  noOpPath: string;
  reviewCadence: string;
  requiredProofItems: string[];
  requiredGates: string[];
  runtimeProofRelativePath: string;
  runtimeProofAbsolutePath: string;
  runtimeCapabilityBoundaryRelativePath: string;
  runtimeCapabilityBoundaryAbsolutePath: string;
  runtimeCapabilityBoundaryExists: boolean;
  approvalAllowed: boolean;
  content: string;
  runtimeRecordArtifact: DirectiveRuntimeRecordArtifact;
};

export type DirectiveRuntimeProofRuntimeCapabilityBoundaryOpenResult = {
  ok: true;
  created: boolean;
  directiveRoot: string;
  runtimeProofRelativePath: string;
  runtimeCapabilityBoundaryRelativePath: string;
  runtimeCapabilityBoundaryAbsolutePath: string;
  candidateId: string;
  candidateName: string;
};

function buildRuntimeCapabilityBoundaryOpenProjectionInput(input: {
  artifact: DirectiveRuntimeProofArtifact;
  approvedBy: string;
  snapshotAt: string;
}): DirectiveMirroredRuntimeCapabilityBoundaryOpenProjectionInput {
  return {
    snapshotAt: input.snapshotAt,
    approvedBy: input.approvedBy,
    boundaryDate: input.artifact.proofDate,
    candidateId: input.artifact.candidateId,
    candidateName: input.artifact.candidateName,
    runtimeProofRelativePath: input.artifact.runtimeProofRelativePath,
    runtimeRecordRelativePath: input.artifact.linkedRuntimeRecordPath,
    linkedFollowUpRecord: input.artifact.linkedFollowUpPath,
    linkedRoutingPath: input.artifact.linkedRoutingPath,
    runtimeCapabilityBoundaryRelativePath: input.artifact.runtimeCapabilityBoundaryRelativePath,
    runtimeObjective: input.artifact.runtimeObjective,
    proposedHost: input.artifact.proposedHost,
    proposedRuntimeSurface: input.artifact.proposedRuntimeSurface,
    currentProofStatus: input.artifact.currentStatus,
    requiredProofItems: input.artifact.requiredProofItems,
    requiredGates: input.artifact.requiredGates,
    rollback: input.artifact.rollback,
    noOpPath: input.artifact.noOpPath,
    reviewCadence: input.artifact.reviewCadence,
  };
}

function renderRuntimeCapabilityBoundaryArtifact(input: {
  artifact: DirectiveRuntimeProofArtifact;
  approvedBy: string;
}) {
  const record = input.artifact.runtimeRecordArtifact;
  const followUp = record.followUpArtifact;

  return `# Legacy Runtime Runtime Capability Boundary: ${input.artifact.candidateName} (${input.artifact.proofDate})

## bounded runtime usefulness being converted
- Convert the approved Runtime proof scope into one bounded runtime capability boundary for Directive Workspace runtime-usefulness conversion.
- Keep the boundary constrained to the approved runtime objective and proposed runtime surface only.
- Do not widen into runtime execution, host integration, callable implementation, orchestration, or promotion.

## reusable capability shape
- Candidate id: \`${input.artifact.candidateId}\`
- Candidate name: \`${input.artifact.candidateName}\`
- Capability form: bounded runtime capability boundary
- Runtime objective: ${input.artifact.runtimeObjective}
- Proposed host: \`${input.artifact.proposedHost}\`
- Proposed runtime surface: ${input.artifact.proposedRuntimeSurface}
- Execution state: not executing, not host-integrated, not implemented, not promoted

## source inputs
- Runtime proof artifact: \`${input.artifact.runtimeProofRelativePath}\`
- Legacy Runtime record: \`${input.artifact.linkedRuntimeRecordPath}\`
- Source Runtime follow-up record: \`${input.artifact.linkedFollowUpPath}\`
${input.artifact.linkedRoutingPath ? `- Linked Discovery routing record: \`${input.artifact.linkedRoutingPath}\`\n` : ""}- Runtime objective: ${input.artifact.runtimeObjective}
- Proposed host: \`${input.artifact.proposedHost}\`
- Proposed runtime surface: ${input.artifact.proposedRuntimeSurface}

## capability boundary
- Preserve the approved runtime objective only.
- Preserve the bounded proof items:
${renderListOrPlaceholder(input.artifact.requiredProofItems)}
- Preserve the required gates:
${renderListOrPlaceholder(input.artifact.requiredGates.map((value) => `\`${value}\``))}
- Do not add runtime triggers, host adapters, scheduling, background work, or callable implementation.
- Do not claim promotion readiness, runtime execution, or host integration from this artifact.

## proof and promotion boundary
- Current Runtime proof status: \`${input.artifact.currentStatus}\`
- Boundary opening decision: \`approved_for_bounded_runtime_capability_boundary\`
- Opened by: \`${input.approvedBy}\`
- Opened on: \`${input.artifact.proofDate}\`
- Host-facing promotion remains out of scope and unopened.

## rollback boundary
- Rollback: ${input.artifact.rollback}
- No-op path: ${input.artifact.noOpPath}
- Review cadence: ${input.artifact.reviewCadence}

## artifact linkage
- Runtime capability boundary: \`${input.artifact.runtimeCapabilityBoundaryRelativePath}\`
- Proof artifact: \`${input.artifact.runtimeProofRelativePath}\`
- Runtime record: \`${input.artifact.linkedRuntimeRecordPath}\`
- Source Runtime follow-up record: \`${input.artifact.linkedFollowUpPath}\`
${input.artifact.linkedRoutingPath ? `- Linked Discovery routing record: \`${input.artifact.linkedRoutingPath}\`\n` : ""}`;
}

function extractLegacyRuntimeRecordPathFromProof(content: string) {
  try {
    return extractBulletValue(content, "Legacy Runtime record path", 'invalid_input: missing "Legacy Runtime record path" in Runtime proof artifact');
  } catch {
    return extractBulletValue(content, "Runtime v0 record path", 'invalid_input: missing "Runtime v0 record path" in Runtime proof artifact');
  }
}

export function readDirectiveRuntimeProofArtifact(input: {
  runtimeProofPath: string;
  directiveRoot?: string;
}): DirectiveRuntimeProofArtifact {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const runtimeProofRelativePath = resolveDirectiveWorkspaceRelativePath(
    directiveRoot,
    input.runtimeProofPath,
    "runtimeProofPath",
  );

  if (
    !runtimeProofRelativePath.startsWith("runtime/03-proof/")
    || !runtimeProofRelativePath.endsWith("-proof.md")
  ) {
    throw new Error("invalid_input: runtimeProofPath must point to runtime/03-proof/*-proof.md");
  }

  const runtimeProofAbsolutePath = path.resolve(directiveRoot, runtimeProofRelativePath).replace(/\\/g, "/");
  if (!fs.existsSync(runtimeProofAbsolutePath)) {
    throw new Error(`invalid_input: runtimeProofPath not found: ${runtimeProofRelativePath}`);
  }

  const content = readUtf8(runtimeProofAbsolutePath);
  if (!content.includes("## runtime record identity")) {
    throw new Error("invalid_input: runtimeProofPath must point to a follow-up review Runtime proof artifact");
  }

  const candidateId = extractBulletValue(content, "Candidate id");
  const proofDate = extractBulletValue(content, "Opened on");
  const linkedRuntimeRecordPath = extractLegacyRuntimeRecordPathFromProof(content);
  const runtimeRecordArtifact = readDirectiveRuntimeRecordArtifact({
    directiveRoot,
    runtimeRecordPath: linkedRuntimeRecordPath,
  });
  const runtimeCapabilityBoundaryRelativePath = buildRuntimeCapabilityBoundaryRelativePath({
    proofDate,
    candidateId,
  });
  const runtimeCapabilityBoundaryAbsolutePath = path
    .resolve(directiveRoot, runtimeCapabilityBoundaryRelativePath)
    .replace(/\\/g, "/");
  const currentStatus = extractBulletValue(content, "Current status");

  return {
    title: extractMarkdownTitle(content, "runtime proof title"),
    candidateId,
    candidateName: extractBulletValue(content, "Candidate name", 'invalid_input: missing "Candidate name" in Runtime proof artifact'),
    proofDate,
    currentStatus,
    runtimeObjective: extractBulletValue(content, "Runtime objective", 'invalid_input: missing "Runtime objective" in Runtime proof artifact'),
    proposedHost: extractBulletValue(content, "Proposed host", 'invalid_input: missing "Proposed host" in Runtime proof artifact'),
    proposedRuntimeSurface: extractBulletValue(content, "Proposed runtime surface", 'invalid_input: missing "Proposed runtime surface" in Runtime proof artifact'),
    linkedRuntimeRecordPath,
    linkedFollowUpPath: extractBulletValue(content, "Source follow-up record path", 'invalid_input: missing "Source follow-up record path" in Runtime proof artifact'),
    linkedRoutingPath: content.includes("Linked Discovery routing record")
      ? extractBulletValue(content, "Linked Discovery routing record", 'invalid_input: missing "Linked Discovery routing record" in Runtime proof artifact')
      : null,
    rollback: extractBulletValue(content, "Rollback", 'invalid_input: missing "Rollback" in Runtime proof artifact'),
    noOpPath: extractBulletValue(content, "No-op path", 'invalid_input: missing "No-op path" in Runtime proof artifact'),
    reviewCadence: extractBulletValue(content, "Review cadence", 'invalid_input: missing "Review cadence" in Runtime proof artifact'),
    requiredProofItems: [...runtimeRecordArtifact.followUpArtifact.requiredProof],
    requiredGates: [...runtimeRecordArtifact.requiredGates],
    runtimeProofRelativePath,
    runtimeProofAbsolutePath,
    runtimeCapabilityBoundaryRelativePath,
    runtimeCapabilityBoundaryAbsolutePath,
    runtimeCapabilityBoundaryExists: fs.existsSync(runtimeCapabilityBoundaryAbsolutePath),
    approvalAllowed: currentStatus === "proof_scope_opened",
    content,
    runtimeRecordArtifact,
  };
}

export function openDirectiveRuntimeProofRuntimeCapabilityBoundary(input: {
  runtimeProofPath: string;
  approved?: boolean;
  approvedBy?: string | null;
  directiveRoot?: string;
}): DirectiveRuntimeProofRuntimeCapabilityBoundaryOpenResult {
  requireDirectiveExplicitApproval({
    approved: input.approved,
    action: "open a Runtime runtime capability boundary",
  });

  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const artifact = readDirectiveRuntimeProofArtifact({
    directiveRoot,
    runtimeProofPath: input.runtimeProofPath,
  });

  requireDirectiveCurrentStageForOpening({
    directiveRoot,
    artifactPath: artifact.runtimeProofRelativePath,
    subject: "Runtime proof artifact",
    allowedCurrentStages: ["runtime.proof."],
  });
  requireDirectiveEligibleStatus({
    subject: "Runtime proof artifact",
    currentStatus: artifact.currentStatus,
    allowedStatuses: ["proof_scope_opened"],
    action: "open a runtime capability boundary",
  });

  const approvedBy = normalizeDirectiveApprovalActor(input.approvedBy);
  const snapshotAt = new Date().toISOString();
  const created = !artifact.runtimeCapabilityBoundaryExists;

  const mirrored = readDirectiveMirroredDiscoveryCaseRecord({
    directiveRoot,
    caseId: artifact.candidateId,
  });
  if (!mirrored.record) {
    const queuePath = path.join(directiveRoot, "discovery", "intake-queue.json");
    const queueDocument = fs.existsSync(queuePath)
      ? readJson<{ entries: DiscoveryIntakeQueueEntry[] }>(queuePath)
      : null;
    const queueEntry =
      queueDocument?.entries.find((entry) => entry.candidate_id === artifact.candidateId)
      ?? null;
    const routingPath =
      queueEntry?.routing_record_path
      ?? artifact.linkedRoutingPath
      ?? null;
    if (!routingPath) {
      throw new Error(
        `invalid_state: unable to backfill mirrored Runtime capability-boundary case for ${artifact.candidateId} without a routing record`,
      );
    }
    const routing = readDirectiveRuntimeRoutingBackfillCompat({
      directiveRoot,
      routingPath,
      extractRequiredBulletValue: (markdown, label) =>
        extractBulletValue(markdown, label, `invalid_input: missing "${label}" in Runtime proof artifact`),
    });
    writeDirectiveMirroredDiscoveryCaseRecord({
      directiveRoot,
      record: {
        schemaVersion: 1,
        mirrorKind: "discovery_front_door_submission",
        caseId: artifact.candidateId,
        candidateId: artifact.candidateId,
        candidateName: artifact.candidateName,
        sourceType: queueEntry?.source_type ?? routing.sourceType,
        sourceReference: queueEntry?.source_reference ?? artifact.linkedFollowUpPath,
        decisionState: artifact.runtimeRecordArtifact.followUpArtifact.currentDecisionState,
        routeTarget: "runtime",
        operatingMode: queueEntry?.operating_mode ?? null,
        queueStatus: queueEntry?.status ?? "routed",
        createdAt: `${artifact.proofDate}T00:00:00.000Z`,
        updatedAt: snapshotAt,
        linkedArtifacts: {
          intakeRecordPath: queueEntry?.intake_record_path ?? routing.linkedIntakeRecord ?? null,
          triageRecordPath: routing.linkedTriageRecord,
          routingRecordPath: queueEntry?.routing_record_path ?? routing.routingRelativePath,
          engineRunRecordPath: routing.engineRunRecordPath,
          engineRunReportPath: routing.engineRunReportPath,
          runtimeFollowUpPath: artifact.linkedFollowUpPath,
          runtimeRecordPath: artifact.linkedRuntimeRecordPath,
          runtimeProofPath: artifact.runtimeProofRelativePath,
          runtimeCapabilityBoundaryPath: artifact.runtimeCapabilityBoundaryRelativePath,
          resultRecordPath: queueEntry?.result_record_path ?? artifact.linkedFollowUpPath,
        },
        projectionInputs: null,
      },
    });
  }

  mirrorDirectiveRuntimeCapabilityBoundaryOpen({
    directiveRoot,
    caseId: artifact.candidateId,
    receivedAt: snapshotAt,
    queueStatus: mirrored.record?.queueStatus ?? "routed",
    linkedArtifacts: {
      runtimeFollowUpPath: artifact.linkedFollowUpPath,
      runtimeRecordPath: artifact.linkedRuntimeRecordPath,
      runtimeProofPath: artifact.runtimeProofRelativePath,
      runtimeCapabilityBoundaryPath: artifact.runtimeCapabilityBoundaryRelativePath,
      resultRecordPath: mirrored.record?.linkedArtifacts.resultRecordPath ?? artifact.linkedFollowUpPath,
    },
    projectionInput: buildRuntimeCapabilityBoundaryOpenProjectionInput({
      artifact,
      approvedBy,
      snapshotAt,
    }),
  });

  const projectionSet = writeDirectiveRuntimeCapabilityBoundaryProjectionSet({
    directiveRoot,
    caseId: artifact.candidateId,
  });
  if (!projectionSet.ok) {
    throw new Error(
      `invalid_state: unable to generate Runtime capability-boundary projections for ${artifact.candidateId}: ${projectionSet.reason}`,
    );
  }

  const resolvedState = resolveDirectiveWorkspaceState({
    directiveRoot,
    artifactPath: artifact.runtimeCapabilityBoundaryRelativePath,
  });
  if (resolvedState.focus?.ok) {
    const currentMirror = readDirectiveMirroredDiscoveryCaseRecord({
      directiveRoot,
      caseId: artifact.candidateId,
    });
    const eventLog = readDirectiveCaseMirrorEvents({
      directiveRoot,
      caseId: artifact.candidateId,
    });
    const nextSequence = eventLog.events.reduce(
      (highest, event) => Math.max(highest, event.sequence),
      0,
    ) + 1;
    appendDirectiveCaseMirrorEvents({
      directiveRoot,
      caseId: artifact.candidateId,
      events: [
        {
          schemaVersion: 1,
          eventId: `${artifact.candidateId}:state_materialized:runtime_capability_boundary_open:v1`,
          caseId: artifact.candidateId,
          candidateId: artifact.candidateId,
          candidateName: artifact.candidateName,
          sequence: nextSequence,
          eventType: "state_materialized",
          occurredAt: snapshotAt,
          queueStatus: resolvedState.focus.discovery.queueStatus,
          routeTarget: resolvedState.focus.routeTarget,
          operatingMode: resolvedState.focus.discovery.operatingMode,
          linkedArtifactPath: resolvedState.focus.currentHead.artifactPath,
          decisionState:
            currentMirror.record?.decisionState
            ?? artifact.runtimeRecordArtifact.followUpArtifact.currentDecisionState,
          currentHeadPath: resolvedState.focus.currentHead.artifactPath,
          currentStage: resolvedState.focus.currentStage,
          nextLegalStep: resolvedState.focus.nextLegalStep,
        },
      ],
    });
  }

  return {
    ok: true,
    created,
    directiveRoot,
    runtimeProofRelativePath: artifact.runtimeProofRelativePath,
    runtimeCapabilityBoundaryRelativePath: artifact.runtimeCapabilityBoundaryRelativePath,
    runtimeCapabilityBoundaryAbsolutePath: artifact.runtimeCapabilityBoundaryAbsolutePath,
    candidateId: artifact.candidateId,
    candidateName: artifact.candidateName,
  };
}

