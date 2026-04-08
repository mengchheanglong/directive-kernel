# Source Adaptation Record

Use this template when Architecture processes a source through the full extract → adapt → improve chain.
This template enforces the contracts: `source-analysis-contract` and `adaptation-decision-contract`.

---

## Source identity

- Source id:
- Source name:
- Source type:
- Source reference:
- Analysis date:
- Owning track: Architecture

## Mission alignment

- Active mission reference:
- Mission relevance:
- Capability gap addressed:
- Usefulness level: `direct` | `structural` | `meta`

## Value map

| Mechanism | Value type | Value density | Extract? |
|---|---|---|---|
| | | | |

## Baggage map

| Element | Baggage type | Why excluded |
|---|---|---|
| | `implementation` / `stack` / `scope` / `complexity` | |

## Extraction decisions

For each mechanism extracted:

### Mechanism: [name]

- Raw form in source:
- Target artifact type:
- Target path:

#### Adaptation

- Adaptation required: `yes` | `no` | `minimal`
- Adaptation actions:
  - [ ] terminology alignment
  - [ ] structural reshape
  - [ ] simplification
  - [ ] extension
  - [ ] constraint addition
  - [ ] recomposition with existing assets
- Adapted form summary:
- Original vs adapted delta:

#### Improvement

- Improvement applied: `yes` | `no`
- Improvement type:
- Improvement description:
- Original vs improved delta:
- Improvement evidence plan:

---

## Meta-usefulness check

- Improves source consumption ability: `yes` | `no`
- If yes, which category:
  - [ ] analysis quality
  - [ ] extraction quality
  - [ ] adaptation quality
  - [ ] improvement quality
  - [ ] routing quality
  - [ ] evaluation quality
  - [ ] handoff quality
- Description:

## Integration target

- Integration surface:
- Integration dependencies:
- Runtime handoff required: `yes` | `no`
- Runtime handoff ref:

## Quality summary

- Overall adaptation quality: `strong` | `adequate` | `weak` | `skipped`
- Overall improvement quality: `strong` | `adequate` | `weak` | `skipped`
- Confidence: `high` | `medium` | `low`

## Decision

- Verdict: `proceed_to_proof` | `needs_revision` | `defer` | `abandon`
- Rationale:
- Next action:
- Evidence path:
