# Implementation Plan: Directive kernel v8 → v9 cut

## Agent execution model (locked)

The cut is split across three agent phases:

| Phase | Who | Tasks | Why |
|---|---|---|---|
| **Audit** | Claude / Codex | 2.1 (vocabulary enumerate), 3.1 (Directive-prefix enumerate) | Judgment-heavy, requires exhaustive enumeration. Output is two files: [`GLOSSARY_CANDIDATES.md`](../../../docs/audits/GLOSSARY_CANDIDATES.md) and [`DIRECTIVE_PREFIX_INVENTORY.md`](../../../docs/audits/DIRECTIVE_PREFIX_INVENTORY.md). |
| **Execution** | DeepSeek + OpenCode | Every other task across waves 1–5 (24 tasks) | Mechanical renames once the audit is fixed. Reads the two audit files as fixed inputs; zero ambiguity, zero judgment calls. |
| **Evaluation** | Claude / Codex | Final block (6.1, 6.2) | Catches what DeepSeek missed; runs the four-command verification gate; updates `Fix_Plan.md`. |

**The two audit files are already produced** by the Audit phase ahead of execution:

- [`GLOSSARY_CANDIDATES.md`](../../../docs/audits/GLOSSARY_CANDIDATES.md) — locks the 8 canonical Vocabulary_Rename_Set pairs, the 7 Do_Not_Touch_Term_Set entries, and the ~50 keep-as-is terms documented in the post-Wave-5 glossary. DeepSeek's Wave 2 reads this file and applies the renames; it makes no decisions.
- [`DIRECTIVE_PREFIX_INVENTORY.md`](../../../docs/audits/DIRECTIVE_PREFIX_INVENTORY.md) — locks the 13 canonical type/file/schema renames plus the bulk-rename rules B1 (`Directive` prefix prune), B2 (folder-name prefix prune), B3 (`directive-` filename prune). Pre-populates the `DIRECTIVE_PREFIX_ALLOWLIST` constant in `scripts/check-naming.ts`. Includes confirmed call-counts and exhaustive file enumerations from the ripgrep sweep (376 unique `Directive`-prefixed exports across ~80 files; 5 files with `directive-` prefix; ~50 files with redundant lane-prefix).

DeepSeek receives **both files plus this `tasks.md` plus `requirements.md` and `design.md`** as the complete input set. There is no further enumeration or audit work for DeepSeek to do during waves 1–5.

## Overview

This plan ships F4 (vocabulary diet), F7 (run-record schema freeze + migration policy), and F11 (naming consistency) as one coordinated v8 → v9 release of `@directive/kernel`. The work is staged into five sequential waves, each landing CI-green on its own. The wave order matches `design.md → "Architecture → Test breakage strategy"`:

1. Migration framework substrate (no vocab/naming renames yet)
2. Vocabulary renames (8 Vocabulary_Rename_Set pairs applied)
3. Naming renames + file moves + `package.json` exports retargeting
4. Schema URI flip + `schemaVersion 8 → 9` + `package.json` `0.1.x → 0.2.0` + hardening tests
5. Documentation deliverables + `scripts/check-naming.ts` + CI step

After Wave 5 a Final task block updates `Fix_Plan.md` and re-runs the four-command verification gate from Requirement 16.

## Test breakage strategy (read this first)

**Every wave checkpoint is mandatory. No wave is allowed to land red.** The whole point of the wave plan is that any reviewer can pull HEAD at any wave boundary and run the tests themselves; a single red checkpoint forfeits that property and the F1 test-infrastructure investment behind it. If a wave's checkpoint fails, the wave is incomplete — fix the regression before moving to the next wave, do not paper over it.

**Highest-risk task: Wave 1 task 1.5** (Storage_Version_Check helper + four call-site wraps). It touches the central read paths in both engine stores; a bug in this helper invalidates every hardening test downstream. Recommended approach: implement `readThroughVersionCheck` as a pure helper first, exercise it with the property tests in task 1.6, and only then wire it into the four call sites in `engine/storage.ts`. A failure here is cheap to find before integration and expensive to find after.

Property test annotation pattern (matches F1 / F15):

```ts
// Property N: <name>.
// Design: design.md → "Correctness Properties → Property N".
// Validates: Requirements X.Y, X.Z.
fc.assert(fc.property(arb, (input) => { ... }), { numRuns: 100 });
```

## Tasks

