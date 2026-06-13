/**
 * Dynamic MCP Tool Projection
 */

import fs from "node:fs";
import path from "node:path";

import { appendDecisionPolicyEvent } from "../../../engine/decision-policy-ledger.ts";
import { listRuntimeCapabilityMetadata } from "../../../runtime/core/capability-registry.ts";
import { readRuntimeCapabilityManifest } from "../../../runtime/core/capability-registry.ts";
import type {
  RuntimeCapabilityMetadata,
  RuntimeCapabilityManifest,
} from "../../../runtime/core/capability-registry.ts";
import type { McpTool, ToolExecutor } from "../types.ts";

function buildInvocationTokens(
  capabilityId: string,
  outcome: "success" | "failure" | "contract_failure",
  extras: string[] = [],
): string[] {
  return [capabilityId, `outcome_${outcome}`, outcome, ...extras];
}

export function buildProjectedCapabilityTools(options: {
  directiveRoot: string;
}): { tools: McpTool[]; executors: Record<string, ToolExecutor> } {
  const capabilities = listRuntimeCapabilityMetadata(options.directiveRoot);
  const eligible = capabilities.filter((capability) => capability.projectionReady);

  const projectedTools: McpTool[] = [];
  const projectedExecutors: Record<string, ToolExecutor> = {};

  for (const capability of eligible) {
    const toolName = `cap_${capability.id}`;
    const manifest = readRuntimeCapabilityManifest({ id: capability.id });

    let inputSchema: Record<string, unknown> = { type: "object", properties: {} };
    if (manifest?.inputSchema) {
      const schemaPath = path.resolve(process.cwd(), manifest.inputSchema);
      if (fs.existsSync(schemaPath)) {
        try {
          inputSchema = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
        } catch {
          // fall through
        }
      }
    }

    const description = [
      `[Projected] ${capability.displayName}`,
      capability.description,
      manifest?.contract ? `Contract: ${manifest.contract}` : "",
    ].filter(Boolean).join("\n");

    const executor = buildProjectedExecutor(capability, manifest, options.directiveRoot);
    projectedTools.push({
      name: toolName,
      description,
      inputSchema,
      execute: executor,
    });
    projectedExecutors[toolName] = executor;
  }

  return { tools: projectedTools, executors: projectedExecutors };
}

