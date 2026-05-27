import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { archiveRunRecords, summarizeKernelStorage } from "../../../engine/maintenance/archive.ts";

describe("archive-run-records", () => {
  let tmpRoot: string;
  let engineRunsDir: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dk-archive-"));
    engineRunsDir = path.join(tmpRoot, "runtime", "host-artifacts", "engine-runs");
    fs.mkdirSync(engineRunsDir, { recursive: true });
  });

  afterEach(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { }
  });

  function writeRunRecord(name: string, receivedAt: string) {
    const record = { runId: name, receivedAt, source: {} };
    fs.writeFileSync(path.join(engineRunsDir, name), JSON.stringify(record));
  }

  it("archives old records and keeps recent ones", async () => {
    const now = new Date("2025-06-15T00:00:00Z");
    writeRunRecord("old.json", "2025-05-01T00:00:00Z");
    writeRunRecord("recent.json", "2025-06-14T00:00:00Z");
    writeRunRecord("very-old.json", "2025-04-01T00:00:00Z");

    const result = await archiveRunRecords(tmpRoot, { maxAgeDays: 15, now });

    expect(result.archivedCount).toBe(2);
    expect(result.archivedBasenames).toContain("old.json");
    expect(result.archivedBasenames).toContain("very-old.json");

    expect(fs.existsSync(path.join(engineRunsDir, "old.json"))).toBe(false);
    expect(fs.existsSync(path.join(engineRunsDir, "very-old.json"))).toBe(false);
    expect(fs.existsSync(path.join(engineRunsDir, "recent.json"))).toBe(true);

    expect(fs.existsSync(path.join(tmpRoot, "archive", "2025", "05", "old.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, "archive", "2025", "04", "very-old.json"))).toBe(true);

    expect(result.bytesMoved).toBeGreaterThan(0);
  });

  it("no-op when no active dir exists", async () => {
    fs.rmSync(engineRunsDir, { recursive: true, force: true });
    const result = await archiveRunRecords(tmpRoot, { maxAgeDays: 15 });
    expect(result.archivedCount).toBe(0);
    expect(result.archivedBasenames).toEqual([]);
    expect(result.bytesMoved).toBe(0);
  });

  it("no-op when no records are old enough", async () => {
    const now = new Date("2025-06-15T00:00:00Z");
    writeRunRecord("fresh.json", "2025-06-14T00:00:00Z");
    const result = await archiveRunRecords(tmpRoot, { maxAgeDays: 15, now });
    expect(result.archivedCount).toBe(0);
    expect(fs.existsSync(path.join(engineRunsDir, "fresh.json"))).toBe(true);
  });

  it("throws archive_collision when destination exists", async () => {
    const now = new Date("2025-06-15T00:00:00Z");
    writeRunRecord("dupe.json", "2025-05-01T00:00:00Z");

    const bucket = path.join(tmpRoot, "archive", "2025", "05");
    fs.mkdirSync(bucket, { recursive: true });
    fs.writeFileSync(path.join(bucket, "dupe.json"), JSON.stringify({ collision: true }));

    await expect(
      archiveRunRecords(tmpRoot, { maxAgeDays: 15, now }),
    ).rejects.toThrow(/archive_collision/);
  });

  it("second run is idempotent — archives zero", async () => {
    const now = new Date("2025-06-15T00:00:00Z");
    writeRunRecord("old.json", "2025-05-01T00:00:00Z");
    writeRunRecord("recent.json", "2025-06-14T00:00:00Z");

    const first = await archiveRunRecords(tmpRoot, { maxAgeDays: 15, now });
    expect(first.archivedCount).toBe(1);

    const second = await archiveRunRecords(tmpRoot, { maxAgeDays: 15, now });
    expect(second.archivedCount).toBe(0);
  });

  it("summarizeKernelStorage reports correct counts after archive", async () => {
    const now = new Date("2025-06-15T00:00:00Z");
    writeRunRecord("old.json", "2025-05-01T00:00:00Z");
    writeRunRecord("recent.json", "2025-06-14T00:00:00Z");

    const before = summarizeKernelStorage(tmpRoot);
    expect(before.activeRunRecords).toBe(2);
    expect(before.archivedRunRecords).toBe(0);

    await archiveRunRecords(tmpRoot, { maxAgeDays: 15, now });

    const after = summarizeKernelStorage(tmpRoot);
    expect(after.activeRunRecords).toBe(1);
    expect(after.archivedRunRecords).toBe(1);
  });
});
