import { readDirectiveDiscoveryRoutingArtifact } from "../../discovery/lib/routing/route-opener.ts";
import {
  resolveDiscoveryFocus,
  resolveDiscoveryMonitorFocus,
} from "./discovery-state.ts";
import {
  getDefaultDirectiveWorkspaceRoot,
  listFiles,
  normalizePath,
  resolveDirectiveRelativePath,
} from "./shared-state-helpers.ts";
import {
  readEngineRunsOverview,
} from "../execution/run-artifacts.ts";
import { buildWorkspaceProductTruth } from "../workspace-truth.ts";
import {
  ARCHITECTURE_DEEP_TAIL_STAGE,
} from "../../architecture/lib/control/materialization-tail-stage-map.ts";
import {
  resolveArchitectureWorkspaceFocus,
  resolveEngineFocus,
  resolveRuntimeWorkspaceFocus,
} from "./focus-builders.ts";
export type WorkspaceFocusLane =
  | "discovery"
  | "engine"
  | "architecture"
  | "runtime"
  | "unknown";

export type WorkspaceArtifactKind =
  | "discovery_routing_record"
  | "discovery_monitor_record"
  | "engine_run"
  | "architecture_handoff"
  | "architecture_bounded_start"
  | "architecture_bounded_result"
  | "architecture_adoption"
  | "architecture_implementation_target"
  | "architecture_implementation_result"
  | "architecture_retained"
  | "architecture_integration_record"
  | "architecture_consumption_record"
  | "architecture_post_consumption_evaluation"
  | "runtime_follow_up"
  | "runtime_follow_up_legacy"
  | "runtime_handoff_legacy"
  | "runtime_record_legacy"
  | "runtime_slice_proof_legacy"
  | "runtime_slice_execution_legacy"
  | "runtime_proof_checklist_legacy"
  | "runtime_live_fetch_proof_legacy"
  | "runtime_live_fetch_gate_snapshot_legacy"
  | "runtime_live_pool_artifact_legacy"
  | "runtime_sample_pool_artifact_legacy"
  | "runtime_system_bundle_note_legacy"
  | "runtime_validation_note_legacy"
  | "runtime_precondition_decision_note_legacy"
  | "runtime_transformation_record_legacy"
  | "runtime_transformation_proof_legacy"
  | "runtime_registry_legacy"
  | "runtime_registry_accepted"
  | "runtime_promotion_record_legacy"
  | "runtime_record_follow_up_review"
  | "runtime_record_callable_integration"
  | "runtime_proof_follow_up_review"
  | "runtime_proof_callable_integration"
  | "runtime_runtime_capability_boundary"
  | "runtime_promotion_readiness"
  | "runtime_promotion_record"
  | "runtime_callable_integration"
  | "unknown";

export type WorkspaceLinkedArtifacts = {
  discoveryIntakePath: string | null;
  discoveryTriagePath: string | null;
  discoveryRoutingPath: string | null;
  discoveryRoutingReviewResolutionPath: string | null;
  discoveryMonitorPath: string | null;
  engineRunRecordPath: string | null;
  engineRunReportPath: string | null;
  architectureHandoffPath: string | null;
  architectureBoundedStartPath: string | null;
  architectureBoundedResultPath: string | null;
  architectureContinuationStartPath: string | null;
  architectureAdoptionPath: string | null;
  architectureImplementationTargetPath: string | null;
  architectureImplementationResultPath: string | null;
  architectureRetainedPath: string | null;
  architectureIntegrationRecordPath: string | null;
  architectureConsumptionRecordPath: string | null;
  architectureEvaluationPath: string | null;
  architectureReopenedStartPath: string | null;
  runtimeFollowUpPath: string | null;
  runtimeRecordPath: string | null;
  runtimeProofPath: string | null;
  runtimeRuntimeCapabilityBoundaryPath: string | null;
  runtimePromotionReadinessPath: string | null;
  runtimePromotionRecordPath: string | null;
  runtimeRegistryEntryPath: string | null;
  runtimePromotionSpecificationPath: string | null;
  runtimeHostSelectionResolutionPath: string | null;
  runtimeCallableStubPath: string | null;
  runtimeCallableStatus?: "callable" | "not_implemented" | null;
  runtimeHostConsumptionReportPath: string | null;
};

export type WorkspaceCurrentHead = {
  artifactPath: string;
  artifactKind: WorkspaceArtifactKind;
  lane: WorkspaceFocusLane;
  artifactStage: string;
};

