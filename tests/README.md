# tests/

This directory holds every kernel-level test executed by Vitest. Tests are
discovered through `vitest.config.ts` at the repo root, which globs
`tests/**/*.test.ts`.

## Layout

- `unit/` — unit tests for individual modules. Mirrors the source tree shape so
  the source file for any test is locatable by inspection
  (e.g. `tests/unit/engine/<module>.test.ts` covers `engine/<module>.ts`).
- `property/` — property-based tests written with `fast-check`. Each property
  runs at least 100 generated examples and is annotated with a comment linking
  it back to the property number in `design.md`.
- `property/_arbitraries/` — shared `fast-check` generators imported by the
  property tests. Files here are **not** test files; they have no `.test.ts`
  suffix and are skipped by Vitest's discovery glob.
- `integration/` — end-to-end suites that exercise full engine, host, or
  hardening flows. May read and write under `os.tmpdir()`.

## Naming convention

- `*.test.ts` — any test file Vitest should pick up.
- `*.property.test.ts` — cosmetic suffix for property tests (helps grep). Not
  enforced by config; Vitest discovers any `*.test.ts` file.
- Files in `_arbitraries/` (or any other `_*` helper directory) carry no
  `.test.ts` suffix and are imported as library modules.

## Running

- `pnpm run test` — single run, exits with the Vitest exit code.
- `pnpm run test:watch` — watch mode for local development.

## Concurrent tests

Some property tests (`tests/property/concurrent-submissions.property.test.ts`) spawn multiple Node worker threads and are **gated** by the environment variable `CONCURRENT_TESTS=1`. These tests are skipped by default because they require additional system resources and are not safe to run in parallel with other test files.

To run concurrent tests:

```bash
CONCURRENT_TESTS=1 pnpm run test
```

CI runs concurrent tests in a dedicated workflow step to avoid interference with the main test suite.

## Integration tests and tmpdir

Integration suites use unique paths under `os.tmpdir()` (timestamp suffixed)
per run. Cleanup is best-effort and **does not** run by default — temp
directories are intentionally left in place after a run so traces remain
available for forensics. CI runners discard the workspace on completion, so
this only matters locally.
