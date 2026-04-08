import fs from "node:fs";
import path from "node:path";

import {
  normalizeDirectiveApprovalActor,
  requireDirectiveCurrentStageForOpening,
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveEligibleStatus,
  requireDirectiveExplicitApproval,
  resolveDirectiveWorkspaceRelativePath,
} from "../../engine/approval-boundary.ts";
import { appendDirectiveCaseMirrorEvents, readDirectiveCaseMirrorEvents } from "../../engine/cases/case-event-log.ts";
import {
  mirrorDirectiveRuntimeProofOpen,
  readDirectiveMirroredDiscoveryCaseRecord,
  writeDirectiveMirroredDiscoveryCaseRecord,
} from "../../engine/cases/case-store.ts";
import { resolveDirectiveWorkspaceState } from "../../engine/state/index.ts";
import {
  writeDirectiveRuntimeProofOpenProjectionSet,
  type DirectiveMirroredRuntimeProofOpenProjectionInput,
} from "./runtime-proof-open-projections.ts";
import type { DiscoveryIntakeQueueEntry } from "../../discovery/lib/discovery-intake-queue-writer.ts";
import {
  readDirectiveRuntimeFollowUpArtifact,
  type DirectiveRuntimeFollowUpArtifact,
} from "./runtime-follow-up-opener.ts";
import {
  extractRuntimeOpenerBulletList as extractBulletList,
  extractRuntimeOpenerMarkdownTitle as extractMarkdownTitle,
  extractRuntimeOpenerRequiredBulletValue as extractBulletValue,
  normalizeRuntimeOpenerRelativePath as normalizeRelativePath,
  readDirectiveRuntimeRoutingBackfillCompat,
  readRuntimeOpenerJson as readJson,
  readRuntimeOpenerUtf8 as readUtf8,
} from "./runtime-opener-shared.ts";

function buildRuntimeProofRelativePath(input: {
  runtimeRecordDate: string;
  candidateId: string;
}) {
  return normalizeRelativePath(
    path.join(
      "runtime",
      "03-proof",
      `${input.runtimeRecordDate}-${input.candidateId}-proof.md`,
    ),
  );
}

function renderListOrPlaceholder(values: string[], placeholder = "  - n/a") {
  if (values.length === 0) {
    return placeholder;
  }
  return values.map((value) => `  - ${value}`).join("\n");
}

export type DirectiveRuntimeRecordArtifact = {
  title: string;
  candidateId: string;
  candidateName: string;
  runtimeRecordDate: string;
  originPath: string;
  linkedFollowUpRecord: string;
  runtimeObjective: string;
  proposedHost: string;
  proposedRuntimeSurface: string;
  requiredProofSummary: string;
  requiredGates: string[];
  risks: string[];
  rollback: string;
  currentStatus: string;
  nextDecisionPoint: string;
  runtimeRecordRelativePath: string;
  runtimeRecordAbsolutePath: string;
  runtimeProofRelativePath: string;
  runtimeProofAbsolutePath: string;
  proofExists: boolean;
  approvalAllowed: boolean;
  content: string;
  followUpArtifact: DirectiveRuntimeFollowUpArtifact;
};

export type DirectiveRuntimeRecordProofOpenResult = {
  ok: true;
  created: boolean;
  directiveRoot: string;
  runtimeRecordRelativePath: string;
  runtimeProofRelativePath: string;
  runtimeProofAbsolutePath: string;
  candidateId: string;
  candidateName: string;
};

