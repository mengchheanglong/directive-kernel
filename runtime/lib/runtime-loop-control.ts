import {
  normalizeAbsolutePath,
} from "../../shared/lib/path-normalization.ts";
import { getDefaultDirectiveWorkspaceRoot } from "../../shared/lib/workspace-root.ts";
import {
  selectNextDirectiveCompletionSlice,
  type DirectiveCompletionSliceSelection,
} from "../../engine/coordination/completion-slice-selector.ts";
import {
  buildDirectiveRuntimePromotionAssistanceReport,
  type DirectiveRuntimePromotionAssistanceRecommendation,
} from "./runtime-promotion-assistance.ts";
import { buildDirectiveReadOnlyLifecycleCoordinationReport } from "../../engine/coordination/read-only-lifecycle-coordination.ts";
import { buildDirectiveBoundedPersistentCoordinationReport } from "../../engine/coordination/bounded-persistent-coordination.ts";

export type DirectiveRuntimeLoopSelectionDomain =
  | "completion"
  | "runtime"
  | "none";

export type DirectiveRuntimeLoopControlReport = {
  ok: boolean;
  checkerId: "runtime_loop_control";
  snapshotAt: string;
  mode: "bounded_manual_followthrough_loop";
  guardrails: {
    mutatesQueueOrStateTruth: false;
    autoAdvancesWorkflow: false;
    bypassesApproval: false;
    impliesLifecycleOrchestration: false;
    impliesHostIntegration: false;
    impliesRuntimeExecution: false;
    impliesPromotionAutomation: false;
  };
  setupReadiness: {
    hasCompletionSelector: true;
    hasRuntimePromotionAssistance: true;
    hasReadOnlyLifecycleCoordination: true;
    hasBoundedPersistentLedger: boolean;
  };
  completionFrontier: {
    selectionState: DirectiveCompletionSliceSelection["selectionState"];
    currentTarget: DirectiveCompletionSliceSelection["currentTarget"];
    reason: string;
    blockedByClosedSeamCount: number;
    selectedSliceId: string | null;
  };
  runtimeQueue: {
    topRecommendation: null | {
      candidateId: string;
      assistanceState: string;
      recommendedActionKind: string;
    };
    summary: {
      totalPromotionReadinessCases: number;
      alreadyPromotedManualCycleCount: number;
      readyForManualPromotionSeamDecisionCount: number;
      blockedPendingHostSelectionCount: number;
      blockedMissingCallableBoundaryCount: number;
      blockedOtherCount: number;
    };
  };
  coordinationContext: {
    topPressureBucket: string | null;
    totalLiveCases: number;
    recommendTaskCount: number;
    parkedCount: number;
    stopCount: number;
  };
  persistenceSignals: {
    staleCaseCount: number;
    cadenceDriftDetected: boolean;
    totalPreviousChecks: number;
    ledgerPath: string;
  };
  loopSelection: {
    loopPossible: boolean;
    selectedDomain: DirectiveRuntimeLoopSelectionDomain;
    authoritySurface: "completion_selector" | "runtime_promotion_assistance" | "none";
    selectedReason: string;
    selectedCompletionSlice: null | {
      sliceId: string;
      phase: string;
      kind: string;
      owningLane: string;
      selectionHint: string;
    };
    selectedCase: null | {
      candidateId: string;
      candidateName: string;
      currentStage: string | null;
      currentHeadPath: string | null;
      recommendedActionKind: string;
      recommendedActionSummary: string;
    };
  };
};

function pickLoopSelection(input: {
  completionSelection: DirectiveCompletionSliceSelection;
  runtimeTopRecommendation: DirectiveRuntimePromotionAssistanceRecommendation | null;
}): DirectiveRuntimeLoopControlReport["loopSelection"] {
  const { completionSelection, runtimeTopRecommendation } = input;

  if (completionSelection.selectionState === "selected" && completionSelection.selectedSlice) {
    return {
      loopPossible: true,
      selectedDomain: "completion",
      authoritySurface: "completion_selector",
      selectedReason:
        "The canonical completion selector has an eligible slice. Follow that slice before outside-ladder Runtime work.",
      selectedCompletionSlice: {
        sliceId: completionSelection.selectedSlice.sliceId,
        phase: completionSelection.selectedSlice.phase,
        kind: completionSelection.selectedSlice.kind,
        owningLane: completionSelection.selectedSlice.owningLane,
        selectionHint: completionSelection.selectedSlice.selectionHint,
      },
      selectedCase: null,
    };
  }

  if (runtimeTopRecommendation && runtimeTopRecommendation.recommendedActionKind !== "none") {
    const selectedReason = completionSelection.selectionState === "complete"
      ? "The completion ladder is already complete, so the top recommendation-first Runtime case is the highest-ROI bounded loop target."
      : "The completion frontier is not currently eligible, so the top recommendation-first Runtime case is the highest-ROI bounded loop target.";

    return {
      loopPossible: true,
      selectedDomain: "runtime",
      authoritySurface: "runtime_promotion_assistance",
      selectedReason,
      selectedCompletionSlice: null,
      selectedCase: {
        candidateId: runtimeTopRecommendation.candidateId,
        candidateName: runtimeTopRecommendation.candidateName,
        currentStage: runtimeTopRecommendation.currentStage,
        currentHeadPath: runtimeTopRecommendation.currentHeadPath,
        recommendedActionKind: runtimeTopRecommendation.recommendedActionKind,
        recommendedActionSummary: runtimeTopRecommendation.recommendedActionSummary,
      },
    };
  }

  return {
    loopPossible: false,
    selectedDomain: "none",
    authoritySurface: "none",
    selectedReason:
      "No eligible completion slice exists and the Runtime assistance surface has no actionable top recommendation.",
    selectedCompletionSlice: null,
    selectedCase: null,
  };
}

