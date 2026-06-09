# Reference Consumer

This is a thin host, not a new lifecycle. It demonstrates the minimum surface a consuming project needs to embed Directive Kernel without absorbing kernel logic.

## Goal Resolver

The host resolves exactly one goal envelope at a time. It reads the current goal from a project-level source (typically `DIRECTIVE_GOAL.md` at the consuming project root or directive root) and passes it into the kernel's goal input contract.

The host does not interpret or rewrite the goal. It passes through the goal as-is.

Executable example:

```powershell
pnpm exec tsx examples/reference-consumer/flow.ts --directive-root ./local/reference-consumer/directive-root
```

## Submit Source

The host submits sources through the canonical Discovery front door. Each submission includes the source itself plus the current goal envelope. The host does not pre-classify, pre-route, or pre-filter sources before submission.

## Read State

The host reads kernel-owned state through the existing snapshot and detail read surfaces. It does not synthesize or derive new state. The host treats the kernel's read surfaces as authoritative and does not maintain its own parallel state.

## Bounded Decisions

The host surfaces bounded review items (routing decisions, promotion readiness, operator inbox entries) to an operator. It does not make autonomous workflow decisions. Every lifecycle transition that requires operator approval stays explicit.

## Do Not Reimplement

Do not reimplement kernel logic. Do not build host-local intake queues, routing engines, or lifecycle models. The kernel owns the workflow; the host owns the thin transport and operator-facing surface.

Files in this example:

- `goal-envelope.json` - thin host goal input
- `source.json` - one representative customer feedback source
- `flow.ts` - executable golden path using the shipped integration-kit helpers
