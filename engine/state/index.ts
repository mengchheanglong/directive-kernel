import path from "node:path";

import {
  readDirectiveArchitectureHandoffArtifact,
  type DirectiveArchitectureHandoffArtifact,
} from "../../architecture/lib/architecture-handoff-start.ts";
import {
  readDirectiveArchitectureBoundedResultArtifact,
  readDirectiveArchitectureBoundedStartArtifact,
  type DirectiveArchitectureBoundedResultArtifact,
  type DirectiveArchitectureBoundedStartArtifact,
} from "../../architecture/lib/architecture-bounded-closeout.ts";
import {
  readDirectiveArchitectureAdoptionDetail,
  type DirectiveArchitectureAdoptionDetail,
} from "../../architecture/lib/architecture-result-adoption.ts";
import {
  readDirectiveArchitectureImplementationTargetDetail,
  type DirectiveArchitectureImplementationTargetDetail,
} from "../../architecture/lib/architecture-implementation-target.ts";
import {
  readDirectiveArchitectureImplementationResultDetail,
  type DirectiveArchitectureImplementationResultDetail,
} from "../../architecture/lib/architecture-implementation-result.ts";
import {
  readDirectiveArchitectureRetentionDetail,
  type DirectiveArchitectureRetentionDetail,
} from "../../architecture/lib/architecture-retention.ts";
import {
  readDirectiveArchitectureIntegrationRecordDetail,
  type DirectiveArchitectureIntegrationRecordDetail,
} from "../../architecture/lib/architecture-integration-record.ts";
import {
  readDirectiveArchitectureConsumptionRecordDetail,
  type DirectiveArchitectureConsumptionRecordDetail,
} from "../../architecture/lib/architecture-consumption-record.ts";
import {
  readDirectiveArchitecturePostConsumptionEvaluationDetail,
  type DirectiveArchitecturePostConsumptionEvaluationDetail,
} from "../../architecture/lib/architecture-post-consumption-evaluation.ts";
import { readDirectiveDiscoveryRoutingArtifact } from "../../discovery/lib/discovery-route-opener.ts";
import { readDiscoveryRoutingReviewResolution } from "../../discovery/lib/discovery-routing-review-resolution.ts";
import {
  buildRuntimeArtifactStage,
  buildRuntimePromotionReadinessBlockers,
  resolveRuntimeFocusFromAnyPath,
} from "./runtime.ts";
import {
  finalizeResolvedFocus,
  findLatestEngineRunByCandidateId,
  findQueueEntryByCandidateId,
  getDefaultDirectiveWorkspaceRoot,
  isDiscoveryHeldRouteDestination,
  listFiles,
  mergeNonNullLinkedArtifacts,
  normalizePath,
  readGenericDiscoveryMonitorArtifact,
  readUtf8,
  resolveDirectiveRelativePath,
  zeroLinkedArtifacts,
} from "./shared.ts";
import {
  lookupArchitectureDeepTailLinkedArtifactPath,
  recordArchitectureDeepTailLinkedArtifactPath,
} from "../../architecture/lib/architecture-deep-tail-linkage-index.ts";
import {
  readDirectiveEngineRunsOverview,
  type StoredDirectiveEngineRunRecord,
} from "../execution/engine-run-artifacts.ts";
import { buildDirectiveWorkspaceProductTruth } from "../workspace-truth.ts";
import {
  fileExistsInDirectiveWorkspace,
  isDirectiveWorkspaceArtifactReference,
  readLinkedArtifactIfPresent,
  recordExpectedArtifactIfMissing,
  recordInconsistentLink,
  recordMissingExpectedArtifact,
  recordMissingLinkedArtifactIfAbsent,
} from "../artifact-link-validation.ts";
import {
  ARCHITECTURE_DEEP_TAIL_STAGE,
  matchesArchitectureDeepTailStagePath,
} from "../../architecture/lib/architecture-deep-tail-stage-map.ts";
import type { ArchitectureDeepTailStageId } from "../../architecture/lib/architecture-deep-tail-stage-map.ts";
export type DirectiveWorkspaceFocusLane =
  | "discovery"
  | "engine"
  | "architecture"
  | "runtime"
  | "unknown";

export type DirectiveWorkspaceArtifactKind =
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

export type DirectiveWorkspaceLinkedArtifacts = {
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
  runtimeHostConsumptionReportPath: string | null;
};

export type DirectiveWorkspaceCurrentHead = {
  artifactPath: string;
  artifactKind: DirectiveWorkspaceArtifactKind;
  lane: DirectiveWorkspaceFocusLane;
  artifactStage: string;
};

export type DirectiveWorkspaceResolvedFocus = {
  ok: true;
  directiveRoot: string;
  artifactPath: string;
  artifactKind: DirectiveWorkspaceArtifactKind;
  lane: DirectiveWorkspaceFocusLane;
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
  currentHead: DirectiveWorkspaceCurrentHead;
  linkedArtifacts: DirectiveWorkspaceLinkedArtifacts;
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

export type DirectiveWorkspaceAnchorSummary = {
  label: string;
  artifactPath: string;
  lane: DirectiveWorkspaceFocusLane;
  currentStage: string;
  nextLegalStep: string;
  candidateId: string | null;
  candidateName: string | null;
};

export type DirectiveWorkspaceStateReport = {
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
    counts: ReturnType<typeof readDirectiveEngineRunsOverview>["counts"];
  };
  anchors: DirectiveWorkspaceAnchorSummary[];
  focus: DirectiveWorkspaceResolvedFocus | null;
};

