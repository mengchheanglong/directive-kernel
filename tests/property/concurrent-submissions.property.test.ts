/// <reference types="node" />

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Worker } from "node:worker_threads";

const SHOULD_RUN = process.env.CONCURRENT_TESTS === "1";

function findLockFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findLockFiles(fullPath));
      } else if (entry.name.endsWith(".lock")) {
        results.push(fullPath);
      }
    }
  } catch { /* ignore */ }
  return results;
}

describe.skipIf(!SHOULD_RUN)("concurrent submissions", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dk-concurrent-"));
    fs.mkdirSync(path.join(tmpRoot, "engine"), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, "discovery"), { recursive: true });
    const missionDir = path.join(tmpRoot, "engine", "mission");
    fs.mkdirSync(missionDir, { recursive: true });
    fs.writeFileSync(
      path.join(missionDir, "active-mission.md"),
      "# Test Mission\n\n## Current objective\n\nTest objective\n\n## Usefulness signals\n\n- signal1\n\n## Capability lanes\n\n- runtime\n\n## Constraints\n\n- constraint1\n\n## Success signal\n\nsuccess\n\n## Adoption target\n\nruntime\n",
    );
  }, 120_000);

  afterEach(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* cleanup */ }
  }, 120_000);

  it("N concurrent processSource calls produce N unique engine runs with no leftover locks", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(undefined), async () => {
        const N = 10;
        const workerPath = path.resolve(__dirname, "_concurrent-worker.mjs");

        const results: Array<{ ok: boolean; runId?: string; error?: string }> = [];

        const workers: Worker[] = [];
        for (let i = 0; i < N; i++) {
          const w = new Worker(workerPath, {
            workerData: { directiveRoot: tmpRoot, index: i },
          });
          workers.push(w);
        }

        await Promise.all(
          workers.map(
            (w, i) =>
              new Promise<void>((resolve, reject) => {
                w.on("message", (msg) => {
                  results.push(msg);
                });
                w.on("error", reject);
                w.on("exit", (code) => {
                  if (code !== 0) {
                    reject(new Error(`Worker ${i} exited with code ${code}`));
                  } else {
                    resolve();
                  }
                });
              }),
          ),
        );

        expect(results.filter((r) => r.ok).length).toBe(N);

        const runIds = results
          .filter((r) => r.ok && r.runId)
          .map((r) => r.runId!);
        expect(runIds.length).toBe(N);
        expect(new Set(runIds).size).toBe(N);

        const lockFiles = findLockFiles(tmpRoot);
        expect(lockFiles.length).toBe(0);
      }),
      { numRuns: 20 },
    );
  }, 300_000);
});
