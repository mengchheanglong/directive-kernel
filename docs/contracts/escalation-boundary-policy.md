# Escalation And Boundary Policy

Profile: `escalation_boundary_policy/v1`

Purpose:
- define safe baseline vs elevated execution modes
- constrain high-risk work to explicit background-only evaluation windows
- make boundary checks explicit before a slice crosses host or protocol boundaries

Required fields:
- `escalation_mode`
  - `baseline` | `elevated`
- `background_evaluation_window`
  - declared allowed window for high-risk or disruptive evaluation
- `boundary_checks`
  - explicit checks for `auth`, `health`, and `protocol`
- `boundary_check_result`
  - pass/fail summary for the declared checks

Escalation modes:
- `baseline`
  - default safe mode
  - use for low-risk evaluation and policy extraction
- `elevated`
  - only for explicitly approved higher-risk slices
  - requires declared boundary checks and background-only execution window when disruptive

Background-only evaluation window:
- high-risk experiments should not run in the active operator path by default
- scheduler-gated or background-only windows must be declared before execution
- if no special window is needed, record `none`

Boundary checks:
- `auth`
  - verify access boundary or permission requirement
- `health`
  - verify health probe or readiness boundary exists
- `protocol`
  - verify external interface or adapter boundary is explicit

Rules:
- baseline is the default mode
- elevated mode requires explicit justification
- boundary checks must be documented before promotion or host-facing integration
- auth, health, and protocol boundaries are distinct and should not be collapsed into one vague note
