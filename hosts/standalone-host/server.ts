import http, {
  type IncomingMessage,
  type Server as NodeHttpServer,
  type ServerResponse,
} from "node:http";
import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic, appendJsonLine } from "../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import {
  sanitizeText,
  TEXT_FIELD_LIMITS,
} from "../../shared/lib/text-sanitizer.ts";

import type { DiscoverySubmissionRequest } from "../../discovery/lib/front-door/discovery-submission-router.ts";
import type { DirectiveEnginePlanProgressUpdate } from "../../engine/types.ts";
import type { RuntimeFollowUpRecordRequest } from "../../runtime/lib/writers/runtime-follow-up-record-writer.ts";
import type { RuntimeProofBundleRequest } from "../../runtime/lib/writers/runtime-proof-bundle-writer.ts";
import type { RuntimePromotionRecordRequest } from "../../runtime/lib/writers/runtime-promotion-record-writer.ts";
import type { RuntimeRegistryEntryRequest } from "../../runtime/lib/writers/runtime-registry-entry-writer.ts";
import type { RuntimeRecordRequest } from "../../runtime/lib/writers/runtime-record-writer.ts";
import type { RuntimeTransformationProofRequest } from "../../runtime/lib/writers/runtime-transformation-proof-writer.ts";
import type { RuntimeTransformationRecordRequest } from "../../runtime/lib/writers/runtime-transformation-record-writer.ts";
import {
  DEFAULT_STANDALONE_HOST_RATE_LIMIT_BURST,
  DEFAULT_STANDALONE_HOST_RATE_LIMIT_REQUESTS_PER_MINUTE,
  DEFAULT_STANDALONE_RUNTIME_ARTIFACTS_RELATIVE_ROOT,
  STANDALONE_HOST_CONFIG_MODE,
  type ResolvedStandaloneHostAuth,
  type ResolvedStandaloneHostConfig,
  type ResolvedStandaloneHostPersistence,
} from "./config.ts";
import { createStandaloneHostPersistenceLedger } from "./persistence.ts";
import { createStandaloneFilesystemHost } from "./filesystem-host.ts";
import { createRateLimiter, type RateLimiterConfig } from "./rate-limiter.ts";

type JsonValue = Record<string, unknown>;

export type StartStandaloneHostServerOptions = {
  directiveRoot: string;
  host?: string;
  port?: number;
  unresolvedGapIds?: string[];
  receivedAt?: string;
  initialQueue?: JsonValue;
  auth?: ResolvedStandaloneHostAuth;
  rateLimit?: Omit<RateLimiterConfig, "now">;
  persistence?: ResolvedStandaloneHostPersistence;
  runtimeArtifactsRoot?: string;
  allowExternalFetches?: boolean;
  writeStatusFile?: boolean;
  writeAccessLog?: boolean;
  writeBootLog?: boolean;
};

export type StandaloneHostRuntimeStatus = {
  mode: typeof STANDALONE_HOST_CONFIG_MODE;
  lifecycle: "starting" | "running" | "stopped";
  directiveRoot: string;
  runtimeArtifactsRoot: string;
  receivedAt: string | null;
  unresolvedGapIds: string[];
  auth: {
    mode: ResolvedStandaloneHostAuth["mode"];
    protectedRoutePrefixes: string[];
  };
  persistence: {
    mode: ResolvedStandaloneHostPersistence["mode"];
    sqlitePath: string | null;
    experimentalRuntime: boolean;
  };
  server: {
    host: string | null;
    port: number | null;
    origin: string | null;
  };
  process: {
    pid: number;
  };
  metrics: {
    requestCount: number;
    lastRequestAt: string | null;
    lastStatusCode: number | null;
    lastError: string | null;
  };
  startedAt: string | null;
  updatedAt: string | null;
  stoppedAt: string | null;
};

export type StandaloneHostServerHandle = {
  server: NodeHttpServer;
  host: string;
  port: number;
  origin: string;
  runtimeArtifactsRoot: string;
  statusPath: string;
  accessLogPath: string;
  bootLogPath: string;
  readStatus(): StandaloneHostRuntimeStatus;
  close(): Promise<void>;
};

function writeJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}




function resolveStandaloneHostAuth(
  auth: ResolvedStandaloneHostAuth | undefined,
): ResolvedStandaloneHostAuth {
  return (
    auth ?? {
      mode: "none",
      protectedRoutePrefixes: ["/api/"],
    }
  );
}

