/**
 * Dynamic MCP Tool Projection
 *
 * Enumerates verified+contracted capabilities from runtime/capabilities/
 * and projects each as a first-class MCP tool: cap_<capability-id>.
 *
 * Rules:
 *   - Only capabilities with verification="verified" AND contract="complete"
 *     are projected.
 *   - Placeholder/claimed/runs_unverified_contract: never projected.
 *   - Each projected tool uses the capability's inputSchema/outputSchema
 *     for validation.
 *   - Execution validates input BEFORE and output AFTER.
 *   - Every invocation appends a capability_invocation ledger event.
 *   - The generic invoke_capability tool remains as a deprecated fallback.
 */

import fs from "node:fs";
import path from "node:path";

import { listRuntimeCapabilityMetadata } from "../../../runtime/core/capability-registry.ts";
import type {
  RuntimeCapabilityMetadata,
  RuntimeCapabilityManifest,
} from "../../../runtime/core/capability-registry.ts";
import { appendDecisionPolicyEvent } from "../../../engine/decision-policy-ledger.ts";
import { readRuntimeCapabilityManifest } from "../../../runtime/core/capability-registry.ts";
import type { McpTool, ToolExecutor } from "../types.ts";

// ── Projection ─────────────────────────────────────────────────────

export function buildProjectedCapabilityTools(options: {
  directiveRoot: string;
}): { tools: McpTool[]; executors: Record<string, ToolExecutor> } {
  const capabilities = listRuntimeCapabilityMetadata(options.directiveRoot);

  const eligible = capabilities.filter(
    (cap) => cap.verification === "verified" && cap.contract === "complete",
  );

  const projectedTools: McpTool[] = [];
  const projectedExecutors: Record<string, ToolExecutor> = {};

  for (const cap of eligible) {
    const toolName = `cap_${cap.id}`;
    const manifest = readRuntimeCapabilityManifest({ id: cap.id });

    let inputSchema: Record<string, unknown> = { type: "object", properties: {} };
    if (manifest?.inputSchema) {
      const schemaPath = path.resolve(process.cwd(), manifest.inputSchema);
      if (fs.existsSync(schemaPath)) {
        try {
          inputSchema = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
        } catch { /* fall through */ }
      }
    }

    const description = [
      `[Projected] ${cap.displayName}`,
      cap.description,
      manifest?.contract ? `Contract: ${manifest.contract}` : "",
    ].filter(Boolean).join("\n");

    const executor = buildProjectedExecutor(cap, manifest, options.directiveRoot);

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

// ── Projected executor ─────────────────────────────────────────────

function buildProjectedExecutor(
  cap: RuntimeCapabilityMetadata,
  manifest: RuntimeCapabilityManifest | null,
  directiveRoot: string,
): ToolExecutor {
  return async (args: Record<string, unknown>) => {
    const startTime = Date.now();

    // Validate input against inputSchema if available
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
              ?.map((e: { instancePath: string; message?: string }) => `${e.instancePath} ${e.message}`)
              .join("; ");

            appendDecisionPolicyEvent({
              directiveRoot,
              event: {
                recordedAt: new Date().toISOString(),
                source: "capability_invocation",
                candidateId: cap.id,
                rationale: `Capability "${cap.id}" schema validation failed (input): ${details ?? "unknown"}`,
                sourceSignalTokens: [cap.id, "contract_failure", "input_validation"],
              },
            });

            return {
              ok: false,
              error: `Input validation failed: ${details ?? "unknown"}`,
              capability_id: cap.id,
              gate: "contract_failure",
            };
          }
        } catch {
          // Schema unavailable — fall through to execution
        }
      }
    }

    // Execute
    try {
      const { listDirectiveRuntimeCallableCapabilities } = await import(
        "../../../runtime/core/callable-execution.ts"
      );
      const { runDirectiveRuntimeCallableExecution } = await import(
        "../../../runtime/core/callable-execution.ts"
      );

      const descriptors = listDirectiveRuntimeCallableCapabilities();
      const descriptor = descriptors.find((d) => d.capabilityId === cap.id);

      if (!descriptor) {
        appendDecisionPolicyEvent({
          directiveRoot,
          event: {
            recordedAt: new Date().toISOString(),
            source: "capability_invocation",
            candidateId: cap.id,
            rationale: `Capability "${cap.id}" not found in callable registry.`,
            sourceSignalTokens: [cap.id, "not_found"],
          },
        });

        return {
          ok: false,
          error: `Capability "${cap.id}" not found in callable registry.`,
          capability_id: cap.id,
        };
      }

      const execInput = {
        directiveRoot,
        capabilityId: cap.id,
        tool: descriptor.tools.length > 0 ? descriptor.tools[0] : cap.id,
        input: args,
        allowExternalFetches: true,
      };

      const result = await runDirectiveRuntimeCallableExecution(
        execInput as Parameters<typeof runDirectiveRuntimeCallableExecution>[0],
      );
      const durationMs = Date.now() - startTime;

      // Validate output
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
                ?.map((e: { instancePath: string; message?: string }) => `${e.instancePath} ${e.message}`)
                .join("; ") ?? "schema mismatch";
            }
          } catch { /* skip */ }
        }
      }

      if (outputValidationError) {
        appendDecisionPolicyEvent({
          directiveRoot,
          event: {
            recordedAt: new Date().toISOString(),
            source: "capability_invocation",
            candidateId: cap.id,
            rationale: `Capability "${cap.id}" contract failure: ${outputValidationError}`,
            sourceSignalTokens: [cap.id, "contract_failure", "output_validation"],
          },
        });

        return {
          ok: false,
          error: `Output validation failed: ${outputValidationError}`,
          capability_id: cap.id,
          gate: "contract_failure",
        };
      }

      // Success
      const rawResult = result.rawResult;
      appendDecisionPolicyEvent({
        directiveRoot,
        event: {
          recordedAt: new Date().toISOString(),
          source: "capability_invocation",
          candidateId: cap.id,
          rationale: `Capability "${cap.id}" invoked successfully (${rawResult.status}, ${durationMs}ms). Tool: ${rawResult.tool}`,
          sourceSignalTokens: [cap.id, "success", rawResult.status],
        },
      });

      return {
        ok: true,
        capability_id: cap.id,
        status: rawResult.status,
        tool: rawResult.tool,
        duration_ms: durationMs,
        result: rawResult.result,
        projected: true,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);

      appendDecisionPolicyEvent({
        directiveRoot,
        event: {
          recordedAt: new Date().toISOString(),
          source: "capability_invocation",
          candidateId: cap.id,
          rationale: `Capability "${cap.id}" invocation failed (${durationMs}ms): ${message}`,
          sourceSignalTokens: [cap.id, "failure"],
        },
      });

      return {
        ok: false,
        error: message,
        capability_id: cap.id,
        duration_ms: durationMs,
      };
    }
  };
}

export function getProjectedCapabilityIds(directiveRoot: string): string[] {
  const capabilities = listRuntimeCapabilityMetadata(directiveRoot);
  return capabilities
    .filter((cap) => cap.verification === "verified" && cap.contract === "complete")
    .map((cap) => cap.id)
    .sort();
}
