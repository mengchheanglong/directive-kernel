import * as fc from "fast-check";

import { FIELD_RENAMES } from "../../../shared/schemas/migrations/v8-to-v9.ts";

const V8_SCHEMA_REF_RELATIVE = "shared/schemas/directive-engine-run-record.schema.json";
const V8_SCHEMA_REF_ABSOLUTE =
  "https://directive-workspace.dev/schemas/directive-engine-run-record.schema.json";
const V9_SCHEMA_REF_RELATIVE = "shared/schemas/run-record.schema.json";
const V9_SCHEMA_REF_ABSOLUTE =
  "https://directive-workspace.dev/schemas/run-record.schema.json";
const RECORD_KIND = "directive_engine_run_record";

const SOURCE_VERSION = 8;
const TARGET_VERSION = 9;

export const VOCAB_RENAME_LHS_KEYS = Object.keys(FIELD_RENAMES) as readonly string[];
export const VOCAB_RENAME_RHS_KEYS = Object.values(FIELD_RENAMES) as readonly string[];

const nonEmptyText = fc.string({ minLength: 1, maxLength: 80 });

function sourceFieldArb() {
  return fc.record({
    sourceType: nonEmptyText,
    sourceRef: nonEmptyText,
    title: nonEmptyText,
  });
}

function selectedLaneArb() {
  return fc.record({
    laneId: nonEmptyText,
    label: nonEmptyText,
  });
}

function vocabFieldArb() {
  return fc.oneof(
    fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
    fc.option(nonEmptyText, { nil: undefined }),
    fc.option(
      fc.array(nonEmptyText, { minLength: 0, maxLength: 5 }),
      { nil: undefined },
    ),
    fc.option(
      fc.record({
        summary: nonEmptyText,
        score: fc.integer({ min: 0, max: 100 }),
      }),
      { nil: undefined },
    ),
  );
}

function vocabFieldsArb(keys: readonly string[]) {
  const entries: Record<string, fc.Arbitrary<unknown>> = {};
  for (const key of keys) {
    entries[key] = vocabFieldArb();
  }
  return fc.record(entries);
}

function buildRecordArb(opts: {
  schemaVersion: number;
  schemaRefRelative: string;
  schemaRefAbsolute: string;
  vocabKeys: readonly string[];
}) {
  return fc
    .record({
      $schema: fc.oneof(
        fc.constant(opts.schemaRefRelative),
        fc.constant(opts.schemaRefAbsolute),
      ),
      schemaVersion: fc.constant(opts.schemaVersion),
      recordKind: fc.constant(RECORD_KIND),
      runId: nonEmptyText,
      receivedAt: nonEmptyText,
      source: sourceFieldArb(),
      selectedLane: selectedLaneArb(),
    })
    .chain((base) =>
      vocabFieldsArb(opts.vocabKeys).map((vocab) => ({
        ...base,
        ...vocab,
      })),
    );
}

// v8RecordArb generates v8-shaped records with all 8 Vocabulary_Rename_Set
// left-hand-side keys present sometimes (via fc.option) and absent sometimes,
// both relative and absolute $schema URI forms, and the identity-preserved
// required fields (schemaVersion: 8, recordKind, runId, receivedAt, source,
// selectedLane).
export const v8RecordArb = buildRecordArb({
  schemaVersion: SOURCE_VERSION,
  schemaRefRelative: V8_SCHEMA_REF_RELATIVE,
  schemaRefAbsolute: V8_SCHEMA_REF_ABSOLUTE,
  vocabKeys: VOCAB_RENAME_LHS_KEYS as unknown as readonly string[],
});

// v9RecordArb mirrors v8RecordArb but with renamed vocab keys and v9 $schema
// URI + schemaVersion: 9.
export const v9RecordArb = buildRecordArb({
  schemaVersion: TARGET_VERSION,
  schemaRefRelative: V9_SCHEMA_REF_RELATIVE,
  schemaRefAbsolute: V9_SCHEMA_REF_ABSOLUTE,
  vocabKeys: VOCAB_RENAME_RHS_KEYS as unknown as readonly string[],
});

// recordAtVersionArb returns a record whose schemaVersion is drawn from the
// supplied arbitrary. Used by Properties 4 and 5 to drive the storage version
// check at boundary versions.
export function recordAtVersionArb(versionArb: fc.Arbitrary<number>) {
  return versionArb.chain((version) => {
    if (version === SOURCE_VERSION) {
      return buildRecordArb({
        schemaVersion: SOURCE_VERSION,
        schemaRefRelative: V8_SCHEMA_REF_RELATIVE,
        schemaRefAbsolute: V8_SCHEMA_REF_ABSOLUTE,
        vocabKeys: VOCAB_RENAME_LHS_KEYS as unknown as readonly string[],
      });
    }
    if (version === TARGET_VERSION) {
      return buildRecordArb({
        schemaVersion: TARGET_VERSION,
        schemaRefRelative: V9_SCHEMA_REF_RELATIVE,
        schemaRefAbsolute: V9_SCHEMA_REF_ABSOLUTE,
        vocabKeys: VOCAB_RENAME_RHS_KEYS as unknown as readonly string[],
      });
    }
    return buildRecordArb({
      schemaVersion: version,
      schemaRefRelative: V8_SCHEMA_REF_RELATIVE,
      schemaRefAbsolute: V8_SCHEMA_REF_ABSOLUTE,
      vocabKeys: VOCAB_RENAME_LHS_KEYS as unknown as readonly string[],
    });
  });
}
