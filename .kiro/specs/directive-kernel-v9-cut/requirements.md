# Requirements Document

## Introduction

The `@directive/kernel` package today carries a learning tax: ~25 domain-internal terms with no shared definition, type and file names that repeat the lane folder or the package brand inside the kernel itself, and a run-record schema (`DirectiveEngineRunRecord`, version 8) with no written versioning policy and no migration framework. Three Fix_Plan items address this — F4 (vocabulary diet + glossary), F7 (run-record schema freeze + migration policy), and F11 (prefix prune + naming consistency). Each touches the same files, so they ship together as a single v8 → v9 cut.

This feature delivers that cut. It checks in two audit CSVs at the repo root (`vocabulary-audit.csv`, `naming-audit.csv`), applies eight canonical vocabulary renames, applies thirteen canonical type/file renames, lands a written schema-versioning policy at `shared/contracts/schema-versioning.md`, lands a minimal migration framework under `shared/schemas/migrations/` with the first entry `v8-to-v9.ts`, adds a `schemaVersion` check to the engine store's storage layer, ships a CI naming-lint script at `scripts/check-naming.ts`, ships `GLOSSARY.md` at the repo root, adds a naming-rules section to `CONTRIBUTING.md`, bumps `package.json` from `0.1.x` to `0.2.0`, rewrites the `package.json` `exports` map for renamed paths, and extends `tests/integration/hardening/` to cover the v7/v8/v9/v10 read paths.

This work depends on F1 (test infrastructure) ✅ done and F2 (JS build) ✅ done.

The schema URI is a hard break, no redirect: the file `shared/schemas/directive-engine-run-record.schema.json` is deleted outright and replaced by `shared/schemas/run-record.schema.json` at a new `$id`. That break is documented in the schema-versioning policy.

The Python `discovery/research-engine/` workspace is out of scope for code changes. Lane names (`discovery`, `runtime`, `architecture`), the `kernel` term, the `mission` term, the `directive root` term, and the `@directive/kernel` package name are out of scope for renames. A migrate-on-disk CLI is out of scope; migration runs in-flight at read time only.

## Glossary

