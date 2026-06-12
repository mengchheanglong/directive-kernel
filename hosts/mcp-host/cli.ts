import fs from "node:fs";
import { startMcpHost } from "./server.ts";

interface CliArgs {
  directiveRoot: string;
  profile: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let directiveRoot: string | undefined;
  let profile = "core";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--directive-root" && i + 1 < args.length) {
      directiveRoot = args[i + 1];
    } else if (arg.startsWith("--directive-root=")) {
      directiveRoot = arg.slice("--directive-root=".length);
    } else if (arg === "--profile" && i + 1 < args.length) {
      profile = args[i + 1];
    } else if (arg.startsWith("--profile=")) {
      profile = arg.slice("--profile=".length);
    }
  }

  if (!directiveRoot) {
    console.error(
      "Error: --directive-root <path> is required\n"
        + "Usage: pnpm run mcp:serve -- --directive-root <path> [--profile <core|full>]\n"
        + "       tsx hosts/mcp-host/cli.ts --directive-root <path> [--profile <core|full>]",
    );
    process.exit(1);
  }

  if (profile !== "core" && profile !== "full") {
    console.error(
      `Error: --profile must be "core" or "full", got "${profile}"`,
    );
    process.exit(1);
  }

  return { directiveRoot, profile };
}

// Validate --directive-root before starting the server
const { directiveRoot, profile } = parseArgs();

if (!directiveRoot || !fs.existsSync(directiveRoot)) {
  console.error(
    `Error: Directive root does not exist or is inaccessible: ${directiveRoot}`,
  );
  process.exit(1);
}

startMcpHost(directiveRoot, profile).catch((error) => {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
});
