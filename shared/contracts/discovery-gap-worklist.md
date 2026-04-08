# Discovery Gap Worklist

Last updated: 2026-03-22

Purpose:
- make open mission-linked capability gaps drive Discovery priority in practice
- give Discovery one machine-readable ranking surface for "what should be worked next"
- preserve the distinction between an open gap and the latest slice that improved it

Canonical surfaces:
- `discovery/capability-gaps.json`
- `discovery/gap-worklist.json`
- `discovery/intake-queue.json`
- `knowledge/active-mission.md`
- `discovery/lib/discovery-gap-worklist-generator.ts`

Required item fields:
- `gap_id`
- `worklist_rank`
- `gap_priority`
- `priority_score`
- `score_breakdown`
- `mission_objective`
- `gap_status`
- `next_slice_track`
- `next_action`

Optional item fields:
- `latest_candidate_id`
- `latest_candidate_status`
- `latest_result_path`
- `blocking_reason`

Rules:
- every unresolved gap in `capability-gaps.json` must appear exactly once in `gap-worklist.json`
- `gap-worklist.json` is generated from `capability-gaps.json`, `intake-queue.json`, and `knowledge/active-mission.md`; item rows should not be hand-edited
- worklist rank is unique and lower numbers mean higher current attention
- worklist rank must follow `priority_score` descending; use lower `worklist_rank` only as the final tie-break surface when scores match
- `next_slice_track` is the adoption target for the next bounded improvement slice
- `latest_candidate_*` describes the most recent queue candidate that materially moved the gap
- a gap may remain open even when its latest candidate is completed
- Discovery should use this worklist when choosing the next internal-signal slice instead of selecting by novelty or convenience

Priority score fields:
- `priority_score` is the computed total from the score breakdown
- `score_breakdown.base_priority` comes from `gap_priority`
- `score_breakdown.mission_pressure` rates how urgent the gap is for the active mission right now
- `score_breakdown.mission_leverage` rates how much closing the gap improves mission execution
- `score_breakdown.proof_clarity` rates how measurable the next slice is
- `score_breakdown.adaptation_leverage` rates how much the slice improves Directive Workspace's own source-adaptation engine
- `score_breakdown.blocker_penalty` represents current blocking drag and lowers total priority

Scoring rule:
- canonical scorer lives in `discovery/lib/discovery-gap-priority.ts`
- canonical generator lives in `discovery/lib/discovery-gap-worklist-generator.ts`
- current weighted model:
  - base priority: `high=50`, `medium=35`, `low=20`
  - `mission_pressure * 5`
  - `mission_leverage * 4`
  - `proof_clarity * 3`
  - `adaptation_leverage * 3`
  - minus `blocker_severity * 6`
- each 0-5 input score should be explicit enough that a human can audit why a gap is ranked where it is

Status meanings:
- `ready`: no blocker; next slice can be opened now
- `in_progress`: gap is actively being improved by an identified slice or immediate next action
- `blocked`: next slice is known but currently blocked
- `monitoring`: latest slice landed; watch the metric or operating behavior before reopening
- `resolved`: gap is closed and should no longer remain in the open registry

Track rule:
- use `architecture` when the next slice is reusable operating logic
- use `runtime` when the next slice is runtime or behavior-preserving transformation work
- use `discovery` when the next slice is still front-door behavior, intake discipline, or routing hygiene

Adoption boundary:
- the worklist is a Directive Workspace operating surface, not a Mission Control host feature
- Mission Control may validate that the generated surface matches canonical inputs and remains internally consistent
