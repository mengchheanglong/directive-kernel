import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import type {
  CallableCapability,
  CallableExecutionInput,
  CallableExecutionResult,
} from "../../core/callable-contract.ts";

const CAPABILITY_ID = "pipe-scrapling-adaptive-web-scraper-mq9mmrc0";
const TOOL_NAME = "extract-html";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 45_000;
const DEFAULT_URL_TIMEOUT_MS = 10_000;
const MAX_URL_TIMEOUT_MS = 30_000;
const DEFAULT_SCRAPLING_PYTHON = "C:/Python314/python";

const FORBIDDEN_NETWORK_FIELDS = new Set([
  "urls",
  "uri",
  "sourceUrl",
  "fetchUrl",
  "requestUrl",
  "href",
  "header",
  "headers",
  "authorization",
  "auth",
  "cookie",
  "cookies",
  "proxy",
  "proxies",
  "userAgent",
  "fetch",
  "network",
]);

const ALLOWED_FIELDS = new Set([
  "html",
  "sourcePath",
  "url",
  "selectors",
  "includeText",
  "includeLinks",
  "timeoutMs",
]);

const PYTHON_HELPER = String.raw`
import json
import pathlib
import sys

from scrapling.parser import Adaptor


MAX_RESPONSE_BYTES = 2_000_000


def clean_text(node):
    text = ""
    if hasattr(node, "get_all_text"):
        text = node.get_all_text(separator=" ", strip=True)
    if not text:
        text = getattr(node, "text", "") or ""
    return " ".join(str(text).split())


def first_text(page, selector):
    nodes = page.css(selector)
    if not nodes:
        return None
    return clean_text(nodes[0])


payload = json.loads(sys.stdin.read())
source_type = payload["sourceType"]
if source_type == "url":
    try:
        from curl_cffi import requests
    except ModuleNotFoundError as exc:
        if getattr(exc, "name", "") == "curl_cffi" or "curl_cffi" in str(exc):
            raise RuntimeError("curl_cffi dependency missing: curl_cffi is not installed in the configured durable Python environment") from exc
        raise

    chunks = []
    total_bytes = 0

    def collect_response_chunk(chunk):
        global total_bytes
        total_bytes += len(chunk)
        if total_bytes > MAX_RESPONSE_BYTES:
            raise RuntimeError(f"URL response exceeded {MAX_RESPONSE_BYTES} bytes")
        chunks.append(chunk)
        return len(chunk)

    try:
        with requests.Session(
            trust_env=False,
            allow_redirects=False,
            proxies={},
            default_headers=False,
            discard_cookies=True,
        ) as session:
            response = session.get(
                payload["url"],
                timeout=payload["fetchTimeoutSeconds"],
                allow_redirects=False,
                max_redirects=0,
                proxies={},
                default_headers=False,
                discard_cookies=True,
                content_callback=collect_response_chunk,
                default_encoding="utf-8",
            )
    except ModuleNotFoundError as exc:
        if getattr(exc, "name", "") == "curl_cffi" or "curl_cffi" in str(exc):
            raise RuntimeError("curl_cffi dependency missing: curl_cffi is not installed in the configured durable Python environment") from exc
        raise
    if response.status_code >= 400:
        raise RuntimeError(f"URL fetch failed with HTTP status {response.status_code}")
    body = b"".join(chunks)
    if not body:
        body = getattr(response, "content", b"") or b""
    if isinstance(body, str):
        html = body
    else:
        encoding = getattr(response, "encoding", None) or "utf-8"
        html = body.decode(encoding, errors="replace")
    page = Adaptor(html)
elif source_type == "sourcePath":
    source_path = pathlib.Path(payload["sourcePath"])
    html = source_path.read_text(encoding="utf-8")
    page = Adaptor(html)
else:
    html = payload["html"]
    page = Adaptor(html)
warnings = []
fields = {}

for name, selector in payload.get("selectors", {}).items():
    try:
        nodes = page.css(selector)
    except Exception as exc:
        warnings.append(f"selector {name!r} failed: {exc}")
        fields[name] = None
        continue
    values = [clean_text(node) for node in nodes]
    values = [value for value in values if value]
    if not values:
        warnings.append(f"selector {name!r} matched no text")
        fields[name] = None
    elif len(values) == 1:
        fields[name] = values[0]
    else:
        fields[name] = values

result = {
    "ok": True,
    "sourceType": source_type,
    "fields": fields,
    "warnings": warnings,
}

if source_type == "sourcePath":
    result["sourcePath"] = str(pathlib.Path(payload["sourcePath"]).resolve())
elif source_type == "url":
    result["sourceUrl"] = payload["url"]

try:
    title = first_text(page, "title")
    if title:
        result["title"] = title
except Exception as exc:
    warnings.append(f"title extraction failed: {exc}")

if payload.get("includeText", False):
    try:
        result["text"] = page.get_all_text(separator="\n", strip=True)
    except Exception as exc:
        warnings.append(f"text extraction failed: {exc}")

if payload.get("includeLinks", False):
    links = []
    try:
        for node in page.css("a[href]"):
            attrib = getattr(node, "attrib", {}) or {}
            href = attrib.get("href")
            if href:
                links.append({"text": clean_text(node), "href": str(href)})
    except Exception as exc:
        warnings.append(f"link extraction failed: {exc}")
    result["links"] = links

print(json.dumps(result, ensure_ascii=False))
`;

