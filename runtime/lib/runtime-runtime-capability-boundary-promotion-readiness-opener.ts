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
  mirrorDirectiveRuntimePromotionReadinessOpen,
  readDirectiveMirroredDiscoveryCaseRecord,
  writeDirectiveMirroredDiscoveryCaseRecord,
} from "../../engine/cases/case-store.ts";
import { resolveDirectiveWorkspaceState } from "../../engine/state/index.ts";
import {
  readDirectiveRuntimeProofArtifact,
  type DirectiveRuntimeProofArtifact,
} from "./runtime-proof-runtime-capability-boundary-opener.ts";
import {
  readDirectiveRuntimeRecordArtifact,
  type DirectiveRuntimeRecordArtifact,
} from "./runtime-record-proof-opener.ts";
import type { DiscoveryIntakeQueueEntry } from "../../discovery/lib/discovery-intake-queue-writer.ts";
import {
  writeDirectiveRuntimePromotionReadinessProjectionSet,
  type DirectiveMirroredRuntimePromotionReadinessOpenProjectionInput,
} from "./runtime-promotion-readiness-projections.ts";
import {
  extractRuntimeOpenerMarkdownTitle as extractMarkdownTitle,
  extractRuntimeOpenerRequiredBulletValue as extractBulletValue,
  normalizeRuntimeOpenerRelativePath as normalizeRelativePath,
  readDirectiveRuntimeRoutingBackfillCompat,
  readRuntimeOpenerJson as readJson,
  readRuntimeOpenerUtf8 as readUtf8,
} from "./runtime-opener-shared.ts";

function buildPromotionReadinessRelativePath(input: {
  boundaryDate: string;
  candidateId: string;
}) {
  return normalizeRelativePath(
    path.join(
      "runtime",
      "05-promotion-readiness",
      `${input.boundaryDate}-${input.candidateId}-promotion-readiness.md`,
    ),
  );
}

function renderListOrPlaceholder(values: string[], placeholder = "  - n/a") {
  if (values.length === 0) {
    return placeholder;
  }
  return values.map((value) => `  - ${value}`).join("\n");
}

export type DirectiveRuntimeRuntimeCapabilityBoundaryArtifact = {
  title: string;
  candidateId: string;
  candidateName: string;
  boundaryDate: string;
  currentProofStatus: string;
  runtimeObjective: string;
  proposedHost: string;
  proposedRuntimeSurface: string;
  linkedRuntimeProofPath: string;
  linkedRuntimeRecordPath: string;
  linkedFollowUpPath: string;
  linkedRoutingPath: string | null;
  linkedCallableStubPath: string | null;
  rollback: string;
  noOpPath: string;
  reviewCadence: string;
  requiredProofItems: string[];
  requiredGates: string[];
  capabilityBoundaryRelativePath: string;
  capabilityBoundaryAbsolutePath: string;
  promotionReadinessRelativePath: string;
  promotionReadinessAbsolutePath: string;
  promotionReadinessExists: boolean;
  approvalAllowed: boolean;
  content: string;
  proofArtifact: DirectiveRuntimeProofArtifact;
  runtimeRecordArtifact: DirectiveRuntimeRecordArtifact;
};

export type DirectiveRuntimePromotionReadinessOpenResult = {
  ok: true;
  created: boolean;
  directiveRoot: string;
  capabilityBoundaryRelativePath: string;
  promotionReadinessRelativePath: string;
  promotionReadinessAbsolutePath: string;
  candidateId: string;
  candidateName: string;
};

function buildRuntimePromotionReadinessOpenProjectionInput(input: {
  directiveRoot: string;
  artifact: DirectiveRuntimeRuntimeCapabilityBoundaryArtifact;
  approvedBy: string;
  snapshotAt: string;
}): DirectiveMirroredRuntimePromotionReadinessOpenProjectionInput {
  return {
    snapshotAt: input.snapshotAt,
    approvedBy: input.approvedBy,
    boundaryDate: input.artifact.boundaryDate,
    candidateId: input.artifact.candidateId,
    candidateName: input.artifact.candidateName,
    capabilityBoundaryRelativePath: input.artifact.capabilityBoundaryRelativePath,
    linkedRuntimeProofPath: input.artifact.linkedRuntimeProofPath,
    linkedRuntimeRecordPath: input.artifact.linkedRuntimeRecordPath,
    linkedFollowUpPath: input.artifact.linkedFollowUpPath,
    linkedRoutingPath: input.artifact.linkedRoutingPath,
    linkedCallableStubPath: input.artifact.linkedCallableStubPath,
    promotionReadinessRelativePath: input.artifact.promotionReadinessRelativePath,
    runtimeObjective: input.artifact.runtimeObjective,
    proposedHost: input.artifact.proposedHost,
    proposedRuntimeSurface: input.artifact.proposedRuntimeSurface,
    requiredProofItems: input.artifact.requiredProofItems,
    requiredGates: input.artifact.requiredGates,
    rollback: input.artifact.rollback,
    noOpPath: input.artifact.noOpPath,
    reviewCadence: input.artifact.reviewCadence,
    templateMarkdown: readCanonicalPromotionReadinessTemplateMarkdown({
      directiveRoot: input.directiveRoot,
      promotionReadinessRelativePath: input.artifact.promotionReadinessRelativePath,
      approvedBy: input.approvedBy,
    }),
  };
}