function resolveStandaloneHostRateLimit(
  rateLimit: StartStandaloneHostServerOptions["rateLimit"],
): Omit<RateLimiterConfig, "now"> {
  return {
    requestsPerMinute:
      rateLimit?.requestsPerMinute
      ?? DEFAULT_STANDALONE_HOST_RATE_LIMIT_REQUESTS_PER_MINUTE,
    burst: rateLimit?.burst ?? DEFAULT_STANDALONE_HOST_RATE_LIMIT_BURST,
  };
}

function isProtectedRoute(
  pathname: string,
  auth: ResolvedStandaloneHostAuth,
) {
  return auth.protectedRoutePrefixes.some((prefix) => pathname.startsWith(prefix));
}

function resolveBearerToken(req: IncomingMessage) {
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string") {
    return null;
  }

  const match = /^Bearer\s+(.+)$/iu.exec(authorization.trim());
  return match ? match[1] : null;
}

function isAuthorizedRequest(
  req: IncomingMessage,
  auth: ResolvedStandaloneHostAuth,
) {
  if (auth.mode === "none") {
    return true;
  }

  const bearerToken = resolveBearerToken(req);
  return bearerToken === auth.bearerToken;
}

function writeUnauthorized(res: ServerResponse) {
  res.setHeader(
    "www-authenticate",
    'Bearer realm="directive-workspace-standalone-host"',
  );
  writeJson(res, 401, {
    ok: false,
    error: "unauthorized",
  });
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

const SANITIZED_TEXT_FIELD_LIMITS: Record<string, number> = {
  candidate_name: TEXT_FIELD_LIMITS.candidateName,
  candidateName: TEXT_FIELD_LIMITS.candidateName,
  source_reference: TEXT_FIELD_LIMITS.sourceReference,
  sourceReference: TEXT_FIELD_LIMITS.sourceReference,
  mission_alignment: TEXT_FIELD_LIMITS.missionAlignment,
  missionAlignment: TEXT_FIELD_LIMITS.missionAlignment,
  notes: TEXT_FIELD_LIMITS.rationale,
  goal_statement: TEXT_FIELD_LIMITS.goalStatement,
  goalStatement: TEXT_FIELD_LIMITS.goalStatement,
  currentObjective: TEXT_FIELD_LIMITS.goalStatement,
  rationale: TEXT_FIELD_LIMITS.rationale,
  operator_rationale: TEXT_FIELD_LIMITS.rationale,
  operatorRationale: TEXT_FIELD_LIMITS.rationale,
  preview_markdown: TEXT_FIELD_LIMITS.missionPreviewMarkdown,
  previewMarkdown: TEXT_FIELD_LIMITS.missionPreviewMarkdown,
};

function sanitizeFreeTextFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeFreeTextFields(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [fieldName, fieldValue] of Object.entries(value)) {
    const maxBytes = SANITIZED_TEXT_FIELD_LIMITS[fieldName];
    if (maxBytes !== undefined) {
      if (fieldValue === null || fieldValue === undefined) {
        output[fieldName] = fieldValue;
      } else if (Array.isArray(fieldValue)) {
        output[fieldName] = fieldValue.map((entry) =>
          sanitizeText(entry as string, {
            fieldName,
            maxBytes,
          }),
        );
      } else {
        output[fieldName] = sanitizeText(fieldValue as string, {
          fieldName,
          maxBytes,
        });
      }
      continue;
    }
    output[fieldName] = sanitizeFreeTextFields(fieldValue);
  }
  return output;
}

function parseSanitizedJsonBody(rawBody: string) {
  return sanitizeFreeTextFields(JSON.parse(rawBody));
}

function parseSanitizerError(message: string) {
  const match = /^(sanitize_too_long|sanitize_invalid_type):([^:]+)/u.exec(message);
  if (!match) {
    return null;
  }
  return {
    field: match[2],
    reason: message,
  };
}

function parseOptionalPositiveInt(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("invalid_max_entries");
  }
  return Math.floor(parsed);
}

