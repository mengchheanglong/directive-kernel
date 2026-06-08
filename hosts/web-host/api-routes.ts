import type { IncomingMessage, ServerResponse } from "node:http";
import {
  closeArchitectureBoundedStart,
  closeArchitectureNoteHandoff,
  continueArchitectureFromBoundedResult,
} from "../../architecture/lib/experiments/closeout.ts";
import {
  createDirectiveArchitectureImplementationTarget,
} from "../../architecture/lib/materialization/implementation-target.ts";
import {
  createDirectiveArchitectureImplementationResult,
} from "../../architecture/lib/materialization/implementation-result.ts";
import {
  confirmDirectiveArchitectureRetention,
} from "../../architecture/lib/materialization/retention.ts";
import {
  createDirectiveArchitectureIntegrationRecord,
} from "../../architecture/lib/materialization/integration-record.ts";
import {
  recordDirectiveArchitectureConsumption,
} from "../../architecture/lib/materialization/consumption-record.ts";
import {
  evaluateDirectiveArchitectureConsumption,
} from "../../architecture/lib/materialization/post-consumption-evaluation.ts";
import { ARCHITECTURE_DEEP_TAIL_STAGES } from "../../architecture/lib/control/materialization-tail-stage-map.ts";
import {
  reopenDirectiveArchitectureFromEvaluation,
} from "../../architecture/lib/experiments/reopen-from-evaluation.ts";
import { adoptDirectiveArchitectureResult } from "../../architecture/lib/adoption/result-adoption.ts";
import { startDirectiveArchitectureFromHandoff } from "../../architecture/lib/experiments/handoff-start.ts";
import {
  writeDiscoveryRoutingReviewResolution,
} from "../../discovery/lib/routing/review-resolution.ts";
import type { DiscoverySubmissionRequest } from "../../discovery/lib/front-door/submission-router.ts";
import { refreshDiscoveryGapWorklist } from "../../discovery/lib/gaps/gap-worklist-refresh.ts";
import {
  buildOperatorDecisionInboxReport,
} from "../../engine/orchestration/operator-decision-inbox/operator-decision-inbox.ts";
import {
  approveGapFormalization,
  approveMissionFeedbackEntry,
  listMissionEvolutionHistory,
  listPendingGapFormalizationCandidates,
  listMissionFeedbackEntries,
  previewMissionFeedbackEntry,
  rejectGapFormalization,
  rejectMissionFeedbackEntry,
  revertMissionEvolution,
} from "../../engine/mission/index.ts";
import { summarizeKernelStorage } from "../../engine/maintenance/archive.ts";
import { createStandaloneFilesystemHost } from "../standalone-host/filesystem-host.ts";
import {
  readDirectiveFrontendDiscoveryRoutingDetail,
  readDirectiveFrontendRuntimeRecordDetail,
  readDirectiveFrontendRuntimeProofDetail,
  readDirectiveFrontendRuntimeRuntimeCapabilityBoundaryDetail,
  readDirectiveFrontendRuntimePromotionReadinessDetail,
  readDirectiveFrontendArchitectureResultDetail,
  readDirectiveFrontendArchitectureStartDetail,
  readDirectiveFrontendArchitectureAdoptionDetail,
  readDirectiveFrontendArchitectureImplementationTargetDetail,
  readDirectiveFrontendArchitectureImplementationResultDetail,
  readDirectiveFrontendArchitectureRetentionDetail,
  readDirectiveFrontendArchitectureIntegrationRecordDetail,
  readDirectiveFrontendArchitectureConsumptionRecordDetail,
  readDirectiveFrontendArchitecturePostConsumptionEvaluationDetail,
  readDirectiveFrontendArtifactText,
  readDirectiveFrontendHandoffDetail,
  readDirectiveFrontendQueueEntry,
  readDirectiveFrontendRunDetail,
  readDirectiveFrontendSnapshot,
} from "./data/snapshot.ts";
import { buildApiManifest } from "./api-manifest.ts";
import { parseJsonBody, readBody, writeJson } from "./http-support.ts";

type RuntimeHost = ReturnType<typeof createStandaloneFilesystemHost>;

