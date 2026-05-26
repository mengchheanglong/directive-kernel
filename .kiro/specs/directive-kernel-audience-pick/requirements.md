# Requirements Document

## Introduction

The kernel today reads as research-curation-shaped (literature-access capability, research-engine sub-package, Scientify lineage) but pitches itself as a "general workflow kernel for any source-driven workflow." Solo devs won't tolerate the ceremony required to actually use it; large teams want roles, audit, and persistence guarantees the kernel doesn't ship. The result is a project that is technically interesting but has no named first audience.

This feature ships **a locked audience pick** plus the documentation, scope-trim, and (if the pick is "general workflow kernel") the proof-of-fit work — at least one non-research example consumer — required to credibly serve that audience.

The decision is binary: option (a) **research curation kernel** embracing the lineage; option (b) **general workflow kernel** with proof of fit through additional example consumers. The decision MUST be locked before any docs or code change.

The work depends on F1 ✅, F11 ✅, and F5 ✅ (the contract surface needs to be clean before "what audience does this serve" gets answered, because the answer constrains which contracts get promoted vs deferred).

## Glossary

- **Kernel**: The root TypeScript package `@directive/kernel`.
- **Audience_Decision**: A locked choice of one of `research-curation-kernel` or `general-workflow-kernel`. Recorded in a new `AUDIENCE.md` at the repo root.
- **Audience_Doc**: The Markdown file `AUDIENCE.md` at the repo root that names the locked audience, the one canonical use case, and the explicit non-audiences (who the kernel is NOT for).
- **Research_Curation_Path**: Audience_Decision = `research-curation-kernel`. The kernel embraces the literature-access + research-engine lineage; positions against Zotero, Obsidian, Readwise as a pipeline backbone; ships 5–10 capabilities focused on source curation.
- **General_Workflow_Path**: Audience_Decision = `general-workflow-kernel`. The kernel proves generality with at least two non-research example consumers (e.g. customer-feedback triage + security-advisory triage); drops research-only language from core docs.
- **Example_Consumer_Set**: The integration-kit examples under `hosts/integration-kit/examples/`. Currently 7 examples, all research-shaped.
- **Non_Audience_Section**: A section in Audience_Doc that lists who the kernel explicitly does NOT serve and why.
- **Scope_Trim_List**: A bulleted list of repo features (capabilities, contracts, examples) to either retain, relocate, or delete based on Audience_Decision. Captured in `audience-scope-trim.md`.
- **README_Pitch_Block**: The "What This Repo Is For" section of `README.md`. Currently generic; this spec rewrites it to name the audience and the use case.

## Requirements

### Requirement 1 — Audience_Decision locked

**User Story:** As a kernel maintainer, I want a written record of who the kernel serves so that every future feature decision has a clear judge.

#### Acceptance Criteria

1. THE Kernel SHALL include an Audience_Doc at `AUDIENCE.md` in the repository root.
2. THE Audience_Doc SHALL state Audience_Decision as either `research-curation-kernel` or `general-workflow-kernel` in the first section.
3. THE Audience_Doc SHALL include exactly one named primary use case in concrete operational terms (not abstract: "a researcher tracking a literature stream on topic X" is concrete; "knowledge workers" is not).
4. THE Audience_Doc SHALL include a Non_Audience_Section listing at least three named not-audiences and one sentence each on why the kernel is not for them.
5. THE Audience_Doc SHALL include a "How we will know we picked right" section listing 2–3 concrete signals (e.g. "first non-team adopter is a researcher curating literature for a paper" for option a).
6. THE Audience_Doc SHALL include a "Reversal conditions" section: under what circumstances would we revisit the decision?

### Requirement 2 — README_Pitch_Block rewrite

**User Story:** As a developer landing on the README for the first time, I want the first section to name who the kernel is for so that I can decide in 30 seconds whether to keep reading.

#### Acceptance Criteria

1. THE Kernel SHALL rewrite the "What This Repo Is For" section of `README.md` to name Audience_Decision's audience in concrete terms.
2. THE rewritten block SHALL include the one named primary use case from Audience_Doc.
3. THE rewritten block SHALL link to Audience_Doc for the longer rationale.
4. THE rewritten block SHALL be at most 200 words.

### Requirement 3 — Scope_Trim_List

**User Story:** As a maintainer evaluating which features to keep, I want a written trim list so that the audience decision becomes operational rather than aspirational.

#### Acceptance Criteria

1. THE Kernel SHALL include a Scope_Trim_List at `audience-scope-trim.md` at the repo root.
2. THE Scope_Trim_List SHALL include one row per repo capability, contract, or example payload that is either retained, relocated, or deleted based on Audience_Decision. Use a CSV-like Markdown table.
3. WHERE Audience_Decision = `research-curation-kernel`, THE Scope_Trim_List SHALL retain every existing literature-access capability and SHOULD propose deleting or deprecating capabilities that are not source-curation-shaped (audit phase identifies these).
4. WHERE Audience_Decision = `general-workflow-kernel`, THE Scope_Trim_List SHALL propose adding two non-research example consumers and SHALL identify research-specific copy that should be relocated from the core README into a `docs/lineage/research-curation.md` (so the lineage remains visible without dominating the front page).

### Requirement 4 — General_Workflow_Path proof of fit

**User Story:** As a reviewer of a "general workflow kernel" pitch, I want at least two non-research example consumers shipped so that the claim is not aspirational.

#### Acceptance Criteria

1. WHERE Audience_Decision = `general-workflow-kernel`, THE Kernel SHALL ship at least two new example payloads under `hosts/integration-kit/examples/` modeling non-research source-driven workflows.
2. THE first non-research example SHALL be a customer-feedback triage workflow (or equivalent if the audit-phase finds a stronger candidate).
3. THE second non-research example SHALL be a security-advisory triage workflow (or equivalent).
4. EACH non-research example SHALL include a goal envelope, a sample source, and a working `pnpm try`-style script demonstrating end-to-end routing.
5. EACH non-research example SHALL have a test under `tests/integration/` exercising it.

### Requirement 5 — Research_Curation_Path lineage embrace

**User Story:** As a researcher landing on the README, if Research_Curation_Path is chosen I want the kernel's research-curation framing to be explicit so that I know the kernel is for me.

#### Acceptance Criteria

1. WHERE Audience_Decision = `research-curation-kernel`, THE README_Pitch_Block SHALL position the kernel against Zotero, Obsidian, and Readwise as a pipeline backbone.
2. THE Audience_Doc SHALL explicitly identify the research-curation domain as the kernel's first audience.
3. THE Kernel SHALL retain the existing literature-access capability set without scope-trimming research features.

### Requirement 6 — Verification gate

#### Acceptance Criteria

1. WHEN `pnpm run typecheck`, `pnpm run test`, `pnpm run check:build`, `pnpm run check:naming`, `pnpm run check:contracts`, and `pnpm run check:examples` run after the spec is implemented, THE Kernel SHALL exit zero on each.
2. WHERE Audience_Decision = `general-workflow-kernel`, the new example tests SHALL be part of the test count (no skipped non-research examples).
3. WHEN a new contributor reads `README.md` top-to-bottom for the first time, the audience and primary use case SHALL be unambiguous within the first paragraph.