function createStandaloneHostRuntimeRecorder(
  options: StartStandaloneHostServerOptions,
) {
  const auth = resolveStandaloneHostAuth(options.auth);
  const persistenceLedger = createStandaloneHostPersistenceLedger({
    persistence: options.persistence,
  });
  const persistence = persistenceLedger.describe();
  const runtimeArtifactsRoot = normalizeAbsolutePath(
    options.runtimeArtifactsRoot
      ?? path.resolve(
        options.directiveRoot,
        DEFAULT_STANDALONE_RUNTIME_ARTIFACTS_RELATIVE_ROOT,
      ),
  );
  const statusPath = normalizeAbsolutePath(
    path.resolve(runtimeArtifactsRoot, "status.json"),
  );
  const accessLogPath = normalizeAbsolutePath(
    path.resolve(runtimeArtifactsRoot, "access-log.jsonl"),
  );
  const bootLogPath = normalizeAbsolutePath(
    path.resolve(runtimeArtifactsRoot, "boot-log.jsonl"),
  );
  const status: StandaloneHostRuntimeStatus = {
    mode: STANDALONE_HOST_CONFIG_MODE,
    lifecycle: "starting",
    directiveRoot: normalizeAbsolutePath(options.directiveRoot),
    runtimeArtifactsRoot,
    receivedAt: options.receivedAt ?? null,
    unresolvedGapIds: [...(options.unresolvedGapIds ?? [])],
    auth: {
      mode: auth.mode,
      protectedRoutePrefixes: [...auth.protectedRoutePrefixes],
    },
    persistence: {
      mode: persistence.mode,
      sqlitePath: persistence.sqlitePath,
      experimentalRuntime: persistence.experimentalRuntime,
    },
    server: {
      host: null,
      port: null,
      origin: null,
    },
    process: {
      pid: process.pid,
    },
    metrics: {
      requestCount: 0,
      lastRequestAt: null,
      lastStatusCode: null,
      lastError: null,
    },
    startedAt: null,
    updatedAt: null,
    stoppedAt: null,
  };

  function persistStatus() {
    if (options.writeStatusFile === false) {
      return;
    }
    writeJsonAtomic(statusPath, status);
    persistenceLedger.recordJsonArtifact(statusPath, status, "runtime_status");
  }

  return {
    runtimeArtifactsRoot,
    statusPath,
    accessLogPath,
    bootLogPath,
    readStatus() {
      return JSON.parse(JSON.stringify(status)) as StandaloneHostRuntimeStatus;
    },
    recordStarted(server: {
      host: string;
      port: number;
      origin: string;
    }) {
      const recordedAt = new Date().toISOString();
      status.lifecycle = "running";
      status.server = server;
      status.startedAt = recordedAt;
      status.updatedAt = recordedAt;
      persistStatus();
      persistenceLedger.recordRuntimeStarted({
        recordedAt,
        directiveRoot: status.directiveRoot,
        runtimeArtifactsRoot,
        host: server.host,
        port: server.port,
        origin: server.origin,
        authMode: auth.mode,
      });

      if (options.writeBootLog !== false) {
        appendJsonLine(bootLogPath, {
          event: "started",
          recordedAt,
          mode: STANDALONE_HOST_CONFIG_MODE,
          directiveRoot: status.directiveRoot,
          runtimeArtifactsRoot,
          server,
        });
        if (auth.mode === "none") {
          appendJsonLine(bootLogPath, {
            event: "warning",
            reason: "rate_limit_disabled_due_to_no_auth",
            recordedAt,
          });
        }
      }
    },
    recordRequest(event: {
      recordedAt: string;
      method: string;
      path: string;
      query: string;
      routeId: string;
      statusCode: number;
      durationMs: number;
      error: string | null;
    }) {
      status.metrics.requestCount += 1;
      status.metrics.lastRequestAt = event.recordedAt;
      status.metrics.lastStatusCode = event.statusCode;
      status.metrics.lastError = event.error;
      status.updatedAt = event.recordedAt;
      persistStatus();
      persistenceLedger.recordRuntimeRequest(event);

      if (options.writeAccessLog !== false) {
        appendJsonLine(accessLogPath, event);
      }
    },
    recordStopped() {
      const recordedAt = new Date().toISOString();
      status.lifecycle = "stopped";
      status.stoppedAt = recordedAt;
      status.updatedAt = recordedAt;
      persistStatus();
      persistenceLedger.recordRuntimeStopped({
        recordedAt,
        requestCount: status.metrics.requestCount,
      });

      if (options.writeBootLog !== false) {
        appendJsonLine(bootLogPath, {
          event: "stopped",
          recordedAt,
          mode: STANDALONE_HOST_CONFIG_MODE,
          directiveRoot: status.directiveRoot,
          runtimeArtifactsRoot,
          requestCount: status.metrics.requestCount,
        });
      }
    },
    close() {
      persistenceLedger.close();
    },
  };
}

