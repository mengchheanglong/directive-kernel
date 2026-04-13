import fs from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIRECTIVE_ROOT = path.resolve(SCRIPT_DIR, "..");
const UI_ROOT = path.join(DIRECTIVE_ROOT, "ui");
const VITE_BIN = path.join(DIRECTIVE_ROOT, "ui", "node_modules", "vite", "bin", "vite.js");

function readEnv(name: string, legacyName: string, fallback: string) {
  return process.env[name] || process.env[legacyName] || fallback;
}

const DEV_HOST = readEnv("DIRECTIVE_UI_DEV_HOST", "DIRECTIVE_FRONTEND_DEV_HOST", "127.0.0.1");
const DEV_PORT = Number(readEnv("DIRECTIVE_UI_DEV_PORT", "DIRECTIVE_FRONTEND_DEV_PORT", "4173"));
const API_PORT = Number(readEnv("DIRECTIVE_UI_API_PORT", "DIRECTIVE_FRONTEND_API_PORT", "43128"));
function spawnChild(command: string, args: string[], options?: {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): ChildProcess {
  return spawn(command, args, {
    cwd: options?.cwd || DIRECTIVE_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      ...options?.env,
    },
    windowsHide: true,
  });
}

async function isPortFree(host: string, port: number) {
  return await new Promise<boolean>((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, host);
  });
}

async function resolveOpenPort(host: string, preferredPort: number, label: string) {
  for (let port = preferredPort; port < preferredPort + 50; port += 1) {
    if (await isPortFree(host, port)) {
      return port;
    }
  }
  throw new Error(`Unable to find an open ${label} port starting from ${preferredPort}`);
}

async function stopChild(child: ChildProcess | null) {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await new Promise<void>((resolve) => {
      killer.once("exit", () => resolve());
    });
    return;
  }

  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
      resolve();
    }, 5000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  if (!Number.isInteger(DEV_PORT) || DEV_PORT < 1 || DEV_PORT > 65535) {
    throw new Error("Invalid DIRECTIVE_UI_DEV_PORT");
  }
  if (!Number.isInteger(API_PORT) || API_PORT < 1 || API_PORT > 65535) {
    throw new Error("Invalid DIRECTIVE_UI_API_PORT");
  }
  if (!fs.existsSync(VITE_BIN)) {
    throw new Error("Missing UI dev dependency: vite. Run `pnpm install` from the repo root.");
  }

  const resolvedApiPort = await resolveOpenPort(DEV_HOST, API_PORT, "ui API");
  const resolvedDevPort = await resolveOpenPort(DEV_HOST, DEV_PORT, "ui dev");
  const apiOrigin = `http://${DEV_HOST}:${resolvedApiPort}`;
  const appOrigin = `http://${DEV_HOST}:${resolvedDevPort}`;

  const hostProcess = spawnChild(process.execPath, [
    "--experimental-strip-types",
    "./scripts/start-ui.ts",
    "--host",
    DEV_HOST,
    "--port",
    String(resolvedApiPort),
  ]);

  const viteProcess = spawnChild(
    process.execPath,
    [
      VITE_BIN,
      "--host",
      DEV_HOST,
      "--port",
      String(resolvedDevPort),
      "--strictPort",
    ],
    {
      cwd: UI_ROOT,
      env: {
        DIRECTIVE_UI_API_ORIGIN: apiOrigin,
      },
    },
  );

  process.stdout.write(
    `Directive Kernel dev stack\nui: ${appOrigin}\napi-host: ${apiOrigin}\n`,
  );

  let shuttingDown = false;
  const shutdown = async (code = 0) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    await Promise.all([
      stopChild(viteProcess),
      stopChild(hostProcess),
    ]);
    process.exit(code);
  };

  hostProcess.once("exit", (code) => {
    if (!shuttingDown) {
      void shutdown(code ?? 1);
    }
  });
  viteProcess.once("exit", (code) => {
    if (!shuttingDown) {
      void shutdown(code ?? 1);
    }
  });

  process.on("SIGINT", () => void shutdown(0));
  process.on("SIGTERM", () => void shutdown(0));
}

void main();