function buildProjectedExecutor(
  capability: RuntimeCapabilityMetadata,
  manifest: RuntimeCapabilityManifest | null,
  directiveRoot: string,
): ToolExecutor {
  return async (args: Record<string, unknown>) => {
    const startTime = Date.now();

    if (manifest?.inputSchema) {
      const schemaPath = path.resolve(process.cwd(), manifest.inputSchema);
      if (fs.existsSync(schemaPath)) {
        try {
          const Ajv2020 = (await import("ajv/dist/2020.js")).default;
          const addFormats = (await import("ajv-formats")).default;
          const ajv = new Ajv2020({ strict: false });
          addFormats(ajv);
          const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
          const validate = ajv.compile(schema);
          const valid = validate(args);
          if (!valid) {
            const details = validate.errors
              ?.map((error: { instancePath: string; message?: string }) => `${error.instancePath} ${error.message}`)
              .join("; ");
            const recordedAt = new Date().toISOString();

            appendDecisionPolicyEvent({
              directiveRoot,
              event: {
                recordedAt,
                source: "capability_invocation",
                candidateId: capability.id,
                rationale: `Capability "${capability.id}" schema validation failed (input): ${details ?? "unknown"}`,
                sourceSignalTokens: buildInvocationTokens(capability.id, "contract_failure", ["input_validation"]),
                capabilityInvocation: {
                  outcome: "contract_failure",
                  gate: "contract_failure",
                  errorClass: "input_validation",
                },
              },
            });

            return {
              ok: false,
              error: `Input validation failed: ${details ?? "unknown"}`,
              capability_id: capability.id,
              gate: "contract_failure",
            };
          }
        } catch {
          // Schema unavailable; fall through to execution.
        }
      }
    }

    try {
      const { listDirectiveRuntimeCallableCapabilities } = await import(
        "../../../runtime/core/callable-execution.ts"
      );
      const { runDirectiveRuntimeCallableExecution } = await import(
        "../../../runtime/core/callable-execution.ts"
      );

      const descriptors = listDirectiveRuntimeCallableCapabilities();
      const descriptor = descriptors.find((entry) => entry.capabilityId === capability.id);

      if (!descriptor) {
        const recordedAt = new Date().toISOString();
        appendDecisionPolicyEvent({
          directiveRoot,
          event: {
            recordedAt,
            source: "capability_invocation",
            candidateId: capability.id,
            rationale: `Capability "${capability.id}" not found in callable registry.`,
            sourceSignalTokens: buildInvocationTokens(capability.id, "failure", ["not_found"]),
            capabilityInvocation: {
              outcome: "failure",
              errorClass: "not_found",
            },
          },
        });

        return {
          ok: false,
          error: `Capability "${capability.id}" not found in callable registry.`,
          capability_id: capability.id,
        };
      }

      const execInput = {
        directiveRoot,
        capabilityId: capability.id,
        tool: descriptor.tools.length > 0 ? descriptor.tools[0] : capability.id,
        input: args,
        allowExternalFetches: true,
      };

      const result = await runDirectiveRuntimeCallableExecution(
        execInput as Parameters<typeof runDirectiveRuntimeCallableExecution>[0],
      );
      const durationMs = Date.now() - startTime;

      let outputValidationError: string | null = null;
      if (manifest?.outputSchema) {
        const schemaPath = path.resolve(process.cwd(), manifest.outputSchema);
        if (fs.existsSync(schemaPath)) {
          try {
            const Ajv2020 = (await import("ajv/dist/2020.js")).default;
            const addFormats = (await import("ajv-formats")).default;
            const ajv = new Ajv2020({ strict: false });
            addFormats(ajv);
            const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
            const validate = ajv.compile(schema);
            const outputValid = validate(result.rawResult);
            if (!outputValid) {
              outputValidationError = validate.errors
                ?.map((error: { instancePath: string; message?: string }) => `${error.instancePath} ${error.message}`)
                .join("; ") ?? "schema mismatch";
            }
          } catch {
            // skip output validation if schema load fails
          }
        }
      }

      if (outputValidationError) {
        const recordedAt = new Date().toISOString();
        appendDecisionPolicyEvent({
          directiveRoot,
          event: {
            recordedAt,
            source: "capability_invocation",
            candidateId: capability.id,
            rationale: `Capability "${capability.id}" contract failure: ${outputValidationError}`,
            sourceSignalTokens: buildInvocationTokens(capability.id, "contract_failure", ["output_validation"]),
            capabilityInvocation: {
              outcome: "contract_failure",
              durationMs,
              gate: "contract_failure",
              errorClass: "output_validation",
            },
          },
        });

        return {
          ok: false,
          error: `Output validation failed: ${outputValidationError}`,
          capability_id: capability.id,
          gate: "contract_failure",
        };
      }

      const rawResult = result.rawResult;
      const recordedAt = new Date().toISOString();
      appendDecisionPolicyEvent({
        directiveRoot,
        event: {
          recordedAt,
          source: "capability_invocation",
          candidateId: capability.id,
          rationale: `Capability "${capability.id}" invoked successfully (${rawResult.status}, ${durationMs}ms). Tool: ${rawResult.tool}`,
          sourceSignalTokens: buildInvocationTokens(
            capability.id,
            "success",
            typeof rawResult.status === "string" ? [rawResult.status] : [],
          ),
          capabilityInvocation: {
            outcome: "success",
            durationMs,
            tool: typeof rawResult.tool === "string" ? rawResult.tool : undefined,
            status: typeof rawResult.status === "string" ? rawResult.status : undefined,
          },
        },
      });

      return {
        ok: true,
        capability_id: capability.id,
        status: rawResult.status,
        tool: rawResult.tool,
        duration_ms: durationMs,
        result: rawResult.result,
        projected: true,
      };
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      const recordedAt = new Date().toISOString();

      appendDecisionPolicyEvent({
        directiveRoot,
        event: {
          recordedAt,
          source: "capability_invocation",
          candidateId: capability.id,
          rationale: `Capability "${capability.id}" invocation failed (${durationMs}ms): ${message}`,
          sourceSignalTokens: buildInvocationTokens(capability.id, "failure"),
          capabilityInvocation: {
            outcome: "failure",
            durationMs,
          },
        },
      });

      return {
        ok: false,
        error: message,
        capability_id: capability.id,
        duration_ms: durationMs,
      };
    }
  };
}

export function getProjectedCapabilityIds(directiveRoot: string): string[] {
  const capabilities = listRuntimeCapabilityMetadata(directiveRoot);
  return capabilities
    .filter((capability) => capability.projectionReady)
    .map((capability) => capability.id)
    .sort();
}
