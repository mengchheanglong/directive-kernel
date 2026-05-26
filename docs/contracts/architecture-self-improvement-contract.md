# Architecture Self-Improvement Contract

Profile: `architecture_self_improvement/v1`

## Purpose

Operationalize Architecture's role as the self-improvement layer of Directive Workspace.

The doctrine states:
> Architecture should become better at improving the engine's ability to adapt sources.

This contract defines how Architecture tracks, evaluates, and proves that it is actually getting better at source consumption over time.

Without this contract, meta-usefulness remains a label on adaptation-decision records with no operating consequence. The system can claim "this improves our ability to consume future sources" without evidence, and no mechanism checks whether the claim was true.

## When to use

Use this contract when:
- an Architecture adoption is flagged as `meta_useful = yes`
- an Architecture cycle is being evaluated for self-improvement gains
- the system is deciding which self-improvement investments to make next
- a retrospective is being performed on source-consumption quality
- a meta-useful adoption materially changes how earlier evidence should be judged

## Self-improvement categories

Architecture self-improvement is measured across seven categories. Each corresponds to a step in the source flow or a quality dimension of the operating system:

| Category | What it measures | How it compounds |
|---|---|---|
| `analysis_quality` | Are source analyses more accurate, faster, or more complete? | Better analysis → fewer wasted extractions |
| `extraction_quality` | Are extraction decisions more precise? Less unnecessary baggage imported? | Better extraction → less rework during adaptation |
| `adaptation_quality` | Are adaptations producing mechanisms that fit Directive Workspace better? | Better adaptation → less friction during integration |
| `improvement_quality` | Are improvements going deeper beyond the original source? | Better improvement → more Directive-owned value per source |
| `routing_quality` | Are routing decisions more accurate? Fewer mis-routes? | Better routing → less wasted Architecture/Runtime effort |
| `evaluation_quality` | Are proofs and evaluations more rigorous? Fewer false positives? | Better evaluation → higher trust in adopted mechanisms |
| `handoff_quality` | Are Architecture-to-Runtime handoffs cleaner? Less information lost? | Better handoff → faster Runtime operationalization |

## Self-improvement evidence structure

When an Architecture adoption is flagged as meta-useful, the adopted record must include a self-improvement evidence block:

### Required fields

- `self_improvement_category`: one of the seven categories above
- `claim`: one sentence describing what future improvement this mechanism enables
- `mechanism`: what specifically was adapted/improved that creates the self-improvement effect
- `baseline_observation`: what was the system's capability in this category before this mechanism? (qualitative or quantitative)
- `expected_effect`: what should change in future source-processing cycles because of this mechanism?
- `verification_method`: how will we know the claim was true?
  - `next_cycle_comparison`: compare the next source-processing cycle against this baseline
  - `structural_inspection`: the mechanism's presence in the operating system is itself the evidence
  - `metric_tracking`: track a specific evaluator metric across cycles
  - `retrospective_judgment`: human or agent judgment at next cycle review

### Optional fields

- `verification_result`: filled in at next cycle review — was the claim true?
- `verification_date`: when the verification was performed
- `verification_notes`: what was observed
- `generation_boundary_ref`: path to a generation-boundary note when the adoption opens a new evidence generation

## Generation boundary trigger

If a meta-useful adoption materially changes how prior evidence should be interpreted, open a boundary per `self-improvement-generation-boundary`.

Examples:
- a new packet, gate, or review mechanism means older slices no longer count as clean confirmation of the current system
- a new handoff or partition rule changes what counts as a good Architecture result
- a new evaluator guard changes how self-improvement claims should be judged

In those cases:
- old evidence can remain as baseline context
- old evidence must not be blended into clean confirmation of the new generation
- the next cycle should report post-boundary confirmation explicitly

## Cycle evaluation structure

At the end of each Architecture cycle (or when a new source-processing wave begins), use this structure to evaluate self-improvement:

### Cycle comparison record

- `cycle_id`: identifier for this Architecture cycle (e.g., date range or wave name)
- `sources_processed`: count of sources that went through the source-adaptation chain this cycle
- `mechanisms_extracted`: count of mechanisms extracted
- `mechanisms_adapted`: count that received explicit adaptation (not raw adoption)
- `mechanisms_improved`: count that received explicit improvement beyond source
- `meta_useful_adoptions`: count flagged as meta-useful
- `adaptation_coverage`: `mechanisms_adapted / mechanisms_extracted`
- `improvement_coverage`: `mechanisms_improved / mechanisms_extracted`
- `meta_usefulness_rate`: `meta_useful_adoptions / total_adoptions`
- `generation_boundary_events`: count of generation boundaries opened this cycle
- `post_generation_confirmations`: count of source-driven slices that count as clean confirmation after the latest open boundary

### Category-level assessment

For each of the seven categories, answer:
- `current_state`: `strong` | `adequate` | `weak` | `not_yet_exercised`
- `change_since_last_cycle`: `improved` | `stable` | `degraded` | `first_cycle`
- `evidence`: one sentence describing the basis for the assessment
- `highest_priority_gap`: what would most improve this category next?

### Cycle verdict

- `overall_self_improvement`: `improving` | `stable` | `degrading`
- `strongest_category`: which category improved most this cycle
- `weakest_category`: which category needs the most investment next
- `next_cycle_priority`: what self-improvement investment should the next Architecture cycle prioritize?

## Rules

- Every meta-useful adoption must include a self-improvement evidence block. The label alone is not enough.
- The `claim` must be falsifiable. "This makes the system better" is not a valid claim. "This makes source analysis faster because X" is valid.
- Self-improvement evidence is not a gate — it does not block adoption. It is a tracking mechanism that creates accountability for meta-usefulness claims.
- If a meta-useful adoption changes the baseline for how prior evidence should be judged, open a generation boundary and keep pre-boundary evidence out of clean confirmation counts.
- Cycle evaluation is recommended at the start of each new Architecture wave, not at the end of every individual adoption.
- If `verification_result` shows a claim was false, that is useful information, not a failure. Record it and use it to improve future meta-usefulness judgment.
- The cycle comparison record is the Architecture equivalent of Runtime's evaluator results — it measures whether the system is getting better, not just bigger.

## Anti-patterns

- Labeling everything as meta-useful to inflate priority. If more than 50% of adoptions in a cycle are flagged meta-useful, the classification is probably too loose.
- Claims that cannot be verified. "Improves overall system quality" is not verifiable. "Reduces baggage import rate in future source analyses" is verifiable.
- Skipping cycle evaluation. The evaluation structure only works if cycles are actually compared.
- Blending pre-boundary and post-boundary evidence after a material self-improvement change. That inflates confirmation quality and hides whether the new system actually worked.
- Treating self-improvement tracking as overhead. It is the mechanism that makes Architecture the self-improvement layer instead of just a well-organized archive.

## Relationship to other contracts

- Receives input from: `adaptation-decision-contract` (meta-usefulness flag and category)
- Receives input from: `architecture-adoption-criteria` (usefulness level treatment and adoption record)
- Feeds into: `architecture-completion-rubric` (cycle-level completion assessment)
- Feeds into: `evaluator-contract` (Architecture adaptation evaluation metrics)
- Complements: `source-analysis-contract` (which identifies meta-usefulness at analysis time)
- Works with: `self-improvement-generation-boundary` when a meta-useful adoption opens a new evidence generation
