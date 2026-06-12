import fs from "node:fs";
import path from "node:path";
import { ROUTE_TABLE } from "../web-host/api-manifest.ts";
import type { McpTool, ToolRegistryOptions } from "./types.ts";
import { buildDiscoveryExecutors } from "./executors/discovery.ts";
import { buildRuntimeExecutors } from "./executors/runtime.ts";
import { buildArchitectureExecutors } from "./executors/architecture.ts";
import { buildMissionExecutors } from "./executors/mission.ts";
import { buildReadExecutors } from "./executors/read.ts";
import { buildInvokeExecutors } from "./executors/invoke.ts";
import { buildMaintenanceExecutors } from "./executors/maintenance.ts";

function filterByProfile(
  entries: typeof ROUTE_TABLE,
  profile: string,
): typeof ROUTE_TABLE {
  if (profile === "full") return entries;
  return entries.filter((e) => e.profiles?.includes(profile));
}

export function buildToolRegistry(options: ToolRegistryOptions): McpTool[] {
  const profile = options.profile ?? "core";

  const dispatch = {
    ...buildDiscoveryExecutors(options),
    ...buildRuntimeExecutors(options),
    ...buildArchitectureExecutors(options),
    ...buildMissionExecutors(options),
    ...buildReadExecutors(options),
    ...buildInvokeExecutors(options),
    ...buildMaintenanceExecutors(options),
  };

  const filteredRoutes = filterByProfile(ROUTE_TABLE, profile);

  const tools: McpTool[] = filteredRoutes.map((entry) => {
    const executor = dispatch[entry.name];
    if (!executor) {
      throw new Error(`No executor mapped for operation: ${entry.name}`);
    }

    // Build description from manifest
    const descriptionParts = [entry.summary];
    if (entry.prerequisites && entry.prerequisites.length > 0) {
      descriptionParts.push(`Prerequisites: ${entry.prerequisites.join(", ")}`);
    }
    if (entry.side_effects && entry.side_effects.length > 0) {
      descriptionParts.push(`Side effects: ${entry.side_effects.join(", ")}`);
    }
    if (entry.allowed_after && entry.allowed_after.length > 0) {
      descriptionParts.push(`Allowed after: ${entry.allowed_after.join(", ")}`);
    }
    const description = descriptionParts.join("\n");

    // Load input schema from disk if declared
    let inputSchema: Record<string, unknown> = { type: "object", properties: {} };
    if (entry.input_schema) {
      const schemaPath = path.resolve(process.cwd(), entry.input_schema);
      if (!fs.existsSync(schemaPath)) {
        throw new Error(
          `Missing input schema for operation ${entry.name}: ${entry.input_schema}`,
        );
      }
      const raw = fs.readFileSync(schemaPath, "utf8");
      inputSchema = JSON.parse(raw) as Record<string, unknown>;
    }

    return {
      name: entry.name,
      description,
      inputSchema,
      execute: executor,
    };
  });

  // Add maintenance_archive as an extra MCP-only tool (core profile only)
  if (profile === "core") {
    tools.push({
      name: "maintenance_archive",
      description:
        "Archive old engine run records and rotate the decision-policy ledger. Default max_age_days=90.",
      inputSchema: {
        type: "object",
        properties: {
          max_age_days: {
            type: "number",
            description:
              "Archive records older than this many days (default: 90)",
          },
        },
      },
      execute: dispatch.maintenance_archive,
    });
  }

  // Deterministic sort by name
  tools.sort((left, right) => left.name.localeCompare(right.name));

  return tools;
}
