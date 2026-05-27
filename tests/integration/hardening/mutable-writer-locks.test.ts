import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { readJson } from "../../../shared/lib/file-io.ts";

function makeTempRoot(prefix: string): string {
  const root = path.join(
    os.tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function spawnWorker(directiveRoot: string, formalizationId: string): Promise<{ ok: boolean; gapId?: string | null }> {
  return new Promise((resolve, reject) => {
    const tsxCli = path.resolve(__dirname, "../../../node_modules/tsx/dist/cli.mjs");
    const workerPath = path.resolve(__dirname, "_mutable-writer-worker.ts");
    const child = spawn(process.execPath, [tsxCli, workerPath, directiveRoot, formalizationId], {
      cwd: path.resolve(__dirname, "../../.."),
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    child.on("close", (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          reject(new Error(`Failed to parse worker stdout: ${stdout}`));
        }
      } else {
        reject(new Error(`Worker exit ${code}: ${stderr || stdout}`));
      }
    });
  });
}

function setupDirectiveRoot(directiveRoot: string) {
  fs.mkdirSync(path.join(directiveRoot, "discovery"), { recursive: true });
  fs.mkdirSync(path.join(directiveRoot, "engine", "gap-formalization"), { recursive: true });
}

function writeRadarReport(directiveRoot: string, suggestions: Array<{
  radarId: string;
  summary: string;
  evidenceCount?: number;
  targetLaneId?: string;
}>) {
  const radarPath = path.join(directiveRoot, "engine", "gap-radar.json");
  const report = {
    schemaVersion: 1,
    generatedAt: "2026-05-26T00:00:00.000Z",
    suggestions: suggestions.map((s) => ({
      radarId: s.radarId,
      targetLaneId: s.targetLaneId ?? "discovery",
      confidence: "high" as const,
      evidenceCount: s.evidenceCount ?? 5,
      summary: s.summary,
      recommendedChange: `Track ${s.summary} explicitly.`,
      signalTokens: [s.radarId, "test"],
      relatedOpenGapId: null,
      suggestedPriority: "high" as const,
      candidateExamples: [],
    })),
  };
  fs.writeFileSync(radarPath, JSON.stringify(report, null, 2));
}

describe("mutable-writer-locks", () => {
  it("preserves all updates when two processes append different gaps concurrently", async () => {
    const directiveRoot = makeTempRoot("dk-mwl-diff");
    const discoveryDir = path.join(directiveRoot, "discovery");
    setupDirectiveRoot(directiveRoot);

    writeRadarReport(directiveRoot, [
      { radarId: "test-alpha", summary: "Test capability gap alpha" },
      { radarId: "test-beta", summary: "Test capability gap beta" },
    ]);
    fs.writeFileSync(
      path.join(discoveryDir, "capability-gaps.json"),
      JSON.stringify({ gaps: [] }, null, 2),
    );

    const [result1, result2] = await Promise.all([
      spawnWorker(directiveRoot, "gap-formalization-test-alpha"),
      spawnWorker(directiveRoot, "gap-formalization-test-beta"),
    ]);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);

    const gapsFile = readJson<{ gaps: { gap_id: string }[] }>(
      path.join(discoveryDir, "capability-gaps.json"),
    );
    expect(gapsFile.gaps).toHaveLength(2);

    try { fs.rmSync(directiveRoot, { recursive: true, force: true }); } catch { /* cleanup */ }
  });

  it("prevents duplicate gaps when two processes formalize the same candidate concurrently", async () => {
    const directiveRoot = makeTempRoot("dk-mwl-same");
    const discoveryDir = path.join(directiveRoot, "discovery");
    setupDirectiveRoot(directiveRoot);

    writeRadarReport(directiveRoot, [
      { radarId: "test-gamma", summary: "Test capability gap gamma" },
    ]);
    fs.writeFileSync(
      path.join(discoveryDir, "capability-gaps.json"),
      JSON.stringify({ gaps: [] }, null, 2),
    );

    const [result1, result2] = await Promise.all([
      spawnWorker(directiveRoot, "gap-formalization-test-gamma"),
      spawnWorker(directiveRoot, "gap-formalization-test-gamma"),
    ]);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);

    const gapsFile = readJson<{ gaps: { gap_id: string }[] }>(
      path.join(discoveryDir, "capability-gaps.json"),
    );
    expect(gapsFile.gaps).toHaveLength(1);

    try { fs.rmSync(directiveRoot, { recursive: true, force: true }); } catch { /* cleanup */ }
  });

  it("does not leave stale lock files after completion", async () => {
    const directiveRoot = makeTempRoot("dk-mwl-locks");
    const discoveryDir = path.join(directiveRoot, "discovery");
    setupDirectiveRoot(directiveRoot);

    writeRadarReport(directiveRoot, [
      { radarId: "test-delta", summary: "Test capability gap delta" },
    ]);
    fs.writeFileSync(
      path.join(discoveryDir, "capability-gaps.json"),
      JSON.stringify({ gaps: [] }, null, 2),
    );

    await spawnWorker(directiveRoot, "gap-formalization-test-delta");

    const lockFiles = findLockFiles(directiveRoot);
    expect(lockFiles).toHaveLength(0);

    try { fs.rmSync(directiveRoot, { recursive: true, force: true }); } catch { /* cleanup */ }
  });
});

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