let disabled = false;

type ScraplingToolName = typeof TOOL_NAME;

function disable() {
  disabled = true;
}

function enable() {
  disabled = false;
}

function isEnabled() {
  return !disabled;
}

function hasNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateSelectors(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return `${TOOL_NAME} requires 'selectors' to be an object of name to CSS selector`;
  }
  for (const [name, selector] of Object.entries(value as Record<string, unknown>)) {
    if (!name.trim()) {
      return `${TOOL_NAME} selector names must be non-empty strings`;
    }
    if (!hasNonEmptyString(selector)) {
      return `${TOOL_NAME} selector '${name}' must be a non-empty string`;
    }
  }
  return null;
}

function validateInput(
  tool: string,
  input: Record<string, unknown>,
): string | null {
  if (tool !== TOOL_NAME) {
    return `Unknown tool: ${tool}. Available: ${TOOL_NAME}`;
  }

  for (const key of Object.keys(input)) {
    if (FORBIDDEN_NETWORK_FIELDS.has(key)) {
      return `${TOOL_NAME} does not support custom network field '${key}' in S2; provide only a safe public 'url' without headers, cookies, auth, or proxies`;
    }
    if (!ALLOWED_FIELDS.has(key)) {
      return `${TOOL_NAME} received unsupported input field '${key}'`;
    }
  }

  const hasHtml = hasNonEmptyString(input.html);
  const hasSourcePath = hasNonEmptyString(input.sourcePath);
  const hasUrl = hasNonEmptyString(input.url);
  if ([hasHtml, hasSourcePath, hasUrl].filter(Boolean).length !== 1) {
    return `${TOOL_NAME} requires exactly one of non-empty 'html', non-empty 'sourcePath', or safe public 'url'`;
  }

  if (input.html !== undefined && typeof input.html !== "string") {
    return `${TOOL_NAME} requires 'html' to be a string when provided`;
  }
  if (input.sourcePath !== undefined && typeof input.sourcePath !== "string") {
    return `${TOOL_NAME} requires 'sourcePath' to be a string when provided`;
  }
  if (input.url !== undefined && typeof input.url !== "string") {
    return `${TOOL_NAME} requires 'url' to be a string when provided`;
  }
  if (hasUrl) {
    const urlError = validateSafePublicUrl(String(input.url));
    if (urlError) {
      return urlError;
    }
  }
  if (input.includeText !== undefined && typeof input.includeText !== "boolean") {
    return `${TOOL_NAME} requires 'includeText' to be a boolean when provided`;
  }
  if (input.includeLinks !== undefined && typeof input.includeLinks !== "boolean") {
    return `${TOOL_NAME} requires 'includeLinks' to be a boolean when provided`;
  }
  if (
    input.timeoutMs !== undefined
    && (
      typeof input.timeoutMs !== "number"
      || !Number.isInteger(input.timeoutMs)
      || input.timeoutMs < 1000
    )
  ) {
    return `${TOOL_NAME} requires 'timeoutMs' to be an integer >= 1000 when provided`;
  }

  return validateSelectors(input.selectors);
}