- [ ] 1. Wave 1 — Migration framework substrate (no vocab/naming renames yet)

  - [ ] 1.1 Add `tests/property/_arbitraries/run-record.ts`
    - Export `v8RecordArb`, `v9RecordArb`, and `recordAtVersionArb(versionArb)` from a single module.
    - `v8RecordArb` MUST cover all 8 Vocabulary_Rename_Set keys (`earnedAutonomy`, `gapRadar`, `narrativeThreading`, `deepTail`, `legalNextSeams`, `forbiddenScopeExpansion`, `boundedCloseout`, `integrityGate`), each present sometimes and absent sometimes via `fc.option`.
    - `v8RecordArb` MUST emit both relative-form (`shared/schemas/directive-engine-run-record.schema.json`) and absolute-form (`https://directive-workspace.dev/schemas/directive-engine-run-record.schema.json`) `$schema` URIs via `fc.oneof`.
    - `v8RecordArb` MUST always emit the identity-preserved required fields (`schemaVersion: 8`, `recordKind: "directive_engine_run_record"`, `runId`, `receivedAt`, `source`, `selectedLane`).
    - `v9RecordArb` mirrors `v8RecordArb` in v9 shape (renamed keys + v9 `$schema` URI + `schemaVersion: 9`).
    - `recordAtVersionArb(versionArb)` returns a record whose `schemaVersion` is drawn from the supplied arbitrary; used by Properties 4 and 5.
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
    - _Design: `design.md → "Testing Strategy → Property tests"`_

  - [ ] 1.2 Create `shared/schemas/migrations/v8-to-v9.ts`
    - Implement the V8_To_V9_Migration module per the full skeleton in `design.md → "Migration framework module shape"`.
    - Header comment lists every Vocabulary_Rename_Set field rewritten plus the `$schema` URI rewrite.
    - Constants: `SOURCE_VERSION = 8`, `TARGET_VERSION = 9`, `FIELD_RENAMES` table (8 entries), `REVERSE_FIELD_RENAMES` derived via `Object.fromEntries`, four schema-ref constants (relative + absolute × v8 + v9).
    - Helpers: `rewriteSchemaRef(value, forward)` (preserves relative-vs-absolute form), `renameKeysDeep(value, table)` (recursive on objects and arrays).
    - Export `migrate(record: unknown): unknown` — throws if `record.schemaVersion !== 8` with a message starting `v8-to-v9 migrate:`.
    - Export `rollback(record: unknown): unknown` — best-effort reverse; passes through records whose `schemaVersion !== 9`; never throws on lossless inputs.
    - _Requirements: 8.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ] 1.3 Create `shared/schemas/migrations/index.ts`
    - Implement Schema_Migration_Registry per the full skeleton in `design.md → "Migration framework module shape"`.
    - Export the `RunRecordMigration` interface (`migrate`, `rollback`).
    - Export `runRecordMigrations: Readonly<Record<number, RunRecordMigration>>` keyed by source schema version, seeded with `8: v8ToV9` (import `* as v8ToV9 from "./v8-to-v9.ts"`).
    - Export `applyRunRecordMigrationChain(record, from, to)` — walks the registry in source-version order; throws `schema_version_unmigratable: no migration registered for v<v> → v<v+1> (record at v<from>, target v<to>)` on a missing link.
    - Header comment documents the two-step extension procedure (drop in `v<v>-to-v<v+1>.ts` + add one entry).
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 10.4_

  - [ ] 1.4 Add `tests/property/v8-to-v9-migration.property.test.ts`
    - Imports: `migrate`, `rollback` from `shared/schemas/migrations/v8-to-v9.ts`; `v8RecordArb` from `tests/property/_arbitraries/run-record.ts`.
    - **Property 1: V8 → V9 migration is structurally lossless on the lossless field set.**
      - `// Property 1: V8 → V9 migration is structurally lossless on the lossless field set.`
      - `// Design: design.md → "Correctness Properties → Property 1".`
      - `// Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 14.1.`
      - Asserts every non-rename key carries through deep-equal, every Vocabulary_Rename_Set key appears under its v9 name with deep-equal value, `schemaVersion === 9`, and `$schema` is the v9-form URI in the same relative-vs-absolute form as the input.
    - **Property 2: V8 → V9 migration is round-trip lossless on the lossless field set.**
      - `// Property 2: V8 → V9 migration is round-trip lossless on the lossless field set.`
      - `// Design: design.md → "Correctness Properties → Property 2".`
      - `// Validates: Requirements 9.7, 14.2.`
      - Asserts `rollback(migrate(r))` deep-equals `r` on the lossless field set defined in `design.md → "Data Models"`.
    - Both properties run with `{ numRuns: 100 }`.
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 14.1, 14.2, 14.5_

  - [ ] 1.5 **(HIGHEST-RISK)** Add `readThroughVersionCheck` helper and wire it into both stores
    - Step A — implement `readThroughVersionCheck(record: unknown): DirectiveEngineRunRecord` as a pure function in `engine/storage.ts` per `design.md → "Storage version check"`. Imports `applyRunRecordMigrationChain` from `shared/schemas/migrations/index.ts` and `DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` from `./types.ts`.
    - Error contract: `schema_version_unreadable:` for non-object / missing / non-integer `schemaVersion`; `schema_version_future:` (with both versions) for `version > current`; rethrows `schema_version_unmigratable:` from `applyRunRecordMigrationChain` for unmigratable past versions.
    - Pass-through path: returns the record unchanged when `version === current` (Requirement 10.2).
    - MUST NOT mutate the input record (Requirement 10.8).
    - Step B — wire the helper into 4 call sites:
      - `createFilesystemDirectiveEngineStore::readRun` (≈ line 179)
      - `createFilesystemDirectiveEngineStore::listRuns` (≈ line 198, applied via `.map(readThroughVersionCheck)`)
      - `createMemoryDirectiveEngineStore::readRun` (≈ line 221)
      - `createMemoryDirectiveEngineStore::listRuns` (≈ line 224, applied via `.map(readThroughVersionCheck)`)
    - Recommended order: implement the helper isolated, run task 1.6 against it, only then do the four wraps.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [ ] 1.6 Add `tests/property/storage-version-check.property.test.ts`
    - Imports: `createMemoryDirectiveEngineStore` from `engine/storage.ts`; `DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` from `engine/types.ts`; `v9RecordArb`, `recordAtVersionArb` from the arbitraries module.
    - **Property 3: Storage version check passes through records at Current_Schema_Version unchanged.**
      - `// Property 3: Storage version check passes through records at Current_Schema_Version unchanged.`
      - `// Design: design.md → "Correctness Properties → Property 3".`
      - `// Validates: Requirements 10.1, 10.2, 10.6, 10.7, 14.4.`
      - Seeds a v9 record into `createMemoryDirectiveEngineStore`; asserts `readRun(runId)` is deep-equal and `listRuns()` contains a deep-equal element.
    - **Property 4: Storage version check rejects future-version records with `schema_version_future:`.**
      - `// Property 4: Storage version check rejects future-version records with schema_version_future:.`
      - `// Design: design.md → "Correctness Properties → Property 4".`
      - `// Validates: Requirements 10.5, 15.5.`
      - `versionArb = fc.integer({ min: current + 1, max: current + 50 })`; asserts both `readRun` and `listRuns` throw `/^schema_version_future:.*v<v>.*v<current>/`.
    - **Property 5: Storage version check rejects unmigratable records with `schema_version_unmigratable:`.**
      - `// Property 5: Storage version check rejects unmigratable records with schema_version_unmigratable:.`
      - `// Design: design.md → "Correctness Properties → Property 5".`
      - `// Validates: Requirements 10.4, 14.3, 15.2.`
      - `versionArb = fc.integer({ min: 0, max: 7 })`; asserts both `readRun` and `listRuns` throw `/^schema_version_unmigratable:/` with both `v` and `current` referenced.
    - All three properties run with `{ numRuns: 100 }`.
    - _Requirements: 10.1, 10.2, 10.4, 10.5, 10.6, 10.7, 14.3, 14.4, 14.5_

  - [ ] 1.7 Wave 1 checkpoint
    - Run `pnpm run typecheck` — MUST be green.
    - Run `pnpm run test` — MUST be green.
    - No vocab/naming renames have been applied yet, so no test breakage is expected. Persisted v8 records still read identically (the registry is a no-op on a v9 record and there are no v9 records yet).
    - If either command is red, fix the regression before moving to Wave 2. Ask the user if questions arise.

