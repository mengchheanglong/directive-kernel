# Source Analysis Contract

Profile: `source_analysis/v1`

## Purpose

Operationalize the source-analysis step of the canonical source flow:

**Source → Analyze → Route → Extract → Adapt → Improve → Prove → Integrate**

This contract governs the Analyze step.
It ensures every source entering Architecture gets a structured value judgment before extraction begins.

Without this contract, source analysis defaults to "what is interesting?" instead of the doctrine-required questions:
- what value does this source contain for the active mission?
- what is baggage?
- what should be excluded?
- what can be adapted to fit Directive Workspace better than the original?
- what can be improved on top of the original?

## When to use

Use this contract when:
- a source has been routed to Architecture from Discovery
- Architecture is performing deeper evaluation before extraction
- a re-analysis is triggered for an existing source

Do not use for:
- Discovery triage (use triage-record or discovery-fast-path-record)
- Runtime runtime evaluation (use evaluator-contract)

## Required analysis fields

Every Architecture source analysis must answer the following:

### 1. Source identity

- `source_id`: candidate id or name
- `source_type`: `github-repo` | `paper` | `framework` | `tool` | `workflow` | `method` | `other`
- `source_reference`: URL, DOI, or path
- `analysis_date`: ISO date

### 2. Mission alignment

- `active_mission_ref`: reference to current active-mission document
- `mission_relevance`: how this source relates to the active mission objective
- `capability_gap_addressed`: which known capability gap (if any) this source helps close
- `usefulness_level`: `direct` | `structural` | `meta` (per doctrine three-level classification)

### 3. Value map

- `extractable_mechanisms`: list of specific mechanisms, patterns, or logic worth extracting
- `value_density`: `high` | `medium` | `low` — ratio of extractable value to total source size
- `value_type_per_mechanism`: for each mechanism, classify as:
  - `pattern`: a reusable design or workflow pattern
  - `policy`: a rule or constraint worth adopting
  - `schema`: a data shape worth standardizing
  - `contract`: an interface or handoff structure
  - `algorithm`: a specific computation or logic
  - `workflow`: a multi-step operating procedure

### 4. Baggage map

- `implementation_baggage`: source-specific implementation details that should not be imported
- `stack_baggage`: technology/framework dependencies that do not fit Directive Workspace
- `scope_baggage`: features or capabilities that are out of scope for the active mission
- `complexity_baggage`: unnecessary complexity that adds cost without value

### 5. Adaptation opportunity

- `adaptation_candidates`: for each extractable mechanism, describe how it should be adapted to fit Directive Workspace better than the original source
- `adaptation_type_per_candidate`:
  - `rename`: terminology or naming alignment
  - `reshape`: structural change to fit Directive Workspace patterns
  - `simplify`: strip unnecessary complexity
  - `extend`: add capability the original lacks
  - `constrain`: add boundaries or safety the original lacks
  - `recompose`: combine with existing Directive Workspace assets

### 6. Improvement opportunity

- `improvement_candidates`: for each extractable mechanism, describe how it can be improved beyond the original source
- `improvement_type_per_candidate`:
  - `quality`: make it more correct, reliable, or maintainable
  - `efficiency`: make it faster, cheaper, or smaller
  - `safety`: add rollback, boundaries, or verification the original lacks
  - `generality`: make it reusable across more Directive Workspace surfaces
  - `composability`: make it combinable with other Directive Workspace assets
  - `evaluability`: make it measurable where the original is not

### 7. Exclusion list

- `excluded_elements`: specific parts of the source that should not be extracted
- `exclusion_reason_per_element`: why each is excluded

### 8. Analysis verdict

- `overall_verdict`: `proceed_to_extraction` | `needs_deeper_analysis` | `low_value_defer` | `reject`
- `verdict_rationale`: one-paragraph justification
- `extraction_priority`: `high` | `medium` | `low`
- `estimated_adaptation_cost`: `trivial` | `moderate` | `significant`

## Rules

- Never skip the baggage map. The doctrine requires asking "what should be excluded?" not just "what is useful?"
- Never skip the adaptation opportunity. The doctrine requires `extract → adapt → improve`, not `extract → adopt`.
- The improvement opportunity section is what separates Architecture from passive source cataloging.
- If `usefulness_level` is `meta`, explicitly describe how the extracted value improves Directive Workspace's own source-consumption ability.
- If the analysis verdict is `proceed_to_extraction`, the value map and adaptation candidates become inputs to the extraction phase.

## Relationship to other contracts

- Receives input from: `discovery-to-architecture` handoff
- Feeds output to: `adaptation-decision-contract` (extraction + adaptation phase)
- Works with: `phase-isolated-processing` when the analysis phase should hand off through an explicit packet rather than conversational continuity
- Feeds downstream to: `architecture-mechanism-packet` when the source-derived mechanism should become a reusable building block for future Architecture work
- Feeds downstream to: `cross-source-synthesis-packet` when the retained value emerges from collision, agreement, or tension across multiple sources
- Feeds downstream to: `mixed-value-source-partition` when packet reuse is partial and the source contains both Architecture-retained and later Runtime-candidate value
- Feeds downstream to: `architecture-adoption-criteria` (adoption readiness, artifact type, Runtime threshold)
- Feeds downstream to: `architecture-self-improvement-contract` (when `usefulness_level` is `meta`)
- Does not replace: `evaluator-contract` (which governs measurement, not analysis)
- Does not replace: `architecture-review-guardrails` (which governs review quality, not source analysis)
