import fs from "node:fs";
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
const DEFAULT_SCRAPLING_PYTHON = "C:/Python314/python";

const NETWORK_FIELDS = new Set([
  "url",
  "urls",
  "uri",
  "sourceUrl",
  "fetchUrl",
  "requestUrl",
  "href",
  "headers",
  "cookies",
  "proxy",
  "proxies",
  "fetch",
  "network",
]);

const ALLOWED_FIELDS = new Set([
  "html",
  "sourcePath",
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
if source_type == "sourcePath":
    source_path = pathlib.Path(payload["sourcePath"])
    html = source_path.read_text(encoding="utf-8")
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
    if (NETWORK_FIELDS.has(key)) {
      return `${TOOL_NAME} does not support network input '${key}' in S1; provide 'html' or 'sourcePath'`;
    }
    if (!ALLOWED_FIELDS.has(key)) {
      return `${TOOL_NAME} received unsupported input field '${key}'`;
    }
  }

  const hasHtml = hasNonEmptyString(input.html);
  const hasSourcePath = hasNonEmptyString(input.sourcePath);
  if (hasHtml === hasSourcePath) {
    return `${TOOL_NAME} requires exactly one of non-empty 'html' or non-empty 'sourcePath'`;
  }

  if (input.html !== undefined && typeof input.html !== "string") {
    return `${TOOL_NAME} requires 'html' to be a string when provided`;
  }
  if (input.sourcePath !== undefined && typeof input.sourcePath !== "string") {
    return `${TOOL_NAME} requires 'sourcePath' to be a string when provided`;
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

function resolvePythonExecutable() {
  const override = process.env.DIRECTIVE_SCRAPLING_PYTHON;
  return override && override.trim().length > 0 ? override.trim() : DEFAULT_SCRAPLING_PYTHON;
}

function resolveTimeoutMs(input: CallableExecutionInput) {
  const requested = typeof input.input.timeoutMs === "number"
    ? input.input.timeoutMs
    : input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return Math.min(requested, MAX_TIMEOUT_MS);
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
  const payload: Record<string, unknown> = {
    sourceType: hasSourcePath ? "sourcePath" : "html",
    selectors: normalizeSelectors(input.selectors),
    includeText: input.includeText === true,
    includeLinks: input.includeLinks === true,
  };

  if (hasSourcePath) {
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
    return {
      ok: false,
      tool,
      status: isTimeout ? "timeout" : "error",
      result: message,
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
      form: "runtime_owned_static_html_extraction",
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
