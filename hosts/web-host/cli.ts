import { startDirectiveUiServer } from "./server.ts";
import {
  acquireDirectiveRootLock,
  releaseDirectiveRootLock,
} from "../../shared/lib/process-lock.ts";

function printUsage() {
  process.stdout.write(`Directive Kernel UI CLI

Commands:
  serve [--directive-root <path>] [--host <host>] [--port <port>]

Environment variables (overridden by explicit flags):
  DIRECTIVE_UI_HOST, DIRECTIVE_FRONTEND_HOST     default host
  DIRECTIVE_UI_PORT, DIRECTIVE_FRONTEND_PORT     default port
`);
}

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const flags: Record<string, string> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    flags[key] = value;
    index += 1;
  }

  return {
    command,
    flags,
  };
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (command !== "serve") {
    printUsage();
    process.exit(1);
  }

  const directiveRoot = String(flags["directive-root"] || process.cwd()).trim();

  const hostFlag = flags.host
    || process.env.DIRECTIVE_UI_HOST
    || process.env.DIRECTIVE_FRONTEND_HOST
    || "127.0.0.1";

  const portFlag = flags.port
    || process.env.DIRECTIVE_UI_PORT
    || process.env.DIRECTIVE_FRONTEND_PORT;
  const port = portFlag ? Number(portFlag) : undefined;
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) {
    throw new Error("Invalid value for --port");
  }

  try {
    acquireDirectiveRootLock(directiveRoot);
  } catch (error) {
    process.stderr.write(`${String((error as Error).message || error)}\n`);
    process.exit(1);
  }

  const handle = await startDirectiveUiServer({
    directiveRoot,
    host: hostFlag,
    port,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        directiveRoot: handle.directiveRoot,
        origin: handle.origin,
        host: handle.host,
        port: handle.port,
      },
      null,
      2,
    )}\n`,
  );

  const close = async () => {
    await handle.close();
    releaseDirectiveRootLock(directiveRoot);
    process.exit(0);
  };
  process.on("SIGINT", () => void close());
  process.on("SIGTERM", () => void close());
}

void main();
