# Directive Kernel Audience

## Audience (current branch)

`capability-truth-kernel`

Directive Kernel is **the capability truth/projection layer underneath selected Hermes/OpenClaw skills**.

Hermes skills remain the user-facing workflow/interface. DK is used only when a capability needs stronger proof, contracts, recall, reliability, or portability than a plain skill can provide.

## Primary user

The primary user is not a generic app user. It is the operator or harness that needs to know which selected capabilities are real, verified, callable, and portable.

Current concrete users:

1. **Hermes** — the assistant/operator interface.
2. **Hermes skills** — the workflow layer that decides how the assistant should use a capability.
3. **DK Runtime** — the capability truth/projection layer under selected skills.
4. **Future OpenClaw / Jarvis-style harnesses** — possible consumers of the same verified capability truth.

## Primary use case

Hermes or another harness has a selected capability need: convert a document, crawl a site, search literature, extract public HTML, or use another deterministic tool.

DK should help answer:

1. Is this capability real and verified?
2. What contract/schema does it satisfy?
3. What execution evidence proves it works?
4. How should it be projected into Hermes/OpenClaw?
5. What failure modes and usage boundaries are known?
6. How should outcomes affect future recall and trust?

The kernel provides:

- a **verified-only capability ledger** where only proven, projection-ready capabilities surface as powers
- a **capability recall and trust loop** that lets agents find relevant verified capabilities and report outcomes
- a **projection layer** for exposing verified capabilities through MCP tools, host APIs, or Hermes skills
- a **bounded source-evaluation surface** for deciding whether selected sources deserve Runtime projection, active-memory treatment, skill smoke, note-only memory, or rejection
- a **minimal active-memory/state support pattern** for long-running operator continuity

## Layering model

```text
Hermes / OpenClaw = assistant or harness
Hermes skills     = user-facing workflow/interface
DK Runtime        = proof, contract, projection, recall, reliability
DK Discovery      = selected source evaluation / research-engine support
DK Architecture   = active memory / state-pattern support only
```

A good DK-backed skill should feel simple to the user. The skill is the interface; DK is the proof and projection layer underneath.

## What this is NOT

- **Not a replacement for Hermes skills** — skills remain the user-facing way Hermes knows how to perform workflows.
- **Not a registry-count maximizer** — ten verified working powers beat one hundred placeholder capabilities.
- **Not a blanket source consumer** — sources are evaluated only when there is a real operator need or clear capability value.
- **Not a dashboard-first product** — UI/readiness views are debugging and operator read models, not the product.
- **Not a broad Architecture experiment machine** — Architecture survives only as active-memory/state support unless explicitly re-approved.
- **Not a replacement for Hermes, OpenClaw, MCP, or Obsidian** — DK is the truth/projection layer under selected capabilities.
- **Not an ML/black-box router** — operationalization decisions should stay explainable and reviewable.

## Historical lineage (secondary packaging)

The `general-workflow-kernel` positioning (dev teams running source-driven workflows: bug-report triage, incident triage, feature-request triage) is historical public packaging. It is **not the current local north star** for this branch.

The infrastructure built under that model — intake queue, routing engine, decision-policy ledger, lifecycle lanes, and integration examples — is retained only where it supports the smaller capability-truth target.

If the kernel is ever packaged for public dev-team consumption again, the general-workflow-kernel framing can be revisited as a separate product direction. For this branch, the optimization target is verified capability truth under Hermes/OpenClaw skills.

The two flagship example consumers documented under [`hosts/integration-kit/examples/`](./hosts/integration-kit/examples/) remain lineage/reference examples:

- `bug-report-triage/` — GitHub issue → routing decision (`fix-now` / `backlog` / `wontfix` / `duplicate`)
- `incident-triage/` — alert webhook → routing decision (`page-on-call` / `monitor-only` / `auto-resolve` / `noise`)

## How we will know we picked right

- Hermes skills can clearly say when they are plain skills and when they are DK-backed.
- 100% of projected DK capabilities have explicit verification class, complete projection metadata, and usable failure-mode guidance.
- 0 placeholders are projected as MCP/Hermes-usable tools.
- Hermes can ask DK for a relevant capability and receive verified, projection-ready powers or honest non-usable candidates.
- The capability health report separates verified, candidate, placeholder, note-only, rejected, and architecture-support entries.
- New work makes DK smaller, clearer, or more truthful instead of adding feature surface.

## Reversal conditions

Revisit or freeze DK further if:

1. A plain Hermes skill solves the same problem more simply.
2. No real harness needs portability, projection truth, or reliability/outcome history.
3. Source evaluation starts creating fake work instead of supporting selected capability needs.
4. Architecture work expands beyond active memory/state support without explicit approval.
5. Dashboard/product polish becomes a substitute for verified capability usefulness.

## Decision date

2026-06-15

## Decided by

Maintainer + Hermes shrink review. This supersedes the broader 2026-06-12 Jarvis capability-kernel framing for the current local branch while preserving that work as historical lineage.

## Research curation lineage

The research-curation lineage (literature-access capabilities, research-engine sub-package) stays in the codebase as one supported domain. It is documented in [`docs/lineage/research-curation.md`](./docs/lineage/research-curation.md).

Research sources that produce callable tools or measurable capability support can feed Runtime or Discovery. Research sources that are purely informational should become notes, not DK capabilities.
