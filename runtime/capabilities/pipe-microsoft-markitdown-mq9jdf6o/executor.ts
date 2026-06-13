import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import type {
  CallableCapability,
  CallableExecutionInput,
  CallableExecutionResult,
} from "../../core/callable-contract.ts";

const CAPABILITY_ID = "pipe-microsoft-markitdown-mq9jdf6o";
const TOOL_NAME = "convert-to-markdown";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 45_000;
const DEFAULT_MARKITDOWN_PYTHON = "C:/Python314/python";

let disabled = false;

type MarkItDownToolName = typeof TOOL_NAME;

function disable() {
  disabled = true;
}

function enable() {
  disabled = false;
}

function isEnabled() {
  return !disabled;
}

function validateInput(
  tool: string,
  input: Record<string, unknown>,
): string | null {
  if (tool !== TOOL_NAME) {
    return `Unknown tool: ${tool}. Available: ${TOOL_NAME}`;
  }

  const hasSourcePath = typeof input.sourcePath === "string" && input.sourcePath.trim().length > 0;
  const hasHtml = typeof input.html === "string" && input.html.trim().length > 0;
  if (!hasSourcePath && !hasHtml) {
    return `${TOOL_NAME} requires either a non-empty 'sourcePath' or non-empty 'html' field`;
  }

  if (input.sourcePath !== undefined && typeof input.sourcePath !== "string") {
    return `${TOOL_NAME} requires 'sourcePath' to be a string when provided`;
  }
  if (input.html !== undefined && typeof input.html !== "string") {
    return `${TOOL_NAME} requires 'html' to be a string when provided`;
  }

  return null;
}

function resolvePythonExecutable() {
  const override = process.env.DIRECTIVE_MARKITDOWN_PYTHON;
  return override && override.trim().length > 0 ? override.trim() : DEFAULT_MARKITDOWN_PYTHON;
}

function createInlineHtmlFixture(html: string) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dk-markitdown-"));
  const fixturePath = path.join(tempDir, "input.html");
  fs.writeFileSync(fixturePath, html, "utf8");
  return {
    fixturePath,
    cleanup() {
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

async function runMarkItDownCommand(input: {
  sourcePath: string;
  timeoutMs: number;
}): Promise<{ stdout: string; stderr: string; command: string }> {
  const python = resolvePythonExecutable();
  const args = ["-m", "markitdown", input.sourcePath];
  const command = `${python} ${args.map((value) => `"${value}"`).join(" ")}`;

  return new Promise((resolve, reject) => {
    const child = spawn(python, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      reject(new Error(`MarkItDown conversion timed out after ${input.timeoutMs}ms`));
    }, input.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          command,
        });
        return;
      }
      reject(new Error(stderr.trim() || `MarkItDown exited with code ${code}`));
    });
  });
}

async function execute(input: CallableExecutionInput): Promise<CallableExecutionResult> {
  const startedAt = new Date();
  const timeoutMs = Math.min(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const tool = input.tool as MarkItDownToolName;
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

  let fixtureCleanup: (() => void) | null = null;

  try {
    let sourcePath = typeof input.input.sourcePath === "string" ? input.input.sourcePath.trim() : "";
    let sourceType: "file" | "html" = "file";

    if (!sourcePath) {
      const fixture = createInlineHtmlFixture(String(input.input.html));
      sourcePath = fixture.fixturePath;
      sourceType = "html";
      fixtureCleanup = fixture.cleanup;
    } else {
      sourcePath = path.resolve(sourcePath);
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file does not exist: ${sourcePath}`);
      }
    }

    const { stdout, command } = await runMarkItDownCommand({
      sourcePath,
      timeoutMs,
    });

    const completedAt = new Date();
    return {
      ok: true,
      tool,
      status: "success",
      result: {
        ok: true,
        markdown: stdout,
        sourcePath,
        sourceType,
        command,
      },
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
  } finally {
    fixtureCleanup?.();
  }
}

function listTools() {
  return [{
    tool: TOOL_NAME,
    functionName: "convertToMarkdown",
    modulePath: "runtime/capabilities/pipe-microsoft-markitdown-mq9jdf6o/executor.ts",
    inputType: "MarkItDownCallableInput",
    resultType: "MarkItDownCallableOutput",
  }];
}

export function createMarkItDownCallableCapability(): CallableCapability {
  return {
    descriptor: {
      capabilityId: CAPABILITY_ID,
      status: disabled ? "disabled" : "callable",
      form: "runtime_owned_document_to_markdown_conversion",
      title: "Microsoft MarkItDown",
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
  execute as executeMarkItDownTool,
  disable as disableMarkItDownCapability,
  enable as enableMarkItDownCapability,
  isEnabled as isMarkItDownCapabilityEnabled,
  listTools as listMarkItDownTools,
};
