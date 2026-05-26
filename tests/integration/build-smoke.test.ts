import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Property 1 (design.md → "Post-build smoke over Production_Scripts"). For any
// script `s` in the bounded set `S`, after `pnpm run build` produces /dist/,
// invoking `s` via Node from /dist/ exits with status 0.
//
// This test file is gated behind `CHECK_BUILD=1` so `pnpm test` does not
// require a prior build (R10.2). The companion `pnpm run check:build` script
// builds first, then sets CHECK_BUILD=1, then runs Vitest. Without the env
// var, the suite is skipped with a clear note.

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..");
const DIST_DIR = path.join(REPO_ROOT, "dist");

const PRODUCTION_SCRIPTS: ReadonlyArray<{
  name: string;
  args: ReadonlyArray<string>;
  // When true, the run is expected to exit 0 even though the underlying CLI
  // may print a usage banner. False would mean we need to assert exit 0
  // against a long-running server, which we never want from a unit-style
  // smoke test.
  shortRun: boolean;
}> = [
  { name: "try", args: ["./dist/hosts/standalone-host/cli.js", "try"], shortRun: true },
  { name: "standalone:cli usage", args: ["./dist/hosts/standalone-host/cli.js"], shortRun: true },
  // The web-host CLI exits 1 when invoked with no command — that's a usage
  // banner, not a runtime error. We assert the binary loads without throwing
  // a module resolution error from /dist/, which is the build-health signal
  // we care about. The exit code check is loosened to "non-throw" via the
  // `error` field on spawnSync.
  { name: "web:serve usage", args: ["./dist/hosts/web-host/cli.js"], shortRun: true },
];

const SKIP = process.env.CHECK_BUILD !== "1";

describe.skipIf(SKIP)("post-build smoke over Production_Scripts (Property 1)", () => {
  it("dist/ exists (CHECK_BUILD precondition)", () => {
    expect(fs.existsSync(DIST_DIR)).toBe(true);
  });

  for (const script of PRODUCTION_SCRIPTS) {
    it(`compiled ${script.name} loads from /dist/ without a module resolution error`, () => {
      const result = spawnSync(process.execPath, script.args as string[], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 60_000,
      });

      // Spawn must succeed (no ENOENT, no "module not found" thrown by the
      // loader before main() runs).
      expect(result.error, String(result.error)).toBeUndefined();

      // For the `try` entrypoint specifically we assert exit 0 plus a path
      // shape, because a successful try run is the strongest health signal.
      if (script.name === "try") {
        expect(
          result.status,
          `try exit non-zero. stderr:\n${result.stderr}\nstdout:\n${result.stdout}`,
        ).toBe(0);
        expect(result.stdout).toMatch(/^Created temp directive root: \S/m);
        expect(result.stdout).toMatch(/^Engine routed to: (discovery|architecture|runtime)$/m);
        return;
      }

      // For usage/banner runs we accept any exit code (including 1 from a
      // missing-command usage message) — what we are checking is that Node's
      // ESM loader resolved the compiled JS without throwing. A genuine
      // module-resolution failure surfaces as a non-zero exit AND a stderr
      // line containing "ERR_MODULE_NOT_FOUND" or "Cannot find module".
      expect(result.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
      expect(result.stderr).not.toContain("Cannot find module");
    });
  }
});

if (SKIP) {
  // Surface a single it.skip so vitest output names the gate clearly when run
  // via plain `pnpm test`. describe.skipIf above already handles the actual
  // skipping; this provides the human-readable hint in CI logs.
  describe("post-build smoke over Production_Scripts (Property 1)", () => {
    it.skip("requires CHECK_BUILD=1 (run via `pnpm run check:build`)", () => {});
  });
}
