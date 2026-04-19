import path from "node:path";

import { readDirectiveDiscoveryRoutingArtifact } from "../../discovery/lib/discovery-route-opener.ts";
import {
  type StoredDirectiveEngineRunRecord,
} from "../execution/engine-run-artifacts.ts";
import {
  readLinkedArtifactIfPresent,
  recordMissingLinkedArtifactIfAbsent,
} from "../artifact-link-validation.ts";
import {
  buildArchitectureArtifactStage,
  resolveArchitectureFocusFromAnyPath,
} from "./architecture-state.ts";
import {
  buildRuntimeArtifactStage,
  buildRuntimePromotionReadinessBlockers,
  resolveRuntimeFocusFromAnyPath,
} from "./runtime-focus.ts";
import {
  finalizeResolvedFocus,
  findLatestEngineRunByCandidateId,
  findQueueEntryByCandidateId,
  readUtf8,
  resolveDirectiveRelativePath,
  zeroLinkedArtifacts,
} from "./shared-state-helpers.ts";
import type { DirectiveWorkspaceResolvedFocus } from "./resolve-directive-workspace-state.ts";

export function resolveEngineFocus(input: {
  directiveRoot: string;
  artifactPath: string;
}): DirectiveWorkspaceResolvedFocus {
  const relativePath = resolveDirectiveRelativePath(input.directiveRoot, input.artifactPath, "artifactPath");
  const absolutePath = path.join(input.directiveRoot, relativePath);
  const record = JSON.parse(readUtf8(absolutePath)) as StoredDirectiveEngineRunRecord;
  const queueEntry = findQueueEntryByCandidateId(input.directiveRoot, record.candidate.candidateId);
  const reportPath = relativePath.replace(/\.json$/i, ".md");

  const linkedArtifacts = zeroLinkedArtifacts();
  linkedArtifacts.engineRunRecordPath = relativePath;
  linkedArtifacts.engineRunReportPath = reportPath;
  linkedArtifacts.discoveryIntakePath = queueEntry?.intake_record_path ?? null;
  linkedArtifacts.discoveryRoutingPath = queueEntry?.routing_record_path ?? null;

  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: linkedArtifacts.engineRunReportPath,
    label: "Engine run report artifact",
  });
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: linkedArtifacts.discoveryIntakePath,
    label: "Discovery intake record",
  });
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: linkedArtifacts.discoveryRoutingPath,
    label: "Discovery routing record",
  });

  return finalizeResolvedFocus({
    ok: true,
    directiveRoot: input.directiveRoot,
    artifactPath: relativePath,
    artifactKind: "engine_run",
    lane: "engine",
    candidateId: record.candidate.candidateId,
    candidateName: record.candidate.candidateName,
    artifactStage: `engine.route.${record.selectedLane.laneId}`,
    artifactNextLegalStep: "Inspect the Discovery routing record and only then explicitly approve the next bounded downstream stub.",
    currentStage: `engine.route.${record.selectedLane.laneId}`,
    nextLegalStep: "Inspect the Discovery routing record and only then explicitly approve the next bounded downstream stub.",
    routeTarget: record.selectedLane.laneId,
    statusGate: record.decision.decisionState,
    missingExpectedArtifacts,
    inconsistentLinks,
    intentionallyUnbuiltDownstreamStages: [
      "automatic downstream advancement",
      "runtime execution",
    ],
    linkedArtifacts,
    discovery: {
      queueStatus: queueEntry?.status ?? null,
      operatingMode: queueEntry?.operating_mode ?? null,
      submissionOrigin: queueEntry?.submission_origin ?? null,
      sourceType: queueEntry?.source_type ?? record.source.sourceType,
      sourceReference: queueEntry?.source_reference ?? record.source.sourceRef,
      signalBand: queueEntry?.discovery_signal_band ?? null,
      signalTotalScore: queueEntry?.signal_total_score ?? null,
      signalScoreSummary: queueEntry?.signal_score_summary ?? null,
      routingDecision: queueEntry?.routing_target ?? null,
      usefulnessLevel: record.candidate.usefulnessLevel,
      usefulnessRationale: record.analysis.usefulnessRationale,
      requiredNextArtifact: queueEntry?.result_record_path ?? null,
    },
    engine: {
      runId: record.runId,
      selectedLane: record.selectedLane.laneId,
      decisionState: record.decision.decisionState,
      proofKind: record.proofPlan.proofKind,
      nextAction: record.integrationProposal.nextAction,
    },
  });
}

