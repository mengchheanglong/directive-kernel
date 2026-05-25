# Design Document

## Overview

This design wires Vitest into `@directive/kernel` as the kernel-level test runner, introduces `fast-check` for property-based testing on four invariant-bearing modules, adds unit tests for the three-lane workspace definitions, migrates the existing `check:first-integration` and `check:hardening` scripts into Vitest integration suites, and adds a GitHub Actions CI workflow.

The kernel runs TypeScript directly today via `node --experimental-strip-types`. Vitest natively understands TypeScript through Vite's resolver, so we can drop the experimental flag for tests without introducing a JS build step (the JS build is F2, downstream of this work). Tests run against `.ts` files directly, importing kernel modules with their `.ts` extensions, the same way the rest of the kernel does.

The change is additive: existing scripts (`typecheck`, `check:first-integration`, `check:hardening`, the host runners) keep working. The two custom check scripts get rewired to invoke the migrated Vitest suites instead of running their bespoke entry points. The hardening helper modules under `scripts/hardening/` become library code that Vitest tests import; the original entry-point scripts stay as thin shims for back-compat during the transition.

## Architecture

### Test runner stack

- **Vitest** (`^2.x`, latest stable) as the runner. Native TypeScript support via Vite, no transpile step needed.
- **fast-check** (`^3.x`, latest stable) for property-based tests. Each property runs at minimum 100 iterations.
- **Node 22+** assumed (already required by the kernel's `--experimental-strip-types` usage). No additional runtime requirements.

### Why Vitest over node:test

Three reasons drove the choice:

1. **TypeScript out of the box.** Vitest's Vite-based resolver handles `.ts` extensions, `allowImportingTsExtensions`, and `verbatimModuleSyntax` without configuration ceremony. node:test requires a separate loader or strip-types flag.
2. **Property test ergonomics.** `fast-check` integrates with any runner, but the Vitest reporter renders shrunk counterexamples cleanly.
3. **Watch mode and structured output.** The migrated integration suites need readable failure output. Vitest provides this; the existing custom scripts produce a wall of `console.log` lines with no per-assertion isolation.

### Directory layout

```
directive-kernel/
├── vitest.config.ts                              ← new
├── tests/                                         ← new
│   ├── README.md
│   ├── unit/
│   │   └── engine/
│   │       └── directive-workspace-lanes.test.ts
│   ├── property/
│   │   ├── process-fingerprint.property.test.ts
│   │   ├── decision-policy-ledger.property.test.ts
│   │   ├── approval-boundary.property.test.ts
│   │   └── source-input-normalization.property.test.ts
│   └── integration/
│       ├── first-integration.test.ts
│       └── hardening/
│           ├── advisory-checks.test.ts
│           ├── engine-checks.test.ts
│           ├── host-checks.test.ts
│           └── policy-checks.test.ts
├── .github/
│   └── workflows/
│       └── ci.yml                                  ← new
└── scripts/                                        ← keeps existing entry points; see below
    ├── check-first-integration.ts                  ← becomes a thin Vitest invoker
    ├── check-system-hardening.ts                   ← becomes a thin Vitest invoker
    └── hardening/                                  ← unchanged; tests import from here
        ├── advisory-checks.ts
        ├── engine-checks.ts
        ├── host-checks.ts
        └── policy-checks.ts
```

Test file naming convention:

- `*.test.ts` for any test file Vitest should pick up.
- `*.property.test.ts` for property-based tests (cosmetic; helps grep but is not enforced by config).
- Tests under `tests/unit/<area>/` mirror the source tree shape so the source file for any test is locatable by inspection.

### Vitest configuration

`vitest.config.ts` at the repository root:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [
      "node_modules/**",
      "ui/**",
      "discovery/research-engine/**",
      "hosts/integration-kit/**",
      "local/**",
      "state/**",
      "dist/**",
    ],
    globals: false,
    environment: "node",
    testTimeout: 30_000,        // integration suites can touch the filesystem
    hookTimeout: 30_000,
    reporters: ["default"],
    pool: "forks",              // each test file in its own process — keeps integration tests honest
    isolate: true,
  },
  resolve: {
    // Vitest reads tsconfig.repo.json automatically through Vite's TS support;
    // no manual path mapping is required because the kernel uses relative imports
    // with explicit .ts extensions throughout.
  },
});
```

Notes:
- `pool: "forks"` is chosen because the integration suites read and write under `os.tmpdir()` and we want clean process state per file.
- `globals: false` keeps test imports explicit (`import { describe, it, expect } from "vitest"`), matching the kernel's `verbatimModuleSyntax` posture.
- No `coverage` config in this spec; coverage is later work.

### `package.json` script wiring

New / changed scripts:

```jsonc
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "check:first-integration": "vitest run tests/integration/first-integration.test.ts",
    "check:hardening": "vitest run tests/integration/hardening"
    // existing scripts unchanged
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "fast-check": "^3.22.0"
    // existing devDependencies unchanged
  }
}
```

The two `check:*` scripts now invoke Vitest scoped to the migrated suites. This preserves the existing call-site contract (anything in the repo, docs, or downstream automation that runs `pnpm run check:hardening` keeps working) while routing through the new harness.

The original entry-point scripts under `scripts/` (`check-first-integration.ts`, `check-system-hardening.ts`) are kept for one transitional cycle. They're rewritten to print a deprecation note and exit zero — actual work is done by Vitest. They can be deleted in a follow-up once we confirm no external automation calls them directly.

## Components and Interfaces

### Property test pattern (template)

Each property test file follows the same shape:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { computeProcessFingerprint } from "../../engine/process-fingerprint.ts";
// import an arbitrary builder local to this test file
import { sourceInputArb } from "./_arbitraries/source-input.ts";

describe("process-fingerprint", () => {
  it("Property 1: same input → same hash", () => {
    fc.assert(
      fc.property(sourceInputArb, (input) => {
        const a = computeProcessFingerprint(input);
        const b = computeProcessFingerprint(input);
        return a === b;
      }),
      { numRuns: 100 },
    );
  });

  it("Property 2: small mutation → different hash", () => {
    fc.assert(
      fc.property(sourceInputArb, fc.string({ minLength: 1, maxLength: 32 }), (input, salt) => {
        const mutated = { ...input, candidateName: `${input.candidateName} ${salt}` };
        return computeProcessFingerprint(input) !== computeProcessFingerprint(mutated);
      }),
      { numRuns: 100 },
    );
  });
});
```

