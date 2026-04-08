import path from "node:path";

import { writeUtf8 } from "../../shared/lib/file-io.ts";

import {
  buildDirectiveArchitectureCloseoutFile,
  type DirectiveArchitectureCloseoutWriteRequest,
} from "./architecture-closeout.ts";
import {
  upsertDirectiveArchitectureAdoptionDecisionArtifact,
} from "./architecture-adoption-decision-store.ts";
import type {
  ArchitectureValueShape,
} from "./architecture-adoption-resolution.ts";
import {
  readDirectiveArchitectureHandoffArtifact,
  type DirectiveArchitectureHandoffArtifact,
} from "./architecture-handoff-start.ts";
import { readDirectiveCaseMirrorEvents } from "../../engine/cases/case-event-log.ts";
import { readDirectiveMirroredDiscoveryCaseRecord } from "../../engine/cases/case-store.ts";

export type DirectiveMirroredNoteArchitectureCloseoutProjectionInput = {
  snapshotAt: string;
  closedBy: string;
  resultSummary: string;
  primaryEvidencePath: string | null;
  transformedArtifactsProduced: string[];
  nextDecision: "needs-more-evidence" | "adopt" | "defer" | "reject";
  valueShape: ArchitectureValueShape;
  adaptationQuality: "strong" | "adequate" | "weak" | "skipped";
  improvementQuality: "strong" | "adequate" | "weak" | "skipped";
  proofExecuted: boolean;
  targetArtifactClarified: boolean;
  deltaEvidencePresent: boolean;
  noUnresolvedBaggage: boolean;
  productArtifactMaterialized: boolean;
};

export type DirectiveNoteArchitectureCloseoutProjectionSet =
  | {
      ok: false;
      reason:
        | "missing_case_record"
        | "missing_projection_input"
        | "missing_handoff_path";
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
        handoffPath: string;
        resultPath: string;
        decisionPath: string;
      };
      compatibility: {
        boundedStartRequired: false;
        handoffPath: string;
      };
      markdown: {
        result: string;
      };
      decisionArtifact: ReturnType<typeof buildDirectiveArchitectureCloseoutFile>["artifact"];
      decisionJson: string;
    };

function sortEvents<T extends { sequence: number; occurredAt: string }>(events: T[]) {
  return [...events].sort((left, right) =>
    left.sequence - right.sequence || left.occurredAt.localeCompare(right.occurredAt),
  );
}

function buildNoteArchitectureCloseoutRequest(input: {
  handoffArtifact: DirectiveArchitectureHandoffArtifact;
  projectionInput: DirectiveMirroredNoteArchitectureCloseoutProjectionInput;
}): DirectiveArchitectureCloseoutWriteRequest {
  const { handoffArtifact, projectionInput } = input;
  const valuableWithoutRuntimeSurface = handoffArtifact.runtimeThresholdCheck
    .toLowerCase()
    .includes("yes");

  return {
    recordRelativePath: handoffArtifact.resultRelativePath,
    sourceId: handoffArtifact.candidateId,
    adoptionDate: projectionInput.snapshotAt.slice(0, 10),
    usefulnessLevel: handoffArtifact.usefulnessLevel,
    valueShape: projectionInput.valueShape,
    readinessCheck: {
      source_analysis_complete: true,
      adaptation_decision_complete: projectionInput.targetArtifactClarified,
      adaptation_quality_acceptable:
        projectionInput.adaptationQuality === "strong"
        || projectionInput.adaptationQuality === "adequate",
      delta_evidence_present: projectionInput.deltaEvidencePresent,
      no_unresolved_baggage: projectionInput.noUnresolvedBaggage,
    },
    adaptationQuality: projectionInput.adaptationQuality,
    improvementQuality: projectionInput.improvementQuality,
    productArtifactMaterialized: projectionInput.productArtifactMaterialized,
    proofExecuted: projectionInput.proofExecuted,
    targetArtifactClarified: projectionInput.targetArtifactClarified,
    valuableWithoutRuntimeSurface,
    artifactPath: handoffArtifact.resultRelativePath,
    primaryEvidencePath: projectionInput.primaryEvidencePath ?? undefined,
    reviewInput: {
      candidateId: handoffArtifact.candidateId,
      checks: {
        state_visibility_check: "pass",
        rollback_check: "pass",
        scope_isolation_check: "pass",
        validation_link_check: projectionInput.proofExecuted ? "pass" : "warning",
        ownership_boundary_check: "pass",
        packet_consumption_check: "pass",
        artifact_evidence_continuity_check:
          projectionInput.deltaEvidencePresent ? "pass" : "warning",
      },
    },
  };
}

function renderNoteHandoffBoundedResultMarkdown(input: {
  handoffArtifact: DirectiveArchitectureHandoffArtifact;
  projectionInput: DirectiveMirroredNoteArchitectureCloseoutProjectionInput;
  closeout: ReturnType<typeof buildDirectiveArchitectureCloseoutFile>;
}) {
  const artifact = input.handoffArtifact;
  const closeout = input.closeout;
  const boundedScope = artifact.boundedScope.length > 0
    ? artifact.boundedScope.map((item) => `- ${item}`).join("\n")
    : "- Keep the NOTE review bounded to one Architecture result.";
  const inputs = artifact.inputs.length > 0
    ? artifact.inputs.map((item) => `- ${item}`).join("\n")
    : "- n/a";
  const gates = artifact.validationGates.length > 0
    ? artifact.validationGates.map((item) => `- \`${item}\``).join("\n")
    : "- n/a";
  const transformedArtifacts =
    input.projectionInput.transformedArtifactsProduced.length > 0
      ? input.projectionInput.transformedArtifactsProduced
        .map((item) => `- \`${item}\``)
        .join("\n")
      : "- none explicitly materialized in this NOTE review.";
  const metaCategory = closeout.artifact.self_improvement?.category ?? "n/a";

  return [
    `# ${artifact.title} Bounded Architecture Result`,
    "",
    `- Candidate id: ${artifact.candidateId}`,
    `- Candidate name: ${artifact.title}`,
    `- Experiment date: ${input.projectionInput.snapshotAt.slice(0, 10)}`,
    "- Owning track: Architecture",
    "- Experiment type: note-mode direct bounded result",
    `- Closeout approval: reviewed by ${input.projectionInput.closedBy} directly from NOTE-mode handoff \`${artifact.handoffRelativePath}\``,
    "",
    `- Objective: ${artifact.objective}`,
    "- Bounded scope:",
    boundedScope,
    "- Inputs:",
    inputs,
    "- Expected output:",
    "- One NOTE-mode bounded Architecture result artifact.",
    "- Validation gate(s):",
    gates,
    "- Transition policy profile: `decision_review`",
    "- Scoring policy profile: `architecture_self_improvement`",
    `- Rollback: ${artifact.rollback}`,
    `- Result summary: ${input.projectionInput.resultSummary}`,
    "- Evidence path:",
    ...(input.projectionInput.primaryEvidencePath
      ? [`- Primary evidence path: \`${input.projectionInput.primaryEvidencePath}\``]
      : []),
    "- Bounded start: `n/a`",
    `- Handoff stub: \`${artifact.handoffRelativePath}\``,
    `- Engine run record: ${artifact.engineRunRecordPath ? `\`${artifact.engineRunRecordPath}\`` : "n/a"}`,
    `- Engine run report: ${artifact.engineRunReportPath ? `\`${artifact.engineRunReportPath}\`` : "n/a"}`,
    `- Discovery routing record: ${artifact.discoveryRoutingRecordPath ? `\`${artifact.discoveryRoutingRecordPath}\`` : "n/a"}`,
    `- Closeout decision artifact: \`${closeout.relativePath}\``,
    `- Next decision: \`${input.projectionInput.nextDecision}\``,
    "",
    "## Lifecycle classification (per `architecture-artifact-lifecycle` contract)",
    "",
    "- Origin: `source-driven`",
    `- Usefulness level: \`${artifact.usefulnessLevel}\``,
    `- Runtime threshold check: ${artifact.runtimeThresholdCheck}`,
    "",
    "## Source adaptation fields (Architecture source-driven experiments only)",
    "",
    "- Source analysis ref: n/a",
    "- Adaptation decision ref: n/a",
    `- Adaptation quality: \`${closeout.artifact.adaptation_quality}\``,
    `- Improvement quality: \`${closeout.artifact.improvement_quality || "skipped"}\``,
    `- Meta-useful: \`${artifact.usefulnessLevel === "meta" ? "yes" : "no"}\``,
    `- Meta-usefulness category: \`${metaCategory}\``,
    "- Transformation artifact gate result: `not_applicable`",
    "- Transformed artifacts produced:",
    transformedArtifacts,
    "",
    "## Closeout decision",
    "",
    `- Verdict: \`${closeout.artifact.decision.verdict}\``,
    `- Rationale: ${closeout.artifact.decision.rationale}`,
    `- Review result: \`${closeout.reviewResolution?.reviewResult || "not_run"}\``,
    `- Review score: \`${String(closeout.reviewResolution?.reviewScore ?? "n/a")}\``,
    "",
  ].join("\n");
}



