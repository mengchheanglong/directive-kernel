import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

export function writeJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

export function writeHtml(res: ServerResponse, statusCode: number, html: string) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html>${html}`);
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function readBody(req: IncomingMessage) {
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

export function parseJsonBody<T>(body: string) {
  return JSON.parse(body) as T;
}

export function resolveApiErrorStatus(error: unknown) {
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

export function resolveStaticFile(uiDistRoot: string, requestPath: string) {
  const candidate = decodeURIComponent(requestPath).replace(/^\/+/, "");
  const absolutePath = path.resolve(uiDistRoot, candidate);
  const normalizedRoot = normalizeAbsolutePath(uiDistRoot);
  const prefix = `${normalizedRoot}/`;
  const normalized = normalizeAbsolutePath(absolutePath);
  if (normalized !== normalizedRoot && !normalized.startsWith(prefix)) {
    return null;
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return null;
  }
  return absolutePath;
}

export function writeStaticFile(res: ServerResponse, filePath: string) {
  res.statusCode = 200;
  res.setHeader("content-type", getContentType(filePath));
  fs.createReadStream(filePath).pipe(res);
}

export function renderMissingBuildPage(directiveRoot: string) {
  const escapedRoot = escapeHtml(normalizeAbsolutePath(directiveRoot));
  return `<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Directive Kernel UI Build Missing</title><style>body{font-family:ui-monospace,Consolas,monospace;margin:32px;background:#f6f4ee;color:#1f1c16}main{max-width:960px;margin:0 auto}section{background:#fffdf7;border:1px solid #d9d0bf;border-radius:10px;padding:16px}pre{background:#faf7ef;border:1px solid #e1d8c7;border-radius:8px;padding:12px;white-space:pre-wrap}</style></head><body><main><section><h1>Directive Kernel UI Build Missing</h1><p>The standalone UI host is running, but the Vite UI has not been built yet.</p><p>Run these commands from the current Directive Kernel product root.</p><pre>cd ${escapedRoot}
pnpm install
pnpm run ui:build
node --experimental-strip-types ./hosts/web-host/cli.ts serve --directive-root ${escapedRoot}</pre></section></main></body></html>`;
}