- [ ] 2. Wave 2 — Vocabulary renames

  - [x] 2.1 ~~Generate `vocabulary-audit.csv` at the repo root~~ **COMPLETED BY AUDIT PHASE** — see [`GLOSSARY_CANDIDATES.md`](../../../docs/audits/GLOSSARY_CANDIDATES.md)
    - The audit phase (Claude / Codex) produced `docs/audits/GLOSSARY_CANDIDATES.md` instead of the originally-planned `vocabulary-audit.csv`. The Markdown file format was chosen because it carries case-form tables, confirmed call-sites, do-not-touch rationale, and edge-case rules better than a flat CSV.
    - DeepSeek reads `docs/audits/GLOSSARY_CANDIDATES.md` as the fixed input for tasks 2.2 and 2.3.
    - Requirement 1's CSV is satisfied by the structured tables in `docs/audits/GLOSSARY_CANDIDATES.md`; the post-Wave-5 `GLOSSARY.md` renders the human-readable glossary the original requirement also called for.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8 — interpreted as: file exists at repo root, all 8 Vocabulary_Rename_Set rows present, all 7 Do_Not_Touch_Term_Set rows present, every additional domain term enumerated, no missing terms_

  - [ ] 2.2 Apply the 8 Vocabulary_Rename_Set renames across the kernel
    - **Input:** [`GLOSSARY_CANDIDATES.md`](../../../docs/audits/GLOSSARY_CANDIDATES.md). DeepSeek reads the Vocabulary_Rename_Set table (8 canonical pairs in all four case forms: prose, camelCase, PascalCase, kebab-case) and applies every form.
    - For TypeScript identifiers, use `semanticRename` so every caller updates transitively. For prose, JSON keys appearing in source-as-string, JSON Schema text, and Markdown, use grep + plain rewrite.
    - Apply each pair in both `prose source → prose target` and `camelCase source → camelCase target` form (`PascalCase` and `kebab-case` mirrored where they appear):
      - `earned autonomy` → `operator trust score` (`earnedAutonomy` → `operatorTrustScore`)
      - `gap radar` → `open gaps view` (`gapRadar` → `openGapsView`)
      - `narrative threading` → `source thread context` (`narrativeThreading` → `sourceThreadContext`)
      - `deep tail` → `materialization tail` (`deepTail` → `materializationTail`)
      - `legal next seams` → `allowed next steps` (`legalNextSeams` → `allowedNextSteps`)
      - `forbidden scope expansion` → `out of scope` (`forbiddenScopeExpansion` → `outOfScope`)
      - `bounded closeout` → `closeout` (`boundedCloseout` → `closeout`)
      - `integrity gate` → `integrity check` (`integrityGate` → `integrityCheck`)
    - Scope: TS source, JSON Schema files, Markdown contracts under `shared/contracts/`, lane README files, repo-root docs (`README.md`, `Tech_Blueprint.md`, `Fix_Plan.md`, `DIRECTIVE_GOAL.md`), and JSON-as-string literals embedded in code.
    - Out of scope: `discovery/research-engine/`, `ui/` workspace, `dist/` output, persisted v8 records on disk (those flow through V8_To_V9_Migration on read, not through static rewrites).
    - Do_Not_Touch_Term_Set occurrences (including occurrences nested inside an otherwise-renamed phrase) are NOT altered.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 2.3 Add `tests/integration/vocabulary-sweep.test.ts`
    - Runs `pnpm exec rg --files-with-matches --case-sensitive --glob '!dist/**' --glob '!ui/**' --glob '!discovery/research-engine/**' --glob '!node_modules/**' '<term>'` for each of the 8 Vocabulary_Rename_Set left-hand sides.
    - Asserts the result set, after subtracting the documented allowlist, is empty.
    - Allowlist: `vocabulary-audit.csv`, `Fix_Plan.md` history rows, and `shared/schemas/migrations/v8-to-v9.ts` (which references the old field names by necessity per the migration table).
    - _Requirements: 2.7_
    - _Design: `design.md → "Testing Strategy → Integration / hardening tests"`_

  - [ ] 2.4 Wave 2 checkpoint
    - Run `pnpm run typecheck` — MUST be green.
    - Run `pnpm run test` — MUST be green (including the new `vocabulary-sweep.test.ts` and the property tests from Wave 1; Storage_Version_Check from Wave 1 means v8-record fixtures still load).
    - If red, fix before moving to Wave 3. Ask the user if questions arise.

