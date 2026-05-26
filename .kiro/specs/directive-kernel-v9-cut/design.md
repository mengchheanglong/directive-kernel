# Design Document

## Overview

This cut ships three coordinated changes — vocabulary diet (F4), naming consistency (F11), and run-record schema freeze (F7) — as one breaking-but-bounded v8 → v9 release of `@directive/kernel`. They ship together because they touch the same files: a vocabulary rename of `earnedAutonomy → operatorTrustScore` rewrites a JSON property key (F7's territory), a TypeScript type name (F11's territory), and the prose around it (F4's territory). Splitting them into three PRs would force three rounds of review on the same lines.

The shape of the cut is five concentric layers, from intent down to enforcement:

```
   Layer 1  Vocabulary_Audit (vocabulary-audit.csv)        ← intent: what gets renamed and why
            Naming_Audit     (naming-audit.csv)            ← intent: which types/files get renamed and why
                  │
                  │  reviewed in PR; the "what" of the cut
                  ▼
   Layer 2  Mechanical applications                        ← Requirements 2 (vocab) + 4 (naming)
            • textual rewrites (Requirements 2.1–2.7)
            • semanticRename for identifiers (Requirement 2.2 + 4.1–4.8)
            • file moves (Requirement 4.9–4.14)
                  │
                  │  these renames must not invalidate persisted v8 records
                  ▼
   Layer 3  Migration framework substrate                  ← Requirement 8
            shared/schemas/migrations/index.ts             (Schema_Migration_Registry)
            shared/schemas/migrations/v8-to-v9.ts          (V8_To_V9_Migration)
                  │
                  │  the registry exists so step 4 has somewhere to dispatch into
                  ▼
   Layer 4  Storage_Version_Check                          ← Requirement 10
            engine/storage.ts ::readRun, ::listRuns
            createMemoryDirectiveEngineStore::readRun, ::listRuns
                  │
                  │  records on disk stay readable; future versions fail loudly
                  ▼
   Layer 5  Naming_Lint_Script                             ← Requirement 11
            scripts/check-naming.ts (CI gate)
            ensures the next PR cannot quietly reintroduce a violation
```

The audits in Layer 1 are the human review surface. The renames in Layer 2 are the diff. The migration framework in Layer 3 is the substrate that lets persisted records survive Layer 2. The storage check in Layer 4 is the gate that activates the framework on every read. The lint in Layer 5 is the guardrail that keeps Layer 2's result stable as the codebase grows.

A point worth calling out for reviewers (it short-circuits a recurring question): every JSON property key rewrite in V8_To_V9_Migration's `migrate` function corresponds 1:1 to a row in Vocabulary_Rename_Set. If the audit is correct, the migration's rewrite table is correct by construction. We therefore do not carry a separate "audit correctness" property in the Correctness Properties section — the round-trip property (Property 2) catches any drift between the audit and the migration in a single test.

The locked out-of-scope list, restated from the clarify summary so reviewers don't re-litigate it: package rename (`@directive/kernel` stays), lane rename (`discovery` / `runtime` / `architecture` stay), directive-root rename, migrate-on-disk CLI, internal local variable renames, the Python `discovery/research-engine/` workspace.

## Architecture

### Test breakage strategy: staged renames within waves, not big-bang transient red

The straightforward approach is one PR with thirty mechanical edits and CI green only at the end. The recommended approach is the opposite: stage the renames into waves, each wave landing CI-green on its own. The reasoning:

- F1 ✅ done means we have a working test infrastructure. The whole point of having one is to run it after every step. Skipping that for the largest churn-y cut in the project's history would forfeit the F1 investment.
- A single 30-task PR landing red and going green at the end forces reviewers to read the diff out of order. They have to ignore intermediate breakage to evaluate whether the final state is right. Wave-based green-after-every-wave landings let reviewers pull HEAD at any wave boundary and run the tests themselves.
- Rollback is cheaper. If wave 5 introduces a regression, we revert wave 5 and the previous waves stand. With big-bang, a partial revert is hand-surgery.

The wave plan, for the tasks document to elaborate (no wave is allowed to land red):

```
   Wave 1  Migration framework substrate (Layer 3)
           Lands green: registry + V8_To_V9_Migration + property tests + storage check.
           No vocab/naming renames yet, so no test breakage.
           At this point persisted v8 records still read identically (the registry
           does nothing on a v9 record, and there are no v9 records yet).

   Wave 2  Vocabulary renames (Layer 2, vocab half)
           Lands green: textual rewrites + semanticRename for identifiers.
           Storage_Version_Check from Wave 1 means v8 record fixtures still load.
           Property tests from Wave 1 catch any rename slip in the migration.

   Wave 3  Naming renames + file moves (Layer 2, naming half)
           Lands green: type renames, function renames, file moves, package.json
           exports retargeting. typecheck pass + check:build is the gate.

   Wave 4  Schema URI flip + version bump
           Lands green: $id rewrite in run-record.schema.json, version bump in
           engine/types.ts (8 → 9), package.json 0.1.x → 0.2.0, hardening tests
           added.

   Wave 5  Documentation + lint
           Lands green: GLOSSARY.md, CONTRIBUTING.md naming rules section,
           shared/contracts/schema-versioning.md, scripts/check-naming.ts,
           tests/unit/check-naming.test.ts, ci.yml step.
```

Within each wave, the tasks are sequential. Across waves, ordering is enforced by the dependency arrows above: Wave 1 must land before Wave 2 because Wave 2's vocab renames mutate field names that v8-record fixtures still read; without Wave 1's storage check, Wave 2 breaks every test that loads a v8 fixture.

### Vocabulary audit CSV layout (Requirement 1)

The header row is exactly:

```
term,proposed_replacement,disposition,file_count,rationale
```

Two example rows per disposition. `disposition=rename`:

```
earned autonomy,operator trust score,rename,17,Metaphor; replace with plain-English term that names what the score measures.
gap radar,open gaps view,rename,9,UI-borrowed metaphor; "view" matches the projection layer it lives in.
```

`disposition=keep`:

```
process,process,keep,0,Standard English; no synonym would be clearer.
artifact,artifact,keep,0,Used consistently throughout shared/contracts; no replacement candidate.
```

`disposition=do-not-touch`:

```
mission,,do-not-touch,0,Locked term per Do_Not_Touch_Term_Set; mission appears in DIRECTIVE_GOAL.md as a load-bearing concept.
kernel,,do-not-touch,0,Locked term per Do_Not_Touch_Term_Set; the package is @directive/kernel.
```

`file_count` for `disposition=rename` rows is generated by ripgrep, scoped to skip the do-not-touch directories:

```bash
pnpm exec rg --files-with-matches --case-sensitive \
  --glob '!dist/**' --glob '!ui/**' \
  --glob '!discovery/research-engine/**' --glob '!node_modules/**' \
  --glob '!vocabulary-audit.csv' --glob '!naming-audit.csv' \
  -- '<term>' | wc -l
```

`file_count` for `keep` and `do-not-touch` rows is `0` (per Requirement 1.7, readers must not rely on the value for non-rename rows; we standardize on `0` rather than empty so the column always parses as integer). Cells contain no commas and no embedded newlines per Requirement 1.8; multi-word values use spaces.

The audit covers (Requirement 1.5): every term in Vocabulary_Rename_Set, every term in Do_Not_Touch_Term_Set, plus every additional domain term currently used in `shared/contracts/`, `engine/types.ts`, and lane README files (`discovery/README.md`, `runtime/README.md`, `architecture/README.md`, and their `lib/README.md` siblings).

### Naming audit CSV layout (Requirement 3)

The header row is exactly:

```
current_name,proposed_name,kind,disposition,caller_count,rationale
```

Example rows for each `kind`. `kind=type`:

```
DirectiveEngineRunRecord,RunRecord,type,rename,42,Folder + brand collision; the type lives in engine/ and is exported as @directive/kernel; "Engine" and "Directive" are redundant.
DirectiveEngineSourceItem,EngineSourceItem,type,rename,18,Brand prefix is redundant inside the kernel; the lane folder still tags the export from the consumer side.
```

`kind=function`:

```
requireDirectiveExplicitApproval,requireExplicitApproval,function,rename,11,Brand prefix is redundant; the function lives in engine/approval-boundary.ts and is exported through the engine subpath.
requireDirectiveIntegrityForOpening,requireIntegrityForOpening,function,rename,7,Brand prefix is redundant; same reasoning as the explicit-approval guard.
```

`kind=file`:

```
discovery/lib/front-door/discovery-front-door.ts,discovery/lib/front-door/index.ts,file,rename,6,Folder-prefix repeat; the file IS the front door and should be the index of its folder.
runtime/lib/openers/runtime-runtime-capability-boundary-promotion-readiness-opener.ts,runtime/lib/openers/promotion-readiness.ts,file,rename,3,Double-prefix offender; "runtime-runtime" repeats the lane folder twice.
```

`kind=schema-file`:

```
shared/schemas/directive-engine-run-record.schema.json,shared/schemas/run-record.schema.json,schema-file,rename,8,Brand prefix is redundant; the file lives under shared/schemas which already brands the contracts surface.
```

`caller_count` generation rules (Requirement 3.7, 3.8):

- For `kind=type` and `kind=function`, `caller_count` is the number of non-declaration import sites:

  ```bash
  pnpm exec rg --files-with-matches --case-sensitive \
    --glob '!dist/**' --glob '!ui/**' \
    --glob '!discovery/research-engine/**' --glob '!node_modules/**' \
    -- '<current_name>' \
    | xargs pnpm exec rg --case-sensitive --count-matches '<current_name>' \
    | awk -F: '{ sum += $2 } END { print sum }'
  ```

  …minus the declaration-site occurrences (1 for a single `export` declaration, 2 if the symbol has a `type` and a `const` declaration). The audit row records the post-subtraction count.

- For `kind=file` and `kind=schema-file`, `caller_count` is the number of non-self files containing the relative path:

  ```bash
  pnpm exec rg --files-with-matches --fixed-strings \
    --glob '!dist/**' --glob '!ui/**' \
    --glob '!discovery/research-engine/**' --glob '!node_modules/**' \
    -- '<relative-path>' \
    | grep -v '^<relative-path>$' \
    | wc -l
  ```

`disposition` takes one of `rename` (apply this row), `keep` (intentionally not renamed; rationale required), or `prohibited-pattern` (the row exists to document a violating shape that has already been removed; rationale records the canonical replacement).

### Migration framework module shape (Requirement 8)

The registry is a single TypeScript module that exports a record keyed by source schema version. Adding a future migration is two changes: drop in `v9-to-v10.ts`, add one entry to the registry.

`shared/schemas/migrations/index.ts`:

```ts
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
```

`shared/schemas/migrations/v8-to-v9.ts`:

```ts
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

const FIELD_RENAMES: Readonly<Record<string, string>> = {
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
```

A future `v9-to-v10.ts` plugs in by exporting the same `migrate`/`rollback` pair (with `SOURCE_VERSION = 9` and `TARGET_VERSION = 10`) and adding `9: v9ToV10` to the registry. No other change is required (Requirement 8.6).

### Storage version check (Requirement 10)

The check is one helper, called from two read paths in each store. The helper:

```ts
// engine/storage.ts — internal helper. Co-located with the store
// implementations because the registry import lives in this file.

import { applyRunRecordMigrationChain } from "../shared/schemas/migrations/index.ts";
import {
  DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION,
  type DirectiveEngineRunRecord,
} from "./types.ts";

/**
 * Storage_Version_Check (Requirement 10).
 *
 * Returns the record at Current_Schema_Version, applying any registered
 * migrations on the way. Throws on future versions and on missing
 * migration chains. Never mutates the input or any on-disk file
 * (Requirement 10.8).
 */
function readThroughVersionCheck(record: unknown): DirectiveEngineRunRecord {
  if (record === null || typeof record !== "object") {
    throw new Error("schema_version_unreadable: record is not an object");
  }
  const version = (record as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new Error(
      `schema_version_unreadable: schemaVersion is missing or non-integer (got ${typeof version})`,
    );
  }
  const current = DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION;
  if (version === current) return record as DirectiveEngineRunRecord;
  if (version > current) {
    throw new Error(
      `schema_version_future: record is v${version}, kernel supports up to v${current}`,
    );
  }
  // version < current: walk the chain. applyRunRecordMigrationChain throws
  // schema_version_unmigratable: on a missing link.
  return applyRunRecordMigrationChain(record, version, current) as DirectiveEngineRunRecord;
}
```

Both `readRun` and `listRuns` get the same wrapper — one helper, two call sites — because both return persisted records to callers and persisted records can be at any past version. Forgetting one path would let stale records slip through; doing the same wrapping inline twice would duplicate the error-message contract:

```ts
// engine/storage.ts → createFilesystemDirectiveEngineStore (line ~179):
    readRun(runId) {
      // ...existing path lookup...
      const raw = JSON.parse(fs.readFileSync(indexedPath, "utf-8")) as unknown;
      return readThroughVersionCheck(raw);
    },

// engine/storage.ts → createFilesystemDirectiveEngineStore (line ~198):
    listRuns() {
      return listRunsFromFilesystemCache().map(readThroughVersionCheck);
    },

// engine/storage.ts → createMemoryDirectiveEngineStore (line ~221):
    readRun(runId) {
      const found = records.find((record) => record.runId === runId) ?? null;
      return found ? readThroughVersionCheck(found) : null;
    },

// engine/storage.ts → createMemoryDirectiveEngineStore (line ~224):
    listRuns() {
      return records.map(readThroughVersionCheck);
    },
```

Why both call sites in both stores: the in-memory store is the one tests reach for, so a check-only-on-filesystem implementation would let property and hardening tests pass while filesystem-backed deployments fail differently. Same wrapper, four call sites, one bug class eliminated.

Per Requirement 10.8, `readThroughVersionCheck` does not mutate the input; the file path-based store returns a freshly parsed object on every read, so on-disk bytes are untouched. The hardening test for the v8 case asserts this explicitly (read twice, byte-compare the file).

### V8 → V9 migration content (Requirement 9)

JSON property-key rewrites, camelCase form for object keys (Requirement 9.3):

| v8 key (LHS)              | v9 key (RHS)             | Source: Vocabulary_Rename_Set    |
| ------------------------- | ------------------------ | -------------------------------- |
| `earnedAutonomy`          | `operatorTrustScore`     | earned autonomy → operator trust score |
| `gapRadar`                | `openGapsView`           | gap radar → open gaps view       |
| `narrativeThreading`      | `sourceThreadContext`    | narrative threading → source thread context |
| `deepTail`                | `materializationTail`    | deep tail → materialization tail |
| `legalNextSeams`          | `allowedNextSteps`       | legal next seams → allowed next steps |
| `forbiddenScopeExpansion` | `outOfScope`             | forbidden scope expansion → out of scope |
| `boundedCloseout`         | `closeout`               | bounded closeout → closeout      |
| `integrityGate`           | `integrityCheck`         | integrity gate → integrity check |

Every entry above is a 1:1 reflection of a Vocabulary_Rename_Set row. This is the load-bearing entailment from the audit to the migration: if the audit is correct, this table is correct by construction (Requirement 9.3).

`$schema` URI rewrites (Requirement 9.4), preserving relative-vs-absolute form:

| Form     | v8                                                                                       | v9                                                                            |
| -------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Relative | `shared/schemas/directive-engine-run-record.schema.json`                                 | `shared/schemas/run-record.schema.json`                                       |
| Absolute | `https://directive-workspace.dev/schemas/directive-engine-run-record.schema.json`        | `https://directive-workspace.dev/schemas/run-record.schema.json`              |

`schemaVersion` is set to `9` on the result (Requirement 9.5). Every other field is preserved by identity (Requirement 9.6): `recordKind`, `runId`, all timestamps, `source`, `selectedLane`, `outputs`, etc. Nested fields are walked recursively by `renameKeysDeep`, so nested keys named `earnedAutonomy` (etc.) are also rewritten.

`rollback` reverses every `migrate` rewrite:

- The field-rename table is bijective (no two v8 keys collide on a single v9 key), so `REVERSE_FIELD_RENAMES = inverse(FIELD_RENAMES)` is well-defined and lossless.
- The `$schema` URI rewrite is bijective on the four documented values; on any other string `$schema` value, both functions pass it through unchanged.
- `schemaVersion` returns to `8`.

What `rollback` cannot reverse: there are no fields whose v8 form `migrate` discards, so the migration is essentially shape-preserving. The only theoretical loss is if a v9 record contains a v8-form key (e.g., a literal `earnedAutonomy` that survived through some external write); `rollback` would then produce a record with both keys, which our generator never produces. The header comment in `v8-to-v9.ts` flags this corner case for honesty (Requirement 9.7's "MAY mark the result as partial in a comment").

### CI naming-lint script (Requirement 11)

Four regex rules, each with a positive (flagged) and negative (not flagged) example.

Rule 1 — `^directive-` filename prefix is forbidden in the kernel (Requirement 11.3):

- Positive: `discovery/lib/intake/directive-intake-queue.ts` → flagged.
- Negative: `discovery/lib/intake/intake-queue.ts` → not flagged.

Rule 2 — A file's basename must not start with the immediate parent folder name plus `-` (Requirement 11.4):

- Positive: `runtime/lib/openers/openers-follow-up.ts` → flagged.
- Negative: `runtime/lib/openers/follow-up.ts` → not flagged.

Rule 3 — An exported TypeScript type/interface/class/function must not match `^Directive[A-Z]` (Requirement 11.5):

- Positive: `export interface DirectiveEngineRunRecord { ... }` → flagged.
- Negative: `export interface RunRecord { ... }` → not flagged.

Rule 4 — A basename must not match `^<prefix>-<prefix>-` (double-prefix offender; Requirement 11.6):

- Positive: `runtime/lib/openers/runtime-runtime-capability-boundary-promotion-readiness-opener.ts` → flagged.
- Negative: `runtime/lib/openers/promotion-readiness.ts` → not flagged.

The allowlist for known-grandfathered exports (Requirement 11.5 parenthetical):

```ts
// scripts/check-naming.ts
//
// Allowlist of files in which a `Directive`-prefixed exported symbol is
// permitted. Add an entry here ONLY when the symbol is part of a
// pre-existing public-surface contract that cannot be renamed in the
// current cut, and add a Fix_Plan reference explaining the deferral.
//
// Empty after the v8 → v9 cut lands.
export const DIRECTIVE_PREFIX_ALLOWLIST: ReadonlyArray<string> = [
  // "engine/types.ts",      // example; entry removed in this cut
] as const;
```

Test fixture pattern for `tests/unit/check-naming.test.ts` (Requirement 11.11):

```ts
// tests/unit/check-naming.test.ts
import { describe, it, expect } from "vitest";
import { scanForNamingViolations } from "../../scripts/check-naming.ts";

const FIXTURE = {
  "discovery/lib/intake/directive-intake-queue.ts":
    "export interface IntakeQueue {}",                         // Rule 1
  "runtime/lib/openers/openers-follow-up.ts":
    "export const followUp = () => {};",                        // Rule 2
  "engine/types.ts":
    "export interface DirectiveEngineRunRecord { runId: string }", // Rule 3
  "runtime/lib/openers/runtime-runtime-capability.ts":
    "export const x = 1;",                                      // Rule 4
  "runtime/lib/openers/follow-up.ts":
    "export const ok = () => {};",                              // Negative
};

describe("check-naming", () => {
  it("fires each rule exactly once on its target", () => {
    const violations = scanForNamingViolations(FIXTURE);

    const byRule = (rule: string) => violations.filter((v) => v.rule === rule);
    expect(byRule("directive-prefix-filename")).toHaveLength(1);
    expect(byRule("folder-prefix-filename")).toHaveLength(1);
    expect(byRule("directive-prefix-export")).toHaveLength(1);
    expect(byRule("double-prefix-filename")).toHaveLength(1);
    expect(violations).toHaveLength(4);
  });
});
```

The script's CLI entry point reads the real file tree and exits non-zero on any violation (Requirement 11.7, 11.8); the exported `scanForNamingViolations` helper takes a synthetic file map for unit testing. The CI job adds `pnpm run check:naming` between `typecheck` and `test` in `.github/workflows/ci.yml` (Requirement 11.10).

### `package.json` exports update strategy (Requirement 13)

Subpath keys affected by Naming_Rename_Table:

- `./discovery/front-door` — already points at `discovery/lib/front-door/index.ts`. After Requirement 4.9 renames `discovery-front-door.ts` → `index.ts`, the existing exports entry is correct because it already uses `index.ts`. No change required, but the on-disk target file is now the renamed-into one. (The audit row exists to document the rename; the exports map happens to already use the canonical pattern.)
- `./runtime/openers` — points at `runtime/lib/openers/index.ts`. Same situation: the directory-level barrel exists; what changes is the per-file basenames inside it (`runtime-follow-up-opener.ts` → `follow-up.ts`, etc.), not the exports key target.
- Any subpath key that points directly at a renamed file (rather than at a folder's `index.ts`) — these are the entries that need before/after rewriting.

Before/after for an example direct-target entry. If a key like `./schemas/run-record` ever points at the schema file (it does not today, but the schema-versioning policy says it should be exposed for tooling), the rule is:

```jsonc
// before
"./schemas/run-record": {
  "development": "./shared/schemas/directive-engine-run-record.schema.json",
  "types":       "./dist/shared/schemas/directive-engine-run-record.schema.json",
  "import":      "./dist/shared/schemas/directive-engine-run-record.schema.json",
  "default":     "./dist/shared/schemas/directive-engine-run-record.schema.json"
}
```

```jsonc
// after
"./schemas/run-record": {
  "development": "./shared/schemas/run-record.schema.json",
  "types":       "./dist/shared/schemas/run-record.schema.json",
  "import":      "./dist/shared/schemas/run-record.schema.json",
  "default":     "./dist/shared/schemas/run-record.schema.json"
}
```

The rule, applied to every renamed-target entry: every condition (`development`, `types`, `import`, `default`) is retargeted in lockstep. A condition retargeted in isolation is a regression — `development` resolves to a TS path, `default` resolves to the compiled JS path, but both must point at the same logical module on each side of the rename (Requirement 13.1, 13.4).

The set of subpath keys is preserved (Requirement 13.3) — no key added, no key removed. After the cut, `pnpm run check:build` (Requirement 13.5) verifies every retargeted condition resolves from `dist/`.


### Schema versioning policy doc outline (Requirement 7)

`shared/contracts/schema-versioning.md` skeleton:

```markdown
# Schema versioning policy

This document is the source of truth for how `@directive/kernel` versions
its persisted-record JSON Schemas, what migrations it ships, and what
URI continuity adopters can expect across versions.

## Version-bump rule

The integer in `schemaVersion` (and, for the run record, the constant
`DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` exported from
`engine/types.ts`) increments by exactly one when any of the following
applies to the schema:

- a required field is renamed
- a required field is removed
- a required field has its type narrowed

New optional fields MAY be added without a version bump. (Requirement 7.2.)

## Migration requirement

Every version bump SHALL ship a corresponding migration module under
`shared/schemas/migrations/` named `v<source>-to-v<target>.ts`, registered
in the Schema_Migration_Registry at `shared/schemas/migrations/index.ts`.
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
```

### `GLOSSARY.md` outline (Requirement 5)

`GLOSSARY.md` skeleton:

```markdown
# Glossary

This document is the source of truth for kernel-internal vocabulary.
Every term defined here is either a Vocabulary_Rename_Set target (a term
introduced or kept by the v8 → v9 cut) or a Do_Not_Touch_Term_Set entry
(a term locked from renaming for project-history reasons). The audit at
[`vocabulary-audit.csv`](./vocabulary-audit.csv) records the disposition
of every term considered for renaming; this glossary is the human-
readable companion to that audit.

## Terms

(Alphabetical by term. One sentence per definition. Each entry links to
the canonical source file or README within the repository where the
term is defined or first used in code form.)

- **Allowed next steps**: The set of next-step seam options available to
  an opener at a given lifecycle stage; replaces "legal next seams". See
  [`runtime/lib/openers/README.md`](./runtime/lib/openers/README.md).
- **Architecture**: The lane that holds long-horizon decisions and
  artifacts; locked term per Do_Not_Touch_Term_Set. See
  [`architecture/README.md`](./architecture/README.md).
- **Closeout**: The terminal lifecycle stage of an experiment or
  architecture cycle; replaces "bounded closeout". See
  [`architecture/lib/experiments/architecture-closeout.ts`](./architecture/lib/experiments/architecture-closeout.ts).
- **Discovery**: The lane that turns sources into shaped intake records;
  locked term per Do_Not_Touch_Term_Set. See
  [`discovery/README.md`](./discovery/README.md).
- **Directive root**: The on-disk workspace folder a kernel host reads
  and writes; locked term per Do_Not_Touch_Term_Set. See
  [`engine/storage.ts`](./engine/storage.ts).
- **Integrity check**: The pre-opener guard that confirms a directive
  root's referenced artifacts exist on disk; replaces "integrity gate".
  See [`engine/approval-boundary.ts`](./engine/approval-boundary.ts).
- **Kernel**: The root TypeScript package `@directive/kernel`; locked
  term. See [`README.md`](./README.md).
- **Lane**: A top-level workspace member of the kernel
  (`discovery`/`runtime`/`architecture`); locked term. See
  [`engine/directive-workspace-lanes.ts`](./engine/directive-workspace-lanes.ts).
- **Materialization tail**: The post-experiment phase where consumption
  is recorded and integration is materialized; replaces "deep tail". See
  [`architecture/lib/control/materialization-tail-stage-map.ts`](./architecture/lib/control/materialization-tail-stage-map.ts).
- **Mission**: The top-level intent that frames a kernel run; locked
  term per Do_Not_Touch_Term_Set. See
  [`engine/mission/`](./engine/mission/).
- **Open gaps view**: The projection that surfaces unaddressed capability
  gaps to operators; replaces "gap radar". See
  [`discovery/lib/gaps/`](./discovery/lib/gaps/).
- **Operator trust score**: The numeric score that gates how much
  initiative an opener can take without re-confirmation; replaces
  "earned autonomy". See [`runtime/lib/`](./runtime/lib/).
- **Out of scope**: An explicit boundary marker on the items a cut will
  not touch; replaces "forbidden scope expansion". See
  [`Fix_Plan.md`](./Fix_Plan.md).
- **Runtime**: The lane that runs experiments under operator review;
  locked term per Do_Not_Touch_Term_Set. See
  [`runtime/README.md`](./runtime/README.md).
- **Source thread context**: The chain of source signals that informed a
  routing decision; replaces "narrative threading". See
  [`engine/process-source-record.ts`](./engine/process-source-record.ts).

(... one entry for every Vocabulary_Audit row whose disposition is
`rename` (using the post-rename term), `keep`, or `do-not-touch`, in
alphabetical order. Requirement 5.3, 5.4, 5.5.)
```

The repo `README.md` adds a section that points at the glossary (Requirement 5.6) — a single paragraph plus a link is sufficient.

### `CONTRIBUTING.md` naming-rules outline (Requirement 6)

`CONTRIBUTING.md` skeleton (the four rules per Requirement 6):

```markdown
## Naming rules

These rules are enforced by [`scripts/check-naming.ts`](./scripts/check-naming.ts),
wired into CI as a required step. Run it locally with:

    pnpm run check:naming

(Requirement 6.6.)

1. **No `Directive` type-name prefix and no `directive-` filename
   prefix inside the kernel.** Below the repository root, exported
   TypeScript types/interfaces/classes/functions whose name matches
   `^Directive[A-Z]` and TypeScript files whose basename matches
   `^directive-` are flagged. The package is already named
   `@directive/kernel`; repeating the brand inside the package adds noise
   without adding meaning. (Requirement 6.3.)

2. **A file's basename does not repeat its immediate parent folder name
   as a prefix.** A file under `runtime/lib/openers/` whose basename
   starts with `openers-` is flagged; a file under
   `runtime/lib/openers/` whose basename starts with `runtime-runtime-`
   is flagged as a double-prefix offender. The folder already provides
   the namespace. (Requirement 6.4.)

3. **JSON Schema files in `shared/schemas/` use unprefixed shape names.**
   The canonical name is `run-record.schema.json`, not
   `directive-engine-run-record.schema.json`; the `shared/schemas/`
   folder already brands the contracts surface. (Requirement 6.5.)

4. **Schema constants and exported types in `engine/types.ts` follow
   rules 1–3.** The constant
   `DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` is permitted as the
   single grandfathered identifier for the v8 → v9 cut and removed from
   the allowlist when its consumers migrate to a renamed export.

See [`GLOSSARY.md`](./GLOSSARY.md) for the kernel's vocabulary and
[`shared/contracts/schema-versioning.md`](./shared/contracts/schema-versioning.md)
for the schema-versioning policy. (Requirement 6.7.)
```

### Hardening test outline (Requirement 15)

Table-driven cases under `tests/integration/hardening/schema-version-check.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  createMemoryDirectiveEngineStore,
  createFilesystemDirectiveEngineStore,
} from "../../../engine/storage.ts";
import { DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION } from "../../../engine/types.ts";

interface Case {
  readonly name: string;
  readonly recordVersion: number;
  readonly assert: (read: () => unknown, fileBytes?: () => Buffer) => void;
}

const CASES: readonly Case[] = [
  {
    name: "v7 refuse: schema_version_unmigratable: with both versions",
    recordVersion: 7,
    assert: (read) => {
      expect(read).toThrowError(
        /^schema_version_unmigratable:.*v7.*v9/,
      );
    },
  },
  {
    name: "v8 migrate: returns v9 with renamed fields and rewritten $schema",
    recordVersion: 8,
    assert: (read, fileBytes) => {
      const before = fileBytes?.();
      const result = read() as Record<string, unknown>;
      expect(result.schemaVersion).toBe(9);
      expect(result.operatorTrustScore).toBeDefined();
      expect(result.earnedAutonomy).toBeUndefined();
      expect(result.$schema).toMatch(/run-record\.schema\.json$/);
      // Requirement 10.8 / 15.3 — on-disk file is not mutated.
      const after = fileBytes?.();
      if (before && after) expect(before.equals(after)).toBe(true);
    },
  },
  {
    name: "v9 pass-through: returns the record unchanged on every field",
    recordVersion: 9,
    assert: (read) => {
      const result = read() as Record<string, unknown>;
      expect(result.schemaVersion).toBe(DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION);
      // (Full deep-equal against the seeded record is performed by the
      //  driver below.)
    },
  },
  {
    name: "v10 refuse-future: schema_version_future: with both versions",
    recordVersion: 10,
    assert: (read) => {
      expect(read).toThrowError(
        /^schema_version_future:.*v10.*v9/,
      );
    },
  },
];

describe("Storage_Version_Check (hardening)", () => {
  for (const c of CASES) {
    it(`memory store: ${c.name}`, () => {
      // ...build a record at c.recordVersion, seed createMemoryDirectiveEngineStore,
      //    pass () => store.readRun(runId) to c.assert.
    });
    it(`filesystem store: ${c.name}`, () => {
      // ...write the record JSON to a tmp directive-root, seed
      //    createFilesystemDirectiveEngineStore, pass () => store.readRun(runId)
      //    and a fileBytes thunk to c.assert.
    });
  }
});
```

Each case is exercised against both `createMemoryDirectiveEngineStore` and the filesystem store, and against both `readRun` and `listRuns` (the case driver calls each method and re-asserts) — Requirement 15 requires the four documented behaviors to hold on every read path (Requirements 10.6, 10.7).

## Components and Interfaces

### Surface-affecting components

- `shared/schemas/migrations/index.ts` — Schema_Migration_Registry. Exports `runRecordMigrations` and `applyRunRecordMigrationChain`. Imported by `engine/storage.ts`.
- `shared/schemas/migrations/v8-to-v9.ts` — V8_To_V9_Migration. Exports `migrate(record): unknown` and `rollback(record): unknown`.
- `shared/schemas/run-record.schema.json` — the v9 schema file. `$id` is `https://directive-workspace.dev/schemas/run-record.schema.json`. The previous file `shared/schemas/directive-engine-run-record.schema.json` is deleted in this cut (no redirect).
- `engine/storage.ts` — gains the `readThroughVersionCheck` helper and four call-site wraps (two stores × two read methods).
- `engine/types.ts` — `DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` flips from `8` to `9`. The schema-ref constant flips from `directive-engine-run-record.schema.json` to `run-record.schema.json`. The exported type alias for the schema-version union widens its history-aware type to `8 | 9`. The exported type `DirectiveEngineRunRecord` is renamed to `RunRecord` (Requirement 4.6) with every importer transitively updated.
- `scripts/check-naming.ts` — Naming_Lint_Script. Exports `scanForNamingViolations(files: Record<string, string>): Violation[]`. The CLI entry point reads the real file tree and exits non-zero on any violation.
- `package.json` — `version` flips from `0.1.x` to `0.2.0`; `exports` map keys are preserved, targets are retargeted; a new `check:naming` script is added.
- `.github/workflows/ci.yml` — adds a `check:naming` step between `typecheck` and `test`.

### Documentation deliverables

- `GLOSSARY.md` (repo root) — Requirement 5.
- `CONTRIBUTING.md` (repo root) — Requirement 6.
- `shared/contracts/schema-versioning.md` — Requirement 7.
- `vocabulary-audit.csv` (repo root) — Requirement 1.
- `naming-audit.csv` (repo root) — Requirement 3.

### Test deliverables

- `tests/property/v8-to-v9-migration.property.test.ts` — Requirement 14.1, 14.2 (Properties 1, 2).
- `tests/property/storage-version-check.property.test.ts` — Requirement 14.3, 14.4 (Properties 3, 4, 5).
- `tests/integration/hardening/schema-version-check.test.ts` — Requirement 15.
- `tests/unit/check-naming.test.ts` — Requirement 11.11.
- `tests/integration/vocabulary-sweep.test.ts` — Requirement 2.7 (this is a code-shape invariant test, not a Correctness Property; it scans the repo for residual LHS occurrences outside the documented allowlist).

## Data Models

### v8 record (input to V8_To_V9_Migration)

```ts
interface V8Record {
  readonly $schema:
    | "shared/schemas/directive-engine-run-record.schema.json"
    | "https://directive-workspace.dev/schemas/directive-engine-run-record.schema.json";
  readonly schemaVersion: 8;
  readonly recordKind: "directive_engine_run_record";
  readonly runId: string;
  readonly receivedAt: string;
  readonly source: { /* ... */ };
  readonly selectedLane: { /* ... */ };
  // Vocabulary_Rename_Set keys present at v8:
  readonly earnedAutonomy?: number;
  readonly gapRadar?: { /* ... */ };
  readonly narrativeThreading?: ReadonlyArray<{ /* ... */ }>;
  readonly deepTail?: { /* ... */ };
  readonly legalNextSeams?: ReadonlyArray<string>;
  readonly forbiddenScopeExpansion?: ReadonlyArray<string>;
  readonly boundedCloseout?: { /* ... */ };
  readonly integrityGate?: { /* ... */ };
  // ...other fields preserved by identity through the migration.
}
```

### v9 record (output of V8_To_V9_Migration; Current_Schema_Version shape)

```ts
interface RunRecord {
  readonly $schema:
    | "shared/schemas/run-record.schema.json"
    | "https://directive-workspace.dev/schemas/run-record.schema.json";
  readonly schemaVersion: 9;
  readonly recordKind: "directive_engine_run_record";
  readonly runId: string;
  readonly receivedAt: string;
  readonly source: { /* ... */ };
  readonly selectedLane: { /* ... */ };
  readonly operatorTrustScore?: number;
  readonly openGapsView?: { /* ... */ };
  readonly sourceThreadContext?: ReadonlyArray<{ /* ... */ }>;
  readonly materializationTail?: { /* ... */ };
  readonly allowedNextSteps?: ReadonlyArray<string>;
  readonly outOfScope?: ReadonlyArray<string>;
  readonly closeout?: { /* ... */ };
  readonly integrityCheck?: { /* ... */ };
  // ...other fields identical to v8.
}
```

The "lossless field set" used by Properties 1 and 2 is defined as the union of:

- every field at the top level of the record whose key is **not** a Vocabulary_Rename_Set left-hand side
- every Vocabulary_Rename_Set field, observed under its v9 (right-hand-side) key after migration

Equivalently: every field of the record, where the migration's renames are interpreted as a relabelling rather than a value change. This is the field set on which `migrate` is structurally lossless and on which `rollback ∘ migrate` is the identity.

## Error Handling

The Storage_Version_Check produces three error families with stable prefixes for callers to match on:

| Prefix                          | Condition                                                              | Requirement |
| ------------------------------- | ---------------------------------------------------------------------- | ----------- |
| `schema_version_future:`        | `record.schemaVersion > Current_Schema_Version`                        | 10.5        |
| `schema_version_unmigratable:`  | `record.schemaVersion < Current_Schema_Version` and chain has a gap    | 10.4        |
| `schema_version_unreadable:`    | `record` is not an object, or `schemaVersion` is missing/non-integer   | (defensive) |

Each message includes both the source and target version integers so an operator reading a log can immediately see the gap. The `schema_version_unmigratable:` message is produced inside `applyRunRecordMigrationChain` so storage code can rethrow without re-wrapping (consistent error contract regardless of which migration in the chain is missing).

The migration's `migrate` function throws on a wrong-version input (Requirement 8.7) — this is a programmer-error path; the storage check never invokes `migrate` with the wrong version. The thrown message starts with `v8-to-v9 migrate:` so it is distinguishable from the storage-layer error families above.

The Naming_Lint_Script exits with code `0` on zero violations and code `1` on at least one violation (Requirement 11.7, 11.8); each violation is written as `<rule>: <file>: <detail>` to stderr (Requirement 11.8).

## Out of Scope

Restated from the clarify summary so reviewers don't re-litigate it during PR review:

- **Package rename** — `@directive/kernel` stays. Renaming the package would force a downstream-consumer dance with no payoff for the goals of this cut.
- **Lane rename** — `discovery`, `runtime`, `architecture` stay. The lane vocabulary is load-bearing in `DIRECTIVE_GOAL.md` and the lane READMEs.
- **`mission` and `kernel` rename** — locked terms per Do_Not_Touch_Term_Set.
- **Directive-root rename** — locked term; the on-disk concept name is in `DIRECTIVE_GOAL.md` and changing it is a separate cut.
- **Migrate-on-disk CLI** — migration runs in-flight at read time only. A CLI that rewrites persisted v8 files in place is a future Fix_Plan item; the storage check makes the in-flight path correct, so the CLI is a convenience rather than a correctness fix.
- **Internal local variable renames** — non-exported local variables that do not mirror a renamed export are out of scope per Requirement 4.15. Their renaming is mechanical busywork that does not change the public surface and would balloon the diff.
- **Python `discovery/research-engine/` workspace** — TypeScript renames do not propagate into the Python workspace. The vocabulary diet stops at the workspace boundary.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

A note on coverage before the properties: every JSON property-key rewrite in V8_To_V9_Migration's `migrate` function maps 1:1 to a row in Vocabulary_Rename_Set. The audit row's correctness and the migration row's correctness are the same fact viewed from two angles. We therefore do **not** carry a separate "audit correctness" property: Property 2 below (round-trip lossless) is statistically sufficient to catch any drift between the audit and the migration's rewrite table. If the audit ever falls out of sync with the migration, Property 2 fails on the first generated record that contains the drifted key.

### Property 1: V8 → V9 migration is structurally lossless on the lossless field set

*For any* v8-shaped run record `r` (generated by `fast-check` with arbitrary values for every field, including all eight Vocabulary_Rename_Set keys and both relative- and absolute-form `$schema` URIs), the result `migrate(r)` is a v9-shaped record such that:

- every key in `r` whose name is **not** in Vocabulary_Rename_Set is present in `migrate(r)` with a deep-equal value
- every key in `r` whose name **is** in Vocabulary_Rename_Set is present in `migrate(r)` under its v9-renamed name with a deep-equal value
- `migrate(r).schemaVersion === 9`
- `migrate(r).$schema` is the v9-form URI in the same relative-vs-absolute form as `r.$schema`

**Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 14.1.**

### Property 2: V8 → V9 migration is round-trip lossless on the lossless field set

*For any* v8-shaped run record `r`, `rollback(migrate(r))` is deep-equal to `r` on the lossless field set (the field set defined under "Data Models" above). Equivalently, `rollback ∘ migrate ≡ id` on records that satisfy the v8 schema.

**Validates: Requirements 9.7, 14.2.**

### Property 3: Storage version check passes through records at Current_Schema_Version unchanged

*For any* v9-shaped run record `r` (with `r.schemaVersion === DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION`), seeding `r` into either `createMemoryDirectiveEngineStore` or the filesystem-backed store and calling `readRun(r.runId)` returns a value deep-equal to `r`, and calling `listRuns()` returns an array containing a value deep-equal to `r`.

**Validates: Requirements 10.1, 10.2, 10.6, 10.7, 14.4.**

### Property 4: Storage version check rejects future-version records with `schema_version_future:`

*For any* synthetically constructed run record `r` with `r.schemaVersion === v` where `v > DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` (we generate `v` from `fc.integer({ min: current + 1, max: current + 50 })`), `readRun(r.runId)` and `listRuns()` each throw an error whose message starts with `schema_version_future:` and whose message contains both `v` and the current schema version as substrings.

**Validates: Requirements 10.5, 15.5.**

### Property 5: Storage version check rejects unmigratable records with `schema_version_unmigratable:`

*For any* synthetically constructed run record `r` with `r.schemaVersion === v` where `v < DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` and no chain of migrations from `v` to the current version exists in `runRecordMigrations` (in this cut, that means any `v < 8`; we generate `v` from `fc.integer({ min: 0, max: 7 })`), `readRun(r.runId)` and `listRuns()` each throw an error whose message starts with `schema_version_unmigratable:` and whose message contains both `v` and the current schema version as substrings.

**Validates: Requirements 10.4, 14.3, 15.2.**

## Testing Strategy

### Unit tests

- `tests/unit/check-naming.test.ts` — Requirement 11.11; one fixture per rule.
- Per-helper tests for `renameKeysDeep` and `rewriteSchemaRef` if the property tests don't transitively cover them with sufficient density (the property tests do exercise both, so dedicated unit tests are optional).

### Property tests

Each test in `tests/property/` runs at least 100 generated examples (Requirement 14.5). Each test uses the tag pattern already used by the F1 / F15 property tests:

```ts
// tests/property/v8-to-v9-migration.property.test.ts
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { migrate, rollback } from "../../shared/schemas/migrations/v8-to-v9.ts";
import { v8RecordArb } from "./_arbitraries/run-record.ts";

describe("v8-to-v9 migration", () => {
  // Property 1: V8 → V9 migration is structurally lossless on the lossless field set.
  // Design: design.md → "Correctness Properties → Property 1".
  // Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 14.1.
  it("Property 1: migrate(v8) is structurally lossless on the lossless field set", () => {
    fc.assert(
      fc.property(v8RecordArb, (record) => {
        // ...assertions per Property 1.
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
        // ...assertions per Property 2.
      }),
      { numRuns: 100 },
    );
  });
});
```

```ts
// tests/property/storage-version-check.property.test.ts
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { createMemoryDirectiveEngineStore } from "../../engine/storage.ts";
import { DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION } from "../../engine/types.ts";
import { v9RecordArb, recordAtVersionArb } from "./_arbitraries/run-record.ts";

describe("storage version check", () => {
  // Property 3: Storage version check passes through records at Current_Schema_Version unchanged.
  it("Property 3: readRun and listRuns return v9 records unchanged", () => {
    fc.assert(
      fc.property(v9RecordArb, (record) => {
        // ...
      }),
      { numRuns: 100 },
    );
  });

  // Property 4: Storage version check rejects future-version records with schema_version_future:.
  it("Property 4: future-version records fail with schema_version_future:", () => {
    const futureVersionArb = fc.integer({
      min: DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION + 1,
      max: DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION + 50,
    });
    fc.assert(
      fc.property(recordAtVersionArb(futureVersionArb), (record) => {
        // ...
      }),
      { numRuns: 100 },
    );
  });

  // Property 5: Storage version check rejects unmigratable records with schema_version_unmigratable:.
  it("Property 5: unmigratable records fail with schema_version_unmigratable:", () => {
    const unmigratableVersionArb = fc.integer({ min: 0, max: 7 });
    fc.assert(
      fc.property(recordAtVersionArb(unmigratableVersionArb), (record) => {
        // ...
      }),
      { numRuns: 100 },
    );
  });
});
```

The `_arbitraries/run-record.ts` module exposes:

- `v8RecordArb` — a `fast-check` arbitrary that generates v8-shaped records with arbitrary values for every Vocabulary_Rename_Set key (each present sometimes, absent sometimes) and both URI forms.
- `v9RecordArb` — same, in v9 shape.
- `recordAtVersionArb(versionArb)` — generates a synthetic record with `schemaVersion` drawn from the supplied arbitrary; used by Properties 4 and 5 to drive the storage check at boundary versions.

### Integration / hardening tests

- `tests/integration/hardening/schema-version-check.test.ts` — Requirement 15; the four documented behaviors (v7 refuse / v8 migrate / v9 pass-through / v10 refuse-future) exercised against both stores and both read paths.
- `tests/integration/vocabulary-sweep.test.ts` — Requirement 2.7; runs `pnpm exec rg` with the do-not-touch globs and asserts zero LHS matches outside `vocabulary-audit.csv`, `Fix_Plan.md` history rows, and `shared/schemas/migrations/v8-to-v9.ts`.

### Verification gate (Requirement 16)

The cut is ready to merge when the following commands all pass:

- `pnpm run typecheck` (Requirement 16.1)
- `pnpm run test` (Requirement 16.2)
- `pnpm run check:build` (Requirement 16.3)
- `pnpm run check:naming` (Requirement 16.4)

The `Fix_Plan.md` updates required by Requirement 16.5–16.7 (status flips for F4/F7/F11 to `✅ done`, an `**Outcome.**` paragraph plus `**Components delivered.**`, `**Side fixes during F4/F7/F11.**`, `**Verification.**`, and `**Unblocks:**` blocks for each Fix_Plan item) follow the format already used in the F1 and F15 sections.
