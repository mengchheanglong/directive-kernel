import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { migrate, rollback, FIELD_RENAMES } from "../../shared/schemas/migrations/v8-to-v9.ts";
import { v8RecordArb, VOCAB_RENAME_LHS_KEYS } from "./_arbitraries/run-record.ts";

const VOCAB_RENAME_LHS = new Set(VOCAB_RENAME_LHS_KEYS);

const KEYS_REWRITTEN_BY_MIGRATION = new Set([
  ...VOCAB_RENAME_LHS_KEYS,
  "$schema",
  "schemaVersion",
]);

const V8_SCHEMA_REF_RELATIVE = "shared/schemas/directive-engine-run-record.schema.json";
const V8_SCHEMA_REF_ABSOLUTE =
  "https://directive-workspace.dev/schemas/directive-engine-run-record.schema.json";
const V9_SCHEMA_REF_RELATIVE = "shared/schemas/run-record.schema.json";
const V9_SCHEMA_REF_ABSOLUTE =
  "https://directive-workspace.dev/schemas/run-record.schema.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepEqualKeys(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  keys: string[],
): boolean {
  return keys.every((key) => {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (srcVal === undefined && tgtVal === undefined) return true;
    return deepEqual(srcVal, tgtVal);
  });
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord).filter((k) => aRecord[k] !== undefined);
    const bKeys = Object.keys(bRecord).filter((k) => bRecord[k] !== undefined);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(aRecord[key], bRecord[key]));
  }

  return false;
}

describe("v8-to-v9 migration", () => {
  // Property 1: V8 → V9 migration is structurally lossless on the lossless field set.
  // Design: design.md → "Correctness Properties → Property 1".
  // Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 14.1.
  it("Property 1: migrate(v8) is structurally lossless on the lossless field set", () => {
    fc.assert(
      fc.property(v8RecordArb, (record) => {
        const result = migrate(record);
        expect(isRecord(result)).toBe(true);
        const r = result as Record<string, unknown>;

        // schemaVersion === 9
        expect(r.schemaVersion).toBe(9);

        // $schema is the v9-form URI in the same relative-vs-absolute form
        const origSchema = (record as Record<string, unknown>).$schema;
        if (origSchema === V8_SCHEMA_REF_RELATIVE) {
          expect(r.$schema).toBe(V9_SCHEMA_REF_RELATIVE);
        } else if (origSchema === V8_SCHEMA_REF_ABSOLUTE) {
          expect(r.$schema).toBe(V9_SCHEMA_REF_ABSOLUTE);
        }

        // Every key not rewritten by the migration carries through deep-equal.
        const recordObj = record as Record<string, unknown>;
        const preservedKeys = Object.keys(recordObj).filter(
          (k) => !KEYS_REWRITTEN_BY_MIGRATION.has(k),
        );
        for (const key of preservedKeys) {
          expect(
            deepEqual(recordObj[key], r[key]),
            `preserved key "${key}" should be deep-equal`,
          ).toBe(true);
        }

        // Every Vocabulary_Rename_Set key appears under its v9 name with
        // deep-equal value.
        for (const [lhs, rhs] of Object.entries(FIELD_RENAMES)) {
          if (lhs in recordObj) {
            expect(
              deepEqual(recordObj[lhs], r[rhs]),
              `vocab key "${lhs}" → "${rhs}" should be deep-equal`,
            ).toBe(true);
          } else {
            // If the key was undefined/absent in input, it should also be
            // absent in output.
            expect(rhs in r || r[rhs] === undefined).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Property 2: V8 → V9 migration is round-trip lossless on the lossless field set.
  // Design: design.md → "Correctness Properties → Property 2".
  // Validates: Requirements 9.7, 14.2.
  it("Property 2: rollback(migrate(r)) deep-equals r on the lossless field set", () => {
    fc.assert(
      fc.property(v8RecordArb, (record) => {
        const migrated = migrate(record);
        const rolledBack = rollback(migrated);

        expect(isRecord(rolledBack)).toBe(true);
        const rb = rolledBack as Record<string, unknown>;
        const recordObj = record as Record<string, unknown>;

        // schemaVersion returns to 8
        expect(rb.schemaVersion).toBe(8);

        // $schema returns to the original form
        const origSchema = recordObj.$schema;
        expect(rb.$schema).toBe(origSchema);

        // All keys not rewritten by migration are preserved after round-trip
        const nonRewriteKeys = Object.keys(recordObj).filter(
          (k) => !KEYS_REWRITTEN_BY_MIGRATION.has(k),
        );
        for (const key of nonRewriteKeys) {
          expect(
            deepEqual(recordObj[key], rb[key]),
            `non-rewrite key "${key}" should survive round-trip`,
          ).toBe(true);
        }

        // All vocab rename keys are restored to their LHS names
        for (const [lhs] of Object.entries(FIELD_RENAMES)) {
          if (lhs in recordObj) {
            expect(
              deepEqual(recordObj[lhs], rb[lhs]),
              `vocab key "${lhs}" should survive round-trip`,
            ).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