- [ ] 3. Wave 3 — Naming renames + file moves + package.json exports retargeting

  - [x] 3.1 ~~Generate `naming-audit.csv` at the repo root~~ **COMPLETED BY AUDIT PHASE** — see [`DIRECTIVE_PREFIX_INVENTORY.md`](../../../docs/audits/DIRECTIVE_PREFIX_INVENTORY.md)
    - The audit phase (Claude / Codex) produced `docs/audits/DIRECTIVE_PREFIX_INVENTORY.md` instead of the originally-planned `naming-audit.csv`. Format chosen for the same reason as 2.1.
    - The inventory file:
      - **Section A:** the 13 canonical Naming_Rename_Table rows from Requirement 4 with caller_count anchors.
      - **Section B:** three bulk-rename rules (B1: drop `Directive` prefix from every export; B2: drop folder-name prefix from same-folder file basenames with the full ~50-row file list; B3: drop `directive-` filename prefix with the 5-file list).
      - **Section C:** the pre-populated `DIRECTIVE_PREFIX_ALLOWLIST` (one entry: `engine/types.ts` for `DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION`).
    - Audit numbers confirmed: 376 unique `Directive`-prefixed exports, 5 `directive-*.ts` files, ~50 lane-prefix files.
    - DeepSeek reads `docs/audits/DIRECTIVE_PREFIX_INVENTORY.md` as the fixed input for tasks 3.2–3.5 and 5.5.
    - Requirement 3's CSV is satisfied by the structured tables in `docs/audits/DIRECTIVE_PREFIX_INVENTORY.md`.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8 — interpreted as: file exists at repo root, every Naming_Rename_Table row present, every additional Directive-prefixed export and folder-prefix file enumerated, kind/disposition/caller_count documented_

  - [ ] 3.2 Rename 5 types via `semanticRename`
    - **Input:** [`DIRECTIVE_PREFIX_INVENTORY.md`](../../../docs/audits/DIRECTIVE_PREFIX_INVENTORY.md) Section A rows 1–5.
    - `DirectiveEngineSourceItem` → `EngineSourceItem`
    - `DirectiveEngineMissionContext` → `MissionContext`
    - `DirectiveEngineCapabilityGap` → `CapabilityGap`
    - `DirectiveEngineLaneDefinition` → `LaneDefinition`
    - `DirectiveEngineRunRecord` → `RunRecord`
    - Every declaration site and every import site MUST be updated (`semanticRename` handles this transitively). Audit grep for residual occurrences after the renames.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.17_

  - [ ] 3.3 Rename 2 functions via `semanticRename`
    - **Input:** [`DIRECTIVE_PREFIX_INVENTORY.md`](../../../docs/audits/DIRECTIVE_PREFIX_INVENTORY.md) Section A rows 6–7.
    - `requireDirectiveExplicitApproval` → `requireExplicitApproval`
    - `requireDirectiveIntegrityForOpening` → `requireIntegrityForOpening`
    - Every declaration site and every call site MUST be updated.
    - _Requirements: 4.1, 4.7, 4.8_

  - [ ] 3.4 Move 5 files via `smartRelocate`
    - **Input:** [`DIRECTIVE_PREFIX_INVENTORY.md`](../../../docs/audits/DIRECTIVE_PREFIX_INVENTORY.md) Section A rows 8–12.
    - `discovery/lib/front-door/discovery-front-door.ts` → `discovery/lib/front-door/index.ts`
    - `discovery/lib/front-door/discovery-front-door-coverage.ts` → `discovery/lib/front-door/coverage.ts`
    - `runtime/lib/openers/runtime-follow-up-opener.ts` → `runtime/lib/openers/follow-up.ts`
    - `runtime/lib/openers/runtime-runtime-capability-boundary-promotion-readiness-opener.ts` → `runtime/lib/openers/promotion-readiness.ts`
    - `architecture/lib/control/architecture-deep-tail-stage-map.ts` → `architecture/lib/control/materialization-tail-stage-map.ts` (the file rename also picks up the `deep tail → materialization tail` Vocabulary_Rename_Set pair from Wave 2).
    - `smartRelocate` updates all importers automatically; verify with `pnpm run typecheck` immediately after each move.
    - **Then apply Section B bulk rules:** after the 5 canonical moves above, DeepSeek applies [`DIRECTIVE_PREFIX_INVENTORY.md`](../../../docs/audits/DIRECTIVE_PREFIX_INVENTORY.md) Section B rules in order:
      - **B1** drop `Directive` prefix from every kernel export NOT in the allowlist (`engine/types.ts:DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` is the one exception). Run `semanticRename` per export, batch typecheck after every 10–20 renames.
      - **B2** drop folder-name prefix from same-folder file basenames per the Section B file-list table (~50 files). Run `smartRelocate` per file, batch typecheck after every 5–10 moves. The Section B note about the `architecture-bounded-closeout.ts` / `architecture-closeout.ts` collision applies — inspect content and merge before completing the move.
      - **B3** drop `directive-` filename prefix from the 5 files listed in Section B. Includes the schema file rename which is also Section A row 13 (Wave 4 task 4.1/4.2 handles the schema specifically).
    - _Requirements: 4.9, 4.10, 4.11, 4.12, 4.13, 4.16, 4.17_

  - [ ] 3.5 Rewrite `package.json` `exports` map for renamed targets
    - For every subpath key whose target points at a file affected by tasks 3.2–3.4, retarget all four conditions in lockstep: `development`, `types`, `import`, `default`.
    - Subpath keys MUST be preserved (no key added, no key removed).
    - No new conditions introduced.
    - Verify with `pnpm run check:build` that every retargeted condition resolves from `dist/`.
    - _Requirements: 13.1, 13.3, 13.4, 13.5_

  - [ ] 3.6 Wave 3 checkpoint
    - Run `pnpm run typecheck` — MUST be green.
    - Run `pnpm run test` — MUST be green.
    - Run `pnpm run check:build` — MUST be green.
    - If red, fix before moving to Wave 4. Ask the user if questions arise.

