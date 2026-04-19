import {
  readDirectiveArchitectureMaterializationDueCheck,
} from "../../../architecture/lib/materialization/architecture-materialization-due-check.ts";
import {
  readDirectiveDiscoveryRoutingArtifact,
} from "../../../discovery/lib/routing/discovery-route-opener.ts";
import {
  readDiscoveryRoutingReviewResolution,
  resolveDiscoveryRoutingReviewResolutionPath,
} from "../../../discovery/lib/routing/discovery-routing-review-resolution.ts";
import {
  buildDirectiveRuntimePromotionAssistanceReport,
} from "../../../runtime/lib/control/runtime-promotion-assistance.ts";
import {
  resolveRuntimeHostSelectionResolutionPath,
} from "../../../runtime/lib/host/runtime-host-selection-resolution.ts";
import {
  buildDirectiveRuntimePromotionAutomationDryRunReport,
  type DirectiveAutonomousRuntimePromotionAutomationPolicy,
} from "../runtime-promotion-automation.ts";
import {
  listMissionFeedbackEntries,
} from "../../mission/mission-feedback-inbox.ts";
import {
  listPendingGapFormalizationCandidates,
} from "../../mission/gap-formalization.ts";
import {
  attachPlanStateSummary,
  listFiles,
} from "./operator-decision-inbox-plan-state.ts";
import type {
  CandidatePlanStateSummary,
  OperatorDecisionInboxEntry,
} from "./operator-decision-inbox-types.ts";

const DISABLED_RUNTIME_AUTOMATION_POLICY: DirectiveAutonomousRuntimePromotionAutomationPolicy = {
  autoHostAdapterDescriptor: false,
  autoHostCallableExecution: false,
  autoWriteRegistryEntry: false,
};

export function buildDiscoveryRoutingReviewEntries(
  directiveRoot: string,
  summaryByCandidateId: Map<string, { summary: CandidatePlanStateSummary; recordPath: string }>,
): OperatorDecisionInboxEntry[] {
  return listFiles({
    directiveRoot,
    relativeDir: "discovery/03-routing-log",
    suffix: "routing-record.md",
  }).flatMap((routingPath) => {
    try {
      const routing = readDirectiveDiscoveryRoutingArtifact({
        directiveRoot,
        routingPath,
      });
      const resolution = readDiscoveryRoutingReviewResolution({
        directiveRoot,
        routingRecordPath: routingPath,
      });
      const requiresReview =
        routing.needsHumanReview === true
        || routing.routeConflict === true
        || (
          routing.routingConfidence !== null
          && routing.routingConfidence !== "high"
          && (routing.routeDestination === "architecture" || routing.routeDestination === "runtime")
        );

      if (!requiresReview || resolution) {
        return [];
      }

      const resolutionPath = resolveDiscoveryRoutingReviewResolutionPath({
        routingRecordPath: routingPath,
      });
      const defaultDecision = routing.routeDestination === "architecture"
        ? "confirm_architecture"
        : routing.routeDestination === "runtime"
        ? "confirm_runtime"
        : "defer";

      return [attachPlanStateSummary({
        entryId: `discovery:${routing.candidateId}:routing_review`,
        actionId: `action:discovery:${routing.candidateId}:routing_review`,
        actionKind: "discovery_routing_review" as const,
        actionExecutable: true,
        actionTargetPath: routingPath,
        defaultDecision,
        priorityHint: "low" as const,
        missionFeedbackId: null,
        gapFormalizationId: null,
        gapFormalizationPriorityHint: null,
        lane: "discovery" as const,
        decisionSurface: "discovery_routing_review" as const,
        candidateId: routing.candidateId,
        candidateName: routing.candidateName,
        currentStage: `discovery.route.${routing.routeDestination}`,
        artifactPath: routingPath,
        blockReason:
          routing.reviewGuidance?.summary
          ?? `routing review required; confidence=${routing.routingConfidence ?? "n/a"}, conflict=${routing.routeConflict === true ? "yes" : "no"}`,
        eligibleNextAction:
          routing.reviewGuidance?.operatorAction
          ?? "Confirm, redirect, reject, or defer the Discovery routing decision explicitly.",
        requiredProof: routing.reviewGuidance?.requiredChecks.length
          ? [...routing.reviewGuidance.requiredChecks]
          : ["review routing confidence", "review route conflict", "preserve original routing record"],
        resolverCommandOrArtifact:
          `Use the operator inbox Discovery review action or POST /api/discovery/resolve-routing-review for "${routingPath}" with decision ${defaultDecision}.`,
        relatedArtifacts: [
          routing.linkedIntakeRecord,
          routing.linkedTriageRecord,
          routing.engineRunRecordPath,
          routing.engineRunReportPath,
          resolutionPath,
        ].filter((entry): entry is string => Boolean(entry)),
        readOnly: true,
        mutatesWorkflowState: false,
        bypassesReview: false,
        stopLine:
          routing.reviewGuidance?.stopLine
          ?? "Do not continue downstream until an explicit Discovery routing review resolution exists.",
      }, summaryByCandidateId)];
    } catch {
      return [];
    }
  });
}

