import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..");
const CLI_RELATIVE_PATH = "./hosts/standalone-host/cli.ts";
const TSX_BIN = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");

describe("standalone host try command (subprocess)", () => {
  it("prints the plain-text Try Output and produces a real artifact on disk", () => {
    const result = spawnSync(
      process.execPath,
      [TSX_BIN, CLI_RELATIVE_PATH, "try"],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        shell: false,
        timeout: 60_000,
      },
    );

    // Surface stderr in the assertion message so a failure points at the cause.
    expect(result.error, String(result.error)).toBeUndefined();
    expect(
      result.status,
      `non-zero exit. stderr:\n${result.stderr}\nstdout:\n${result.stdout}`,
    ).toBe(0);

    const stdout = result.stdout;

    // "Created temp directive root: " followed by an absolute path. On Windows
    // an absolute path starts with a drive letter and on POSIX with "/", so
    // require the next character to be non-whitespace and then validate the
    // captured path resolves to itself (path.isAbsolute is true for both).
    expect(stdout).toMatch(/^Created temp directive root: \S/m);
    const directiveRootMatch = stdout.match(
      /^Created temp directive root: (.+)$/m,
    );
    expect(directiveRootMatch?.[1]).toBeDefined();
    expect(path.isAbsolute(directiveRootMatch![1])).toBe(true);

    // "Wrote DIRECTIVE_GOAL.md" line.
    expect(stdout).toMatch(/^Wrote DIRECTIVE_GOAL\.md$/m);

    // The sample source candidate id is fixed.
    expect(stdout).toContain("dw-example-front-door");

    // "Engine routed to: " followed by one of the three known lane ids.
    expect(stdout).toMatch(/^Engine routed to: (discovery|architecture|runtime)$/m);

    // "Run ID: " line with a non-empty value.
    expect(stdout).toMatch(/^Run ID: \S/m);

    // "Artifact: " followed by an absolute path that exists on disk.
    const artifactMatch = stdout.match(/^Artifact: (.+)$/m);
    expect(artifactMatch?.[1]).toBeDefined();
    const artifactPath = artifactMatch![1];
    expect(path.isAbsolute(artifactPath)).toBe(true);
    expect(fs.existsSync(artifactPath)).toBe(true);

    // The next-step line tells the user how to inspect the run via the web host.
    expect(stdout).toContain("pnpm web:serve --directive-root ");

    // Plain-text output contract: no JSON object dump in the Try Output.
    expect(stdout).not.toMatch(/[{}]/);
  });

  it("exits non-zero with a stderr message when --output-root is supplied without a value", () => {
    const result = spawnSync(
      process.execPath,
      [
        TSX_BIN,
        CLI_RELATIVE_PATH,
        "try",
        "--output-root",
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        shell: false,
        timeout: 60_000,
      },
    );

    expect(result.error, String(result.error)).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--output-root");
  });
});