function buildRuntimeProofOpenProjectionInput(input: {
  artifact: DirectiveRuntimeRecordArtifact;
  approvedBy: string;
  snapshotAt: string;
}): DirectiveMirroredRuntimeProofOpenProjectionInput {
  return {
    snapshotAt: input.snapshotAt,
    approvedBy: input.approvedBy,
    runtimeRecordDate: input.artifact.runtimeRecordDate,
    candidateId: input.artifact.candidateId,
    candidateName: input.artifact.candidateName,
    runtimeRecordRelativePath: input.artifact.runtimeRecordRelativePath,
    runtimeProofRelativePath: input.artifact.runtimeProofRelativePath,
    linkedFollowUpRecord: input.artifact.linkedFollowUpRecord,
    runtimeObjective: input.artifact.runtimeObjective,
    proposedHost: input.artifact.proposedHost,
    proposedRuntimeSurface: input.artifact.proposedRuntimeSurface,
    requiredProof: input.artifact.followUpArtifact.requiredProof,
    requiredGates: input.artifact.requiredGates,
    excludedBaggage: input.artifact.followUpArtifact.excludedBaggage,
    rollback: input.artifact.rollback,
    noOpPath: input.artifact.followUpArtifact.noOpPath,
    reviewCadence: input.artifact.followUpArtifact.reviewCadence,
    linkedHandoffPath: input.artifact.followUpArtifact.linkedHandoffPath,
    sourceRecordStatus: input.artifact.currentStatus,
    nextDecisionPoint: input.artifact.nextDecisionPoint,
  };
}

function renderRuntimeV0ProofArtifact(input: {
  artifact: DirectiveRuntimeRecordArtifact;
  approvedBy: string;
}) {
  const followUp = input.artifact.followUpArtifact;

  return `# Legacy Runtime Proof Artifact: ${input.artifact.candidateName} (${input.artifact.runtimeRecordDate})

## runtime record identity
- Candidate id: \`${input.artifact.candidateId}\`
- Candidate name: \`${input.artifact.candidateName}\`
- Legacy Runtime record path: \`${input.artifact.runtimeRecordRelativePath}\`
- Source follow-up record path: \`${input.artifact.linkedFollowUpRecord}\`
- Proof opening decision: \`approved_for_bounded_proof_artifact\`
- Opened by: \`${input.approvedBy}\`
- Opened on: \`${input.artifact.runtimeRecordDate}\`
- Current status: \`proof_scope_opened\`

## source inputs required
- Legacy Runtime record: \`${input.artifact.runtimeRecordRelativePath}\`
- Source Runtime follow-up record: \`${input.artifact.linkedFollowUpRecord}\`
${followUp.linkedHandoffPath ? `- Linked Discovery routing record: \`${followUp.linkedHandoffPath}\`\n` : ""}- Runtime objective: ${input.artifact.runtimeObjective}
- Proposed host: \`${input.artifact.proposedHost}\`
- Proposed runtime surface: ${input.artifact.proposedRuntimeSurface}

## what must be proven before bounded runtime conversion
${renderListOrPlaceholder(followUp.requiredProof)}

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
${renderListOrPlaceholder(input.artifact.requiredGates.map((value) => `\`${value}\``))}
- Rollback remains explicit and returns cleanly to the Legacy Runtime record and follow-up record.
- Excluded baggage remains outside the proof boundary:
${renderListOrPlaceholder(followUp.excludedBaggage)}