export function buildArchitectureMaterializationEntries(
  directiveRoot: string,
  summaryByCandidateId: Map<string, { summary: CandidatePlanStateSummary; recordPath: string }>,
): OperatorDecisionInboxEntry[] {
  const report = readDirectiveArchitectureMaterializationDueCheck({
    directiveRoot,
  });

  return report.dueItems.map((item) => {
    const isTargetCreation = item.dueKind === "create_implementation_target";
    return attachPlanStateSummary({
      entryId: `architecture:${item.candidateId}:${item.dueKind}`,
      actionId: `action:architecture:${item.candidateId}:${item.dueKind}`,
      actionKind: "architecture_materialization_due" as const,
      actionExecutable: false,
      actionTargetPath: item.currentArtifactPath,
      defaultDecision: null,
      priorityHint: "medium" as const,
      missionFeedbackId: null,
      gapFormalizationId: null,
      gapFormalizationPriorityHint: null,
      lane: "architecture" as const,
      decisionSurface: "architecture_materialization_due" as const,
      candidateId: item.candidateId,
      candidateName: item.candidateName,
      currentStage: isTargetCreation
        ? "architecture.adoption.adopted"
        : "architecture.implementation_target.opened",
      artifactPath: item.currentArtifactPath,
      blockReason: item.rationale,
      eligibleNextAction: item.nextLegalStep,
      requiredProof: [
        `objective: ${item.objective}`,
        `usefulness level: ${item.usefulnessLevel}`,
        `next artifact path: ${item.nextArtifactPath}`,
      ],
      resolverCommandOrArtifact: isTargetCreation
        ? `Use the Architecture adoption detail surface to create the implementation target: /architecture-adoptions/view?path=${encodeURIComponent(item.currentArtifactPath)}`
        : `Use the Architecture implementation-target detail surface to record the implementation result: /architecture-implementation-targets/view?path=${encodeURIComponent(item.currentArtifactPath)}`,
      relatedArtifacts: [
        item.currentArtifactPath,
        item.nextArtifactPath,
      ],
      readOnly: true,
      mutatesWorkflowState: false,
      bypassesReview: false,
      stopLine:
        "The inbox does not create Architecture implementation targets or results; materialization remains an explicit Architecture lane action.",
    }, summaryByCandidateId);
  });
}

