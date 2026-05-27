import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { STALE_LOCK_TTL_MS, type ProcessLockBody } from "./process-lock.ts";

export function readUtf8(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

export function writeUtf8(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

export function readJson<T>(filePath: string) {
  return JSON.parse(
    fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, ""),
  ) as T;
}

export function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeJsonAtomic(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, filePath);
}

export function readJsonOptional<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(
    fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, ""),
  ) as T;
}

export function appendJsonLine(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

export function readJsonLines<T>(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return [] as T[];
  }

  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

export const PER_FILE_LOCK_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 50;

function isPidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function tryReadLockBody(lockPath: string): ProcessLockBody | null {
  try {
    const raw = fs.readFileSync(lockPath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.pid === "number" && typeof parsed.startedAt === "string" && typeof parsed.host === "string") {
      return parsed;
    }
  } catch { }
  return null;
}

export async function withPerFileLock<T>(filePath: string, fn: () => Promise<T> | T): Promise<T> {
  const lockPath = `${filePath}.lock`;
  const deadline = Date.now() + PER_FILE_LOCK_TIMEOUT_MS;

  while (true) {
    try {
      fs.mkdirSync(path.dirname(lockPath), { recursive: true });
      const fd = fs.openSync(lockPath, "wx");
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), host: os.hostname() }));
      fs.closeSync(fd);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const existing = tryReadLockBody(lockPath);
      if (existing) {
        const ageMs = Date.now() - new Date(existing.startedAt).getTime();
        const stale = ageMs > STALE_LOCK_TTL_MS && !isPidAlive(existing.pid);
        if (stale) {
          try { fs.unlinkSync(lockPath); } catch { }
          continue;
        }
      }
      if (Date.now() >= deadline) {
        throw new Error(`per_file_lock_timeout: ${filePath}`);
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  try {
    return await fn();
  } finally {
    try { fs.unlinkSync(lockPath); } catch { }
  }
}
