# Implementation Plan: Engine + Runtime surface-area prune

## Agent execution model

The cut follows the v9-cut three-phase split:

| Phase | Who | Tasks | Why |
|---|---|---|---|
| **Audit** | Claude / Codex | 1.1, 1.2 (Read_Write_Audit + Boundary_Map) | Judgment-heavy; the audit must enumerate every file in two surfaces and propose merge groupings. |
| **Execution** | DeepSeek + OpenCode | 2.x and 3.x (mechanical moves) | Once the audit is fixed, every move is a `smartRelocate` plus barrel/exports/header updates. |
| **Evaluation** | Claude / Codex | 4.x (verify gate, side-issue triage) | Catches mover errors; updates `Fix_Plan.md`. |

## Test breakage strategy

Both sub-cuts land in single coherent change sets. Each change set must be all-or-nothing — partial cuts leave `engine/index.ts` exporting from a now-empty folder. The reviewer's confidence in the cut depends on every file landing in one commit so the post-merge HEAD is always green.

## Tasks

- [ ] 1. Wave 1 — Audit (Claude / Codex)
  - [ ] 1.1 Create `scripts/audit-engine-runtime-state.ts` per `design.md → "Audit script"`. Run it. Commit `docs/audits/engine-runtime-state-audit.csv`.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_
  - [ ] 1.2 Synthesize `docs/audits/engine-runtime-boundary-map.md` from the CSV plus a per-folder review of `engine/coordination/`, `engine/execution/`, `runtime/lib/openers/`, `runtime/lib/runners/`, `runtime/lib/sequences/`. Include explicit before→after paths for both sub-cuts.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ] 1.3 Wave 1 checkpoint: typecheck + test (no code moved).

- [ ] 2. Wave 2 — Sub_Cut_A (DeepSeek)
  - [ ] 2.1 Create `engine/orchestration/` directory.
  - [ ] 2.2 `smartRelocate` every file from `engine/coordination/` to `engine/orchestration/<basename>`. Use the audit row as the source of truth.
    - _Requirements: 3.1_
  - [ ] 2.3 `smartRelocate` every file from `engine/execution/` to `engine/orchestration/<basename>`. Resolve any basename collision per the audit's collision-handling note.
    - _Requirements: 3.2, 3.3_
  - [ ] 2.4 Update `engine/index.ts` to re-export from `engine/orchestration/`.
    - _Requirements: 3.4_
  - [ ] 2.5 Update `package.json` `exports` map for every key under `./engine/coordination` and `./engine/execution`. All four conditions per key (`development`, `types`, `import`, `default`).
    - _Requirements: 3.5_
  - [ ] 2.6 Update `**Enforced by:**` headers in `shared/contracts/*.md` to point at the new paths.
    - _Requirements: 3.6_
  - [ ] 2.7 Delete the now-empty `engine/coordination/` and `engine/execution/` directories.
    - _Requirements: 3.7_
  - [ ] 2.8 Wave 2 checkpoint (Sub_Cut_A): full verification gate (typecheck + test + check:build + check:naming + check:contracts + check:examples + try) green.
    - _Requirements: 5.1, 5.3, 5.4, 6.1, 6.2_

- [ ] 3. Wave 3 — Sub_Cut_B (DeepSeek)
  - [ ] 3.1 Create `runtime/lib/operations/` directory.
  - [ ] 3.2 `smartRelocate` every file from `runtime/lib/openers/`, `runtime/lib/runners/`, and `runtime/lib/sequences/` to `runtime/lib/operations/<basename>`. Resolve collisions per the audit.
    - _Requirements: 4.1, 4.2_
  - [ ] 3.3 Update `runtime/lib/index.ts` to re-export from `runtime/lib/operations/`.
    - _Requirements: 4.3_
  - [ ] 3.4 Update `package.json` `exports` map.
    - _Requirements: 4.4_
  - [ ] 3.5 Update `**Enforced by:**` headers in `shared/contracts/*.md` for any path under the three source folders.
    - _Requirements: 4.5_
  - [ ] 3.6 Delete the three now-empty source directories.
    - _Requirements: 4.6_
  - [ ] 3.7 Wave 3 checkpoint (Sub_Cut_B): full verification gate green.
    - _Requirements: 5.2, 5.3, 5.4, 6.1, 6.3, 6.4_

- [ ] 4. Final block (Claude / Codex)
  - [ ] 4.1 Audit-resweeps: confirm zero remaining files under `engine/coordination/`, `engine/execution/`, `runtime/lib/openers/`, `runtime/lib/runners/`, `runtime/lib/sequences/`. Confirm `engine/index.ts` and `runtime/lib/index.ts` re-export from the new locations only. Confirm `package.json` `exports` keys agree.
  - [ ] 4.2 Update `Fix_Plan.md` F9 row to ✅ done with outcome block.
  - [ ] 4.3 Re-run the full gate. Capture for the F9 hand-off message.

