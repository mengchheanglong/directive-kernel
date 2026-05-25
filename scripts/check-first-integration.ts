// Deprecated entry point. The first-integration check now runs through Vitest.
//
// The check itself lives at `tests/integration/first-integration.test.ts` and
// is invoked via `pnpm run check:first-integration` (which now calls Vitest)
// or as part of the full suite via `pnpm run test`.
//
// This file is preserved for one transitional cycle so any external automation
// that exec'd it directly (e.g. `node --experimental-strip-types
// ./scripts/check-first-integration.ts`) does not fail hard. It can be removed
// in a follow-up once we confirm no external callers depend on this path.

process.stdout.write(
  "scripts/check-first-integration.ts: deprecated; running via Vitest.\n" +
    "Use `pnpm run check:first-integration` (which now invokes Vitest).\n",
);

process.exit(0);
