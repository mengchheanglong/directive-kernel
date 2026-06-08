# Requirements Document

## Introduction

The "smallest but highest-leverage layer" of the kernel has 7 grouped subfolders in `engine/` and 7 in `runtime/lib/`. Some of these are real boundaries (`engine/routing/` vs `engine/mission/`); some are organizational habit (`engine/coordination/` and `engine/execution/` overlap; `runtime/lib/openers/` vs `runtime/lib/runners/` vs `runtime/lib/sequences/` is three names for "things that drive state forward"). This is the natural follow-up to F11 (naming consistency) — the names are now plain, but the folder taxonomy still encodes lost history rather than current intent.

This feature ships the surface-prune work as **two coordinated sub-cuts**, each landing CI-green on its own:

- **Sub-cut A: engine/orchestration/** merges `engine/coordination/` and `engine/execution/` into a single `engine/orchestration/` directory. The merge is mechanical (every file moves; no semantics change) using `smartRelocate` so importers update automatically.
- **Sub-cut B: runtime/lib/operations/** merges `runtime/lib/openers/`, `runtime/lib/runners/`, and `runtime/lib/sequences/` into a single `runtime/lib/operations/` directory using the same mechanical pattern.

The work depends on F1 (test infrastructure) ✅ done, F11 (naming consistency) ✅ done, and F5 (contracts audit) ✅ done so the contract-link headers stay current after the moves.

## Glossary

- **Kernel**: The root TypeScript package `@directive/kernel`.
- **Engine_Surface**: The directory `engine/` and every subdirectory.
- **Runtime_Lib_Surface**: The directory `runtime/lib/` and every subdirectory.
- **Read_Write_Audit**: A CSV file `docs/audits/engine-runtime-state-audit.csv` that maps every TypeScript file in `Engine_Surface` and `Runtime_Lib_Surface` to: the on-disk state it reads (file paths or schemas), the on-disk state it writes (file paths or schemas), its current callers (file paths from a ripgrep import sweep). One row per source file.
- **Boundary_Map**: A short Markdown document `docs/audits/engine-runtime-boundary-map.md` that summarizes the Read_Write_Audit into the proposed sub-cut groupings: which folders merge, which folders stay, which files move where, and the rationale.
- **Sub_Cut_A**: The merge `engine/coordination/` + `engine/execution/` → `engine/orchestration/`.
- **Sub_Cut_B**: The merge `runtime/lib/openers/` + `runtime/lib/runners/` + `runtime/lib/sequences/` → `runtime/lib/operations/`.
- **Public_Exports_Map**: The `exports` object in `package.json`. Every relocation that crosses a public surface key SHALL update the corresponding key.
- **Naming_Lint**: `pnpm run check:naming` from the v9 cut.
- **Contracts_Lint**: `pnpm run check:contracts` from F5.

## Requirements

### Requirement 1 — Read_Write_Audit

**User Story:** As a kernel maintainer evaluating folder merges, I want a read/write/caller map of every file in `Engine_Surface` and `Runtime_Lib_Surface` so that the merge groupings reflect actual data flow rather than folder-name vibes.

#### Acceptance Criteria

1. THE Kernel SHALL include a Read_Write_Audit at `docs/audits/engine-runtime-state-audit.csv`.
2. THE Read_Write_Audit SHALL have exactly the columns `file_path`, `reads`, `writes`, `callers`, `proposed_destination`, `disposition` in that order on the header row.
3. THE Read_Write_Audit SHALL include one row per `.ts` source file (excluding `.test.ts`, `.d.ts`, `index.ts` barrels) in `Engine_Surface` and `Runtime_Lib_Surface`.
4. THE `reads` column SHALL list the relative paths under a Directive_Root that the file reads (e.g. `discovery/intake-queue.json`, `engine/decision-policy-ledger.jsonl`) or a short label like `none`.
5. THE `writes` column SHALL list the relative paths the file writes, or `none`.
6. THE `callers` column SHALL list the file paths that import the file (from ripgrep), capped at the first 5 with a `+N more` suffix when the count exceeds 5.
7. THE `proposed_destination` column SHALL state where the file moves under the chosen sub-cuts, or `unchanged`.
8. THE `disposition` column SHALL take one of `move-to-orchestration`, `move-to-operations`, `keep`, `delete`, `defer`.

### Requirement 2 — Boundary_Map

**User Story:** As a reviewer, I want a one-page summary of the audit so that the merge decisions can be reviewed without reading 100+ rows of CSV.

#### Acceptance Criteria

1. THE Kernel SHALL include a Boundary_Map at `docs/audits/engine-runtime-boundary-map.md`.
2. THE Boundary_Map SHALL contain a section per folder that exists today, summarizing what each folder owns and whether the folder survives, merges into another, or splits.
3. THE Boundary_Map SHALL explicitly answer the F9 questions for each grouped subfolder: does this name describe a real boundary, or is it a folder of files we put together?
4. THE Boundary_Map SHALL list the Sub_Cut_A and Sub_Cut_B file moves with `before → after` paths.
5. THE Boundary_Map SHALL flag any file that the audit identifies as a candidate for outright deletion (with `disposition: delete`) and the rationale.

### Requirement 3 — Sub_Cut_A: engine/orchestration/

**User Story:** As a kernel adopter, I want the engine's orchestration logic in one place so that "what schedules what" is not split across two folders that overlap in concept.

#### Acceptance Criteria

1. THE Kernel SHALL move every `.ts` file from `engine/coordination/` to `engine/orchestration/` using `smartRelocate` so importers update automatically.
2. THE Kernel SHALL move every `.ts` file from `engine/execution/` to `engine/orchestration/` using `smartRelocate`.
3. WHERE a file basename collides between the two source folders, THE Kernel SHALL rename one to disambiguate; the audit identifies any collisions ahead of time.
4. THE Kernel SHALL update `engine/index.ts` to re-export from `engine/orchestration/` instead of `engine/coordination/` and `engine/execution/`.
5. THE Kernel SHALL update the `package.json` `exports` map: any path key referencing `./engine/coordination` or `./engine/execution` SHALL point at the new `./engine/orchestration` location across all four conditions (`development`, `types`, `import`, `default`).
6. THE Kernel SHALL update every `**Enforced by:**` header in `shared/contracts/` whose target was a path under `engine/coordination/` or `engine/execution/` to the new `engine/orchestration/` path.
7. AFTER Sub_Cut_A is complete, THE Kernel SHALL contain zero `.ts` files under `engine/coordination/` or `engine/execution/`. The folders themselves SHALL be removed.

### Requirement 4 — Sub_Cut_B: runtime/lib/operations/

**User Story:** As a kernel adopter, I want the runtime's "things that drive state forward" in one place instead of three folders whose distinction is a relic of historical naming.

#### Acceptance Criteria

1. THE Kernel SHALL move every `.ts` file from `runtime/lib/openers/`, `runtime/lib/runners/`, and `runtime/lib/sequences/` to `runtime/lib/operations/` using `smartRelocate`.
2. WHERE a file basename collides between source folders, THE Kernel SHALL rename one to disambiguate.
3. THE Kernel SHALL update `runtime/lib/index.ts` to re-export from `runtime/lib/operations/`.
4. THE Kernel SHALL update the `package.json` `exports` map for every key referencing the three source folders.
5. THE Kernel SHALL update every `**Enforced by:**` header in `shared/contracts/` whose target was a path under any of the three source folders.
6. AFTER Sub_Cut_B is complete, THE Kernel SHALL contain zero `.ts` files under `runtime/lib/openers/`, `runtime/lib/runners/`, or `runtime/lib/sequences/`. The folders themselves SHALL be removed.

### Requirement 5 — Sub-cut sequencing

**User Story:** As a reviewer, I want each sub-cut to land green on its own so that I can review them as separate PRs.

#### Acceptance Criteria

1. THE Kernel SHALL land Sub_Cut_A as a single coherent change set that passes typecheck + test + check:build + check:naming + check:contracts before Sub_Cut_B begins.
2. THE Kernel SHALL land Sub_Cut_B as a single coherent change set that passes the same gates.
3. WHERE a file's contract-link header (post-F5) references a path that moves in either sub-cut, THE Contracts_Lint SHALL pass after the change set lands.
4. WHERE the `package.json` `exports` map references a moved path, THE `pnpm run check:build` SHALL still pass against the post-build smoke (the imports must resolve from `dist/`).

### Requirement 6 — Verification gate

#### Acceptance Criteria

1. WHEN `pnpm run typecheck`, `pnpm run test`, `pnpm run check:build`, `pnpm run check:naming`, `pnpm run check:contracts`, and `pnpm run check:examples` run after both sub-cuts land, THE Kernel SHALL exit zero on each.
2. WHEN `git status` runs after Sub_Cut_A, THE Kernel SHALL show file moves only inside `engine/`, plus the corresponding `package.json`, `engine/index.ts`, and contract-header changes.
3. WHEN `git status` runs after Sub_Cut_B, THE Kernel SHALL show file moves only inside `runtime/lib/`, plus the corresponding `package.json`, `runtime/lib/index.ts`, and contract-header changes.
4. WHEN `pnpm try` runs after both sub-cuts, THE Kernel SHALL print the same five-line block as before.
