# Self-Improvement Generation Boundary

Profile: `self_improvement_generation_boundary/v1`

## Purpose

Operationalize the evidence-boundary rule for Architecture self-improvement.

When Directive Workspace materially changes its own source-processing system, old evidence does not automatically remain valid confirmation of the new system. The historical record still matters, but it should be treated as context and baseline, not blended with fresh confirmation as if nothing changed.

This contract adapts MetaClaw's useful boundary behavior into Directive Workspace:
- tag evidence with the generation it belongs to
- open a new generation when the operating surface changes materially
- discard or downgrade stale evidence instead of mixing it into the new baseline

Without this contract, Architecture can claim a self-improvement mechanism worked while still relying on pre-change evidence that never exercised the new mechanism.

## When to use

Use this contract when:
- a meta-useful adoption materially changes how source-processing evidence should be interpreted
- a new operating mechanism supersedes the baseline used by earlier cycle evaluations
- a cycle evaluation needs to distinguish historical context from clean post-change confirmation
- an Architecture wave should start with a fresh proof boundary rather than blended evidence

Do not use when:
- the change is minor and does not alter how prior evidence should be judged
- the mechanism only adds documentation with no effect on actual source-processing behavior

## Required boundary fields

- `generation_id`: stable identifier for the new evidence generation
- `boundary_date`: ISO date
- `triggering_adoption_ref`: adopted record that opened the new generation
- `affected_surface`: list of Architecture surfaces whose evidence interpretation changed
- `superseded_behavior`: what the prior generation treated as acceptable evidence
- `new_behavior`: what must now be true for evidence to count as clean confirmation
- `stale_evidence_scope`: which prior evidence must not be counted as confirmation after the boundary
- `carry_forward_allowed`: what can still be retained as historical context or stable baseline
- `required_reset_actions`: what must be reset, excluded, or re-verified after the boundary
- `next_clean_proof_requirement`: what post-boundary evidence must be produced next
- `closure_condition`: what will make the new generation sufficiently confirmed

## Rules

- A generation boundary is about evidence discipline, not artifact deletion.
- Pre-boundary evidence can remain as historical context, corpus baseline, or origin narrative if it still helps understanding.
- Pre-boundary evidence must not be counted as clean confirmation of a changed Architecture behavior after a boundary opens.
- Open a generation boundary only when the adoption materially changes interpretation of prior evidence. Do not inflate minor edits into boundary events.
- If a cycle evaluation crosses a generation boundary, it must state which evidence is historical carry-forward and which evidence is post-boundary confirmation.
- A generation boundary should usually be triggered by a meta-useful adoption, because that is when Directive Workspace changes its own ability to consume future sources.

## Carry-forward guidance

Usually safe to carry forward:
- source inventory and corpus counts
- unchanged contracts and templates
- historical weaknesses and baseline observations
- reference links to prior slices

Usually not safe to carry forward as confirmation:
- proof claims for a mechanism that did not exist yet
- cycle metrics for a category whose operating logic changed materially
- packet reuse or handoff quality claims from slices that never exercised those mechanisms
- evaluation-quality claims that predate a new guard, gate, or review boundary

## Relationship to other contracts

- Works with: `architecture-self-improvement-contract` when a meta-useful adoption changes the baseline for future confirmation
- Feeds into: `architecture-cycle-evaluation` when cycle metrics must distinguish historical baseline from clean post-boundary proof
- Complements: `architecture-adoption-criteria` by tightening evidence discipline after self-improving adoptions
- Does not replace: `architecture-artifact-lifecycle` because this governs evidence generations, not artifact state
