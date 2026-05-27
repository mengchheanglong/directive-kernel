import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..");
const CLI_RELATIVE_PATH = "./hosts/standalone-host/cli.ts";
const TSX_BIN = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");

describe("standalone host double-start guard", () => {
  let tempRoot: string;
  let serverProcess: ChildProcess | null = null;
  let port: number;

  beforeAll(async () => {
    tempRoot = path.join(
      os.tmpdir(),
      `directive-kernel-double-start-${Date.now()}`,
    );
    port = 10000 + Math.floor(Math.random() * 50000);

    const initResult = spawnSync(
      process.execPath,
      [
        TSX_BIN,
        CLI_RELATIVE_PATH,
        "init",
        "--output-root",
        tempRoot,
        "--persistence-mode",
        "filesystem",
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 30_000,
      },
    );

    expect(
      initResult.error,
      `init failed: ${String(initResult.error)}`,
    ).toBeUndefined();
    expect(
      initResult.status,
      `init non-zero exit. stderr:\n${initResult.stderr}`,
    ).toBe(0);

    serverProcess = spawn(
      process.execPath,
      [
        TSX_BIN,
        CLI_RELATIVE_PATH,
        "serve",
        "--directive-root",
        tempRoot,
        "--port",
        String(port),
      ],
      {
        cwd: REPO_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("first server failed to start within 30s"));
      }, 30_000);

      let output = "";
      const onData = (chunk: Buffer) => {
        output += chunk.toString();
        if (output.includes('"ok": true')) {
          clearTimeout(timeout);
          resolve();
        }
      };

      serverProcess!.stdout?.on("data", onData);
      serverProcess!.stderr?.on("data", onData);
      serverProcess!.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      serverProcess!.on("exit", (code, signal) => {
        if (code !== null && code !== 0) {
          clearTimeout(timeout);
          reject(
            new Error(
              `first server exited code=${code} signal=${signal}. output:\n${output}`,
            ),
          );
        }
      });
    });
  }, 60_000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects a second serve against the same directive root", () => {
    const result = spawnSync(
      process.execPath,
      [
        TSX_BIN,
        CLI_RELATIVE_PATH,
        "serve",
        "--directive-root",
        tempRoot,
        "--port",
        String(port + 1),
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 30_000,
      },
    );

    expect(result.error, String(result.error)).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("directive_root_locked");
  });
});
