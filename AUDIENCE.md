# Directive Kernel Audience

## Audience (locked)

`general-workflow-kernel`

Directive Kernel is for **dev teams running source-driven workflows that need a structured intake → routing → decision pipeline.**

## Primary use case

A dev team has a stream of inbound items — bug reports, incident alerts, source repos to evaluate, feature requests, security advisories, customer feedback, papers worth tracking — and needs the same kind of decision: *what do we do with this?* The kernel takes that source, judges it against the team's current mission, routes it to the right next step, and records the decision so later work has provenance.

The team gets:
- a **mission-conditioned routing pass** that uses the team's current goals to decide whether each source is worth pursuing
- a **structured intake queue + lifecycle** so nothing gets lost in inbox triage
- a **decision-policy ledger** that records every routing choice for audit and replay
- a **read-only operator dashboard** for visibility, with mutations through CLI

## Who this is NOT for

- **End-users with a bespoke workflow tool already** — if you have a working triage system you trust, the kernel adds friction without value. The kernel pays off when you have *multiple* source streams that all need the same kind of decision.
- **Solo devs running ad-hoc tasks** — the kernel's setup ceremony (goal envelope, mission, capability gaps) is overkill if you're working alone on one stream of similar items. Use a notes app or a Github project board.
- **Teams looking for an ML routing model** — the kernel's routing is rule-based and explainable, not learned. If you want a black-box classifier, this isn't it.

## How we will know we picked right

- The first non-research adopter is a dev team using the kernel for **at least one of**: bug-report triage, incident triage, customer-feedback triage, or feature-request triage.
- The kernel's two flagship example consumers (`bug-report-triage` + `incident-triage`) run end-to-end via `pnpm test` and produce inspectable routing artifacts.
- The README's "What This Repo Is For" section names a concrete dev-team use case, not a research workflow, in the first paragraph.

## Reversal conditions

We would revisit this decision if:

1. The first three real adopters all turn out to be research-curation users despite the rewritten framing — that's evidence the kernel's actual fit is research, not general workflow.
2. The two flagship non-research example consumers prove unworkable (e.g. they require so much customization that they're not credible "examples"). That would mean the kernel is more research-shaped than the audit suggested.
3. A specific user signals that the research-curation framing was what attracted them, and removing it costs us discoverability. In that case the README adds a "Common workflows" section that lists research alongside the dev-team flows.

## Decision date

2026-05-27

## Decided by

Maintainer (general-workflow-kernel pick chosen with the kernel's structural genericness as the deciding factor).

## Lineage relocation

The research-curation lineage (literature-access capabilities, research-engine sub-package, Scientify-shaped vocabulary) stays in the codebase as one supported domain. It is documented in [`docs/lineage/research-curation.md`](./docs/lineage/research-curation.md) so adopters who want that flavor can find it without it dominating the README's first paragraph.

The two flagship example consumers documented under [`hosts/integration-kit/examples/`](./hosts/integration-kit/examples/) are:

- `bug-report-triage/` — GitHub issue → routing decision (`fix-now` / `backlog` / `wontfix` / `duplicate`)
- `incident-triage/` — alert webhook → routing decision (`page-on-call` / `monitor-only` / `auto-resolve` / `noise`)

Both examples ship working `pnpm try`-style scripts and end-to-end integration tests.