- **Kernel**: The root TypeScript package `@directive/kernel` at the repository root. Excludes `ui/`, `discovery/research-engine/`, and `hosts/integration-kit/` workspace members.
- **Vocabulary_Audit**: The CSV file `vocabulary-audit.csv` at the repository root that lists every domain term considered for renaming, the proposed replacement, the disposition (rename, keep, do-not-touch), the file count, and a one-sentence rationale.
- **Naming_Audit**: The CSV file `naming-audit.csv` at the repository root that lists every type, function, and file path considered for renaming under the naming-consistency rules, the proposed replacement, the disposition (rename, keep, prohibited), and a one-sentence rationale.
- **Vocabulary_Rename_Set**: The eight canonical pairs `(earned autonomy → operator trust score)`, `(gap radar → open gaps view)`, `(narrative threading → source thread context)`, `(deep tail → materialization tail)`, `(legal next seams → allowed next steps)`, `(forbidden scope expansion → out of scope)`, `(bounded closeout → closeout)`, `(integrity gate → integrity check)`.
- **Do_Not_Touch_Term_Set**: The seven terms `mission`, `lane`, `discovery`, `runtime`, `architecture`, `kernel`, `directive root`. Vocabulary renames SHALL NOT alter occurrences of these terms.
- **Naming_Rename_Table**: The thirteen canonical rows listed in Requirement 3 covering five type renames, two function renames, five file renames, and one schema-file rename.
- **Naming_Rule_Set**: The four rules: (a) no `Directive` type-name prefix and no `directive-` file-name prefix inside the Kernel below the repository root; (b) files inside a folder do not repeat the folder name as a prefix; (c) schema JSON files use unprefixed shape names; (d) schema constants and exported types in `engine/types.ts` follow rules (a)–(c).
- **Glossary_Document**: The Markdown file `GLOSSARY.md` at the repository root.
- **Contributing_Document**: The Markdown file `CONTRIBUTING.md` at the repository root.
- **Schema_Versioning_Policy_Doc**: The Markdown file `shared/contracts/schema-versioning.md`.
- **Run_Record_Schema_File**: The JSON Schema file `shared/schemas/run-record.schema.json` at version 9. Its `$id` is `https://directive-workspace.dev/schemas/run-record.schema.json`. The previous file `shared/schemas/directive-engine-run-record.schema.json` (with `$id` `.../directive-engine-run-record.schema.json`) is deleted in this cut and not redirected.
- **Schema_Migration_Registry**: The TypeScript module `shared/schemas/migrations/index.ts` that exports a registry keyed by source schema version (the integer being migrated *from*). Each entry resolves to a migration module whose `migrate` function returns a record at the immediately-next schema version.
- **V8_To_V9_Migration**: The migration module `shared/schemas/migrations/v8-to-v9.ts`. Its `migrate(record)` function takes a record at `schemaVersion === 8` and returns a record at `schemaVersion === 9` with every Vocabulary_Rename_Set field renamed and the `$schema` URI rewritten from the deleted v8 URI to the v9 URI. Its `rollback(record)` function takes a v9 record and returns a best-effort v8 record; `rollback` MAY be partial and MUST document any field whose original v8 form cannot be reconstructed.
- **Storage_Version_Check**: The runtime check inside `engine/storage.ts` (and any other engine-store storage layer such as `createMemoryDirectiveEngineStore`) that inspects `record.schemaVersion` on read and dispatches to Schema_Migration_Registry, throws on future versions, or passes the record through when the version equals current.
- **Current_Schema_Version**: The integer `9`, exported from `engine/types.ts` as `DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` after this cut.
- **Naming_Lint_Script**: The TypeScript module `scripts/check-naming.ts` that walks the Kernel and exits with a non-zero code on any Naming_Rule_Set violation. Wired into `.github/workflows/ci.yml` as a required step and into `package.json` as `pnpm run check:naming`.
- **Hardening_Test**: A Vitest integration test under `tests/integration/hardening/` whose pass/fail is gated by the same CI workflow as every other test.
- **Property_Test**: A test written with `fast-check` that asserts a universal property over generated inputs, configured to run at least 100 iterations per property.
- **Public_Exports_Map**: The `exports` object in `package.json` at the repository root, which currently exposes ~50 subpath keys to consumers.

## Requirements

### Requirement 1 — Vocabulary audit deliverable

**User Story:** As a kernel maintainer, I want a checked-in vocabulary audit CSV, so that the rename decisions are reviewable, the do-not-touch list is explicit, and the file-count blast radius for each term is visible before the rename pass.

#### Acceptance Criteria

1. THE Kernel SHALL include a Vocabulary_Audit at `vocabulary-audit.csv` in the repository root.
2. THE Vocabulary_Audit SHALL have exactly the columns `term`, `proposed_replacement`, `disposition`, `file_count`, `rationale` in that order on the header row.
3. THE Vocabulary_Audit SHALL include one row per term in Vocabulary_Rename_Set with `disposition` equal to `rename` and `proposed_replacement` equal to the right-hand side of the canonical pair.
4. THE Vocabulary_Audit SHALL include one row per term in Do_Not_Touch_Term_Set with `disposition` equal to `do-not-touch` and `proposed_replacement` empty.
5. THE Vocabulary_Audit SHALL include a row for every additional domain term currently used in `shared/contracts/`, `engine/types.ts`, and lane README files (`discovery/README.md`, `runtime/README.md`, `architecture/README.md`, and their `lib/README.md` siblings) with a non-empty `disposition` value of `rename`, `keep`, or `do-not-touch`.
6. WHERE a row's `disposition` equals `rename`, THE Vocabulary_Audit SHALL set `file_count` to the count of files containing the term as measured at the time of the audit pass.
7. WHERE a row's `disposition` equals `keep` or `do-not-touch`, THE Vocabulary_Audit SHALL set `file_count` to `0` or omit the field; readers MUST NOT rely on `file_count` for non-rename rows.
8. THE Vocabulary_Audit SHALL contain no quoted commas or embedded newlines inside any cell; multi-word values use spaces.

### Requirement 2 — Vocabulary renames applied

**User Story:** As a new contributor reading the kernel for the first time, I want every metaphorical term replaced by its plain-English equivalent, so that I do not have to learn invented vocabulary before I can read a contract or a code path.

