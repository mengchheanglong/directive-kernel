import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapStandaloneHostWorkspace } from "../../hosts/standalone-host/bootstrap.ts";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..");
const MCP_CLI_RELATIVE = "./hosts/mcp-host/cli.ts";
const DISCOVERY_SUBMISSION_SCHEMA_PATH = path.resolve(
  REPO_ROOT,
  "shared/schemas/discovery-submission-request.schema.json",
);

describe("MCP input validation", () => {
  let workspaceRoot: string;
  let directiveRoot: string;
  let child: ChildProcess;
  let nextId: number;
  let stderrCapture: string;
  let stdoutBuffer: string;
  let validateDiscoverySubmission: ReturnType<Ajv2020["compile"]>;

  const pendingResolvers = new Map<
    number,
    { resolve: (msg: Record<string, unknown>) => void; reject: (err: Error) => void }
  >();

  function processStdoutBuffer() {
    let idx: number;
    while ((idx = stdoutBuffer.indexOf("\n")) !== -1) {
      const line = stdoutBuffer.slice(0, idx).trim();
      stdoutBuffer = stdoutBuffer.slice(idx + 1);
      if (!line) continue;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (msg.id !== undefined && typeof msg.id === "number" && pendingResolvers.has(msg.id)) {
        const resolver = pendingResolvers.get(msg.id)!;
        pendingResolvers.delete(msg.id);
        resolver.resolve(msg);
      }
    }
  }

  function sendRequest(
    method: string,
    params: unknown,
    timeoutMs = 10_000,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const request = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";

      const timer = setTimeout(() => {
        pendingResolvers.delete(id);
        reject(
          new Error(
            `Request ${method}(${id}) timed out after ${timeoutMs}ms\nstderr:\n${stderrCapture}`,
          ),
        );
      }, timeoutMs);

      pendingResolvers.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      child.stdin!.write(request);
    });
  }

  function sendNotification(method: string, params?: unknown): void {
    const notification = JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n";
    child.stdin!.write(notification);
  }

  function expectRpcFailure(response: Record<string, unknown>) {
    if (response.error) {
      const error = response.error as Record<string, unknown>;
      expect(typeof error.message).toBe("string");
      return;
    }

    expect(response).toHaveProperty("result");
    const result = response.result as Record<string, unknown>;
    expect(result.isError).toBe(true);
  }

  beforeAll(async () => {
    workspaceRoot = path.join(os.tmpdir(), `dk-mcp-property-${Date.now()}`);
    fs.mkdirSync(workspaceRoot, { recursive: true });
    const bootstrap = bootstrapStandaloneHostWorkspace({
      outputRoot: workspaceRoot,
      receivedAt: "2026-06-08",
    });
    directiveRoot = bootstrap.directiveRoot;

    const schema = JSON.parse(fs.readFileSync(DISCOVERY_SUBMISSION_SCHEMA_PATH, "utf8")) as Record<string, unknown>;
    const ajv = new Ajv2020({ strict: false });
    addFormats(ajv);
    validateDiscoverySubmission = ajv.compile(schema);

    nextId = 1;
    stderrCapture = "";
    stdoutBuffer = "";

    child = spawn(
      process.execPath,
      ["--import", "tsx", MCP_CLI_RELATIVE, "--directive-root", directiveRoot],
      {
        cwd: REPO_ROOT,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      },
    );

    child.stdout!.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      processStdoutBuffer();
    });

    child.stderr!.on("data", (chunk: Buffer) => {
      stderrCapture += chunk.toString();
    });

    child.on("error", (err) => {
      for (const [id, resolver] of pendingResolvers) {
        resolver.reject(err);
        pendingResolvers.delete(id);
      }
    });

    const initResponse = await sendRequest(
      "initialize",
      {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
      15_000,
    );
    expect(initResponse.result).toBeDefined();
    sendNotification("notifications/initialized");
  }, 30_000);

  afterAll(() => {
    if (child && !child.killed && child.exitCode === null) {
      child.kill("SIGTERM");
    }
    if (workspaceRoot) {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
  }, 10_000);

  it("discovery_submit rejects malformed payloads without crashing the server", async () => {
    const malformedArgsArb = fc.anything({ maxDepth: 3 });

    await fc.assert(
      fc.asyncProperty(malformedArgsArb, async (argumentsValue) => {
        fc.pre(!validateDiscoverySubmission(argumentsValue));
        const response = await sendRequest("tools/call", {
          name: "discovery_submit",
          arguments: argumentsValue,
        });
        expectRpcFailure(response);

        const ping = await sendRequest("tools/list", {});
        expect(ping.result).toBeDefined();
      }),
      { numRuns: 50 },
    );
  });

  it("mission_approve rejects malformed payloads without crashing the server", async () => {
    const malformedArgsArb = fc.oneof(
      fc.constant(null),
      fc.string(),
      fc.integer(),
      fc.boolean(),
      fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), fc.anything({ maxDepth: 2 })),
    );

    await fc.assert(
      fc.asyncProperty(malformedArgsArb, async (argumentsValue) => {
        const response = await sendRequest("tools/call", {
          name: "mission_approve",
          arguments: argumentsValue,
        });
        expectRpcFailure(response);

        const ping = await sendRequest("tools/list", {});
        expect(ping.result).toBeDefined();
      }),
      { numRuns: 40 },
    );
  });

  it("the server remains responsive after a burst of malformed mutation calls", async () => {
    const malformedBurstArb = fc.array(
      fc.record({
        name: fc.constantFrom("discovery_submit", "mission_approve"),
        arguments: fc.anything({ maxDepth: 3 }),
      }),
      { minLength: 5, maxLength: 10 },
    );

    await fc.assert(
      fc.asyncProperty(malformedBurstArb, async (requests) => {
        for (const request of requests) {
          if (request.name === "discovery_submit") {
            fc.pre(!validateDiscoverySubmission(request.arguments));
          }
          const response = await sendRequest("tools/call", request);
          expectRpcFailure(response);
        }

        const ping = await sendRequest("tools/list", {});
        expect(ping.result).toBeDefined();
      }),
      { numRuns: 20 },
    );
  });
});
