# Requirements Document

## Introduction

The `@directive/kernel` package has reached schema version 8 with deep branching logic in routing, the decision-policy ledger, the approval boundary, and process fingerprinting, but it has no kernel-level test runner. The two existing custom check scripts (`check:first-integration` and `check:hardening`) are bespoke `node --experimental-strip-types` entry points that produce free-text output and are not a harness.

This feature delivers F1 from `Fix_Plan.md`: a real test infrastructure for the TypeScript kernel root package. It wires up Vitest as the runner, introduces `fast-check` for property-based tests on four invariant-bearing modules, adds unit tests for the lane definitions, migrates the two custom check scripts into structured Vitest integration suites, and adds a CI workflow that runs `typecheck` + `test` on push.

This is the unblocking item for F2, F4, F7, F11, F13, and F14 from the Fix Plan. The scope is the harness plus a representative first batch of tests; exhaustive coverage is later work.

## Glossary

- **Kernel**: The root TypeScript package `@directive/kernel` at the repository root. Excludes `ui/`, `discovery/research-engine/`, and `hosts/integration-kit/` which are pnpm workspace members with their own test stories.
- **Test_Runner**: Vitest, configured to execute `.ts` test files directly without a JS build step.
- **Property_Test**: A test written with `fast-check` that asserts a universal property over generated inputs, configured to run at least 100 iterations per property.
- **Unit_Test**: A test that asserts behavior for a specific, named input or scenario.
- **Integration_Suite**: A Vitest suite that exercises the engine, host, or hardening flows end-to-end. Migrated from the existing `check:first-integration` and `check:hardening` scripts.
- **Fingerprint_Module**: `engine/process-fingerprint.ts`.
- **Decision_Ledger_Module**: `engine/decision-policy-ledger.ts`, including its suggestion compiler in `engine/decision-policy-ledger-suggestions.ts`.
- **Approval_Boundary_Module**: `engine/approval-boundary.ts`.
- **Source_Normalization_Module**: `engine/source-input-normalization.ts`.
- **Lane_Definitions_Module**: `engine/directive-workspace-lanes.ts`. Defines three lanes (discovery, architecture, runtime) and their plan callbacks (`planExtraction`, `planAdaptation`, `planImprovement`, `planProof`, optionally `planIntegration`).
- **CI_Workflow**: A GitHub Actions workflow file at `.github/workflows/ci.yml` that runs on push and pull request.
- **Repo_TS_Config**: `tsconfig.repo.json` at the repository root. Target ES2022, module ESNext, moduleResolution Bundler, `allowImportingTsExtensions: true`, `verbatimModuleSyntax: true`.

## Requirements

### Requirement 1 — Vitest as the kernel test runner

**User Story:** As a kernel contributor, I want a single command to run every kernel test, so that I can validate changes locally and in CI without invoking bespoke scripts.

#### Acceptance Criteria

1. THE Kernel SHALL include `vitest` as a `devDependency` in the root `package.json`.
2. THE Kernel SHALL include `fast-check` as a `devDependency` in the root `package.json`.
3. THE Kernel SHALL define a `test` script in the root `package.json` that runs Vitest in single-run mode and exits with the Vitest exit code.
4. THE Kernel SHALL define a `test:watch` script in the root `package.json` that runs Vitest in watch mode.
5. THE Kernel SHALL include a `vitest.config.ts` file at the repository root that resolves and executes `.ts` test files directly without requiring a JS compile step.
6. WHEN the Test_Runner resolves an import that uses the `.ts` extension, THE Test_Runner SHALL load the file and not raise an "unknown extension" error.
7. THE Test_Runner SHALL respect the compiler options declared in Repo_TS_Config when type-checking and resolving test files.
8. THE Test_Runner SHALL exclude the `ui/`, `discovery/research-engine/`, `hosts/integration-kit/`, `node_modules/`, `local/`, and `state/` directories from test discovery.
9. WHEN `pnpm run test` is invoked from the repository root with no failing tests, THE Test_Runner SHALL exit with status code 0.
10. IF any test fails, THEN THE Test_Runner SHALL exit with a non-zero status code and report the failing test name, file, and assertion.

### Requirement 2 — Test directory layout

**User Story:** As a kernel contributor, I want a predictable place to put unit, property, and integration tests, so that I do not have to invent layout decisions per change.

#### Acceptance Criteria

1. THE Kernel SHALL include a `tests/` directory at the repository root with subdirectories `tests/unit/`, `tests/property/`, and `tests/integration/`.
2. THE Test_Runner SHALL discover test files matching `tests/**/*.test.ts`.
3. THE Kernel SHALL include a `tests/README.md` file that documents the purpose of each subdirectory and the test file naming convention.

### Requirement 3 — Property tests for the fingerprint module

**User Story:** As a kernel contributor, I want property tests on `process-fingerprint.ts`, so that I can trust deduplication and run-matching logic across arbitrary inputs.

#### Acceptance Criteria

1. THE Kernel SHALL include at least one Property_Test file under `tests/property/` covering Fingerprint_Module.
2. WHEN the same input is passed to the fingerprint function twice, THE Fingerprint_Module SHALL return identical hash values for both calls.
3. WHEN two inputs differ in any field that the fingerprint function considers semantically meaningful, THE Fingerprint_Module SHALL return different hash values for the two inputs.
4. THE Property_Test for Fingerprint_Module SHALL run with at least 100 generated examples per property.

### Requirement 4 — Property tests for the decision-policy ledger

**User Story:** As a kernel contributor, I want property tests on the decision-policy ledger, so that the append-only ledger and its suggestion compiler stay correct as the ledger format evolves.

#### Acceptance Criteria

