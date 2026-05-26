import { readDirectiveDiscoveryRoutingArtifact } from "../../discovery/lib/routing/route-opener.ts";
import { readDiscoveryRoutingReviewResolution } from "../../discovery/lib/routing/review-resolution.ts";
import {
  fileExistsInDirectiveWorkspace,
  isDirectiveWorkspaceArtifactReference,
  readLinkedArtifactIfPresent,
  recordExpectedArtifactIfMissing,
  recordInconsistentLink,
  recordMissingLinkedArtifactIfAbsent,
} from "../artifact-link-validation.ts";
import type { WorkspaceResolvedFocus } from "./resolve-workspace-state.ts";
import {
  finalizeResolvedFocus,
  findLatestEngineRunByCandidateId,
  findQueueEntryByCandidateId,
  isDiscoveryHeldRouteDestination,
  mergeNonNullLinkedArtifacts,
  readGenericDiscoveryMonitorArtifact,
  resolveDirectiveRelativePath,
  zeroLinkedArtifacts,
} from "./shared-state-helpers.ts";

function isNoteOperatingMode(operatingMode: string | null | undefined) {
  return String(operatingMode ?? "").trim().toLowerCase() === "note";
}

function getArchitectureRouteBoundaryNextLegalStep(operatingMode: string | null | undefined) {
  return isNoteOperatingMode(operatingMode)
    ? "Explicitly review the routed Architecture handoff and record one NOTE-mode bounded result; no bounded start is required."
    : "Explicitly approve the bounded Architecture handoff/start boundary.";
}

function isNoteArchitectureRouteProgressedPastHandoff(input: {
  operatingMode: string | null | undefined;
  routeDestination: string;
  requiredNextArtifact: string;
  downstreamArtifactPath: string | null | undefined;
}) {
  return isNoteOperatingMode(input.operatingMode)
    && input.routeDestination === "architecture"
    && input.requiredNextArtifact.endsWith("-engine-handoff.md")
    && String(input.downstreamArtifactPath ?? "").endsWith("-bounded-result.md");
}

