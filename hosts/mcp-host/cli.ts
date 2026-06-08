import fs from "node:fs";
import { startMcpHost } from "./server.ts";

function parseDirectiveRoot(): string {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--directive-root" && i + 1 < args.length) {
      return args[i + 1];
    }
    if (arg.startsWith("--directive-root=")) {
      return arg.slice("--directive-root=".length);
    }
  }
  console.error("Usage: pnpm run mcp:serve -- --directive-root <path>");
  process.exit(1);
}

const directiveRoot = parseDirectiveRoot();

if (!fs.existsSync(directiveRoot)) {
  console.error(`Error: Directive root not found: ${directiveRoot}`);
  process.exit(1);
}

startMcpHost(directiveRoot).catch((error) => {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
});
