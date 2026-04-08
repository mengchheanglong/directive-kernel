# Promotion Quality Gate Contract

Purpose:
- enforce quality-gate evidence on Runtime promotion records before runtime-callable claims
- ensure promotion decisions capture deterministic thresholds, observed metrics, validation state, and fail reasons

Scope:
- applies only to Runtime promotion records whose `Quality gate profile` is `promotion_quality_gate/v1`
- applies to linked proof artifacts referenced by `Proof path`

Non-applicable profiles:
- Runtime promotion records may use other profile families when the runtime claim is not citation/coverage based
- those records must be governed by their own product-owned contract family and host enforcement path

Canonical profile:
- `promotion_quality_gate/v1`

Canonical family:
- `research_quality_gate`

Canonical proof shape:
- `quality_metric_snapshot/v1`

Primary host checker:
- `npm run check:directive-promotion-quality-contracts`

Baseline thresholds:
- full-text coverage >= `80%`
- evidence-binding >= `90%`
- citation-error rate <= `2%`

Required fields (promotion + proof artifacts):
- `Quality gate profile`
- `Promotion profile family`
- `Proof shape`
- `Primary host checker`
- `Full-text coverage threshold (%)`
- `Evidence-binding threshold (%)`
- `Citation-error threshold (%)`
- `Observed full-text coverage (%)`
- `Observed evidence-binding (%)`
- `Observed citation error rate (%)`
- `Quality gate result` (`pass | degraded_quality | fail`)
- `Validation state` (`self_validated | openreview_related | openreview_not_found | external_validated`)
- `Quality gate fail reasons`

Decision rules:
1. If all observed metrics satisfy thresholds, `Quality gate result` must be `pass`.
2. If one or more metrics miss threshold, `Quality gate result` must be `degraded_quality` or `fail`.
3. `Quality gate fail reasons` must be explicit when result is not `pass`.
4. `pass` cannot be claimed with non-empty fail reasons.
5. Promotion artifacts and proof artifacts must agree on candidate id and quality gate result.

Validation hooks:
- `npm run check:directive-promotion-quality-contracts`
- `npm run check:ops-stack`

Canonical inventory:
- `runtime/meta/PROMOTION_PROFILES.json`