## proof opening boundary
- Source record status: \`${input.artifact.currentStatus}\`
- Next decision point from Legacy Runtime record: ${input.artifact.nextDecisionPoint}
- This artifact opens bounded proof review only. It does not authorize execution, host integration, or promotion.

## rollback boundary
- Rollback: ${input.artifact.rollback}
- No-op path: ${followUp.noOpPath}
- Review cadence: ${followUp.reviewCadence}

## artifact linkage
- Runtime proof artifact: \`${input.artifact.runtimeProofRelativePath}\`
- Legacy Runtime record: \`${input.artifact.runtimeRecordRelativePath}\`
- Source Runtime follow-up record: \`${input.artifact.linkedFollowUpRecord}\`
${followUp.linkedHandoffPath ? `- Linked Discovery routing record: \`${followUp.linkedHandoffPath}\`\n` : ""}`;
}

export function readDirectiveRuntimeRecordArtifact(input: {
  runtimeRecordPath: string;
  directiveRoot?: string;
}): DirectiveRuntimeRecordArtifact {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const runtimeRecordRelativePath = resolveDirectiveWorkspaceRelativePath(
    directiveRoot,
    input.runtimeRecordPath,
    "runtimeRecordPath",
  );

  if (
    !runtimeRecordRelativePath.startsWith("runtime/02-records/")
    || !runtimeRecordRelativePath.endsWith("-runtime-record.md")
  ) {
    throw new Error("invalid_input: runtimeRecordPath must point to runtime/02-records/*-runtime-record.md");
  }

  const runtimeRecordAbsolutePath = path.resolve(directiveRoot, runtimeRecordRelativePath).replace(/\\/g, "/");
  if (!fs.existsSync(runtimeRecordAbsolutePath)) {
    throw new Error(`invalid_input: runtimeRecordPath not found: ${runtimeRecordRelativePath}`);
  }

  const content = readUtf8(runtimeRecordAbsolutePath);
  const candidateId = extractBulletValue(content, "Candidate id");
  const runtimeRecordDate = extractBulletValue(content, "Review date");
  const linkedFollowUpRecord = extractBulletValue(content, "Source follow-up record");
  const followUpArtifact = readDirectiveRuntimeFollowUpArtifact({
    directiveRoot,
    followUpPath: linkedFollowUpRecord,
  });
  const runtimeProofRelativePath = buildRuntimeProofRelativePath({
    runtimeRecordDate,
    candidateId,
  });
  const runtimeProofAbsolutePath = path.resolve(directiveRoot, runtimeProofRelativePath).replace(/\\/g, "/");
  const currentStatus = extractBulletValue(content, "Current status");

  return {
    title: extractMarkdownTitle(content, "runtime record title"),
    candidateId,
    candidateName: extractBulletValue(content, "Candidate name", 'invalid_input: missing "Candidate name" in Legacy Runtime record'),
    runtimeRecordDate,
    originPath: extractBulletValue(content, "Source follow-up record", 'invalid_input: missing "Source follow-up record" in Legacy Runtime record'),
    linkedFollowUpRecord,
    runtimeObjective: extractBulletValue(content, "Runtime value to operationalize", 'invalid_input: missing "Runtime value to operationalize" in Legacy Runtime record'),
    proposedHost: extractBulletValue(content, "Proposed host", 'invalid_input: missing "Proposed host" in Legacy Runtime record'),
    proposedRuntimeSurface: extractBulletValue(content, "Proposed integration mode", 'invalid_input: missing "Proposed integration mode" in Legacy Runtime record'),
    requiredProofSummary: extractBulletValue(content, "Required proof summary", 'invalid_input: missing "Required proof summary" in Legacy Runtime record'),
    requiredGates: extractBulletList(content, "Required gates"),
    risks: followUpArtifact.risks,
    rollback: extractBulletValue(content, "Rollback", 'invalid_input: missing "Rollback" in Legacy Runtime record'),
    currentStatus,
    nextDecisionPoint: "Approve one bounded Runtime proof artifact or leave the record pending.",
    runtimeRecordRelativePath,
    runtimeRecordAbsolutePath,
    runtimeProofRelativePath,
    runtimeProofAbsolutePath,
    proofExists: fs.existsSync(runtimeProofAbsolutePath),
    approvalAllowed: currentStatus === "pending_proof_boundary",
    content,
    followUpArtifact,
  };
}

export function openDirectiveRuntimeRecordProof(input: {
  runtimeRecordPath: string;
  approved?: boolean;
  approvedBy?: string | null;
  directiveRoot?: string;
}): DirectiveRuntimeRecordProofOpenResult {
  requireDirectiveExplicitApproval({
    approved: input.approved,
    action: "open a Runtime proof artifact",
  });

  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const artifact = readDirectiveRuntimeRecordArtifact({
    directiveRoot,
    runtimeRecordPath: input.runtimeRecordPath,
  });

  requireDirectiveCurrentStageForOpening({
    directiveRoot,
    artifactPath: artifact.runtimeRecordRelativePath,
    subject: "Legacy Runtime record",
    allowedCurrentStages: ["runtime.record."],
  });
  requireDirectiveEligibleStatus({
    subject: "Legacy Runtime record",
    currentStatus: artifact.currentStatus,
    allowedStatuses: ["pending_proof_boundary"],
    action: "open proof",
  });

  const approvedBy = normalizeDirectiveApprovalActor(input.approvedBy);
  const snapshotAt = new Date().toISOString();
  const created = !artifact.proofExists;

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
      ?? artifact.followUpArtifact.linkedHandoffPath
      ?? null;
    if (!routingPath) {
      throw new Error(
        `invalid_state: unable to backfill mirrored Runtime proof case for ${artifact.candidateId} without a routing record`,
      );
    }
    const routing = readDirectiveRuntimeRoutingBackfillCompat({
      directiveRoot,
      routingPath,
      extractRequiredBulletValue: (markdown, label) =>
        extractBulletValue(markdown, label, `invalid_input: missing "${label}" in Legacy Runtime record`),
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
        sourceReference: queueEntry?.source_reference ?? artifact.linkedFollowUpRecord,
        decisionState: artifact.followUpArtifact.currentDecisionState,
        routeTarget: "runtime",
        operatingMode: queueEntry?.operating_mode ?? null,
        queueStatus: queueEntry?.status ?? "routed",
        createdAt: `${artifact.runtimeRecordDate}T00:00:00.000Z`,
        updatedAt: snapshotAt,
        linkedArtifacts: {
          intakeRecordPath: queueEntry?.intake_record_path ?? routing.linkedIntakeRecord ?? null,
          triageRecordPath: routing.linkedTriageRecord,
          routingRecordPath: queueEntry?.routing_record_path ?? routing.routingRelativePath,
          engineRunRecordPath: routing.engineRunRecordPath,
          engineRunReportPath: routing.engineRunReportPath,
          runtimeFollowUpPath: artifact.linkedFollowUpRecord,
          runtimeRecordPath: artifact.runtimeRecordRelativePath,
          runtimeProofPath: artifact.runtimeProofRelativePath,
          resultRecordPath: queueEntry?.result_record_path ?? artifact.linkedFollowUpRecord,
        },
        projectionInputs: null,
      },
    });
  }

  mirrorDirectiveRuntimeProofOpen({
    directiveRoot,
    caseId: artifact.candidateId,
    receivedAt: snapshotAt,
    queueStatus: mirrored.record?.queueStatus ?? "routed",
    linkedArtifacts: {
      runtimeFollowUpPath: artifact.linkedFollowUpRecord,
      runtimeRecordPath: artifact.runtimeRecordRelativePath,
      runtimeProofPath: artifact.runtimeProofRelativePath,
      resultRecordPath: mirrored.record?.linkedArtifacts.resultRecordPath ?? artifact.linkedFollowUpRecord,
    },
    projectionInput: buildRuntimeProofOpenProjectionInput({
      artifact,
      approvedBy,
      snapshotAt,
    }),
  });

  const projectionSet = writeDirectiveRuntimeProofOpenProjectionSet({
    directiveRoot,
    caseId: artifact.candidateId,
  });
  if (!projectionSet.ok) {
    throw new Error(
      `invalid_state: unable to generate Runtime proof projections for ${artifact.candidateId}: ${projectionSet.reason}`,
    );
  }

  const resolvedState = resolveDirectiveWorkspaceState({
    directiveRoot,
    artifactPath: artifact.runtimeProofRelativePath,
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
          eventId: `${artifact.candidateId}:state_materialized:runtime_proof_open:v1`,
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
          decisionState: currentMirror.record?.decisionState ?? artifact.followUpArtifact.currentDecisionState,
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
    runtimeRecordRelativePath: artifact.runtimeRecordRelativePath,
    runtimeProofRelativePath: artifact.runtimeProofRelativePath,
    runtimeProofAbsolutePath: artifact.runtimeProofAbsolutePath,
    candidateId: artifact.candidateId,
    candidateName: artifact.candidateName,
  };
}

