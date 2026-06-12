// Cross-platform helper that sets CHECK_BUILD=1 in the child env and runs
// Vitest against the build-smoke property test. Used by `pnpm run check:build`
// instead of taking a `cross-env` devDependency.
//
// Why a Node script instead of `cross-env`: the repo already uses Node helpers
// for cross-platform problems (scripts/copy-runtime-assets.mjs,
// scripts/run-ui-dev.ts as a dev-server launcher), and adding a one-line
// env-var helper as a new dep is more weight than a 20-line script.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const VITEST_BIN = path.join(REPO_ROOT, "node_modules", "vitest", "vitest.mjs");

const child = spawn(
  process.execPath,
  [VITEST_BIN, "run", "tests/integration/build-smoke.test.ts"],
  {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      CHECK_BUILD: "1",
    },
    windowsHide: true,
  },
);

child.once("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 1);
});
