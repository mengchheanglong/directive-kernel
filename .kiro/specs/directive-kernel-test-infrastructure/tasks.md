# Implementation Plan: Directive Kernel Test Infrastructure

## Overview

Wire up Vitest as the kernel's test runner, add fast-check property tests for four invariant-bearing modules, add unit tests for the lane definitions, migrate the two custom check scripts into Vitest integration suites, and add a GitHub Actions CI workflow. Tasks are ordered so the harness lands first, then property tests, then unit tests, then integration migration, then CI. Each task has a clear done condition and is sized at roughly 1–4 hours.

## Tasks

- [x] 1. Install Vitest and fast-check, add test scripts
  - Add `vitest@^2.1.0` and `fast-check@^3.22.0` to `devDependencies` in the root `package.json`
  - Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts
  - Run `pnpm install` to refresh the lockfile
  - Verify `pnpm exec vitest --version` resolves
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Create the Vitest config
  - Add `vitest.config.ts` at the repository root using the shape in the design (`include`, `exclude`, `pool: "forks"`, `globals: false`, `environment: "node"`, `testTimeout: 30_000`)
  - Confirm the `exclude` list covers `ui/**`, `discovery/research-engine/**`, `hosts/integration-kit/**`, `local/**`, `state/**`, `node_modules/**`, `dist/**`
  - _Requirements: 1.5, 1.6, 1.7, 1.8_

- [x] 3. Create the tests/ directory tree
  - Create `tests/unit/`, `tests/property/`, `tests/integration/`
  - Create `tests/property/_arbitraries/` for shared generators
  - Add `tests/README.md` documenting the subdirectory purpose and naming convention (`*.test.ts`, `*.property.test.ts`)
  - Add a single trivial smoke test (e.g. `tests/unit/_smoke.test.ts` asserting `1 + 1 === 2`) to confirm Vitest discovers files
  - Run `pnpm run test` and verify the smoke test passes and exit code is 0
  - Delete the smoke test once confirmed
  - _Requirements: 1.9, 2.1, 2.2, 2.3_

- [x] 4. Build shared arbitrary library
  - [x] 4.1 Add `tests/property/_arbitraries/source-input.ts`
    - Export `sourceInputArb` matching the `DirectiveEngineSourceItem` shape consumed by the fingerprint and normalization modules
    - Cover all required fields with sensible value ranges; avoid empty strings unless the source code accepts them
    - _Requirements: 3.1, 6.1_
  - [x] 4.2 Add `tests/property/_arbitraries/ledger-entry.ts`
    - Export `ledgerEntryArb` for decision-policy ledger entries
    - _Requirements: 4.1_
  - [x] 4.3 Add `tests/property/_arbitraries/approval-state.ts`
    - Export `approvalStateArb` returning a tagged `{ kind: "allowed" | "disallowed", state }` so the same generator drives both Property 5 directions
    - _Requirements: 5.1_

- [x] 5. Property tests for `engine/process-fingerprint.ts`
  - [x] 5.1 Add `tests/property/process-fingerprint.property.test.ts`
    - Import `sourceInputArb` and the fingerprint function
    - Implement **Property 1: Fingerprint determinism** — `fingerprint(x) === fingerprint(x)` over `sourceInputArb`
    - Implement **Property 2: Fingerprint sensitivity** — for any `x` and a single-field mutation, hashes differ
    - Both properties run with `{ numRuns: 100 }`
    - Annotate each `it(...)` with a comment referencing the property number from `design.md`
    - **Property 1: Fingerprint determinism**
    - **Property 2: Fingerprint sensitivity to mutation**
    - **Validates: Requirements 3.2, 3.3, 3.4**

- [x] 6. Property tests for `engine/decision-policy-ledger.ts`
  - [x] 6.1 Add `tests/property/decision-policy-ledger.property.test.ts`
    - Import `ledgerEntryArb` and the ledger module
    - Implement **Property 3: Append-only invariant** — for any sequence appended one at a time, every prefix is preserved
    - Implement **Property 4: Suggestion compiler determinism** — `compileSuggestions(L)` deep-equals `compileSuggestions(L)` for any ledger `L`
    - Both properties run with `{ numRuns: 100 }`
    - **Property 3: Decision-policy ledger append-only invariant**
    - **Property 4: Decision-policy suggestion compilation determinism**
    - **Validates: Requirements 4.2, 4.3, 4.4**

