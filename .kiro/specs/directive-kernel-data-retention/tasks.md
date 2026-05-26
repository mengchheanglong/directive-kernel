# Implementation Plan: Data retention + ledger rotation

## Overview

Five waves, depends on F13 (concurrency/locking) being landed first.

## Test breakage strategy

Wave 3 (segmented reader) is the highest-risk wave — every existing engine test that calls `readDecisionPolicyLedger` with no opts must keep passing. The default `"active-only"` value was chosen to preserve the existing behavior; verify by running the full test suite against a synthetic Directive_Root that has both an active segment and a rotated segment.

## Tasks

- [ ] 1. Wave 1 — Retention_Doc + storage summary
  - [ ] 1.1 Create `shared/contracts/data-retention.md` per `design.md`. First line `**Enforced by:** engine/maintenance/archive.ts`. Add cron pattern at the bottom.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [ ] 1.2 Create `engine/maintenance/archive.ts` exporting only `summarizeKernelStorage(directiveRoot)`. Implement walk-and-stat per `design.md`.
    - _Requirements: 6.1_
  - [ ] 1.3 Add `archive/` to `.gitignore`.
  - [ ] 1.4 Wire `summarizeKernelStorage` into the standalone-host `/api/runtime/status` handler under a `storage` block.
    - _Requirements: 6.2_
  - [ ] 1.5 Same for web-host.
    - _Requirements: 6.3_
  - [ ] 1.6 Wave 1 checkpoint: typecheck + test + check:contracts (must resolve the new contract).

- [ ] 2. Wave 2 — archiveRunRecords
  - [ ] 2.1 Implement `archiveRunRecords(directiveRoot, { maxAgeDays, now? })` per `design.md`. Uses `withPerFileLock`. Throws `archive_collision`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [ ] 2.2 Create `tests/integration/hardening/archive-run-records.test.ts` covering the three cases.
    - _Requirements: 7.1_
  - [ ] 2.3 Wave 2 checkpoint: typecheck + test.

- [ ] 3. Wave 3 — rotateDecisionPolicyLedger + Segmented_Reader
  - [ ] 3.1 Implement `rotateDecisionPolicyLedger(directiveRoot, { now? })` per `design.md`. Uses `withPerFileLock` on active path. Atomic rename + empty-file create.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ] 3.2 Update `readDecisionPolicyLedger(directiveRoot, opts?)` to accept `Lookback` per `design.md`. Default `"active-only"` preserves legacy behavior.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ] 3.3 Add `tests/integration/hardening/rotate-ledger.test.ts` covering the three rotation cases.
    - _Requirements: 7.2_
  - [ ] 3.4 Add `tests/property/segmented-ledger-reader.property.test.ts` per `design.md → "Property 1"`. `numRuns: 100`.
    - _Requirements: 7.3_
  - [ ] 3.5 Wave 3 checkpoint: typecheck + test (the full existing suite must pass — every default-args ledger reader call still works).

- [ ] 4. Wave 4 — CLI subcommand
  - [ ] 4.1 Add `maintenance` subcommand to `hosts/standalone-host/cli.ts` per `design.md`. Wires through `--directive-root`, `--max-age-days`, `--rotate-ledger`/`--no-rotate-ledger`, `--dry-run`.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ] 4.2 Mirror the subcommand in `hosts/web-host/cli.ts`.
    - _Requirements: 5.1_
  - [ ] 4.3 Update standalone-host CLI usage line and README "Try It" pointer if relevant.
  - [ ] 4.4 Add `tests/integration/maintenance-archive-cli.test.ts` driving the subcommand via `child_process.spawn`.
    - _Requirements: 7.4_
  - [ ] 4.5 Wave 4 checkpoint: typecheck + test + check:build.

- [ ] 5. Wave 5 — Polish + cron docs
  - [ ] 5.1 Update Retention_Doc with the recommended cron pattern verbatim.
    - _Requirements: 5.6_
  - [ ] 5.2 Add Retention_Doc link to `CONTRIBUTING.md` "Concurrency rules" section (introduced in F13).
  - [ ] 5.3 Wave 5 checkpoint: full verification gate green.
    - _Requirements: 8.1, 8.2_

- [ ] 6. Final block
  - [ ] 6.1 Update `Fix_Plan.md` F14 row to ✅ done with outcome block.
  - [ ] 6.2 Re-run the full gate. Capture for the F14 hand-off message.