- [ ] 4. Wave 4 — Schema URI flip + version bump + hardening tests

  - [ ] 4.1 Create `shared/schemas/run-record.schema.json`
    - `$id` field: `https://directive-workspace.dev/schemas/run-record.schema.json`.
    - Copy the field shape from the v8 schema, applying the camelCase key renames inline (the same 8 renames the V8_To_V9_Migration applies).
    - Schema title and description updated to v9 vocabulary; `schemaVersion` constraint set to `9`.
    - _Requirements: 4.14_

  - [ ] 4.2 Delete `shared/schemas/directive-engine-run-record.schema.json`
    - Outright deletion; no HTTP redirect, no symlink. The hard-break rule is documented in `shared/contracts/schema-versioning.md` (Wave 5 task 5.4).
    - Update any `package.json` `exports` map entry that pointed at the deleted file to point at `shared/schemas/run-record.schema.json` (all four conditions: `development`, `types`, `import`, `default`). If task 3.5 already retargeted this key, verify the retarget covered the schema path.
    - _Requirements: 4.14, 13.2_

  - [ ] 4.3 Update `engine/types.ts` constants
    - Flip `DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` from `8` to `9`.
    - Flip the schema-ref constant from `directive-engine-run-record.schema.json` to `run-record.schema.json` (both relative and absolute forms if both are exported).
    - Widen the schema-version history-aware union type to `8 | 9` if the file currently exposes one.
    - _Requirements: 12.1 (constant defining Current_Schema_Version=9 used by Storage_Version_Check)_
    - _Design: `design.md → "Components and Interfaces → Surface-affecting components"`_

  - [ ] 4.4 Update `package.json` `version`
    - Flip from `0.1.x` to `0.2.0`.
    - Leave every other workspace package's version field untouched.
    - _Requirements: 12.1, 12.2_

  - [ ] 4.5 Add `tests/integration/hardening/schema-version-check.test.ts`
    - Table-driven cases per `design.md → "Hardening test outline"`:
      - v7 case: asserts `readRun` / `listRuns` throw `/^schema_version_unmigratable:.*v7.*v9/` with both versions referenced.
      - v8 case: asserts the read returns a v9 record with the 8 Vocabulary_Rename_Set keys renamed and `$schema` rewritten; on the filesystem-store path, byte-compares the on-disk file before and after to assert no mutation (Requirement 10.8 / 15.3).
      - v9 case: asserts the read returns the record deep-equal to the seed on every field.
      - v10 case: asserts `readRun` / `listRuns` throw `/^schema_version_future:.*v10.*v9/`.
    - Each case MUST run against both `createMemoryDirectiveEngineStore` and `createFilesystemDirectiveEngineStore`, and against both `readRun` and `listRuns`.
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ] 4.6 Wave 4 checkpoint
    - Run `pnpm run typecheck` — MUST be green.
    - Run `pnpm run test` — MUST be green (including all four hardening cases × two stores × two read paths).
    - Run `pnpm run check:build` — MUST be green.
    - If red, fix before moving to Wave 5. Ask the user if questions arise.