export function buildMissionFeedbackInboxEntries(
  directiveRoot: string,
): OperatorDecisionInboxEntry[] {
  return listMissionFeedbackEntries({ directiveRoot }).map((entry) => ({
    entryId: `engine:${entry.feedbackId}:mission_health_feedback`,
    actionId: `action:engine:${entry.feedbackId}:mission_health_feedback`,
    actionKind: "mission_feedback_review" as const,
    actionExecutable: true,
    actionTargetPath: "knowledge/active-mission.md",
    defaultDecision: "preview_then_approve",
    priorityHint: "highest" as const,
    missionFeedbackId: entry.feedbackId,
    gapFormalizationId: null,
    gapFormalizationPriorityHint: null,
    lane: "engine" as const,
    decisionSurface: "mission_health_feedback" as const,
    candidateId: null,
    candidateName: entry.proposedAction,
    currentStage: "engine.mission.feedback",
    artifactPath: "knowledge/active-mission.md",
    blockReason: entry.rationale,
    eligibleNextAction:
      "approve or reject the proposed mission evolution after previewing its routing impact",
    requiredProof: [
      `health grade at generation: ${entry.healthGradeAtGeneration}`,
      ...entry.sourceSignals.map((signal) => `trigger: ${signal}`),
    ],
    resolverCommandOrArtifact:
      `Use the operator inbox mission-feedback actions, POST /api/mission/preview and /api/mission/approve, or run "node --experimental-strip-types ./hosts/standalone-host/cli.ts mission-preview --directive-root \\"${directiveRoot}\\" --feedback-id \\"${entry.feedbackId}\\"" before approving any active-mission change.`,
    relatedArtifacts: [
      "knowledge/active-mission.md",
      "DIRECTIVE_GOAL.md",
      "shared/contracts/mission-evolution.md",
    ],
    readOnly: true,
    mutatesWorkflowState: false,
    bypassesReview: false,
    stopLine:
      "Do not change the active mission without previewing the routing impact and recording operator rationale.",
  }));
}

export function buildGapFormalizationInboxEntries(
  directiveRoot: string,
): OperatorDecisionInboxEntry[] {
  return listPendingGapFormalizationCandidates({ directiveRoot }).map((record) => ({
    entryId: `engine:${record.formalizationId}:gap_formalization_review`,
    actionId: `action:engine:${record.formalizationId}:gap_formalization_review`,
    actionKind: "gap_formalization_review" as const,
    actionExecutable: true,
    actionTargetPath: "engine/gap-radar.json",
    defaultDecision: "approve",
    priorityHint: record.radarConfidence === "high" ? "high" as const : "medium" as const,
    missionFeedbackId: null,
    gapFormalizationId: record.formalizationId,
    gapFormalizationPriorityHint: record.radarConfidence === "high" ? "high" : "medium",
    lane: "engine" as const,
    decisionSurface: "gap_formalization_review" as const,
    candidateId: null,
    candidateName: record.radarSummary,
    currentStage: "engine.gap.formalization",
    artifactPath: "engine/gap-radar.json",
    blockReason: `${record.radarSummary} Evidence count: ${record.radarEvidenceCount}.`,
    eligibleNextAction: "approve or reject the proposed gap formalization explicitly",
    requiredProof: [
      `radar confidence: ${record.radarConfidence}`,
      `recommended change: ${record.radarRecommendedChange}`,
    ],
    resolverCommandOrArtifact:
      `Use the operator inbox gap-formalization actions, POST /api/gaps/approve, or run "node --experimental-strip-types ./hosts/standalone-host/cli.ts gap-approve --directive-root \\"${directiveRoot}\\" --formalization-id \\"${record.formalizationId}\\" --priority ${record.radarConfidence === "high" ? "high" : "medium"} --rationale \\"<operator rationale>\\"" to write the bounded Discovery gap artifact.`,
    relatedArtifacts: [
      "engine/gap-radar.json",
      "discovery/capability-gaps.json",
      "shared/contracts/gap-formalization.md",
    ],
    readOnly: true,
    mutatesWorkflowState: false,
    bypassesReview: false,
    stopLine:
      "Do not hand-edit capability gaps or the Discovery worklist; formalize through the explicit approval path.",
  }));
}