export function buildDirectiveRuntimeLoopControlReport(input?: {
  directiveRoot?: string;
  snapshotAt?: string;
}): DirectiveRuntimeLoopControlReport {
  const directiveRoot = normalizeAbsolutePath(
    input?.directiveRoot || getDefaultDirectiveWorkspaceRoot(),
  );
  const snapshotAt = input?.snapshotAt ?? new Date().toISOString();

  const completionSelection = selectNextDirectiveCompletionSlice({
    directiveRoot,
  });
  const runtimeAssistance = buildDirectiveRuntimePromotionAssistanceReport({
    directiveRoot,
    snapshotAt,
  });
  const lifecycleReport = buildDirectiveReadOnlyLifecycleCoordinationReport({
    directiveRoot,
    snapshotAt,
  });
  const persistenceReport = buildDirectiveBoundedPersistentCoordinationReport({
    directiveRoot,
    snapshotAt,
    dryRun: true,
  });

  return {
    ok: true,
    checkerId: "runtime_loop_control",
    snapshotAt,
    mode: "bounded_manual_followthrough_loop",
    guardrails: {
      mutatesQueueOrStateTruth: false,
      autoAdvancesWorkflow: false,
      bypassesApproval: false,
      impliesLifecycleOrchestration: false,
      impliesHostIntegration: false,
      impliesRuntimeExecution: false,
      impliesPromotionAutomation: false,
    },
    setupReadiness: {
      hasCompletionSelector: true,
      hasRuntimePromotionAssistance: true,
      hasReadOnlyLifecycleCoordination: true,
      hasBoundedPersistentLedger: persistenceReport.ledgerEntryCount > 0,
    },
    completionFrontier: {
      selectionState: completionSelection.selectionState,
      currentTarget: completionSelection.currentTarget,
      reason: completionSelection.reason,
      blockedByClosedSeamCount: completionSelection.counts.blockedByClosedSeam,
      selectedSliceId: completionSelection.selectedSlice?.sliceId ?? null,
    },
    runtimeQueue: {
      topRecommendation: runtimeAssistance.topRecommendation
        ? {
            candidateId: runtimeAssistance.topRecommendation.candidateId,
            assistanceState: runtimeAssistance.topRecommendation.assistanceState,
            recommendedActionKind:
              runtimeAssistance.topRecommendation.recommendedActionKind,
          }
        : null,
      summary: {
        totalPromotionReadinessCases:
          runtimeAssistance.summary.totalPromotionReadinessCases,
        alreadyPromotedManualCycleCount:
          runtimeAssistance.summary.alreadyPromotedManualCycleCount,
        readyForManualPromotionSeamDecisionCount:
          runtimeAssistance.summary.readyForManualPromotionSeamDecisionCount,
        blockedPendingHostSelectionCount:
          runtimeAssistance.summary.blockedPendingHostSelectionCount,
        blockedMissingCallableBoundaryCount:
          runtimeAssistance.summary.blockedMissingCallableBoundaryCount,
        blockedOtherCount: runtimeAssistance.summary.blockedOtherCount,
      },
    },
    coordinationContext: {
      topPressureBucket: lifecycleReport.topCoordinationPressure?.bucketId ?? null,
      totalLiveCases: lifecycleReport.summary.totalLiveCases,
      recommendTaskCount: lifecycleReport.summary.recommendTaskCount,
      parkedCount: lifecycleReport.summary.parkedCount,
      stopCount: lifecycleReport.summary.stopCount,
    },
    persistenceSignals: {
      staleCaseCount: persistenceReport.persistenceSignals.staleCases.length,
      cadenceDriftDetected:
        persistenceReport.persistenceSignals.cadenceDrift.cadenceDriftDetected,
      totalPreviousChecks: persistenceReport.persistenceSignals.totalPreviousChecks,
      ledgerPath: persistenceReport.ledgerPath,
    },
    loopSelection: pickLoopSelection({
      completionSelection,
      runtimeTopRecommendation: runtimeAssistance.topRecommendation,
    }),
  };
}
