import type { DirectiveCallableCapability } from "../../core/callable-contract.ts";
import {
  RESEARCH_VAULT_SOURCE_PACK_CAPABILITY_ID,
  queryResearchVaultSourcePack,
} from "./source-pack.ts";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;

let disabled = false;

type ResearchVaultSourcePackToolName = "query-source-pack";

function disable(): void {
  disabled = true;
}

function enable(): void {
  disabled = false;
}

function isEnabled(): boolean {
  return !disabled;
}

function validateInput(tool: string, input: Record<string, unknown>) {
  if (tool !== "query-source-pack") {
    return "Unknown tool: query-source-pack is the only supported Research Vault source-pack tool";
  }
  if (typeof input.query !== "string" || !input.query.trim()) {
    return "query-source-pack requires a non-empty 'query' string";
  }
  if (
    input.maxItems !== undefined
    && (!Number.isInteger(input.maxItems) || input.maxItems < 1 || input.maxItems > 5)
  ) {
    return "'maxItems' must be an integer from 1 to 5";
  }
  return null;
}

export async function executeResearchVaultSourcePackTool(input: {
  tool: ResearchVaultSourcePackToolName;
  input: Record<string, unknown>;
  timeoutMs?: number;
}) {
  const startedAt = new Date();
  const timeoutMs = Math.min(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const baseMeta = {
    startedAt: startedAt.toISOString(),
    completedAt: "",
    durationMs: 0,
    timeoutMs,
    capabilityId: RESEARCH_VAULT_SOURCE_PACK_CAPABILITY_ID,
  };

  if (disabled) {
    const completedAt = new Date();
    return {
      ok: false,
      tool: input.tool,
      status: "disabled" as const,
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
      status: "validation_error" as const,
      result: validationError,
      metadata: {
        ...baseMeta,
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    };
  }

  const result = queryResearchVaultSourcePack({
    query: input.input.query as string,
    includeEvidence: input.input.includeEvidence as boolean | undefined,
    maxItems: input.input.maxItems as number | undefined,
  });
  const completedAt = new Date();

  return {
    ok: result.ok,
    tool: input.tool,
    status: result.ok ? ("success" as const) : ("validation_error" as const),
    result,
    metadata: {
      ...baseMeta,
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
    },
  };
}

export function listResearchVaultSourcePackTools() {
  return [{
    tool: "query-source-pack",
    functionName: "queryResearchVaultSourcePack",
    modulePath: "runtime/capabilities/research-vault-source-pack/source-pack.ts",
    inputType: "ResearchVaultSourcePackQueryInput",
    resultType: "ResearchVaultSourcePackOutput",
  }];
}

export function createResearchVaultSourcePackCallableCapability(): DirectiveCallableCapability {
  return {
    descriptor: {
      capabilityId: RESEARCH_VAULT_SOURCE_PACK_CAPABILITY_ID,
      status: disabled ? "disabled" : "callable",
      form: "runtime_owned_imported_source_derived_source_pack",
      title: "Research Vault Source-Pack Query",
      toolCount: 1,
      tools: ["query-source-pack"],
      defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
      maxTimeoutMs: MAX_TIMEOUT_MS,
    },
    execute: executeResearchVaultSourcePackTool,
    disable,
    enable,
    isEnabled,
    listTools: listResearchVaultSourcePackTools,
  };
}

export {
  disable as disableResearchVaultSourcePackCapability,
  enable as enableResearchVaultSourcePackCapability,
  isEnabled as isResearchVaultSourcePackCapabilityEnabled,
};