export function buildRuntimeHostSelectionEntries(
  directiveRoot: string,
  summaryByCandidateId: Map<string, { summary: CandidatePlanStateSummary; recordPath: string }>,
): OperatorDecisionInboxEntry[] {
  const report = buildDirectiveRuntimePromotionAssistanceReport({
    directiveRoot,
  });
  return report.recommendations
    .filter((recommendation) => recommendation.recommendedActionKind !== "none")
    .map((recommendation) => {
      const hostSelectionResolutionPath = resolveRuntimeHostSelectionResolutionPath({
        promotionReadinessPath: recommendation.sourcePromotionReadinessPath,
      });
      const isHostSelectionDecision =
        recommendation.recommendedActionKind === "clarify_repo_native_host_target";
      return attachPlanStateSummary({
        entryId: `runtime:${recommendation.candidateId}:${isHostSelectionDecision ? "host_selection" : "promotion_seam_decision"}`,
        actionId: `action:runtime:${recommendation.candidateId}:${isHostSelectionDecision ? "host_selection" : "promotion_seam_decision"}`,
        actionKind: isHostSelectionDecision
          ? "runtime_host_selection" as const
          : "runtime_promotion_seam_decision" as const,
        actionExecutable: true,
        actionTargetPath: recommendation.sourcePromotionReadinessPath,
        defaultDecision: isHostSelectionDecision ? "select_standalone" : "open_promotion_record",
        priorityHint: isHostSelectionDecision ? "highest" as const : "high" as const,
        missionFeedbackId: null,
        gapFormalizationId: null,
        gapFormalizationPriorityHint: null,
        lane: "runtime" as const,
        decisionSurface: isHostSelectionDecision
          ? "runtime_host_selection" as const
          : "runtime_promotion_seam_decision" as const,
        candidateId: recommendation.candidateId,
        candidateName: recommendation.candidateName,
        currentStage: recommendation.currentStage,
        artifactPath: recommendation.sourcePromotionReadinessPath,
        blockReason: recommendation.recommendedActionSummary,
        eligibleNextAction: recommendation.recommendedActionKind,
        requiredProof: [
          ...recommendation.missingPrerequisites.map((entry) => `resolve missing prerequisite: ${entry}`),
          recommendation.supportingArtifacts.promotionSpecificationArtifact,
          recommendation.supportingArtifacts.compileContractArtifact,
        ],
        resolverCommandOrArtifact:
          recommendation.recommendedActionKind === "clarify_repo_native_host_target"
            ? `Use the operator inbox Runtime host-selection action, POST /api/runtime/host-selection-resolutions, or run "node --experimental-strip-types ./hosts/standalone-host/cli.ts runtime-host-selection-resolve --promotion-readiness-path \\"${recommendation.sourcePromotionReadinessPath}\\" --decision select_standalone --rationale \\"<operator rationale>\\"" to create ${hostSelectionResolutionPath}.`
            : `Use the operator inbox Runtime promotion-seam action, POST /api/runtime/promotion-seam-decisions, or run "node --experimental-strip-types ./hosts/standalone-host/cli.ts runtime-promotion-seam-resolve --promotion-readiness-path \\"${recommendation.sourcePromotionReadinessPath}\\" --rationale \\"<operator rationale>\\"" to open the bounded Runtime promotion record from explicit repo-native prerequisites.`,
        relatedArtifacts: [
          recommendation.currentHeadPath,
          recommendation.promotionSpecificationPath,
          recommendation.supportingArtifacts.compileContractArtifact,
          recommendation.supportingArtifacts.parkDecisionArtifact,
          hostSelectionResolutionPath,
        ].filter((entry): entry is string => Boolean(entry)),
        readOnly: true,
        mutatesWorkflowState: false,
        bypassesReview: false,
        stopLine:
          "Do not create promotion records, host adapters, callable execution evidence, or registry entries from the inbox report alone.",
      }, summaryByCandidateId);
    });
}