function rewritePromotionReadinessOpenedBy(templateMarkdown: string, approvedBy: string) {
  return templateMarkdown.replace(
    /^- Opened by: `[^`]*`$/m,
    `- Opened by: \`${approvedBy}\``,
  );
}

function readCanonicalPromotionReadinessTemplateMarkdown(input: {
  directiveRoot: string;
  promotionReadinessRelativePath: string;
  approvedBy: string;
}) {
  const canonicalDirectiveRoot = normalizeDirectiveWorkspaceRoot();
  if (canonicalDirectiveRoot === input.directiveRoot) {
    return null;
  }

  const canonicalPromotionReadinessPath = path
    .resolve(canonicalDirectiveRoot, input.promotionReadinessRelativePath)
    .replace(/\\/g, "/");
  if (!fs.existsSync(canonicalPromotionReadinessPath)) {
    return null;
  }

  return rewritePromotionReadinessOpenedBy(
    readUtf8(canonicalPromotionReadinessPath),
    input.approvedBy,
  );
}

function renderPromotionReadinessArtifact(input: {
  artifact: DirectiveRuntimeRuntimeCapabilityBoundaryArtifact;
  approvedBy: string;
}) {
  return `# Runtime Promotion-Readiness Artifact: ${input.artifact.candidateName} (${input.artifact.boundaryDate})

## runtime capability boundary identity
- Candidate id: \`${input.artifact.candidateId}\`
- Candidate name: \`${input.artifact.candidateName}\`
- Runtime capability boundary path: \`${input.artifact.capabilityBoundaryRelativePath}\`
- Source Runtime proof artifact: \`${input.artifact.linkedRuntimeProofPath}\`
- Source Legacy Runtime record: \`${input.artifact.linkedRuntimeRecordPath}\`
- Source Runtime follow-up record: \`${input.artifact.linkedFollowUpPath}\`
${input.artifact.linkedRoutingPath ? `- Linked Discovery routing record: \`${input.artifact.linkedRoutingPath}\`\n` : ""}- Promotion-readiness decision: \`approved_for_non_executing_promotion_readiness\`
- Opened by: \`${input.approvedBy}\`
- Opened on: \`${input.artifact.boundaryDate}\`
- Current status: \`promotion_readiness_opened\`

## bounded runtime usefulness preserved
- Runtime objective: ${input.artifact.runtimeObjective}
- Proposed host: \`${input.artifact.proposedHost}\`
- Proposed runtime surface: ${input.artifact.proposedRuntimeSurface}
- Capability form: non-executing promotion-readiness artifact
- Execution state: not executing, not host-integrated, not implemented, not promoted

## what is now explicit
- The bounded runtime capability boundary has been explicitly reviewed as a possible future promotion candidate.
- Required proof items remain explicit:
${renderListOrPlaceholder(input.artifact.requiredProofItems)}
- Required gates remain explicit:
${renderListOrPlaceholder(input.artifact.requiredGates.map((value) => `\`${value}\``))}
- This artifact does not approve host-facing promotion, runtime execution, callable implementation, or host integration.

## validation boundary
- Validate against the bounded runtime capability boundary, Runtime proof artifact, Legacy Runtime record, source follow-up record, and linked Discovery routing record only.
- Do not infer runtime readiness, host readiness, or automatic promotion from this artifact.
- A separate host-facing promotion record remains unopened and out of scope.

## rollback boundary
- Rollback: ${input.artifact.rollback}
- No-op path: ${input.artifact.noOpPath}
- Review cadence: ${input.artifact.reviewCadence}

