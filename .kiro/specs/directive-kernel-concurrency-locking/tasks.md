# Implementation Plan: Concurrency / locking

## Overview

Six waves. Locks first, ledger second, host wiring third, property test last.

## Test breakage strategy

Wave 4 (decision-policy-ledger JSONL switch) is the highest-risk wave because every existing engine test exercises the ledger reader. The legacy `.json` snapshot must keep returning the same shape from the new tail-reader. Implement the reader first with a property test that asserts round-trip equivalence with the existing `.json` against a synthetic event sequence, THEN flip the writer.

## Tasks

- [ ] 1. Wave 1 — Process_Lock_File primitive
  - [ ] 1.1 Create `shared/lib/process-lock.ts` per `design.md → "shared/lib/process-lock.ts"`. Export `acquireDirectiveRootLock`, `releaseDirectiveRootLock`, `STALE_LOCK_TTL_MS`, the `ProcessLockBody` type.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [ ] 1.2 Create `shared/contracts/concurrency-model.md` per `design.md`. First line is `**Enforced by:** shared/lib/process-lock.ts`.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [ ] 1.3 Create `tests/integration/hardening/process-lock.test.ts` covering cold acquire, double acquire fails, stale recovery, foreign release no-op.
    - _Requirements: 7.1_
  - [ ] 1.4 Wave 1 checkpoint: typecheck + test + check:contracts (validates the new contract resolves).

- [ ] 2. Wave 2 — Per_File_Lock primitive
  - [ ] 2.1 Add `withPerFileLock<T>(filePath, fn)` and `PER_FILE_LOCK_TIMEOUT_MS` to `shared/lib/file-io.ts` per `design.md → "shared/lib/file-io.ts::withPerFileLock"`.
    - _Requirements: 5.1_
  - [ ] 2.2 Create `tests/integration/hardening/per-file-lock.test.ts` covering wrap-around-RMW, timeout via forked subprocess holder, stale recovery.
    - _Requirements: 7.2_
  - [ ] 2.3 Wave 2 checkpoint: typecheck + test.

- [ ] 3. Wave 3 — Wrap mutable writers
  - [ ] 3.1 Wrap `discovery/lib/intake/queue-writer.ts` RMW cycle in `withPerFileLock(intakeQueuePath, ...)`.
    - _Requirements: 5.2_
  - [ ] 3.2 Wrap `discovery/capability-gaps.json` writer in `withPerFileLock`. Find via grep for `capability-gaps.json` writes.
    - _Requirements: 5.3_
  - [ ] 3.3 Wrap the case store writer (`engine/cases/case-store.ts` or its current location) in `withPerFileLock`.
    - _Requirements: 5.4_
  - [ ] 3.4 Wave 3 checkpoint: typecheck + test (every existing test that exercises these writers must still pass — the lock is transparent).

- [ ] 4. Wave 4 — JSONL ledger conversion
  - [ ] 4.1 Add `readDecisionPolicyLedger(directiveRoot)` to `engine/decision-policy-ledger.ts` that streams JSONL and reconstructs the legacy object shape. mtime cache.
    - _Requirements: 4.2_
  - [ ] 4.2 Add property test `tests/property/decision-ledger-tail-reader.property.test.ts` asserting `readDecisionPolicyLedger` produces the same object shape as the legacy reader for any sequence of N events written via `appendJsonLine`.
    - _Requirements: 4.2_
  - [ ] 4.3 Switch `appendDecisionPolicyEvent` from RMW of `.json` to `appendJsonLine` of `.jsonl`. Keep the `.json` snapshot regenerated only on shutdown.
    - _Requirements: 4.1, 4.4_
  - [ ] 4.4 Repeat for `discovery/routing-correction-ledger.json` if it exists.
    - _Requirements: 4.3_
  - [ ] 4.5 Add `tests/integration/hardening/decision-ledger-jsonl.test.ts` for round-trip.
    - _Requirements: 7.3_
  - [ ] 4.6 Wave 4 checkpoint: typecheck + test (every existing engine test must pass; the ledger surface is ABI-stable).

- [ ] 5. Wave 5 — Host wiring
  - [ ] 5.1 Wire `acquireDirectiveRootLock` into `hosts/standalone-host/server.ts::start` and `releaseDirectiveRootLock` into `stop`. Add SIGINT/SIGTERM handlers per `design.md`.
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 5.2 Wire same into `hosts/web-host/cli.ts` `serve` command.
    - _Requirements: 3.4_
  - [ ] 5.3 Wrap one-shot CLI subcommands in `acquire/release` try/finally.
    - _Requirements: 3.5_
  - [ ] 5.4 Add `tests/integration/standalone-host-double-start.test.ts` — spawns two `serve` processes against the same root, asserts second exits 1.
    - _Requirements: 9.3_
  - [ ] 5.5 Wave 5 checkpoint: typecheck + test + check:build + the new double-start test.

- [ ] 6. Wave 6 — Concurrent-submission property test + docs + CI
  - [ ] 6.1 Add `tests/property/concurrent-submissions.property.test.ts` per `design.md → "Property 1"`. Uses `worker_threads` to fork N writers.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ] 6.2 Add `CONCURRENT_TESTS=1` gate. Document in `tests/README.md`.
    - _Requirements: 6.6_
  - [ ] 6.3 Add `concurrent-tests` step to `.github/workflows/ci.yml` running `CONCURRENT_TESTS=1 pnpm run test --reporter=verbose -t "concurrent"`.
    - _Requirements: 9.2_
  - [ ] 6.4 Add Concurrency rules section to `CONTRIBUTING.md` linking to Concurrency_Doc.
    - _Requirements: 8.1, 8.2_
  - [ ] 6.5 Wave 6 checkpoint: full verification gate green; concurrent gate green.
    - _Requirements: 9.1, 9.2_

- [ ] 7. Final block
  - [ ] 7.1 Update `Fix_Plan.md` F13 row to ✅ done with outcome block.
  - [ ] 7.2 Re-run the full gate including concurrent for the F13 hand-off message.
