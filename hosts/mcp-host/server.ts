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

  // Acquire process lock once on startup — released only on shutdown
  acquireDirectiveRootLock(directiveRoot);

  let shuttingDown = false;

  // Clean shutdown on signals: release lock and exit
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    releaseDirectiveRootLock(directiveRoot);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep-alive mechanism to prevent event loop drain between connections
  // (active interval ref keeps Node.js from exiting when stdin closes)
  const keepAlive = setInterval(() => {}, 60_000);

  while (!shuttingDown) {
    // Build fresh tool registry on each connection — no stale state
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

    // Create transport
    const transport = new StdioServerTransport();

    // Promise that resolves when the client disconnects
    const disconnected = new Promise<void>((resolve) => {
      // Protocol._onclose calls server.onclose when the transport chain closes
      const originalOnclose = server.onclose;
      server.onclose = () => {
        originalOnclose?.();
        if (!shuttingDown) resolve();
      };

      // Detect stdin EOF and trigger the transport close chain
      if (!process.stdin.readableEnded && !process.stdin.destroyed) {
        process.stdin.once("end", () => {
          transport.close().catch(() => {});
        });
      }
      // If stdin is already ended/destroyed (e.g., non-pipe context),
      // rely solely on server.onclose to detect disconnection
    });

    // Connect transport to server
    await server.connect(transport);
    console.error(`[MCP] Client connected (${tools.length} tools available)`);

    // Wait until the client disconnects or we shut down
    await disconnected;

    if (!shuttingDown) {
      console.error("[MCP] Client disconnected, waiting for reconnection...");
    }
  }

  clearInterval(keepAlive);
}
