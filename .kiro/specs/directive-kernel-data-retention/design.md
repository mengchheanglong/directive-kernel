# Design Document

## Overview

One new module (`engine/maintenance/archive.ts`), one rewrite (`engine/decision-policy-ledger.ts::readDecisionPolicyLedger` becomes segmented), one CLI subcommand split across both hosts, plus metrics wiring into the two existing `/api/runtime/status` handlers. Depends on F13's `withPerFileLock` and `Process_Lock_File`.

## Architecture

```
   ┌──────────────────────────────────────────────────────────┐
   │  CLI:  kernel maintenance archive                        │
   │     1. acquire Process_Lock_File (F13)                   │
   │     2. archiveRunRecords(maxAgeDays)                     │
   │     3. rotateDecisionPolicyLedger() if month boundary    │
   │     4. summarizeKernelStorage() for stdout summary       │
   │     5. release Process_Lock_File                         │
   └──────────────────────────────────────────────────────────┘
                              │
                              ▼
   ┌──────────────────────────────────────────────────────────┐
   │  archive.ts                                              │
   │   - archiveRunRecords(directiveRoot, { maxAgeDays })     │
   │   - rotateDecisionPolicyLedger(directiveRoot)            │
   │   - summarizeKernelStorage(directiveRoot)                │
   └──────────────────────────────────────────────────────────┘
                              │ uses
                              ▼
   ┌──────────────────────────────────────────────────────────┐
   │  withPerFileLock (F13)                                   │
   │  appendJsonLine                                          │
   │  fs.renameSync (atomic same-volume move)                 │
   └──────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### `engine/maintenance/archive.ts`

```ts
import * as fs from "node:fs";
import * as path from "node:path";
import { withPerFileLock } from "../../shared/lib/file-io.ts";

export interface ArchiveResult {
  archivedCount: number;
  archivedBasenames: string[];
  bytesMoved: number;
}

export async function archiveRunRecords(
  directiveRoot: string,
  opts: { maxAgeDays: number; now?: Date },
): Promise<ArchiveResult> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - opts.maxAgeDays * 86_400_000);
  const activeDir = path.join(directiveRoot, "runtime", "host-artifacts", "engine-runs");
  if (!fs.existsSync(activeDir)) return { archivedCount: 0, archivedBasenames: [], bytesMoved: 0 };

  const archivedBasenames: string[] = [];
  let bytesMoved = 0;

  for (const entry of fs.readdirSync(activeDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const sourcePath = path.join(activeDir, entry.name);
    const record = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const receivedAt = new Date(record.receivedAt);
    if (receivedAt >= cutoff) continue;

    const yyyy = String(receivedAt.getUTCFullYear());
    const mm = String(receivedAt.getUTCMonth() + 1).padStart(2, "0");
    const bucket = path.join(directiveRoot, "archive", yyyy, mm);
    fs.mkdirSync(bucket, { recursive: true });
    const destPath = path.join(bucket, entry.name);
    if (fs.existsSync(destPath)) {
      throw new Error(`archive_collision: ${entry.name} already exists in archive/${yyyy}/${mm}`);
    }
    const stat = fs.statSync(sourcePath);
    await withPerFileLock(sourcePath, () => {
      fs.renameSync(sourcePath, destPath);
    });
    archivedBasenames.push(entry.name);
    bytesMoved += stat.size;
    process.stderr.write(`archived: ${entry.name} → archive/${yyyy}/${mm}\n`);
  }

  return { archivedCount: archivedBasenames.length, archivedBasenames, bytesMoved };
}