export async function handleDirectiveUiApiRequest(input: {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  pathname: string;
  url: URL;
  directiveRoot: string;
  runtimeHost: RuntimeHost;
  uiOperatorActor: string;
}) {
  const {
    req,
    res,
    method,
    pathname,
    url,
    directiveRoot,
    runtimeHost,
    uiOperatorActor,
  } = input;

  if (method === "GET" && pathname === "/api/runtime/status") {
    writeJson(res, 200, {
      ok: true,
      storage: summarizeKernelStorage(directiveRoot),
    });
    return true;
  }

  if (method === "GET" && pathname === "/api/manifest") {
    writeJson(res, 200, buildApiManifest());
    return true;
  }

  if (method === "GET" && pathname === "/api/snapshot") {
    writeJson(res, 200, readDirectiveFrontendSnapshot({ directiveRoot, maxRuns: 200, maxQueueEntries: 500, maxHandoffs: 250 }));
    return true;
  }
  if (method === "GET" && pathname === "/api/operator-decision-inbox") {
    writeJson(res, 200, buildOperatorDecisionInboxReport({ directiveRoot }));
    return true;
  }
  if (method === "GET" && pathname === "/api/mission/feedback") {
    writeJson(res, 200, listMissionFeedbackEntries({ directiveRoot }));
    return true;
  }
  if (method === "GET" && pathname === "/api/mission/history") {
    writeJson(res, 200, listMissionEvolutionHistory({ directiveRoot }));
    return true;
  }
  if (method === "GET" && pathname === "/api/gaps/pending") {
    writeJson(res, 200, listPendingGapFormalizationCandidates({ directiveRoot }));
    return true;
  }
  if (method === "GET" && pathname === "/api/engine-runs") {
    writeJson(res, 200, readDirectiveFrontendSnapshot({ directiveRoot, maxRuns: 200 }).engineRuns);
    return true;
  }
  if (method === "GET" && pathname.startsWith("/api/engine-runs/")) {
    writeJson(res, 200, readDirectiveFrontendRunDetail({
      directiveRoot,
      runId: decodeURIComponent(pathname.replace(/^\/api\/engine-runs\//, "")),
    }));
    return true;
  }
  if (method === "POST" && pathname.startsWith("/api/engine-runs/") && pathname.endsWith("/plan-progress")) {
    const runId = decodeURIComponent(
      pathname
        .replace(/^\/api\/engine-runs\//, "")
        .replace(/\/plan-progress$/u, ""),
    );
    const payload = parseJsonBody<{
      updates: import("../../engine/index.ts").EnginePlanProgressUpdate[];
      at?: string | null;
    }>(await readBody(req));
    writeJson(res, 200, {
      ok: true,
      record: await runtimeHost.updateEnginePlanProgress({
        runId,
        updates: payload.updates,
        at: payload.at,
      }),
    });
    return true;
  }
  if (method === "POST" && pathname.startsWith("/api/engine-runs/") && pathname.endsWith("/reroute")) {
    const runId = decodeURIComponent(
      pathname
        .replace(/^\/api\/engine-runs\//, "")
        .replace(/\/reroute$/u, ""),
    );
    const payload = parseJsonBody<{
      answers: Record<string, unknown>;
      receivedAt?: string | null;
    }>(await readBody(req));
    writeJson(res, 200, {
      ok: true,
      result: await runtimeHost.reRouteEngineRunWithAnswers({
        runId,
        answers: payload.answers,
        receivedAt: payload.receivedAt,
      }),
    });
    return true;
  }
  if (method === "GET" && pathname === "/api/queue") {
    writeJson(res, 200, readDirectiveFrontendSnapshot({ directiveRoot, maxQueueEntries: 500 }).queue);
    return true;
  }
  if (method === "GET" && pathname === "/api/queue-entry") {
    writeJson(res, 200, readDirectiveFrontendQueueEntry({
      directiveRoot,
      candidateId: String(url.searchParams.get("candidateId") || "").trim(),
    }));
    return true;
  }
  if (method === "GET" && pathname === "/api/discovery-routing-records/detail") {
    writeJson(res, 200, readDirectiveFrontendDiscoveryRoutingDetail({
      directiveRoot,
      relativePath: String(url.searchParams.get("path") || "").trim(),
    }));
    return true;
  }
  if (method === "GET" && pathname === "/api/handoffs") {
    const snapshot = readDirectiveFrontendSnapshot({ directiveRoot, maxHandoffs: 250 });
    writeJson(res, 200, snapshot.handoffStubs);
    return true;
  }
  if (method === "GET" && pathname === "/api/handoffs/detail") {
    writeJson(res, 200, readDirectiveFrontendHandoffDetail({
      directiveRoot,
      relativePath: String(url.searchParams.get("path") || "").trim(),
    }));
    return true;
  }
  if (method === "GET" && pathname === "/api/runtime-records/detail") {
    writeJson(res, 200, readDirectiveFrontendRuntimeRecordDetail({
      directiveRoot,
      relativePath: String(url.searchParams.get("path") || "").trim(),
    }));
    return true;
  }
  if (method === "GET" && pathname === "/api/runtime-proofs/detail") {
    writeJson(res, 200, readDirectiveFrontendRuntimeProofDetail({
      directiveRoot,
      relativePath: String(url.searchParams.get("path") || "").trim(),
    }));
    return true;
  }
  if (method === "GET" && pathname === "/api/runtime-runtime-capability-boundaries/detail") {
    writeJson(res, 200, readDirectiveFrontendRuntimeRuntimeCapabilityBoundaryDetail({
      directiveRoot,
      relativePath: String(url.searchParams.get("path") || "").trim(),
    }));
    return true;
  }
  if (method === "GET" && pathname === "/api/runtime-promotion-readiness/detail") {
    writeJson(res, 200, readDirectiveFrontendRuntimePromotionReadinessDetail({
      directiveRoot,
      relativePath: String(url.searchParams.get("path") || "").trim(),
    }));
    return true;
  }
  if (method === "GET" && pathname === "/api/architecture-starts/detail") {
    writeJson(res, 200, readDirectiveFrontendArchitectureStartDetail({
      directiveRoot,
      relativePath: String(url.searchParams.get("path") || "").trim(),
    }));
    return true;
  }
  if (method === "GET" && pathname === "/api/architecture-results/detail") {
    writeJson(res, 200, readDirectiveFrontendArchitectureResultDetail({
      directiveRoot,
      relativePath: String(url.searchParams.get("path") || "").trim(),
    }));
    return true;
  }
  if (method === "GET" && pathname === "/api/architecture-adoptions/detail") {
    writeJson(res, 200, readDirectiveFrontendArchitectureAdoptionDetail({
      directiveRoot,
      relativePath: String(url.searchParams.get("path") || "").trim(),
    }));
    return true;
  }
  {
    const deepTailDetailHandlers: Record<string, (input: { directiveRoot: string; relativePath: string }) => unknown> = {
      [ARCHITECTURE_DEEP_TAIL_STAGES[0].apiRouteSegment]: readDirectiveFrontendArchitectureImplementationTargetDetail,
      [ARCHITECTURE_DEEP_TAIL_STAGES[1].apiRouteSegment]: readDirectiveFrontendArchitectureImplementationResultDetail,
      [ARCHITECTURE_DEEP_TAIL_STAGES[2].apiRouteSegment]: readDirectiveFrontendArchitectureRetentionDetail,
      [ARCHITECTURE_DEEP_TAIL_STAGES[3].apiRouteSegment]: readDirectiveFrontendArchitectureIntegrationRecordDetail,
      [ARCHITECTURE_DEEP_TAIL_STAGES[4].apiRouteSegment]: readDirectiveFrontendArchitectureConsumptionRecordDetail,
      [ARCHITECTURE_DEEP_TAIL_STAGES[5].apiRouteSegment]: readDirectiveFrontendArchitecturePostConsumptionEvaluationDetail,
    };
    for (const [segment, handler] of Object.entries(deepTailDetailHandlers)) {
      if (method === "GET" && pathname === `/api/${segment}/detail`) {
        writeJson(res, 200, handler({
          directiveRoot,
          relativePath: String(url.searchParams.get("path") || "").trim(),
        }));
        return true;
      }
    }
  }
  if (method === "GET" && pathname === "/api/artifacts") {
    writeJson(res, 200, readDirectiveFrontendArtifactText({
      directiveRoot,
      relativePath: String(url.searchParams.get("path") || "").trim(),
    }));
    return true;
  }

  if (method === "POST" && pathname === "/api/discovery/submissions") {
    const payload = parseJsonBody<DiscoverySubmissionRequest>(await readBody(req));
    const processWithEngine = url.searchParams.get("process_with_engine") === "1";
    const result = processWithEngine
      ? await runtimeHost.submitDiscoveryEntryWithEngine(payload, false)
      : await runtimeHost.submitDiscoveryEntry(payload, false);
    writeJson(res, 200, result);
    return true;
  }
  if (method === "POST" && pathname === "/api/mission/preview") {
    const payload = parseJsonBody<{ feedbackId: string }>(await readBody(req));
    writeJson(res, 200, previewMissionFeedbackEntry({
      directiveRoot,
      feedbackId: payload.feedbackId,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/mission/approve") {
    const payload = parseJsonBody<{
      feedbackId: string;
      rationale: string;
      cascadeScope?: "none" | "low_confidence" | "conflicted" | "discovery_held";
      approvedRunIds?: string[];
    }>(await readBody(req));
    writeJson(res, 200, approveMissionFeedbackEntry({
      directiveRoot,
      feedbackId: payload.feedbackId,
      operatorRationale: payload.rationale,
      cascadeScope: payload.cascadeScope,
      approvedRunIds: payload.approvedRunIds ?? [],
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/mission/reject") {
    const payload = parseJsonBody<{ feedbackId: string; rationale: string }>(await readBody(req));
    writeJson(res, 200, rejectMissionFeedbackEntry({
      directiveRoot,
      feedbackId: payload.feedbackId,
      operatorRationale: payload.rationale,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/mission/revert") {
    const payload = parseJsonBody<{ rationale: string }>(await readBody(req));
    writeJson(res, 200, revertMissionEvolution({
      directiveRoot,
      operatorRationale: payload.rationale,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/gaps/approve") {
    const payload = parseJsonBody<{
      formalizationId: string;
      rationale: string;
      priority: "high" | "medium" | "low";
    }>(await readBody(req));
    const result = await approveGapFormalization({
      directiveRoot,
      formalizationId: payload.formalizationId,
      operatorRationale: payload.rationale,
      operatorApprovedPriority: payload.priority,
    });
    const refreshedWorklist = refreshDiscoveryGapWorklist({
      directiveRoot,
    });
    writeJson(res, 200, {
      ...result,
      refreshedWorklist,
    });
    return true;
  }
  if (method === "POST" && pathname === "/api/gaps/reject") {
    const payload = parseJsonBody<{ formalizationId: string; rationale: string }>(await readBody(req));
    writeJson(res, 200, rejectGapFormalization({
      directiveRoot,
      formalizationId: payload.formalizationId,
      operatorRationale: payload.rationale,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/discovery/front-door") {
    const payload = parseJsonBody<DiscoverySubmissionRequest>(await readBody(req));
    writeJson(res, 200, await runtimeHost.submitDiscoveryFrontDoor(payload));
    return true;
  }
  if (method === "POST" && pathname === "/api/discovery/open-route") {
    const payload = parseJsonBody<{
      routingPath: string;
      approved?: boolean;
    }>(await readBody(req));
    writeJson(res, 200, await runtimeHost.openDiscoveryRoute({
      routingPath: payload.routingPath,
      approved: payload.approved,
      approvedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/discovery/resolve-routing-review") {
    const payload = parseJsonBody<{
      routingRecordPath: string;
      decision:
        | "confirm_architecture"
        | "confirm_runtime"
        | "redirect_to_architecture"
        | "redirect_to_runtime"
        | "reject"
        | "defer";
      rationale: string;
      reviewedBy?: string;
      resolvedConfidence?: "high" | "medium" | "low";
    }>(await readBody(req));
    writeJson(res, 200, writeDiscoveryRoutingReviewResolution({
      directiveRoot,
      routingRecordPath: payload.routingRecordPath,
      decision: payload.decision,
      rationale: payload.rationale,
      reviewedBy: payload.reviewedBy ?? uiOperatorActor,
      resolvedConfidence: payload.resolvedConfidence,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/runtime/open-follow-up") {
    const payload = parseJsonBody<{
      followUpPath: string;
      approved?: boolean;
    }>(await readBody(req));
    writeJson(res, 200, await runtimeHost.openRuntimeFollowUp({
      followUpPath: payload.followUpPath,
      approved: payload.approved,
      approvedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/runtime/open-proof") {
    const payload = parseJsonBody<{
      runtimeRecordPath: string;
      approved?: boolean;
    }>(await readBody(req));
    writeJson(res, 200, await runtimeHost.openRuntimeRecordProof({
      runtimeRecordPath: payload.runtimeRecordPath,
      approved: payload.approved,
      approvedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/runtime/open-runtime-capability-boundary") {
    const payload = parseJsonBody<{
      runtimeProofPath: string;
      approved?: boolean;
    }>(await readBody(req));
    writeJson(res, 200, await runtimeHost.openRuntimeProofRuntimeCapabilityBoundary({
      runtimeProofPath: payload.runtimeProofPath,
      approved: payload.approved,
      approvedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/runtime/open-promotion-readiness") {
    const payload = parseJsonBody<{
      capabilityBoundaryPath: string;
      approved?: boolean;
    }>(await readBody(req));
    writeJson(res, 200, await runtimeHost.openRuntimePromotionReadiness({
      capabilityBoundaryPath: payload.capabilityBoundaryPath,
      approved: payload.approved,
      approvedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/runtime/selection-resolutions") {
    const payload = parseJsonBody<{
      promotionReadinessPath: string;
      decision:
        | "select_standalone"
        | "select_web"
        | "confirm_inferred"
        | "override"
        | "defer";
      selectedHost?: string;
      rationale: string;
      reviewedBy?: string;
      resolvedConfidence?: "high" | "medium" | "low";
    }>(await readBody(req));
    writeJson(res, 200, await runtimeHost.writeRuntimeHostSelectionResolution({
      promotionReadinessPath: payload.promotionReadinessPath,
      decision: payload.decision,
      selectedHost: payload.selectedHost ?? "",
      rationale: payload.rationale,
      reviewedBy: payload.reviewedBy ?? uiOperatorActor,
      resolvedConfidence: payload.resolvedConfidence,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/runtime/promotion-seam-decisions") {
    const payload = parseJsonBody<{
      promotionReadinessPath: string;
      rationale: string;
      approvedBy?: string;
    }>(await readBody(req));
    writeJson(res, 200, await runtimeHost.writeRuntimePromotionSeamDecision({
      promotionReadinessPath: payload.promotionReadinessPath,
      rationale: payload.rationale,
      approvedBy: payload.approvedBy ?? uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/runtime/registry-acceptance-decisions") {
    const payload = parseJsonBody<{
      promotionRecordPath: string;
      rationale: string;
      acceptedBy?: string;
    }>(await readBody(req));
    writeJson(res, 200, await runtimeHost.writeRuntimeRegistryAcceptanceDecision({
      promotionRecordPath: payload.promotionRecordPath,
      rationale: payload.rationale,
      acceptedBy: payload.acceptedBy ?? uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/architecture/handoff-start") {
    const payload = parseJsonBody<{ handoffPath: string }>(await readBody(req));
    writeJson(res, 200, startDirectiveArchitectureFromHandoff({
      directiveRoot,
      handoffPath: payload.handoffPath,
      startedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/architecture/bounded-closeout") {
    const payload = parseJsonBody<{
      startPath: string;
      resultSummary: string;
      primaryEvidencePath?: string;
      transformedArtifactsProduced?: string[];
      nextDecision?: "needs-more-evidence" | "adopt" | "defer" | "reject";
      valueShape?: "interface_or_handoff" | "data_shape" | "working_document" | "behavior_rule" | "design_pattern" | "executable_logic" | "operating_model_change";
      adaptationQuality?: "strong" | "adequate" | "weak" | "skipped";
      improvementQuality?: "strong" | "adequate" | "weak" | "skipped";
      proofExecuted?: boolean;
      targetArtifactClarified?: boolean;
      deltaEvidencePresent?: boolean;
      noUnresolvedBaggage?: boolean;
      productArtifactMaterialized?: boolean;
    }>(await readBody(req));
    writeJson(res, 200, closeArchitectureBoundedStart({
      directiveRoot,
      startPath: payload.startPath,
      resultSummary: payload.resultSummary,
      primaryEvidencePath: payload.primaryEvidencePath,
      transformedArtifactsProduced: payload.transformedArtifactsProduced,
      nextDecision: payload.nextDecision,
      valueShape: payload.valueShape,
      adaptationQuality: payload.adaptationQuality,
      improvementQuality: payload.improvementQuality,
      proofExecuted: payload.proofExecuted,
      targetArtifactClarified: payload.targetArtifactClarified,
      deltaEvidencePresent: payload.deltaEvidencePresent,
      noUnresolvedBaggage: payload.noUnresolvedBaggage,
      productArtifactMaterialized: payload.productArtifactMaterialized,
      closedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/architecture/note-handoff-closeout") {
    const payload = parseJsonBody<{
      handoffPath: string;
      resultSummary: string;
      primaryEvidencePath?: string;
      transformedArtifactsProduced?: string[];
      nextDecision?: "needs-more-evidence" | "adopt" | "defer" | "reject";
      valueShape?: "interface_or_handoff" | "data_shape" | "working_document" | "behavior_rule" | "design_pattern" | "executable_logic" | "operating_model_change";
      adaptationQuality?: "strong" | "adequate" | "weak" | "skipped";
      improvementQuality?: "strong" | "adequate" | "weak" | "skipped";
      proofExecuted?: boolean;
      targetArtifactClarified?: boolean;
      deltaEvidencePresent?: boolean;
      noUnresolvedBaggage?: boolean;
      productArtifactMaterialized?: boolean;
    }>(await readBody(req));
    writeJson(res, 200, await closeArchitectureNoteHandoff({
      directiveRoot,
      handoffPath: payload.handoffPath,
      resultSummary: payload.resultSummary,
      primaryEvidencePath: payload.primaryEvidencePath,
      transformedArtifactsProduced: payload.transformedArtifactsProduced,
      nextDecision: payload.nextDecision,
      valueShape: payload.valueShape,
      adaptationQuality: payload.adaptationQuality,
      improvementQuality: payload.improvementQuality,
      proofExecuted: payload.proofExecuted,
      targetArtifactClarified: payload.targetArtifactClarified,
      deltaEvidencePresent: payload.deltaEvidencePresent,
      noUnresolvedBaggage: payload.noUnresolvedBaggage,
      productArtifactMaterialized: payload.productArtifactMaterialized,
      closedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/architecture/bounded-continuation") {
    const payload = parseJsonBody<{ resultPath: string }>(await readBody(req));
    writeJson(res, 200, continueArchitectureFromBoundedResult({
      directiveRoot,
      resultPath: payload.resultPath,
      continuedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/architecture/adopt-result") {
    const payload = parseJsonBody<{ resultPath: string }>(await readBody(req));
    writeJson(res, 200, adoptDirectiveArchitectureResult({
      directiveRoot,
      resultPath: payload.resultPath,
      adoptedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/architecture/create-implementation-target") {
    const payload = parseJsonBody<{
      adoptionPath: string;
      selectedBoundedSlice?: string[];
      mechanicalSuccessCriteria?: string[];
      explicitLimitations?: string[];
    }>(await readBody(req));
    writeJson(res, 200, createDirectiveArchitectureImplementationTarget({
      directiveRoot,
      adoptionPath: payload.adoptionPath,
      selectedBoundedSlice: payload.selectedBoundedSlice,
      mechanicalSuccessCriteria: payload.mechanicalSuccessCriteria,
      explicitLimitations: payload.explicitLimitations,
      createdBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/architecture/create-implementation-result") {
    const payload = parseJsonBody<{
      targetPath: string;
      resultSummary: string;
      outcome?: "success" | "failure";
      deviations?: string;
      evidence?: string;
      validationResult?: string;
      rollbackNote?: string;
    }>(await readBody(req));
    writeJson(res, 200, createDirectiveArchitectureImplementationResult({
      directiveRoot,
      targetPath: payload.targetPath,
      resultSummary: payload.resultSummary,
      outcome: payload.outcome,
      deviations: payload.deviations,
      evidence: payload.evidence,
      validationResult: payload.validationResult,
      rollbackNote: payload.rollbackNote,
      completedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/architecture/confirm-retention") {
    const payload = parseJsonBody<{
      resultPath: string;
      usefulnessAssessment?: string;
      stabilityLevel?: "stable" | "bounded-stable" | "provisional";
      reuseScope?: string;
      confirmationDecision?: string;
      rollbackBoundary?: string;
    }>(await readBody(req));
    writeJson(res, 200, confirmDirectiveArchitectureRetention({
      directiveRoot,
      resultPath: payload.resultPath,
      usefulnessAssessment: payload.usefulnessAssessment,
      stabilityLevel: payload.stabilityLevel,
      reuseScope: payload.reuseScope,
      confirmationDecision: payload.confirmationDecision,
      rollbackBoundary: payload.rollbackBoundary,
      confirmedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/architecture/create-integration-record") {
    const payload = parseJsonBody<{
      retainedPath: string;
      integrationTargetSurface?: string;
      readinessSummary?: string;
      expectedEffect?: string;
      validationBoundary?: string;
      integrationDecision?: string;
      rollbackBoundary?: string;
    }>(await readBody(req));
    writeJson(res, 200, createDirectiveArchitectureIntegrationRecord({
      directiveRoot,
      retainedPath: payload.retainedPath,
      integrationTargetSurface: payload.integrationTargetSurface,
      readinessSummary: payload.readinessSummary,
      expectedEffect: payload.expectedEffect,
      validationBoundary: payload.validationBoundary,
      integrationDecision: payload.integrationDecision,
      rollbackBoundary: payload.rollbackBoundary,
      createdBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/architecture/record-consumption") {
    const payload = parseJsonBody<{
      integrationPath: string;
      appliedSurface?: string;
      applicationSummary?: string;
      observedEffect?: string;
      validationResult?: string;
      outcome?: "success" | "failure";
      rollbackNote?: string;
    }>(await readBody(req));
    writeJson(res, 200, recordDirectiveArchitectureConsumption({
      directiveRoot,
      integrationPath: payload.integrationPath,
      appliedSurface: payload.appliedSurface,
      applicationSummary: payload.applicationSummary,
      observedEffect: payload.observedEffect,
      validationResult: payload.validationResult,
      outcome: payload.outcome,
      rollbackNote: payload.rollbackNote,
      recordedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/architecture/evaluate-consumption") {
    const payload = parseJsonBody<{
      consumptionPath: string;
      decision?: "keep" | "reopen";
      rationale?: string;
      observedStability?: string;
      retainedUsefulnessAssessment?: string;
      nextBoundedAction?: string;
      rollbackNote?: string;
    }>(await readBody(req));
    writeJson(res, 200, evaluateDirectiveArchitectureConsumption({
      directiveRoot,
      consumptionPath: payload.consumptionPath,
      decision: payload.decision,
      rationale: payload.rationale,
      observedStability: payload.observedStability,
      retainedUsefulnessAssessment: payload.retainedUsefulnessAssessment,
      nextBoundedAction: payload.nextBoundedAction,
      rollbackNote: payload.rollbackNote,
      evaluatedBy: uiOperatorActor,
    }));
    return true;
  }
  if (method === "POST" && pathname === "/api/architecture/reopen-from-evaluation") {
    const payload = parseJsonBody<{ evaluationPath: string }>(await readBody(req));
    writeJson(res, 200, reopenDirectiveArchitectureFromEvaluation({
      directiveRoot,
      evaluationPath: payload.evaluationPath,
      reopenedBy: uiOperatorActor,
    }));
    return true;
  }

  if (pathname.startsWith("/api/")) {
    writeJson(res, 404, { ok: false, error: "not_found" });
    return true;
  }

  return false;
}
