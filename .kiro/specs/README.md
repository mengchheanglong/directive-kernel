# Kiro Specs Index

This folder holds promoted execution specs. It is not the roadmap itself.

Use the task surfaces in this order:

1. `../../Fix_Plan.md`
   Historical fix track and acceptance record.
2. `../../_improvements/Improvement_Plan.md`
   Active enhancement backlog and status source of truth.
3. This folder
   Concrete execution specs for items that were promoted out of the plans.

## Shipped specs

- `directive-kernel-audience-pick`
- `directive-kernel-concurrency-locking`
- `directive-kernel-data-retention`
- `directive-kernel-hello-world-quickstart`
- `directive-kernel-js-build`
- `directive-kernel-numbered-folder-simplify`
- `directive-kernel-schema-example-drift`
- `directive-kernel-security-posture`
- `directive-kernel-surface-prune`
- `directive-kernel-test-infrastructure`
- `directive-kernel-ui-direction`
- `directive-kernel-v9-cut`

## Deferred / stub specs

- `directive-kernel-operator-workbench`
  Intentional future stub. The kernel shipped the read-only dashboard decision, and the workbench remains deferred until there is concrete operator demand.

## Working rule

- Add a spec here only when a plan item is ready to execute.
- Mark status in the owning plan when the work ships.
- Keep historical audit artifacts in `../../docs/audits/`, not here.
