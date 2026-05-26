# Schema versioning policy

This document is the source of truth for how `@directive/kernel` versions
its persisted-record JSON Schemas, what migrations it ships, and what
URI continuity adopters can expect across versions.

## Version-bump rule

The integer in `schemaVersion` (and, for the run record, the constant
`DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` exported from
[`engine/types.ts`](../../engine/types.ts)) increments by exactly one when any of the following
applies to the schema:

- a required field is renamed
- a required field is removed
- a required field has its type narrowed

New optional fields MAY be added without a version bump. (Requirement 7.2.)

## Migration requirement

Every version bump SHALL ship a corresponding migration module under
[`shared/schemas/migrations/`](../schemas/migrations/) named `v<source>-to-v<target>.ts`, registered
in the Schema_Migration_Registry at [`shared/schemas/migrations/index.ts`](../schemas/migrations/index.ts).
The registry is the only construct in the kernel that knows the set of
available migrations. (Requirement 7.3, 8.5.)

## Property-test requirement

Every migration SHALL be accompanied by:

- a forward Property_Test (round-trip lossless on the field set the
  migration claims to handle) — `migrate(record)` preserves every
  lossless field
- a reverse Property_Test — `rollback(migrate(record))` returns a record
  equal to the original on the lossless field subset

Both tests run with at least 100 generated examples per property.
(Requirement 7.4, 14.5.)

## Schema-URI hard-break rule

When a schema file is renamed:

- the previous file is deleted in the same cut
- no HTTP redirect is stood up
- the only forward path for persisted records is in-flight migration
  through the Schema_Migration_Registry

This is a deliberate trade-off: a redirect would let stale records
linger silently across versions; a hard break forces every persistence
layer to opt in to the migration path explicitly. (Requirement 7.5.)

## Package-version bump rule

A schema-version bump on a published-package surface (currently
`RunRecord`) SHALL also bump the `package.json` minor version while the
package remains pre-1.0. The v8 → v9 cut bumps from `0.1.x` to `0.2.0`.
(Requirement 7.7, 12.1.)

## First concrete application: v8 → v9

The v8 → v9 cut is the first migration shipped under this policy.

- migration: [`shared/schemas/migrations/v8-to-v9.ts`](../schemas/migrations/v8-to-v9.ts)
- registry: [`shared/schemas/migrations/index.ts`](../schemas/migrations/index.ts)
- new schema: [`shared/schemas/run-record.schema.json`](../schemas/run-record.schema.json)
- deleted schema: `shared/schemas/directive-engine-run-record.schema.json` (no redirect)

The cut renames eight Vocabulary_Rename_Set keys, rewrites the `$schema`
URI (relative and absolute forms), and bumps `schemaVersion` to `9`.
(Requirement 7.6, 9.1–9.8.)
