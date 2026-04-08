# Directive Discovery

Discovery is the mission-aware intake queue, routing surface, and capability-gap detector for Directive Kernel.

Everything enters through Discovery first.

It owns:
- mission-aware candidate intake
- mission-context interpretation that defines usefulness
- capability-gap detection and registry
- routing decisions by adoption target
- defer, monitor, reject, and reference holding states

It does not own:
- deep experiments by default
- reusable operating-code extraction
- runtime/callable delivery

## Default operational loop

1. Default fast path:
- create one fast-path record in `01-intake/`
- capture intake, triage, and routing in that one record
2. Split into `02-triage/` and `03-routing-log/` only when the case is complex, disputed, or held.
3. Route the candidate to one of:
- Architecture
- Runtime
- `04-monitor/`
- `05-deferred-or-rejected/`
- `reference/`
4. If the route is not clear after first pass, hold it instead of stretching Discovery work.

## Folders in `directive-root/discovery/`

- `01-intake/` for fast-path markdown intake records
- `02-triage/` for complex-case triage records
- `03-routing-log/` for routing decisions
- `04-monitor/` for monitor holding state
- `05-deferred-or-rejected/` for rejected or deferred cases
- `reference/` for background knowledge and source maps

## Key files

- `intake-queue.json` as the authoritative intake queue
- `capability-gaps.json` as the machine-readable capability-gap registry
- `gap-worklist.json` as the ranked open-gap worklist

## Rules

- All new candidates enter through Discovery first.
- Discovery routes by adoption target, not source type.
- Discovery is mission-conditioned.
- The numbered Discovery folders are state/artifact surfaces in the consuming project's `directive-root`, not empty source folders in the package itself.
