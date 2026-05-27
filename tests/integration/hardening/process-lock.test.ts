import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

import {
  acquireDirectiveRootLock,
  releaseDirectiveRootLock,
  type ProcessLockBody,
} from "../../../shared/lib/process-lock.ts";

describe("process-lock", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dk-process-lock-"));
  });

  afterEach(() => {
    try { releaseDirectiveRootLock(tmpRoot); } catch { /* cleanup */ }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* already gone */ }
  });

  it("cold acquire — no lock exists", () => {
    const { outcome, lockBody } = acquireDirectiveRootLock(tmpRoot);
    expect(outcome).toBe("acquired");
    expect(lockBody.pid).toBe(process.pid);
    expect(typeof lockBody.startedAt).toBe("string");
    expect(lockBody.host).toBe(os.hostname());

    const lockPath = path.join(tmpRoot, "engine", ".lock");
    expect(fs.existsSync(lockPath)).toBe(true);
  });

  it("double acquire same process — fails", () => {
    acquireDirectiveRootLock(tmpRoot);
    expect(() => acquireDirectiveRootLock(tmpRoot)).toThrow(
      /^directive_root_locked:/,
    );
  });

  it("release then re-acquire — succeeds", () => {
    acquireDirectiveRootLock(tmpRoot);
    releaseDirectiveRootLock(tmpRoot);

    const lockPath = path.join(tmpRoot, "engine", ".lock");
    expect(fs.existsSync(lockPath)).toBe(false);

    acquireDirectiveRootLock(tmpRoot);
    expect(fs.existsSync(lockPath)).toBe(true);
  });

  it("stale lock — recovered when pid is dead and time expired", () => {
    const lockPath = path.join(tmpRoot, "engine", ".lock");
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });

    const staleBody: ProcessLockBody = {
      pid: 99999,
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      host: os.hostname(),
    };
    fs.writeFileSync(lockPath, JSON.stringify(staleBody));

    const { outcome, lockBody } = acquireDirectiveRootLock(tmpRoot);
    expect(outcome).toBe("stale_recovered");
    expect(lockBody.pid).toBe(process.pid);
  });

  it("fresh lock from another pid — fails", () => {
    const lockPath = path.join(tmpRoot, "engine", ".lock");
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });

    const freshBody: ProcessLockBody = {
      pid: 1,
      startedAt: new Date().toISOString(),
      host: os.hostname(),
    };
    fs.writeFileSync(lockPath, JSON.stringify(freshBody));

    expect(() => acquireDirectiveRootLock(tmpRoot)).toThrow(
      /^directive_root_locked:/,
    );
  });

  it("foreign release — no-op", () => {
    acquireDirectiveRootLock(tmpRoot);

    const lockPath = path.join(tmpRoot, "engine", ".lock");
    const foreignBody: ProcessLockBody = {
      pid: 99999,
      startedAt: new Date().toISOString(),
      host: os.hostname(),
    };
    fs.writeFileSync(lockPath, JSON.stringify(foreignBody));

    releaseDirectiveRootLock(tmpRoot);

    // lock still present (foreign release should not remove it)
    expect(fs.existsSync(lockPath)).toBe(true);
  });

  it("corrupt lock body — recovered", () => {
    const lockPath = path.join(tmpRoot, "engine", ".lock");
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, "garbage");

    const { outcome } = acquireDirectiveRootLock(tmpRoot);
    expect(outcome).toBe("stale_recovered");
  });
});
