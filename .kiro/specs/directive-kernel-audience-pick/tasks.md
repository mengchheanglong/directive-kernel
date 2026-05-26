# Implementation Plan: Audience pick

## Agent execution model

| Phase | Who | Tasks | Why |
|---|---|---|---|
| **Audit** | Claude / Codex | 1.1 | Strategic; requires reading the kernel's full feature set and cost-estimating both paths. |
| **Decision** | Maintainer (human) | 2.1 | A judgment call that must be locked by a person, not an agent. |
| **Execution** | Any agent (path-conditional) | 3.x | Mechanical once the path is locked. |

## Test breakage strategy

Path b's two new examples must pass their integration tests in the same wave they're added. If the example payload is malformed, the test catches it; do not add the example without the test.

## Tasks

- [ ] 1. Wave 1 — Audit (Claude / Codex)
  - [ ] 1.1 Create `audience-feature-inventory.md` per `design.md → "Audit deliverable"`. Walk every kernel capability, contract, and example. Score on research-coupling and generalizability. Estimate cost of both paths.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [ ] 1.2 Wave 1 checkpoint: typecheck + test (no code changes).

- [ ] 2. Wave 2 — Decision (maintainer)
  - [ ] 2.1 Maintainer reads the audit. Picks option (a) or option (b). Fills in `AUDIENCE.md` per the template in `design.md`. Commit.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 3a. Wave 3a — Research_Curation_Path execution (only if Audience_Decision = `research-curation-kernel`)
  - [ ] 3a.1 Rewrite `README.md` "What This Repo Is For" section per `design.md`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1, 5.2_
  - [ ] 3a.2 Create `audience-scope-trim.md` listing capabilities + contracts to retain, relocate, or deprecate.
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 3a.3 Apply any deprecations identified in the trim list (move features to `docs/lineage/` or delete).
    - _Requirements: 3.3_
  - [ ] 3a.4 Wave 3a checkpoint: typecheck + test + check:build + check:naming + check:contracts + check:examples.
    - _Requirements: 6.1_

- [ ] 3b. Wave 3b — General_Workflow_Path execution (only if Audience_Decision = `general-workflow-kernel`)
  - [ ] 3b.1 Rewrite `README.md` "What This Repo Is For" section per `design.md`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ] 3b.2 Create `audience-scope-trim.md` identifying research-specific copy to relocate from core README to `docs/lineage/research-curation.md`.
    - _Requirements: 3.1, 3.2, 3.4_
  - [ ] 3b.3 Apply the relocations.
    - _Requirements: 3.4_
  - [ ] 3b.4 Create `hosts/integration-kit/examples/customer-feedback-triage/` with goal envelope, sample source, README, and `pnpm-try.test.ts` per `design.md`.
    - _Requirements: 4.1, 4.2, 4.4, 4.5_
  - [ ] 3b.5 Create `hosts/integration-kit/examples/security-advisory-triage/` with the same shape.
    - _Requirements: 4.1, 4.3, 4.4, 4.5_
  - [ ] 3b.6 Add `tests/integration/customer-feedback-triage.test.ts` and `tests/integration/security-advisory-triage.test.ts`.
    - _Requirements: 4.5, 6.2_
  - [ ] 3b.7 Wave 3b checkpoint: full verification gate green; the two new tests are part of the test count.
    - _Requirements: 6.1, 6.2_

- [ ] 4. Wave 4 — Cross-doc updates (both paths)
  - [ ] 4.1 Update `Tech_Blueprint.md` Section 1 (purpose) to reflect the locked audience.
  - [ ] 4.2 Update `GLOSSARY.md` introductory paragraph if relevant.
  - [ ] 4.3 Update `Fix_Plan.md` F10 row to ✅ done with outcome block. The outcome block records which path was chosen and links to `AUDIENCE.md`.
  - [ ] 4.4 Wave 4 checkpoint: full gate green.
    - _Requirements: 6.1, 6.3_

- [ ] 5. Final block
  - [ ] 5.1 Re-run the full verification gate. Capture for the F10 hand-off message.