#### Acceptance Criteria

1. THE Kernel SHALL replace every textual occurrence of the left-hand side of each Vocabulary_Rename_Set pair with the right-hand side in TypeScript source files, JSON Schema files, Markdown contracts under `shared/contracts/`, lane README files, repo-root documentation files (`README.md`, `Tech_Blueprint.md`, `Fix_Plan.md`, `DIRECTIVE_GOAL.md`), and JSON-as-string literals embedded in code.
2. THE Kernel SHALL apply the rename in code identifiers using `semanticRename` semantics (every caller updated transitively) where the term appears as part of a TypeScript identifier.
3. THE Kernel SHALL apply the rename to identifier casings consistently: `camelCase` source becomes `camelCase` target, `PascalCase` source becomes `PascalCase` target, `kebab-case` source becomes `kebab-case` target, `snake_case` source becomes `snake_case` target, and prose source becomes prose target.
4. THE Kernel SHALL NOT alter occurrences of any term in Do_Not_Touch_Term_Set during the vocabulary rename pass, including occurrences nested inside an otherwise-renamed phrase.
5. THE Kernel SHALL NOT alter occurrences of vocabulary terms inside the `discovery/research-engine/` workspace, inside `ui/` workspace source files, or inside generated build output under `dist/`.
6. WHERE a Vocabulary_Rename_Set field name appears as a JSON property key in a v8 run record, THE V8_To_V9_Migration SHALL rewrite that key per Requirement 9; static text replacements in source files MUST NOT mutate persisted v8 records on disk.
7. WHEN the vocabulary rename pass is complete, THE Kernel SHALL contain zero textual matches for the left-hand side of any Vocabulary_Rename_Set pair outside of `vocabulary-audit.csv` itself, the `Fix_Plan.md` history rows, and the `V8_To_V9_Migration` source file (which references the old field names by necessity).

### Requirement 3 — Naming audit deliverable

**User Story:** As a kernel maintainer, I want a checked-in naming audit CSV, so that the type, function, and file rename decisions are reviewable and the prohibited-prefix rules have a written paper trail.

#### Acceptance Criteria

1. THE Kernel SHALL include a Naming_Audit at `naming-audit.csv` in the repository root.
2. THE Naming_Audit SHALL have exactly the columns `current_name`, `proposed_name`, `kind`, `disposition`, `caller_count`, `rationale` in that order on the header row.
3. THE `kind` column of the Naming_Audit SHALL take one of the values `type`, `function`, `file`, `schema-file`.
4. THE `disposition` column of the Naming_Audit SHALL take one of the values `rename`, `keep`, `prohibited-pattern`.
5. THE Naming_Audit SHALL include one row per entry in Naming_Rename_Table with `disposition` equal to `rename` and `proposed_name` equal to the right-hand side from Naming_Rename_Table.
6. THE Naming_Audit SHALL include rows for every additional `Directive`-prefixed exported type and every additional file under `discovery/`, `runtime/`, `architecture/`, `engine/`, `shared/`, `hosts/`, and `scripts/` that violates Naming_Rule_Set, marking each as either `rename` (with a target) or `keep` (with rationale explaining why the surface rename is deferred).
7. WHERE a row's `disposition` equals `rename` and `kind` equals `type` or `function`, THE Naming_Audit SHALL set `caller_count` to a non-negative integer counting non-declaration import sites at the time of the audit pass.
8. WHERE a row's `disposition` equals `rename` and `kind` equals `file` or `schema-file`, THE Naming_Audit SHALL set `caller_count` to a non-negative integer counting non-self import sites at the time of the audit pass.

### Requirement 4 — Naming renames applied

**User Story:** As a kernel adopter reading the public surface, I want types, functions, and files inside the kernel to follow consistent unprefixed naming, so that the package brand and the lane folder name appear at most once in any path or identifier.

#### Acceptance Criteria