function parseIpv4(hostname: string): number[] | null {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }
  const octets = hostname.split(".").map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }
  return octets;
}

function isForbiddenIpv4(octets: number[]) {
  const [a, b] = octets;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

function isForbiddenIpv6(hostname: string) {
  const normalized = normalizeHostname(hostname);
  if (normalized === "::" || normalized === "::1") {
    return true;
  }
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe90:")
    || normalized.startsWith("fea0:") || normalized.startsWith("feb0:")) {
    return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }

  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) {
    const octets = parseIpv4(mappedIpv4[1]);
    return octets === null || isForbiddenIpv4(octets);
  }

  return false;
}

function validateSafePublicUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw !== value || /\s/.test(raw)) {
    return `${TOOL_NAME} requires 'url' to be a non-empty URL without surrounding or embedded whitespace`;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return `${TOOL_NAME} requires 'url' to be a well-formed absolute URL`;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return `${TOOL_NAME} only supports safe public http/https URLs`;
  }
  if (parsed.username || parsed.password) {
    return `${TOOL_NAME} rejects credentialed URLs`;
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) {
    return `${TOOL_NAME} requires 'url' to include a hostname`;
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return `${TOOL_NAME} rejects localhost URLs`;
  }
  if (!hostname.includes(".") && net.isIP(hostname) === 0) {
    return `${TOOL_NAME} rejects single-label hostnames for public URL fetching`;
  }

  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4) {
    const octets = parseIpv4(hostname);
    if (octets === null || isForbiddenIpv4(octets)) {
      return `${TOOL_NAME} rejects loopback, private, link-local, or otherwise non-public IP URLs`;
    }
  } else if (ipVersion === 6 && isForbiddenIpv6(hostname)) {
    return `${TOOL_NAME} rejects loopback, private, link-local, or otherwise non-public IP URLs`;
  }

  return null;
}

function resolvePythonExecutable() {
  const override = process.env.DIRECTIVE_SCRAPLING_PYTHON;
  return override && override.trim().length > 0 ? override.trim() : DEFAULT_SCRAPLING_PYTHON;
}

function resolveTimeoutMs(input: CallableExecutionInput) {
  const hasUrl = hasNonEmptyString(input.input.url);
  const maxTimeout = hasUrl ? MAX_URL_TIMEOUT_MS : MAX_TIMEOUT_MS;
  const requested = typeof input.input.timeoutMs === "number"
    ? input.input.timeoutMs
    : hasUrl ? DEFAULT_URL_TIMEOUT_MS : input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return Math.min(requested, maxTimeout);
}

function createPythonHelper() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dk-scrapling-"));
  const helperPath = path.join(tempDir, "extract_html.py");
  fs.writeFileSync(helperPath, PYTHON_HELPER, "utf8");
  return {
    helperPath,
    cleanup() {
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

function normalizeSelectors(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => hasNonEmptyString(entry[1]))
      .map(([name, selector]) => [name, selector.trim()]),
  );
}

