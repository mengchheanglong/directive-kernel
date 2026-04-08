import fs from "node:fs";
import path from "node:path";

import { normalizePath } from "./architecture-deep-tail-artifact-helpers.ts";
import { resolveDirectiveWorkspaceState } from "../../engine/state/index.ts";
import { buildRuntimeCallableExecutionEvidenceReport } from "../../runtime/lib/runtime-callable-execution-evidence.ts";

export const OPERATIONAL_ARCHITECTURE_IMPROVEMENT_CHECKER_ID =
  "operational_architecture_improvement_candidates";

export const RUNTIME_CALLABLE_INPUT_BOUNDARY_CANDIDATE_ID =
  "dw-pressure-runtime-callable-input-boundary-clarity-2026-04-02";
export const RUNTIME_CALLABLE_INPUT_BOUNDARY_CANDIDATE_NAME =
  "Engine Input-Boundary Review Logic From Callable Failure Evidence";
export const RUNTIME_CALLABLE_INPUT_BOUNDARY_CASE_DATE = "2026-04-02";

export type OperationalArchitectureImprovementRoutingState =
  | "proposal_ready"
  | "route_recorded"
  | "handoff_opened"
  | "architecture_started"
  | "architecture_materialized";

export type OperationalArchitectureImprovementCandidate = {
  candidateId: string;
  candidateName: string;
  sourceType: "internal-signal";
  routeTarget: "architecture";
  signalKind: "runtime_callable_execution_failure_pattern";
  selfImprovementCategory: "evaluation_quality";
  evidenceRecordPath: string;
  evidenceReportPath: string;
  evidenceSummary: string;
  failureStatus: string;
  failureCount: number;
  recommendedObjective: string;
  boundedNextAction: string;
  expectedProductEffect: string;
  rollbackBoundary: string;
  routingState: OperationalArchitectureImprovementRoutingState;
  currentStage: string | null;
  currentHeadPath: string | null;
  linkedArtifacts: {
    intakeRecordPath: string;
    triageRecordPath: string;
    routingRecordPath: string;
    handoffPath: string;
    startPath: string;
    resultPath: string;
  };
};

export type OperationalArchitectureImprovementCandidatesReport = {
  ok: true;
  checkerId: string;
  snapshotAt: string;
  sourceEvidenceCheckerId: string;
  totalCandidates: number;
  topCandidate: OperationalArchitectureImprovementCandidate | null;
  candidates: OperationalArchitectureImprovementCandidate[];
};

function fileExists(directiveRoot: string, relativePath: string) {
  return fs.existsSync(path.join(directiveRoot, relativePath));
}

function buildCaseLinkedArtifacts() {
  return {
    intakeRecordPath:
      `discovery/01-intake/${RUNTIME_CALLABLE_INPUT_BOUNDARY_CASE_DATE}-${RUNTIME_CALLABLE_INPUT_BOUNDARY_CANDIDATE_ID}-intake.md`,
    triageRecordPath:
      `discovery/02-triage/${RUNTIME_CALLABLE_INPUT_BOUNDARY_CASE_DATE}-${RUNTIME_CALLABLE_INPUT_BOUNDARY_CANDIDATE_ID}-triage.md`,
    routingRecordPath:
      `discovery/03-routing-log/${RUNTIME_CALLABLE_INPUT_BOUNDARY_CASE_DATE}-${RUNTIME_CALLABLE_INPUT_BOUNDARY_CANDIDATE_ID}-routing-record.md`,
    handoffPath:
      `architecture/01-experiments/${RUNTIME_CALLABLE_INPUT_BOUNDARY_CASE_DATE}-${RUNTIME_CALLABLE_INPUT_BOUNDARY_CANDIDATE_ID}-engine-handoff.md`,
    startPath:
      `architecture/01-experiments/${RUNTIME_CALLABLE_INPUT_BOUNDARY_CASE_DATE}-${RUNTIME_CALLABLE_INPUT_BOUNDARY_CANDIDATE_ID}-bounded-start.md`,
    resultPath:
      `architecture/01-experiments/${RUNTIME_CALLABLE_INPUT_BOUNDARY_CASE_DATE}-${RUNTIME_CALLABLE_INPUT_BOUNDARY_CANDIDATE_ID}-bounded-result.md`,
  };
}

