# Architecture Artifact Lifecycle

Profile: `architecture_artifact_lifecycle/v2`

## Purpose

Define the taxonomy, required fields, transition rules, and lifecycle governance for Architecture artifacts.

Without this contract, Architecture records have no type system. Experiments, adopted records, and deferred decisions look structurally similar, differ in ad hoc ways, and transition between states without explicit criteria.

## Artifact states

Every active Architecture artifact exists in exactly one of these states:

### `experiment`

Location: `architecture/01-experiments/`

An experiment is a bounded proof slice. It tests whether a mechanism has extractable value.

Required fields:
- candidate id or name
- experiment date
- owning track (must be Architecture)
- objective (one sentence)
- bounded scope (what is in, what is out)
- validation gates
- rollback path
- result summary
- next decision (explicit: adopt / defer / reject / needs-more-evidence)

An experiment may reference `source-analysis-contract` and `adaptation-decision-contract` when it involves source-driven work, but experiments are not required to satisfy adoption criteria.

### `adopted`

Location: `architecture/02-adopted/`

An adopted record declares that a mechanism has been accepted into the Architecture operating system.

Default rule:
- `adopted` is the normal finish surface after a bounded experiment when the result is accepted.
- An adopted record does not automatically open the deep materialization tail.
- Continue into implementation-target / implementation-result / retained / integration / consumption / evaluation only when the adoption explicitly requires deep continuation.

Required fields:
- adoption date
- candidate id or name
- status class (per `architecture-completion-rubric`)
- usefulness level: `direct` | `structural` | `meta`
- rationale (why adopted, what value it provides)
- rollback path
- deep continuation required: `yes` | `no`

Required when `deep continuation required: no`:
- retained value in product-owned Architecture form

Required when `deep continuation required: yes`:
- next bounded implementation target or explicitly described implementation continuation boundary
- materialized artifacts (list of product-owned file paths) once implementation/result is recorded

Required for source-driven adoptions:
- source reference (pinned commit or URL)
- extracted patterns (what was taken from the source)
- excluded baggage (what was deliberately left behind)
- adaptation evidence (how the extracted value was reshaped for Directive Workspace, per `adaptation-decision-contract`)

Required for meta-useful adoptions:
- self-improvement evidence block (per `architecture-self-improvement-contract`)

Recommended for all adoptions:
- adoption criteria reference (per `architecture-adoption-criteria`)
- Runtime handoff note (explicit: yes with ref, or no with threshold justification)

### Legacy `reference-pattern` records

`reference-pattern` remains a historical classification term only.

There is no longer an active `architecture/05-reference-patterns/` surface.
Do not create new reference-pattern artifacts.

For new work:
- keep the mechanism in `architecture/01-experiments/` until it is clear enough to promote
- or defer/reject it in `architecture/03-deferred-or-rejected/`
- or materialize it directly into `shared/contracts/`, `shared/schemas/`, `shared/templates/`, `engine/`, or lane-owned code

### `deferred`

Location: `architecture/03-deferred-or-rejected/`

A deferred record preserves a decision not to adopt, with re-entry criteria.

Required fields:
- decision date
- candidate id or name
- decision: `defer` | `reject`
- reason (specific, not vague)
- re-entry criteria (for defer: what would trigger re-evaluation)
- extracted value retained (what was worth noting even though adoption was declined)
- excluded as baggage (what was the primary rejection driver)

## Runtime handoff is a transition, not a state

`Runtime-handoff` is not a fifth Architecture artifact state.

It is a transition outcome recorded on top of an Architecture adoption when:
- the Architecture value has been captured
- the remaining work is runtime operationalization
- the Runtime threshold question is answered "no" - the mechanism would not be valuable without a runtime surface

Track Runtime handoff through:
- the adopted Architecture record
- `shared/contracts/architecture-to-runtime.md`
- any downstream Runtime record that accepts the handoff

## Transition rules

### experiment -> adopted

Requirements:
- experiment result is positive
- adoption criteria are met (per `architecture-adoption-criteria`)
- usefulness level is classified
- if meta-useful, self-improvement evidence block is included

Default finish rule:
- `experiment -> adopted` is enough for normal NOTE/STANDARD Architecture work
- deep continuation is exceptional and must be explicit on the adopted record
- do not assume every adopted Architecture result needs implementation-target, retained, integration, consumption, or post-consumption evaluation artifacts

### experiment -> deferred

Requirements:
- experiment completed but value is insufficient, premature, or blocked
- re-entry criteria are explicit
- extracted value retained is documented

