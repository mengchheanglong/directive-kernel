# Architecture

Architecture is the Engine self-improvement lane of Directive Kernel.

This repo ships the Architecture operating code in:
- `lib/`

The consuming project's generated `directive-root` should expose the active Architecture state folders:
- `01-experiments/`
- `02-adopted/`
- `03-deferred-or-rejected/`
- `04-materialization/04-implementation-targets/`
- `04-materialization/05-implementation-results/`
- `04-materialization/06-retained/`
- `04-materialization/07-integration-records/`
- `04-materialization/08-consumption-records/`
- `04-materialization/09-post-consumption-evaluations/`

Those folders are state/artifact surfaces, not source-code modules. They belong in the consuming project's `directive-root`, not as empty source folders in the package itself.
