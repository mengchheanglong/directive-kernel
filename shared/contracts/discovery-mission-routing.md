# Discovery Mission Routing

Last updated: 2026-03-22

Purpose:
- make Discovery routing more mission-conditioned in product code instead of mainly manual judgment
- assess incoming Discovery candidates against active mission pressure, open capability gaps, and track signals
- keep routing guidance product-owned and host-agnostic

Canonical surfaces:
- `discovery/lib/discovery-mission-routing.ts`
- `discovery/lib/discovery-gap-worklist-generator.ts`
- `knowledge/active-mission.md`
- `discovery/capability-gaps.json`

Assessment outputs:
- `recommended_track`
- `recommended_record_shape`
- `mission_priority_score`
- `confidence`
- `matched_gap_id`
- `route_conflict`
- `needs_human_review`
- `score_breakdown`
- `rationale`

Rules:
- the routing assessment is advisory unless a human explicitly accepts or edits the route
- explicit operator route choices should be preserved as input, but conflicts with the computed route must be surfaced
- mission-conditioned routing must use the active mission plus unresolved capability gaps, not source type alone
- Runtime and Architecture remain separated by adoption target, not by source type
- `recommended_record_shape` is allowed to stay conservative (`queue_only`) when routing clarity is still weak

Track guidance:
- recommend `discovery` when the candidate is mainly front-door behavior, intake discipline, queue/routing hygiene, or review enforcement
- recommend `architecture` when the candidate is mainly structural usefulness, operating logic, schemas, policies, workflow improvements, or adaptation quality
- recommend `runtime` when the candidate is mainly runtime usefulness, callable capability, importable operations, or behavior-preserving transformation

Host boundary:
- Directive Workspace owns the routing assessment logic
- Mission Control may display or validate the assessment, but must not redefine the scoring model locally