Each property:
- Imports its module via `.ts` extension.
- Builds an arbitrary that is co-located in `tests/property/_arbitraries/` to encourage reuse.
- Runs at least 100 examples.
- Has a comment annotation linking it to the design property number (added in the task implementation).

### Arbitrary builders

A small library of generators lives at `tests/property/_arbitraries/`:

- `source-input.ts` — arbitrary records matching the source input shape used by Fingerprint_Module and Source_Normalization_Module.
- `ledger-entry.ts` — arbitrary entries for the decision-policy ledger.
- `approval-state.ts` — emits a tagged union `{ kind: "allowed" | "disallowed", state: ... }` so allowed/disallowed properties share generators.

These files are not test files and so are not picked up by Vitest's `include` glob; they are imported as library modules by the property test files.

### Lane definitions unit test

The unit test for `engine/directive-workspace-lanes.ts` exercises every plan callback path:

```typescript
import { describe, it, expect } from "vitest";
import { createDirectiveWorkspaceEngineLanes } from "../../../engine/directive-workspace-lanes.ts";

describe("createDirectiveWorkspaceEngineLanes", () => {
  it("returns three lanes with the expected ids", () => {
    const set = createDirectiveWorkspaceEngineLanes();
    expect(set.lanes.map((l) => l.laneId)).toEqual(["discovery", "architecture", "runtime"]);
  });

  // For each lane: invoke planExtraction, planAdaptation, planImprovement, planProof
  // with a representative planning input and assert structural shape.

  it("runtime planProof returns transformation proof when transformationSignal > 0", () => {
    // ...
  });

  it("runtime planProof returns runtime_proof when transformationSignal === 0", () => {
    // ...
  });

  it("architecture planIntegration returns a non-empty nextAction", () => {
    // ...
  });

  it("respects laneOverrides", () => {
    // smoke-check that the override path is wired
  });
});
```

A small fixtures helper builds the various `DirectiveEngineLane*PlanningInput` shapes the callbacks need; it lives alongside the test as `tests/unit/engine/_fixtures/lane-planning-inputs.ts`.

### Integration suites

**First-integration suite** (`tests/integration/first-integration.test.ts`):

The existing `scripts/check-first-integration.ts` makes ten `assert.equal` calls against the result of `runFirstHostIntegrationFlow`. The migration converts each `assert.equal` into its own `it(...)` inside a single `describe("first host integration flow")` block, sharing a `beforeAll` that runs the flow once and stashes the result.

```typescript
import { beforeAll, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { runFirstHostIntegrationFlow } from "../../hosts/integration-kit/lib/first-host-integration.ts";

describe("first host integration flow", () => {
  let result: Awaited<ReturnType<typeof runFirstHostIntegrationFlow>>;

  beforeAll(async () => {
    const directiveRoot = path.resolve(
      os.tmpdir(),
      `directive-kernel-first-integration-${Date.now()}`,
      "directive-root",
    );
    result = await runFirstHostIntegrationFlow({
      directiveRoot,
      goal: { /* same as today */ },
      source: { /* same as today */ },
    });
  });

  it("resolves the goal", () => expect(result.goalResolution.ok).toBe(true));
  it("returns the candidate id", () => expect(result.request.candidate_id).toBe("first-integration-check-source"));
  // ...one `it` per existing assertion
});
```

**Hardening suite** (`tests/integration/hardening/*.test.ts`):