function buildPythonPayload(input: Record<string, unknown>) {
  const hasSourcePath = hasNonEmptyString(input.sourcePath);
  const hasUrl = hasNonEmptyString(input.url);
  const url = hasUrl ? new URL(String(input.url).trim()).href : "";
  const payload: Record<string, unknown> = {
    sourceType: hasUrl ? "url" : hasSourcePath ? "sourcePath" : "html",
    selectors: normalizeSelectors(input.selectors),
    includeText: input.includeText === true,
    includeLinks: input.includeLinks === true,
  };

  if (hasUrl) {
    payload.url = url;
    payload.fetchTimeoutSeconds = Math.ceil(resolveUrlFetchTimeoutMs(input) / 1000);
  } else if (hasSourcePath) {
    const sourcePath = path.resolve(String(input.sourcePath));
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file does not exist: ${sourcePath}`);
    }
    payload.sourcePath = sourcePath;
  } else {
    payload.html = String(input.html);
  }

  return payload;
}

function resolveUrlFetchTimeoutMs(input: Record<string, unknown>) {
  const requested = typeof input.timeoutMs === "number" ? input.timeoutMs : DEFAULT_URL_TIMEOUT_MS;
  return Math.min(requested, MAX_URL_TIMEOUT_MS);
}

async function runScraplingCommand(input: {
  payload: Record<string, unknown>;
  timeoutMs: number;
}): Promise<{ stdout: string; stderr: string; command: string }> {
  const python = resolvePythonExecutable();
  const helper = createPythonHelper();
  const args = [helper.helperPath];
  const command = `${python} ${args.map((value) => `"${value}"`).join(" ")}`;

  return new Promise((resolve, reject) => {
    const child = spawn(python, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      helper.cleanup();
      callback();
    };

    const timer = setTimeout(() => {
      child.kill();
      settle(() => reject(new Error(`Scrapling extraction timed out after ${input.timeoutMs}ms`)));
    }, input.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      settle(() => reject(error));
    });

    child.on("close", (code) => {
      settle(() => {
        if (code === 0) {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            command,
          });
          return;
        }
        reject(new Error(stderr.trim() || `Scrapling extraction exited with code ${code}`));
      });
    });

    child.stdin.end(`${JSON.stringify(input.payload)}\n`, "utf8");
  });
}

async function execute(input: CallableExecutionInput): Promise<CallableExecutionResult> {
  const startedAt = new Date();
  const timeoutMs = resolveTimeoutMs(input);
  const tool = input.tool as ScraplingToolName;
  const baseMeta = {
    startedAt: startedAt.toISOString(),
    completedAt: "",
    durationMs: 0,
    timeoutMs,
    capabilityId: CAPABILITY_ID,
  };

  if (disabled) {
    const completedAt = new Date();
    return {
      ok: false,
      tool,
      status: "disabled",
      result: null,
      metadata: {
        ...baseMeta,
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    };
  }

  const validationError = validateInput(tool, input.input);
  if (validationError) {
    const completedAt = new Date();
    return {
      ok: false,
      tool,
      status: "validation_error",
      result: validationError,
      metadata: {
        ...baseMeta,
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    };
  }

  try {
    const payload = buildPythonPayload(input.input);
    const { stdout } = await runScraplingCommand({
      payload,
      timeoutMs,
    });
    const result = JSON.parse(stdout) as Record<string, unknown>;

    const completedAt = new Date();
    return {
      ok: true,
      tool,
      status: "success",
      result,
      metadata: {
        ...baseMeta,
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    };
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = message.includes("timed out");
    const isMissingFetcherDependency = message.includes("curl_cffi dependency missing")
      || message.includes("No module named 'curl_cffi'");
    const resultMessage = isMissingFetcherDependency
      ? `dependency_missing: ${message}`
      : message;
    return {
      ok: false,
      tool,
      status: isTimeout ? "timeout" : "error",
      result: resultMessage,
      metadata: {
        ...baseMeta,
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    };
  }
}

function listTools() {
  return [{
    tool: TOOL_NAME,
    functionName: "extractHtml",
    modulePath: "runtime/capabilities/pipe-scrapling-adaptive-web-scraper-mq9mmrc0/executor.ts",
    inputType: "ScraplingExtractInput",
    resultType: "ScraplingExtractOutput",
  }];
}

export function createScraplingCallableCapability(): CallableCapability {
  return {
    descriptor: {
      capabilityId: CAPABILITY_ID,
      status: disabled ? "disabled" : "callable",
      form: "runtime_owned_safe_public_html_extraction",
      title: "Scrapling Adaptive Web Scraper",
      toolCount: 1,
      tools: [TOOL_NAME],
      defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
      maxTimeoutMs: MAX_TIMEOUT_MS,
    },
    execute,
    disable,
    enable,
    isEnabled,
    listTools,
  };
}

export {
  execute as executeScraplingTool,
  disable as disableScraplingCapability,
  enable as enableScraplingCapability,
  isEnabled as isScraplingCapabilityEnabled,
  listTools as listScraplingTools,
};
