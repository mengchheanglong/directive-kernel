import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEMP_ROOT = path.resolve(
  os.tmpdir(),
  `directive-kernel-scaffold-shape-${Date.now()}`,
);

const NEW_MATERIALIZATION_PATHS = [
  "implementation-targets",
  "implementation-results",
  "retained",
  "integration-records",
  "consumption-records",
  "post-consumption-evaluations",
] as const;

const OLD_NUMBERED_PATHS = [
  "04-implementation-targets",
  "05-implementation-results",
  "06-retained",
  "07-integration-records",
  "08-consumption-records",
  "09-post-consumption-evaluations",
] as const;

describe("scaffold shape", () => {
  beforeAll(() => {
    fs.mkdirSync(TEMP_ROOT, { recursive: true });
    execSync(
      `pnpm exec tsx hosts/standalone-host/cli.ts init --output-root "${TEMP_ROOT}" --received-at 2026-01-01`,
      { stdio: "pipe" },
    );
  });

  afterAll(() => {
    fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  });

  it("creates simplified materialization subdirectories", () => {
    const matDir = path.resolve(
      TEMP_ROOT,
      "directive-root",
      "architecture",
      "04-materialization",
    );

    expect(fs.existsSync(matDir)).toBe(true);

    for (const name of NEW_MATERIALIZATION_PATHS) {
      const fullPath = path.join(matDir, name);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  it("does not create old numbered materialization subdirectories", () => {
    const matDir = path.resolve(
      TEMP_ROOT,
      "directive-root",
      "architecture",
      "04-materialization",
    );

    for (const name of OLD_NUMBERED_PATHS) {
      const fullPath = path.join(matDir, name);
      expect(fs.existsSync(fullPath)).toBe(false);
    }
  });
});
