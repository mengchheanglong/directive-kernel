# Implementation Plan: Schema ↔ example drift CI check

## Overview

Five waves. Add a dependency, write the script, add tests, wire into CI, then a coverage audit.

## Test breakage strategy

Wave 2 (script implementation) is the highest-risk wave because it surfaces existing drift. Expected outcome: the first run of `pnpm run check:examples` against the current kernel produces zero failures (all examples currently align with their schemas after the v9 cut). If it produces failures, those are real bugs to fix in the same wave before moving on.

## Tasks

- [ ] 1. Wave 1 — `ajv` + `ajv-formats` devDeps
  - [ ] 1.1 Add `"ajv": "8.17.1"` and `"ajv-formats": "3.0.1"` to `package.json` `devDependencies`. Use exact pinned versions, no `^` or `~`.
    - _Requirements: 5.1_
  - [ ] 1.2 Run `pnpm install`. Commit `pnpm-lock.yaml`.
  - [ ] 1.3 Wave 1 checkpoint: `pnpm run typecheck` and `pnpm run test` green.

- [ ] 2. Wave 2 — Script + pnpm script entry
  - [ ] 2.1 Create `scripts/check-example-schemas.ts` per `design.md → "scripts/check-example-schemas.ts"`. Uses Ajv2020, addFormats, walks the four EXAMPLE_ROOTS, applies the two-strategy Schema_Resolver, exits zero or one with structured Drift_Report.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 5.2, 5.3_
  - [ ] 2.2 Add `"check:examples": "tsx scripts/check-example-schemas.ts"` to `package.json` `scripts`.
    - _Requirements: 3.1_
  - [ ] 2.3 Run `pnpm run check:examples` against the current kernel. Expected: exits zero. If it fails, fix the offending example or schema in the same wave.
    - _Requirements: 3.2, 7.1_
  - [ ] 2.4 Wave 2 checkpoint: typecheck + test + manual `check:examples` all green.

- [ ] 3. Wave 3 — Tests
  - [ ] 3.1 Create `tests/unit/check-example-schemas.test.ts` with one test per Schema_Resolver strategy. Use synthetic fixtures.
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 3.2 Create `tests/integration/example-drift-detection.test.ts` per `design.md → "Property 2"`. Copy a known-good example to `os.tmpdir()`, corrupt one field, run the script via `child_process.spawn`, assert exit code 1 + drift row present in stderr.
    - _Requirements: 7.2_
  - [ ] 3.3 Wave 3 checkpoint: typecheck + test (now includes new tests) + check:build + check:examples all green.

- [ ] 4. Wave 4 — CI integration
  - [ ] 4.1 Insert `- run: pnpm run check:examples` in `.github/workflows/ci.yml` between `check:contracts` and `test`.
    - _Requirements: 4.1, 4.2_
  - [ ] 4.2 Wave 4 checkpoint: push the branch and verify the CI run passes the new step.
    - _Requirements: 4.3_

- [ ] 5. Wave 5 (optional) — Coverage audit
  - [ ] 5.1 Create `scripts/audit-example-coverage.ts` that lists every Schema_File and counts pointing examples. Write `schema-example-coverage.csv` at the repo root.
    - _Requirements: 6.3_
  - [ ] 5.2 Commit the coverage CSV. Schemas with zero examples are flagged as a follow-up but not a failure.
    - _Requirements: 6.1, 6.2_

- [ ] 6. Final block
  - [ ] 6.1 Update `Fix_Plan.md` F16 row to ✅ done with outcome block.
  - [ ] 6.2 Re-run the full verification gate (typecheck + test + check:build + check:naming + check:contracts + check:examples) and capture the output for the F16 hand-off message.
