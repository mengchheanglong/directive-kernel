# Implementation Plan: Numbered folder simplify

## Overview

Three waves. Audit → rename → lint extension. The full surface is ~10 file edits.

## Test breakage strategy

Wave 2 is the only wave that risks breaking tests; the path constants in `architecture/lib/materialization/*.ts` and `engine/state/resolve-workspace-state.ts` need to flip in lockstep with the scaffold writer. Land all of Wave 2 in one commit.

## Tasks

- [ ] 1. Wave 1 — Path audit
  - [ ] 1.1 Create `scripts/audit-nested-paths.ts` per `design.md → "Path_Audit module"`. Run it once. Commit `nested-path-audit.csv` at the repo root.
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ] 1.2 Wave 1 checkpoint: `pnpm run typecheck` and `pnpm run test` green. No code changes have landed yet.

- [ ] 2. Wave 2 — Mechanical rename
  - [ ] 2.1 Update `hosts/standalone-host/bootstrap.ts` `ARCHITECTURE_SCAFFOLD_DIRS` per `design.md → "Scaffold_Writer change"`.
    - _Requirements: 2.1, 2.2_
  - [ ] 2.2 Update every Path_Constant in source files to the new shape. Use the Path_Audit as the input list.
    - _Requirements: 3.1, 3.2_
  - [ ] 2.3 Update the four Lane_README files for the path references.
    - _Requirements: 4.1, 4.3_
  - [ ] 2.4 Update the five Repo_Doc files for the path references.
    - _Requirements: 4.2_
  - [ ] 2.5 Update `.gitignore` per `design.md`.
    - _Requirements: 5.1, 5.2_
  - [ ] 2.6 Add the naming rule paragraph to `CONTRIBUTING.md`.
    - _Requirements: 6.1_
  - [ ] 2.7 Wave 2 checkpoint: `pnpm run typecheck`, `pnpm run test`, `pnpm run check:build` all green.
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 3. Wave 3 — Lint + tests
  - [ ] 3.1 Add Rule 5 to `scripts/check-naming.ts` per `design.md → "Naming_Lint extension"`.
    - _Requirements: 6.2_
  - [ ] 3.2 Extend `tests/unit/check-naming.test.ts` with the synthetic fixture asserting Rule 5 fires.
    - _Requirements: 6.2_
  - [ ] 3.3 Add `tests/integration/scaffold-shape.test.ts` per `design.md → "Correctness Properties → Property 1"`.
    - _Requirements: 2.3, 2.4_
  - [ ] 3.4 Wave 3 checkpoint: full verification gate green.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 4. Final block
  - [ ] 4.1 Update `Fix_Plan.md` F12 row to ✅ done with outcome block.
  - [ ] 4.2 Re-run the four-command verification gate one more time and capture the output for the F12 hand-off message.
