import { startDirectiveFrontendServer } from "./server.ts";

function printUsage() {
  process.stdout.write(`Directive Kernel Frontend CLI

Commands:
  serve --directive-root <path> [--host <host>] [--port <port>]
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

  const directiveRoot = String(flags["directive-root"] || "").trim();
  if (!directiveRoot) {
    throw new Error("Missing required flag --directive-root");
  }

  const port = flags.port ? Number(flags.port) : undefined;
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) {
    throw new Error("Invalid value for --port");
  }

  const handle = await startDirectiveFrontendServer({
    directiveRoot,
    host: flags.host,
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
}

void main();
