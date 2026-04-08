# Phase-Isolated Processing Contract

Profile: `phase_isolated_processing/v1`

## Purpose

Operationalize phase isolation for heavy, judgment-sensitive Directive Workspace work.

This contract captures the surviving mechanism extracted from the arscontexta four-phase processing methodology:
- fresh context per phase
- pass state through files, not chat continuity
- keep the most semantic phase isolated from lower-judgment follow-up phases

Directive Workspace already has track-level workflows. This contract governs how a single bounded slice should execute when quality would degrade if multiple semantic phases were chained through one growing context.

## When to use

Use this contract when any of the following are true:
- a source-driven Architecture slice requires separate analysis and adaptation/improvement phases
- a slice has more than one judgment-heavy transformation stage
- the next phase depends on artifacts, not on conversational memory
- the work is likely to suffer from context-bloat or phase bleed
- the slice is intended to improve source-consumption quality, adaptation quality, or handoff quality

Do not use when:
- the slice is trivial and can be completed in one bounded pass without semantic drift
- the work is a purely mechanical update with no meaningful phase boundary
- the case is classified as NOTE operating mode (single-session, single-artifact cases do not need phase isolation)

## Core rule

When phase isolation is required, each phase must be treated as a distinct execution unit.

That means:
- the phase has its own explicit objective
- the phase consumes inputs from files or structured artifacts
- the phase emits outputs that the next phase can read without needing prior conversational context
- the next phase depends on the packet, not on "what the agent remembers"

## Canonical phases

This contract does not replace track workflows. It wraps them with execution discipline.

Typical Architecture mapping:
- `analyze`: source-analysis and value/baggage judgment
- `adapt`: extraction, reshaping, and improvement decisions
- `prove`: bounded validation that the adapted artifact is coherent and integrated
- `integrate`: final materialization into product-owned assets

Typical Discovery mapping:
- `triage`
- `route`
- `record`

Typical Runtime mapping:
- `measure`
- `transform`
- `verify`

## Required handoff packet

Every isolated phase boundary must produce a handoff packet.

Required fields:
- `packet_id`
- `candidate_id`
- `track`
- `phase_completed`
- `next_phase`
- `objective`
- `input_artifacts`
- `output_artifacts`
- `decisions_made`
- `excluded_or_deferred`
- `open_questions`
- `required_gates`
- `fresh_context_required`
- `fresh_context_reason`

Recommended fields:
- `mission_relevance`
- `capability_gap_ref`
- `phase_risks`
- `rollback_note`

Use `shared/templates/phase-handoff-packet.md` for human-readable packets and `shared/schemas/phase-handoff-packet.schema.json` when machine validation is useful.

## Phase-order rule

When full isolation is not possible:
- run the most judgment-intensive phase first
- run lower-judgment validation or formatting phases later
- never let a low-value continuation consume the context budget needed by the highest-value transformation phase

For source-driven Architecture work, the default high-judgment ordering is:
1. source analysis
2. adaptation/improvement decision
3. proof/integration

## File-over-context rule

Phase state should be transmitted through:
- contracts
- schemas
- templates
- experiment records
- handoff packets

Phase state should not depend on:
- long conversational continuity
- informal memory of prior reasoning
- hidden assumptions that are not written into the artifacts

## Small-batch rule

When processing multiple source items or multiple mechanisms:
- prefer one bounded source/mechanism bundle at a time
- do not batch unrelated semantic transformations into one oversized context
- throughput is improved by preserving quality, not by maximizing simultaneous scope

## Quality gains expected

This contract is intended to improve:
- `adaptation_quality`
- `handoff_quality`
- `analysis_quality`

It is especially important when the system is strong on doctrine but still weak on explicit adaptation execution.

## Relationship to other contracts

- Works with: `source-analysis-contract` (analysis phase content)
- Works with: `adaptation-decision-contract` (adaptation phase content)
- Works with: `architecture-mechanism-packet` when the post-adaptation output should become a reusable packet for future Architecture slices
- Works with: `architecture-adoption-criteria` (decide/integrate phase)
- Works with: `architecture-self-improvement-contract` (when the improvement is meta-useful)
- Uses: `shared/templates/phase-handoff-packet.md`
- Uses: `shared/schemas/phase-handoff-packet.schema.json`
