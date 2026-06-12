import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapStandaloneHostWorkspace } from "../../hosts/standalone-host/bootstrap.ts";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..");
const MCP_CLI_RELATIVE = "./hosts/mcp-host/cli.ts";

describe("MCP server stdio integration", () => {
  let workspaceRoot: string;
  let directiveRoot: string;
  let exampleSubmission: Record<string, unknown>;
  let child: ChildProcess;
  let nextId: number;
  let stderrCapture: string;
  let stdoutBuffer: string;

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

  function parseToolResultJson(response: Record<string, unknown>) {
    expect(response).toHaveProperty("result");
    const result = response.result as Record<string, unknown>;
    expect(Array.isArray(result.content)).toBe(true);
    const firstContent = (result.content as Record<string, unknown>[])[0];
    expect(typeof firstContent.text).toBe("string");
    return JSON.parse(firstContent.text as string) as Record<string, unknown>;
  }

  beforeAll(async () => {
    workspaceRoot = path.join(os.tmpdir(), `dk-mcp-stdio-${Date.now()}`);
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const bootstrap = bootstrapStandaloneHostWorkspace({
      outputRoot: workspaceRoot,
      receivedAt: "2026-06-08",
    });
    directiveRoot = bootstrap.directiveRoot;
    exampleSubmission = JSON.parse(fs.readFileSync(bootstrap.exampleSubmissionPath, "utf8")) as Record<string, unknown>;

    nextId = 1;
    stderrCapture = "";
    stdoutBuffer = "";

    child = spawn(
      process.execPath,
      ["--import", "tsx", MCP_CLI_RELATIVE, "--directive-root", directiveRoot, "--profile", "full"],
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

    if (!initResponse.result) {
      throw new Error(
        `MCP initialize failed: ${JSON.stringify(initResponse)}\nstderr:\n${stderrCapture}`,
      );
    }

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

  it("responds to tools/list with a non-empty array of tools", async () => {
    const response = await sendRequest("tools/list", {});

    expect(response).toHaveProperty("result");
    const result = response.result as Record<string, unknown>;
    expect(Array.isArray(result.tools)).toBe(true);
    expect((result.tools as unknown[]).length).toBeGreaterThan(0);

    for (const tool of result.tools as Record<string, unknown>[]) {
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(typeof tool.inputSchema).toBe("object");
    }
  });

  it("responds to tools/call manifest_get with valid JSON content", async () => {
    const response = await sendRequest("tools/call", {
      name: "manifest_get",
      arguments: {},
    });

    const manifest = parseToolResultJson(response);
    expect(Array.isArray(manifest.operations)).toBe(true);
    expect((manifest.operations as unknown[]).length).toBeGreaterThan(0);
  });

  it("executes discovery_submit and writes the queue entry through the live MCP server", async () => {
    const response = await sendRequest("tools/call", {
      name: "discovery_submit",
      arguments: exampleSubmission,
    });

    const payload = parseToolResultJson(response);
    expect(payload.ok).toBe(true);
    expect(payload.record_shape).toBe("queue_only");
    expect(payload.candidate_id).toBe(exampleSubmission.candidate_id);

    const queuePath = path.join(directiveRoot, "discovery", "intake-queue.json");
    const queue = JSON.parse(fs.readFileSync(queuePath, "utf8")) as {
      entries: Array<{ candidate_id: string }>;
    };
    expect(queue.entries.some((entry) => entry.candidate_id === exampleSubmission.candidate_id)).toBe(true);
  });

  it("returns a JSON-RPC error for an unknown tool", async () => {
    const response = await sendRequest("tools/call", {
      name: "nonexistent_tool",
      arguments: {},
    });

    if (response.error) {
      const error = response.error as Record<string, unknown>;
      expect(String(error.message)).toMatch(/unknown tool|not found/i);
      return;
    }

    expect(response).toHaveProperty("result");
    const result = response.result as Record<string, unknown>;
    expect(result.isError).toBe(true);
    const content = result.content as Record<string, unknown>[];
    expect(String(content[0].text)).toMatch(/unknown tool|not found/i);
  });

  it("exits after receiving SIGTERM (code 0 on POSIX, null on Windows)", async () => {
    const exitPromise = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      child.on("exit", (code, signal) => {
        resolve({ code, signal });
      });
    });

    child.kill("SIGTERM");

    const result = await exitPromise;
    const lockPath = path.join(directiveRoot, "engine", ".lock");
    if (process.platform === "win32") {
      expect(result.code).toBeNull();
      expect(result.signal).toBe("SIGTERM");
    } else {
      expect(result.code).toBe(0);
      expect(fs.existsSync(lockPath)).toBe(false);
    }
  });
});
