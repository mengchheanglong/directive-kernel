/**
 * Dev server entry point — starts the directive-kernel API host for local
 * development. The UI is static HTML served by the web host; no Vite or
 * separate frontend build step is needed.
 *
 * Usage: npx tsx ./scripts/run-ui-dev.ts
 *
 * Equivalent to: pnpm run ui:start
 */

import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIRECTIVE_ROOT = path.resolve(SCRIPT_DIR, "..");
const TSX_BIN = path.join(DIRECTIVE_ROOT, "node_modules", "tsx", "dist", "cli.mjs");

function spawnChild(command: string, args: string[]): ChildProcess {
  return spawn(command, args, {
    cwd: DIRECTIVE_ROOT,
    stdio: "inherit",
    windowsHide: true,
  });
}

async function stopChild(child: ChildProcess | null) {
  if (!child || child.killed || child.exitCode !== null) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await new Promise<void>((resolve) => killer.once("exit", () => resolve()));
    return;
  }
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
      resolve();
    }, 5000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  const host = process.env.DIRECTIVE_UI_HOST || "127.0.0.1";
  const port = process.env.DIRECTIVE_UI_PORT || "43127";

  const hostProcess = spawnChild(process.execPath, [
    TSX_BIN,
    "./hosts/web-host/cli.ts",
    "serve",
    "--directive-root",
    ".",
  ]);

  process.stdout.write(`Directive Kernel dev server\nAPI host: http://${host}:${port}\n`);

  let shuttingDown = false;
  const shutdown = async (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    await stopChild(hostProcess);
    process.exit(code);
  };

  hostProcess.once("exit", (code) => {
    if (!shuttingDown) void shutdown(code ?? 1);
  });

  process.on("SIGINT", () => void shutdown(0));
  process.on("SIGTERM", () => void shutdown(0));
}

void main();
