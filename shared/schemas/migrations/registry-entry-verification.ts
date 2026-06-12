// Registry_Entry_Verification read-side migration.
//
// Runtime registry entries written before the `verification` field existed
// carry no verification claim. This helper applies the read-side default:
// any entry without an explicit verification value is treated as
// `"placeholder"` (honest default — no execution evidence has been claimed).
//
// NOTE: this is intentionally NOT registered in `runRecordMigrations`
// (shared/schemas/migrations/index.ts). That registry is exclusively for
// versioned `EngineRunRecord` migrations; registry entries are a separate,
// unversioned artifact and adding an optional field requires no version bump
// per shared/contracts/schema-versioning.md.

export type RegistryEntryVerification = "verified" | "claimed" | "placeholder";

export const REGISTRY_ENTRY_VERIFICATION_VALUES: readonly RegistryEntryVerification[] = [
  "verified",
  "claimed",
  "placeholder",
] as const;

export const DEFAULT_REGISTRY_ENTRY_VERIFICATION: RegistryEntryVerification = "placeholder";

/**
 * Pure read-side migration: returns a shallow copy of `entry` with
 * `verification` defaulted to `"placeholder"` when absent or null.
 * The input object is never mutated.
 */
export function migrateRegistryEntryVerification<
  T extends { verification?: RegistryEntryVerification | null },
>(entry: T): T & { verification: RegistryEntryVerification } {
  return {
    ...entry,
    verification: entry.verification ?? DEFAULT_REGISTRY_ENTRY_VERIFICATION,
  };
}