1. THE Kernel SHALL apply every rename in Naming_Rename_Table such that the left-hand side has zero remaining occurrences in TypeScript source, schema JSON, and the `package.json` `exports` map after the cut.
2. THE Kernel SHALL rename the type `DirectiveEngineSourceItem` to `EngineSourceItem` at every declaration and import site.
3. THE Kernel SHALL rename the type `DirectiveEngineMissionContext` to `MissionContext` at every declaration and import site.
4. THE Kernel SHALL rename the type `DirectiveEngineCapabilityGap` to `CapabilityGap` at every declaration and import site.
5. THE Kernel SHALL rename the type `DirectiveEngineLaneDefinition` to `LaneDefinition` at every declaration and import site.
6. THE Kernel SHALL rename the type `DirectiveEngineRunRecord` to `RunRecord` at every declaration and import site.
7. THE Kernel SHALL rename the function `requireDirectiveExplicitApproval` to `requireExplicitApproval` at every declaration and call site.
8. THE Kernel SHALL rename the function `requireDirectiveIntegrityForOpening` to `requireIntegrityForOpening` at every declaration and call site.
9. THE Kernel SHALL move `discovery/lib/front-door/discovery-front-door.ts` to `discovery/lib/front-door/index.ts` and update every importer.
10. THE Kernel SHALL move `discovery/lib/front-door/discovery-front-door-coverage.ts` to `discovery/lib/front-door/coverage.ts` and update every importer.
11. THE Kernel SHALL move `runtime/lib/openers/runtime-follow-up-opener.ts` to `runtime/lib/openers/follow-up.ts` and update every importer.
12. THE Kernel SHALL move `runtime/lib/openers/runtime-runtime-capability-boundary-promotion-readiness-opener.ts` to `runtime/lib/openers/promotion-readiness.ts` and update every importer.
13. THE Kernel SHALL move `architecture/lib/control/architecture-deep-tail-stage-map.ts` to `architecture/lib/control/materialization-tail-stage-map.ts` (the file rename also picks up the Vocabulary_Rename_Set pair `deep tail → materialization tail`) and update every importer.
14. THE Kernel SHALL delete `shared/schemas/directive-engine-run-record.schema.json` and create `shared/schemas/run-record.schema.json` whose `$id` field equals `https://directive-workspace.dev/schemas/run-record.schema.json`.
15. WHERE the rename in clauses 2 through 8 affects a TypeScript identifier, THE Kernel SHALL also rename any locally-scoped variable names that are non-exported but whose identity exists only to mirror the renamed exported symbol; non-exported internal local variables that do not mirror a renamed export are out of scope per the locked spec scope.
16. AFTER all renames are applied, THE Kernel SHALL contain no new TypeScript file under `discovery/`, `runtime/`, `architecture/`, `engine/`, `shared/`, or `hosts/` whose basename matches `^directive-` or whose basename starts with the immediate parent folder name followed by `-`.
17. AFTER all renames are applied, THE Kernel SHALL contain no new exported TypeScript type or interface in source files under `discovery/`, `runtime/`, `architecture/`, `engine/`, `shared/`, or `hosts/` whose name matches `^Directive[A-Z]`.

### Requirement 5 — Glossary document

**User Story:** As a new contributor, I want a single glossary at the repo root, so that every domain term in the codebase has a one-sentence definition and a link to where it is canonically used.

#### Acceptance Criteria

1. THE Kernel SHALL include a Glossary_Document at `GLOSSARY.md` in the repository root.
2. THE Glossary_Document SHALL contain a one-paragraph introduction stating that the document is the source of truth for kernel-internal vocabulary and that every term is either a Vocabulary_Rename_Set target or a Do_Not_Touch_Term_Set entry.
3. THE Glossary_Document SHALL contain a `## Terms` section listing every term whose `disposition` in Vocabulary_Audit is `rename` (using the post-rename term), `keep`, or `do-not-touch`.
4. WHEN a reader looks up a term in the Glossary_Document, THE Glossary_Document SHALL provide for that term a one-sentence plain-English definition and a Markdown link to a canonical source file or README within the repository.
5. THE Glossary_Document SHALL define every term referenced by name in `shared/contracts/`, `engine/types.ts`, and lane README files post-rename.
6. THE `README.md` at the repository root SHALL link to the Glossary_Document from a section that introduces the kernel's terminology.

### Requirement 6 — Contributing document naming rules section

**User Story:** As a contributor opening a pull request, I want the naming rules written down in `CONTRIBUTING.md`, so that I can read them once and pass the lint check on the first try.