function findLinkedArchitectureArtifact<Detail>(input: {
  directiveRoot: string;
  relativeDir: string;
  expectedLinkedPath: string;
  stageId?: ArchitectureDeepTailStageId;
  suffix?: string;
  readDetail: (artifactPath: string) => Detail;
  readLinkedPath: (detail: Detail) => string | null | undefined;
}) {
  if (typeof input.expectedLinkedPath !== "string" || input.expectedLinkedPath.trim().length === 0) {
    return null;
  }

  if (input.stageId) {
    const indexedPath = lookupArchitectureDeepTailLinkedArtifactPath({
      directiveRoot: input.directiveRoot,
      stageId: input.stageId,
      sourceRelativePath: input.expectedLinkedPath,
    });
    if (indexedPath) {
      try {
        const detail = input.readDetail(indexedPath);
        if (input.readLinkedPath(detail) === input.expectedLinkedPath) {
          return {
            path: indexedPath,
            detail,
          };
        }
      } catch {
        // fall through to scan
      }
    }
  }

  for (const artifactPath of listFiles({
    directiveRoot: input.directiveRoot,
    relativeDir: input.relativeDir,
    suffix: input.suffix ?? ".md",
  })) {
    try {
      const detail = input.readDetail(artifactPath);
      if (input.readLinkedPath(detail) === input.expectedLinkedPath) {
        if (input.stageId) {
          recordArchitectureDeepTailLinkedArtifactPath({
            directiveRoot: input.directiveRoot,
            stageId: input.stageId,
            sourceRelativePath: input.expectedLinkedPath,
            targetRelativePath: artifactPath,
          });
        }
        return {
          path: artifactPath,
          detail,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function findArchitectureAdoptionForResult(directiveRoot: string, resultPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: "architecture/02-adopted",
    readDetail: (adoptionPath) => readDirectiveArchitectureAdoptionDetail({
      directiveRoot,
      adoptionPath,
    }),
    readLinkedPath: (detail) => detail.sourceResultRelativePath,
    expectedLinkedPath: resultPath,
  });
}

function readArchitectureUpstreamChainFromAdoption(input: {
  directiveRoot: string;
  adoptionDetail: DirectiveArchitectureAdoptionDetail;
}) {
  if (!input.adoptionDetail.sourceResultRelativePath) {
    return {
      result: null,
      start: null,
      handoff: null,
    };
  }

  const result = readDirectiveArchitectureBoundedResultArtifact({
    directiveRoot: input.directiveRoot,
    resultPath: input.adoptionDetail.sourceResultRelativePath,
  });
  const start = result.startRelativePath
    ? readDirectiveArchitectureBoundedStartArtifact({
      directiveRoot: input.directiveRoot,
      startPath: result.startRelativePath,
    })
    : null;
  const handoff = readLinkedArtifactIfPresent({
    directiveRoot: input.directiveRoot,
    relativePath: result.handoffStubPath,
    read: (handoffPath) => readDirectiveArchitectureHandoffArtifact({
      directiveRoot: input.directiveRoot,
      handoffPath,
    }),
  });

  return {
    result,
    start,
    handoff,
  };
}

function findArchitectureImplementationTargetForAdoption(directiveRoot: string, adoptionPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: ARCHITECTURE_DEEP_TAIL_STAGE.implementation_target.relativeDir,
    stageId: "implementation_target",
    readDetail: (targetPath) => readDirectiveArchitectureImplementationTargetDetail({
      directiveRoot,
      targetPath,
    }),
    readLinkedPath: (detail) => detail.adoptionRelativePath,
    expectedLinkedPath: adoptionPath,
  });
}

function findArchitectureImplementationResultForTarget(directiveRoot: string, targetPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: ARCHITECTURE_DEEP_TAIL_STAGE.implementation_result.relativeDir,
    stageId: "implementation_result",
    readDetail: (resultPath) => readDirectiveArchitectureImplementationResultDetail({
      directiveRoot,
      resultPath,
    }),
    readLinkedPath: (detail) => detail.targetRelativePath,
    expectedLinkedPath: targetPath,
  });
}

function findArchitectureRetentionForResult(directiveRoot: string, implementationResultPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: ARCHITECTURE_DEEP_TAIL_STAGE.retained.relativeDir,
    stageId: "retained",
    readDetail: (retainedPath) => readDirectiveArchitectureRetentionDetail({
      directiveRoot,
      retainedPath,
    }),
    readLinkedPath: (detail) => detail.resultRelativePath,
    expectedLinkedPath: implementationResultPath,
  });
}

function findArchitectureIntegrationForRetention(directiveRoot: string, retainedPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: ARCHITECTURE_DEEP_TAIL_STAGE.integration_record.relativeDir,
    stageId: "integration_record",
    readDetail: (integrationPath) => readDirectiveArchitectureIntegrationRecordDetail({
      directiveRoot,
      integrationPath,
    }),
    readLinkedPath: (detail) => detail.retainedRelativePath,
    expectedLinkedPath: retainedPath,
  });
}

function findArchitectureConsumptionForIntegration(directiveRoot: string, integrationPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: ARCHITECTURE_DEEP_TAIL_STAGE.consumption_record.relativeDir,
    stageId: "consumption_record",
    readDetail: (consumptionPath) => readDirectiveArchitectureConsumptionRecordDetail({
      directiveRoot,
      consumptionPath,
    }),
    readLinkedPath: (detail) => detail.integrationRelativePath,
    expectedLinkedPath: integrationPath,
  });
}

