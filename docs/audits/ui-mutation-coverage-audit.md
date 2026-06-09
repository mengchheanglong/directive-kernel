# UI Mutation Coverage Audit

Walk of `hosts/web-host/api-manifest.ts` (`ROUTE_TABLE`) and
`docs/operator-cli.md` to inventory every operator mutation surface and its
CLI/code-path counterpart. Refreshed against current manifest after the I8
workbench pass.

| # | Operation name | HTTP endpoint | CLI command | Workbench value |
|---|---|---|---|---|
| 1 | `discovery_submit` | `POST /api/discovery/submissions` | `discovery-submit` | High |
| 2 | `discovery_front_door` | `POST /api/discovery/front-door` | API-only | Medium |
| 3 | `discovery_open_route` | `POST /api/discovery/open-route` | API-only | High |
| 4 | `discovery_resolve_routing_review` | `POST /api/discovery/resolve-routing-review` | API-only | High |
| 5 | `engine_run_plan_progress` | `POST /api/engine-runs/:runId/plan-progress` | API-only | Medium |
| 6 | `engine_run_reroute` | `POST /api/engine-runs/:runId/reroute` | `engine-reroute` | Medium |
| 7 | `mission_preview` | `POST /api/mission/preview` | `mission-preview` | High |
| 8 | `mission_approve` | `POST /api/mission/approve` | `mission-approve` | High |
| 9 | `mission_reject` | `POST /api/mission/reject` | `mission-reject` | Medium |
| 10 | `mission_revert` | `POST /api/mission/revert` | `mission-revert` | Medium |
| 11 | `gaps_approve` | `POST /api/gaps/approve` | `gap-approve` | Medium |
| 12 | `gaps_reject` | `POST /api/gaps/reject` | `gap-reject` | Low |
| 13 | `runtime_open_follow_up` | `POST /api/runtime/open-follow-up` | `runtime-followup-write` | Medium |
| 14 | `runtime_open_proof` | `POST /api/runtime/open-proof` | API-only | Medium |
| 15 | `runtime_open_runtime_capability_boundary` | `POST /api/runtime/open-runtime-capability-boundary` | API-only | Low |
| 16 | `runtime_open_promotion_readiness` | `POST /api/runtime/open-promotion-readiness` | API-only | Low |
| 17 | `runtime_selection_resolutions` | `POST /api/runtime/selection-resolutions` | `runtime-host-selection-resolve` | High |
| 18 | `runtime_promotion_seam_decisions` | `POST /api/runtime/promotion-seam-decisions` | `runtime-promotion-seam-resolve` | High |
| 19 | `runtime_registry_acceptance_decisions` | `POST /api/runtime/registry-acceptance-decisions` | `runtime-registry-accept` | Medium |
| 20 | `architecture_handoff_start` | `POST /api/architecture/handoff-start` | API-only | Medium |
| 21 | `architecture_bounded_closeout` | `POST /api/architecture/bounded-closeout` | API-only | Medium |
| 22 | `architecture_note_handoff_closeout` | `POST /api/architecture/note-handoff-closeout` | API-only | Low |
| 23 | `architecture_bounded_continuation` | `POST /api/architecture/bounded-continuation` | API-only | Medium |
| 24 | `architecture_adopt_result` | `POST /api/architecture/adopt-result` | API-only | High |
| 25 | `architecture_create_implementation_target` | `POST /api/architecture/create-implementation-target` | API-only | Low |
| 26 | `architecture_create_implementation_result` | `POST /api/architecture/create-implementation-result` | API-only | Medium |
| 27 | `architecture_confirm_retention` | `POST /api/architecture/confirm-retention` | API-only | Medium |
| 28 | `architecture_create_integration_record` | `POST /api/architecture/create-integration-record` | API-only | Low |
| 29 | `architecture_record_consumption` | `POST /api/architecture/record-consumption` | API-only | Medium |
| 30 | `architecture_evaluate_consumption` | `POST /api/architecture/evaluate-consumption` | API-only | Medium |
| 31 | `architecture_reopen_from_evaluation` | `POST /api/architecture/reopen-from-evaluation` | API-only | Low |

## Summary

- **Total POST operations:** 31 (matching `ROUTE_TABLE` exactly)
- **CLI-backed:** 12 (discovery-submit, engine-reroute, mission-preview,
  mission-approve, mission-reject, mission-revert, gap-approve, gap-reject,
  runtime-followup-write, runtime-host-selection-resolve,
  runtime-promotion-seam-resolve, runtime-registry-accept)
- **API-only:** 19

## Decision

Ship the bounded operator workbench. The browser surface now executes the
highest-value bounded operator mutations directly against the same kernel
routes used by the CLI. API-only gaps still exist, but they are no longer a
reason to force the whole workbench back into read-only mode.

## Remaining workbench gaps

- API-only routes still not surfaced as first-class dedicated pages remain open
  for follow-up polish.
- CLI parity is still incomplete for some Architecture and Runtime seams, but
  that is a CLI backlog item, not a reason to regress the web workbench.

*Audit refreshed against current `ROUTE_TABLE` from
`hosts/web-host/api-manifest.ts` and CLI surface from
`docs/operator-cli.md`.*
