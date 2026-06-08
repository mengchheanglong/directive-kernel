import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

// Whitelist the runtime data files the kernel resolves through
// `import.meta.url` at runtime. Adding a new example JSON requires adding it
// here so the build fails loudly rather than silently shipping a partial
// artifact. (R1.7, R6.5)
const RUNTIME_DATA_FILES = [
  "hosts/integration-kit/examples/api-manifest.example.json",
  "hosts/integration-kit/examples/discovery-submission-fast-path.json",
  "hosts/integration-kit/examples/discovery-submission-front-door.json",
  "hosts/integration-kit/examples/discovery-submission-queue-only.json",
  "hosts/integration-kit/examples/discovery-submission-split-case.json",
  "hosts/integration-kit/examples/first-consuming-host-goal-envelope.json",
  "hosts/integration-kit/examples/first-consuming-host-source.json",
  "hosts/integration-kit/examples/host-integration-acceptance-report.json",
  "hosts/mcp-host/index.ts",
  "hosts/mcp-host/cli.ts",
  "hosts/mcp-host/types.ts",
  "hosts/mcp-host/tool-registry.ts",
  "hosts/mcp-host/server.ts",
  "hosts/mcp-host/executors/read.ts",
  "hosts/mcp-host/executors/discovery.ts",
  "hosts/mcp-host/executors/runtime.ts",
  "hosts/mcp-host/executors/architecture.ts",
  "hosts/mcp-host/executors/mission.ts",
];

async function copyOne(relativePath) {
  const source = path.join(REPO_ROOT, relativePath);
  const destination = path.join(REPO_ROOT, "dist", relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function main() {
  const failures = [];
  for (const relativePath of RUNTIME_DATA_FILES) {
    try {
      await copyOne(relativePath);
    } catch (error) {
      failures.push({ relativePath, error });
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      process.stderr.write(
        `copy-runtime-assets: failed to copy ${failure.relativePath}: ${
          failure.error instanceof Error ? failure.error.message : String(failure.error)
        }\n`,
      );
    }
    process.exit(1);
  }
}

void main();
