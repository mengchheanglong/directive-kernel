**Enforced by:** shared/lib/goal.ts

# Directive Kernel Goal Input

Directive Kernel needs current goal context from the consuming project.

It does not infer the active goal from historical workspace records because those records are intentionally not shipped in this repo.

## Rule

Every source should still enter through Discovery first.

But before Discovery judges usefulness, the consuming project should provide a current goal envelope.

## Minimum Goal Envelope

- `goalId`
- `goalStatement`
- `whyNow`
- `adoptionTarget`
- `constraints`
- `successSignal`

Example:

```json
{
  "goalId": "current-project-goal",
  "goalStatement": "Improve the host project's active direction with bounded reusable capability or engine improvement.",
  "whyNow": "Current delivery pressure or explicit operator request.",
  "adoptionTarget": "runtime",
  "constraints": [
    "keep review explicit",
    "stay reversible"
  ],
  "successSignal": "One bounded useful result is materially clearer than before."
}
```

## Recommended Host Pattern

1. accept operator or application intent
2. resolve that intent into one goal envelope
3. enrich the canonical Discovery submission with that goal context
4. let Discovery perform source judgment and routing

## If The Host Project Has No Goal Model Yet

Use the fallback:

1. ask for one explicit goal statement per source submission
2. set Discovery submissions to queue-only or review-first
3. do not enable autonomous advancement
4. keep route approval human-reviewed until the host project has a stable goal resolver

## What Not To Do

- do not reuse old workspace mission history as if it were current truth
- do not let Runtime or Architecture infer product goals on their own
- do not enable automation before a host-local goal contract exists
