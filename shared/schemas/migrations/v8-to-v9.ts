// V8_To_V9_Migration — see shared/contracts/schema-versioning.md and
// design.md → "V8 → V9 migration content" for the full rewrite table.
//
// Vocabulary_Rename_Set field rewrites this migration applies (camelCase
// JSON object keys; Requirement 9.3, 9.8):
//   • earnedAutonomy        → operatorTrustScore
//   • gapRadar              → openGapsView
//   • narrativeThreading    → sourceThreadContext
//   • deepTail              → materializationTail
//   • legalNextSeams        → allowedNextSteps
//   • forbiddenScopeExpansion → outOfScope
//   • boundedCloseout       → closeout
//   • integrityGate         → integrityCheck
// Plus the $schema URI rewrite (Requirement 9.4).

const SOURCE_VERSION = 8 as const;
const TARGET_VERSION = 9 as const;

export const FIELD_RENAMES: Readonly<Record<string, string>> = {
  earnedAutonomy: "operatorTrustScore",
  gapRadar: "openGapsView",
  narrativeThreading: "sourceThreadContext",
  deepTail: "materializationTail",
  legalNextSeams: "allowedNextSteps",
  forbiddenScopeExpansion: "outOfScope",
  boundedCloseout: "closeout",
  integrityGate: "integrityCheck",
};

const REVERSE_FIELD_RENAMES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(FIELD_RENAMES).map(([from, to]) => [to, from]),
);

const V8_SCHEMA_REF_RELATIVE = "shared/schemas/directive-engine-run-record.schema.json";
const V9_SCHEMA_REF_RELATIVE = "shared/schemas/run-record.schema.json";
const V8_SCHEMA_REF_ABSOLUTE =
  "https://directive-workspace.dev/schemas/directive-engine-run-record.schema.json";
const V9_SCHEMA_REF_ABSOLUTE =
  "https://directive-workspace.dev/schemas/run-record.schema.json";

/** Rewrite $schema preserving relative-vs-absolute form (Requirement 9.4). */
function rewriteSchemaRef(value: unknown, forward: boolean): unknown {
  if (typeof value !== "string") return value;
  if (forward) {
    if (value === V8_SCHEMA_REF_RELATIVE) return V9_SCHEMA_REF_RELATIVE;
    if (value === V8_SCHEMA_REF_ABSOLUTE) return V9_SCHEMA_REF_ABSOLUTE;
    return value;
  }
  if (value === V9_SCHEMA_REF_RELATIVE) return V8_SCHEMA_REF_RELATIVE;
  if (value === V9_SCHEMA_REF_ABSOLUTE) return V8_SCHEMA_REF_ABSOLUTE;
  return value;
}

/** Rename keys at every nesting level using `table`. Arrays/primitives pass through. */
function renameKeysDeep(
  value: unknown,
  table: Readonly<Record<string, string>>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => renameKeysDeep(item, table));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const newKey = table[key] ?? key;
      out[newKey] = renameKeysDeep(child, table);
    }
    return out;
  }
  return value;
}

/**
 * Migrate a v8 record to a v9 record. Throws if the input is not at v8
 * (Requirement 8.7).
 */
export function migrate(record: unknown): unknown {
  if (
    record === null
    || typeof record !== "object"
    || (record as { schemaVersion?: unknown }).schemaVersion !== SOURCE_VERSION
  ) {
    throw new Error(
      `v8-to-v9 migrate: expected schemaVersion === ${SOURCE_VERSION}, got ${
        (record as { schemaVersion?: unknown } | null)?.schemaVersion
      }`,
    );
  }
  const renamed = renameKeysDeep(record, FIELD_RENAMES) as Record<string, unknown>;
  return {
    ...renamed,
    $schema: rewriteSchemaRef(renamed["$schema"], true),
    schemaVersion: TARGET_VERSION,
  };
}

/**
 * Best-effort reverse migration (Requirement 8.7, 9.7).
 *
 * Lossless on records that were produced by `migrate(...)` of a v8 record:
 * every rewrite this function performs is the exact inverse of `migrate`'s
 * forward rewrite. Lossy edge cases would arise only if `migrate` ever
 * folded two distinct v8 keys into the same v9 key — it does not — or if
 * a v9 record contained both a v8-form key and its v9-form key
 * simultaneously, which a registry-dispatched record never does.
 */
export function rollback(record: unknown): unknown {
  if (
    record === null
    || typeof record !== "object"
    || (record as { schemaVersion?: unknown }).schemaVersion !== TARGET_VERSION
  ) {
    return record;
  }
  const renamed = renameKeysDeep(record, REVERSE_FIELD_RENAMES) as Record<string, unknown>;
  return {
    ...renamed,
    $schema: rewriteSchemaRef(renamed["$schema"], false),
    schemaVersion: SOURCE_VERSION,
  };
}