function findArchitectureEvaluationForConsumption(directiveRoot: string, consumptionPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: ARCHITECTURE_DEEP_TAIL_STAGE.post_consumption_evaluation.relativeDir,
    stageId: "post_consumption_evaluation",
    readDetail: (evaluationPath) => readDirectiveArchitecturePostConsumptionEvaluationDetail({
      directiveRoot,
      evaluationPath,
    }),
    readLinkedPath: (detail) => detail.consumptionRelativePath,
    expectedLinkedPath: consumptionPath,
  });
}

function findArchitectureReopenedStartForEvaluation(directiveRoot: string, evaluationPath: string) {
  const match = findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: "architecture/01-experiments",
    suffix: "-bounded-start.md",
    readDetail: (startPath) => readDirectiveArchitectureBoundedStartArtifact({
      directiveRoot,
      startPath,
    }),
    readLinkedPath: (artifact) => artifact.sourceAnalysisRef,
    expectedLinkedPath: evaluationPath,
  });

  return match
    ? {
      path: match.path,
      artifact: match.detail,
    }
    : null;
}

function buildArchitectureState(input: {
  directiveRoot: string;
  operatingMode?: string | null;
  handoff?: DirectiveArchitectureHandoffArtifact | null;
  start?: DirectiveArchitectureBoundedStartArtifact | null;
  result?: DirectiveArchitectureBoundedResultArtifact | null;
  adoption?: { path: string; detail: DirectiveArchitectureAdoptionDetail } | null;
  implementationTarget?: { path: string; detail: DirectiveArchitectureImplementationTargetDetail } | null;
  implementationResult?: { path: string; detail: DirectiveArchitectureImplementationResultDetail } | null;
  retained?: { path: string; detail: DirectiveArchitectureRetentionDetail } | null;
  integration?: { path: string; detail: DirectiveArchitectureIntegrationRecordDetail } | null;
  consumption?: { path: string; detail: DirectiveArchitectureConsumptionRecordDetail } | null;
  evaluation?: { path: string; detail: DirectiveArchitecturePostConsumptionEvaluationDetail } | null;
  reopenedStart?: { path: string; artifact: DirectiveArchitectureBoundedStartArtifact } | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.architectureHandoffPath = input.handoff?.handoffRelativePath ?? null;
  linked.architectureBoundedStartPath = input.start?.startRelativePath ?? null;
  linked.architectureBoundedResultPath = input.result?.resultRelativePath ?? null;
  linked.architectureContinuationStartPath =
    input.result?.continuationStartExists ? input.result.continuationStartRelativePath : null;
  linked.architectureAdoptionPath = input.adoption?.path ?? null;
  linked.architectureImplementationTargetPath = input.implementationTarget?.path ?? null;
  linked.architectureImplementationResultPath = input.implementationResult?.path ?? null;
  linked.architectureRetainedPath = input.retained?.path ?? null;
  linked.architectureIntegrationRecordPath = input.integration?.path ?? null;
  linked.architectureConsumptionRecordPath = input.consumption?.path ?? null;
  linked.architectureEvaluationPath = input.evaluation?.path ?? null;
  linked.architectureReopenedStartPath = input.reopenedStart?.path ?? null;

  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.handoff?.discoveryRoutingRecordPath,
    label: "Discovery routing record",
  });
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.start?.handoffStubPath,
    label: "Architecture handoff",
  });
  if (input.result && !input.result.decisionExists) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing Architecture closeout decision artifact: ${input.result.decisionRelativePath}`,
    );
  }
  if (input.evaluation?.detail.decision === "keep" && input.reopenedStart) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      "keep evaluation unexpectedly links to a reopened Architecture start",
    );
  }
  if (input.evaluation?.detail.decision === "reopen" && !input.reopenedStart) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      "architecture/01-experiments/*-reopened-bounded-start.md",
    );
  }
  if (
    input.result?.verdict === "stay_experimental"
    && !input.result.continuationStartExists
    && !input.adoption
    && !isNoteDirectArchitectureBoundedResult({
      operatingMode: input.operatingMode ?? null,
      result: input.result,
    })
  ) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      input.result.continuationStartRelativePath,
    );
  }
  if (input.result?.verdict === "adopt" && !input.adoption) {
    recordMissingExpectedArtifact({ missingExpectedArtifacts, inconsistentLinks }, "architecture/02-adopted/*.md");
  }
  if (input.adoption && !input.implementationTarget) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      ARCHITECTURE_DEEP_TAIL_STAGE.implementation_target.gapPattern,
    );
  }
  if (input.implementationTarget && !input.implementationResult) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      ARCHITECTURE_DEEP_TAIL_STAGE.implementation_result.gapPattern,
    );
  }
  if (input.implementationResult && !input.retained) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      ARCHITECTURE_DEEP_TAIL_STAGE.retained.gapPattern,
    );
  }
  if (input.retained && !input.integration) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      ARCHITECTURE_DEEP_TAIL_STAGE.integration_record.gapPattern,
    );
  }
  if (input.integration && !input.consumption) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      ARCHITECTURE_DEEP_TAIL_STAGE.consumption_record.gapPattern,
    );
  }
  if (input.consumption && !input.evaluation) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      ARCHITECTURE_DEEP_TAIL_STAGE.post_consumption_evaluation.gapPattern,
    );
  }

  let currentStage = "architecture.handoff.pending_review";
  let nextLegalStep = getArchitectureHandoffNextLegalStep(input.operatingMode ?? null);

  if (input.handoff && input.start && !input.result) {
    currentStage = "architecture.bounded_start.opened";
    nextLegalStep = "Explicitly record bounded closeout/result.";
  }
  if (input.result) {
    currentStage = `architecture.bounded_result.${input.result.verdict}`;
    nextLegalStep =
      isNoteDirectArchitectureBoundedResult({
        operatingMode: input.operatingMode ?? null,
        result: input.result,
      })
        ? getNoteDirectArchitectureBoundedResultNextLegalStep({ result: input.result })
        : input.result.verdict === "stay_experimental"
        ? "Explicitly continue the experimental Architecture slice or stop without auto-advancing."
        : "Explicitly adopt/materialize the bounded Architecture result.";
  }
  if (input.adoption) {
    currentStage = `architecture.adoption.${input.adoption.detail.finalStatus}`;
    nextLegalStep = "Explicitly create the implementation target.";
  }
  if (input.implementationTarget) {
    currentStage = "architecture.implementation_target.opened";
    nextLegalStep = "Explicitly record the implementation result.";
  }
  if (input.implementationResult) {
    currentStage = `architecture.implementation_result.${input.implementationResult.detail.outcome}`;
    nextLegalStep = "Explicitly confirm retention.";
  }
  if (input.retained) {
    currentStage = "architecture.retained.confirmed";
    nextLegalStep = "Explicitly create the integration record.";
  }
  if (input.integration) {
    currentStage = "architecture.integration_record.ready";
    nextLegalStep = "Explicitly record consumption.";
  }
  if (input.consumption) {
    currentStage = `architecture.consumption.${input.consumption.detail.outcome}`;
    nextLegalStep = "Explicitly evaluate the applied Architecture output after use.";
  }
  if (input.evaluation) {
    currentStage = `architecture.post_consumption_evaluation.${input.evaluation.detail.decision}`;
    nextLegalStep =
      input.evaluation.detail.decision === "reopen"
        ? input.reopenedStart
          ? "Explicitly continue or close the reopened bounded Architecture slice; no automatic move is open."
          : "Explicitly approve reopening one bounded Architecture slice."
        : "No automatic Architecture step is open; keep remains an explicit stop unless a new bounded pressure is introduced.";
  }

  return {
    currentStage,
    nextLegalStep,
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "automatic Architecture advancement",
      "Runtime execution from Architecture artifacts",
      "lifecycle orchestration",
    ],
  };
}

function isNoteOperatingMode(operatingMode: string | null | undefined) {
  return String(operatingMode ?? "").trim().toLowerCase() === "note";
}

function getArchitectureHandoffNextLegalStep(operatingMode: string | null | undefined) {
  return isNoteOperatingMode(operatingMode)
    ? "Explicitly review the Architecture handoff and record one NOTE-mode bounded result; no bounded start is required."
    : "Explicitly approve the bounded Architecture start.";
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

function isNoteDirectArchitectureBoundedResult(input: {
  operatingMode: string | null | undefined;
  result?: DirectiveArchitectureBoundedResultArtifact | null;
}) {
  return isNoteOperatingMode(input.operatingMode) && !input.result?.startRelativePath;
}

function getNoteDirectArchitectureBoundedResultNextLegalStep(input: {
  result?: DirectiveArchitectureBoundedResultArtifact | null;
}) {
  if (input.result?.verdict === "adopt") {
    return "No automatic Architecture step is open; this NOTE-mode bounded result is an explicit stop unless a new bounded pressure justifies deeper materialization.";
  }
  return "No automatic Architecture step is open; this NOTE-mode bounded result is an explicit stop unless a new bounded pressure is introduced.";
}

function buildArchitectureArtifactStage(input: {
  artifactKind: DirectiveWorkspaceArtifactKind;
  operatingMode?: string | null;
  result?: DirectiveArchitectureBoundedResultArtifact | null;
  adoption?: { path: string; detail: DirectiveArchitectureAdoptionDetail } | null;
  implementationResult?: { path: string; detail: DirectiveArchitectureImplementationResultDetail } | null;
  consumption?: { path: string; detail: DirectiveArchitectureConsumptionRecordDetail } | null;
  evaluation?: { path: string; detail: DirectiveArchitecturePostConsumptionEvaluationDetail } | null;
}) {
  switch (input.artifactKind) {
    case "architecture_handoff":
      return {
        artifactStage: "architecture.handoff.pending_review",
        artifactNextLegalStep: getArchitectureHandoffNextLegalStep(input.operatingMode ?? null),
      };
    case "architecture_bounded_start":
      return {
        artifactStage: "architecture.bounded_start.opened",
        artifactNextLegalStep: "Explicitly record bounded closeout/result.",
      };
    case "architecture_bounded_result":
      return {
        artifactStage: `architecture.bounded_result.${input.result?.verdict ?? "unknown"}`,
        artifactNextLegalStep:
          isNoteDirectArchitectureBoundedResult({
            operatingMode: input.operatingMode ?? null,
            result: input.result ?? null,
          })
            ? getNoteDirectArchitectureBoundedResultNextLegalStep({ result: input.result ?? null })
            : input.result?.verdict === "stay_experimental"
            ? "Explicitly continue the experimental Architecture slice or stop without auto-advancing."
            : "Explicitly adopt/materialize the bounded Architecture result.",
      };
    case "architecture_adoption":
      return {
        artifactStage: `architecture.adoption.${input.adoption?.detail.finalStatus ?? "unknown"}`,
        artifactNextLegalStep: "Explicitly create the implementation target.",
      };
    case "architecture_implementation_target":
      return {
        artifactStage: "architecture.implementation_target.opened",
        artifactNextLegalStep: "Explicitly record the implementation result.",
      };
    case "architecture_implementation_result":
      return {
        artifactStage: `architecture.implementation_result.${input.implementationResult?.detail.outcome ?? "unknown"}`,
        artifactNextLegalStep: "Explicitly confirm retention.",
      };
    case "architecture_retained":
      return {
        artifactStage: "architecture.retained.confirmed",
        artifactNextLegalStep: "Explicitly create the integration record.",
      };
    case "architecture_integration_record":
      return {
        artifactStage: "architecture.integration_record.ready",
        artifactNextLegalStep: "Explicitly record consumption.",
      };
    case "architecture_consumption_record":
      return {
        artifactStage: `architecture.consumption.${input.consumption?.detail.outcome ?? "unknown"}`,
        artifactNextLegalStep: "Explicitly evaluate the applied Architecture output after use.",
      };
    case "architecture_post_consumption_evaluation":
      return {
        artifactStage: `architecture.post_consumption_evaluation.${input.evaluation?.detail.decision ?? "unknown"}`,
        artifactNextLegalStep:
          input.evaluation?.detail.decision === "reopen"
            ? "Explicitly approve reopening one bounded Architecture slice."
            : "No automatic Architecture step is open; keep remains an explicit stop unless a new bounded pressure is introduced.",
      };
    default:
      return {
        artifactStage: "architecture.unknown",
        artifactNextLegalStep: "Inspect the bounded Architecture artifact chain directly.",
      };
  }
}

function resolveArchitectureFocusFromAnyPath(input: {
  directiveRoot: string;
  artifactPath: string;
}) {
  const relativePath = resolveDirectiveRelativePath(input.directiveRoot, input.artifactPath, "artifactPath");

  let handoff: DirectiveArchitectureHandoffArtifact | null = null;
  let start: DirectiveArchitectureBoundedStartArtifact | null = null;
  let result: DirectiveArchitectureBoundedResultArtifact | null = null;
  let adoption: { path: string; detail: DirectiveArchitectureAdoptionDetail } | null = null;
  let implementationTarget: { path: string; detail: DirectiveArchitectureImplementationTargetDetail } | null = null;
  let implementationResult: { path: string; detail: DirectiveArchitectureImplementationResultDetail } | null = null;
  let retained: { path: string; detail: DirectiveArchitectureRetentionDetail } | null = null;
  let integration: { path: string; detail: DirectiveArchitectureIntegrationRecordDetail } | null = null;
  let consumption: { path: string; detail: DirectiveArchitectureConsumptionRecordDetail } | null = null;
  let evaluation: { path: string; detail: DirectiveArchitecturePostConsumptionEvaluationDetail } | null = null;
  let reopenedStart: { path: string; artifact: DirectiveArchitectureBoundedStartArtifact } | null = null;
  let artifactKind: DirectiveWorkspaceArtifactKind = "unknown";

  if (relativePath.endsWith("-engine-handoff.md")) {
    handoff = readDirectiveArchitectureHandoffArtifact({
      directiveRoot: input.directiveRoot,
      handoffPath: relativePath,
    });
    artifactKind = "architecture_handoff";
    if (handoff.startExists) {
      start = readDirectiveArchitectureBoundedStartArtifact({
        directiveRoot: input.directiveRoot,
        startPath: handoff.startRelativePath as string,
      });
    }
    if (handoff.resultExists) {
      result = readDirectiveArchitectureBoundedResultArtifact({
        directiveRoot: input.directiveRoot,
        resultPath: handoff.resultRelativePath,
      });
    }
  } else if (relativePath.endsWith("-bounded-start.md")) {
    start = readDirectiveArchitectureBoundedStartArtifact({
      directiveRoot: input.directiveRoot,
      startPath: relativePath,
    });
    artifactKind = "architecture_bounded_start";
    handoff = readLinkedArtifactIfPresent({
      directiveRoot: input.directiveRoot,
      relativePath: start.handoffStubPath,
      read: (handoffPath) => readDirectiveArchitectureHandoffArtifact({
        directiveRoot: input.directiveRoot,
        handoffPath,
      }),
    });
  } else if (relativePath.endsWith("-bounded-result.md")) {
    result = readDirectiveArchitectureBoundedResultArtifact({
      directiveRoot: input.directiveRoot,
      resultPath: relativePath,
    });
    artifactKind = "architecture_bounded_result";
    if (result.startRelativePath) {
      start = readDirectiveArchitectureBoundedStartArtifact({
        directiveRoot: input.directiveRoot,
        startPath: result.startRelativePath,
      });
    }
    handoff = readLinkedArtifactIfPresent({
      directiveRoot: input.directiveRoot,
      relativePath: result.handoffStubPath,
      read: (handoffPath) => readDirectiveArchitectureHandoffArtifact({
        directiveRoot: input.directiveRoot,
        handoffPath,
      }),
    });
  } else if (relativePath.startsWith("architecture/02-adopted/")) {
    adoption = {
      path: relativePath,
      detail: readDirectiveArchitectureAdoptionDetail({
        directiveRoot: input.directiveRoot,
        adoptionPath: relativePath,
      }),
    };
    artifactKind = "architecture_adoption";
    ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
      directiveRoot: input.directiveRoot,
      adoptionDetail: adoption.detail,
    }));
  } else if (matchesArchitectureDeepTailStagePath(ARCHITECTURE_DEEP_TAIL_STAGE.implementation_target, relativePath)) {
    implementationTarget = {
      path: relativePath,
      detail: readDirectiveArchitectureImplementationTargetDetail({
        directiveRoot: input.directiveRoot,
        targetPath: relativePath,
      }),
    };
    artifactKind = "architecture_implementation_target";
    adoption = implementationTarget.detail.adoptionRelativePath
      ? {
          path: implementationTarget.detail.adoptionRelativePath,
          detail: readDirectiveArchitectureAdoptionDetail({
            directiveRoot: input.directiveRoot,
            adoptionPath: implementationTarget.detail.adoptionRelativePath,
          }),
        }
      : null;
    if (adoption) {
      ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
        directiveRoot: input.directiveRoot,
        adoptionDetail: adoption.detail,
      }));
    }
  } else if (matchesArchitectureDeepTailStagePath(ARCHITECTURE_DEEP_TAIL_STAGE.implementation_result, relativePath)) {
    implementationResult = {
      path: relativePath,
      detail: readDirectiveArchitectureImplementationResultDetail({
        directiveRoot: input.directiveRoot,
        resultPath: relativePath,
      }),
    };
    artifactKind = "architecture_implementation_result";
    implementationTarget = findArchitectureImplementationTargetForAdoption(
      input.directiveRoot,
      implementationResult.detail.adoptionRelativePath,
    );
    adoption = implementationResult.detail.adoptionRelativePath
      ? {
          path: implementationResult.detail.adoptionRelativePath,
          detail: readDirectiveArchitectureAdoptionDetail({
            directiveRoot: input.directiveRoot,
            adoptionPath: implementationResult.detail.adoptionRelativePath,
          }),
        }
      : null;
    if (adoption) {
      ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
        directiveRoot: input.directiveRoot,
        adoptionDetail: adoption.detail,
      }));
    }
  } else if (matchesArchitectureDeepTailStagePath(ARCHITECTURE_DEEP_TAIL_STAGE.retained, relativePath)) {
    retained = {
      path: relativePath,
      detail: readDirectiveArchitectureRetentionDetail({
        directiveRoot: input.directiveRoot,
        retainedPath: relativePath,
      }),
    };
    artifactKind = "architecture_retained";
    implementationResult = findArchitectureImplementationResultForTarget(
      input.directiveRoot,
      retained.detail.targetRelativePath,
    );
    implementationTarget = implementationResult
      ? findArchitectureImplementationTargetForAdoption(
          input.directiveRoot,
          implementationResult.detail.adoptionRelativePath,
        )
      : null;
    adoption = retained.detail.adoptionRelativePath
      ? {
          path: retained.detail.adoptionRelativePath,
          detail: readDirectiveArchitectureAdoptionDetail({
            directiveRoot: input.directiveRoot,
            adoptionPath: retained.detail.adoptionRelativePath,
          }),
        }
      : null;
    if (adoption) {
      ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
        directiveRoot: input.directiveRoot,
        adoptionDetail: adoption.detail,
      }));
    }
  } else if (matchesArchitectureDeepTailStagePath(ARCHITECTURE_DEEP_TAIL_STAGE.integration_record, relativePath)) {
    integration = {
      path: relativePath,
      detail: readDirectiveArchitectureIntegrationRecordDetail({
        directiveRoot: input.directiveRoot,
        integrationPath: relativePath,
      }),
    };
    artifactKind = "architecture_integration_record";
    retained = findArchitectureRetentionForResult(
      input.directiveRoot,
      integration.detail.resultRelativePath,
    );
    adoption = integration.detail.adoptionRelativePath
      ? {
          path: integration.detail.adoptionRelativePath,
          detail: readDirectiveArchitectureAdoptionDetail({
            directiveRoot: input.directiveRoot,
            adoptionPath: integration.detail.adoptionRelativePath,
          }),
        }
      : null;
    if (adoption) {
      ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
        directiveRoot: input.directiveRoot,
        adoptionDetail: adoption.detail,
      }));
      implementationTarget = findArchitectureImplementationTargetForAdoption(
        input.directiveRoot,
        adoption.path,
      );
      implementationResult = implementationTarget
        ? findArchitectureImplementationResultForTarget(input.directiveRoot, implementationTarget.path)
        : null;
    }
  } else if (matchesArchitectureDeepTailStagePath(ARCHITECTURE_DEEP_TAIL_STAGE.consumption_record, relativePath)) {
    consumption = {
      path: relativePath,
      detail: readDirectiveArchitectureConsumptionRecordDetail({
        directiveRoot: input.directiveRoot,
        consumptionPath: relativePath,
      }),
    };
    artifactKind = "architecture_consumption_record";
    integration = findArchitectureIntegrationForRetention(
      input.directiveRoot,
      consumption.detail.retainedRelativePath,
    );
    retained = consumption.detail.retainedRelativePath
      ? {
          path: consumption.detail.retainedRelativePath,
          detail: readDirectiveArchitectureRetentionDetail({
            directiveRoot: input.directiveRoot,
            retainedPath: consumption.detail.retainedRelativePath,
          }),
        }
      : null;
    adoption = consumption.detail.adoptionRelativePath
      ? {
          path: consumption.detail.adoptionRelativePath,
          detail: readDirectiveArchitectureAdoptionDetail({
            directiveRoot: input.directiveRoot,
            adoptionPath: consumption.detail.adoptionRelativePath,
          }),
        }
      : null;
    if (adoption) {
      ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
        directiveRoot: input.directiveRoot,
        adoptionDetail: adoption.detail,
      }));
      implementationTarget = findArchitectureImplementationTargetForAdoption(
        input.directiveRoot,
        adoption.path,
      );
      implementationResult = implementationTarget
        ? findArchitectureImplementationResultForTarget(input.directiveRoot, implementationTarget.path)
        : null;
    }
  } else if (matchesArchitectureDeepTailStagePath(ARCHITECTURE_DEEP_TAIL_STAGE.post_consumption_evaluation, relativePath)) {
    evaluation = {
      path: relativePath,
      detail: readDirectiveArchitecturePostConsumptionEvaluationDetail({
        directiveRoot: input.directiveRoot,
        evaluationPath: relativePath,
      }),
    };
    artifactKind = "architecture_post_consumption_evaluation";
    consumption = evaluation.detail.consumptionRelativePath
      ? {
          path: evaluation.detail.consumptionRelativePath,
          detail: readDirectiveArchitectureConsumptionRecordDetail({
            directiveRoot: input.directiveRoot,
            consumptionPath: evaluation.detail.consumptionRelativePath,
          }),
        }
      : null;
    integration = evaluation.detail.integrationRelativePath
      ? {
          path: evaluation.detail.integrationRelativePath,
          detail: readDirectiveArchitectureIntegrationRecordDetail({
            directiveRoot: input.directiveRoot,
            integrationPath: evaluation.detail.integrationRelativePath,
          }),
        }
      : null;
    retained = evaluation.detail.retainedRelativePath
      ? {
          path: evaluation.detail.retainedRelativePath,
          detail: readDirectiveArchitectureRetentionDetail({
            directiveRoot: input.directiveRoot,
            retainedPath: evaluation.detail.retainedRelativePath,
          }),
        }
      : null;
    adoption = evaluation.detail.adoptionRelativePath
      ? {
          path: evaluation.detail.adoptionRelativePath,
          detail: readDirectiveArchitectureAdoptionDetail({
            directiveRoot: input.directiveRoot,
            adoptionPath: evaluation.detail.adoptionRelativePath,
          }),
        }
      : null;
    if (adoption) {
      ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
        directiveRoot: input.directiveRoot,
        adoptionDetail: adoption.detail,
      }));
      implementationTarget = findArchitectureImplementationTargetForAdoption(
        input.directiveRoot,
        adoption.path,
      );
      implementationResult = implementationTarget
        ? findArchitectureImplementationResultForTarget(input.directiveRoot, implementationTarget.path)
        : null;
    }
    reopenedStart = evaluation.detail.decision === "reopen"
      ? findArchitectureReopenedStartForEvaluation(input.directiveRoot, relativePath)
      : null;
  } else {
    throw new Error(`unsupported Architecture artifact path: ${relativePath}`);
  }

  if (start && start.resultExists && !result) {
    result = readDirectiveArchitectureBoundedResultArtifact({
      directiveRoot: input.directiveRoot,
      resultPath: start.resultRelativePath,
    });
  }
  if (result && !adoption) {
    adoption = findArchitectureAdoptionForResult(input.directiveRoot, result.resultRelativePath);
  }
  if (adoption && !implementationTarget) {
    implementationTarget = findArchitectureImplementationTargetForAdoption(input.directiveRoot, adoption.path);
  }
  if (implementationTarget && !implementationResult) {
    implementationResult = findArchitectureImplementationResultForTarget(
      input.directiveRoot,
      implementationTarget.path,
    );
  }
  if (implementationResult && !retained) {
    retained = findArchitectureRetentionForResult(input.directiveRoot, implementationResult.path);
  }
  if (retained && !integration) {
    integration = findArchitectureIntegrationForRetention(input.directiveRoot, retained.path);
  }
  if (integration && !consumption) {
    consumption = findArchitectureConsumptionForIntegration(input.directiveRoot, integration.path);
  }
  if (consumption && !evaluation) {
    evaluation = findArchitectureEvaluationForConsumption(input.directiveRoot, consumption.path);
  }
  if (evaluation?.detail.decision === "reopen" && !reopenedStart) {
    reopenedStart = findArchitectureReopenedStartForEvaluation(input.directiveRoot, evaluation.path);
  }

  const candidateId =
    evaluation?.detail.candidateId
    ?? consumption?.detail.candidateId
    ?? integration?.detail.candidateId
    ?? retained?.detail.candidateId
    ?? implementationResult?.detail.candidateId
    ?? implementationTarget?.detail.candidateId
    ?? adoption?.detail.candidateId
    ?? result?.candidateId
    ?? start?.candidateId
    ?? handoff?.candidateId
    ?? null;
  const candidateName =
    evaluation?.detail.candidateName
    ?? consumption?.detail.candidateName
    ?? integration?.detail.candidateName
    ?? retained?.detail.candidateName
    ?? implementationResult?.detail.candidateName
    ?? implementationTarget?.detail.candidateName
    ?? adoption?.detail.candidateName
    ?? result?.candidateName
    ?? start?.candidateName
    ?? handoff?.title
    ?? null;
  const queueEntry = candidateId ? findQueueEntryByCandidateId(input.directiveRoot, candidateId) : null;

  return {
    artifactKind,
    candidateId,
    candidateName,
    result,
    adoption,
    implementationResult,
    consumption,
    evaluation,
    ...buildArchitectureState({
      directiveRoot: input.directiveRoot,
      operatingMode: queueEntry?.operating_mode ?? null,
      handoff,
      start,
      result,
      adoption,
      implementationTarget,
      implementationResult,
      retained,
      integration,
      consumption,
      evaluation,
      reopenedStart,
    }),
  };
}

function buildOverviewAnchors(directiveRoot: string): DirectiveWorkspaceAnchorSummary[] {
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
        } satisfies DirectiveWorkspaceAnchorSummary;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is DirectiveWorkspaceAnchorSummary => Boolean(entry));
}

function resolveDiscoveryFocus(input: {
  directiveRoot: string;
  artifactPath: string;
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

  let downstream: DirectiveWorkspaceResolvedFocus | null = null;
  const discoveryHeldDownstreamPath =
    !routing.downstreamStubRelativePath
      && effectiveRouteDestination === "monitor"
      && queueEntry?.result_record_path?.startsWith("discovery/04-monitor/")
      ? queueEntry.result_record_path
      : null;
  const downstreamResolutionPath = routing.downstreamStubRelativePath ?? discoveryHeldDownstreamPath;
  if (downstreamResolutionPath) {
    try {
      downstream = resolveDirectiveWorkspaceState({
        directiveRoot: input.directiveRoot,
        artifactPath: downstreamResolutionPath,
        includeAnchors: false,
      }).focus;
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
  } satisfies Omit<DirectiveWorkspaceResolvedFocus, "integrityState" | "currentHead">);
}

function resolveDiscoveryMonitorFocus(input: {
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
  } satisfies Omit<DirectiveWorkspaceResolvedFocus, "integrityState" | "currentHead">);
}

function resolveEngineFocus(input: {
  directiveRoot: string;
  artifactPath: string;
}) {
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
    artifactKind: "engine_run" as const,
    lane: "engine" as const,
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
  } satisfies Omit<DirectiveWorkspaceResolvedFocus, "integrityState" | "currentHead">);
}

export function resolveDirectiveWorkspaceState(input: {
  directiveRoot?: string;
  artifactPath?: string | null;
  includeAnchors?: boolean;
} = {}): DirectiveWorkspaceStateReport {
  const directiveRoot = normalizePath(input.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const snapshotAt = new Date().toISOString();
  const engineOverview = readDirectiveEngineRunsOverview({
    directiveRoot,
    maxRuns: 8,
  });
  const productTruth = buildDirectiveWorkspaceProductTruth();

  let focus: DirectiveWorkspaceResolvedFocus | null = null;
  if (input.artifactPath) {
    const artifactPath = resolveDirectiveRelativePath(directiveRoot, input.artifactPath, "artifactPath");
    if (artifactPath.startsWith("discovery/03-routing-log/")) {
      focus = resolveDiscoveryFocus({
        directiveRoot,
        artifactPath,
      });
    } else if (artifactPath.startsWith("discovery/04-monitor/")) {
      focus = resolveDiscoveryMonitorFocus({
        directiveRoot,
        artifactPath,
      });
    } else if (artifactPath.startsWith("runtime/standalone-host/engine-runs/") && artifactPath.endsWith(".json")) {
      focus = resolveEngineFocus({
        directiveRoot,
        artifactPath,
      });
    } else if (artifactPath.startsWith("architecture/")) {
      const architecture = resolveArchitectureFocusFromAnyPath({
        directiveRoot,
        artifactPath,
      });
      const queueEntry = findQueueEntryByCandidateId(directiveRoot, architecture.candidateId);
      const architectureArtifactStage = buildArchitectureArtifactStage({
        artifactKind: architecture.artifactKind,
        operatingMode: queueEntry?.operating_mode ?? null,
        result: architecture.result ?? null,
        adoption: architecture.adoption ?? null,
        implementationResult: architecture.implementationResult ?? null,
        consumption: architecture.consumption ?? null,
        evaluation: architecture.evaluation ?? null,
      });
      const engineRun = findLatestEngineRunByCandidateId(directiveRoot, architecture.candidateId);
      const linkedArtifacts = architecture.linked;
      linkedArtifacts.discoveryIntakePath = queueEntry?.intake_record_path ?? null;
      linkedArtifacts.discoveryRoutingPath = queueEntry?.routing_record_path ?? linkedArtifacts.discoveryRoutingPath;
      const routingArtifact = linkedArtifacts.discoveryRoutingPath
        ? readLinkedArtifactIfPresent({
            directiveRoot,
            relativePath: linkedArtifacts.discoveryRoutingPath,
            read: (routingPath) => readDirectiveDiscoveryRoutingArtifact({
              directiveRoot,
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

      focus = finalizeResolvedFocus({
        ok: true,
        directiveRoot,
        artifactPath,
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
    } else if (artifactPath.startsWith("runtime/")) {
      const runtime = resolveRuntimeFocusFromAnyPath({
        directiveRoot,
        artifactPath,
      });
      const runtimeArtifactStage = buildRuntimeArtifactStage({
        directiveRoot,
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
      const queueEntry = findQueueEntryByCandidateId(directiveRoot, runtime.candidateId);
      const engineRun = findLatestEngineRunByCandidateId(directiveRoot, runtime.candidateId);
      const linkedArtifacts = runtime.linked;
      linkedArtifacts.discoveryIntakePath = queueEntry?.intake_record_path ?? null;
      linkedArtifacts.discoveryRoutingPath = queueEntry?.routing_record_path ?? linkedArtifacts.discoveryRoutingPath;
      linkedArtifacts.engineRunRecordPath = engineRun?.recordRelativePath ?? null;
      linkedArtifacts.engineRunReportPath = engineRun?.reportRelativePath ?? null;

      focus = finalizeResolvedFocus({
        ok: true,
        directiveRoot,
        artifactPath,
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