#### Acceptance Criteria

1. THE Kernel SHALL include a Contributing_Document at `CONTRIBUTING.md` in the repository root.
2. THE Contributing_Document SHALL contain a section titled `## Naming rules` (or equivalent heading at the same level).
3. THE Naming rules section SHALL state that no TypeScript file inside the Kernel uses the `directive-` filename prefix and no exported TypeScript type or interface inside the Kernel uses the `Directive` name prefix.
4. THE Naming rules section SHALL state that a file's basename does not repeat its immediate parent folder name as a prefix.
5. THE Naming rules section SHALL state that JSON Schema files in `shared/schemas/` use unprefixed shape names (e.g., `run-record.schema.json`, not `directive-engine-run-record.schema.json`).
6. THE Naming rules section SHALL state that the rules are enforced by Naming_Lint_Script, name the script path, and show the `pnpm run check:naming` invocation.
7. THE Naming rules section SHALL link to the Glossary_Document and to the Schema_Versioning_Policy_Doc.

### Requirement 7 — Schema versioning policy document

**User Story:** As a kernel adopter persisting run records on disk, I want a written schema-versioning policy, so that I know when the kernel will bump the schema, what migrations it guarantees, and what URI continuity I can expect.

#### Acceptance Criteria

1. THE Kernel SHALL include a Schema_Versioning_Policy_Doc at `shared/contracts/schema-versioning.md`.
2. THE Schema_Versioning_Policy_Doc SHALL state the version-bump rule: the schema version integer increments by exactly one when any required field is renamed, removed, or has its type narrowed; new optional fields MAY be added without a version bump.
3. THE Schema_Versioning_Policy_Doc SHALL state the migration requirement: every version bump SHALL ship a corresponding migration module under `shared/schemas/migrations/` named `v<source>-to-v<target>.ts` and registered in Schema_Migration_Registry.
4. THE Schema_Versioning_Policy_Doc SHALL state the property-test requirement: every migration SHALL be accompanied by a forward Property_Test (round-trip lossless on the field set the migration claims to handle) and a reverse Property_Test (best-effort `rollback` followed by `migrate` returns a record equal to the original on the lossless field subset).
5. THE Schema_Versioning_Policy_Doc SHALL state the schema-URI hard-break rule: when a schema file is renamed, the previous file is deleted in the same cut, no HTTP redirect is stood up, and the only forward path for persisted records is in-flight migration through Schema_Migration_Registry.
6. THE Schema_Versioning_Policy_Doc SHALL document the v8-to-v9 cut as the first concrete application of the policy and link to V8_To_V9_Migration.
7. THE Schema_Versioning_Policy_Doc SHALL document the package-version bump rule: a schema version bump on a published-package surface (currently `RunRecord`) SHALL also bump the `package.json` minor version while the package remains pre-1.0.

### Requirement 8 — Migration framework

**User Story:** As a kernel maintainer, I want a minimal migration framework with one file per version bump, so that adding the next migration is a five-minute mechanical task with no plugin architecture to learn.

#### Acceptance Criteria

1. THE Kernel SHALL include a directory `shared/schemas/migrations/`.
2. THE `shared/schemas/migrations/` directory SHALL contain exactly one TypeScript module per version bump named `v<source>-to-v<target>.ts` where `target = source + 1`.
3. THE Kernel SHALL include a Schema_Migration_Registry at `shared/schemas/migrations/index.ts`.
4. THE Schema_Migration_Registry SHALL export a value named `runRecordMigrations` whose runtime type is a record keyed by source schema version (integer) and whose value at key `v` is the migration module that takes a record at version `v` and returns a record at version `v + 1`.
5. THE Schema_Migration_Registry SHALL be the only construct in the Kernel that knows the set of available migrations; engine-store storage layers SHALL look up migrations through this registry only.
6. WHERE a future cut adds version `v+1`, THE Kernel SHALL require exactly two changes to register the new migration: (a) add the file `v<v>-to-v<v+1>.ts`, (b) add one entry to `runRecordMigrations` keyed by `v`. No plugin discovery, no CLI, no runtime registration.
7. EACH migration module SHALL export a function `migrate(record: unknown): unknown` and a function `rollback(record: unknown): unknown`; the `migrate` export is mandatory and SHALL throw if `record.schemaVersion !== <source>`; the `rollback` export is best-effort and MAY return a partial record annotated with the fields it could not reconstruct.

