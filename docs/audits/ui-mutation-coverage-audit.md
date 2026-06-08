# UI Mutation Coverage Audit

Walk of `hosts/web-host/api-routes.ts` and `hosts/standalone-host/cli.ts` to inventory every operator mutation surface and its CLI/code-path counterpart.

| # | Action | Web-host endpoint | CLI subcommand | Source-of-truth artifact | Workbench value |
|---|--------|-------------------|----------------|--------------------------|-----------------|
| 1 | Submit a source | POST `/api/discovery/submissions` | `discovery-submit` | `intake-queue.json` | High |
| 2 | Approve a route | POST `/api/discovery/open-route` / `/api/discovery/resolve-routing-review` | not yet exposed | routing record | Medium |
| 3 | Reroute with answers | POST `/api/engine-runs/<runId>/reroute` | `engine-reroute` | engine run record | Medium |
| 4 | Write decision | POST `/api/runtime/promotion-seam-decisions` / `/api/runtime/selection-resolutions` | `runtime-promotion-seam-resolve` / `runtime-host-selection-resolve` | decision artifact | Medium |
| 5 | Formalize a gap | POST `/api/gaps/approve` | `gap-approve` | `capability-gaps.json` | Medium |
| 6 | Edit mission | POST `/api/mission/approve` / POST `/api/mission/preview` | `mission-approve` / `mission-preview` | `active-mission.md` + `mission-evolution-record.json` | High |
| 7 | Open runtime follow-up | POST `/api/runtime/open-follow-up` | `runtime-followup-write` | follow-up record | Medium |
| 8 | Open architecture handoff | POST `/api/architecture/handoff-start` | not yet exposed | handoff-start artifact | Medium |

## Decision (locked)

Ship **Operator_Dashboard** now, defer workbench. The dashboard is read-only; every state mutation stays in the CLI per the Mutation_Boundary_Note. Two CLI commands (`discovery-route-approve` and `architecture-handoff-start`) are not yet exposed on the CLI side; those gaps should be closed in the CLI first, not papered over with UI forms.

## Workbench scope estimate (deferred)

- ~6 Lit form components: submission form, routing-approval form, reroute-answers form, gap-approval form, mission-edit form, handoff-start form.
- ~4 mutation flows needing optimistic UI: submit source, approve route, reroute with answers, write decision.
- ~1 error-toast subsystem shared across all forms.
- ~2–3 weeks of work for a single developer, assuming the existing `page-actions.ts` POST helpers are reused.
