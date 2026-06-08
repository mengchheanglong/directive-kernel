import fs from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  acquireDirectiveRootLock,
  releaseDirectiveRootLock,
} from "../../shared/lib/process-lock.ts";
import { buildToolRegistry } from "./tool-registry.ts";

const SERVER_NAME = "@directive/kernel-mcp";
const SERVER_VERSION = "0.2.0";

export async function startMcpHost(directiveRoot: string): Promise<void> {
  // Validate directiveRoot
  if (!fs.existsSync(directiveRoot)) {
    throw new Error(`Directive root not found: ${directiveRoot}`);
  }

  // Acquire process lock
  const lockResult = acquireDirectiveRootLock(directiveRoot);
  const releaseLock = () => releaseDirectiveRootLock(directiveRoot);

  // Release lock on exit
  const cleanup = () => {
    releaseLock();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Build tool registry
  const tools = buildToolRegistry({ directiveRoot });

  // Create MCP server
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  // tools/list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  // tools/call handler
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const tool = tools.find((t) => t.name === toolName);

    if (!tool) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${toolName}`);
    }

    // Validate input against tool's inputSchema
    const inputArgs = request.params.arguments ?? {};
    const validate = ajv.compile(tool.inputSchema as Record<string, unknown>);
    const valid = validate(inputArgs);
    if (!valid) {
      const details = validate.errors
        ?.map((e) => `${e.instancePath} ${e.message}`)
        .join("; ");
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid input for tool ${toolName}: ${details ?? "validation failed"}`,
      );
    }

    // Execute
    try {
      const result = await tool.execute(inputArgs);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  });

  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