export function resolveArchitectureWorkspaceFocus(input: {
  directiveRoot: string;
  artifactPath: string;
}): DirectiveWorkspaceResolvedFocus {
  const architecture = resolveArchitectureFocusFromAnyPath({
    directiveRoot: input.directiveRoot,
    artifactPath: input.artifactPath,
  });
  const queueEntry = findQueueEntryByCandidateId(input.directiveRoot, architecture.candidateId);
  const architectureArtifactStage = buildArchitectureArtifactStage({
    artifactKind: architecture.artifactKind,
    operatingMode: queueEntry?.operating_mode ?? null,
    result: architecture.result ?? null,
    adoption: architecture.adoption ?? null,
    implementationResult: architecture.implementationResult ?? null,
    consumption: architecture.consumption ?? null,
    evaluation: architecture.evaluation ?? null,
  });
  const engineRun = findLatestEngineRunByCandidateId(input.directiveRoot, architecture.candidateId);
  const linkedArtifacts = architecture.linked;
  linkedArtifacts.discoveryIntakePath = queueEntry?.intake_record_path ?? null;
  linkedArtifacts.discoveryRoutingPath = queueEntry?.routing_record_path ?? linkedArtifacts.discoveryRoutingPath;
  const routingArtifact = linkedArtifacts.discoveryRoutingPath
    ? readLinkedArtifactIfPresent({
        directiveRoot: input.directiveRoot,
        relativePath: linkedArtifacts.discoveryRoutingPath,
        read: (routingPath) => readDirectiveDiscoveryRoutingArtifact({
          directiveRoot: input.directiveRoot,
          routingPath,
        }),
      })
    : null;
  linkedArtifacts.discoveryIntakePath =
    linkedArtifacts.discoveryIntakePath
    ?? routingArtifact?.linkedIntakeRecord
    ?? null;
  linkedArtifacts.discoveryTriagePath =
    routingArtifact?.linkedTriageRecord
    ?? linkedArtifacts.discoveryTriagePath;
  linkedArtifacts.engineRunRecordPath = engineRun?.recordRelativePath ?? null;
  linkedArtifacts.engineRunReportPath = engineRun?.reportRelativePath ?? null;

  return finalizeResolvedFocus({
    ok: true,
    directiveRoot: input.directiveRoot,
    artifactPath: input.artifactPath,
    artifactKind: architecture.artifactKind,
    lane: "architecture",
    candidateId: architecture.candidateId,
    candidateName: architecture.candidateName,
    artifactStage: architectureArtifactStage.artifactStage,
    artifactNextLegalStep: architectureArtifactStage.artifactNextLegalStep,
    currentStage: architecture.currentStage,
    nextLegalStep: architecture.nextLegalStep,
    routeTarget: queueEntry?.routing_target ?? null,
    statusGate: architecture.currentStage,
    missingExpectedArtifacts: architecture.missingExpectedArtifacts,
    inconsistentLinks: architecture.inconsistentLinks,
    intentionallyUnbuiltDownstreamStages: architecture.intentionallyUnbuiltDownstreamStages,
    linkedArtifacts,
    discovery: {
      queueStatus: queueEntry?.status ?? null,
      operatingMode: queueEntry?.operating_mode ?? null,
      submissionOrigin: queueEntry?.submission_origin ?? null,
      sourceType: queueEntry?.source_type ?? null,
      sourceReference: queueEntry?.source_reference ?? null,
      signalBand: queueEntry?.discovery_signal_band ?? null,
      signalTotalScore: queueEntry?.signal_total_score ?? null,
      signalScoreSummary: queueEntry?.signal_score_summary ?? null,
      routingDecision: routingArtifact?.routeDestination ?? queueEntry?.routing_target ?? null,
      usefulnessLevel: routingArtifact?.usefulnessLevel ?? engineRun?.record.candidate.usefulnessLevel ?? null,
      usefulnessRationale:
        routingArtifact?.usefulnessRationale
        ?? engineRun?.record.analysis.usefulnessRationale
        ?? null,
      requiredNextArtifact: routingArtifact?.requiredNextArtifact ?? queueEntry?.result_record_path ?? null,
    },
    engine: {
      runId: engineRun?.record.runId ?? null,
      selectedLane: engineRun?.record.selectedLane?.laneId ?? null,
      decisionState: engineRun?.record.decision?.decisionState ?? null,
      proofKind: engineRun?.record.proofPlan?.proofKind ?? null,
      nextAction: engineRun?.record.integrationProposal?.nextAction ?? null,
    },
  });
}