export function buildRuntimeRegistryAcceptanceEntries(
  directiveRoot: string,
  summaryByCandidateId: Map<string, { summary: CandidatePlanStateSummary; recordPath: string }>,
): OperatorDecisionInboxEntry[] {
  return listFiles({
    directiveRoot,
    relativeDir: "runtime/07-promotion-records",
    suffix: "promotion-record.md",
  }).flatMap((promotionRecordPath) => {
    try {
      const dryRun = buildDirectiveRuntimePromotionAutomationDryRunReport({
        directiveRoot,
        promotionRecordPath,
        policy: DISABLED_RUNTIME_AUTOMATION_POLICY,
        approvedBy: "operator-decision-inbox",
        acceptedAt: "2026-04-08T00:00:00.000Z",
      });

      if (
        dryRun.existingRegistryEntryPath
        || !dryRun.evidenceEligible
        || dryRun.wouldWriteRegistryEntry
      ) {
        return [];
      }

      return [attachPlanStateSummary({
        entryId: `runtime:${dryRun.candidateId ?? promotionRecordPath}:registry_acceptance`,
        actionId: `action:runtime:${dryRun.candidateId ?? promotionRecordPath}:registry_acceptance`,
        actionKind: "runtime_registry_acceptance" as const,
        actionExecutable: true,
        actionTargetPath: promotionRecordPath,
        defaultDecision: "accept_registry_entry",
        priorityHint: "medium" as const,
        missionFeedbackId: null,
        gapFormalizationId: null,
        gapFormalizationPriorityHint: null,
        lane: "runtime" as const,
        decisionSurface: "runtime_registry_acceptance" as const,
        candidateId: dryRun.candidateId,
        candidateName: dryRun.candidateName,
        currentStage: dryRun.currentStage,
        artifactPath: promotionRecordPath,
        blockReason: dryRun.stopReason,
        eligibleNextAction:
          "Review registry acceptance evidence and, if approved, enable/write through the gated registry acceptance path.",
        requiredProof: [
          "promotion record",
          "promotion specification",
          "host adapter proof",
          "Runtime callable execution evidence",
          "rollback path",
        ],
        resolverCommandOrArtifact:
          `Use the operator inbox Runtime registry-acceptance action, POST /api/runtime/registry-acceptance-decisions, or run "node --experimental-strip-types ./hosts/standalone-host/cli.ts runtime-registry-accept --promotion-record-path \\"${promotionRecordPath}\\" --rationale \\"<operator rationale>\\"" to write the gated registry entry only after the proof-backed acceptance gate passes.`,
        relatedArtifacts: [
          dryRun.currentHeadPath,
          dryRun.hostCallableAdapterReportPath,
          dryRun.callableExecutionEvidencePath,
        ].filter((entry): entry is string => Boolean(entry)),
        readOnly: true,
        mutatesWorkflowState: false,
        bypassesReview: false,
        stopLine:
          "The inbox does not write registry entries; registry acceptance remains proof-backed and explicitly gated.",
      }, summaryByCandidateId)];
    } catch {
      return [];
    }
  });
}

export function sortInboxEntries(left: OperatorDecisionInboxEntry, right: OperatorDecisionInboxEntry) {
  const surfacePriority = new Map<OperatorDecisionInboxEntry["decisionSurface"], number>([
    ["mission_health_feedback", 5],
    ["runtime_host_selection", 10],
    ["runtime_promotion_seam_decision", 15],
    ["architecture_materialization_due", 20],
    ["gap_formalization_review", 25],
    ["runtime_registry_acceptance", 30],
    ["discovery_routing_review", 40],
  ]);
  const priorityDelta =
    (surfacePriority.get(left.decisionSurface) ?? 99)
    - (surfacePriority.get(right.decisionSurface) ?? 99);
  if (priorityDelta !== 0) return priorityDelta;
  return left.entryId.localeCompare(right.entryId);
}