export type WorkspaceResolvedFocus = {
  ok: true;
  directiveRoot: string;
  artifactPath: string;
  artifactKind: WorkspaceArtifactKind;
  lane: WorkspaceFocusLane;
  candidateId: string | null;
  candidateName: string | null;
  integrityState: "ok" | "broken";
  artifactStage: string;
  artifactNextLegalStep: string;
  currentStage: string;
  nextLegalStep: string;
  routeTarget: string | null;
  statusGate: string | null;
  missingExpectedArtifacts: string[];
  inconsistentLinks: string[];
  intentionallyUnbuiltDownstreamStages: string[];
  currentHead: WorkspaceCurrentHead;
  linkedArtifacts: WorkspaceLinkedArtifacts;
  discovery: {
    queueStatus: string | null;
    operatingMode: string | null;
    submissionOrigin: string | null;
    sourceType: string | null;
    sourceReference: string | null;
    signalBand: string | null;
    signalTotalScore: number | null;
    signalScoreSummary: string | null;
    routingDecision: string | null;
    usefulnessLevel: string | null;
    usefulnessRationale: string | null;
    requiredNextArtifact: string | null;
  };
  engine: {
    runId: string | null;
    selectedLane: string | null;
    decisionState: string | null;
    proofKind: string | null;
    nextAction: string | null;
  };
  runtime?: {
    proposedHost: string | null;
    executionState: string | null;
    promotionReadinessBlockers: string[];
  };
};

export type WorkspaceAnchorSummary = {
  label: string;
  artifactPath: string;
  lane: WorkspaceFocusLane;
  currentStage: string;
  nextLegalStep: string;
  candidateId: string | null;
  candidateName: string | null;
};

export type WorkspaceStateReport = {
  ok: true;
  snapshotAt: string;
  directiveRoot: string;
  product: {
    hierarchy: string[];
    workflow: string[];
    fieldInterpretation: {
      artifactStage: string;
      currentStage: string;
      currentHead: string;
      artifactNextLegalStep: string;
      nextLegalStep: string;
      routeTarget: string;
    };
    proven: string[];
    partiallyBuilt: string[];
    intentionallyMinimal: string[];
    notBuilt: string[];
    forbiddenScopeExpansion: string[];
    legalNextSeams: {
      discovery: string[];
      runtime: string[];
      architecture: string[];
      sharedEngineWholeProduct: string[];
    };
  };
  engine: {
    totalRuns: number;
    latestRunRecordPath: string | null;
    latestRunReportPath: string | null;
    counts: ReturnType<typeof readEngineRunsOverview>["counts"];
  };
  anchors: WorkspaceAnchorSummary[];
  focus: WorkspaceResolvedFocus | null;
};