- [x] 7. Property tests for `engine/approval-boundary.ts`
  - [x] 7.1 Add `tests/property/approval-boundary.property.test.ts`
    - Import `approvalStateArb` and the boundary guards
    - Implement **Property 5: Classification consistency** — guard rejects iff `kind === "disallowed"`, accepts iff `kind === "allowed"`
    - Run with `{ numRuns: 100 }`
    - **Property 5: Approval boundary classification consistency**
    - **Validates: Requirements 5.2, 5.3, 5.4**

- [x] 8. Property tests for `engine/source-input-normalization.ts`
  - [x] 8.1 Add `tests/property/source-input-normalization.property.test.ts`
    - Import `sourceInputArb` and the normalizer
    - Implement **Property 6: Normalization idempotence** — `normalize(normalize(x))` deep-equals `normalize(x)`
    - Run with `{ numRuns: 100 }`
    - **Property 6: Source-input normalization idempotence**
    - **Validates: Requirements 6.2, 6.3**

- [x] 9. Checkpoint — property tests green
  - Run `pnpm run test` and ensure all property tests pass
  - If any property fails, do not paper over the failure: file the bug under the Fix Plan and decide whether to weaken the property or fix the module before continuing
  - Ask the user if questions arise

- [x] 10. Unit tests for `engine/directive-workspace-lanes.ts`
  - [x] 10.1 Add `tests/unit/engine/_fixtures/lane-planning-inputs.ts`
    - Build representative `DirectiveEngineLaneExtractionPlanningInput`, `...AdaptationPlanningInput`, `...ImprovementPlanningInput`, `...ProofPlanningInput`, and `...IntegrationPlanningInput` fixtures
    - Provide both a "transformationSignal > 0" and "transformationSignal === 0" routing assessment variant
    - _Requirements: 7.3, 7.4, 7.5_
  - [x] 10.2 Add `tests/unit/engine/directive-workspace-lanes.test.ts`
    - Assert `createDirectiveWorkspaceEngineLanes()` returns three lanes with ids `discovery`, `architecture`, `runtime`
    - For each lane, invoke `planExtraction`, `planAdaptation`, `planImprovement`, `planProof` and assert at least one structural property of the returned plan
    - Assert runtime `planProof` returns `proofKind: "runtime_transformation_proof"` when `transformationSignal > 0`
    - Assert runtime `planProof` returns `proofKind: "runtime_proof"` when `transformationSignal === 0`
    - Assert architecture `planIntegration` returns a non-empty `nextAction` string
    - Assert `laneOverrides` are applied (e.g. override `label` and confirm it propagates)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 11. Migrate `check:first-integration` to Vitest
  - [x] 11.1 Add `tests/integration/first-integration.test.ts`
    - Reproduce the goal and source payloads from `scripts/check-first-integration.ts` verbatim
    - Use `beforeAll` to call `runFirstHostIntegrationFlow` once
    - Convert each `assert.equal` from the original script into its own `it(...)` block
    - Use a unique `os.tmpdir()` path per run (timestamp suffix), matching the original
    - _Requirements: 8.1, 8.2_
  - [x] 11.2 Update the `check:first-integration` npm script
    - Change to `"check:first-integration": "vitest run tests/integration/first-integration.test.ts"`
    - _Requirements: 8.3, 8.4_
  - [x] 11.3 Replace the original `scripts/check-first-integration.ts` body with a deprecation shim
    - Print "deprecated; running via Vitest. Use `pnpm run check:first-integration`." and exit 0
    - Keep the file (do not delete) so any external automation that exec'd the script directly does not fail hard
    - _Requirements: 8.4_