Each helper module under `scripts/hardening/` becomes its own test file. The helper functions (`runDirectiveEngineHardeningChecks`, `runFilesystemStoreCachingChecks`, etc.) are imported and invoked inside `it(...)` blocks. Where a helper currently throws on failure (so the bespoke script's `await` chain catches and reports), it stays the same; Vitest treats the thrown error as a test failure with a clean stack trace.

If a helper function bundles multiple assertions, the migration may split it into multiple `it(...)` blocks for granularity, but only when the split is mechanical. Helpers that are tightly coupled stay as one `it(...)` invoking the original function.

Both integration suite groups run the same temp-directory pattern as the originals; nothing about persistence semantics changes.

### CI workflow

`.github/workflows/ci.yml`:

```yaml
name: ci

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          # version is read from package.json packageManager field
          run_install: false
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck
      - run: pnpm run test
```

Notes:
- `pnpm/action-setup@v4` reads the `packageManager` field from `package.json`, so the pnpm version stays in sync with the repo declaration (currently `pnpm@10.32.1`).
- Node 22 matches the kernel's runtime expectations (`--experimental-strip-types` flag predates Node 22.6 stabilization but works across recent LTS).
- `pnpm install --frozen-lockfile` enforces lockfile integrity; if the lockfile drifts, CI fails fast.
- The two steps (`typecheck`, `test`) run sequentially; either failing fails the job.

## Data Models

This feature does not introduce new domain data models. The arbitrary builders under `tests/property/_arbitraries/` are test-local types that mirror existing engine types (`DirectiveEngineSourceItem`, ledger entry shapes, approval state shapes) but are not exported.

## Error Handling

- **Vitest harness errors** (config typo, missing file): surfaced by Vitest's reporter; exit code is non-zero. No special handling needed.
- **fast-check counterexamples**: fast-check shrinks failing inputs and reports the minimal counterexample. Tests stay terse; the library does the work.
- **Integration suite filesystem errors**: tests use unique `os.tmpdir()` paths per run (timestamp suffix), matching the existing scripts. Cleanup is best-effort; we do not delete temp directories on failure so they remain available for forensics. CI runners discard the workspace on completion.
- **CI flakes**: the test pool runs each file in a forked process and tests do not share state. If a flake appears, it points at a real shared-state bug worth tracking, not at the harness.

## Migration / Compatibility

- The two existing `check:*` scripts at `scripts/check-first-integration.ts` and `scripts/check-system-hardening.ts` are kept for one cycle. Their bodies are replaced with a 4-line shim that prints "deprecated; running via Vitest" and exits zero (the real work is done by the Vitest invocation in the npm script). They can be deleted in a follow-up spec.
- The helper modules under `scripts/hardening/` are not renamed or relocated. The Vitest tests import from those exact paths. A later cleanup may move them to `tests/integration/hardening/_helpers/` but that is out of scope for this spec.
- No public export changes.
- No schema changes.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Fingerprint determinism

For any source input record `x` accepted by `computeProcessFingerprint`, calling `computeProcessFingerprint(x)` twice in succession returns identical hash values.

**Validates: Requirements 3.2**

### Property 2: Fingerprint sensitivity to mutation

For any source input record `x` and any single-field mutation `m(x)` that changes a field the fingerprint considers semantically meaningful, `computeProcessFingerprint(x) !== computeProcessFingerprint(m(x))`.

**Validates: Requirements 3.3**

### Property 3: Decision-policy ledger append-only invariant

For any sequence of ledger entries `e₁, e₂, ..., eₙ` appended one at a time to an initially empty ledger, for every prefix length `k` (1 ≤ k ≤ n), the first `k` entries of the resulting ledger are identical to `e₁, ..., eₖ` in the order appended.

**Validates: Requirements 4.2**

### Property 4: Decision-policy suggestion compilation determinism

For any ledger contents `L`, calling the suggestion compiler twice on `L` produces deeply equal suggestion outputs.

**Validates: Requirements 4.3**

### Property 5: Approval boundary classification consistency

For any pair `(state, expectedClassification)` where `expectedClassification ∈ { "allowed", "disallowed" }`, invoking the approval boundary guard on `state` succeeds if and only if `expectedClassification === "allowed"`. When `expectedClassification === "disallowed"`, the guard raises a defined rejection error.

**Validates: Requirements 5.2, 5.3**

### Property 6: Source-input normalization idempotence

For any source input `x` accepted by the normalizer, `normalize(normalize(x))` is deeply equal to `normalize(x)`.

**Validates: Requirements 6.2**

## Testing Strategy

**Property tests** (Requirements 3, 4, 5, 6):
- Implemented in `tests/property/` using `fast-check`.
- Each property runs ≥100 generated examples via `{ numRuns: 100 }`.
- Each property test annotates its design property number in a comment.

**Unit tests** (Requirement 7):
- Implemented in `tests/unit/engine/directive-workspace-lanes.test.ts`.
- Cover the three lanes × four-or-five plan callbacks matrix with named scenarios.
- Branch coverage: `transformationSignal > 0` and `=== 0` paths in `buildRuntimeProofPlan`.

**Integration tests** (Requirements 8, 9):
- Implemented in `tests/integration/`.
- Each existing assertion in the migrated scripts becomes an `it(...)` block.
- Run under the same `pnpm test` umbrella; no separate command.

**Smoke / configuration checks** (Requirements 1, 2, 10):
- Validated by the harness simply working: `pnpm test` exits zero, the directories exist, the CI workflow runs. No dedicated assertion code.
