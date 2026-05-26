# Architecture

Architecture is the Engine self-improvement lane of Directive Kernel.

This repo ships the Architecture operating code in:
- `lib/`

Grouped public operating surfaces:
- `lib/control/`
- `lib/adoption/`
- `lib/materialization/`
- `lib/experiments/`

Those grouped folders are now the real filesystem layout for Architecture operating code, not just conceptual buckets. Put new Architecture code in the matching grouped folder instead of reintroducing flat `architecture/lib/architecture-*` files.

The consuming project's generated `directive-root` should expose the active Architecture state folders:
- `01-experiments/`
- `02-adopted/`
- `03-deferred-or-rejected/`
- `04-materialization/implementation-targets/`
- `04-materialization/implementation-results/`
- `04-materialization/retained/`
- `04-materialization/integration-records/`
- `04-materialization/consumption-records/`
- `04-materialization/post-consumption-evaluations/`

Those folders are state/artifact surfaces, not source-code modules. They belong in the consuming project's `directive-root`, not as empty source folders in the package itself.
