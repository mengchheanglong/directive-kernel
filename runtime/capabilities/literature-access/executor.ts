/**
 * Directive-owned literature-access callable executor.
 *
 * Wraps the literature-access tool bundle with:
 * - Runtime input validation
 * - Timeout enforcement
 * - Structured execution results with metadata
 * - Disable gate for rollback
 *
 * This is the real callable execution surface for the Scientify
 * literature-access capability (dw-source-scientify-research-workflow-plugin-2026-03-27).
 */

import {
  type ScientifyLiteratureAccessToolName,
  getDirectiveRuntimeScientifyLiteratureAccessTool,
  listDirectiveRuntimeScientifyLiteratureAccessTools,
} from "./bundle.ts";

// --- Configuration ---

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

// --- Disable gate ---

let disabled = false;

export function disableLiteratureAccessCapability(): void {
  disabled = true;
}

export function enableLiteratureAccessCapability(): void {
  disabled = false;
}

export function isLiteratureAccessCapabilityEnabled(): boolean {
  return !disabled;
}

// --- Execution types ---

export interface CallableExecutionInput {
  tool: ScientifyLiteratureAccessToolName;
  input: Record<string, unknown>;
  timeoutMs?: number;
}

export interface CallableExecutionResult {
  ok: boolean;
  tool: ScientifyLiteratureAccessToolName;
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

// --- Input validation ---

const TOOL_INPUT_VALIDATORS: Record<
  ScientifyLiteratureAccessToolName,
  (input: Record<string, unknown>) => string | null
> = {
  "arxiv-search": (input) => {
    if (typeof input.query !== "string" || input.query.trim().length === 0) {
      return "arxiv-search requires a non-empty 'query' string";
    }
    if (input.max_results !== undefined && typeof input.max_results !== "number") {
      return "'max_results' must be a number";
    }
    return null;
  },
  "arxiv-download": (input) => {
    if (!Array.isArray(input.arxiv_ids) || input.arxiv_ids.length === 0) {
      return "arxiv-download requires a non-empty 'arxiv_ids' array";
    }
    for (const id of input.arxiv_ids) {
      if (typeof id !== "string" || id.trim().length === 0) {
        return "Each arxiv_id must be a non-empty string";
      }
    }
    return null;
  },
  "openalex-search": (input) => {
    if (typeof input.query !== "string" || input.query.trim().length === 0) {
      return "openalex-search requires a non-empty 'query' string";
    }
    if (input.max_results !== undefined && typeof input.max_results !== "number") {
      return "'max_results' must be a number";
    }
    return null;
  },
  "unpaywall-download": (input) => {
    if (!Array.isArray(input.dois) || input.dois.length === 0) {
      return "unpaywall-download requires a non-empty 'dois' array";
    }
    for (const doi of input.dois) {
      if (typeof doi !== "string" || doi.trim().length === 0) {
        return "Each DOI must be a non-empty string";
      }
    }
    return null;
  },
};

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

// --- Public executor ---

const CAPABILITY_ID = "dw-source-scientify-research-workflow-plugin-2026-03-27";

export async function executeLiteratureAccessTool(
  input: CallableExecutionInput,
): Promise<CallableExecutionResult> {
  const startedAt = new Date();
  const timeoutMs = Math.min(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

  const baseMeta = {
    startedAt: startedAt.toISOString(),
    completedAt: "",
    durationMs: 0,
    timeoutMs,
    capabilityId: CAPABILITY_ID,
  };

  // Check disable gate
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

  // Validate tool name
  const toolDef = getDirectiveRuntimeScientifyLiteratureAccessTool(input.tool);
  if (!toolDef) {
    const completedAt = new Date();
    return {
      ok: false,
      tool: input.tool,
      status: "validation_error",
      result: `Unknown tool: ${input.tool}`,
      metadata: {
        ...baseMeta,
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    };
  }

  // Validate input
  const validator = TOOL_INPUT_VALIDATORS[input.tool];
  const validationError = validator(input.input);
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

  // Execute with timeout
  try {
    const result = await withTimeout(toolDef.invoke(input.input), timeoutMs);
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

export function listCallableTools() {
  return listDirectiveRuntimeScientifyLiteratureAccessTools().map((t) => ({
    tool: t.tool,
    functionName: t.functionName,
    modulePath: t.modulePath,
    inputType: t.inputType,
    resultType: t.resultType,
  }));
}

export const LITERATURE_ACCESS_CALLABLE_CAPABILITY = {
  capabilityId: CAPABILITY_ID,
  status: (disabled ? "disabled" : "callable") as "callable" | "disabled",
  form: "runtime_owned_callable_bundle",
  title: "Scientify Literature-Access Tool Bundle",
  toolCount: 4,
  tools: ["arxiv-search", "arxiv-download", "openalex-search", "unpaywall-download"] as const,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  maxTimeoutMs: MAX_TIMEOUT_MS,
} as const;

/**
 * Returns the literature-access capability conforming to the shared
 * DirectiveCallableCapability contract from runtime/core/callable-contract.ts.
 */
export function createLiteratureAccessCallableCapability() {
  return {
    descriptor: {
      capabilityId: CAPABILITY_ID,
      status: (disabled ? "disabled" : "callable") as "callable" | "disabled",
      form: "runtime_owned_callable_bundle",
      title: "Scientify Literature-Access Tool Bundle",
      toolCount: 4,
      tools: ["arxiv-search", "arxiv-download", "openalex-search", "unpaywall-download"] as const,
      defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
      maxTimeoutMs: MAX_TIMEOUT_MS,
    },
    execute: executeLiteratureAccessTool,
    disable: disableLiteratureAccessCapability,
    enable: enableLiteratureAccessCapability,
    isEnabled: isLiteratureAccessCapabilityEnabled,
    listTools: listCallableTools,
  };
}