export async function rotateDecisionPolicyLedger(
  directiveRoot: string,
  opts: { now?: Date } = {},
): Promise<{ rotated: boolean; rotatedTo?: string }> {
  const now = opts.now ?? new Date();
  const activePath = path.join(directiveRoot, "engine", "decision-policy-ledger.jsonl");
  if (!fs.existsSync(activePath)) return { rotated: false };
  const stat = fs.statSync(activePath);
  if (stat.size === 0) return { rotated: false };

  return withPerFileLock(activePath, () => {
    // peek the last line for its timestamp
    const lastTs = peekLastLineTimestamp(activePath);
    const lastDate = lastTs ? new Date(lastTs) : null;
    if (!lastDate) return { rotated: false };
    const sameMonth = lastDate.getUTCFullYear() === now.getUTCFullYear()
      && lastDate.getUTCMonth() === now.getUTCMonth();
    if (sameMonth) return { rotated: false };

    const yyyy = String(lastDate.getUTCFullYear());
    const mm = String(lastDate.getUTCMonth() + 1).padStart(2, "0");
    const rotatedPath = path.join(directiveRoot, "engine", `decision-policy-ledger.${yyyy}-${mm}.jsonl`);
    if (fs.existsSync(rotatedPath)) {
      throw new Error(`rotate_collision: ${path.basename(rotatedPath)} already exists`);
    }
    fs.renameSync(activePath, rotatedPath);
    fs.writeFileSync(activePath, "");
    return { rotated: true, rotatedTo: path.basename(rotatedPath) };
  });
}

export interface KernelStorageSummary {
  activeRunRecords: number;
  archivedRunRecords: number;
  activeLedgerBytes: number;
  rotatedLedgerBytes: number;
  rotatedLedgerSegments: number;
}

export function summarizeKernelStorage(directiveRoot: string): KernelStorageSummary {
  // count files in active dir
  // walk archive/<yyyy>/<mm>/
  // stat ledger active + rotated *.jsonl
  // ...
}
```

`peekLastLineTimestamp` reads the file from the end, finds the last newline, parses the trailing JSON object, returns its `timestamp` (or `receivedAt`) field. Avoids loading the full ledger into memory.

### `engine/decision-policy-ledger.ts` segmented reader

```ts
type Lookback = "active-only" | "all" | { sinceMonth: string };

export function readDecisionPolicyLedger(
  directiveRoot: string,
  opts: { lookback?: Lookback } = {},
): DecisionPolicyLedger {
  const lookback = opts.lookback ?? "active-only";
  const dir = path.join(directiveRoot, "engine");
  const activePath = path.join(dir, "decision-policy-ledger.jsonl");

  const segments: string[] = [];
  if (lookback !== "active-only") {
    const all = fs.readdirSync(dir)
      .filter((f) => /^decision-policy-ledger\.\d{4}-\d{2}\.jsonl$/.test(f))
      .sort(); // lexicographic == chronological for yyyy-mm
    if (lookback === "all") {
      segments.push(...all.map((f) => path.join(dir, f)));
    } else {
      const since = lookback.sinceMonth;
      segments.push(...all
        .filter((f) => f.replace("decision-policy-ledger.", "").replace(".jsonl", "") >= since)
        .map((f) => path.join(dir, f))
      );
    }
  }
  if (fs.existsSync(activePath)) segments.push(activePath);

  const events: DecisionPolicyEvent[] = [];
  for (const segPath of segments) {
    const lines = fs.readFileSync(segPath, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      try { events.push(JSON.parse(line)); } catch { /* skip torn line */ }
    }
  }

  return reconstructLedgerObject(events);
}
```

### CLI subcommand

```ts
// hosts/standalone-host/cli.ts (add to dispatcher)
case "maintenance":
  return await runMaintenanceCommand(args);

