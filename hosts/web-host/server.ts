import fs from "node:fs";
import http, { type IncomingMessage, type Server as NodeHttpServer, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

import type { DiscoverySubmissionRequest } from "../../discovery/lib/discovery-submission-router.ts";
import {
  closeDirectiveArchitectureBoundedStart,
  closeDirectiveArchitectureNoteHandoff,
  continueDirectiveArchitectureFromBoundedResult,
} from "../../architecture/lib/architecture-bounded-closeout.ts";
import {
  createDirectiveArchitectureImplementationTarget,
} from "../../architecture/lib/architecture-implementation-target.ts";
import {
  createDirectiveArchitectureImplementationResult,
} from "../../architecture/lib/architecture-implementation-result.ts";
import {
  confirmDirectiveArchitectureRetention,
} from "../../architecture/lib/architecture-retention.ts";
import {
  createDirectiveArchitectureIntegrationRecord,
} from "../../architecture/lib/architecture-integration-record.ts";
import {
  recordDirectiveArchitectureConsumption,
} from "../../architecture/lib/architecture-consumption-record.ts";
import {
  evaluateDirectiveArchitectureConsumption,
} from "../../architecture/lib/architecture-post-consumption-evaluation.ts";
import { ARCHITECTURE_DEEP_TAIL_STAGES } from "../../architecture/lib/architecture-deep-tail-stage-map.ts";
import {
  reopenDirectiveArchitectureFromEvaluation,
} from "../../architecture/lib/architecture-reopen-from-evaluation.ts";
import { adoptDirectiveArchitectureResult } from "../../architecture/lib/architecture-result-adoption.ts";
import { startDirectiveArchitectureFromHandoff } from "../../architecture/lib/architecture-handoff-start.ts";
import { createStandaloneFilesystemHost } from "../standalone-host/runtime.ts";
import {
  buildOperatorDecisionInboxReport,
} from "../../engine/coordination/operator-decision-inbox.ts";
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
} from "./data.ts";

export type StartDirectiveUiServerOptions = {
  directiveRoot: string;
  host?: string;
  port?: number;
};

export type DirectiveUiServerHandle = {
  server: NodeHttpServer;
  host: string;
  port: number;
  origin: string;
  directiveRoot: string;
  close(): Promise<void>;
};

export type StartDirectiveFrontendServerOptions = StartDirectiveUiServerOptions;
export type DirectiveFrontendServerHandle = DirectiveUiServerHandle;

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const UI_APP_ROOT = path.resolve(MODULE_DIR, "..", "..", "ui");
const UI_DIST_ROOT = path.join(UI_APP_ROOT, "dist");
const UI_INDEX_PATH = path.join(UI_DIST_ROOT, "index.html");
const UI_OPERATOR_ACTOR = "directive-ui-operator";

function writeJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function writeHtml(res: ServerResponse, statusCode: number, html: string) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html>${html}`);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("request_body_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function parseJsonBody<T>(body: string) {
  return JSON.parse(body) as T;
}

function resolveApiErrorStatus(error: unknown) {
  const message = String((error as Error)?.message || error || "").toLowerCase();
  if (
    message.includes("already contains")
    || message.includes("equivalent submission")
    || message.includes("duplicate")
  ) {
    return 409;
  }
  if (
    message.includes("invalid_input")
    || message.includes("missing_")
    || message.includes("required")
    || message.includes("request_body_too_large")
  ) {
    return 400;
  }
  if (message.includes("not found") || message.includes("not_found")) {
    return 404;
  }
  return 500;
}

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function resolveStaticFile(requestPath: string) {
  const candidate = decodeURIComponent(requestPath).replace(/^\/+/, "");
  const absolutePath = path.resolve(UI_DIST_ROOT, candidate);
  const prefix = `${normalizeAbsolutePath(UI_DIST_ROOT)}/`;
  const normalized = normalizeAbsolutePath(absolutePath);
  if (normalized !== normalizeAbsolutePath(UI_DIST_ROOT) && !normalized.startsWith(prefix)) {
    return null;
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return null;
  }
  return absolutePath;
}

function writeStaticFile(res: ServerResponse, filePath: string) {
  res.statusCode = 200;
  res.setHeader("content-type", getContentType(filePath));
  fs.createReadStream(filePath).pipe(res);
}

function renderMissingBuildPage(directiveRoot: string) {
  const escapedRoot = escapeHtml(normalizeAbsolutePath(directiveRoot));
  return `<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Directive Kernel UI Build Missing</title><style>body{font-family:ui-monospace,Consolas,monospace;margin:32px;background:#f6f4ee;color:#1f1c16}main{max-width:960px;margin:0 auto}section{background:#fffdf7;border:1px solid #d9d0bf;border-radius:10px;padding:16px}pre{background:#faf7ef;border:1px solid #e1d8c7;border-radius:8px;padding:12px;white-space:pre-wrap}</style></head><body><main><section><h1>Directive Kernel UI Build Missing</h1><p>The standalone UI host is running, but the Vite UI has not been built yet.</p><p>Run these commands from the current Directive Kernel product root.</p><pre>cd ${escapedRoot}
pnpm install
pnpm run ui:build
node --experimental-strip-types ./hosts/web-host/cli.ts serve --directive-root ${escapedRoot}</pre></section></main></body></html>`;
}

export function startDirectiveUiServer(
  options: StartDirectiveUiServerOptions,
): Promise<DirectiveUiServerHandle> {
  const directiveRoot = normalizeAbsolutePath(options.directiveRoot);
  const host = options.host || "127.0.0.1";
  const port = options.port ?? 0;
  const runtimeHost = createStandaloneFilesystemHost({ directiveRoot });

  const server = http.createServer(async (req, res) => {
    const method = req.method || "GET";
    const url = new URL(req.url || "/", `http://${host}:${port || 0}`);
    const pathname = url.pathname;

    try {
      if (method === "GET" && pathname === "/api/snapshot") {
        return void writeJson(res, 200, readDirectiveFrontendSnapshot({ directiveRoot, maxRuns: 200, maxQueueEntries: 500, maxHandoffs: 250 }));
      }
      if (method === "GET" && pathname === "/api/operator-decision-inbox") {
        return void writeJson(res, 200, buildOperatorDecisionInboxReport({ directiveRoot }));
      }
      if (method === "GET" && pathname === "/api/engine-runs") {
        return void writeJson(res, 200, readDirectiveFrontendSnapshot({ directiveRoot, maxRuns: 200 }).engineRuns);
      }
      if (method === "GET" && pathname.startsWith("/api/engine-runs/")) {
        return void writeJson(res, 200, readDirectiveFrontendRunDetail({
          directiveRoot,
          runId: decodeURIComponent(pathname.replace(/^\/api\/engine-runs\//, "")),
        }));
      }
      if (method === "GET" && pathname === "/api/queue") {
        return void writeJson(res, 200, readDirectiveFrontendSnapshot({ directiveRoot, maxQueueEntries: 500 }).queue);
      }
      if (method === "GET" && pathname === "/api/queue-entry") {
        return void writeJson(res, 200, readDirectiveFrontendQueueEntry({
          directiveRoot,
          candidateId: String(url.searchParams.get("candidateId") || "").trim(),
        }));
      }
      if (method === "GET" && pathname === "/api/discovery-routing-records/detail") {
        return void writeJson(res, 200, readDirectiveFrontendDiscoveryRoutingDetail({
          directiveRoot,
          relativePath: String(url.searchParams.get("path") || "").trim(),
        }));
      }
      if (method === "GET" && pathname === "/api/handoffs") {
        const snapshot = readDirectiveFrontendSnapshot({ directiveRoot, maxHandoffs: 250 });
        return void writeJson(res, 200, snapshot.handoffStubs);
      }
      if (method === "GET" && pathname === "/api/handoffs/detail") {
        return void writeJson(res, 200, readDirectiveFrontendHandoffDetail({
          directiveRoot,
          relativePath: String(url.searchParams.get("path") || "").trim(),
        }));
      }
      if (method === "GET" && pathname === "/api/runtime-records/detail") {
        return void writeJson(res, 200, readDirectiveFrontendRuntimeRecordDetail({
          directiveRoot,
          relativePath: String(url.searchParams.get("path") || "").trim(),
        }));
      }
      if (method === "GET" && pathname === "/api/runtime-proofs/detail") {
        return void writeJson(res, 200, readDirectiveFrontendRuntimeProofDetail({
          directiveRoot,
          relativePath: String(url.searchParams.get("path") || "").trim(),
        }));
      }
      if (method === "GET" && pathname === "/api/runtime-runtime-capability-boundaries/detail") {
        return void writeJson(res, 200, readDirectiveFrontendRuntimeRuntimeCapabilityBoundaryDetail({
          directiveRoot,
          relativePath: String(url.searchParams.get("path") || "").trim(),
        }));
      }
      if (method === "GET" && pathname === "/api/runtime-promotion-readiness/detail") {
        return void writeJson(res, 200, readDirectiveFrontendRuntimePromotionReadinessDetail({
          directiveRoot,
          relativePath: String(url.searchParams.get("path") || "").trim(),
        }));
      }
      if (method === "GET" && pathname === "/api/architecture-starts/detail") {
        return void writeJson(res, 200, readDirectiveFrontendArchitectureStartDetail({
          directiveRoot,
          relativePath: String(url.searchParams.get("path") || "").trim(),
        }));
      }
      if (method === "GET" && pathname === "/api/architecture-results/detail") {
        return void writeJson(res, 200, readDirectiveFrontendArchitectureResultDetail({
          directiveRoot,
          relativePath: String(url.searchParams.get("path") || "").trim(),
        }));
      }
      if (method === "GET" && pathname === "/api/architecture-adoptions/detail") {
        return void writeJson(res, 200, readDirectiveFrontendArchitectureAdoptionDetail({
          directiveRoot,
          relativePath: String(url.searchParams.get("path") || "").trim(),
        }));
      }
      // Architecture deep-tail detail routes — dispatched via canonical stage map
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
            return void writeJson(res, 200, handler({
              directiveRoot,
              relativePath: String(url.searchParams.get("path") || "").trim(),
            }));
          }
        }
      }
      if (method === "GET" && pathname === "/api/artifacts") {
        return void writeJson(res, 200, readDirectiveFrontendArtifactText({
          directiveRoot,
          relativePath: String(url.searchParams.get("path") || "").trim(),
        }));
      }

      if (method === "POST" && pathname === "/api/discovery/submissions") {
        const payload = parseJsonBody<DiscoverySubmissionRequest>(await readBody(req));
        const processWithEngine = url.searchParams.get("process_with_engine") === "1";
        const result = processWithEngine
          ? await runtimeHost.submitDiscoveryEntryWithEngine(payload, false)
          : await runtimeHost.submitDiscoveryEntry(payload, false);
        return void writeJson(res, 200, result);
      }
      if (method === "POST" && pathname === "/api/discovery/front-door") {
        const payload = parseJsonBody<DiscoverySubmissionRequest>(await readBody(req));
        return void writeJson(res, 200, await runtimeHost.submitDiscoveryFrontDoor(payload));
      }
      if (method === "POST" && pathname === "/api/discovery/open-route") {
        const payload = parseJsonBody<{
          routingPath: string;
          approved?: boolean;
        }>(await readBody(req));
        return void writeJson(res, 200, await runtimeHost.openDiscoveryRoute({
          routingPath: payload.routingPath,
          approved: payload.approved,
          approvedBy: UI_OPERATOR_ACTOR,
        }));
      }
      if (method === "POST" && pathname === "/api/runtime/open-follow-up") {
        const payload = parseJsonBody<{
          followUpPath: string;
          approved?: boolean;
        }>(await readBody(req));
        return void writeJson(res, 200, await runtimeHost.openRuntimeFollowUp({
          followUpPath: payload.followUpPath,
          approved: payload.approved,
          approvedBy: UI_OPERATOR_ACTOR,
        }));
      }
      if (method === "POST" && pathname === "/api/runtime/open-proof") {
        const payload = parseJsonBody<{
          runtimeRecordPath: string;
          approved?: boolean;
        }>(await readBody(req));
        return void writeJson(res, 200, await runtimeHost.openRuntimeRecordProof({
          runtimeRecordPath: payload.runtimeRecordPath,
          approved: payload.approved,
          approvedBy: UI_OPERATOR_ACTOR,
        }));
      }
      if (method === "POST" && pathname === "/api/runtime/open-runtime-capability-boundary") {
        const payload = parseJsonBody<{
          runtimeProofPath: string;
          approved?: boolean;
        }>(await readBody(req));
        return void writeJson(res, 200, await runtimeHost.openRuntimeProofRuntimeCapabilityBoundary({
          runtimeProofPath: payload.runtimeProofPath,
          approved: payload.approved,
          approvedBy: UI_OPERATOR_ACTOR,
        }));
      }
      if (method === "POST" && pathname === "/api/runtime/open-promotion-readiness") {
        const payload = parseJsonBody<{
          capabilityBoundaryPath: string;
          approved?: boolean;
        }>(await readBody(req));
        return void writeJson(res, 200, await runtimeHost.openRuntimePromotionReadiness({
          capabilityBoundaryPath: payload.capabilityBoundaryPath,
          approved: payload.approved,
          approvedBy: UI_OPERATOR_ACTOR,
        }));
      }

      if (method === "POST" && pathname === "/api/architecture/handoff-start") {
        const payload = parseJsonBody<{ handoffPath: string }>(await readBody(req));
        return void writeJson(res, 200, startDirectiveArchitectureFromHandoff({
          directiveRoot,
          handoffPath: payload.handoffPath,
          startedBy: UI_OPERATOR_ACTOR,
        }));
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
        return void writeJson(res, 200, closeDirectiveArchitectureBoundedStart({
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
          closedBy: UI_OPERATOR_ACTOR,
        }));
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
        return void writeJson(res, 200, closeDirectiveArchitectureNoteHandoff({
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
          closedBy: UI_OPERATOR_ACTOR,
        }));
      }
      if (method === "POST" && pathname === "/api/architecture/bounded-continuation") {
        const payload = parseJsonBody<{
          resultPath: string;
        }>(await readBody(req));
        return void writeJson(res, 200, continueDirectiveArchitectureFromBoundedResult({
          directiveRoot,
          resultPath: payload.resultPath,
          continuedBy: UI_OPERATOR_ACTOR,
        }));
      }
      if (method === "POST" && pathname === "/api/architecture/adopt-result") {
        const payload = parseJsonBody<{
          resultPath: string;
        }>(await readBody(req));
        return void writeJson(res, 200, adoptDirectiveArchitectureResult({
          directiveRoot,
          resultPath: payload.resultPath,
          adoptedBy: UI_OPERATOR_ACTOR,
        }));
      }
      if (method === "POST" && pathname === "/api/architecture/create-implementation-target") {
        const payload = parseJsonBody<{
          adoptionPath: string;
          selectedBoundedSlice?: string[];
          mechanicalSuccessCriteria?: string[];
          explicitLimitations?: string[];
        }>(await readBody(req));
        return void writeJson(res, 200, createDirectiveArchitectureImplementationTarget({
          directiveRoot,
          adoptionPath: payload.adoptionPath,
          selectedBoundedSlice: payload.selectedBoundedSlice,
          mechanicalSuccessCriteria: payload.mechanicalSuccessCriteria,
          explicitLimitations: payload.explicitLimitations,
          createdBy: UI_OPERATOR_ACTOR,
        }));
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
        return void writeJson(res, 200, createDirectiveArchitectureImplementationResult({
          directiveRoot,
          targetPath: payload.targetPath,
          resultSummary: payload.resultSummary,
          outcome: payload.outcome,
          deviations: payload.deviations,
          evidence: payload.evidence,
          validationResult: payload.validationResult,
          rollbackNote: payload.rollbackNote,
          completedBy: UI_OPERATOR_ACTOR,
        }));
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
        return void writeJson(res, 200, confirmDirectiveArchitectureRetention({
          directiveRoot,
          resultPath: payload.resultPath,
          usefulnessAssessment: payload.usefulnessAssessment,
          stabilityLevel: payload.stabilityLevel,
          reuseScope: payload.reuseScope,
          confirmationDecision: payload.confirmationDecision,
          rollbackBoundary: payload.rollbackBoundary,
          confirmedBy: UI_OPERATOR_ACTOR,
        }));
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
        return void writeJson(res, 200, createDirectiveArchitectureIntegrationRecord({
          directiveRoot,
          retainedPath: payload.retainedPath,
          integrationTargetSurface: payload.integrationTargetSurface,
          readinessSummary: payload.readinessSummary,
          expectedEffect: payload.expectedEffect,
          validationBoundary: payload.validationBoundary,
          integrationDecision: payload.integrationDecision,
          rollbackBoundary: payload.rollbackBoundary,
          createdBy: UI_OPERATOR_ACTOR,
        }));
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
        return void writeJson(res, 200, recordDirectiveArchitectureConsumption({
          directiveRoot,
          integrationPath: payload.integrationPath,
          appliedSurface: payload.appliedSurface,
          applicationSummary: payload.applicationSummary,
          observedEffect: payload.observedEffect,
          validationResult: payload.validationResult,
          outcome: payload.outcome,
          rollbackNote: payload.rollbackNote,
          recordedBy: UI_OPERATOR_ACTOR,
        }));
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
        return void writeJson(res, 200, evaluateDirectiveArchitectureConsumption({
          directiveRoot,
          consumptionPath: payload.consumptionPath,
          decision: payload.decision,
          rationale: payload.rationale,
          observedStability: payload.observedStability,
          retainedUsefulnessAssessment: payload.retainedUsefulnessAssessment,
          nextBoundedAction: payload.nextBoundedAction,
          rollbackNote: payload.rollbackNote,
          evaluatedBy: UI_OPERATOR_ACTOR,
        }));
      }
      if (method === "POST" && pathname === "/api/architecture/reopen-from-evaluation") {
        const payload = parseJsonBody<{
          evaluationPath: string;
        }>(await readBody(req));
        return void writeJson(res, 200, reopenDirectiveArchitectureFromEvaluation({
          directiveRoot,
          evaluationPath: payload.evaluationPath,
          reopenedBy: UI_OPERATOR_ACTOR,
        }));
      }

      if (pathname.startsWith("/api/")) {
        return void writeJson(res, 404, { ok: false, error: "not_found" });
      }

      if (!fs.existsSync(UI_INDEX_PATH)) {
        return void writeHtml(res, 503, renderMissingBuildPage(directiveRoot));
      }

      if (method !== "GET" && method !== "HEAD") {
        res.statusCode = 405;
        res.setHeader("allow", "GET, HEAD");
        res.end();
        return;
      }

      const staticFile = pathname === "/" ? null : resolveStaticFile(pathname);
      if (staticFile) {
        return void writeStaticFile(res, staticFile);
      }

      return void writeStaticFile(res, UI_INDEX_PATH);
    } catch (error) {
      if (pathname.startsWith("/api/")) {
        return void writeJson(
          res,
          resolveApiErrorStatus(error),
          { ok: false, error: String((error as Error).message || error) },
        );
      }
      return void writeHtml(
        res,
        500,
        `<html lang="en"><head><meta charset="utf-8" /><title>Directive Kernel UI Error</title></head><body><main><h1>Directive Kernel UI Error</h1><pre>${escapeHtml(String((error as Error).message || error))}</pre></main></body></html>`,
      );
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("directive_ui_server_failed_to_bind"));
        return;
      }

      resolve({
        server,
        host: address.address,
        port: address.port,
        origin: `http://${address.address}:${address.port}`,
        directiveRoot,
        close() {
          runtimeHost.close();
          return new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          });
        },
      });
    });
  });
}

export const startDirectiveFrontendServer = startDirectiveUiServer;
export type StartDirectiveWorkbenchServerOptions = StartDirectiveUiServerOptions;
export type DirectiveWorkbenchServerHandle = DirectiveUiServerHandle;
export const startDirectiveWorkbenchServer = startDirectiveUiServer;