### Requirement 9 — V8 to V9 migration content

**User Story:** As a kernel adopter with v8 records on disk, I want the v8-to-v9 migration to handle every renamed field and the `$schema` URI rewrite, so that my existing records are readable after the upgrade.

#### Acceptance Criteria

1. THE V8_To_V9_Migration SHALL be located at `shared/schemas/migrations/v8-to-v9.ts`.
2. WHEN `migrate(record)` is invoked with a record at `record.schemaVersion === 8`, THE V8_To_V9_Migration SHALL return a record at `record.schemaVersion === 9`.
3. THE V8_To_V9_Migration `migrate` function SHALL rewrite every JSON property key whose name contains a Vocabulary_Rename_Set left-hand side to the corresponding right-hand side, applied in `camelCase` for object keys.
4. THE V8_To_V9_Migration `migrate` function SHALL rewrite the `$schema` field from `shared/schemas/directive-engine-run-record.schema.json` (or the equivalent absolute URI `https://directive-workspace.dev/schemas/directive-engine-run-record.schema.json`) to `shared/schemas/run-record.schema.json` (or `https://directive-workspace.dev/schemas/run-record.schema.json` respectively, preserving the absolute-vs-relative form).
5. THE V8_To_V9_Migration `migrate` function SHALL set the result `schemaVersion` to `9`.
6. THE V8_To_V9_Migration `migrate` function SHALL preserve the `recordKind` field, the `runId` field, all timestamps, and every other field whose name does not match a Vocabulary_Rename_Set left-hand side.
7. WHEN `rollback(record)` is invoked with a record at `record.schemaVersion === 9`, THE V8_To_V9_Migration SHALL return a best-effort record at `record.schemaVersion === 8` with the field-name rewrites and `$schema` URI reversed; `rollback` MAY mark the result as partial in a comment in the source file but SHALL NOT throw on lossless inputs.
8. THE V8_To_V9_Migration source file SHALL contain a header comment listing every Vocabulary_Rename_Set field it handles.

### Requirement 10 — Storage version check

**User Story:** As a kernel adopter, I want the engine store to apply migrations on read transparently and refuse future-version records loudly, so that mixed-version directive roots either work or fail with a clear error.

#### Acceptance Criteria

1. WHEN any engine-store storage layer reads a record from disk or from in-memory state, THE Storage_Version_Check SHALL inspect `record.schemaVersion` before returning the record.
2. WHEN `record.schemaVersion === Current_Schema_Version`, THE Storage_Version_Check SHALL return the record unchanged.
3. WHEN `record.schemaVersion < Current_Schema_Version` and a chain of migrations from `record.schemaVersion` to `Current_Schema_Version` exists in Schema_Migration_Registry, THE Storage_Version_Check SHALL apply each migration in source-version order until the record is at `Current_Schema_Version`, then return the migrated record.
4. IF `record.schemaVersion < Current_Schema_Version` and any required migration is missing from Schema_Migration_Registry, THEN THE Storage_Version_Check SHALL throw an error whose message starts with `schema_version_unmigratable:` and includes both the source version and the target version.
5. IF `record.schemaVersion > Current_Schema_Version`, THEN THE Storage_Version_Check SHALL throw an error whose message starts with `schema_version_future:` and includes both the record's version and `Current_Schema_Version`.
6. THE Storage_Version_Check SHALL be applied in `engine/storage.ts` for both `readRun(runId)` and `listRuns()`.
7. THE Storage_Version_Check SHALL be applied in `createMemoryDirectiveEngineStore` for the same two read paths.
8. THE Storage_Version_Check SHALL NOT mutate the record on disk; migrations are in-flight only. The on-disk migrate-on-disk CLI is out of scope per the locked spec scope.

### Requirement 11 — CI naming-lint script

**User Story:** As a kernel maintainer, I want a CI lint that fails on new naming-rule violations, so that the Naming_Rename_Table renames stay applied and the next PR cannot quietly reintroduce a `Directive`-prefixed file or a folder-name-prefix offender.