## artifact linkage
- Promotion-readiness artifact: \`${input.artifact.promotionReadinessRelativePath}\`
- Runtime capability boundary: \`${input.artifact.capabilityBoundaryRelativePath}\`
- Runtime proof artifact: \`${input.artifact.linkedRuntimeProofPath}\`
- Legacy Runtime record: \`${input.artifact.linkedRuntimeRecordPath}\`
- Source Runtime follow-up record: \`${input.artifact.linkedFollowUpPath}\`
${input.artifact.linkedRoutingPath ? `- Linked Discovery routing record: \`${input.artifact.linkedRoutingPath}\`\n` : ""}${input.artifact.linkedCallableStubPath ? `- Linked callable stub: \`${input.artifact.linkedCallableStubPath}\`\n` : ""}`;
}

export function readDirectiveRuntimeRuntimeCapabilityBoundaryArtifact(input: {
  capabilityBoundaryPath: string;
  directiveRoot?: string;
}): DirectiveRuntimeRuntimeCapabilityBoundaryArtifact {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const capabilityBoundaryRelativePath = resolveDirectiveWorkspaceRelativePath(
    directiveRoot,
    input.capabilityBoundaryPath,
    "capabilityBoundaryPath",
  );

  if (
    !capabilityBoundaryRelativePath.startsWith("runtime/04-capability-boundaries/")
    || !capabilityBoundaryRelativePath.endsWith("-runtime-capability-boundary.md")
  ) {
    throw new Error(
      "invalid_input: capabilityBoundaryPath must point to runtime/04-capability-boundaries/*-runtime-capability-boundary.md",
    );
  }

  const capabilityBoundaryAbsolutePath = path
    .resolve(directiveRoot, capabilityBoundaryRelativePath)
    .replace(/\\/g, "/");
  if (!fs.existsSync(capabilityBoundaryAbsolutePath)) {
    throw new Error(`invalid_input: capabilityBoundaryPath not found: ${capabilityBoundaryRelativePath}`);
  }

  const content = readUtf8(capabilityBoundaryAbsolutePath);
  const linkedRuntimeProofPath = extractBulletValue(content, "Proof artifact");
  const linkedRuntimeRecordPath = extractBulletValue(content, "Runtime record");
  const proofArtifact = readDirectiveRuntimeProofArtifact({
    directiveRoot,
    runtimeProofPath: linkedRuntimeProofPath,
  });
  const runtimeRecordArtifact = readDirectiveRuntimeRecordArtifact({
    directiveRoot,
    runtimeRecordPath: linkedRuntimeRecordPath,
  });
  const boundaryDate = extractBulletValue(content, "Opened on");
  const candidateId = extractBulletValue(content, "Candidate id");
  const promotionReadinessRelativePath = buildPromotionReadinessRelativePath({
    boundaryDate,
    candidateId,
  });
  const promotionReadinessAbsolutePath = path
    .resolve(directiveRoot, promotionReadinessRelativePath)
    .replace(/\\/g, "/");
  const currentProofStatus = extractBulletValue(content, "Current Runtime proof status");

  return {
    title: extractMarkdownTitle(content, "runtime capability boundary title"),
    candidateId,
    candidateName: extractBulletValue(content, "Candidate name", 'invalid_input: missing "Candidate name" in Runtime runtime capability boundary'),
    boundaryDate,
    currentProofStatus,
    runtimeObjective: extractBulletValue(content, "Runtime objective", 'invalid_input: missing "Runtime objective" in Runtime runtime capability boundary'),
    proposedHost: extractBulletValue(content, "Proposed host", 'invalid_input: missing "Proposed host" in Runtime runtime capability boundary'),
    proposedRuntimeSurface: extractBulletValue(content, "Proposed runtime surface", 'invalid_input: missing "Proposed runtime surface" in Runtime runtime capability boundary'),
    linkedRuntimeProofPath,
    linkedRuntimeRecordPath,
    linkedFollowUpPath: extractBulletValue(content, "Source Runtime follow-up record", 'invalid_input: missing "Source Runtime follow-up record" in Runtime runtime capability boundary'),
    linkedRoutingPath: content.includes("Linked Discovery routing record")
      ? extractBulletValue(content, "Linked Discovery routing record", 'invalid_input: missing "Linked Discovery routing record" in Runtime runtime capability boundary')
      : null,
    linkedCallableStubPath: content.includes("Callable stub")
      ? extractBulletValue(content, "Callable stub", 'invalid_input: missing "Callable stub" in Runtime runtime capability boundary')
      : null,
    rollback: extractBulletValue(content, "Rollback", 'invalid_input: missing "Rollback" in Runtime runtime capability boundary'),
    noOpPath: extractBulletValue(content, "No-op path", 'invalid_input: missing "No-op path" in Runtime runtime capability boundary'),
    reviewCadence: extractBulletValue(content, "Review cadence", 'invalid_input: missing "Review cadence" in Runtime runtime capability boundary'),
    requiredProofItems: [...proofArtifact.requiredProofItems],
    requiredGates: [...proofArtifact.requiredGates],
    capabilityBoundaryRelativePath,
    capabilityBoundaryAbsolutePath,
    promotionReadinessRelativePath,
    promotionReadinessAbsolutePath,
    promotionReadinessExists: fs.existsSync(promotionReadinessAbsolutePath),
    approvalAllowed: currentProofStatus === "proof_scope_opened",
    content,
    proofArtifact,
    runtimeRecordArtifact,
  };
}

export function openDirectiveRuntimePromotionReadiness(input: {
  capabilityBoundaryPath: string;
  approved?: boolean;
  approvedBy?: string | null;
  directiveRoot?: string;
}): DirectiveRuntimePromotionReadinessOpenResult {
  requireDirectiveExplicitApproval({
    approved: input.approved,
    action: "open a Runtime promotion-readiness artifact",
  });

  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const artifact = readDirectiveRuntimeRuntimeCapabilityBoundaryArtifact({
    directiveRoot,
    capabilityBoundaryPath: input.capabilityBoundaryPath,
  });

  requireDirectiveCurrentStageForOpening({
    directiveRoot,
    artifactPath: artifact.capabilityBoundaryRelativePath,
    subject: "Runtime runtime capability boundary artifact",
    allowedCurrentStages: ["runtime.runtime_capability_boundary.opened"],
  });
  requireDirectiveEligibleStatus({
    subject: "Runtime runtime capability boundary artifact",
    currentStatus: artifact.currentProofStatus,
    allowedStatuses: ["proof_scope_opened"],
    action: "open a promotion-readiness artifact",
  });

  const approvedBy = normalizeDirectiveApprovalActor(input.approvedBy);
  const snapshotAt = new Date().toISOString();
  const created = !artifact.promotionReadinessExists;

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
        `invalid_state: unable to backfill mirrored Runtime promotion-readiness case for ${artifact.candidateId} without a routing record`,
      );
    }
    const routing = readDirectiveRuntimeRoutingBackfillCompat({
      directiveRoot,
      routingPath,
      extractRequiredBulletValue: (markdown, label) =>
        extractBulletValue(markdown, label, `invalid_input: missing "${label}" in Runtime runtime capability boundary`),
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
        createdAt: `${artifact.boundaryDate}T00:00:00.000Z`,
        updatedAt: snapshotAt,
        linkedArtifacts: {
          intakeRecordPath: queueEntry?.intake_record_path ?? routing.linkedIntakeRecord ?? null,
          triageRecordPath: routing.linkedTriageRecord,
          routingRecordPath: queueEntry?.routing_record_path ?? routing.routingRelativePath,
          engineRunRecordPath: routing.engineRunRecordPath,
          engineRunReportPath: routing.engineRunReportPath,
          runtimeFollowUpPath: artifact.linkedFollowUpPath,
          runtimeRecordPath: artifact.linkedRuntimeRecordPath,
          runtimeProofPath: artifact.linkedRuntimeProofPath,
          runtimeCapabilityBoundaryPath: artifact.capabilityBoundaryRelativePath,
          runtimePromotionReadinessPath: artifact.promotionReadinessRelativePath,
          resultRecordPath: queueEntry?.result_record_path ?? artifact.linkedFollowUpPath,
        },
        projectionInputs: null,
      },
    });
  }

  mirrorDirectiveRuntimePromotionReadinessOpen({
    directiveRoot,
    caseId: artifact.candidateId,
    receivedAt: snapshotAt,
    queueStatus: mirrored.record?.queueStatus ?? "routed",
    linkedArtifacts: {
      runtimeFollowUpPath: artifact.linkedFollowUpPath,
      runtimeRecordPath: artifact.linkedRuntimeRecordPath,
      runtimeProofPath: artifact.linkedRuntimeProofPath,
      runtimeCapabilityBoundaryPath: artifact.capabilityBoundaryRelativePath,
      runtimePromotionReadinessPath: artifact.promotionReadinessRelativePath,
      resultRecordPath: mirrored.record?.linkedArtifacts.resultRecordPath ?? artifact.linkedFollowUpPath,
    },
    projectionInput: buildRuntimePromotionReadinessOpenProjectionInput({
      directiveRoot,
      artifact,
      approvedBy,
      snapshotAt,
    }),
  });

  const projectionSet = writeDirectiveRuntimePromotionReadinessProjectionSet({
    directiveRoot,
    caseId: artifact.candidateId,
  });
  if (!projectionSet.ok) {
    throw new Error(
      `invalid_state: unable to generate Runtime promotion-readiness projections for ${artifact.candidateId}: ${projectionSet.reason}`,
    );
  }

  const resolvedState = resolveDirectiveWorkspaceState({
    directiveRoot,
    artifactPath: artifact.promotionReadinessRelativePath,
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
          eventId: `${artifact.candidateId}:state_materialized:runtime_promotion_readiness_open:v1`,
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
    capabilityBoundaryRelativePath: artifact.capabilityBoundaryRelativePath,
    promotionReadinessRelativePath: artifact.promotionReadinessRelativePath,
    promotionReadinessAbsolutePath: artifact.promotionReadinessAbsolutePath,
    candidateId: artifact.candidateId,
    candidateName: artifact.candidateName,
  };
}

