import fs from "node:fs";
import path from "node:path";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

import {
  createCodeNormalizerCallableCapability,
} from "../capabilities/code-normalizer/index.ts";
import {
  createLiteratureAccessCallableCapability,
} from "../capabilities/literature-access/index.ts";
import {
  createResearchVaultSourcePackCallableCapability,
} from "../capabilities/research-vault-source-pack/index.ts";
import type {
  DirectiveCallableCapability,
  DirectiveCallableExecutionResult,
} from "./callable-contract.ts";

export const DIRECTIVE_RUNTIME_CALLABLE_EXECUTION_RECORD_VERSION =
  "bounded_callable_execution_record/v1";

const SCIENTIFY_LITERATURE_ACCESS_CAPABILITY_ID =
  "dw-source-scientify-research-workflow-plugin-2026-03-27";
const CODE_NORMALIZER_CAPABILITY_ID = "dw-transform-code-normalizer";
const RESEARCH_VAULT_SOURCE_PACK_CAPABILITY_ID =
  "research-engine-web-aakashsharan-com-research-va-20260407t052643z-20260407t052702.";

const KNOWN_CALLABLE_CAPABILITIES = {
  [SCIENTIFY_LITERATURE_ACCESS_CAPABILITY_ID]:
    createLiteratureAccessCallableCapability,
  [CODE_NORMALIZER_CAPABILITY_ID]:
    createCodeNormalizerCallableCapability,
  [RESEARCH_VAULT_SOURCE_PACK_CAPABILITY_ID]:
    createResearchVaultSourcePackCallableCapability,
} satisfies Record<string, () => DirectiveCallableCapability>;

export type DirectiveRuntimeCallableCapabilityId =
  keyof typeof KNOWN_CALLABLE_CAPABILITIES;

export type DirectiveRuntimeCallableExecutionSummary = {
  kind: "object" | "array" | "primitive" | "nullish";
  topLevelCount: number | null;
  keys: string[];
  preview: string | null;
};

export type DirectiveRuntimeCallableExecutionRecord = {
  version: typeof DIRECTIVE_RUNTIME_CALLABLE_EXECUTION_RECORD_VERSION;
  executionId: string;
  executionAt: string;
  capability: {
    capabilityId: string;
    title: string;
    form: string;
    toolCount: number;
    tools: readonly string[];
  };
  invocation: {
    tool: string;
    timeoutMs: number;
    status: DirectiveCallableExecutionResult["status"];
    ok: boolean;
  };
  metadata: DirectiveCallableExecutionResult["metadata"];
  boundary: {
    executionSurface: "shared_runtime_callable_executor";
    hostIntegrated: false;
    promotionAutomation: false;
    automaticWorkflowAdvancement: false;
  };
  inputSummary: DirectiveRuntimeCallableExecutionSummary & {
    sizeBytes: number;
  };
  resultSummary: DirectiveRuntimeCallableExecutionSummary;
  artifacts: {
    recordPath: string;
    reportPath: string;
  };
};

export type DirectiveRuntimeCallableExecutionRunResult = {
  ok: true;
  record: DirectiveRuntimeCallableExecutionRecord;
  rawResult: DirectiveCallableExecutionResult;
  absolutePaths: {
    recordPath: string;
    reportPath: string;
  } | null;
};

export type DirectiveRuntimeCallableExecutionInput = {
  directiveRoot: string;
  capabilityId: string;
  tool: string;
  input: Record<string, unknown>;
  timeoutMs?: number;
  executionAt?: string;
  persistArtifacts?: boolean;
};

export type DirectiveRuntimeCallableDirectExecutionInput = {
  directiveRoot: string;
  capability: DirectiveCallableCapability;
  tool: string;
  input: Record<string, unknown>;
  timeoutMs?: number;
  executionAt?: string;
  persistArtifacts?: boolean;
};

function normalizeRelativeDirectivePath(directiveRoot: string, filePath: string) {
  return path.relative(directiveRoot, filePath).replace(/\\/g, "/");
}

function sanitizePathSegment(value: string) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function truncatePreview(value: string, maxLength = 240) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function summarizeUnknown(value: unknown): DirectiveRuntimeCallableExecutionSummary {
  if (value === null || value === undefined) {
    return {
      kind: "nullish",
      topLevelCount: null,
      keys: [],
      preview: null,
    };
  }

  if (Array.isArray(value)) {
    return {
      kind: "array",
      topLevelCount: value.length,
      keys: [],
      preview: truncatePreview(JSON.stringify(value)),
    };
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      kind: "object",
      topLevelCount: Object.keys(record).length,
      keys: Object.keys(record).slice(0, 12),
      preview: truncatePreview(JSON.stringify(record)),
    };
  }

  return {
    kind: "primitive",
    topLevelCount: null,
    keys: [],
    preview: truncatePreview(JSON.stringify(value)),
  };
}

