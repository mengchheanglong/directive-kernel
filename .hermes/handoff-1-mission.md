Task: Mission Graduation — Rewrite DIRECTIVE_GOAL.md for system hardening phase + clean intake queue

Repository:
C:\Users\User\AppData\Local\hermes\systems\directive-kernel

Primary specs:
- C:/Users/User/AppData/Local/hermes/directive-root/directive-root/DIRECTIVE_GOAL.md (REWRITE)
- C:/Users/User/AppData/Local/hermes/directive-root/directive-root/discovery/intake-queue.json (MODIFY — mark completed, remove dupes)
- engine/mission/health.ts (scoring reference — read only)

Context:
The web-dev mission is COMPLETE (5/5 libraries registered: shadcn/ui, daisyUI, React Bits, React Bootstrap, Tremor). All have callable execution evidence and Hermes skills. Cybersec is also done (5/5). The auto-ingest pipeline has produced 27 devops registrations. 36 total registry entries.

The engine's decision-policy ledger has 4 policy suggestions that tell us exactly what to fix:
1. "Mission lane ownership is repeatedly under-specified" — need single Primary Lane
2. "Weak or missing constraints repeatedly forced extra review" — need action-verb constraints
3. "Reviewed runtime cases keep landing without an open gap match" — need Architecture lane for self-improvement tracking
4. "Require explicit review, scope, and rollback constraints before enabling confident routing"

The intake queue has 51 entries, 0 marked completed. 13 "pending" items are stale duplicates of already-registered capabilities. The queue needs cleanup.

Constraint scoring formula (from engine/mission/health.ts):
- Action verbs at line start = 2 pts each: Limit, Require, Preserve, Keep, Avoid, Review, Restrict, Validate
- Non-generic tokens = 1 pt each
- GENERIC_TOKENS (0 pts): active, better, bounded, capability, current, directive, goal, improve, kernel, mission, product, quality, result, routing, signal, system, useful, workspace
- Lane clarity: 1 lane = 5/5, 2 lanes = 4/5, 3 lanes = 3/5
- adoptionTarget match = +1 bonus
- Max constraint score: 5

Target: A-grade mission health (80+).

Allowed files:
- C:/Users/User/AppData/Local/hermes/directive-root/directive-root/DIRECTIVE_GOAL.md (REWRITE)
- C:/Users/User/AppData/Local/hermes/directive-root/directive-root/discovery/intake-queue.json (MODIFY)

Forbidden:
- Do not modify engine/ scoring code
- Do not modify the host or pipeline scripts
- Do not change the Goal ID
- Do not touch runtime/ artifacts

Required implementation:

PART A — Rewrite DIRECTIVE_GOAL.md

New mission: "Directive Kernel System Hardening" — DK has proven it can operationalize external capabilities at scale (36 registry entries across 4 domains). Now it should harden itself: fix automation gaps, accelerate earned autonomy, clean technical debt, and bootstrap the Architecture lane for long-horizon self-improvement.

Write the file with these sections:

```
# Directive Kernel System Hardening

## Goal ID
hermes-capability-bootstrap

## Goal Statement
Harden Directive Kernel's own infrastructure: fix the inbox poller delivery mechanism, auto-prune stale intake queue entries, accelerate earned autonomy from 0 to 80+ route-class scores, and bootstrap the Architecture lane with one tracked self-improvement artifact. The pipeline has proven external capability operationalization works — now the system must prove it can improve itself.

## Why Now
The auto-ingest pipeline produces 27+ registrations per cycle but the inbox poller cron is erroring, 51 intake entries are stale (0 completed), and the Architecture lane has zero artifacts. These are systemic gaps that compound with scale. Fixing them now prevents exponential technical debt.

## Adoption Target
runtime

## Primary Lane
Runtime

## Architecture Improvement Goal
Bootstrap the Architecture lane for long-horizon system improvement:
- Auto-pruning stale intake queue entries (duplicates of registered capabilities)
- Fixing the inbox poller cron delivery mechanism
- Accelerating earned autonomy through batch review resolution
- Creating the first tracked Architecture adoption artifact
Success: One Architecture adoption artifact documenting a pipeline improvement.

## Constraints
- Limit automated routing to route classes with earned autonomy score of 70 or higher
- Require explicit operator review for any Architecture lane routing decision until 3 clean handoff artifacts exist
- Preserve all existing registry entries and their callable execution evidence — never delete or mutate registered capabilities
- Keep the auto-ingest pipeline running on its current 12-hour cadence without modification
- Avoid duplicate registry entries by validating candidate IDs against the existing registry before routing
- Review the decision-policy ledger after every batch of 10 review resolutions before enabling further automation
- Restrict DIRECTIVE_GOAL.md modifications to operator-initiated sessions only — never auto-rewrite from a cron job
- Validate all new intake submissions against community signals before routing (GitHub stars minimum 5000, maintenance activity within 180 days)

## Usefulness Signals
- Prefer work that directly improves Directive Kernel's own infrastructure
- mission-relevant usefulness
- safe routing through Discovery → Runtime → registry
- Community-validated sources carry stronger routing confidence
- Self-improvement signals (engine, pipeline, automation) strengthen Architecture lane routing

## Success Signal
1. Inbox poller cron delivers successfully for 3 consecutive ticks
2. Intake queue shows 30+ completed entries and 0 stale pending duplicates
3. Decision-policy ledger shows 5+ route classes with scores of 70+
4. Architecture lane has 1+ adoption artifact
```

PART B — Clean intake queue

Edit discovery/intake-queue.json:
1. Mark all 13 "pending" items as "completed" if a matching registry entry exists in runtime/08-registry/. These are stale duplicates.
2. Mark all "routed" items as "completed" if a matching registry entry exists. Check by substring matching candidate_name against registry filenames.
3. Remove the 7 health test entries (health-v3 through health-v7, health-test-v2, Mission Health Test) — these were test artifacts from mission health debugging.
4. Keep only genuinely incomplete items as "pending" or "routed".
5. Update the "updatedAt" field to today's date.

After cleanup, verify: `python -c "import json; d=json.load(open('discovery/intake-queue.json')); entries=d['entries']; print(f'Total: {len(entries)}, Completed: {len([e for e in entries if e[\"status\"]==\"completed\"])}, Pending: {len([e for e in entries if e[\"status\"]==\"pending\"])}')"`

Self-check before final:
| Check | Pass/Fail | Evidence |
| --- | --- | --- |
| DIRECTIVE_GOAL.md has 8 constraints starting with action verbs | | |
| Zero constraints use generic tokens (bounded, capability, system, etc.) | | |
| Primary Lane is "Runtime" (single lane) | | |
| Goal Statement references system hardening, not web-dev | | |
| Success Signal has 4 measurable criteria | | |
| Intake queue: 30+ completed, 0 stale pending dupes | | |
| Health test entries removed from intake queue | | |
| Architecture Improvement Goal section present | | |

Final report must include:
1. Full new DIRECTIVE_GOAL.md content
2. Intake queue before/after counts (total, completed, pending, routed)
3. Number of items marked completed
4. Number of health test items removed
5. Self-check table