async function runMaintenanceCommand(args: string[]): Promise<void> {
  const subcommand = args[0];
  if (subcommand !== "archive") throw new Error(`Unknown maintenance subcommand: ${subcommand}`);
  const flags = parseFlags(args.slice(1));
  const directiveRoot = required(flags, "directive-root");
  const maxAgeDays = Number(flags["max-age-days"] ?? 30);
  const dryRun = "dry-run" in flags;
  const rotateLedger = !("no-rotate-ledger" in flags);

  if (!dryRun) {
    acquireDirectiveRootLock(directiveRoot);
  }
  try {
    const beforeSummary = summarizeKernelStorage(directiveRoot);
    if (dryRun) {
      // ... preview only ...
      return;
    }
    const { archivedCount, bytesMoved } = await archiveRunRecords(directiveRoot, { maxAgeDays });
    let rotatedSegments = 0;
    if (rotateLedger) {
      const { rotated } = await rotateDecisionPolicyLedger(directiveRoot);
      rotatedSegments = rotated ? 1 : 0;
    }
    const afterSummary = summarizeKernelStorage(directiveRoot);
    process.stdout.write(`archived ${archivedCount} run records, rotated ${rotatedSegments} ledger segments, total bytes moved ${bytesMoved}\n`);
  } finally {
    if (!dryRun) releaseDirectiveRootLock(directiveRoot);
  }
}
```

## Data Models

### Archive_Bucket layout

```
archive/
├── 2024/
│   ├── 11/
│   │   ├── <runId>.json
│   │   └── ...
│   └── 12/...
└── 2025/
    └── 01/...
```

### Rotated ledger segment naming

`engine/decision-policy-ledger.YYYY-MM.jsonl` (e.g. `decision-policy-ledger.2025-11.jsonl`). Lexicographic sort on filename produces chronological order.

## Correctness Properties

- **Property 1 — Segmented_Reader equivalence.** For any sequence of N events split across M monthly segments, `readDecisionPolicyLedger(opts: { lookback: "all" })` returns the same ledger object that the legacy reader would have given the unsegmented JSONL form.
- **Property 2 — Archive idempotence.** Running `archiveRunRecords({ maxAgeDays: K })` twice in succession is safe: the second call archives zero records (because the first call moved them all out of `Active_Run_Records_Dir`).
- **Property 3 — Rotation atomicity.** Mid-rotation, the active ledger file is either entirely the old content (under its rotated filename) or entirely empty (under the active filename); no observable "merged" or "lost" state.

## Error Handling

- `archive_collision` when the destination basename exists. Means a previous archive run partially completed; operator must resolve manually.
- `rotate_collision` when a `decision-policy-ledger.<yyyy-mm>.jsonl` already exists with the new month's name. Means a previous rotation completed but the active file was not regenerated; operator must resolve manually.
- `directive_root_locked` (from F13) when a host process holds the lock. Caller should retry after the host stops, or use `--dry-run` to preview without acquiring.

## Testing Strategy

### Unit tests

`tests/integration/hardening/archive-run-records.test.ts`, `tests/integration/hardening/rotate-ledger.test.ts`. Synthetic Directive_Root in `os.tmpdir()`.

### Property tests

`tests/property/segmented-ledger-reader.property.test.ts` — generates N events, partitions into M segments, asserts `lookback: "all"` reconstructs the unsegmented form.

### Integration tests

`tests/integration/maintenance-archive-cli.test.ts` — spawns the CLI subprocess, asserts stdout summary line, asserts post-condition file layout.

## Wave Plan

| Wave | Scope | Checkpoint |
|---|---|---|
| 1 | `Retention_Doc` + `engine/maintenance/archive.ts` skeleton with `summarizeKernelStorage` only | typecheck + test + check:contracts |
| 2 | `archiveRunRecords` + hardening test | typecheck + test |
| 3 | `rotateDecisionPolicyLedger` + segmented `readDecisionPolicyLedger` + property test | typecheck + test |
| 4 | CLI subcommand wiring on both hosts + integration test | typecheck + test + check:build |
| 5 | Status-endpoint metric wiring + Retention_Doc cron pattern | full gate green |

## Open Questions

- Should run records reference an external object store (S3, etc.) instead of filesystem archive? Out of scope — this spec stays filesystem-only; object-store support is an Improvement Plan item.
- Should the archive directory be `.gitignored` automatically? Yes — add `archive/` to `.gitignore` in Wave 1.
