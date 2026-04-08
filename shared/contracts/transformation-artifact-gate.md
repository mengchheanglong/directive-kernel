# Transformation Artifact Gate

Profile: `transformation_artifact_gate/v1`

## Purpose

Prevent Directive Workspace from treating storage, rearrangement, or routing movement as if real processing happened.

This contract captures the surviving mechanism extracted from arscontexta's generation-effect gate:
- no artifact, no exit
- organization without transformation does not count as processing
- progression through the system should require at least one transformed artifact that carries new value

Directive Workspace already has records and queues. This gate defines when work has actually been processed rather than merely moved.

## Core rule

A source-driven Architecture slice must not count as processed unless it produced at least one transformed artifact.

Valid transformed artifacts include:
- a product-owned contract
- a schema
- a template
- a policy
- a doctrine/workflow update
- a reusable reference pattern with explicit retained value and excluded baggage
- a handoff packet that captures new transformed understanding rather than only transport metadata

Invalid substitutes include:
- moving files between folders
- renaming or reclassifying a source without new interpretation
- copying source notes into another record without adaptation
- queue/routing status updates by themselves
- markdown expansion that adds wording but not transformed operating value

## When to use

Use this gate when:
- Architecture processes an external source
- Discovery hands off a source into Architecture
- an Architecture experiment claims the source was "processed"
- a cycle evaluation needs to distinguish true transformation from organizational churn

Do not use when:
- the work is only queue intake or triage in Discovery
- the work is a Runtime runtime transformation (Runtime uses proof + evaluator lanes instead)

## Required processing outcome

For a source-driven Architecture slice to pass this gate, all of the following must be true:

1. A transformed artifact exists.
2. The artifact is Directive-owned or an explicitly retained Directive reference pattern.
3. The artifact shows how the source was adapted or improved, not merely summarized.
4. The source slice records what was excluded as baggage.
5. The next phase or final record can point to the artifact directly.

## Artifact-quality test

Ask these questions:

1. If the source note disappeared, would the produced artifact still carry usable Directive value?
2. Did the slice create a reusable operating asset or only a better description of the source?
3. Can another agent or operator use the artifact without reopening the original source and reconstructing the reasoning?
4. Does the artifact encode a transformed judgment, constraint, structure, or interface?

If the answer is "no" to most of these, the work did not pass the gate.

## Gate result states

- `passed`
  - at least one transformed artifact exists and satisfies the artifact-quality test
- `partial`
  - the slice produced useful analysis but has not yet materialized the transformed artifact
- `failed`
  - the slice only reorganized, summarized, or moved information without transformation

## Relationship to source-adaptation chain

This gate strengthens the doctrine-required flow:

`Source -> Analyze -> Route -> Extract -> Adapt -> Improve -> Prove -> Decide -> Integrate + Report`

It prevents regression to:

`Source -> describe -> store`

For source-driven Architecture work:
- source analysis identifies value and baggage
- adaptation decision defines how value changes
- transformation artifact gate checks that the change became a reusable Directive artifact

## Relationship to cycle evaluation

This gate is especially important for:
- `adaptation_quality`
- `improvement_quality`
- `extraction_quality`

Cycle evaluations should treat slices that fail this gate as evidence of organizational activity, not successful source adaptation.

## Relationship to other contracts

- Works with: `source-analysis-contract`
- Works with: `adaptation-decision-contract`
- Works with: `architecture-adoption-criteria`
- Works with: `phase-isolated-processing`
- Works with: `architecture-mechanism-packet`
- Feeds into: `architecture-cycle-evaluation.md`
- Feeds into: `architecture-completion-rubric.md`