function buildOverviewAnchors(directiveRoot: string): WorkspaceAnchorSummary[] {
  const candidates: string[] = [];

  const latestArchitectureRoute = listFiles({
    directiveRoot,
    relativeDir: "discovery/routing-log",
    suffix: "-routing-record.md",
  }).find((relativePath) => {
    try {
      const artifact = readDirectiveDiscoveryRoutingArtifact({
        directiveRoot,
        routingPath: relativePath,
      });
      return artifact.routeDestination === "architecture" && artifact.routingDate >= "2026-03-25";
    } catch {
      return false;
    }
  });
  if (latestArchitectureRoute) candidates.push(latestArchitectureRoute);

  const latestRuntimeRoute = listFiles({
    directiveRoot,
    relativeDir: "discovery/routing-log",
    suffix: "-routing-record.md",
  }).find((relativePath) => {
    try {
      const artifact = readDirectiveDiscoveryRoutingArtifact({
        directiveRoot,
        routingPath: relativePath,
      });
      return artifact.routeDestination === "runtime" && artifact.routingDate >= "2026-03-25";
    } catch {
      return false;
    }
  });
  if (latestRuntimeRoute) candidates.push(latestRuntimeRoute);

  const latestArchitectureEvaluation = listFiles({
    directiveRoot,
    relativeDir: ARCHITECTURE_DEEP_TAIL_STAGE.post_consumption_evaluation.relativeDir,
    suffix: ARCHITECTURE_DEEP_TAIL_STAGE.post_consumption_evaluation.artifactSuffix,
  })[0];
  if (latestArchitectureEvaluation) candidates.push(latestArchitectureEvaluation);

  const latestRuntimeProof = listFiles({
    directiveRoot,
    relativeDir: "runtime/03-proof",
    suffix: "-proof.md",
  })[0];
  if (latestRuntimeProof) candidates.push(latestRuntimeProof);

  const latestRuntimeCapabilityBoundary = listFiles({
    directiveRoot,
    relativeDir: "runtime/04-capability-boundaries",
    suffix: "-runtime-capability-boundary.md",
  })[0];
  if (latestRuntimeCapabilityBoundary) candidates.push(latestRuntimeCapabilityBoundary);

  const latestRuntimePromotionReadiness = listFiles({
    directiveRoot,
    relativeDir: "runtime/05-promotion-readiness",
    suffix: "-promotion-readiness.md",
  })[0];
  if (latestRuntimePromotionReadiness) candidates.push(latestRuntimePromotionReadiness);

  return candidates
    .map((artifactPath) => {
      try {
        const focus = resolveDirectiveWorkspaceState({
          directiveRoot,
          artifactPath,
          includeAnchors: false,
        }).focus;
        if (!focus) {
          return null;
        }
        const label =
          focus.lane === "discovery"
            ? `Discovery anchor: ${focus.candidateName ?? focus.artifactPath}`
            : focus.lane === "architecture"
              ? `Architecture anchor: ${focus.candidateName ?? focus.artifactPath}`
              : focus.lane === "runtime"
                ? `Runtime anchor: ${focus.candidateName ?? focus.artifactPath}`
                : `Product anchor: ${focus.artifactPath}`;
        return {
          label,
          artifactPath: focus.artifactPath,
          lane: focus.lane,
          currentStage: focus.currentStage,
          nextLegalStep: focus.nextLegalStep,
          candidateId: focus.candidateId,
          candidateName: focus.candidateName,
        } satisfies WorkspaceAnchorSummary;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is WorkspaceAnchorSummary => Boolean(entry));
}

export function resolveDirectiveWorkspaceState(input: {
  directiveRoot?: string;
  artifactPath?: string | null;
  includeAnchors?: boolean;
} = {}): WorkspaceStateReport {
  const directiveRoot = normalizePath(input.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const snapshotAt = new Date().toISOString();
  const engineOverview = readEngineRunsOverview({
    directiveRoot,
    maxRuns: 8,
  });
  const productTruth = buildWorkspaceProductTruth();

  let focus: WorkspaceResolvedFocus | null = null;
  if (input.artifactPath) {
    const artifactPath = resolveDirectiveRelativePath(directiveRoot, input.artifactPath, "artifactPath");
    if (artifactPath.startsWith("discovery/03-routing-log/")) {
      focus = resolveDiscoveryFocus({
        directiveRoot,
        artifactPath,
        readWorkspaceFocus: (downstreamArtifactPath) =>
          resolveDirectiveWorkspaceState({
            directiveRoot,
            artifactPath: downstreamArtifactPath,
            includeAnchors: false,
          }).focus,
      });
    } else if (artifactPath.startsWith("discovery/04-monitor/")) {
      focus = resolveDiscoveryMonitorFocus({
        directiveRoot,
        artifactPath,
      });
    } else if (artifactPath.startsWith("runtime/host-artifacts/engine-runs/") && artifactPath.endsWith(".json")) {
      focus = resolveEngineFocus({
        directiveRoot,
        artifactPath,
      });
    } else if (artifactPath.startsWith("architecture/")) {
      focus = resolveArchitectureWorkspaceFocus({
        directiveRoot,
        artifactPath,
      });
    } else if (artifactPath.startsWith("runtime/")) {
      focus = resolveRuntimeWorkspaceFocus({
        directiveRoot,
        artifactPath,
      });
    } else {
      throw new Error(`unsupported artifact path: ${artifactPath}`);
    }
  }

  return {
    ok: true,
    snapshotAt,
    directiveRoot,
    product: {
      hierarchy: productTruth.hierarchy,
      workflow: productTruth.workflow,
      fieldInterpretation: productTruth.fieldInterpretation,
      proven: productTruth.proven,
      partiallyBuilt: productTruth.partiallyBuilt,
      intentionallyMinimal: productTruth.intentionallyMinimal,
      notBuilt: productTruth.notBuilt,
      forbiddenScopeExpansion: productTruth.forbiddenScopeExpansion,
      legalNextSeams: productTruth.legalNextSeams,
    },
    engine: {
      totalRuns: engineOverview.totalRuns,
      latestRunRecordPath: engineOverview.latest.recordPath,
      latestRunReportPath: engineOverview.latest.reportPath,
      counts: engineOverview.counts,
    },
    anchors: input.includeAnchors === false ? [] : buildOverviewAnchors(directiveRoot),
    focus,
  };
}
