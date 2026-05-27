**Enforced by:** engine/maintenance/archive.ts

# Data Retention & Rotation Contract

## Overview

The kernel stores run records and a decision-policy ledger on the filesystem. Over time these grow unboundedly. This contract defines the retention schedule and the rotation rules that keep storage usage predictable.

## Storage Layout

```
<directive-root>/
├── runtime/host-artifacts/engine-runs/     # Active_Run_Records_Dir (daily JSON files)
├── engine/decision-policy-ledger.jsonl     # Active_Ledger (append-only JSONL)
├── engine/decision-policy-ledger.YYYY-MM.jsonl  # Rotated_Ledger_Segments
└── archive/<yyyy>/<mm>/<runId>.json        # Archive_Bucket (moved run records)
```

## Retention Schedule

| Data | Retention | Rotation Trigger | Archive Destination |
|------|-----------|------------------|---------------------|
| Engine run records | 30 days in active dir | `archiveRunRecords({ maxAgeDays: 30 })` | `archive/<yyyy>/<mm>/` |
| Decision-policy ledger | N/A (kept indefinitely) | Month boundary on last event timestamp | `decision-policy-ledger.YYYY-MM.jsonl` |

## Rotation Rules

1. **Run record archival.** Any `.json` file in `Active_Run_Records_Dir` whose `receivedAt` is older than `maxAgeDays` from `now` is moved atomically (via `fs.renameSync` under `withPerFileLock`) into `archive/<yyyy>/<mm>/`.

2. **Ledger rotation.** At the start of every month, the active `decision-policy-ledger.jsonl` is renamed to `decision-policy-ledger.YYYY-MM.jsonl` (where `YYYY-MM` is the timestamp of the **last** event in the file). The active file is then truncated to empty. Rotation only happens when the last event's month differs from the current month.

3. **Idempotence.** Running the archive command twice in succession is safe: the second invocation archives zero records and rotates zero ledger segments.

## Recommended Cron Pattern

```
# Run daily at 03:00 UTC
0 3 * * * cd /path/to/directive-root && kernel maintenance archive --directive-root . --max-age-days 30 >> /var/log/kernel-retention.log 2>&1
```

This schedule ensures:
- Run records older than 30 days are archived once per day
- Ledger rotation happens at the first month-boundary crossing after the cron fires
- The cron does not need to track the current month — the `rotateDecisionPolicyLedger` function detects the boundary internally