export function resolveDiscoveryFocus(input: {
  directiveRoot: string;
  artifactPath: string;
  readWorkspaceFocus: (artifactPath: string) => WorkspaceResolvedFocus | null;
}) {
  const relativePath = resolveDirectiveRelativePath(input.directiveRoot, input.artifactPath, "artifactPath");
  const routing = readDirectiveDiscoveryRoutingArtifact({
    directiveRoot: input.directiveRoot,
    routingPath: relativePath,
  });
  const queueEntry = findQueueEntryByCandidateId(input.directiveRoot, routing.candidateId);
  const engineRun = findLatestEngineRunByCandidateId(input.directiveRoot, routing.candidateId);
  const reviewResolution = readDiscoveryRoutingReviewResolution({
    directiveRoot: input.directiveRoot,
    routingRecordPath: relativePath,
  });
  const effectiveRouteDestination = reviewResolution?.resolvedRouteDestination ?? routing.routeDestination;
  const effectiveRequiredNextArtifact = routing.effectiveRequiredNextArtifact;
  const linkedArtifacts = zeroLinkedArtifacts();
  linkedArtifacts.discoveryIntakePath = routing.linkedIntakeRecord;
  linkedArtifacts.discoveryTriagePath = routing.linkedTriageRecord;
  linkedArtifacts.discoveryRoutingPath = routing.routingRelativePath;
  linkedArtifacts.discoveryRoutingReviewResolutionPath = reviewResolution?.reviewResolutionPath ?? null;
  linkedArtifacts.engineRunRecordPath = routing.engineRunRecordPath;
  linkedArtifacts.engineRunReportPath = routing.engineRunReportPath;

  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: routing.linkedIntakeRecord,
    label: "Discovery intake record",
  });
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: routing.linkedTriageRecord,
    label: "Discovery triage record",
  });
  recordExpectedArtifactIfMissing({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: effectiveRequiredNextArtifact,
  });
  const requiredNextArtifactIsConcrete = isDirectiveWorkspaceArtifactReference(effectiveRequiredNextArtifact);
  const requiredNextArtifactExists =
    requiredNextArtifactIsConcrete
    && fileExistsInDirectiveWorkspace(input.directiveRoot, effectiveRequiredNextArtifact);
  if (requiredNextArtifactIsConcrete && !routing.downstreamStubRelativePath && !requiredNextArtifactExists) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing required downstream artifact for legal next step: ${effectiveRequiredNextArtifact}`,
    );
  }
  if (queueEntry?.routing_target && queueEntry.routing_target !== effectiveRouteDestination) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `queue routing target "${queueEntry.routing_target}" does not match Discovery route "${effectiveRouteDestination}"`,
    );
  }
  const documentsOperatorOverride =
    /operator override/i.test(routing.whyThisRoute)
    && queueEntry?.routing_target === effectiveRouteDestination;
  const engineSelectionMatchesDiscoveryHeldRoute =
    engineRun?.record.selectedLane?.laneId === "discovery"
    && isDiscoveryHeldRouteDestination(effectiveRouteDestination);

  let downstream: WorkspaceResolvedFocus | null = null;
  const discoveryHeldDownstreamPath =
    !routing.downstreamStubRelativePath
      && effectiveRouteDestination === "monitor"
      && queueEntry?.result_record_path?.startsWith("discovery/04-monitor/")
      ? queueEntry.result_record_path
      : null;
  const downstreamResolutionPath = routing.downstreamStubRelativePath ?? discoveryHeldDownstreamPath;
  if (downstreamResolutionPath) {
    try {
      downstream = input.readWorkspaceFocus(downstreamResolutionPath);
    } catch (error) {
      downstream = null;
      const message = error instanceof Error ? error.message : "unknown downstream resolution failure";
      recordInconsistentLink(
        { missingExpectedArtifacts, inconsistentLinks },
        `unable to resolve downstream artifact "${downstreamResolutionPath}": ${message}`,
      );
    }
  }
  const downstreamMatchesDiscoveryHeldRoute =
    downstream?.lane === "discovery"
    && isDiscoveryHeldRouteDestination(effectiveRouteDestination);
  if (downstream && downstream.lane !== effectiveRouteDestination && !downstreamMatchesDiscoveryHeldRoute) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `downstream artifact lane "${downstream.lane}" does not match Discovery route "${effectiveRouteDestination}"`,
    );
  }
  const routeSupersedesEngineSelection =
    Boolean(
      engineRun?.record.selectedLane?.laneId
      && engineRun.record.selectedLane.laneId !== effectiveRouteDestination
      && downstream?.lane === effectiveRouteDestination
      && queueEntry?.routing_target === effectiveRouteDestination,
    );
  if (
    engineRun?.record.selectedLane?.laneId
    && engineRun.record.selectedLane.laneId !== effectiveRouteDestination
    && !engineSelectionMatchesDiscoveryHeldRoute
    && !documentsOperatorOverride
    && !routeSupersedesEngineSelection
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `Engine selected lane "${engineRun.record.selectedLane.laneId}" does not match Discovery route "${effectiveRouteDestination}"`,
    );
  }
  if (
    requiredNextArtifactIsConcrete
    && routing.downstreamStubRelativePath
    && effectiveRequiredNextArtifact !== routing.downstreamStubRelativePath
    && !isNoteArchitectureRouteProgressedPastHandoff({
      operatingMode: queueEntry?.operating_mode ?? null,
      routeDestination: effectiveRouteDestination,
      requiredNextArtifact: effectiveRequiredNextArtifact,
      downstreamArtifactPath: routing.downstreamStubRelativePath,
    })
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `required downstream artifact "${effectiveRequiredNextArtifact}" does not match resolved downstream stub "${routing.downstreamStubRelativePath}"`,
    );
  }

  const currentStage = downstream?.currentStage ?? `discovery.route.${effectiveRouteDestination}`;
  const nextLegalStep = downstream?.nextLegalStep
    ?? (effectiveRouteDestination === "architecture"
      ? getArchitectureRouteBoundaryNextLegalStep(queueEntry?.operating_mode ?? null)
      : effectiveRouteDestination === "runtime"
        ? "Explicitly approve the bounded Runtime follow-up boundary."
        : "Keep the source in Discovery until the adoption target becomes clearer.");

  mergeNonNullLinkedArtifacts(linkedArtifacts, downstream?.linkedArtifacts);

  return finalizeResolvedFocus({
    ok: true,
    directiveRoot: input.directiveRoot,
    artifactPath: relativePath,
    artifactKind: "discovery_routing_record" as const,
    lane: "discovery" as const,
    candidateId: routing.candidateId,
    candidateName: routing.candidateName,
    artifactStage: `discovery.route.${effectiveRouteDestination}`,
    artifactNextLegalStep:
      effectiveRouteDestination === "architecture"
        ? getArchitectureRouteBoundaryNextLegalStep(queueEntry?.operating_mode ?? null)
        : effectiveRouteDestination === "runtime"
          ? "Explicitly approve the bounded Runtime follow-up boundary."
          : "Keep the source in Discovery until the adoption target becomes clearer.",
    currentStage,
    nextLegalStep,
    routeTarget: effectiveRouteDestination,
    statusGate: routing.decisionState,
    missingExpectedArtifacts,
    inconsistentLinks,
    intentionallyUnbuiltDownstreamStages: [
      "automatic downstream advancement",
      "runtime execution",
      "lifecycle orchestration",
    ],
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
      routingDecision: routing.decisionState,
      usefulnessLevel: routing.usefulnessLevel,
      usefulnessRationale: routing.usefulnessRationale,
      requiredNextArtifact: effectiveRequiredNextArtifact,
    },
    engine: {
      runId: engineRun?.record.runId ?? routing.engineRunId,
      selectedLane: routeSupersedesEngineSelection
        ? effectiveRouteDestination
        : engineRun?.record.selectedLane?.laneId ?? effectiveRouteDestination,
      decisionState: routeSupersedesEngineSelection
        ? routing.decisionState
        : engineRun?.record.decision?.decisionState ?? routing.decisionState,
      proofKind: routeSupersedesEngineSelection
        ? null
        : engineRun?.record.proofPlan?.proofKind ?? null,
      nextAction: routeSupersedesEngineSelection
        ? effectiveRequiredNextArtifact
        : engineRun?.record.integrationProposal?.nextAction ?? null,
    },
  } satisfies Omit<WorkspaceResolvedFocus, "integrityState" | "currentHead">);
}

export function resolveDiscoveryMonitorFocus(input: {
  directiveRoot: string;
  artifactPath: string;
}) {
  const monitor = readGenericDiscoveryMonitorArtifact({
    directiveRoot: input.directiveRoot,
    monitorPath: input.artifactPath,
  });
  const queueEntry = findQueueEntryByCandidateId(input.directiveRoot, monitor.candidateId);
  const engineRun = findLatestEngineRunByCandidateId(input.directiveRoot, monitor.candidateId);
  const routingArtifact = readLinkedArtifactIfPresent({
    directiveRoot: input.directiveRoot,
    relativePath: monitor.linkedRoutingRecord,
    read: (routingPath) => readDirectiveDiscoveryRoutingArtifact({
      directiveRoot: input.directiveRoot,
      routingPath,
    }),
  });

  const linkedArtifacts = zeroLinkedArtifacts();
  linkedArtifacts.discoveryMonitorPath = monitor.monitorRelativePath;
  linkedArtifacts.discoveryIntakePath = monitor.linkedIntakeRecord;
  linkedArtifacts.discoveryTriagePath = monitor.linkedTriageRecord;
  linkedArtifacts.discoveryRoutingPath = monitor.linkedRoutingRecord;
  linkedArtifacts.engineRunRecordPath = engineRun?.recordRelativePath ?? null;
  linkedArtifacts.engineRunReportPath = engineRun?.reportRelativePath ?? null;

  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: monitor.linkedIntakeRecord,
    label: "Discovery intake record",
  });
  if (monitor.linkedTriageRecord) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath: monitor.linkedTriageRecord,
      label: "Discovery triage record",
    });
  }
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: monitor.linkedRoutingRecord,
    label: "Discovery routing record",
  });

  if (queueEntry?.routing_target && queueEntry.routing_target !== "monitor") {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `queue routing target "${queueEntry.routing_target}" does not match Discovery monitor state`,
    );
  }
  if (queueEntry?.result_record_path && queueEntry.result_record_path !== monitor.monitorRelativePath) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `queue result record "${queueEntry.result_record_path}" does not match Discovery monitor artifact "${monitor.monitorRelativePath}"`,
    );
  }
  if (engineRun?.record.selectedLane?.laneId && engineRun.record.selectedLane.laneId !== "discovery") {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `Engine selected lane "${engineRun.record.selectedLane.laneId}" does not match Discovery monitor state`,
    );
  }
  if (routingArtifact?.routeDestination && routingArtifact.routeDestination !== "monitor") {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `linked Discovery route "${routingArtifact.routeDestination}" does not match monitor artifact`,
    );
  }

  return finalizeResolvedFocus({
    ok: true,
    directiveRoot: input.directiveRoot,
    artifactPath: monitor.monitorRelativePath,
    artifactKind: "discovery_monitor_record" as const,
    lane: "discovery" as const,
    candidateId: monitor.candidateId,
    candidateName: monitor.candidateName,
    artifactStage: "discovery.monitor.active",
    artifactNextLegalStep:
      "Keep the source in Discovery monitor until a later explicit reroute decision is justified.",
    currentStage: "discovery.monitor.active",
    nextLegalStep:
      "Keep the source in Discovery monitor until a later explicit reroute decision is justified.",
    routeTarget: "monitor",
    statusGate: monitor.currentDecisionState,
    missingExpectedArtifacts,
    inconsistentLinks,
    intentionallyUnbuiltDownstreamStages: [
      "automatic downstream advancement",
      "runtime execution",
      "lifecycle orchestration",
    ],
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
      routingDecision: routingArtifact?.decisionState ?? "monitor",
      usefulnessLevel: routingArtifact?.usefulnessLevel ?? engineRun?.record.candidate.usefulnessLevel ?? null,
      usefulnessRationale:
        routingArtifact?.usefulnessRationale
        ?? engineRun?.record.analysis.usefulnessRationale
        ?? monitor.whyKeptInMonitor,
      requiredNextArtifact: queueEntry?.result_record_path ?? monitor.monitorRelativePath,
    },
    engine: {
      runId: engineRun?.record.runId ?? null,
      selectedLane: engineRun?.record.selectedLane?.laneId ?? null,
      decisionState: engineRun?.record.decision?.decisionState ?? null,
      proofKind: engineRun?.record.proofPlan?.proofKind ?? null,
      nextAction: engineRun?.record.integrationProposal?.nextAction ?? null,
    },
  } satisfies Omit<WorkspaceResolvedFocus, "integrityState" | "currentHead">);
}
