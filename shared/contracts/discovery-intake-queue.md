# Discovery Intake Queue Contract

## Mode

- Current: `primary` - queue is the authoritative intake surface; markdown records generated alongside for human readability
- Previous: `shadow` (transitioned 2026-03-22)

## Rules

- Every new candidate MUST have a queue entry before routing
- Markdown fast-path records SHOULD also be created for human readability
- Queue entries use the schema at `shared/schemas/discovery-intake-queue-entry.schema.json`
- Queue writes should go through `discovery/lib/discovery-intake-queue-writer.ts` and the host intake writer wrapper, not through ad hoc JSON mutation
- Unified Discovery submissions should go through `discovery/lib/discovery-submission-router.ts` and the host `discovery:submit` wrapper when an operator wants one payload that can stay queue-only, create a fast-path record, or generate the split-case record set automatically
- Queue status transitions should go through `discovery/lib/discovery-intake-queue-transition.ts` and the host transition writer wrapper, not through ad hoc JSON mutation
- Queue lifecycle sync updates should go through `discovery/lib/discovery-intake-lifecycle-sync.ts` and the host lifecycle sync wrapper when queue state and artifact linkages change together
- Simple routed Discovery records should go through `discovery/lib/discovery-fast-path-record-writer.ts` and the unified submission wrapper rather than handwritten fast-path markdown
- Split Discovery routing records should go through `discovery/lib/discovery-routing-record-writer.ts` and the host routing-record writer wrapper so routing markdown and queue linkage stay synchronized
- Split Discovery completion records should go through `discovery/lib/discovery-completion-record-writer.ts` and the host completion-record writer wrapper so final result markdown and queue completion linkage stay synchronized
- Split Discovery intake + triage + routing (+ optional completion) case records should go through `discovery/lib/discovery-case-record-writer.ts` and the host case-record writer wrapper when one candidate needs the full split path from a single canonical payload
- Split-case queue linkage should use `intake_record_path`; fast-path queue linkage should use `fast_path_record_path`
- Queue entries SHOULD include an `operating_mode` field (`note`, `standard`, or `deep`) set at triage time — see `CLAUDE.md` Operating modes section for classification rules
- Queue entries that reference a capability gap must use a valid `gap_id` from `discovery/capability-gaps.json`
- Queue entries that declare mission alignment must reference an objective from `knowledge/active-mission.md`
- Queue validation checker runs as a gate (exit 1 on failure)
- Front-door routine coverage is measured by `discovery/lib/discovery-front-door-coverage.ts`

## Primary Mode Constraints

- Queue is the source of truth for candidate status, routing, and completion tracking
- Markdown records provide human-readable detail but are not authoritative for status
- All status transitions (`pending -> processing -> routed -> completed`) must be reflected in the queue
- Split-case queue entries should retain `intake_record_path` while fast-path entries retain `fast_path_record_path`
- Transition requests use `shared/schemas/discovery-intake-transition-request.schema.json`
- Lifecycle sync requests use `shared/schemas/discovery-intake-lifecycle-sync-request.schema.json`
- Split routing-record requests use `shared/schemas/discovery-routing-record-request.schema.json`
- Split completion-record requests use `shared/schemas/discovery-completion-record-request.schema.json`
- Split case-record requests use `shared/schemas/discovery-case-record-request.schema.json`
- Fast-path record requests use `shared/schemas/discovery-fast-path-record-request.schema.json`
- Unified submission requests use `shared/schemas/discovery-submission-request.schema.json`

## Transition Record

Transitioned from shadow to primary on 2026-03-22:
- 10 candidates processed (1 through full markdown+queue path, 9 retroactive backfills from routing-log)
- Queue validation checker created and passing (10/10 valid)
- Operator approved transition
- Criteria partially met: backfill entries lack `fast_path_record_path` but all correspond to real routing-log records

Routine-usage follow-up closed on 2026-03-23:
- canonical front-door coverage analysis now lives at `discovery/lib/discovery-front-door-coverage.ts`
- split-case queue linkage normalized to `intake_record_path`
- native post-primary Discovery coverage now measures against live corpus usage instead of hand-counted markdown ratios

## Rollback Procedure

To revert to shadow mode:
1. Set `intake-queue.json` status to `shadow`
2. Restore original modeRule and syncRule in the policy section
3. Resume treating markdown fast-path records as source of truth
4. Queue validation checker reverts to informational (no exit-code enforcement needed - just document the mode change)
