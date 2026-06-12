import fs from "node:fs";
import http, { type Server as NodeHttpServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import { createInMemoryTelemetry } from "../../shared/lib/telemetry.ts";
import { createStandaloneFilesystemHost } from "../standalone-host/filesystem-host.ts";
import { handleDirectiveUiApiRequest } from "./api-routes.ts";
import { matchOperationEntry } from "./api-manifest.ts";
import {
  escapeHtml,
  renderMissingBuildPage,
  resolveApiErrorStatus,
  resolveStaticFile,
  writeHtml,
  writeJson,
  writeStaticFile,
} from "./http-support.ts";

export type StartDirectiveUiServerOptions = {
  directiveRoot: string;
  host?: string;
  port?: number;
};

export type UiServerHandle = {
  server: NodeHttpServer;
  host: string;
  port: number;
  origin: string;
  directiveRoot: string;
  close(): Promise<void>;
};

export type StartDirectiveFrontendServerOptions = StartDirectiveUiServerOptions;
export type FrontendServerHandle = UiServerHandle;

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const UI_APP_ROOT = path.resolve(MODULE_DIR, "..", "..", "ui");
const UI_DIST_ROOT = UI_APP_ROOT; // serve directly from ui/ (no build step — plain HTML)
const UI_INDEX_PATH = path.join(UI_DIST_ROOT, "index.html");
const UI_OPERATOR_ACTOR = "directive-ui-operator";

type ObservedApiOperation = {
  name: string;
  kind: "read" | "write";
};

function getObservedApiOperation(method: string, pathname: string): ObservedApiOperation | null {
  if (!pathname.startsWith("/api/")) {
    return null;
  }
  const matched = matchOperationEntry(method, pathname);
  if (matched) {
    return {
      name: matched.name,
      kind: matched.method === "POST" ? "write" : "read",
    };
  }
  return {
    name: "api_not_found",
    kind: method.toUpperCase() === "POST" ? "write" : "read",
  };
}

function recordObservedApiOperation(input: {
  telemetry: ReturnType<typeof createInMemoryTelemetry>;
  operation: ObservedApiOperation | null;
  durationMs: number;
  statusCode: number;
}) {
  const { telemetry, operation, durationMs, statusCode } = input;
  if (!operation) {
    return;
  }

  telemetry.counter(`api.operations.${operation.name}.requests_total`);
  telemetry.counter(
    operation.kind === "write" ? "api.write_requests_total" : "api.read_requests_total",
  );
  telemetry.gauge(`api.operations.${operation.name}.last_duration_ms`, durationMs);

  if (statusCode >= 400) {
    telemetry.counter(`api.operations.${operation.name}.error_total`);
    telemetry.event("api_operation_error", {
      operation: operation.name,
      kind: operation.kind,
      statusCode,
    });
    return;
  }

  telemetry.counter(`api.operations.${operation.name}.success_total`);

  if (operation.kind === "write") {
    telemetry.event("api_operation_write", {
      operation: operation.name,
      statusCode,
    });
    return;
  }

  if (
    operation.name === "snapshot_get"
    || operation.name === "operator_decision_inbox_get"
    || operation.name === "telemetry_snapshot_get"
  ) {
    telemetry.event("api_operation_read", {
      operation: operation.name,
      statusCode,
    });
  }
}

export function startDirectiveUiServer(
  options: StartDirectiveUiServerOptions,
): Promise<UiServerHandle> {
  const directiveRoot = normalizeAbsolutePath(options.directiveRoot);
  const host = options.host || "127.0.0.1";
  const port = options.port ?? 0;
  const runtimeHost = createStandaloneFilesystemHost({ directiveRoot });
  const telemetry = createInMemoryTelemetry({ maxEvents: 250 });

  const server = http.createServer(async (req, res) => {
    const method = req.method || "GET";
    const url = new URL(req.url || "/", `http://${host}:${port || 0}`);
    const pathname = url.pathname;
    const startedAt = Date.now();
    const observedApiOperation = getObservedApiOperation(method, pathname);
    telemetry.counter("web_host.requests_total");
    if (pathname.startsWith("/api/")) {
      telemetry.counter("web_host.api_requests_total");
    }

    try {
      const apiHandled = await handleDirectiveUiApiRequest({
        req,
        res,
        method,
        pathname,
        url,
        directiveRoot,
        runtimeHost,
        uiOperatorActor: UI_OPERATOR_ACTOR,
        telemetry,
      });
      if (apiHandled) {
        const durationMs = Date.now() - startedAt;
        recordObservedApiOperation({
          telemetry,
          operation: observedApiOperation,
          durationMs,
          statusCode: res.statusCode || 200,
        });
        telemetry.gauge("web_host.last_request_duration_ms", durationMs);
        return;
      }

      if (!fs.existsSync(UI_INDEX_PATH)) {
        writeHtml(res, 503, renderMissingBuildPage(directiveRoot));
        return;
      }

      if (method !== "GET" && method !== "HEAD") {
        res.statusCode = 405;
        res.setHeader("allow", "GET, HEAD");
        res.end();
        telemetry.gauge("web_host.last_request_duration_ms", Date.now() - startedAt);
        return;
      }

      const staticFile = pathname === "/" ? null : resolveStaticFile(UI_DIST_ROOT, pathname);
      if (staticFile) {
        writeStaticFile(res, staticFile);
        telemetry.gauge("web_host.last_request_duration_ms", Date.now() - startedAt);
        return;
      }

      writeStaticFile(res, UI_INDEX_PATH);
      telemetry.gauge("web_host.last_request_duration_ms", Date.now() - startedAt);
    } catch (error) {
      telemetry.counter("web_host.errors_total");
      if (pathname.startsWith("/api/")) {
        telemetry.counter("web_host.api_errors_total");
        const statusCode = resolveApiErrorStatus(error);
        recordObservedApiOperation({
          telemetry,
          operation: observedApiOperation,
          durationMs: Date.now() - startedAt,
          statusCode,
        });
        writeJson(
          res,
          statusCode,
          { ok: false, error: String((error as Error).message || error) },
        );
        telemetry.gauge("web_host.last_request_duration_ms", Date.now() - startedAt);
        return;
      }
      writeHtml(
        res,
        500,
        `<html lang="en"><head><meta charset="utf-8" /><title>Directive Kernel UI Error</title></head><body><main><h1>Directive Kernel UI Error</h1><pre>${escapeHtml(String((error as Error).message || error))}</pre></main></body></html>`,
      );
      telemetry.gauge("web_host.last_request_duration_ms", Date.now() - startedAt);
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
export type WorkbenchServerHandle = UiServerHandle;
export const startDirectiveWorkbenchServer = startDirectiveUiServer;
