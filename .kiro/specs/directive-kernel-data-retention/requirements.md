# Requirements Document

## Introduction

`engine/decision-policy-ledger.jsonl` (post-F13) appends forever. The case store accumulates. Run records accumulate. There is no archival, no rotation, no retention policy. After a year of real use every read scans more data than necessary, and `engine/process-fingerprint.ts`'s "scan existing runs for matches" goes O(n) over an unbounded n.

This feature documents a retention policy at `shared/contracts/data-retention.md`, adds an archival writer that moves old records into `archive/<year>/<month>/` under the directive-root, rotates the decision-policy ledger to monthly segments named `decision-policy-ledger.<yyyy-mm>.jsonl`, switches the tail-reader to scan archive segments lazily on explicit historical lookback, adds a `kernel maintenance archive` CLI command, and adds metric counters (active record count, archived record count, ledger size on disk).

The work depends on F13 (concurrency/locking) so that archive moves are safe under the per-file lock.

## Glossary

- **Kernel**: The root TypeScript package `@directive/kernel`.
- **Directive_Root**: The on-disk directory the kernel persists to.
- **Retention_Doc**: The Markdown file `shared/contracts/data-retention.md`.
- **Active_Run_Records_Dir**: The directory `runtime/host-artifacts/engine-runs/` (post-F6) holding all live run records.
- **Archive_Root**: The directory `archive/` at the root of a Directive_Root.
- **Archive_Bucket**: A subdirectory `archive/<yyyy>/<mm>/` (e.g. `archive/2025/11/`) that holds records archived during that month.
- **Active_Ledger_Segment**: The current month's ledger file at `engine/decision-policy-ledger.jsonl`.
- **Rotated_Ledger_Segment**: A historical ledger file at `engine/decision-policy-ledger.<yyyy-mm>.jsonl`. The active segment becomes a rotated segment when its month ends and a new month's events arrive.
- **Retention_Policy**: A Directive_Root-level setting object: `{ runRecords: { maxAgeDays: number | null }, ledger: { rotationCadence: "monthly" }, caseStore: { maxAgeDays: number | null } }`. Default: indefinite retention; ledger rotates monthly; case store indefinite.
- **Active_Record_Count**: The integer count of records in `Active_Run_Records_Dir` not in any `Archive_Bucket`.
- **Archived_Record_Count**: The integer count of records across all `Archive_Bucket` directories.
- **Ledger_Size_On_Disk**: The byte size of `Active_Ledger_Segment` plus all `Rotated_Ledger_Segment` files.
- **Maintenance_Command**: The CLI subcommand `kernel maintenance archive` (entry point `hosts/standalone-host/cli.ts maintenance archive` and `hosts/web-host/cli.ts maintenance archive`).
- **Segmented_Reader**: The tail-reader rewrite that, by default, reads only `Active_Ledger_Segment`, and reads `Rotated_Ledger_Segment` files only when an explicit `lookback: { sinceMonth: <yyyy-mm> }` argument is passed.

## Requirements

### Requirement 1 — Retention_Doc

**User Story:** As a kernel adopter running the kernel for more than a few months, I want a written retention policy so that I know what the kernel does and does not promise about old records.

#### Acceptance Criteria

1. THE Kernel SHALL include a Retention_Doc at `shared/contracts/data-retention.md`.
2. THE Retention_Doc SHALL document the run-record default retention (indefinite; consumer may set `maxAgeDays`), the ledger rotation cadence (monthly), the case-store retention (indefinite by default), and the intake-queue boundedness (entries leave the queue when they route to a downstream lane; verify in code).
3. THE Retention_Doc SHALL document the archive layout `archive/<yyyy>/<mm>/<original-basename>`.
4. THE Retention_Doc SHALL document the Maintenance_Command and its expected invocation cadence (operator-driven, suggested cron pattern provided).
5. THE Retention_Doc's first line SHALL read `**Enforced by:** engine/maintenance/archive.ts`.

### Requirement 2 — Archive writer

**User Story:** As a kernel maintainer, I want an archival function that moves old records into `Archive_Bucket` directories so that hot reads scan only recent state.

#### Acceptance Criteria

1. THE Kernel SHALL include a module `engine/maintenance/archive.ts` exporting `archiveRunRecords(directiveRoot: string, opts: { maxAgeDays: number; now?: Date })`.
2. WHEN `archiveRunRecords` runs, THE Kernel SHALL identify every file in `Active_Run_Records_Dir` whose `receivedAt` field on the parsed record is older than `now - maxAgeDays`.
3. FOR each identified record, THE Kernel SHALL move the file from `Active_Run_Records_Dir/<basename>` to `Archive_Bucket(<yyyy>/<mm>)/<basename>` where `<yyyy>` and `<mm>` come from the record's `receivedAt`. The move SHALL use `fs.renameSync` for atomicity within the same volume.
4. WHERE the destination already exists (re-archival), THE Kernel SHALL throw an explicit error `archive_collision: <basename> already exists in <bucket>`.
5. THE move SHALL be wrapped in `withPerFileLock` (per F13) on the source file path.
6. THE move SHALL emit one log line per archived record to stderr in the form `archived: <basename> → <bucket>`.

### Requirement 3 — Ledger rotation

**User Story:** As a kernel maintainer, I want the decision-policy ledger to rotate monthly so that the active segment stays bounded.

#### Acceptance Criteria

