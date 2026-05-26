// Schema_Migration_Registry — see shared/contracts/schema-versioning.md.
//
// The registry is the only construct in the kernel that knows the set of
// available migrations. Engine-store storage layers look up migrations
// through this registry only (Requirement 8.5).
//
// Adding a future migration is exactly two changes (Requirement 8.6):
//   1. Add the file shared/schemas/migrations/v<v>-to-v<v+1>.ts
//   2. Add one entry to `runRecordMigrations` keyed by `v`.
// No plugin discovery, no CLI, no runtime registration.

import * as v8ToV9 from "./v8-to-v9.ts";

export interface RunRecordMigration {
  /** Migrate a record from this entry's source version to source + 1. */
  readonly migrate: (record: unknown) => unknown;
  /** Best-effort reverse migration. May return a partial record. */
  readonly rollback: (record: unknown) => unknown;
}

/**
 * Keyed by source schema version (the integer being migrated *from*).
 * runRecordMigrations[v] migrates a v-record to a (v+1)-record.
 */
export const runRecordMigrations: Readonly<Record<number, RunRecordMigration>> = {
  8: v8ToV9,
  // 9: v9ToV10,   ← future
} as const;

/**
 * Walk the registry from `from` to `to` in source-version order, applying
 * each migration to `record`. Throws if the chain is incomplete.
 *
 * The error message is exactly the one specified by Requirement 10.4
 * (`schema_version_unmigratable:`) so storage code can rethrow without
 * re-wrapping.
 */
export function applyRunRecordMigrationChain(
  record: unknown,
  from: number,
  to: number,
): unknown {
  let current = record;
  for (let v = from; v < to; v += 1) {
    const step = runRecordMigrations[v];
    if (!step) {
      throw new Error(
        `schema_version_unmigratable: no migration registered for v${v} → v${v + 1} (record at v${from}, target v${to})`,
      );
    }
    current = step.migrate(current);
  }
  return current;
}
