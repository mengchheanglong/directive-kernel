# Requirements Document

## Introduction

The kernel persists state to a single directive-root on a local filesystem. Multiple files (`engine/decision-policy-ledger.json`, `discovery/intake-queue.json`, the case store, the run-record store) are written by multiple code paths. `shared/lib/file-io.ts` provides `writeJsonAtomic` (write-temp-then-rename), which protects against torn writes but not against lost updates when two writers race a read-modify-write cycle. There is no documented locking model, no documented ordering guarantee, and no test that exercises concurrent writers.

This feature documents the kernel's current concurrency model honestly, adds a directive-root advisory lock to refuse a second host process, switches every append-only ledger from "read-modify-write whole file" to `appendJsonLine` + tail-reader where it is not already, adds a per-file `.lock` discipline for the mutable JSON stores, and adds a property test that spawns N concurrent submission writers against a single directive-root and asserts no records are lost or duplicated and the ledger ordering remains monotonic.

The work depends on F1 (test infrastructure) ✅ done.

## Glossary

- **Kernel**: The root TypeScript package `@directive/kernel`.
- **Directive_Root**: The on-disk directory the kernel persists to (passed via `--directive-root` or resolved by `getDefaultDirectiveWorkspaceRoot()`).
- **Process_Lock_File**: The file `engine/.lock` inside a Directive_Root, written by `acquireDirectiveRootLock()` and removed by `releaseDirectiveRootLock()` or by stale-lock detection.
- **Process_Lock_Body**: A JSON object with three fields — `pid: number`, `startedAt: string` (ISO-8601), `host: string` (`os.hostname()`).
- **Append_Only_Ledger_Set**: The four files `engine/decision-policy-ledger.json`, `engine/decision-policy-ledger.jsonl` (new), `discovery/routing-correction-ledger.json`, and the per-run `engine/run-records/<runId>.events.jsonl` if it exists.
- **Mutable_JSON_Store_Set**: The three files `discovery/intake-queue.json`, `discovery/capability-gaps.json`, `engine/cases/case-store.json` (or whatever the case store's root document is currently named).
- **Per_File_Lock**: A `<filename>.lock` sibling file written before a read-modify-write cycle and removed after the write commits.
- **Stale_Lock_TTL**: The integer `30000` (30 seconds). A lock whose `startedAt` is older than `now() - Stale_Lock_TTL` AND whose declared `pid` is no longer alive on `host === os.hostname()` is considered stale.
- **Concurrency_Doc**: The Markdown file `shared/contracts/concurrency-model.md` (new).
- **Acquire_Outcome**: One of `acquired`, `held_by_other`, `stale_recovered`.

## Requirements

### Requirement 1 — Concurrency_Doc

**User Story:** As a kernel adopter, I want a written concurrency model so that I know what guarantees the kernel does and does not provide.

#### Acceptance Criteria

1. THE Kernel SHALL include a Concurrency_Doc at `shared/contracts/concurrency-model.md`.
2. THE Concurrency_Doc SHALL state that the current concurrency model is single-writer per Directive_Root and that multi-writer is unsupported.
3. THE Concurrency_Doc SHALL document Process_Lock_File semantics including stale-lock recovery via Stale_Lock_TTL.
4. THE Concurrency_Doc SHALL document the federation roadmap — multi-host scenarios are explicitly deferred to F12 in the Improvement Plan.
5. THE Concurrency_Doc SHALL be enforced (per F5 disposition rule) by `shared/lib/process-lock.ts`. The contract file's first line SHALL read `**Enforced by:** shared/lib/process-lock.ts`.

### Requirement 2 — Process_Lock_File

**User Story:** As a host operator, I want to be unable to start two host processes against the same Directive_Root so that the second process does not silently corrupt state.

#### Acceptance Criteria

1. THE Kernel SHALL include a module `shared/lib/process-lock.ts` exporting `acquireDirectiveRootLock(directiveRoot: string): { outcome: Acquire_Outcome; lockBody: Process_Lock_Body }` and `releaseDirectiveRootLock(directiveRoot: string): void`.
2. WHEN `acquireDirectiveRootLock` is called and `Process_Lock_File` does not exist, THE Kernel SHALL write the file atomically (write-temp + rename) with current `pid`, `startedAt = new Date().toISOString()`, `host = os.hostname()`, and SHALL return `outcome: "acquired"`.
3. WHEN `acquireDirectiveRootLock` is called and `Process_Lock_File` exists with a fresh body (within Stale_Lock_TTL OR pid is alive on the same host), THE Kernel SHALL throw an error `directive_root_locked: held by pid <pid> on <host> since <startedAt>`.
4. WHEN `acquireDirectiveRootLock` is called and `Process_Lock_File` exists with a stale body (older than Stale_Lock_TTL AND pid is not alive on the current host), THE Kernel SHALL atomically replace the file with the current process's body and SHALL return `outcome: "stale_recovered"`.
5. WHEN `releaseDirectiveRootLock` is called and the file's `pid` matches the current process, THE Kernel SHALL remove the file. WHERE the `pid` differs (e.g. another process recovered a stale lock), the function SHALL leave the file unchanged.
6. WHEN the host process exits cleanly (SIGINT, SIGTERM, normal exit), THE Kernel SHALL release the lock. WHERE the process crashes hard, the lock remains until the next acquire detects it as stale.

### Requirement 3 — Standalone host integration

**User Story:** As a host operator running `pnpm run standalone:cli serve`, I want the lock to be acquired at boot so that I cannot accidentally run two servers against the same root.

#### Acceptance Criteria

1. THE `hosts/standalone-host/server.ts` `start()` function SHALL call `acquireDirectiveRootLock(directiveRoot)` before opening the HTTP listener.
2. THE `hosts/standalone-host/server.ts` `stop()` function SHALL call `releaseDirectiveRootLock(directiveRoot)` after the listener closes.
3. WHEN the lock acquisition fails, THE standalone host SHALL print the error to stderr and exit with code `1` before binding any port.
4. THE `hosts/web-host/cli.ts` `serve` command SHALL behave identically to the standalone host for lock acquisition.
5. THE one-shot CLI subcommands (`init`, `discovery-submit`, `try`, etc.) SHALL acquire and release the lock around their work; concurrent invocations of the same subcommand against the same Directive_Root SHALL fail with `directive_root_locked`.

### Requirement 4 — Append_Only_Ledger_Set switch to JSONL

**User Story:** As a kernel maintainer, I want every append-only ledger to use atomic line append so that two concurrent appends cannot lose either record.

#### Acceptance Criteria

1. THE Kernel SHALL switch `engine/decision-policy-ledger.ts` from read-modify-write of `decision-policy-ledger.json` to `appendJsonLine` writes against `decision-policy-ledger.jsonl`. The `.json` form SHALL be retained as a derived snapshot regenerated on demand by a tail-reader.
2. THE Kernel SHALL provide a tail-reader at `engine/decision-policy-ledger.ts::readDecisionPolicyLedger(directiveRoot)` that streams the JSONL file and reconstructs the same object the legacy `.json` form held.
3. WHERE `discovery/routing-correction-ledger.json` exists today, THE Kernel SHALL switch it to a JSONL form on the same pattern.
4. AFTER the switch, the legacy `.json` snapshot SHALL be regenerated (rewritten in full) only at well-defined moments: process shutdown, explicit `pnpm run kernel:snapshot`, or on a tail-reader-driven cron path. It SHALL NOT be written on every append.

### Requirement 5 — Per_File_Lock for mutable JSON

**User Story:** As a kernel maintainer, I want `discovery/intake-queue.json` and the case store to use a per-file lock around read-modify-write so that two writers cannot drop each other's changes.

#### Acceptance Criteria

1. THE `shared/lib/file-io.ts` SHALL include a helper `withPerFileLock(filePath: string, fn: () => Promise<T> | T): Promise<T>` that creates a `<filePath>.lock` sibling, executes `fn`, removes the lock, and treats stale `.lock` files (older than Stale_Lock_TTL with no live pid) the same as Process_Lock_File.
2. THE writer for `discovery/intake-queue.json` (`discovery/lib/intake/queue-writer.ts`) SHALL wrap its read-modify-write cycle in `withPerFileLock`.
3. THE writer for `discovery/capability-gaps.json` SHALL wrap its read-modify-write cycle in `withPerFileLock`.
4. THE writer for the case store SHALL wrap its read-modify-write cycle in `withPerFileLock`.
5. WHERE a `withPerFileLock` call cannot acquire the lock within `5000ms` (configurable, default 5s), THE function SHALL throw `per_file_lock_timeout: <filePath>` and the caller SHALL surface the error to the operator.

### Requirement 6 — Concurrent-submission property test

**User Story:** As a reviewer, I want a property test that runs N concurrent submissions and asserts no records are lost so that the locking story has executable evidence.

#### Acceptance Criteria

1. THE Kernel SHALL include a property test at `tests/property/concurrent-submissions.property.test.ts` that spawns N (default 10) parallel `processSource` calls against a single Directive_Root using Node `worker_threads`.
2. THE test SHALL assert post-condition: the queue contains exactly N entries, every submission ID is present, no submission ID is duplicated.
3. THE test SHALL assert post-condition: the decision-policy ledger's JSONL file contains exactly N append events whose timestamps are monotonically non-decreasing.
4. THE test SHALL assert post-condition: zero `.lock` files remain in the Directive_Root after all writers complete.
5. THE test SHALL run with `{ numRuns: 20 }` since each run forks workers and is more expensive than typical property tests.
6. THE test SHALL be tagged `concurrent` and gated by an environment variable `CONCURRENT_TESTS=1` so it does not run on every `pnpm test` (CI runs it gated by a separate workflow step).

### Requirement 7 — Hardening tests

**User Story:** As a reviewer, I want unit-level hardening for the lock primitives so that bugs in the helper are caught before the integration property test runs.

#### Acceptance Criteria

1. THE Kernel SHALL include `tests/integration/hardening/process-lock.test.ts` covering: cold acquire, double acquire same process (fails), stale recovery (manual mtime backdate), release of foreign lock (no-op).
2. THE Kernel SHALL include `tests/integration/hardening/per-file-lock.test.ts` covering: lock around a read-modify-write cycle, timeout when lock held by a forked subprocess, stale recovery.
3. THE Kernel SHALL include `tests/integration/hardening/decision-ledger-jsonl.test.ts` covering: round-trip read of a JSONL ledger with N append events, tail-reader reconstructs the same `.json` snapshot the legacy code produced.

### Requirement 8 — Documentation

**User Story:** As a contributor, I want the rules written down in CONTRIBUTING.md so that I do not accidentally introduce a fresh read-modify-write that bypasses the lock.

#### Acceptance Criteria

1. THE `CONTRIBUTING.md` SHALL contain a "Concurrency rules" section linking to Concurrency_Doc.
2. THE section SHALL state: every read-modify-write of a Mutable_JSON_Store_Set file SHALL go through `withPerFileLock`; every append to an Append_Only_Ledger_Set file SHALL go through `appendJsonLine`; every host process SHALL acquire Process_Lock_File at boot.

### Requirement 9 — Verification gate

**User Story:** As a reviewer, I want a single command set that proves the locking story works.

#### Acceptance Criteria

1. WHEN `pnpm run typecheck`, `pnpm run test`, `pnpm run check:build`, `pnpm run check:naming`, and `pnpm run check:contracts` run after the spec is implemented, THE Kernel SHALL exit zero on each.
2. WHEN `CONCURRENT_TESTS=1 pnpm run test` runs, THE Kernel SHALL exit zero with the new property test passing.
3. WHEN two `pnpm run standalone:cli serve --directive-root <same-root>` processes are started in parallel, THE second SHALL exit non-zero with `directive_root_locked` and the first SHALL continue serving.
