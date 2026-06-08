# Implementation Plan: UI direction (read-only dashboard + workbench deferral)

## Overview

Five waves. Audit first, dashboard rename second, doc third, hint component fourth, final gate fifth.

## Test breakage strategy

Wave 4 is the only wave that risks breaking existing UI tests; the renderer extensions must keep their existing render output stable apart from the new `<legal-next-steps-hint>` mount. Use snapshot tests if the project already has them; otherwise add explicit assertions for the existing content alongside the new content.

## Tasks

- [ ] 1. Wave 1 — Audit + decision record
  - [ ] 1.1 Create `docs/audits/ui-mutation-coverage-audit.md` per `design.md → "Mutation_Coverage_Audit structure"`. Walk `hosts/web-host/api-routes.ts` and `hosts/standalone-host/cli.ts` to populate the table.
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ] 1.2 Add the Workbench_Deferred_Note paragraph to F8 in `Fix_Plan.md`.
    - _Requirements: 5.1_
  - [ ] 1.3 Create `.kiro/specs/directive-kernel-operator-workbench/.config.kiro` with a fresh UUID and `workflowType: "fast-task"`. Create the matching `README.md` with the deferral note pointing back at the audit.
    - _Requirements: 5.2_
  - [ ] 1.4 Wave 1 checkpoint: typecheck + test (no UI changes yet).

- [ ] 2. Wave 2 — Dashboard rename + boundary banner
  - [ ] 2.1 Rename "Directive Workspace UI" / "Mission Control UI" → "Directive Operator Dashboard" in the four target docs and the dashboard `<title>`.
    - _Requirements: 2.1, 2.2_
  - [ ] 2.2 Add the Mutation_Boundary_Note banner to the dashboard's main view per `design.md`.
    - _Requirements: 2.3_
  - [ ] 2.3 Wave 2 checkpoint: typecheck + test + `pnpm run build` (UI build).

- [ ] 3. Wave 3 — Operator_CLI_Doc
  - [ ] 3.1 Create `docs/operator-cli.md` per `design.md → "Operator_CLI_Doc structure"`. One section per Operator_Action.
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ] 3.2 Update Mutation_Boundary_Note href to point at `/docs/operator-cli.md`.
    - _Requirements: 3.5_
  - [ ] 3.3 Wave 3 checkpoint: typecheck + test + check:contracts.

- [ ] 4. Wave 4 — Legal_Next_Steps_Hint
  - [ ] 4.1 Create `ui/src/components/legal-next-steps-hint.ts` per `design.md`.
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ] 4.2 Create `ui/src/components/legal-next-steps-hint.test.ts` covering: empty steps → terminal message; non-empty → per-step block; malformed step → defensive fallback.
    - _Requirements: 4.5_
  - [ ] 4.3 Extend `ui/src/renderers/discovery-routing-record.ts` (or matching path) to mount the hint with `allowedNextSteps` derived from the artifact.
    - _Requirements: 4.4_
  - [ ] 4.4 Same for `runtime-follow-up`.
    - _Requirements: 4.4_
  - [ ] 4.5 Same for `architecture-adoption-decision`.
    - _Requirements: 4.4_
  - [ ] 4.6 Wave 4 checkpoint: typecheck + test (incl. new component test) + check:build.

- [ ] 5. Wave 5 — Read-only assertion + gate
  - [ ] 5.1 Create `tests/integration/dashboard-readonly-surface.test.ts` per `design.md → "Integration tests"`.
    - _Requirements: 6.1_
  - [ ] 5.2 Wave 5 checkpoint: full verification gate green.
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 6. Final block
  - [ ] 6.1 Update `Fix_Plan.md` F8 row to ✅ done with outcome block. The outcome block records the deferral as the F8 result.
  - [ ] 6.2 Re-run the full gate. Capture for the F8 hand-off message.

