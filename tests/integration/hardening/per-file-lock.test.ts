import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { withPerFileLock, readUtf8, writeUtf8 } from "../../../shared/lib/file-io.ts";

describe("per-file-lock", () => {
  let tmpDir: string;
  let counterFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dk-per-file-lock-"));
    counterFile = path.join(tmpDir, "counter.txt");
    writeUtf8(counterFile, "0");
  });

  afterEach(() => {
    try {
      const lockPath = `${counterFile}.lock`;
      if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
    } catch { }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }
  });

  it("lock around a read-modify-write", async () => {
    await withPerFileLock(counterFile, async () => {
      const current = parseInt(readUtf8(counterFile), 10);
      writeUtf8(counterFile, String(current + 1));
    });

    const result = parseInt(readUtf8(counterFile), 10);
    expect(result).toBe(1);
  });

  it("lock around same file from same process sequentially", async () => {
    await withPerFileLock(counterFile, async () => {
      const current = parseInt(readUtf8(counterFile), 10);
      writeUtf8(counterFile, String(current + 1));
    });

    await withPerFileLock(counterFile, async () => {
      const current = parseInt(readUtf8(counterFile), 10);
      writeUtf8(counterFile, String(current + 1));
    });

    const result = parseInt(readUtf8(counterFile), 10);
    expect(result).toBe(2);
  });

  it("stale recovery — dead pid lock", async () => {
    const lockPath = `${counterFile}.lock`;
    fs.writeFileSync(lockPath, JSON.stringify({
      pid: 99999,
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      host: os.hostname(),
    }));

    await withPerFileLock(counterFile, async () => {
      const current = parseInt(readUtf8(counterFile), 10);
      writeUtf8(counterFile, String(current + 1));
    });

    const result = parseInt(readUtf8(counterFile), 10);
    expect(result).toBe(1);
  });
});
