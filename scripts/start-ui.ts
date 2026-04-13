import path from "node:path";
import { fileURLToPath } from "node:url";

import { startDirectiveUiServer } from "../hosts/web-host/server.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIRECTIVE_ROOT = path.resolve(SCRIPT_DIR, "..");

function parseArgs(argv: string[]) {
  const flags: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    flags[key] = value;
    index += 1;
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const host = String(flags.host || process.env.DIRECTIVE_UI_HOST || process.env.DIRECTIVE_FRONTEND_HOST || "127.0.0.1").trim();
  const portValue = String(flags.port || process.env.DIRECTIVE_UI_PORT || process.env.DIRECTIVE_FRONTEND_PORT || "43127").trim();
  const port = portValue ? Number(portValue) : undefined;

  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) {
    throw new Error("Invalid ui port");
  }

  const handle = await startDirectiveUiServer({
    directiveRoot: DIRECTIVE_ROOT,
    host,
    port,
  });

  process.stdout.write(
    `Directive Kernel UI host running\norigin: ${handle.origin}\ndirectiveRoot: ${handle.directiveRoot}\n`,
  );

  const close = async () => {
    await handle.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void close());
  process.on("SIGTERM", () => void close());
}

void main();