function resolveExecutionArtifactPaths(input: {
  directiveRoot: string;
  capabilityId: string;
  tool: string;
  executionAt: string;
}) {
  const executionDir = normalizeAbsolutePath(
    path.resolve(input.directiveRoot, "runtime", "callable-executions"),
  );
  const timestamp = input.executionAt.replace(/[:.]/g, "-");
  const executionId = [
    timestamp,
    sanitizePathSegment(input.capabilityId),
    sanitizePathSegment(input.tool),
  ]
    .filter(Boolean)
    .join("-");
  const recordPath = normalizeAbsolutePath(path.resolve(executionDir, `${executionId}.json`));
  const reportPath = normalizeAbsolutePath(path.resolve(executionDir, `${executionId}.md`));

  return {
    executionId,
    recordPath,
    reportPath,
    recordRelativePath: normalizeRelativeDirectivePath(input.directiveRoot, recordPath),
    reportRelativePath: normalizeRelativeDirectivePath(input.directiveRoot, reportPath),
  };
}

function renderExecutionReport(record: DirectiveRuntimeCallableExecutionRecord) {
  return [
    "# Directive Runtime Callable Execution",
    "",
    `- Execution ID: \`${record.executionId}\``,
    `- Execution At: \`${record.executionAt}\``,
    `- Capability ID: \`${record.capability.capabilityId}\``,
    `- Capability Title: ${record.capability.title}`,
    `- Capability Form: \`${record.capability.form}\``,
    `- Tool: \`${record.invocation.tool}\``,
    `- Status: \`${record.invocation.status}\``,
    `- Result OK: \`${record.invocation.ok}\``,
    `- Timeout Ms: \`${record.invocation.timeoutMs}\``,
    `- Duration Ms: \`${record.metadata.durationMs}\``,
    `- Record Path: \`${record.artifacts.recordPath}\``,
    `- Report Path: \`${record.artifacts.reportPath}\``,
    "",
    "## Input Summary",
    "",
    `- Kind: \`${record.inputSummary.kind}\``,
    `- Size Bytes: \`${record.inputSummary.sizeBytes}\``,
    `- Keys: ${record.inputSummary.keys.length > 0 ? record.inputSummary.keys.map((key) => `\`${key}\``).join(", ") : "none"}`,
    `- Preview: ${record.inputSummary.preview ? `\`${record.inputSummary.preview}\`` : "n/a"}`,
    "",
    "## Result Summary",
    "",
    `- Kind: \`${record.resultSummary.kind}\``,
    `- Top-level Count: \`${record.resultSummary.topLevelCount ?? "n/a"}\``,
    `- Keys: ${record.resultSummary.keys.length > 0 ? record.resultSummary.keys.map((key) => `\`${key}\``).join(", ") : "none"}`,
    `- Preview: ${record.resultSummary.preview ? `\`${record.resultSummary.preview}\`` : "n/a"}`,
    "",
    "## Boundaries",
    "",
    "- One shared Runtime-owned callable executor surface only",
    "- No host integration",
    "- No promotion automation",
    "- No automatic workflow advancement",
    "",
  ].join("\n");
}

function withOuterTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Shared execution surface timed out after ${timeoutMs}ms`));
    }, timeoutMs);

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

function buildTimeoutResult(input: {
  capability: DirectiveCallableCapability;
  tool: string;
  timeoutMs: number;
  startedAt: Date;
  error: unknown;
}): DirectiveCallableExecutionResult {
  const completedAt = new Date();
  const message = input.error instanceof Error ? input.error.message : String(input.error);

  return {
    ok: false,
    tool: input.tool,
    status: "timeout",
    result: message,
    metadata: {
      startedAt: input.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - input.startedAt.getTime(),
      timeoutMs: input.timeoutMs,
      capabilityId: input.capability.descriptor.capabilityId,
    },
  };
}

async function executeWithSharedBoundary(input: {
  capability: DirectiveCallableCapability;
  tool: string;
  invocationInput: Record<string, unknown>;
  timeoutMs: number;
}) {
  const startedAt = new Date();

  try {
    return await withOuterTimeout(
      input.capability.execute({
        tool: input.tool,
        input: input.invocationInput,
        timeoutMs: input.timeoutMs,
      }),
      input.timeoutMs,
    );
  } catch (error) {
    return buildTimeoutResult({
      capability: input.capability,
      tool: input.tool,
      timeoutMs: input.timeoutMs,
      startedAt,
      error,
    });
  }
}