export function startStandaloneHostServer(
  options: StartStandaloneHostServerOptions,
): Promise<StandaloneHostServerHandle> {
  const bindHost = options.host ?? "127.0.0.1";
  const bindPort = options.port ?? 8787;
  const auth = resolveStandaloneHostAuth(options.auth);
  const rateLimit = resolveStandaloneHostRateLimit(options.rateLimit);
  const rateLimiter =
    auth.mode === "static_bearer" ? createRateLimiter(rateLimit) : null;
  const standaloneHost = createStandaloneFilesystemHost({
    directiveRoot: options.directiveRoot,
    unresolvedGapIds: options.unresolvedGapIds,
    receivedAt: options.receivedAt,
    initialQueue: options.initialQueue,
    persistence: options.persistence,
    allowExternalFetches: options.allowExternalFetches,
  });
  const runtimeRecorder = createStandaloneHostRuntimeRecorder(options);
  let closed = false;

  const server = http.createServer(async (req, res) => {
    const requestStartedAt = Date.now();
    let method = req.method ?? "GET";
    let pathname = "/";
    let query = "";
    let routeId = "request_parse";
    let requestError: string | null = null;

    try {
      const requestUrl = new URL(req.url ?? "/", `http://${bindHost}:${bindPort}`);
      pathname = requestUrl.pathname;
      query = requestUrl.search;
      method = req.method ?? "GET";

      if (isProtectedRoute(pathname, auth) && !isAuthorizedRequest(req, auth)) {
        routeId = "auth_guard";
        writeUnauthorized(res);
        return;
      }

      if (
        method === "POST"
        && rateLimiter
        && isProtectedRoute(pathname, auth)
      ) {
        const bearerToken = resolveBearerToken(req);
        if (!bearerToken) {
          routeId = "auth_guard";
          writeUnauthorized(res);
          return;
        }
        const decision = rateLimiter.consume(bearerToken);
        if (!decision.allowed) {
          routeId = "rate_limit";
          res.setHeader(
            "Retry-After",
            String(decision.retryAfterSeconds),
          );
          writeJson(res, 429, {
            ok: false,
            error: "rate_limited",
            retryAfterSeconds: decision.retryAfterSeconds,
          });
          return;
        }
      }

      if (method === "GET" && pathname === "/health") {
        routeId = "health";
        writeJson(res, 200, {
          ok: true,
          mode: "standalone_reference_host",
          directive_root: standaloneHost.directiveRoot,
          runtime_artifacts_root: runtimeRecorder.runtimeArtifactsRoot,
        });
        return;
      }

      if (method === "GET" && pathname === "/api/runtime/status") {
        routeId = "runtime_status";
        writeJson(res, 200, {
          ok: true,
          runtime: runtimeRecorder.readStatus(),
        });
        return;
      }

      if (method === "GET" && pathname === "/api/discovery/overview") {
        routeId = "discovery_overview";
        const maxEntries = parseOptionalPositiveInt(
          requestUrl.searchParams.get("max_entries"),
        );
        const overview = standaloneHost.readDiscoveryOverview(maxEntries);
        writeJson(res, 200, { ok: true, overview });
        return;
      }

      if (method === "GET" && pathname === "/api/runtime/overview") {
        routeId = "runtime_overview";
        const maxEntries = parseOptionalPositiveInt(
          requestUrl.searchParams.get("max_entries"),
        );
        const overview = standaloneHost.readRuntimeOverview(maxEntries);
        writeJson(res, 200, { ok: true, overview });
        return;
      }

      if (method === "POST" && pathname === "/api/discovery/submissions") {
        routeId = "discovery_submit";
        const dryRun =
          requestUrl.searchParams.get("dry_run") === "1"
          || requestUrl.searchParams.get("mode") === "dry_run";
        const processWithEngine =
          requestUrl.searchParams.get("process_with_engine") === "1";
        const rawBody = await readBody(req);
        const request = parseSanitizedJsonBody(rawBody) as DiscoverySubmissionRequest;
        const result = processWithEngine
          ? await standaloneHost.submitDiscoveryEntryWithEngine(request, dryRun)
          : await standaloneHost.submitDiscoveryEntry(request, dryRun);
        writeJson(res, 200, result);
        return;
      }

        if (method === "POST" && pathname === "/api/engine/plan-progress") {
          routeId = "engine_plan_progress";
          const rawBody = await readBody(req);
          const request = parseSanitizedJsonBody(rawBody) as {
            runId: string;
          updates: DirectiveEnginePlanProgressUpdate[];
          at?: string | null;
        };
        const result = await standaloneHost.updateEnginePlanProgress({
          runId: request.runId,
          updates: request.updates,
          at: request.at,
        });
          writeJson(res, 200, { ok: true, record: result });
          return;
        }

        if (method === "POST" && pathname === "/api/engine/reroute") {
          routeId = "engine_reroute";
          const rawBody = await readBody(req);
          const request = parseSanitizedJsonBody(rawBody) as {
            runId: string;
            answers: Record<string, unknown>;
            receivedAt?: string | null;
          };
          const result = await standaloneHost.reRouteEngineRunWithAnswers({
            runId: request.runId,
            answers: request.answers,
            receivedAt: request.receivedAt,
          });
          writeJson(res, 200, { ok: true, result });
          return;
        }

        if (method === "POST" && pathname === "/api/runtime/follow-ups") {
        routeId = "runtime_followup_write";
        const rawBody = await readBody(req);
        const request = parseSanitizedJsonBody(rawBody) as RuntimeFollowUpRecordRequest;
        const result = await standaloneHost.writeRuntimeFollowUp(request);
        writeJson(res, 200, result);
        return;
      }

      if (method === "POST" && pathname === "/api/runtime/records") {
        routeId = "runtime_record_write";
        const rawBody = await readBody(req);
        const request = parseSanitizedJsonBody(rawBody) as RuntimeRecordRequest;
        const result = await standaloneHost.writeRuntimeRecord(request);
        writeJson(res, 200, result);
        return;
      }

      if (method === "POST" && pathname === "/api/runtime/proof-bundles") {
        routeId = "runtime_proof_bundle_write";
        const rawBody = await readBody(req);
        const request = parseSanitizedJsonBody(rawBody) as RuntimeProofBundleRequest;
        const result = await standaloneHost.writeRuntimeProofBundle(request);
        writeJson(res, 200, result);
        return;
      }

      if (method === "POST" && pathname === "/api/runtime/transformation-proofs") {
        routeId = "runtime_transformation_proof_write";
        const rawBody = await readBody(req);
        const request = parseSanitizedJsonBody(rawBody) as RuntimeTransformationProofRequest;
        const result = await standaloneHost.writeRuntimeTransformationProof(request);
        writeJson(res, 200, result);
        return;
      }

      if (method === "POST" && pathname === "/api/runtime/transformation-records") {
        routeId = "runtime_transformation_record_write";
        const rawBody = await readBody(req);
        const request = parseSanitizedJsonBody(rawBody) as RuntimeTransformationRecordRequest;
        const result = await standaloneHost.writeRuntimeTransformationRecord(request);
        writeJson(res, 200, result);
        return;
      }

      if (method === "POST" && pathname === "/api/runtime/promotion-records") {
        routeId = "runtime_promotion_record_write";
        const rawBody = await readBody(req);
        const request = parseSanitizedJsonBody(rawBody) as RuntimePromotionRecordRequest;
        const result = await standaloneHost.writeRuntimePromotionRecord(request);
        writeJson(res, 200, result);
        return;
      }

      if (method === "POST" && pathname === "/api/runtime/host-selection-resolutions") {
        routeId = "runtime_host_selection_resolution_write";
        const rawBody = await readBody(req);
        const request = parseSanitizedJsonBody(rawBody) as {
          promotionReadinessPath: string;
          decision:
            | "select_standalone"
            | "select_web"
            | "confirm_inferred"
            | "override"
            | "defer";
          selectedHost?: string;
          rationale: string;
          reviewedBy: string;
          resolvedConfidence?: "high" | "medium" | "low";
        };
        const result = await standaloneHost.writeRuntimeHostSelectionResolution({
          promotionReadinessPath: request.promotionReadinessPath,
          decision: request.decision,
          selectedHost: request.selectedHost ?? "",
          rationale: request.rationale,
          reviewedBy: request.reviewedBy,
          resolvedConfidence: request.resolvedConfidence,
        });
        writeJson(res, 200, result);
        return;
      }

      if (method === "POST" && pathname === "/api/runtime/promotion-seam-decisions") {
        routeId = "runtime_promotion_seam_decision_write";
        const rawBody = await readBody(req);
        const request = parseSanitizedJsonBody(rawBody) as {
          promotionReadinessPath: string;
          rationale: string;
          approvedBy?: string;
        };
        const result = await standaloneHost.writeRuntimePromotionSeamDecision({
          promotionReadinessPath: request.promotionReadinessPath,
          rationale: request.rationale,
          approvedBy: request.approvedBy ?? "standalone-host-server",
        });
        writeJson(res, 200, result);
        return;
      }

      if (method === "POST" && pathname === "/api/runtime/registry-entries") {
        routeId = "runtime_registry_entry_write";
        const rawBody = await readBody(req);
        const request = parseSanitizedJsonBody(rawBody) as RuntimeRegistryEntryRequest;
        const result = await standaloneHost.writeRuntimeRegistryEntry(request);
        writeJson(res, 200, result);
        return;
      }

      if (method === "POST" && pathname === "/api/runtime/registry-acceptance-decisions") {
        routeId = "runtime_registry_acceptance_decision_write";
        const rawBody = await readBody(req);
        const request = parseSanitizedJsonBody(rawBody) as {
          promotionRecordPath: string;
          rationale: string;
          acceptedBy?: string;
        };
        const result = await standaloneHost.writeRuntimeRegistryAcceptanceDecision({
          promotionRecordPath: request.promotionRecordPath,
          rationale: request.rationale,
          acceptedBy: request.acceptedBy ?? "standalone-host-server",
        });
        writeJson(res, 200, result);
        return;
      }

      routeId = "not_found";
      writeJson(res, 404, {
        ok: false,
        error: "not_found",
        path: pathname,
        method,
      });
    } catch (error) {
      const message = String((error as Error).message || error);
      requestError = message;
      routeId = routeId === "request_parse" ? "request_error" : routeId;
      const sanitizerError = parseSanitizerError(message);
      if (sanitizerError) {
        writeJson(res, 400, {
          ok: false,
          error: "invalid_input",
          field: sanitizerError.field,
          reason: sanitizerError.reason,
        });
        return;
      }
      const statusCode =
        message === "request_body_too_large" || message.startsWith("invalid_")
          ? 400
          : 500;
      writeJson(res, statusCode, {
        ok: false,
        error: message,
      });
    } finally {
      runtimeRecorder.recordRequest({
        recordedAt: new Date().toISOString(),
        method,
        path: pathname,
        query,
        routeId,
        statusCode: res.statusCode,
        durationMs: Date.now() - requestStartedAt,
        error: requestError,
      });
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(bindPort, bindHost, () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("invalid_server_address"));
        return;
      }

      const actualPort = address.port;
      const origin = `http://${bindHost}:${actualPort}`;
      runtimeRecorder.recordStarted({
        host: bindHost,
        port: actualPort,
        origin,
      });

      resolve({
        server,
        host: bindHost,
        port: actualPort,
        origin,
        runtimeArtifactsRoot: runtimeRecorder.runtimeArtifactsRoot,
        statusPath: runtimeRecorder.statusPath,
        accessLogPath: runtimeRecorder.accessLogPath,
        bootLogPath: runtimeRecorder.bootLogPath,
        readStatus() {
          return runtimeRecorder.readStatus();
        },
        close() {
          if (closed) {
            return Promise.resolve();
          }
          closed = true;
          return new Promise<void>((closeResolve, closeReject) => {
            server.close((closeError) => {
              if (closeError) {
                closeReject(closeError);
                return;
              }
              runtimeRecorder.recordStopped();
              standaloneHost.close();
              runtimeRecorder.close();
              closeResolve();
            });
          });
        },
      });
    });
  });
}

export function startStandaloneHostServerFromConfig(
  config: ResolvedStandaloneHostConfig,
) {
  return startStandaloneHostServer({
    directiveRoot: config.directiveRoot,
    host: config.server.host,
    port: config.server.port,
    unresolvedGapIds: config.unresolvedGapIds,
    receivedAt: config.receivedAt,
    initialQueue: config.initialQueue,
    auth: config.auth,
    rateLimit: config.rateLimit,
    persistence: config.persistence,
    runtimeArtifactsRoot: config.runtimeArtifacts.root,
    allowExternalFetches: config.runtime.allowExternalFetches,
    writeStatusFile: config.runtimeArtifacts.writeStatusFile,
    writeAccessLog: config.runtimeArtifacts.writeAccessLog,
    writeBootLog: config.runtimeArtifacts.writeBootLog,
  });
}
