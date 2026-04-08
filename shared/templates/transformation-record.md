# Transformation Record Template

Use this template for behavior-preserving transformation work in Runtime.

Transformation work improves implementation quality while preserving existing behavior.
It is a first-class Runtime capability lane because it is highly verifiable.

- Candidate id:
- Candidate name:
- Record date:
- Transformation type: [speed | cost | reliability | maintainability | correctness | runtime-fit | quality]
- Discovery intake path:

## Before State

- Component:
- Current implementation:
- Measured baseline:
  - metric:
  - value:
  - measurement method:

## After State

- Proposed change:
- Preservation claim: [what behavior must remain identical]
- Expected improvement:
  - metric:
  - target value:
  - measurement method:

## Evaluator

- Evaluator type: [automated | manual | hybrid]
- Evaluator command (if automated):
- Comparison mode: [before-after | threshold | regression-check]
- Baseline artifact path:
- Result artifact path:

## Proof

- Correctness preserved: [yes/no + evidence]
- Metric improvement measured: [yes/no + values]
- Rollback path:
- Rollback tested: [yes/no]

## Decision

- Decision state:
- Adoption target: Runtime
- Promotion record (if promoted):
- Mission alignment (which active-mission objective does this serve):
- Addresses known capability gap (gap_id or n/a):