export function materializeDirectiveNoteArchitectureCloseoutProjectionSet(input: {
  directiveRoot: string;
  caseId: string;
}): DirectiveNoteArchitectureCloseoutProjectionSet {
  const mirrored = readDirectiveMirroredDiscoveryCaseRecord(input);
  if (!mirrored.record) {
    return {
      ok: false,
      reason: "missing_case_record",
      caseId: input.caseId,
    };
  }

  const projectionInput =
    mirrored.record.projectionInputs?.noteArchitectureCloseout ?? null;
  if (!projectionInput) {
    return {
      ok: false,
      reason: "missing_projection_input",
      caseId: input.caseId,
    };
  }

  const handoffPath = mirrored.record.linkedArtifacts.architectureHandoffPath ?? null;
  if (!handoffPath) {
    return {
      ok: false,
      reason: "missing_handoff_path",
      caseId: input.caseId,
    };
  }

  const handoffArtifact = readDirectiveArchitectureHandoffArtifact({
    directiveRoot: input.directiveRoot,
    handoffPath,
  });
  const closeout = buildDirectiveArchitectureCloseoutFile(
    buildNoteArchitectureCloseoutRequest({
      handoffArtifact,
      projectionInput,
    }),
  );
  const eventLog = readDirectiveCaseMirrorEvents(input);
  const latestEvent = sortEvents(eventLog.events).at(-1) ?? null;
  const resultMarkdown = renderNoteHandoffBoundedResultMarkdown({
    handoffArtifact,
    projectionInput,
    closeout,
  });
  const decisionJson = `${JSON.stringify(closeout.artifact, null, 2)}\n`;

  return {
    ok: true,
    caseId: mirrored.record.caseId,
    queueStatus: latestEvent?.queueStatus ?? mirrored.record.queueStatus,
    routeTarget: latestEvent?.routeTarget ?? mirrored.record.routeTarget,
    operatingMode: latestEvent?.operatingMode ?? mirrored.record.operatingMode,
    latestEventType: latestEvent?.eventType ?? null,
    paths: {
      handoffPath,
      resultPath: handoffArtifact.resultRelativePath,
      decisionPath: closeout.relativePath,
    },
    compatibility: {
      boundedStartRequired: false,
      handoffPath,
    },
    markdown: {
      result: resultMarkdown,
    },
    decisionArtifact: closeout.artifact,
    decisionJson,
  };
}

export function writeDirectiveNoteArchitectureCloseoutProjectionSet(input: {
  directiveRoot: string;
  caseId: string;
}) {
  const projectionSet = materializeDirectiveNoteArchitectureCloseoutProjectionSet(input);
  if (!projectionSet.ok) {
    return projectionSet;
  }

  writeUtf8(
    path.resolve(input.directiveRoot, projectionSet.paths.resultPath),
    projectionSet.markdown.result,
  );
  upsertDirectiveArchitectureAdoptionDecisionArtifact({
    directiveRoot: input.directiveRoot,
    recordRelativePath: projectionSet.paths.resultPath,
    outputRelativePath: projectionSet.paths.decisionPath,
    artifact: projectionSet.decisionArtifact,
  });

  return projectionSet;
}
