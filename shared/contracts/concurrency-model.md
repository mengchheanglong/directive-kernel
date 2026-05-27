**Enforced by:** shared/lib/process-lock.ts

# Concurrency model

The current concurrency model is **single-writer per Directive_Root**. Multi-writer concurrency is unsupported.

## Process lock

The file `engine/.lock` inside a Directive_Root provides an advisory process-level lock. The module `shared/lib/process-lock.ts` exports `acquireDirectiveRootLock` and `releaseDirectiveRootLock`.

When a host process starts, it acquires the lock. If the lock file exists and is fresh (within 30 seconds of the recorded `startedAt` timestamp and the recorded `pid` is alive on the current host), acquisition fails with `directive_root_locked`. If the lock is stale (older than 30 seconds AND the recorded `pid` is no longer alive), the lock is atomically replaced and the outcome is `stale_recovered`.

On clean process exit (SIGINT, SIGTERM, normal exit), the lock is released by removing the file. On a hard crash, the lock remains until the next acquire detects it as stale.

## Per-file lock

The helper `withPerFileLock` in `shared/lib/file-io.ts` writes a `<file>.lock` sibling before a read-modify-write cycle and removes it after the write commits. It uses the same freshness/staleness rules as the process lock. The default timeout is 5 seconds.

## Append-only ledgers

Files in the Append_Only_Ledger_Set (`engine/decision-policy-ledger.jsonl`, `discovery/routing-correction-ledger.jsonl`) use `appendJsonLine` writes with `O_APPEND` atomicity. No per-file lock is needed for appends. A tail-reader reconstructs the in-memory ledger state from the JSONL stream.

## Federation roadmap

Multi-host coordination (distributed locking, quorum writes, conflict resolution) is explicitly deferred to a future Fix_Plan item. The current kernel assumes a single host process per Directive_Root.
