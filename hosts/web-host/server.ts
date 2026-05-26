import fs from "node:fs";
import http, { type Server as NodeHttpServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import { createStandaloneFilesystemHost } from "../standalone-host/filesystem-host.ts";
import { handleDirectiveUiApiRequest } from "./api-routes.ts";
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
const UI_DIST_ROOT = path.join(UI_APP_ROOT, "dist");
const UI_INDEX_PATH = path.join(UI_DIST_ROOT, "index.html");
const UI_OPERATOR_ACTOR = "directive-ui-operator";

export function startDirectiveUiServer(
  options: StartDirectiveUiServerOptions,
): Promise<UiServerHandle> {
  const directiveRoot = normalizeAbsolutePath(options.directiveRoot);
  const host = options.host || "127.0.0.1";
  const port = options.port ?? 0;
  const runtimeHost = createStandaloneFilesystemHost({ directiveRoot });

  const server = http.createServer(async (req, res) => {
    const method = req.method || "GET";
    const url = new URL(req.url || "/", `http://${host}:${port || 0}`);
    const pathname = url.pathname;

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
      });
      if (apiHandled) {
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
        return;
      }

      const staticFile = pathname === "/" ? null : resolveStaticFile(UI_DIST_ROOT, pathname);
      if (staticFile) {
        writeStaticFile(res, staticFile);
        return;
      }

      writeStaticFile(res, UI_INDEX_PATH);
    } catch (error) {
      if (pathname.startsWith("/api/")) {
        writeJson(
          res,
          resolveApiErrorStatus(error),
          { ok: false, error: String((error as Error).message || error) },
        );
        return;
      }
      writeHtml(
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
export type WorkbenchServerHandle = UiServerHandle;
export const startDirectiveWorkbenchServer = startDirectiveUiServer;
