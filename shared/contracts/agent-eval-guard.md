# Agent Eval Guard Contract

Purpose:
- enforce bounded runtime-eval evidence on Runtime promotion records before callable eval-lane claims
- ensure eval-lane promotions capture explicit thresholds, observed metrics, guard result, and rollback scope

Scope:
- applies to Runtime promotion records whose `Quality gate profile` is `agent_eval_guard/v1`
- applies to linked proof artifacts referenced by `Proof path`

Canonical profile:
- `agent_eval_guard/v1`

Canonical family:
- `bounded_agent_eval`

Canonical proof shape:
- `agent_eval_guard_snapshot/v1`

Primary host checker:
- `npm run check:directive-promptfoo-runtime`

Baseline thresholds:
- score >= `0.8`
- failure rate <= `0.15`
- cost USD <= `0.5`

Required evidence:
- promotion record declares `Quality gate profile: agent_eval_guard/v1`
- promotion record declares `Promotion profile family: bounded_agent_eval`
- promotion record declares `Proof shape: agent_eval_guard_snapshot/v1`
- promotion record declares `Primary host checker: npm run check:directive-promptfoo-runtime`
- promotion record links the host compile artifact and proof artifact
- proof artifact records:
  - promotion profile family
  - proof shape
  - primary host checker
  - total tests
  - passed
  - failed
  - score
  - failure rate
  - cost USD
  - gate outcomes for:
    - `npm run eval:agents`
    - `npm run check:agent-evals`
    - `npm run check:agent-eval-regression`

Decision rules:
1. A bounded eval lane may claim `pass` only when all observed metrics satisfy thresholds.
2. A bounded eval lane must remain scoped to eval artifacts and guard checks; it does not imply broad upstream runtime adoption.
3. Rollback must remove slice-specific Runtime artifacts and checker wiring without disturbing unrelated host eval infrastructure.

Validation hooks:
- `npm run check:directive-promptfoo-runtime`
- `npm run check:ops-stack`

Canonical inventory:
- `runtime/meta/PROMOTION_PROFILES.json`
