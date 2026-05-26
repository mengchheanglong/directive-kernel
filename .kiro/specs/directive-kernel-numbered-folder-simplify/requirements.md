# Requirements Document

## Introduction

The kernel's directive-root scaffold today writes nested numbered folders such as `architecture/04-materialization/04-implementation-targets/`, `architecture/04-materialization/05-implementation-results/`, and so on. The numbers at the top level (`01-experiments/`, `02-adopted/`) survive a `Get-ChildItem` listing in canonical lifecycle order and are useful. The numbers on the second level inside `04-materialization/` no longer encode any ordering relationship to a sibling — they are a hangover from when materialization stages were peers of the experiments/adopted/deferred set. The result is paths like `architecture/04-materialization/04-implementation-targets/2026-04-08-...md` where `04` appears twice and a reader has to mentally strip the duplication.

This feature simplifies the convention. Top-level numbers stay (they survive directory sort and the lifecycle is real). Nested numbers under `architecture/04-materialization/` are dropped. The bootstrap scaffold writer, lane README files, `.gitignore`, and any TypeScript path constants that encode the old paths are updated atomically. A migration helper is **not** in scope: existing directive-roots in consuming projects keep their old folders until the consumer chooses to rename them.

The work depends on F1 (test infrastructure) ✅ done.

## Glossary

- **Kernel**: The root TypeScript package `@directive/kernel`. Excludes `ui/`, `discovery/research-engine/`, and `hosts/integration-kit/` workspace members.
- **Scaffold_Writer**: The function `createDirectiveRootScaffold` in `hosts/standalone-host/bootstrap.ts` that returns the list of relative directory paths the standalone host's `init` command creates inside a fresh directive-root.
- **Old_Materialization_Paths**: The six paths `architecture/04-materialization/04-implementation-targets/`, `architecture/04-materialization/05-implementation-results/`, `architecture/04-materialization/06-retained/`, `architecture/04-materialization/07-integration-records/`, `architecture/04-materialization/08-consumption-records/`, `architecture/04-materialization/09-post-consumption-evaluations/`.
- **New_Materialization_Paths**: The six paths `architecture/04-materialization/implementation-targets/`, `architecture/04-materialization/implementation-results/`, `architecture/04-materialization/retained/`, `architecture/04-materialization/integration-records/`, `architecture/04-materialization/consumption-records/`, `architecture/04-materialization/post-consumption-evaluations/`.
- **Path_Constant**: Any TypeScript `const` or `as const` literal in `engine/`, `architecture/`, `discovery/`, `runtime/`, `shared/`, `hosts/`, or `scripts/` whose value is one of the Old_Materialization_Paths or contains one as a prefix.
- **Lane_README**: The four files `discovery/README.md`, `runtime/README.md`, `architecture/README.md`, and `architecture/lib/README.md`.
- **Repo_Doc**: The five files `README.md`, `Tech_Blueprint.md`, `Fix_Plan.md`, `CONTRIBUTING.md`, `GLOSSARY.md` at the repository root.
- **Path_Audit**: The CSV file `nested-path-audit.csv` at the repository root that lists every Old_Materialization_Paths occurrence found by ripgrep, the file path, the line number, and the proposed New_Materialization_Paths replacement.
- **Naming_Lint**: The CI step `pnpm run check:naming` that already exists from the v9 cut.

## Requirements

### Requirement 1 — Path audit deliverable

**User Story:** As a kernel maintainer, I want a checked-in path audit CSV so that the nested-folder rename has a reviewable paper trail before the mechanical rename pass runs.

#### Acceptance Criteria

1. THE Kernel SHALL include a Path_Audit at `nested-path-audit.csv` in the repository root.
2. THE Path_Audit SHALL have exactly the columns `file_path`, `line_number`, `old_path`, `new_path` in that order on the header row.
3. THE Path_Audit SHALL include one row per textual occurrence of any Old_Materialization_Paths value in the Kernel as measured by `rg --line-number 'architecture/04-materialization/0[4-9]-'` at the time of the audit pass.
4. THE Path_Audit SHALL exclude rows from `discovery/research-engine/`, `dist/`, `node_modules/`, and `Fix_Plan.md` history sections.

### Requirement 2 — Scaffold writer updated

**User Story:** As a host operator running `pnpm run standalone:cli init`, I want the generated directive-root to use the simplified materialization paths so that newly-bootstrapped projects do not carry the duplicated `04` prefix.

#### Acceptance Criteria