- [x] 12. Migrate `check:hardening` to Vitest
  - [x] 12.1 Add `tests/integration/hardening/advisory-checks.test.ts`
    - Wrap `runAdvisoryIntelligenceChecks` in an `it(...)` block
    - If the helper bundles multiple assertions and the split is mechanical, split into multiple `it(...)` blocks; otherwise keep as one
    - _Requirements: 9.1, 9.2_
  - [x] 12.2 Add `tests/integration/hardening/engine-checks.test.ts`
    - Wrap `runDirectiveEngineHardeningChecks`, `runFilesystemStoreCachingChecks`, and `runEngineContractSurfaceChecks`
    - One `it(...)` per helper function
    - _Requirements: 9.1, 9.2_
  - [x] 12.3 Add `tests/integration/hardening/host-checks.test.ts`
    - Wrap `runMissionFeedbackLoopChecks`, `runStarterAndHostChecks`, `runWebHostSmoke`
    - One `it(...)` per helper function
    - _Requirements: 9.1, 9.2_
  - [x] 12.4 Add `tests/integration/hardening/policy-checks.test.ts`
    - Wrap `runRoutingCorrectionLedgerChecks`, `runOutcomeTrackingChecks`, `runDecisionPolicyCompilerChecks`, `runReviewResolutionPolicyCompilerIntegrationCheck`, `runEarnedAutonomyIntegrationCheck`
    - One `it(...)` per helper function
    - _Requirements: 9.1, 9.2_
  - [x] 12.5 Update the `check:hardening` npm script
    - Change to `"check:hardening": "vitest run tests/integration/hardening"`
    - _Requirements: 9.3, 9.4_
  - [x] 12.6 Replace the original `scripts/check-system-hardening.ts` body with a deprecation shim
    - Print "deprecated; running via Vitest. Use `pnpm run check:hardening`." and exit 0
    - Keep the file
    - _Requirements: 9.4_

- [x] 13. Checkpoint — full suite green
  - Run `pnpm run test` and ensure unit, property, and integration tests all pass
  - Run `pnpm run typecheck` to confirm no TypeScript regressions from the new test files (the test files are TS and must satisfy `tsconfig.repo.json`'s `verbatimModuleSyntax` rules)
  - Ask the user if questions arise

- [ ] 14. Add GitHub Actions CI workflow
  - [x] 14.1 Add `.github/workflows/ci.yml`
    - Trigger on `push` and `pull_request`
    - Use `actions/checkout@v4`, `pnpm/action-setup@v4` (reads `packageManager` from `package.json`), `actions/setup-node@v4` with `node-version: "22"` and `cache: "pnpm"`
    - Run `pnpm install --frozen-lockfile`, then `pnpm run typecheck`, then `pnpm run test`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  - [~] 14.2 Verify the workflow on a feature branch
    - Push the branch and confirm the workflow runs and passes on GitHub
    - If the runner cannot pull `pnpm@10.32.1` from the `packageManager` field, pin it explicitly with `pnpm/action-setup@v4` `version` input
    - _Requirements: 10.2, 10.3_

- [~] 15. Final checkpoint — close the F1 work
  - Confirm `pnpm run test` is green locally and in CI
  - Confirm `pnpm run check:first-integration` and `pnpm run check:hardening` still work as call sites (they now route through Vitest)
  - Update `Fix_Plan.md` to mark F1 complete and note any property failures discovered during this work as separate Fix Plan items
  - Ask the user if questions arise

## Notes

- No tasks in this plan are marked optional. The harness, property tests, lane unit tests, integration migration, and CI are all in scope per the user's request and per `Fix_Plan.md` F1.
- Each property test annotates its design property number in a code comment; this is the contract that ties the test back to the design and requirements.
- Helper modules under `scripts/hardening/` are not relocated in this spec. A future cleanup may move them; doing so here would conflate harness wiring with reorganization.
- The two original `check:*` entry-point scripts are kept as deprecation shims for one cycle. They can be deleted in a follow-up once we confirm no external automation depends on them.
- This work is the unblocker for F2, F4, F7, F11, F13, and F14 in `Fix_Plan.md`.