- [ ] 5. Wave 5 — Documentation + lint + CI step

  - [ ] 5.1 Create `GLOSSARY.md` at the repo root
    - One-paragraph introduction stating the document is the source of truth for kernel-internal vocabulary and that every term is either a Vocabulary_Rename_Set target or a Do_Not_Touch_Term_Set entry.
    - `## Terms` section, alphabetized, one entry per term whose Vocabulary_Audit `disposition` is `rename` (using the post-rename term), `keep`, or `do-not-touch`.
    - Each entry: bold term, one-sentence plain-English definition, Markdown link to a canonical source file or README within the repository.
    - Coverage MUST include every term referenced by name in `shared/contracts/`, `engine/types.ts`, and lane README files post-rename.
    - Skeleton: `design.md → "GLOSSARY.md outline"`.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 5.2 Update `README.md` to link to `GLOSSARY.md`
    - Add a terminology section (or extend an existing one) with a single paragraph and a Markdown link to `./GLOSSARY.md`.
    - _Requirements: 5.6_

  - [ ] 5.3 Create `CONTRIBUTING.md` at the repo root
    - `## Naming rules` section (heading at the same level used elsewhere in the file).
    - 4 rules per `design.md → "CONTRIBUTING.md naming-rules outline"`:
      1. No `Directive` type-name prefix and no `directive-` filename prefix inside the kernel.
      2. A file's basename does not repeat its immediate parent folder name as a prefix (and the double-prefix case is called out).
      3. JSON Schema files in `shared/schemas/` use unprefixed shape names.
      4. Schema constants and exported types in `engine/types.ts` follow rules 1–3.
    - Names the script path `scripts/check-naming.ts` and shows the `pnpm run check:naming` invocation.
    - Cross-links to `GLOSSARY.md` and `shared/contracts/schema-versioning.md`.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ] 5.4 Create `shared/contracts/schema-versioning.md`
    - Skeleton: `design.md → "Schema versioning policy doc outline"`.
    - Sections in order: version-bump rule, migration requirement, property-test requirement, schema-URI hard-break rule, package-version bump rule, first concrete application (v8 → v9 with links to `shared/schemas/migrations/v8-to-v9.ts`, the registry, and the new schema file).
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 5.5 Create `scripts/check-naming.ts`
    - **Input:** [`DIRECTIVE_PREFIX_INVENTORY.md`](../../../docs/audits/DIRECTIVE_PREFIX_INVENTORY.md) Section C — pre-populated `DIRECTIVE_PREFIX_ALLOWLIST` constant (one entry: `engine/types.ts`). Copy the constant verbatim from the inventory's Section C.
    - Export `scanForNamingViolations(files: Record<string, string>): Violation[]` taking a synthetic file map (basename → source text); used by the unit test.
    - CLI entry point: when invoked directly (e.g., via `tsx`), reads the real file tree under `discovery/`, `runtime/`, `architecture/`, `engine/`, `shared/`, `hosts/`, `scripts/`, plus JSON Schema files under `shared/schemas/`.
    - 4 rules per `design.md → "CI naming-lint script"`:
      - `directive-prefix-filename`: basename matches `^directive-`.
      - `folder-prefix-filename`: basename starts with the immediate parent folder name + `-`.
      - `directive-prefix-export`: an exported `type` / `interface` / `class` / `function` declared name matches `^Directive[A-Z]`, excluding files in `DIRECTIVE_PREFIX_ALLOWLIST` (export the allowlist as an empty `as const` array on the v9 cut, with a header comment explaining the deferral rule).
      - `double-prefix-filename`: basename matches `^<prefix>-<prefix>-`.
    - Exit code: `0` on zero violations; `1` on at least one violation.
    - Output format on violation: one line per violation to stderr, exact form `<rule>: <file>: <detail>`.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [ ] 5.6 Add `check:naming` script to `package.json`
    - `"check:naming": "tsx scripts/check-naming.ts"`.
    - _Requirements: 11.9_

  - [ ] 5.7 Add `tests/unit/check-naming.test.ts`
    - Vitest unit test that imports `scanForNamingViolations` from `scripts/check-naming.ts`.
    - Synthetic file fixture per `design.md → "CI naming-lint script → Test fixture pattern"`: 4 violation entries (one per rule) + 1 negative entry.
    - Asserts each rule fires exactly once on its target and the total violation count is 4.
    - _Requirements: 11.11_

  - [ ] 5.8 Add `check:naming` step to `.github/workflows/ci.yml`
    - Insert a `pnpm run check:naming` step between the `typecheck` step and the `test` step, gated as required.
    - Reuses the same Node / pnpm setup as the surrounding steps.
    - _Requirements: 11.10_

  - [ ] 5.9 Wave 5 checkpoint
    - Run `pnpm run typecheck` — MUST be green.
    - Run `pnpm run test` — MUST be green (including the new `tests/unit/check-naming.test.ts`).
    - Run `pnpm run check:build` — MUST be green.
    - Run `pnpm run check:naming` — MUST be green (zero violations).
    - If any command is red, fix before moving to Final. Ask the user if questions arise.

