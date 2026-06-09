import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..");
const TSX_BIN = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const FLOW_RELATIVE_PATH = "./examples/reference-consumer/flow.ts";

const tempRoots: string[] = [];

afterAll(() => {
  for (const tempRoot of tempRoots) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe("reference consumer flow", () => {
  it("runs the executable example end-to-end as a thin host", () => {
    const directiveRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "directive-kernel-reference-consumer-"),
    );
    tempRoots.push(directiveRoot);

    const result = spawnSync(
      process.execPath,
      [TSX_BIN, FLOW_RELATIVE_PATH, "--directive-root", directiveRoot],
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

    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      lane: string;
      decisionState: string;
      snapshot: {
        queueEntries: number;
        engineRuns: number;
        actionableInboxEntries: number;
        focusArtifact: string | null;
      };
    };

    expect(payload.ok).toBe(true);
    expect(typeof payload.lane).toBe("string");
    expect(typeof payload.decisionState).toBe("string");
    expect(payload.snapshot.queueEntries).toBe(1);
    expect(payload.snapshot.engineRuns).toBe(1);
    expect(typeof payload.snapshot.actionableInboxEntries).toBe("number");
    expect(typeof payload.snapshot.focusArtifact).toBe("string");
  });
});