#### Acceptance Criteria

1. THE Kernel SHALL include a Naming_Lint_Script at `scripts/check-naming.ts`.
2. THE Naming_Lint_Script SHALL scan TypeScript files under `discovery/`, `runtime/`, `architecture/`, `engine/`, `shared/`, `hosts/`, and `scripts/` and JSON Schema files under `shared/schemas/`.
3. THE Naming_Lint_Script SHALL flag any file whose basename matches `^directive-` and whose path is inside the Kernel.
4. THE Naming_Lint_Script SHALL flag any file whose basename starts with the immediate parent folder name followed by `-` (e.g., a file under `runtime/lib/openers/` whose basename starts with `openers-`).
5. THE Naming_Lint_Script SHALL flag any exported TypeScript type, interface, class, or function whose declared name matches `^Directive[A-Z]` (excluding occurrences inside files explicitly listed in an allowlist constant within the lint script for known-grandfathered exports).
6. THE Naming_Lint_Script SHALL flag any double-prefix offender (a basename matching `^<prefix>-<prefix>-` where `<prefix>` repeats, such as `runtime-runtime-capability-...`).
7. WHEN the Naming_Lint_Script finds zero violations, THE Naming_Lint_Script SHALL exit with code `0`.
8. IF the Naming_Lint_Script finds at least one violation, THEN THE Naming_Lint_Script SHALL print one line per violation to stderr in the form `<rule>: <file>: <detail>` and exit with code `1`.
9. THE Kernel SHALL register the Naming_Lint_Script as the `check:naming` script in `package.json` invoked via `tsx scripts/check-naming.ts`.
10. THE Kernel SHALL add a `check:naming` step to `.github/workflows/ci.yml` between `typecheck` and `test`, gated as required.
11. THE Kernel SHALL include a Vitest unit test under `tests/unit/check-naming.test.ts` that imports the Naming_Lint_Script's exported scan function (or a refactor-extracted helper), feeds it a synthetic file tree containing one violation per rule, and asserts each rule fires exactly once on its target.

### Requirement 12 — Package version bump

**User Story:** As a kernel adopter pinning a version, I want this cut to ship as `0.2.0`, so that the schema break and the rename-driven public-surface churn are encoded in the package version per semver-pre-1.0 minor-bump conventions.

#### Acceptance Criteria

1. THE Kernel SHALL set the `package.json` `version` field to `0.2.0` on the cut that lands V8_To_V9_Migration and the Naming_Rename_Table renames.
2. THE Kernel SHALL leave every other workspace package's version field untouched in this cut.
3. THE Kernel SHALL document the bump in `Fix_Plan.md` per Requirement 15.

### Requirement 13 — Public exports continuity

**User Story:** As a kernel adopter who imports kernel modules through the package's `exports` map, I want the subpath keys to be preserved and the targets to be retargeted to renamed files, so that my import paths still work after the cut even though the implementation files moved.

#### Acceptance Criteria

1. WHERE a `package.json` `exports` subpath key currently points at a file affected by Naming_Rename_Table, THE Kernel SHALL update the file path in every condition (`development`, `types`, `import`, `default`) to the post-rename file path.
2. WHERE a `package.json` `exports` subpath key currently points at the deleted schema file `shared/schemas/directive-engine-run-record.schema.json` directly or through any condition, THE Kernel SHALL update the path to `shared/schemas/run-record.schema.json`.
3. THE Kernel SHALL preserve the set of subpath keys in the Public_Exports_Map (no key added, no key removed) for this cut.
4. THE Kernel SHALL NOT introduce a new condition (e.g., a new `node` or `browser` condition) in the Public_Exports_Map for this cut.
5. AFTER the cut lands, THE Kernel SHALL pass `pnpm run check:build` with the renamed targets resolvable from compiled `dist/` per the F2 verification gate.

### Requirement 14 — Property tests

**User Story:** As a kernel maintainer, I want property tests covering the v8-to-v9 migration round-trip and the engine-store sequenced migration dispatch, so that future migrations inherit the same test pattern and the v8-to-v9 step is statistically guarded against field-rename slips.

#### Acceptance Criteria

