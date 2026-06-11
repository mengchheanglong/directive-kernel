import { runDirectiveCallableCapabilityWithExecutionSurface } from "../../../runtime/core/callable-execution.ts";
import type { CallableExecutionResult } from "../../../runtime/core/callable-contract.ts";
import { createShadcnUiCallableCapability } from "../../../runtime/capabilities/shadcn-ui/index.ts";

export * from "./types.ts";
export * from "./artifact-writers.ts";
export * from "./overview.ts";
export * from "./report-renderers.ts";
export * from "./capability-surfaces.ts";

// --- shadcn/ui capability execution ---

export async function invokeStandaloneShadcnUiCapability(input: {
  directiveRoot: string;
  tool: string;
  input: Record<string, unknown>;
  timeoutMs?: number;
  persistArtifacts?: boolean;
}): Promise<CallableExecutionResult> {
  const capability = createShadcnUiCallableCapability();
  const execution = await runDirectiveCallableCapabilityWithExecutionSurface({
    directiveRoot: input.directiveRoot,
    capability,
    tool: input.tool,
    input: input.input,
    timeoutMs: input.timeoutMs,
    persistArtifacts: input.persistArtifacts,
  });
  return execution.rawResult;
}