function resolveRoutingState(
  directiveRoot: string,
  linkedArtifacts: OperationalArchitectureImprovementCandidate["linkedArtifacts"],
) {
  if (fileExists(directiveRoot, linkedArtifacts.resultPath)) {
    return "architecture_materialized";
  }
  if (fileExists(directiveRoot, linkedArtifacts.startPath)) {
    return "architecture_started";
  }
  if (fileExists(directiveRoot, linkedArtifacts.handoffPath)) {
    return "handoff_opened";
  }
  if (fileExists(directiveRoot, linkedArtifacts.routingRecordPath)) {
    return "route_recorded";
  }
  return "proposal_ready";
}

function resolveCurrentState(input: {
  directiveRoot: string;
  routingRecordPath: string;
}) {
  if (!fileExists(input.directiveRoot, input.routingRecordPath)) {
    return {
      currentStage: null,
      currentHeadPath: null,
    };
  }

  const resolved = resolveDirectiveWorkspaceState({
    directiveRoot: input.directiveRoot,
    artifactPath: input.routingRecordPath,
  });

  return {
    currentStage: resolved.focus?.currentStage ?? null,
    currentHeadPath: resolved.focus?.currentHead?.artifactPath ?? null,
  };
}

export function buildOperationalArchitectureImprovementCandidatesReport(input: {
  directiveRoot: string;
}): OperationalArchitectureImprovementCandidatesReport {
  const directiveRoot = normalizePath(input.directiveRoot);
  const snapshotAt = new Date().toISOString();
  const executionEvidence = buildRuntimeCallableExecutionEvidenceReport({
    directiveRoot,
  });
  const candidates: OperationalArchitectureImprovementCandidate[] = [];

  const topFailure = executionEvidence.failurePatterns[0] ?? null;
  if (topFailure) {
    const linkedArtifacts = buildCaseLinkedArtifacts();
    const routingState = resolveRoutingState(directiveRoot, linkedArtifacts);
    const currentState = resolveCurrentState({
      directiveRoot,
      routingRecordPath: linkedArtifacts.routingRecordPath,
    });

    candidates.push({
      candidateId: RUNTIME_CALLABLE_INPUT_BOUNDARY_CANDIDATE_ID,
      candidateName: RUNTIME_CALLABLE_INPUT_BOUNDARY_CANDIDATE_NAME,
      sourceType: "internal-signal",
      routeTarget: "architecture",
      signalKind: "runtime_callable_execution_failure_pattern",
      selfImprovementCategory: "evaluation_quality",
      evidenceRecordPath: topFailure.recordPath,
      evidenceReportPath: topFailure.recordPath.replace(/\.json$/u, ".md"),
      evidenceSummary:
        `Runtime callable execution evidence already shows ${executionEvidence.nonSuccessCount} bounded non-success result(s), with the latest ${topFailure.status} on ${topFailure.capabilityId}.`,
      failureStatus: topFailure.status,
      failureCount: executionEvidence.nonSuccessCount,
      recommendedObjective:
        "Use operational evidence to create Architecture-side evaluation policy and Engine self-improvement for callable input-boundary review, rather than direct runtime reuse.",
      boundedNextAction:
        "Open one bounded Architecture slice that retains the callable failure pattern as Engine evaluation logic and proof guidance rather than direct runtime reuse, without widening Runtime execution, host scope, or automation.",
      expectedProductEffect:
        "Later Engine planning and Architecture review can reuse one canonical input-boundary evaluation policy instead of treating callable failure patterns as ad hoc Runtime follow-up pressure.",
      rollbackBoundary:
        "If the evidence-backed pressure proves too weak, remove the candidate surface and leave the execution records as historical Runtime evidence only.",
      routingState,
      currentStage: currentState.currentStage,
      currentHeadPath: currentState.currentHeadPath,
      linkedArtifacts,
    });
  }

  return {
    ok: true,
    checkerId: OPERATIONAL_ARCHITECTURE_IMPROVEMENT_CHECKER_ID,
    snapshotAt,
    sourceEvidenceCheckerId: executionEvidence.checkerId,
    totalCandidates: candidates.length,
    topCandidate: candidates[0] ?? null,
    candidates,
  };
}

