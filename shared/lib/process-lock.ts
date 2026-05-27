import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const STALE_LOCK_TTL_MS = 30_000;

export type AcquireOutcome = "acquired" | "stale_recovered";

export interface ProcessLockBody {
  pid: number;
  startedAt: string;
  host: string;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isFresh(body: ProcessLockBody): boolean {
  const ageMs = Date.now() - new Date(body.startedAt).getTime();
  if (ageMs > STALE_LOCK_TTL_MS) {
    return body.host === os.hostname() && isPidAlive(body.pid);
  }
  return true;
}

function readLockBody(lockPath: string): ProcessLockBody | null {
  try {
    const raw = fs.readFileSync(lockPath, "utf8");
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.pid === "number"
      && typeof parsed.startedAt === "string"
      && typeof parsed.host === "string"
    ) {
      return parsed;
    }
  } catch { /* corrupt → treat as stale */ }
  return null;
}

function writeLock(lockPath: string): ProcessLockBody {
  const body: ProcessLockBody = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    host: os.hostname(),
  };
  const tmp = `${lockPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(body));
  fs.renameSync(tmp, lockPath);
  return body;
}

export function acquireDirectiveRootLock(directiveRoot: string): {
  outcome: AcquireOutcome;
  lockBody: ProcessLockBody;
} {
  const lockPath = path.join(directiveRoot, "engine", ".lock");
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  if (fs.existsSync(lockPath)) {
    const existing = readLockBody(lockPath);
    if (existing && isFresh(existing)) {
      throw new Error(
        `directive_root_locked: held by pid ${existing.pid} on ${existing.host} since ${existing.startedAt}`,
      );
    }
    return { outcome: "stale_recovered", lockBody: writeLock(lockPath) };
  }

  return { outcome: "acquired", lockBody: writeLock(lockPath) };
}

export function releaseDirectiveRootLock(directiveRoot: string): void {
  const lockPath = path.join(directiveRoot, "engine", ".lock");
  if (!fs.existsSync(lockPath)) return;
  const existing = readLockBody(lockPath);
  if (
    existing
    && existing.pid === process.pid
    && existing.host === os.hostname()
  ) {
    fs.unlinkSync(lockPath);
  }
}
