# Requirements Document

## Introduction

`shared/schemas/` holds ~30 JSON Schemas. `hosts/integration-kit/examples/` holds 7 example payloads. `hosts/standalone-host/examples/` holds 4 more. The standalone-host bootstrap writes additional inline examples. Today there is no CI check that asserts any example payload validates against its schema. The first time a schema field is renamed (as just happened in the v9 cut, F4 + F7), every example silently lies until someone notices.

This feature adds a CI gate at `pnpm run check:examples` that walks every example JSON under known example roots, resolves the example to its schema (via `$schema` field or filename convention), validates with `ajv`, and exits non-zero on any failure. The gate runs in CI between `check:naming` and `test`.

The check is read-only: it does not edit examples or schemas; it only fails fast when they drift.

The work depends on F1 (test infrastructure) ✅ done.

## Glossary

- **Kernel**: The root TypeScript package `@directive/kernel`. Excludes `ui/`, `discovery/research-engine/`, and `dist/`.
- **Schema_File**: Any `.schema.json` file under `shared/schemas/` or its `migrations/` subdirectory. Currently 30 files.
- **Example_Root**: One of the four directories `hosts/integration-kit/examples/`, `hosts/standalone-host/examples/`, `runtime/meta/`, and `tests/integration/fixtures/` (the last only if it ships example payloads).
- **Example_File**: Any `.json` file under an Example_Root, including the standalone-host scaffold's generated examples once they have been written into `runtime/host-artifacts/` during a `pnpm try` run (which we explicitly do NOT recurse into; only the source-tree examples count).
- **Schema_Resolver**: The function that maps an Example_File path to the matching Schema_File. Tries `$schema` field on the JSON document first; falls back to filename convention (`<name>.example.json` → `<name>.schema.json`).
- **AJV_Validator**: The `ajv` library configured for JSON Schema draft 2020-12, with `allErrors: true` and `strict: false` (since some schemas use `$id` URIs that don't resolve to live URLs).
- **Drift_Report**: The structured output produced by the check on failure: a list of `{ examplePath, schemaPath, errors[] }` records printed to stderr.
- **CI_Step**: The line `- run: pnpm run check:examples` inserted in `.github/workflows/ci.yml` between `check:naming` (or `check:contracts` if it's still the immediate predecessor) and `test`.

## Requirements

### Requirement 1 — Schema_Resolver

**User Story:** As a kernel maintainer, I want the check to resolve every example to its schema deterministically so that adding a new schema/example pair requires zero registration code.

#### Acceptance Criteria

1. THE Schema_Resolver SHALL attempt to read the `$schema` field of an Example_File first. WHERE the field is present and is a string starting with `shared/schemas/`, the resolver SHALL treat that path (relative to repo root) as the schema target.
2. WHERE the `$schema` field is absent, THE Schema_Resolver SHALL apply the filename convention: an Example_File named `<basename>.example.json` resolves to `shared/schemas/<basename>.schema.json`. An Example_File named `<basename>.json` (no `.example` suffix) resolves to `shared/schemas/<basename>.schema.json` only if such a file exists.
3. WHERE neither rule resolves to an existing Schema_File, THE Schema_Resolver SHALL emit one Drift_Report row with `schemaPath: null` and `errors: [{ kind: "no_schema_resolved", reason: "..." }]` and the check SHALL fail.
4. THE Schema_Resolver SHALL NOT silently skip examples for which no schema was found.

### Requirement 2 — Validation pass

**User Story:** As a CI reviewer, I want a single command that validates every example against its schema and produces actionable diff output on failure.

#### Acceptance Criteria

1. THE Kernel SHALL include a script `scripts/check-example-schemas.ts` that walks every Example_Root, reads every Example_File, resolves the matching Schema_File via Schema_Resolver, and validates with AJV_Validator.
2. WHEN every example validates, THE script SHALL exit zero and print a one-line summary to stdout: `check:examples ok — <N> examples validated against <M> schemas`.
3. WHEN any example fails validation, THE script SHALL exit non-zero and print a Drift_Report to stderr including, for each failing example, the example path, the resolved schema path, and the AJV error list (using AJV's `betterErrors` or compact formatter).
4. THE script SHALL exit non-zero if any Example_File cannot be parsed as JSON.
5. THE script SHALL exit non-zero if any resolved Schema_File cannot be parsed as JSON.

### Requirement 3 — `pnpm run check:examples`

**User Story:** As a developer, I want a top-level pnpm script so that the check can be invoked locally without remembering a `tsx` command.

#### Acceptance Criteria

1. THE `package.json` at the repository root SHALL include the script `"check:examples": "tsx scripts/check-example-schemas.ts"` in its `scripts` map.
2. WHEN `pnpm run check:examples` runs against a clean kernel, THE Kernel SHALL exit zero.

### Requirement 4 — CI integration

**User Story:** As a maintainer, I want the check to run on every push and PR so that schema-example drift is caught before merge.

#### Acceptance Criteria

1. THE `.github/workflows/ci.yml` SHALL include a step `- run: pnpm run check:examples`.
2. THE `check:examples` step SHALL run after `check:contracts` and before `test`.
3. THE `check:examples` step SHALL run on the same Node version and pnpm version as the existing CI steps.

### Requirement 5 — `ajv` dependency

**User Story:** As a maintainer, I want the schema validator to be a real, pinned, well-known dependency so that the check can validate JSON Schema 2020-12 features used by the kernel's schemas.

#### Acceptance Criteria

1. THE `package.json` at the repository root SHALL declare `ajv` and `ajv-formats` as `devDependencies` with exact pinned versions (no `^` or `~` range).
2. WHERE the kernel's schemas use `$id` URIs that do not resolve to live URLs, THE AJV_Validator SHALL be configured with `strict: false` so the validator does not refuse to compile the schema.
3. WHERE a schema declares a `format` keyword (e.g. `date-time`, `uri`), THE AJV_Validator SHALL apply the matching `ajv-formats` validator.

### Requirement 6 — Coverage requirement

**User Story:** As a kernel maintainer, I want every Schema_File that ships an example to have at least one example validate against it so that the check has a meaningful baseline.

#### Acceptance Criteria

1. WHEN the audit pass identifies a Schema_File with at least one Example_File pointing at it via Schema_Resolver, THE check SHALL validate that pair.
2. WHERE a Schema_File has no Example_File pointing at it, THE check MAY skip it; the absence of an example is not itself a failure.
3. WHEN the audit pass produces a coverage report `schema-example-coverage.csv`, THE Kernel SHOULD commit it alongside the script, listing every Schema_File and the count of Example_Files referencing it.

### Requirement 7 — Verification gate

**User Story:** As a reviewer, I want a single command set that proves the check works so that I can land it without guessing.

#### Acceptance Criteria

1. WHEN `pnpm run check:examples` runs against the current state of the kernel, THE script SHALL exit zero with a non-zero example count.
2. WHEN a maintainer deliberately corrupts one example field (e.g. flipping `runId` to a number), THE script SHALL exit non-zero on the next invocation and SHALL name the corrupted example in the Drift_Report.
3. WHEN `pnpm run typecheck`, `pnpm run test`, `pnpm run check:build`, and `pnpm run check:naming` run after the spec is implemented, THE Kernel SHALL exit zero on each.