export function resolveRuntimeWorkspaceFocus(input: {
  directiveRoot: string;
  artifactPath: string;
}): DirectiveWorkspaceResolvedFocus {
  const runtime = resolveRuntimeFocusFromAnyPath({
    directiveRoot: input.directiveRoot,
    artifactPath: input.artifactPath,
  });
  const runtimeArtifactStage = buildRuntimeArtifactStage({
    directiveRoot: input.directiveRoot,
    artifactKind: runtime.artifactKind,
    legacyFollowUp: runtime.legacyFollowUp ?? null,
    legacyHandoff: runtime.legacyHandoff ?? null,
    legacyRuntimeRecord: runtime.legacyRuntimeRecord ?? null,
    legacyRuntimeSliceProof: runtime.legacyRuntimeSliceProof ?? null,
    legacyRuntimeSliceExecution: runtime.legacyRuntimeSliceExecution ?? null,
    legacyRuntimeProofChecklist: runtime.legacyRuntimeProofChecklist ?? null,
    legacyRuntimeLiveFetchProof: runtime.legacyRuntimeLiveFetchProof ?? null,
    legacyRuntimeLiveFetchGateSnapshot: runtime.legacyRuntimeLiveFetchGateSnapshot ?? null,
    legacyRuntimeLivePoolArtifact: runtime.legacyRuntimeLivePoolArtifact ?? null,
    legacyRuntimeSamplePoolArtifact: runtime.legacyRuntimeSamplePoolArtifact ?? null,
    legacyRuntimeSystemBundleArtifact: runtime.legacyRuntimeSystemBundleArtifact ?? null,
    legacyRuntimeValidationNoteArtifact: runtime.legacyRuntimeValidationNoteArtifact ?? null,
    legacyRuntimePreconditionDecisionNoteArtifact: runtime.legacyRuntimePreconditionDecisionNoteArtifact ?? null,
    legacyRuntimeTransformationRecord: runtime.legacyRuntimeTransformationRecord ?? null,
    legacyRuntimeTransformationProof: runtime.legacyRuntimeTransformationProof ?? null,
    legacyRuntimeRegistry: runtime.legacyRuntimeRegistry ?? null,
    legacyRuntimePromotionRecord: runtime.legacyRuntimePromotionRecord ?? null,
    promotionRecord: runtime.promotionRecord ?? null,
    runtimeRecord: runtime.runtimeRecord ?? null,
    runtimeProof: runtime.runtimeProof ?? null,
    capabilityBoundary: runtime.capabilityBoundary ?? null,
    callableIntegration: runtime.callableIntegration ?? null,
  });
  const queueEntry = findQueueEntryByCandidateId(input.directiveRoot, runtime.candidateId);
  const engineRun = findLatestEngineRunByCandidateId(input.directiveRoot, runtime.candidateId);
  const linkedArtifacts = runtime.linked;
  linkedArtifacts.discoveryIntakePath = queueEntry?.intake_record_path ?? null;
  linkedArtifacts.discoveryRoutingPath = queueEntry?.routing_record_path ?? linkedArtifacts.discoveryRoutingPath;
  linkedArtifacts.engineRunRecordPath = engineRun?.recordRelativePath ?? null;
  linkedArtifacts.engineRunReportPath = engineRun?.reportRelativePath ?? null;

  return finalizeResolvedFocus({
    ok: true,
    directiveRoot: input.directiveRoot,
    artifactPath: input.artifactPath,
    artifactKind: runtime.artifactKind,
    lane: "runtime",
    candidateId: runtime.candidateId,
    candidateName: runtime.candidateName,
    artifactStage: runtimeArtifactStage.artifactStage,
    artifactNextLegalStep: runtimeArtifactStage.artifactNextLegalStep,
    currentStage: runtime.currentStage,
    nextLegalStep: runtime.nextLegalStep,
    routeTarget: queueEntry?.routing_target ?? (runtime.linked.discoveryRoutingPath ? "runtime" : null),
    statusGate: runtime.currentStage,
    missingExpectedArtifacts: runtime.missingExpectedArtifacts,
    inconsistentLinks: runtime.inconsistentLinks,
    intentionallyUnbuiltDownstreamStages: runtime.intentionallyUnbuiltDownstreamStages,
    linkedArtifacts,
    discovery: {
      queueStatus: queueEntry?.status ?? null,
      operatingMode: queueEntry?.operating_mode ?? null,
      submissionOrigin: queueEntry?.submission_origin ?? null,
      sourceType: queueEntry?.source_type ?? null,
      sourceReference: queueEntry?.source_reference ?? null,
      signalBand: queueEntry?.discovery_signal_band ?? null,
      signalTotalScore: queueEntry?.signal_total_score ?? null,
      signalScoreSummary: queueEntry?.signal_score_summary ?? null,
      routingDecision: queueEntry?.routing_target ?? null,
      usefulnessLevel: engineRun?.record.candidate.usefulnessLevel ?? null,
      usefulnessRationale: engineRun?.record.analysis.usefulnessRationale ?? null,
      requiredNextArtifact: queueEntry?.result_record_path ?? null,
    },
    engine: {
      runId: engineRun?.record.runId ?? null,
      selectedLane: engineRun?.record.selectedLane?.laneId ?? null,
      decisionState: engineRun?.record.decision?.decisionState ?? null,
      proofKind: engineRun?.record.proofPlan?.proofKind ?? null,
      nextAction: engineRun?.record.integrationProposal?.nextAction ?? null,
    },
    runtime: {
      proposedHost: runtime.promotionReadiness?.proposedHost ?? runtime.legacyProposedHost ?? null,
      executionState: runtime.linked.runtimeRegistryEntryPath
        ? "bounded Runtime registry acceptance proven through the manual registry gate; promotion automation remains closed"
        : runtime.linked.runtimeHostConsumptionReportPath
          ? "bounded standalone-host callable consumption proven through the shared Runtime executor; one promoted host path is now real while registry acceptance and promotion automation remain closed"
          : runtime.promotionReadiness?.executionState ?? null,
      promotionReadinessBlockers: buildRuntimePromotionReadinessBlockers({
        promotionReadiness: runtime.promotionReadiness ?? null,
      }),
    },
  });
}
