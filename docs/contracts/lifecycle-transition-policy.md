# Lifecycle Transition Policy

Profile: `lifecycle_transition_policy/v1`

Purpose:
- define who can move a Directive workflow item from one lifecycle state to another
- make blocked-work recovery explicit instead of ad hoc
- keep lifecycle transition policy product-owned before any host implementation

Required fields:
- `transition_policy_profile`
  - must be `lifecycle_transition_policy/v1`
- `state_transition_matrix`
  - explicit allowed transitions
- `role_gate_matrix`
  - who can invoke each transition
- `blocked_recovery_lane`
  - explicit detect -> reassign -> resume path
- `promotion_guard`
  - transition policy completeness must be validated before promotion or runtime exposure

Minimum state transition matrix:
- `intake -> analyzed`
- `analyzed -> experimenting`
- `experimenting -> evaluated`
- `evaluated -> decided`
- `decided -> integrated`
- `blocked -> analyzed`
- `blocked -> experimenting`

Minimum role gate matrix:
- `operator` may move `intake -> analyzed`
- `operator` may move `analyzed -> experimenting`
- `reviewer` or equivalent review owner may move `experimenting -> evaluated`
- `decision_owner` may move `evaluated -> decided`
- `integration_owner` may move `decided -> integrated`
- `recovery_patrol` may mark an item as `blocked`
- `planner` may reassign blocked work and return it to active flow

Blocked recovery lane:
- `detect`
  - identify blocked item and capture reason
- `reassign`
  - assign recovery owner or planner lane
- `resume`
  - return the item to `analyzed` or `experimenting` with explicit rationale

Rules:
- role-gated transitions must be explicit, never implied
- blocked work must not stay in an unowned dead state
- transition policy must be complete before downstream promotion or callable exposure
- the role model should be adapted to Directive Workspace, not copied blindly from OpenMOSS
