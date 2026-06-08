# Requirements Document

## Introduction

The kernel ships a Lit + Vite UI under `ui/` that today renders read-only views of the directive-root's state. Every state mutation requires the CLI (`pnpm run standalone:cli discovery-submit ...`) or a hand-crafted POST to the web-host's API. For a system whose pitch is "make workflow visible," shipping a read-only operator view is half a product. Either the kernel commits to read-only and the UI is honestly named an "operator dashboard," or the kernel finishes the job and ships an operator workbench with the high-frequency mutations wired in.

This feature is **a decision spec plus the read-only-finalize path**. It produces:

1. An audit document `docs/audits/ui-mutation-coverage-audit.md` listing every operator action a real workbench needs and mapping each one to its existing web-host POST endpoint.
2. A locked decision recorded in `Fix_Plan.md` and `README.md`: the kernel ships the read-only operator dashboard now (workbench is deferred to a later spec), with the existing CLI mutations remaining canonical.
3. The renaming and copy fixes that turn "the UI" into "the Directive Operator Dashboard," including a clear statement in every relevant doc that mutations live in the CLI.
4. A `legalNextSeams`-driven hint surface added to existing artifact renderers so each artifact view tells the operator what the canonical CLI command is to advance the artifact.

The full Lit-form workbench from Improvement Plan I6 is **out of scope** for this spec. This spec ships the decision and the dashboard polish; a follow-up spec (F8.5 if needed) would ship the workbench when there is a concrete operator demand.

The work depends on F1 (test infrastructure) ✅ done.

## Glossary

- **Kernel**: The root TypeScript package `@directive/kernel` plus the `ui/` workspace member.
- **Mutation_Coverage_Audit**: The Markdown file `docs/audits/ui-mutation-coverage-audit.md`. Lists every operator-facing mutation, the web-host POST endpoint that already exists, the CLI subcommand that already exists, and a one-sentence usefulness assessment for a future workbench.
- **Operator_Action_Set**: The eight canonical actions: submit source, approve route, reroute with answers, write decision, formalize gap, mission edit, runtime opener, architecture handoff.
- **Operator_Dashboard**: The renamed UI, post-spec. The identifier `Directive Operator Dashboard` replaces every prior "Directive Workspace UI" or "Mission Control UI" reference inside the kernel.
- **Legal_Next_Steps_Hint**: A small Lit component (or per-renderer extension) that surfaces, for any artifact rendered in the UI, the bounded set of `allowedNextSteps` (post-F4 rename of the old `legalNextSeams`) plus the canonical CLI command that performs each step.
- **Mutation_Boundary_Note**: A consistent paragraph in the dashboard's main view header that reads (verbatim or near-verbatim): *"This is a read-only view. State mutations live in the CLI: `pnpm run standalone:cli <subcommand>`. See [`docs/operator-cli.md`](./docs/operator-cli.md) for the canonical operator surface."*
- **Operator_CLI_Doc**: The new Markdown file `docs/operator-cli.md` listing every CLI mutation grouped by Operator_Action.
- **Workbench_Deferred_Note**: A one-paragraph note in `Fix_Plan.md` documenting that the workbench was evaluated, the audit captured the implementation surface, and the decision is to defer until a concrete operator demand exists.
- **F8_Workbench_Spec_Stub**: An empty stub directory `.kiro/specs/directive-kernel-operator-workbench/` with a one-line README pointing back at this spec's audit. Not promoted to active until a separate user request.

## Requirements

### Requirement 1 — Mutation_Coverage_Audit

**User Story:** As a kernel maintainer evaluating UI investment, I want a written audit of every operator-facing mutation so that the workbench-vs-dashboard decision has a reviewable scope estimate.

#### Acceptance Criteria

1. THE Kernel SHALL include a Mutation_Coverage_Audit at `docs/audits/ui-mutation-coverage-audit.md`.
2. THE Mutation_Coverage_Audit SHALL contain one section per Operator_Action listing: the action name, the web-host POST endpoint (or stating "not yet exposed"), the CLI subcommand that performs it, the source-of-truth artifact it mutates, and a one-sentence assessment of operator value if a UI form existed.
3. THE Mutation_Coverage_Audit SHALL include a final "Decision" section recording the locked decision: ship Operator_Dashboard now, defer the workbench.
4. THE Mutation_Coverage_Audit SHALL include a "Workbench scope estimate" appendix listing the Lit components that would need to exist (forms, validation, optimistic UI, error toast) if the workbench were to ship.

### Requirement 2 — Operator_Dashboard rename

**User Story:** As a new contributor opening the kernel for the first time, I want the UI's stated purpose to match what it actually does so that I do not waste time hunting for mutation flows that don't exist.

#### Acceptance Criteria

