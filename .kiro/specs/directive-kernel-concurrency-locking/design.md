# Design Document

## Overview

Three new modules: `shared/lib/process-lock.ts` (directive-root lock), `shared/lib/file-io.ts::withPerFileLock` (per-file lock), and a JSONL conversion of `engine/decision-policy-ledger.ts`. Plus boot/shutdown wiring in `hosts/standalone-host/server.ts` and `hosts/web-host/cli.ts`. Plus tests, including the worker-thread-driven property test.

The concurrency model is "single-writer per Directive_Root" enforced at the directive-root level by `Process_Lock_File`, and "single-writer per mutable JSON file" enforced inside the same process by `Per_File_Lock`. The kernel does not implement multi-host coordination — that is a separate (deferred) concern in the Improvement Plan.

## Architecture

```
   ┌─────────────────────────────────────────────────────┐
   │  Process_Lock_File ('engine/.lock')                 │
   │     - one host process at a time per directive-root │
   │     - PID + startedAt + hostname                    │
   └────────────┬────────────────────────────────────────┘
                │ guards everything below
                ▼
   ┌─────────────────────────────────────────────────────┐
   │  Per_File_Lock ('<file>.lock' siblings)             │
   │     - mutates: intake-queue, capability-gaps, cases │
   │     - read-modify-write critical section            │
   └────────────┬────────────────────────────────────────┘
                │
                ▼
   ┌─────────────────────────────────────────────────────┐
   │  appendJsonLine (no lock needed)                    │
   │     - append-only: decision-policy-ledger.jsonl     │
   │     - O_APPEND atomicity at OS level                │
   └─────────────────────────────────────────────────────┘
```

## Components and Interfaces

### `shared/lib/process-lock.ts`

```ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const STALE_LOCK_TTL_MS = 30_000;

export type AcquireOutcome = "acquired" | "stale_recovered";

export interface ProcessLockBody {
  pid: number;
  startedAt: string; // ISO-8601
  host: string;
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
    // stale — overwrite
    return { outcome: "stale_recovered", lockBody: writeLock(lockPath) };
  }

  return { outcome: "acquired", lockBody: writeLock(lockPath) };
}

export function releaseDirectiveRootLock(directiveRoot: string): void {
  const lockPath = path.join(directiveRoot, "engine", ".lock");
  if (!fs.existsSync(lockPath)) return;
  const existing = readLockBody(lockPath);
  if (existing && existing.pid === process.pid && existing.host === os.hostname()) {
    fs.unlinkSync(lockPath);
  }
  // foreign lock — leave it alone
}

function writeLock(lockPath: string): ProcessLockBody {
  const body: ProcessLockBody = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    host: os.hostname(),
  };
  // atomic write via temp + rename
  const tmp = `${lockPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(body));
  fs.renameSync(tmp, lockPath);
  return body;
}

function readLockBody(lockPath: string): ProcessLockBody | null {
  try {
    const raw = fs.readFileSync(lockPath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.pid === "number" && typeof parsed.startedAt === "string" && typeof parsed.host === "string") {
      return parsed;
    }
  } catch { /* corrupt → treat as stale */ }
  return null;
}

function isFresh(body: ProcessLockBody): boolean {
  const ageMs = Date.now() - new Date(body.startedAt).getTime();
  if (ageMs > STALE_LOCK_TTL_MS) {
    // ttl expired — also need pid-alive check before declaring fresh
    return body.host === os.hostname() && isPidAlive(body.pid);
  }
  // within ttl — fresh by definition (assume holder is still active)
  return true;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
```

Process-exit handlers in `hosts/standalone-host/server.ts` and `hosts/web-host/cli.ts` register SIGINT and SIGTERM handlers that call `releaseDirectiveRootLock` before letting the process exit.

### `shared/lib/file-io.ts::withPerFileLock`

```ts
export const PER_FILE_LOCK_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 50;

export async function withPerFileLock<T>(filePath: string, fn: () => Promise<T> | T): Promise<T> {
  const lockPath = `${filePath}.lock`;
  const deadline = Date.now() + PER_FILE_LOCK_TIMEOUT_MS;

  while (true) {
    try {
      // O_EXCL | O_CREAT semantics
      const fd = fs.openSync(lockPath, "wx");
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), host: os.hostname() }));
      fs.closeSync(fd);
      break; // acquired
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      // someone else holds it — check staleness, then poll
      const existing = tryReadLockBody(lockPath);
      if (existing && !isFresh(existing)) {
        // stale → unlink and retry
        try { fs.unlinkSync(lockPath); } catch { /* race-loser, fine */ }
        continue;
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
    try { fs.unlinkSync(lockPath); } catch { /* nothing to release */ }
  }
}
```

### `engine/decision-policy-ledger.ts` rewrite

The existing module reads `decision-policy-ledger.json`, mutates the in-memory object, and writes it back. The new pattern:

- **Append path**: `appendDecisionPolicyEvent(directiveRoot, event)` calls `appendJsonLine(directiveRoot/engine/decision-policy-ledger.jsonl, event)`. No lock needed; `O_APPEND` is atomic for ≤ PIPE_BUF on POSIX, and on Windows Node serializes appends via libuv.
- **Read path**: `readDecisionPolicyLedger(directiveRoot)` streams the JSONL line-by-line, reconstructs the legacy ledger object shape, returns it. Cached in-memory by mtime; cache busts when the JSONL file's mtime changes.
- **Snapshot path** (`pnpm run kernel:snapshot`, optional): replays JSONL into legacy `.json`, useful for migrating an existing directive-root.

### Standalone-host server wiring

```ts
// hosts/standalone-host/server.ts (sketch)
import { acquireDirectiveRootLock, releaseDirectiveRootLock } from "../../shared/lib/process-lock.ts";