function writeExecutionArtifacts(input: {
  directiveRoot: string;
  record: DirectiveRuntimeCallableExecutionRecord;
}) {
  const absoluteRecordPath = normalizeAbsolutePath(
    path.resolve(input.directiveRoot, input.record.artifacts.recordPath),
  );
  const absoluteReportPath = normalizeAbsolutePath(
    path.resolve(input.directiveRoot, input.record.artifacts.reportPath),
  );

  fs.mkdirSync(path.dirname(absoluteRecordPath), { recursive: true });
  fs.writeFileSync(absoluteRecordPath, `${JSON.stringify(input.record, null, 2)}\n`, "utf8");
  fs.writeFileSync(absoluteReportPath, `${renderExecutionReport(input.record)}\n`, "utf8");

  return {
    recordPath: absoluteRecordPath,
    reportPath: absoluteReportPath,
  };
}

export function listDirectiveRuntimeCallableCapabilities() {
  return Object.values(KNOWN_CALLABLE_CAPABILITIES).map((createCapability) => {
    const capability = createCapability();
    return capability.descriptor;
  });
}

export function getDirectiveRuntimeCallableCapability(capabilityId: string) {
  const createCapability =
    KNOWN_CALLABLE_CAPABILITIES[capabilityId as DirectiveRuntimeCallableCapabilityId];
  return createCapability ? createCapability() : null;
}

export async function runDirectiveCallableCapabilityWithExecutionSurface(
  input: DirectiveRuntimeCallableDirectExecutionInput,
): Promise<DirectiveRuntimeCallableExecutionRunResult> {
  const executionAt = input.executionAt ?? new Date().toISOString();
  const capability = input.capability;
  const timeoutMs = Math.min(
    input.timeoutMs ?? capability.descriptor.defaultTimeoutMs,
    capability.descriptor.maxTimeoutMs,
  );
  const resolvedPaths = resolveExecutionArtifactPaths({
    directiveRoot: input.directiveRoot,
    capabilityId: capability.descriptor.capabilityId,
    tool: input.tool,
    executionAt,
  });
  const rawResult = await executeWithSharedBoundary({
    capability,
    tool: input.tool,
    invocationInput: input.input,
    timeoutMs,
  });
  const inputSummary = summarizeUnknown(input.input);
  const record: DirectiveRuntimeCallableExecutionRecord = {
    version: DIRECTIVE_RUNTIME_CALLABLE_EXECUTION_RECORD_VERSION,
    executionId: resolvedPaths.executionId,
    executionAt,
    capability: {
      capabilityId: capability.descriptor.capabilityId,
      title: capability.descriptor.title,
      form: capability.descriptor.form,
      toolCount: capability.descriptor.toolCount,
      tools: capability.descriptor.tools,
    },
    invocation: {
      tool: input.tool,
      timeoutMs,
      status: rawResult.status,
      ok: rawResult.ok,
    },
    metadata: rawResult.metadata,
    boundary: {
      executionSurface: "shared_runtime_callable_executor",
      hostIntegrated: false,
      promotionAutomation: false,
      automaticWorkflowAdvancement: false,
    },
    inputSummary: {
      ...inputSummary,
      sizeBytes: Buffer.byteLength(JSON.stringify(input.input)),
    },
    resultSummary: summarizeUnknown(rawResult.result),
    artifacts: {
      recordPath: resolvedPaths.recordRelativePath,
      reportPath: resolvedPaths.reportRelativePath,
    },
  };

  return {
    ok: true,
    record,
    rawResult,
    absolutePaths: input.persistArtifacts === false
      ? null
      : writeExecutionArtifacts({
          directiveRoot: input.directiveRoot,
          record,
        }),
  };
}

export async function runDirectiveRuntimeCallableExecution(
  input: DirectiveRuntimeCallableExecutionInput,
): Promise<DirectiveRuntimeCallableExecutionRunResult> {
  const capability = getDirectiveRuntimeCallableCapability(input.capabilityId);
  if (!capability) {
    throw new Error(`invalid_input: unknown callable capability "${input.capabilityId}"`);
  }

  return runDirectiveCallableCapabilityWithExecutionSurface({
    directiveRoot: input.directiveRoot,
    capability,
    tool: input.tool,
    input: input.input,
    timeoutMs: input.timeoutMs,
    executionAt: input.executionAt,
    persistArtifacts: input.persistArtifacts,
  });
}
