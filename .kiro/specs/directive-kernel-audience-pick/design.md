# Design Document

## Overview

This is primarily a strategic/positioning spec. The decision (option a vs option b) is the highest-leverage bit; the implementation downstream is small (1 doc + 1 README rewrite + 1 trim list) on the research-curation path and moderate (same + 2 example consumers + 2 tests) on the general-workflow path.

The decision MUST be made before any artifact is written. The audit phase produces the inputs that inform the decision; the user (or maintainer) makes the call; the execution phase implements whichever path was picked.

## Architecture

```
   Audit phase (Claude / Codex):
       1. Inventory the kernel's actual feature set
       2. Score each feature on "research-only", "general", or "both"
       3. Estimate cost of each path
       → docs/audits/audience-feature-inventory.md (committed)

   Decision phase (user):
       Read the audit. Pick option (a) or option (b). Lock in AUDIENCE.md.

   Execution phase (any agent):
       Path (a) — Research_Curation_Path
           - AUDIENCE.md filled in for option (a)
           - README pitch block rewrite (lineage embrace)
           - Scope_Trim_List with deprecations identified
           - Optional: rename "kernel" → "research curation kernel" in README header
       Path (b) — General_Workflow_Path
           - AUDIENCE.md filled in for option (b)
           - README pitch block rewrite (general framing)
           - Scope_Trim_List relocates research-specific copy to docs/lineage/
           - Add customer-feedback example + test
           - Add security-advisory example + test
```

## Components and Interfaces

### Audit deliverable: `docs/audits/audience-feature-inventory.md`

```markdown
# Kernel feature inventory for audience decision

| Feature | Domain | Research-coupled? | Generalizable? | Notes |
|---|---|---|---|---|
| Discovery intake queue | core | no | yes | Pure routing logic |
| Literature-access capabilities | runtime | yes | as inspiration | arXiv, OpenAlex, Unpaywall — research-specific |
| Engine routing assessment | core | no | yes | Mission-conditioned, not source-type-conditioned |
| ... | ... | ... | ... | ... |

## Cost estimates

### Research_Curation_Path
- 1–2 days docs work
- Risk: solidifies the niche; harder to reverse later

### General_Workflow_Path
- ~1 week to ship 2 non-research example consumers + tests
- Risk: example consumers become demo-quality and never get a real user
```

### `AUDIENCE.md` template

```markdown
# Directive Kernel Audience

## Audience (locked)

`<research-curation-kernel | general-workflow-kernel>`

## Primary use case

<one paragraph in concrete operational terms>

## Who this is NOT for

- <named not-audience 1>: <one sentence why>
- <named not-audience 2>: <one sentence why>
- <named not-audience 3>: <one sentence why>

## How we will know we picked right

- <signal 1>
- <signal 2>
- <signal 3>

## Reversal conditions

<under what circumstances would we revisit?>

## Decision date

<ISO date>

## Decided by

<maintainer or operator name>
```

### Example consumer 1: customer-feedback triage (Path b only)

```
hosts/integration-kit/examples/customer-feedback-triage/
├── goal-envelope.json
├── sample-feedback.json (a single source — one inbound customer ticket)
├── README.md (one-page walkthrough)
└── pnpm-try.test.ts (integration test running through the kernel)
```

### Example consumer 2: security-advisory triage (Path b only)

Same shape. Source is a CVE entry; routing decision is "review", "monitor", or "patch-now".

## Data Models

No new data models. The example consumers reuse the existing source/goal envelope schemas.

## Correctness Properties

- **Property 1 — Audience explicit in README.** A new contributor reading the README's first paragraph SHALL be able to state who the kernel serves. Validated by a paragraph-length and content check in CI? Out of scope; this is a doc concern.
- **Property 2 — Path-b examples actually run.** If `general-workflow-kernel` is picked, both new example consumers SHALL pass their integration tests via `pnpm test`.

## Error Handling

- Audit reveals the kernel is too tightly research-coupled for option (b): the maintainer has the option to override the audit recommendation, document the override rationale in `AUDIENCE.md`, and accept the implementation cost.
- Audit reveals the kernel is too generic to credibly position as research-curation: same — override possible, document rationale.

## Testing Strategy

### Path-specific tests

- **Path a**: no new tests beyond existing literature-access tests.
- **Path b**: two new integration tests under `tests/integration/customer-feedback-triage.test.ts` and `tests/integration/security-advisory-triage.test.ts`. Each runs the example through `runFirstHostIntegrationFlow` analogous to the F3 try-command path.

## Wave Plan

| Wave | Scope | Path applicability | Checkpoint |
|---|---|---|---|
| 1 | Audit (`docs/audits/audience-feature-inventory.md`) | both | typecheck + test (no code changes) |
| 2 | Decision lock (`AUDIENCE.md` filled in by maintainer) | both | typecheck + test |
| 3a | Research_Curation_Path: README rewrite + Scope_Trim_List with deprecations | a only | typecheck + test + check:contracts |
| 3b | General_Workflow_Path: README rewrite + Scope_Trim_List relocations + 2 example consumers + 2 integration tests | b only | typecheck + test + check:build + check:examples |
| 4 | Cross-doc updates (Tech_Blueprint.md, GLOSSARY.md, Fix_Plan.md F10 row) | both | full gate green |

## Open Questions

- Does the maintainer have a preference between options going in? If yes, the audit phase becomes a sanity check rather than a discovery exercise. Either way, the audit is committed.
- Should the kernel rename itself to reflect the audience? E.g. `@directive/research-curation-kernel`? Strongly out of scope; the package name change has cascading effects on every consuming project.
