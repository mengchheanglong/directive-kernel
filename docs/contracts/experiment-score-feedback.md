# Experiment Score Feedback Policy

Profile: `experiment_score_feedback/v1`

Purpose:
- define a deterministic review-to-score mapping for experiment and decision quality feedback
- preserve a lightweight quality signal without importing an external runtime scoring stack

Required fields:
- `score_feedback_profile`
  - must be `experiment_score_feedback/v1`
- `review_score_scale`
  - explicit score range used during review
- `score_delta_mapping`
  - deterministic reward or penalty table
- `adjustment_role_gate`
  - who may apply score changes
- `degraded_quality_behavior`
  - what happens when review quality is low but work is not rejected outright

Minimum review score scale:
- `5` = strong pass
- `4` = acceptable
- `3` = mixed
- `2` = weak
- `1` = fail

Minimum score delta mapping:
- `5 -> +2`
- `4 -> +1`
- `3 -> 0`
- `2 -> -1`
- `1 -> -2`

Adjustment role gate:
- only `reviewer`, `evaluator`, or explicitly designated quality owner may apply score deltas

Degraded quality behavior:
- low score does not force immediate rejection by itself
- low score must record fail reasons or recovery follow-up
- repeated low score should trigger blocked-work recovery or reassessment

Rules:
- scoring policy is feedback, not runtime truth
- score changes must be deterministic and auditable
- score mappings must be explicit in the product-owned policy surface
