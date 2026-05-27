import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..");
const CLI_RELATIVE_PATH = "./hosts/standalone-host/cli.ts";
const TSX_BIN = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");

function makeTempDirectiveRoot(): string {
  const root = path.join(os.tmpdir(), `dk-maint-archive-cli-${randomUUID()}`);
  fs.mkdirSync(path.join(root, "engine"), { recursive: true });
  fs.mkdirSync(path.join(root, "runtime", "host-artifacts", "engine-runs"), { recursive: true });
  return root;
}

describe("maintenance-archive-cli", () => {
  it("archives old run records via CLI subprocess", () => {
    const directiveRoot = makeTempDirectiveRoot();
    const runsDir = path.join(directiveRoot, "runtime", "host-artifacts", "engine-runs");

    for (let i = 0; i < 3; i++) {
      const record = {
        runId: `run-${i}`,
        receivedAt: "2025-01-15T12:00:00.000Z",
        status: "completed",
      };
      fs.writeFileSync(
        path.join(runsDir, `run-${i}.json`),
        `${JSON.stringify(record)}\n`,
        "utf8",
      );
    }

    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() + 1);
    const activeRecord = {
      runId: "run-recent",
      receivedAt: recentDate.toISOString(),
      status: "completed",
    };
    fs.writeFileSync(
      path.join(runsDir, "run-recent.json"),
      `${JSON.stringify(activeRecord)}\n`,
      "utf8",
    );

    const result = spawnSync(
      process.execPath,
      [
        TSX_BIN,
        CLI_RELATIVE_PATH,
        "maintenance",
        "archive",
        "--directive-root",
        directiveRoot,
        "--max-age-days",
        "1",
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        shell: false,
        timeout: 60_000,
      },
    );

    expect(result.error, String(result.error)).toBeUndefined();
    expect(
      result.status,
      `non-zero exit. stderr:\n${result.stderr}\nstdout:\n${result.stdout}`,
    ).toBe(0);

    expect(result.stdout).toMatch(/archived \d+ run records/);

    const archiveDir = path.join(directiveRoot, "archive", "2025", "01");
    expect(fs.existsSync(archiveDir)).toBe(true);
    const archivedFiles = fs.readdirSync(archiveDir).filter((f) => f.endsWith(".json"));
    expect(archivedFiles.length).toBe(3);

    const remainingFiles = fs.readdirSync(runsDir).filter((f) => f.endsWith(".json"));
    expect(remainingFiles.length).toBe(1);
    expect(remainingFiles[0]).toBe("run-recent.json");
  });

  it("dry-run does not archive but produces a preview summary", () => {
    const directiveRoot = makeTempDirectiveRoot();
    const runsDir = path.join(directiveRoot, "runtime", "host-artifacts", "engine-runs");

    const record = {
      runId: "run-old",
      receivedAt: "2025-01-15T12:00:00.000Z",
      status: "completed",
    };
    fs.writeFileSync(
      path.join(runsDir, "run-old.json"),
      `${JSON.stringify(record)}\n`,
      "utf8",
    );

    const result = spawnSync(
      process.execPath,
      [
        TSX_BIN,
        CLI_RELATIVE_PATH,
        "maintenance",
        "archive",
        "--directive-root",
        directiveRoot,
        "--max-age-days",
        "1",
        "--dry-run",
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        shell: false,
        timeout: 60_000,
      },
    );

    expect(result.error, String(result.error)).toBeUndefined();
    expect(
      result.status,
      `non-zero exit. stderr:\n${result.stderr}\nstdout:\n${result.stdout}`,
    ).toBe(0);

    expect(result.stdout).toContain("dry_run");

    expect(fs.existsSync(path.join(directiveRoot, "archive"))).toBe(false);
    expect(fs.existsSync(path.join(runsDir, "run-old.json"))).toBe(true);
  });

  it("exits with error for unknown maintenance subcommand", () => {
    const result = spawnSync(
      process.execPath,
      [
        TSX_BIN,
        CLI_RELATIVE_PATH,
        "maintenance",
        "unknown-cmd",
        "--directive-root",
        os.tmpdir(),
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
  });
});