1. THE Kernel SHALL include at least one Property_Test file under `tests/property/` covering Decision_Ledger_Module.
2. WHEN entries are appended to the Decision_Ledger_Module in any order, THE Decision_Ledger_Module SHALL preserve every previously appended entry in its original position.
3. WHEN the suggestion compiler is invoked twice with the same ledger contents, THE Decision_Ledger_Module SHALL produce identical suggestion outputs for both invocations.
4. THE Property_Test for Decision_Ledger_Module SHALL run with at least 100 generated examples per property.

### Requirement 5 — Property tests for the approval boundary

**User Story:** As a kernel contributor, I want property tests on the approval boundary guards, so that disallowed states cannot slip past the runtime invariant under any generated input.

#### Acceptance Criteria

1. THE Kernel SHALL include at least one Property_Test file under `tests/property/` covering Approval_Boundary_Module.
2. WHEN an input represents a state that the Approval_Boundary_Module documents as disallowed, THE Approval_Boundary_Module SHALL reject the input and surface a defined error.
3. WHEN an input represents a state that the Approval_Boundary_Module documents as allowed, THE Approval_Boundary_Module SHALL accept the input and not raise an error.
4. THE Property_Test for Approval_Boundary_Module SHALL run with at least 100 generated examples per property.

### Requirement 6 — Property tests for source-input normalization

**User Story:** As a kernel contributor, I want property tests on `source-input-normalization.ts`, so that ingestion remains stable under repeated normalization passes.

#### Acceptance Criteria

1. THE Kernel SHALL include at least one Property_Test file under `tests/property/` covering Source_Normalization_Module.
2. WHEN a source input is normalized once and the result is normalized again, THE Source_Normalization_Module SHALL produce a result equal to the result of the first normalization.
3. THE Property_Test for Source_Normalization_Module SHALL run with at least 100 generated examples per property.

### Requirement 7 — Unit tests for lane definitions

**User Story:** As a kernel contributor, I want unit tests for every plan callback in the lane definitions, so that lane-specific behavior is verified by name and a regression in any plan callback is surfaced immediately.

#### Acceptance Criteria

1. THE Kernel SHALL include at least one Unit_Test file under `tests/unit/` covering Lane_Definitions_Module.
2. WHEN `createDirectiveWorkspaceEngineLanes` is invoked with no overrides, THE Lane_Definitions_Module SHALL return a lane set containing exactly three lanes with `laneId` values `discovery`, `architecture`, and `runtime`.
3. WHILE running unit tests for Lane_Definitions_Module, THE Unit_Test suite SHALL invoke `planExtraction`, `planAdaptation`, `planImprovement`, and `planProof` on each of the three lanes and assert at least one structural property of each returned plan.
4. WHEN `planProof` is invoked on the runtime lane with a routing assessment whose `transformationSignal` is greater than zero, THE Lane_Definitions_Module SHALL return a plan whose `proofKind` is `runtime_transformation_proof`.
5. WHEN `planProof` is invoked on the runtime lane with a routing assessment whose `transformationSignal` is zero, THE Lane_Definitions_Module SHALL return a plan whose `proofKind` is `runtime_proof`.
6. WHEN `planIntegration` is invoked on the architecture lane, THE Lane_Definitions_Module SHALL return an integration proposal whose `nextAction` is a non-empty string.

### Requirement 8 — Integration suite migrated from `check:first-integration`

**User Story:** As a kernel contributor, I want the first-integration check to run as part of `pnpm test`, so that it produces structured pass/fail output and shares the harness with every other test.

#### Acceptance Criteria

1. THE Kernel SHALL include an Integration_Suite file under `tests/integration/` that exercises the flow currently exercised by `scripts/check-first-integration.ts`.
2. THE Integration_Suite for first-integration SHALL preserve every assertion present in `scripts/check-first-integration.ts` at the time of migration.
3. WHEN `pnpm run test` is invoked, THE Test_Runner SHALL execute the migrated first-integration Integration_Suite.
4. THE Kernel SHALL retain a `check:first-integration` script in `package.json` that invokes the migrated Integration_Suite via Vitest, so that existing call sites continue to work.

### Requirement 9 — Integration suite migrated from `check:hardening`

**User Story:** As a kernel contributor, I want the hardening check to run as part of `pnpm test`, so that the cross-component invariants it covers are gated by the same harness as every other test.

#### Acceptance Criteria

1. THE Kernel SHALL include Integration_Suite files under `tests/integration/` that exercise every check function invoked from `scripts/check-system-hardening.ts`.
2. THE Integration_Suite for hardening SHALL preserve every assertion present in the helper modules under `scripts/hardening/` at the time of migration.
3. WHEN `pnpm run test` is invoked, THE Test_Runner SHALL execute the migrated hardening Integration_Suite.
4. THE Kernel SHALL retain a `check:hardening` script in `package.json` that invokes the migrated Integration_Suite via Vitest, so that existing call sites continue to work.

### Requirement 10 — CI workflow

**User Story:** As a kernel maintainer, I want CI to run typecheck and tests on every push and pull request, so that breakage is caught before merge.

#### Acceptance Criteria

1. THE Kernel SHALL include a GitHub Actions workflow file at `.github/workflows/ci.yml`.
2. WHEN a commit is pushed to any branch, THE CI_Workflow SHALL run.
3. WHEN a pull request is opened or updated, THE CI_Workflow SHALL run.
4. THE CI_Workflow SHALL install dependencies with `pnpm` at the version declared in the root `package.json` `packageManager` field.
5. THE CI_Workflow SHALL execute `pnpm run typecheck`.
6. THE CI_Workflow SHALL execute `pnpm run test`.
7. IF either `pnpm run typecheck` or `pnpm run test` exits with a non-zero status, THEN THE CI_Workflow SHALL fail the job.