1. THE Kernel SHALL include a Property_Test under `tests/property/` that, given an arbitrary v8-shaped record generated by `fast-check`, asserts `migrate(record)` produces a v9-shaped record whose lossless-field subset (defined as every field whose key does not match a Vocabulary_Rename_Set left-hand side) is structurally equal to the v8 input on those keys.
2. THE Kernel SHALL include a Property_Test under `tests/property/` that, given an arbitrary v8-shaped record, asserts `rollback(migrate(record))` reproduces the original v8 record on the lossless-field subset.
3. THE Kernel SHALL include a Property_Test under `tests/property/` that, given an arbitrary v7-shaped record (generated synthetically), asserts the engine store's Storage_Version_Check applies migrations in source-version order from 7 → 8 → 9 (once the v7-to-v8 migration is added; in this cut, the test SHALL assert that the registry is the only dispatcher and that calling it with a missing chain raises `schema_version_unmigratable:`).
4. THE Kernel SHALL include a Property_Test under `tests/property/` that, given an arbitrary record at `Current_Schema_Version`, asserts the Storage_Version_Check returns it unchanged.
5. EACH Property_Test in this requirement SHALL run with at least 100 generated examples per property.

### Requirement 15 — Hardening test additions

**User Story:** As a kernel maintainer, I want hardening tests that cover the v7/v8/v9/v10 read paths, so that the four documented behaviors of Storage_Version_Check (refuse-too-old, migrate-in-flight, pass-through, refuse-future) each have a regression guard.

#### Acceptance Criteria

1. THE Kernel SHALL extend `tests/integration/hardening/` (or add a new file under that directory) with the four Hardening_Tests in clauses 2 through 5.
2. WHEN the engine-store storage layer reads a synthetic record whose `schemaVersion === 7` and no v7-to-v8 migration is registered, THE Hardening_Test SHALL assert the read raises an error whose message starts with `schema_version_unmigratable:` and references both `7` and `Current_Schema_Version`.
3. WHEN the engine-store storage layer reads a synthetic record whose `schemaVersion === 8`, THE Hardening_Test SHALL assert the read returns a record at `schemaVersion === 9` with the Vocabulary_Rename_Set field renames applied and the `$schema` URI rewritten, and SHALL assert the on-disk file (when applicable) was not mutated.
4. WHEN the engine-store storage layer reads a synthetic record whose `schemaVersion === 9`, THE Hardening_Test SHALL assert the read returns the record unchanged on every field.
5. WHEN the engine-store storage layer reads a synthetic record whose `schemaVersion === 10`, THE Hardening_Test SHALL assert the read raises an error whose message starts with `schema_version_future:` and references both `10` and `Current_Schema_Version`.

### Requirement 16 — Final verification gate and Fix_Plan outcome

**User Story:** As a kernel maintainer closing this cut, I want a single verification gate that names every command and a Fix_Plan outcome paragraph for each of F4, F7, and F11, so that the cut is reviewable in one pass and the project log records what shipped.

#### Acceptance Criteria

1. WHEN the cut is presented as ready to merge, THE Kernel SHALL pass `pnpm run typecheck` with no errors.
2. WHEN the cut is presented as ready to merge, THE Kernel SHALL pass `pnpm run test` with no failures.
3. WHEN the cut is presented as ready to merge, THE Kernel SHALL pass `pnpm run check:build` with no failures.
4. WHEN the cut is presented as ready to merge, THE Kernel SHALL pass the new `pnpm run check:naming` with no violations.
5. THE Kernel SHALL update `Fix_Plan.md` to mark F4, F7, and F11 as `✅ done` in the status table at the top of the file.
6. THE Kernel SHALL add an `**Outcome.**` paragraph plus a `**Components delivered.**` list, a `**Side fixes during F4/F7/F11.**` list (combined or per-item, whichever is clearer), and a `**Verification.**` block to the F4, F7, and F11 sections of `Fix_Plan.md`, following the same format used in the F1 and F15 sections of that document.
7. THE Kernel SHALL add an `**Unblocks:**` line at the end of each F4/F7/F11 section listing any Fix_Plan items that this cut newly enables (at minimum, F5 and F8 for the surface-area work, and F13 for the schema-versioning policy that will inform the locking story).