1. THE Kernel SHALL include a function `rotateDecisionPolicyLedger(directiveRoot: string, opts: { now?: Date })` in `engine/maintenance/archive.ts`.
2. WHEN `rotateDecisionPolicyLedger` runs and the most recent event in `Active_Ledger_Segment` belongs to a month earlier than `now`, THE Kernel SHALL rename `engine/decision-policy-ledger.jsonl` to `engine/decision-policy-ledger.<yyyy-mm>.jsonl` (using the most-recent-event's month) and create an empty `engine/decision-policy-ledger.jsonl` for the new month.
3. WHERE the active segment is empty, THE Kernel SHALL skip rotation and SHALL NOT create a zero-byte rotated segment.
4. THE rotation SHALL be wrapped in `withPerFileLock` on the active segment.
5. THE rotation SHALL be safe under concurrent appenders (per F13's lock guarantee).

### Requirement 4 — Segmented_Reader

**User Story:** As a runtime caller of `readDecisionPolicyLedger`, I want hot reads to scan only the active segment so that ledger reads stay fast even when years of history exist on disk.

#### Acceptance Criteria

1. THE Kernel SHALL update `engine/decision-policy-ledger.ts::readDecisionPolicyLedger(directiveRoot, opts?)` to accept an optional `opts.lookback: { sinceMonth: "yyyy-mm" } | "active-only" | "all"`. Default: `"active-only"`.
2. WHEN `lookback === "active-only"`, THE Kernel SHALL read only `Active_Ledger_Segment`.
3. WHEN `lookback === { sinceMonth: "<yyyy-mm>" }`, THE Kernel SHALL read every Rotated_Ledger_Segment whose month is `>= sinceMonth` and the active segment, concatenated in chronological order.
4. WHEN `lookback === "all"`, THE Kernel SHALL read every Rotated_Ledger_Segment (regardless of month) and the active segment.
5. WHERE a Rotated_Ledger_Segment file is missing or empty, THE reader SHALL skip it without error.

### Requirement 5 — Maintenance_Command

**User Story:** As a host operator, I want a CLI command that runs the archival pass so that I can wire it into a cron without writing custom glue.

#### Acceptance Criteria

1. THE Kernel SHALL include a CLI subcommand `kernel maintenance archive` accessible from `hosts/standalone-host/cli.ts` (`pnpm run standalone:cli maintenance archive`).
2. THE subcommand SHALL accept the flags `--directive-root <path>`, `--max-age-days <n>` (default `30`), `--rotate-ledger` (default true), `--rotate-correction-ledger` (default true), `--dry-run` (prints what would be done without doing it).
3. WHEN the subcommand runs, THE Kernel SHALL acquire `Process_Lock_File` (per F13) before performing any move or rename. WHERE the lock is held by an active host process, the subcommand SHALL fail with the same error message F13 specifies.
4. WHEN the subcommand completes, THE Kernel SHALL print a summary to stdout: `archived <N> run records, rotated <K> ledger segments, total bytes moved <B>`.
5. THE subcommand SHALL exit zero on success, non-zero on any error encountered during the pass.
6. THE Kernel SHALL include a recommended cron pattern in Retention_Doc (e.g. `0 3 1 * * /path/to/pnpm --dir /path/to/host run standalone:cli maintenance archive --directive-root /path/to/root`).

### Requirement 6 — Metrics

**User Story:** As an operator monitoring kernel health, I want the host to expose Active_Record_Count, Archived_Record_Count, and Ledger_Size_On_Disk so that I can track growth and decide when to tighten retention.

#### Acceptance Criteria

1. THE Kernel SHALL include a function `summarizeKernelStorage(directiveRoot: string): { activeRunRecords: number; archivedRunRecords: number; activeLedgerBytes: number; rotatedLedgerBytes: number; rotatedLedgerSegments: number }` in `engine/maintenance/archive.ts`.
2. THE standalone host's `/api/runtime/status` endpoint SHALL include a `storage` block populated from `summarizeKernelStorage`.
3. THE web host's `/api/runtime/status` endpoint SHALL include the same `storage` block.
4. THE `pnpm run standalone:cli maintenance archive --dry-run` output SHALL include the storage summary before and after the simulated archive pass.

### Requirement 7 — Tests

**User Story:** As a reviewer, I want hardening tests that prove archival and rotation are correct so that I can land the change without manually exercising every path.

#### Acceptance Criteria

1. THE Kernel SHALL include `tests/integration/hardening/archive-run-records.test.ts` covering: archive of N old records, archive_collision error path, no-op when nothing is older than `maxAgeDays`.
2. THE Kernel SHALL include `tests/integration/hardening/rotate-ledger.test.ts` covering: rotation when crossing a month boundary, no-op rotation when active is empty, rotated file naming `decision-policy-ledger.<yyyy-mm>.jsonl`.
3. THE Kernel SHALL include `tests/property/segmented-ledger-reader.property.test.ts` asserting that for any sequence of N events split across M monthly segments, `readDecisionPolicyLedger(opts: { lookback: "all" })` reconstructs the same in-memory shape as the legacy reader would have given the unsegmented JSONL.
4. THE Kernel SHALL include `tests/integration/maintenance-archive-cli.test.ts` exercising the CLI subcommand against a synthetic Directive_Root.

### Requirement 8 — Verification gate

#### Acceptance Criteria

1. WHEN `pnpm run typecheck`, `pnpm run test`, `pnpm run check:build`, `pnpm run check:naming`, `pnpm run check:contracts`, and `pnpm run check:examples` run after the spec is implemented, THE Kernel SHALL exit zero on each.
2. WHEN `pnpm run standalone:cli maintenance archive --directive-root <root> --max-age-days 0` runs against a Directive_Root with N records, every record SHALL be archived and zero records SHALL remain in `Active_Run_Records_Dir`.
