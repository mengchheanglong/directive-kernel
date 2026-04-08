/**
 * Directive-owned code normalizer callable executor.
 *
 * Wraps the code normalizer with the shared callable contract:
 * - Runtime input validation
 * - Timeout enforcement
 * - Structured execution results with metadata
 * - Disable gate for rollback
 *
 * This is the second Runtime callable capability, proving the callable
 * contract is reusable across different capability types.
 *
 * This capability is also a behavior-preserving transformation case,
 * satisfying CLAUDE.md's requirement that behavior-preserving
 * transformation is a first-class Runtime pattern.
 */

import { normalizeCode } from "./normalizer.ts";
import type { DirectiveCallableCapability } from "../../core/callable-contract.ts";

// --- Configuration ---

const CAPABILITY_ID = "dw-transform-code-normalizer";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;

// --- Disable gate ---

let disabled = false;

function disable(): void {
  disabled = true;
}

function enable(): void {
  disabled = false;
}

function isEnabled(): boolean {
  return !disabled;
}

// --- Tool types ---

type CodeNormalizerToolName = "normalize-code";

// --- Input validation ---

function validateInput(
  tool: string,
  input: Record<string, unknown>,
): string | null {
  if (tool !== "normalize-code") {
    return `Unknown tool: ${tool}. Available: normalize-code`;
  }
  if (typeof input.code !== "string") {
    return "normalize-code requires a 'code' string field";
  }
  if (input.code.length === 0) {
    return "normalize-code requires non-empty 'code'";
  }
  return null;
}

// --- Timeout wrapper ---

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Execution timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// --- Execution types ---

interface ExecutionInput {
  tool: CodeNormalizerToolName;
  input: Record<string, unknown>;
  timeoutMs?: number;
}

interface ExecutionResult {
  ok: boolean;
  tool: string;
  status: "success" | "error" | "timeout" | "disabled" | "validation_error";
  result: unknown;
  metadata: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
    timeoutMs: number;
    capabilityId: string;
  };
}

// --- Public executor ---

async function execute(input: ExecutionInput): Promise<ExecutionResult> {
  const startedAt = new Date();
  const timeoutMs = Math.min(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

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
      tool: input.tool,
      status: "disabled",
      result: null,
      metadata: {
        ...baseMeta,
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    };
  }

  const validationError = validateInput(input.tool, input.input);
  if (validationError) {
    const completedAt = new Date();
    return {
      ok: false,
      tool: input.tool,
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
    const result = await withTimeout(
      Promise.resolve(normalizeCode({
        code: input.input.code as string,
        filename: input.input.filename as string | undefined,
        transforms: input.input.transforms as Record<string, boolean> | undefined,
      })),
      timeoutMs,
    );
    const completedAt = new Date();
    return {
      ok: true,
      tool: input.tool,
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
    const isTimeout = error instanceof Error && error.message.includes("timed out");
    return {
      ok: false,
      tool: input.tool,
      status: isTimeout ? "timeout" : "error",
      result: error instanceof Error ? error.message : String(error),
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
    tool: "normalize-code",
    functionName: "normalizeCode",
    modulePath: "runtime/capabilities/code-normalizer/normalizer.ts",
    inputType: "CodeNormalizerInput",
    resultType: "CodeNormalizerOutput",
  }];
}

// --- Callable contract implementation ---

export function createCodeNormalizerCallableCapability(): DirectiveCallableCapability {
  return {
    descriptor: {
      capabilityId: CAPABILITY_ID,
      status: disabled ? "disabled" : "callable",
      form: "runtime_owned_behavior_preserving_transformation",
      title: "Code Normalizer (Behavior-Preserving Transformation)",
      toolCount: 1,
      tools: ["normalize-code"],
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
  execute as executeCodeNormalizerTool,
  disable as disableCodeNormalizerCapability,
  enable as enableCodeNormalizerCapability,
  isEnabled as isCodeNormalizerCapabilityEnabled,
  listTools as listCodeNormalizerTools,
};
