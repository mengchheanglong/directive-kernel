// Deprecated entry point. The hardening checks now run through Vitest.
//
// The checks themselves live under `tests/integration/hardening/` and are
// invoked via `pnpm run check:hardening` (which now calls Vitest) or as part
// of the full suite via `pnpm run test`.
//
// This file is preserved for one transitional cycle so any external automation
// that exec'd it directly (e.g. `node --experimental-strip-types
// ./scripts/check-system-hardening.ts`) does not fail hard. It can be removed
// in a follow-up once we confirm no external callers depend on this path.

process.stdout.write(
  "scripts/check-system-hardening.ts: deprecated; running via Vitest.\n" +
    "Use `pnpm run check:hardening` (which now invokes Vitest).\n",
);

process.exit(0);
