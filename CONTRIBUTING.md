# Contributing

## Naming rules

1. **No `Directive` type-name prefix and no `directive-` filename prefix inside the kernel.** Exported types, interfaces, classes, and functions must not start with `Directive`. Filenames must not start with `directive-`. The sole allowlisted exception is `engine/types.ts` for `DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` — see [Fix_Plan.md](Fix_Plan.md) F4/F7/F11 for the deferral rationale.

2. **A file's basename does not repeat its immediate parent folder name as a prefix.** For example, a file inside `discovery/` must not be named `discovery-foo.ts`; a file inside `engine/execution/` must not be named `execution-bar.ts`.

3. **JSON Schema files in `shared/schemas/` use unprefixed shape names.** Schema `$id` values and filenames must not carry a `Directive` or `directive-` prefix. The schema filename alone is the shape name.

4. **Schema constants and exported types in `engine/types.ts` follow rules 1–3.** `engine/types.ts` is the canonical home for engine-level type and constant definitions. Any new export added there must comply with the naming rules above.

5. **Name conformance is checked by `scripts/check-naming.ts`.** Run the check locally with:

   ```bash
   pnpm run check:naming
   ```

   The script exits 0 on a clean tree and 1 when any violation is found. Violation details are printed to stderr.

6. **Top-level lane folders use a numeric prefix when canonical ordering matters; nested folders inside any lane do NOT use a numeric prefix.** For example, `architecture/01-experiments/` and `architecture/04-materialization/` are ordered top-level lanes; `architecture/04-materialization/implementation-targets/` (not `04-implementation-targets/`) is a nested subfolder whose sibling order is not meaningful.

7. **Related documents.** See [GLOSSARY.md](GLOSSARY.md) for the canonical vocabulary and [shared/contracts/schema-versioning.md](shared/contracts/schema-versioning.md) for schema evolution policies.

## Concurrency rules

Every read-modify-write of a mutable JSON store SHALL go through `withPerFileLock` (see `shared/lib/file-io.ts`). Every append to an append-only ledger SHALL go through `appendJsonLine`. Every host process SHALL acquire the directive-root process lock at boot via `acquireDirectiveRootLock` (see `shared/lib/process-lock.ts`).

See [shared/contracts/concurrency-model.md](shared/contracts/concurrency-model.md) for the full concurrency model including stale-lock recovery semantics and the federation roadmap.

For the data retention and ledger rotation schedule, see [shared/contracts/data-retention.md](shared/contracts/data-retention.md).