1. THE Kernel SHALL rename every textual occurrence of "Directive Workspace UI" or "Mission Control UI" to "Directive Operator Dashboard" in `README.md`, `Tech_Blueprint.md`, `ui/README.md`, `hosts/web-host/README.md`, and the dashboard's own main-view template.
2. THE Kernel SHALL update the page `<title>` rendered by `ui/index.html` to "Directive Operator Dashboard".
3. THE Kernel SHALL include the Mutation_Boundary_Note as a banner-style block at the top of the dashboard's main view, rendered through the existing Lit component tree.
4. THE rename SHALL preserve every existing route and component name; only display strings and doc copy change. No `semanticRename` of TypeScript identifiers is required.

### Requirement 3 — Operator_CLI_Doc

**User Story:** As an operator who landed on the dashboard and saw the Mutation_Boundary_Note, I want one document that lists every operator command so that I do not have to grep the standalone-host CLI source to find the right invocation.

#### Acceptance Criteria

1. THE Kernel SHALL include `docs/operator-cli.md`.
2. THE Operator_CLI_Doc SHALL group commands by Operator_Action.
3. THE Operator_CLI_Doc SHALL show the full invocation pattern for each command including required flags and one realistic example.
4. THE Operator_CLI_Doc SHALL link from each Operator_Action heading to the corresponding `shared/contracts/<x>.md` or `docs/contracts/<x>.md` that documents the underlying lifecycle.
5. THE Mutation_Boundary_Note SHALL link to Operator_CLI_Doc as the primary reference.

### Requirement 4 — Legal_Next_Steps_Hint

**User Story:** As an operator viewing an artifact in the dashboard, I want to see what the canonical next CLI command is so that I do not have to leave the dashboard and read a contract to know what's allowed next.

#### Acceptance Criteria

1. THE Kernel SHALL extend the existing artifact renderer set under `ui/src/renderers/` (or wherever artifact rendering lives) so that every renderer that displays an artifact with an `allowedNextSteps` (post-F4) array OR a routing-state object also displays the Legal_Next_Steps_Hint.
2. THE Legal_Next_Steps_Hint SHALL render each entry of `allowedNextSteps` as: a short prose label, a code block showing the canonical CLI invocation, and (optionally) a link to the Operator_CLI_Doc section.
3. WHERE an artifact has an empty `allowedNextSteps` array (terminal state), THE Legal_Next_Steps_Hint SHALL display the prose "This artifact is in a terminal state; no further operator action is required."
4. THE Legal_Next_Steps_Hint SHALL be wired into the dashboard for at least three renderers: the discovery-routing record, the runtime follow-up, and the architecture adoption decision.
5. THE Legal_Next_Steps_Hint SHALL be unit-tested via at least one Lit-component unit test (Vitest + jsdom).

### Requirement 5 — Workbench_Deferred_Note + Stub

**User Story:** As a future contributor wondering whether the kernel ever plans to ship a workbench, I want a tracked deferral note so that the decision is reversible without rediscovering the audit.

#### Acceptance Criteria

1. THE Kernel SHALL add a Workbench_Deferred_Note paragraph to the F8 section of `Fix_Plan.md` recording the deferral rationale and pointing to Mutation_Coverage_Audit.
2. THE Kernel SHALL add an empty F8_Workbench_Spec_Stub at `.kiro/specs/directive-kernel-operator-workbench/.config.kiro` and a one-paragraph `README.md` pointing back at the audit. The stub SHALL NOT include `requirements.md`, `design.md`, or `tasks.md`.

### Requirement 6 — Read-only confirmation tests

**User Story:** As a kernel maintainer, I want a CI-gated assertion that the dashboard does not silently sprout mutation paths so that the read-only commitment does not regress.

#### Acceptance Criteria

1. THE Kernel SHALL include `tests/integration/dashboard-readonly-surface.test.ts` that boots the web host, scans the rendered HTML for any `<form>` with `method="POST"` or any inline-handler that calls a mutation API, and asserts zero matches.
2. WHERE a future workbench ships, THE test SHALL be updated alongside the workbench scope to allow exactly the workbench's known mutation surface.

### Requirement 7 — Verification gate

#### Acceptance Criteria

1. WHEN `pnpm run typecheck`, `pnpm run test`, `pnpm run check:build`, `pnpm run check:naming`, `pnpm run check:contracts`, and `pnpm run check:examples` run after the spec is implemented, THE Kernel SHALL exit zero on each.
2. WHEN `pnpm run start` boots the web host and a browser loads the dashboard, THE Mutation_Boundary_Note SHALL be visible in the rendered viewport above the fold.
3. WHEN any artifact view loads, THE Legal_Next_Steps_Hint SHALL render correctly for any artifact whose data shape includes `allowedNextSteps`.