- [ ] 6. Final — Fix_Plan outcome and verification gate

  - [ ] 6.1 Update `Fix_Plan.md` outcome blocks
    - Flip F4, F7, F11 to `✅ done` in the status table at the top of the file.
    - For each of F4, F7, F11, append in the same format used for F1 and F15:
      - `**Outcome.**` paragraph
      - `**Components delivered.**` list
      - `**Side fixes during F4/F7/F11.**` list (combined or per-item, whichever is clearer)
      - `**Verification.**` block (typecheck / test / check:build / check:naming)
      - `**Unblocks:**` line listing newly-enabled Fix_Plan items (at minimum F5 and F8 for surface-area work, F13 for the schema-versioning policy)
    - _Requirements: 12.3, 16.5, 16.6, 16.7_

  - [ ] 6.2 Final verification — re-run all four checks and smoke-test
    - Run `pnpm run typecheck` — MUST be green.
    - Run `pnpm run test` — MUST be green.
    - Run `pnpm run check:build` — MUST be green.
    - Run `pnpm run check:naming` — MUST be green.
    - Run `pnpm try` end-to-end as a smoke check.
    - Confirm `git status` shows only the wave's intended diff (no stray files, no unintended writes).
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

## Notes

- Every task references the requirement clauses it satisfies for traceability. Property test sub-tasks additionally reference the property number from `design.md → "Correctness Properties"`.
- Wave 1 task 1.5 (Storage_Version_Check helper + four call-site wraps) is the highest-risk task in the plan. A bug in `readThroughVersionCheck` invalidates every hardening test downstream. Implement the helper isolated, run task 1.6 against it, and only then do the four wraps.
- Within each wave, tasks are sequential. Across waves, ordering is enforced by the dependency arrows in `design.md → "Architecture"`: each wave's renames depend on the previous wave's substrate landing first.
- Property tests run with `{ numRuns: 100 }` minimum (Requirement 14.5).
- Optional sub-tasks: none. Every task in this plan is mandatory by user instruction.
- Out of scope per the locked spec: package rename (`@directive/kernel` stays), lane rename, directive-root rename, migrate-on-disk CLI, internal local variable renames, the Python `discovery/research-engine/` workspace.