### Legacy reference-pattern handling

If historical repo records mention `reference-pattern`, treat that as a legacy classification:
- either promote the value into an active product-owned surface
- or leave it as historical evidence only
- do not reopen the deleted `architecture/05-reference-patterns/` surface

### adopted -> Runtime handoff

Requirements:
- Architecture has captured its own value as a product-owned artifact
- the remaining work is runtime operationalization
- the Runtime threshold check confirms the mechanism needs a runtime surface
- an explicit `architecture-to-runtime` handoff record exists or is explicitly queued as the next step

## Classification shortcuts

For quick classification of an Architecture record:

1. Does it test a hypothesis? -> `experiment`
2. Does it declare a materialized product artifact? -> `adopted`
3. Does it explain why something was not adopted? -> `deferred`
4. Does it describe runtime work remaining after Architecture is done? -> still `adopted`, with a Runtime handoff note

## Pre-doctrine records

Records created before the source-adaptation chain contracts (before 2026-03-22) are governed by this lifecycle contract going forward but are not required to be retroactively rewritten.

Instead, pre-doctrine records should be:
- classified by usefulness level in the corpus normalization record
- assessed for contract coverage gaps
- enriched with normalization annotations when reviewed or referenced in new work
- promoted or retired if their state no longer matches their actual role

### Normalization annotation policy

When a pre-doctrine record is reviewed, referenced in new work, or selected for normalization, add a `## Normalization annotation (retroactive, <date>)` section at the end of the record. Do not modify the original content.

Required annotation fields:

**Lifecycle classification:**
- Origin: `source-driven` | `internally-generated`
- Usefulness level: `direct` | `structural` | `meta`
- Meta-usefulness category (if meta): per `architecture-self-improvement-contract`
- Status class: per `architecture-completion-rubric`
- Runtime threshold check: yes/no with reasoning

**Contract coverage assessment:**
- Source analysis: performed / not performed (pre-doctrine) / n/a (internal)
- Adaptation decision: performed / implicit / not performed / n/a
- Adoption criteria: applied / not applied / n/a
- Adaptation quality: `strong` | `adequate` | `weak` | `n/a` - with brief justification
- Improvement quality: `strong` | `adequate` | `weak` | `n/a` - with brief justification

**Self-improvement evidence (for meta-useful records only):**
- Per `architecture-self-improvement-contract` evidence block structure
- Label as "retroactive identification" to distinguish from forward-looking evidence

Rules:
- annotations are additive - they do not replace or modify the original record content
- annotations should be honest about gaps - "not performed (pre-doctrine)" is a valid classification
- do not fabricate adaptation or improvement evidence that does not exist in the record
- a pre-doctrine record with a normalization annotation is "normalized"; one without is "classified only"

### Historical-record review checklist

When reviewing a pre-doctrine adopted record, check these items:

1. Is the record in the correct state? An adopted record in `03-adopted/` should describe materialized product-owned artifacts. If it describes work-in-progress, it may belong in experiments. If it describes a decision not to adopt, it belongs in deferred.
2. Is the usefulness level correct? Check whether the mechanism improves the engine's own source-consumption ability (meta), improves the framework structure (structural), or provides runtime value (direct/Runtime).
3. Are the materialized artifacts still present? Verify that the file paths listed in the record still exist. If not, the record may need a staleness note.
4. Is the status class still accurate? A `product_materialized` record whose artifacts have been moved or deleted may need reclassification.
5. Does the record have a normalization annotation? If not, add one per the normalization annotation policy above.
6. For meta-useful records: is self-improvement evidence present? If missing, add a retroactive identification block.

## Rules

- Every Architecture artifact must be in exactly one state.
- State must be inferable from the artifact's location and content.
- Runtime handoff is a transition note on an adopted record, not a separate state.
- Transitions require explicit evidence, not implicit drift.
- Preserve useful but not-yet-promoted value in experiments until it can be promoted or explicitly deferred.
- The corpus normalization record tracks the classification state of all adopted Architecture work.

## Relationship to other contracts

- Works with: `architecture-adoption-criteria` (adoption readiness and artifact type selection)
- Works with: `architecture-self-improvement-contract` (meta-usefulness evidence for adopted records)
- Works with: `architecture-completion-rubric` (status classes for completion tracking)
- Works with: `architecture-to-runtime` (Runtime handoff transition)
- Governs: all active records in `architecture/01-experiments/`, `03-adopted/`, `04-deferred-or-rejected/`