1. THE Scaffold_Writer SHALL emit each of the six New_Materialization_Paths in place of the matching Old_Materialization_Paths.
2. THE Scaffold_Writer SHALL preserve every other directory in its output list unchanged.
3. WHEN the standalone host's `init` command runs against a fresh output root, THE Kernel SHALL create the New_Materialization_Paths directories and SHALL NOT create the Old_Materialization_Paths directories.
4. THE `tests/integration/first-integration.test.ts` and `tests/integration/try-command.test.ts` test suites SHALL pass against the simplified scaffold.

### Requirement 3 — Path constants updated

**User Story:** As a kernel maintainer, I want every TypeScript constant that encodes a materialization path to use the simplified shape so that runtime callers do not redirect through a deprecated path string.

#### Acceptance Criteria

1. THE Kernel SHALL replace every Path_Constant whose value matches an Old_Materialization_Paths value with the matching New_Materialization_Paths value.
2. THE Kernel SHALL update every constant whose value contains an Old_Materialization_Paths value as a prefix to the matching New_Materialization_Paths prefix.
3. AFTER all renames are applied, THE Kernel SHALL contain zero textual matches for `04-materialization/04-implementation-targets`, `04-materialization/05-implementation-results`, `04-materialization/06-retained`, `04-materialization/07-integration-records`, `04-materialization/08-consumption-records`, or `04-materialization/09-post-consumption-evaluations` outside the Path_Audit, the `Fix_Plan.md` history rows, and the `architecture/lib/materialization/` source-comment block that documents the rename.

### Requirement 4 — Lane README + repo doc updates

**User Story:** As a new contributor reading the lane READMEs, I want every documented path to match what the scaffold actually writes so that the docs and the code agree.

#### Acceptance Criteria

1. THE Kernel SHALL update every textual occurrence of any Old_Materialization_Paths value in any Lane_README to the matching New_Materialization_Paths value.
2. THE Kernel SHALL update every textual occurrence of any Old_Materialization_Paths value in any Repo_Doc to the matching New_Materialization_Paths value.
3. WHERE a Lane_README contains a section explaining the numbered-folder convention, THE Lane_README SHALL state plainly that top-level lane folders are numbered for canonical lifecycle ordering and that nested folders inside `04-materialization/` are unprefixed.

### Requirement 5 — `.gitignore` updated

**User Story:** As a kernel maintainer, I want `.gitignore` to mention the new path shapes so that consuming projects do not accidentally check generated state into git.

#### Acceptance Criteria

1. THE Kernel SHALL update the `.gitignore` at the repository root to use the New_Materialization_Paths shape for any line that previously named an Old_Materialization_Paths value.
2. WHERE the existing `.gitignore` lists a parent path such as `architecture/04-materialization/` that already covers all materialization output, THE Kernel MAY leave that line unchanged.

### Requirement 6 — CONTRIBUTING.md rule

**User Story:** As a contributor adding a new materialization stage, I want a written rule that says nested numbers are not used so that the simplification does not regress.

#### Acceptance Criteria

1. THE `CONTRIBUTING.md` at the repository root SHALL contain a one-paragraph section under naming rules stating: top-level lane folders use a numeric prefix when canonical ordering matters; nested folders inside any lane do NOT use a numeric prefix.
2. THE Naming_Lint SHALL flag any new `<n>-<name>/` directory created under `architecture/04-materialization/`, `runtime/`, or `discovery/` whose parent is itself already a numbered folder, on the next CI run.

### Requirement 7 — Verification gate

**User Story:** As a reviewer, I want a single command set that proves the rename is clean so that I can land the change without extra investigation.

#### Acceptance Criteria

1. WHEN `pnpm run typecheck` runs after the rename pass, THE Kernel SHALL exit zero.
2. WHEN `pnpm run test` runs after the rename pass, THE Kernel SHALL exit zero with the same passed/skipped counts as before the rename ±0.
3. WHEN `pnpm run check:build` runs after the rename pass, THE Kernel SHALL exit zero.
4. WHEN `pnpm run check:naming` runs after the rename pass, THE Kernel SHALL exit zero, including the new nested-numbered-folder rule from Requirement 6.
5. WHEN `pnpm run try` runs after the rename pass, THE Kernel SHALL exit zero and SHALL print the same five-line block as before the rename.
6. WHEN `git status` runs after the rename pass, THE Kernel SHALL show modified entries only for the files in Path_Audit, the four Lane_README files, the five Repo_Doc files, the `.gitignore`, the `CONTRIBUTING.md`, the `scripts/check-naming.ts`, and the new test fixtures created for Requirement 6.