## Task Dependency Graph

Tasks within each wave are sequential (one wave-of-graph per task), and waves are ordered. Checkpoint sub-tasks (1.7, 2.4, 3.6, 4.6, 5.9) and top-level epics (1, 2, 3, 4, 5, 6) are excluded per the dependency-graph rules.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["1.5"] },
    { "id": 5, "tasks": ["1.6"] },
    { "id": 6, "tasks": ["2.1"] },
    { "id": 7, "tasks": ["2.2"] },
    { "id": 8, "tasks": ["2.3"] },
    { "id": 9, "tasks": ["3.1"] },
    { "id": 10, "tasks": ["3.2"] },
    { "id": 11, "tasks": ["3.3"] },
    { "id": 12, "tasks": ["3.4"] },
    { "id": 13, "tasks": ["3.5"] },
    { "id": 14, "tasks": ["4.1"] },
    { "id": 15, "tasks": ["4.2"] },
    { "id": 16, "tasks": ["4.3"] },
    { "id": 17, "tasks": ["4.4"] },
    { "id": 18, "tasks": ["4.5"] },
    { "id": 19, "tasks": ["5.1"] },
    { "id": 20, "tasks": ["5.2"] },
    { "id": 21, "tasks": ["5.3"] },
    { "id": 22, "tasks": ["5.4"] },
    { "id": 23, "tasks": ["5.5"] },
    { "id": 24, "tasks": ["5.6"] },
    { "id": 25, "tasks": ["5.7"] },
    { "id": 26, "tasks": ["5.8"] },
    { "id": 27, "tasks": ["6.1"] },
    { "id": 28, "tasks": ["6.2"] }
  ]
}
```

