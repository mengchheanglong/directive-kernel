# Directive Kernel Audience

## Audience (current branch)

`jarvis-capability-kernel`

Directive Kernel is **Hermes's capability acquisition, verification, and self-improvement kernel.** Its north star is compounding Hermes's assistant capabilities over time: discovering useful tools and ideas, proving they work, turning them into usable powers, and learning from outcomes.

## Primary use case

Hermes (the user's orchestrator assistant) needs a system that can:

1. Watch new AI papers, repos, tools, workflows, and user-task failures.
2. Classify each source into an operationalization decision: is this a callable capability candidate, a system-level architecture experiment, a note for Obsidian, a training-lab-only research idea, or something to reject?
3. Turn capability candidates into verified, callable powers with real execution evidence and a usable projection (MCP tool, skill, CLI wrapper, handoff prompt).
4. Run bounded system-improvement experiments with measurable hypotheses and kill criteria.
5. Promote only verified improvements into Hermes's usable skill surface.
6. Learn from outcomes — success/failure feeds back into capability trust, recall ranking, and capability-gap discovery.

The kernel provides:
- a **source operationalization classifier** that decides what to do with every source before any pipeline advancement
- a **verified-only capability registry** where only proven, projection-ready capabilities surface as Hermes powers
- a **decision-policy ledger** that records every routing decision with provenance
- a **bounded operator dashboard** showing Jarvis readiness: verified capabilities, candidates, gaps, and failures

## What this is NOT

- **Not a registry-count maximizer** — ten verified working powers beat one hundred placeholder capabilities. Registry growth is not success; Hermes getting new reliable powers is success.
- **Not a blanket source consumer** — sources that require model architecture/pretraining (training-lab-only) or are only informative (note-only) are classified honestly and never enter Runtime as fake capabilities.
- **Not a replacement for Hermes or Obsidian** — Hermes remains the assistant interface; Obsidian remains the broad memory store. DK is the capability digestive and verification system.
- **Not an ML/black-box router** — the kernel's operationalization classifier is rule-based and explainable, not learned.

## Historical lineage (secondary packaging)

The `general-workflow-kernel` positioning (dev teams running source-driven workflows: bug-report triage, incident triage, feature-request triage) is the kernel's historical public packaging. It is **not the current local north star** for this branch. The infrastructure built under that model — intake queue, routing engine, decision-policy ledger, lifecycle lanes — is retained and repurposed for the Jarvis capability kernel.

If the kernel is ever packaged for public dev-team consumption again, the general-workflow-kernel framing can be restored as the primary audience. For this branch, the Hermes/Jarvis capability compounding loop is the optimization target.

The two flagship example consumers documented under [`hosts/integration-kit/examples/`](./hosts/integration-kit/examples/) are:

- `bug-report-triage/` — GitHub issue → routing decision (`fix-now` / `backlog` / `wontfix` / `duplicate`)
- `incident-triage/` — alert webhook → routing decision (`page-on-call` / `monitor-only` / `auto-resolve` / `noise`)

Both examples ship working `pnpm try`-style scripts and end-to-end integration tests.

## How we will know we picked right

- 100% of registry entries have an explicit verification class; 0 placeholders are projected as MCP tools.
- Hermes can ask DK for a relevant capability and receive only verified, projection-ready powers (or honestly-labeled candidates).
- Every accepted source becomes exactly one of: verified capability, measured experiment, Obsidian note, or rejected item with rationale.
- The capability health report separates verified, candidate, placeholder, note-only, and rejected counts.
- Tests pass after each refactor slice.

## Reversal conditions

We would revisit this decision if:

1. The Jarvis capability model is unworkable in practice and the kernel's structural genericness is its only real value.
2. A specific adopter or public user signals that the general-workflow-kernel framing was what attracted them, and the pivot costs us real discoverability or adoption.

## Decision date

2026-06-12

## Decided by

Maintainer (Hermes capability kernel pivot chosen to align the kernel's optimization target with the user's original north star: Jarvis-style capability compounding).

## Research curation lineage

The research-curation lineage (literature-access capabilities, research-engine sub-package) stays in the codebase as one supported domain. It is documented in [`docs/lineage/research-curation.md`](./docs/lineage/research-curation.md). Research sources that produce callable tools or measurable system-level experiments can feed the capability kernel; research sources that are purely informational can become Obsidian notes.