export async function start(...): Promise<HostHandle> {
  const lock = acquireDirectiveRootLock(directiveRoot); // throws if locked
  // ... existing boot logic, persistence ledger, status file ...
  const httpServer = app.listen(port);
  const cleanup = () => {
    httpServer.close(() => {
      releaseDirectiveRootLock(directiveRoot);
      process.exit(0);
    });
  };
  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);
  return { ...handle, lock };
}

export async function stop(handle: HostHandle): Promise<void> {
  // ... existing stop logic ...
  releaseDirectiveRootLock(handle.directiveRoot);
}
```

CLI subcommands (`init`, `discovery-submit`, `try`) wrap their entry points in `try { acquire(); ... work ... } finally { release(); }`.

## Data Models

### `engine/.lock`

```json
{ "pid": 12345, "startedAt": "2026-05-26T16:42:00.123Z", "host": "alice-laptop" }
```

### `<file>.lock` (per-file)

Same shape as `engine/.lock`. The file's existence is the lock; the body is informational for stale-recovery diagnostics.

### `engine/decision-policy-ledger.jsonl`

One JSON object per line, each with the same shape as the existing `events[]` entries in the legacy `.json` form. The first read produces an in-memory object equivalent to what the legacy reader would have returned.

## Correctness Properties

- **Property 1 — N concurrent submissions, no loss.** Spawn 10 worker_threads, each performs one `processSource` call against the same Directive_Root. Assert post-conditions: queue has exactly 10 entries, all 10 submission IDs unique, no `.lock` files remain.
- **Property 2 — JSONL append is monotonic.** N concurrent `appendDecisionPolicyEvent` calls produce a JSONL whose `event.timestamp` field is monotonically non-decreasing when sorted by file offset. (This is true because `appendJsonLine` uses `O_APPEND`; the property test confirms it.)
- **Property 3 — Stale-lock recovery.** Manually backdate a lock file's `startedAt` to 60s ago, kill its PID, call `acquireDirectiveRootLock`. Asserts `outcome === "stale_recovered"`.

## Error Handling

- Process_Lock_File acquire fails fresh → throw `directive_root_locked: held by pid <pid> on <host> since <startedAt>`.
- Process_Lock_File body is corrupt JSON → treat as stale, recover.
- Per_File_Lock timeout → throw `per_file_lock_timeout: <filePath>`.
- Process exits without releasing → next process detects stale (after Stale_Lock_TTL), recovers.

## Testing Strategy

### Unit tests

`tests/integration/hardening/process-lock.test.ts`, `tests/integration/hardening/per-file-lock.test.ts`, `tests/integration/hardening/decision-ledger-jsonl.test.ts`.

### Property tests

`tests/property/concurrent-submissions.property.test.ts` — gated by `CONCURRENT_TESTS=1` because it forks workers.

### Integration tests

`tests/integration/standalone-host-double-start.test.ts` — spawn two `pnpm run standalone:cli serve` against the same root; assert second exits with code 1 + the expected error message.

## Wave Plan

| Wave | Scope | Checkpoint |
|---|---|---|
| 1 | `shared/lib/process-lock.ts` + hardening tests + Concurrency_Doc | typecheck + test + check:contracts |
| 2 | `shared/lib/file-io.ts::withPerFileLock` + hardening tests | typecheck + test |
| 3 | Wrap intake-queue, capability-gaps, case-store writers in `withPerFileLock` | typecheck + test |
| 4 | Convert `engine/decision-policy-ledger.ts` to JSONL append + tail-reader | typecheck + test (existing ledger callers must keep working through the new reader) |
| 5 | Wire process lock into standalone-host + web-host start/stop | typecheck + test + integration test for double-start |
| 6 | Property test (`CONCURRENT_TESTS=1` gated); CI workflow extension; CONTRIBUTING.md update | full gate green + concurrent gate green |

## Open Questions

- Should the kernel ship a `pnpm run kernel:unlock` CLI to forcibly remove a stale lock when stale-detection misjudges? Defer to follow-up; rare edge case.
- Should JSONL ledger compaction happen automatically? Out of scope for F13; F14 (data retention) handles rotation.
