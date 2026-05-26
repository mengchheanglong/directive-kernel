# Design Document

## Overview

This design translates the eleven requirements in `requirements.md` into a concrete set of file changes that introduce a `tsc`-based JavaScript build for `@directive/kernel`. The goal is two execution paths from one source tree:

- **Dev path** — `tsx`, Vitest, and `pnpm dev` resolve `.ts` source files directly through the `development` exports condition. No build step is ever required for source-level iteration (R5, R10).
- **Prod path** — `pnpm run build` compiles every TypeScript source under the kernel into `/dist/` and copies the runtime data files that source code resolves through `import.meta.url`. Production scripts (`start`, `web:serve`, `standalone:cli`, `try`, `ui:start`, and the `frontend:*` aliases) execute compiled JavaScript from `/dist/` on stable Node, with no `--experimental-strip-types` flag (R1, R4, R6).

Type checking, tests, and the dev loop continue to read source through `tsconfig.repo.json`, which this feature does not modify (R2.10, R10).

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                            DEV PATH                                  │
│                                                                      │
│   pnpm dev / pnpm ui:dev / pnpm test / pnpm typecheck / pnpm try     │
│                                │                                     │
│                                ▼                                     │
│         ┌──────────────────────────────────────────┐                 │
│         │   tsx  +  Vite/Vitest                    │                 │
│         │   (honor user exports condition)         │                 │
│         └──────────────────────────────────────────┘                 │
│                                │                                     │
│                                ▼                                     │
│         exports condition: "development"                             │
│                                │                                     │
│                                ▼                                     │
│           reads:  ./engine/index.ts, ./hosts/...ts                   │
│                   (raw TypeScript source — no /dist/ needed)         │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                            PROD PATH                                 │
│                                                                      │
│                       pnpm run build                                 │
│                            │                                         │
│                            ▼                                         │
│       ┌────────────────────────────────────────────────┐             │
│       │  tsc -p tsconfig.build.json                    │  R6.1, R6.4 │
│       │    └─ noEmit:false, declaration, *.map         │  R1.2-1.4   │
│       │    └─ rewriteRelativeImportExtensions: true    │  R1.6, R2.6 │
│       │    └─ outDir: ./dist                           │  R2.2       │
│       └────────────────────────────────────────────────┘             │
│                            │                                         │
│                            ▼                                         │
│       ┌────────────────────────────────────────────────┐             │
│       │  scripts/copy-runtime-assets.mjs               │  R6.1, R6.5 │
│       │    └─ hosts/integration-kit/examples/*.json    │  R1.7, R6.3 │
│       │       → dist/hosts/integration-kit/examples/   │             │
│       └────────────────────────────────────────────────┘             │
│                            │                                         │
│                            ▼                                         │
│       /dist/  (.js, .d.ts, .d.ts.map, .js.map, *.json)               │
│                            │                                         │
│                            ▼                                         │
│       node dist/hosts/standalone-host/cli.js try         │  R4.1-4.5 │
│       node dist/hosts/web-host/cli.js serve ...          │  R4.1-4.5 │
│       node dist/hosts/web-host/server.js (via start-ui)  │  R4.1-4.5 │
│                            │                                         │
│                            ▼                                         │
│       exports condition: "import" / "default" → ./dist/...js         │
└──────────────────────────────────────────────────────────────────────┘
```

The two paths share the same source tree and the same `package.json` `exports` map. The condition the resolver matches first decides which path is taken: `tsx` and Vitest match `development` and read source; Node from a production script matches `import`/`default` and reads `/dist/`.

## Components and Interfaces

### Build Config — `tsconfig.build.json` (new)

A new file at the repo root, separate from `tsconfig.repo.json` (which stays untouched per R2.10). It extends the repo typecheck config so target/module/lib/strictness stay aligned and only overrides emit-related options.

```jsonc
{
  // Inherit target, module, moduleResolution, lib, types, strict, skipLibCheck,
  // verbatimModuleSyntax from the typecheck config so dev and build agree on
  // language semantics. (R2.10)
  "extends": "./tsconfig.repo.json",

  "compilerOptions": {
    // Switch from no-emit (typecheck mode) to emit mode. (R2.1)
    "noEmit": false,

    // Single repo-root output directory. Production scripts and the exports
    // map both target ./dist. (R2.2, R1.1)
    "outDir": "./dist",

    "rootDir": ".",

    // Emit type definitions and source maps for both .js and .d.ts so
    // consumers get types and stack traces resolve to source. (R2.3-R2.5,
    // R1.2-R1.4)
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // tsc rewrites `import "./foo.ts"` to `import "./foo.js"` in emitted JS,
    // letting source keep explicit .ts extensions for the dev path while
    // emitted JS resolves correctly under Node's ESM resolver. (R2.6, R1.6)
    "rewriteRelativeImportExtensions": true,

    // tsc forbids combining allowImportingTsExtensions:true with
    // rewriteRelativeImportExtensions in emit mode, so we explicitly disable
    // it here. The typecheck config keeps it at true; this setting is local
    // to the build and does not affect tsconfig.repo.json. (R2.7)
    "allowImportingTsExtensions": false,

    // verbatimModuleSyntax is inherited; combined with type-only imports
    // already in source, this prevents tsc from rewriting any import shape
    // beyond the .ts→.js extension swap.

    // No bundler-mode resolution at build time — emitted .js must run
    // directly under Node. Module resolution is inherited as "Bundler" from
    // the typecheck config; emit is unaffected because the kernel uses
    // explicit relative specifiers throughout.
    "isolatedModules": true
  },

  // Same source globs as tsconfig.repo.json minus tests/ and scripts/. The
  // dev orchestration scripts (run-ui-dev.ts, start-ui.ts) stay on tsx and
  // are not part of the published artifact. (R2.8, R1.5)
  "include": [
    "index.ts",
    "engine/**/*.ts",
    "discovery/**/*.ts",
    "runtime/**/*.ts",
    "architecture/**/*.ts",
    "hosts/**/*.ts",
    "shared/**/*.ts"
  ],

  // ui/** has its own build; node_modules and local/ are never input.
  // Tests and scripts are excluded explicitly in addition to being absent
  // from include, so a stray ts file under those trees never sneaks into
  // the artifact. (R2.9, R1.5)
  "exclude": [
    "ui/**",
    "node_modules/**",
    "local/**",
    "tests/**",
    "scripts/**",
    "dist/**"
  ]
}
```

`devDependencies."typescript"` is added at `^6.0.2` (R2.11). `tsc` is invoked through `pnpm exec tsc` so no global install is required.

### Exports Map Rewrite — `package.json`

Every entry of the existing `exports` map points at a single `./<path>.ts` string. Each entry is rewritten to a four-key conditional object with the keys ordered exactly as `development`, `types`, `import`, `default` (R3.1, R3.6).

**Before** (one representative entry):

```json
"./standalone-host/cli": "./hosts/standalone-host/cli.ts"
```

**After**:

```json
"./standalone-host/cli": {
  "development": "./hosts/standalone-host/cli.ts",
  "types": "./dist/hosts/standalone-host/cli.d.ts",
  "import": "./dist/hosts/standalone-host/cli.js",
  "default": "./dist/hosts/standalone-host/cli.js"
}
```

**Rule for every other entry** (R3.2-R3.7):

For an entry whose value before this feature is `./<path>.ts`, the rewritten value is the object:

| Key           | Value                       | Requirement |
| ------------- | --------------------------- | ----------- |
| `development` | `./<path>.ts` (verbatim)    | R3.2        |
| `types`       | `./dist/<path>.d.ts`        | R3.3        |
| `import`      | `./dist/<path>.js`          | R3.4        |
| `default`     | `./dist/<path>.js`          | R3.5        |

Key order is `development → types → import → default` so any resolver honoring the `development` condition matches it before the production keys (R3.6). The set of subpath keys (`.`, `./engine`, `./standalone-host`, …) is preserved verbatim — entries are neither added nor removed (R3.7). The root entry `"."` follows the same rule: `./index.ts` → object with `development: ./index.ts`, `types: ./dist/index.d.ts`, `import` and `default: ./dist/index.js`.

### Script Changes — `package.json`

Production scripts move from `node --experimental-strip-types ./<path>.ts` to `node ./dist/<path>.js`. Dev scripts move from `node --experimental-strip-types` to `tsx`. `build` and `prepublishOnly` are added.

| Script           | Before                                                                                                                                         | After                                                                                                                                  | Requirements         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `build`          | _(absent)_                                                                                                                                     | `tsc -p tsconfig.build.json && node ./scripts/copy-runtime-assets.mjs`                                                                 | R6.1, R6.4, R6.5     |
| `prepublishOnly` | _(absent)_                                                                                                                                     | `pnpm run build`                                                                                                                       | R11.1, R11.2, R11.3  |
| `dev`            | `node --experimental-strip-types ./scripts/run-ui-dev.ts`                                                                                      | `tsx ./scripts/run-ui-dev.ts`                                                                                                          | R5.1, R5.2, R5.3     |
| `ui:dev`         | `node --experimental-strip-types ./scripts/run-ui-dev.ts`                                                                                      | `tsx ./scripts/run-ui-dev.ts`                                                                                                          | R5.1, R5.2, R5.3     |
| `start`          | `pnpm --filter @directive/kernel-ui build && node --experimental-strip-types ./scripts/start-ui.ts`                                            | `pnpm run build && pnpm --filter @directive/kernel-ui build && node ./dist/hosts/web-host/cli.js serve --directive-root .`             | R4.1, R4.2, R4.5     |
| `ui:start`       | `node --experimental-strip-types ./scripts/start-ui.ts`                                                                                        | `node ./dist/hosts/web-host/cli.js serve --directive-root .`                                                                           | R4.1, R4.2, R4.5     |
| `web:serve`      | `node --experimental-strip-types ./hosts/web-host/cli.ts serve --directive-root .`                                                             | `node ./dist/hosts/web-host/cli.js serve --directive-root .`                                                                           | R4.1, R4.2, R4.3     |
| `standalone:cli` | `node --experimental-strip-types ./hosts/standalone-host/cli.ts`                                                                               | `node ./dist/hosts/standalone-host/cli.js`                                                                                             | R4.1, R4.2, R4.3     |
| `try`            | `node --experimental-strip-types ./hosts/standalone-host/cli.ts try`                                                                           | `node ./dist/hosts/standalone-host/cli.js try`                                                                                         | R4.1, R4.2, R4.3, R4.5 |
| `frontend:install` | `pnpm install`                                                                                                                               | `pnpm install`                                                                                                                         | R4.4 (alias preserved) |
| `frontend:build` | `pnpm --filter @directive/kernel-ui build`                                                                                                     | `pnpm --filter @directive/kernel-ui build`                                                                                             | R4.4 (alias preserved) |

Notes on script choices:

- **`start` keeps the UI build** because the published `start` flow needs the compiled UI bundle plus the kernel `/dist/`. Both build steps are explicit so failures are attributed clearly. `start` is the only Production_Script that internally runs `pnpm run build`; the others assume `dist/` already exists, matching R9.2.
- **`ui:start` no longer goes through `scripts/start-ui.ts`** because `scripts/` is excluded from the build (R1.5). The web-host CLI already exposes a `serve` subcommand; `ui:start` and `web:serve` therefore converge on `node ./dist/hosts/web-host/cli.js serve --directive-root .`. If the existing `start-ui.ts` orchestration logic must be preserved beyond what `web-host/cli.ts serve` already does, that logic moves into `hosts/web-host/cli.ts` so it lands in `/dist/`.
- **`dev` and `ui:dev`** stay on `scripts/run-ui-dev.ts` because the dev orchestration path is source-only (R5.2). `run-ui-dev.ts` itself spawns `node --experimental-strip-types ./scripts/start-ui.ts` for its child UI host process — that internal invocation is updated to `tsx ./scripts/start-ui.ts` so the dev path is uniformly source-driven and never reads `/dist/`.
- **`typecheck`, `test`, `test:watch`, `check:first-integration`, `check:hardening`, `ui:install`, `ui:build`, `frontend:install`, `frontend:build`** are unchanged.

### Runtime Data File Copy — `scripts/copy-runtime-assets.mjs` (new)

The build needs to copy the JSON example files under `hosts/integration-kit/examples/` into `dist/hosts/integration-kit/examples/` so source code that resolves them through `import.meta.url` keeps working from compiled output (R1.7, R6.1, R6.3).

We use a small Node script rather than a shell `cp` for two reasons:

1. **Cross-platform.** The repo is developed on Windows (PowerShell) and CI runs on Ubuntu. `cp -R` does not exist on Windows by default; `xcopy` is Windows-only. A Node script using `node:fs` works identically on both.
2. **Explicit failure surface.** R6.5 requires the build to exit non-zero if the copy step fails to copy any Runtime_Data_File. A Node script can list expected files explicitly and throw on any missing source, which a shell glob silently swallows.

The script is named `.mjs` (not `.ts`) so it runs under plain Node without `tsx` and without being part of the TypeScript build graph — it is the build, so it must not depend on the build.

**`scripts/copy-runtime-assets.mjs`:**

```javascript
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

// Whitelist the runtime data files the kernel resolves through
// `import.meta.url` at runtime. Adding a new example JSON requires adding it
// here so the build fails loudly rather than silently shipping a partial
// artifact. (R1.7, R6.5)
const RUNTIME_DATA_FILES = [
  "hosts/integration-kit/examples/discovery-submission-fast-path.json",
  "hosts/integration-kit/examples/discovery-submission-front-door.json",
  "hosts/integration-kit/examples/discovery-submission-queue-only.json",
  "hosts/integration-kit/examples/discovery-submission-split-case.json",
  "hosts/integration-kit/examples/first-consuming-host-goal-envelope.json",
  "hosts/integration-kit/examples/first-consuming-host-source.json",
  "hosts/integration-kit/examples/host-integration-acceptance-report.json",
];

async function copyOne(relativePath) {
  const source = path.join(REPO_ROOT, relativePath);
  const destination = path.join(REPO_ROOT, "dist", relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function main() {
  const failures = [];
  for (const relativePath of RUNTIME_DATA_FILES) {
    try {
      await copyOne(relativePath);
    } catch (error) {
      failures.push({ relativePath, error });
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      process.stderr.write(
        `copy-runtime-assets: failed to copy ${failure.relativePath}: ${
          failure.error instanceof Error ? failure.error.message : String(failure.error)
        }\n`,
      );
    }
    process.exit(1);
  }
}

void main();
```

The script is invoked as the second half of the `build` script (`tsc -p tsconfig.build.json && node ./scripts/copy-runtime-assets.mjs`). `&&` ensures `tsc` failures short-circuit before the copy, satisfying R6.4. Failures inside the copy step exit non-zero, satisfying R6.5.

### CI Workflow Change — `.github/workflows/ci.yml`

Insert `pnpm run build` between the install step and the typecheck step (R7.1, R7.3). The shell `&&` semantics of `run` lines and the default GitHub Actions step semantics handle R7.2 — a non-zero exit from the build step fails the job and skips later steps.

**Unified diff:**

```diff
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -19,6 +19,8 @@ jobs:

       - run: pnpm install --frozen-lockfile

+      - run: pnpm run build
+
       - run: pnpm run typecheck

       - run: pnpm run test
```

### Gitignore Change — `.gitignore`

Add a single line ignoring the repo-root `dist/` directory (R8.1). The existing `ui/dist/` rule is preserved (R8.2). The leading slash anchors the rule to repo root so nested `dist/` folders elsewhere are not affected.

Insert directly under the existing `ui/dist/` line:

```gitignore
ui/dist/
/dist/
```

### Vitest Exports Condition — `vitest.config.ts`

Vitest delegates module resolution to Vite, which reads `resolve.conditions` from the config. To force Vitest to match the `development` condition in the rewritten `exports` map and read `.ts` source (R10.2, R10.5, R5.4), add `resolve.conditions` to the existing config:

```typescript
export default defineConfig({
  plugins: [nodeSqliteExternalPlugin],
  test: {
    // ...unchanged...
  },
  resolve: {
    // Force Vite/Vitest to match the "development" exports condition we add
    // in package.json. Without this, Vite would pick "import" or "default"
    // and try to read paths under ./dist that do not exist in fresh
    // checkouts. (R10.5, R5.4)
    conditions: ["development", "import", "default"],
  },
});
```

`tsx` honors user conditions out of the box and matches `development` first because it appears first in the conditional object (R3.6); no `tsx` configuration is needed. The Vite dev server used by `pnpm dev` already runs in development mode, where Vite's default conditions include `development`; no change is required to the UI Vite config.

### README Change — `README.md`

Insert a new `## Build and Run` section between the existing `## Install` section and the `## Fastest Bootstrap` section. This satisfies R9.1, R9.2, R9.3 in one place and lives at the natural reading point for "how do I run this" questions.

Markdown block to insert:

```markdown
## Build and Run

The kernel has two execution paths.

**Source path (no build required).** These commands run directly against TypeScript source through `tsx` and Vite/Vitest. Use them while you are working in the repo. Do not run `pnpm run build` first.

- `pnpm dev` — Vite dev server plus the UI host, all from source
- `pnpm ui:dev` — alias of `pnpm dev`
- `pnpm typecheck` — type-check only, no emit
- `pnpm test` — Vitest run against source
- `pnpm try` — end-to-end smoke against a sample source

**Compiled path (requires `pnpm run build`).** These commands run from `/dist/` on stable Node, with no experimental flags. They expect `pnpm run build` to have produced `/dist/` first, except `pnpm start` which runs the build for you.

- `pnpm run build` — produces `/dist/` (compiled JS, type definitions, source maps, and the example JSON files the kernel resolves at runtime)
- `pnpm start` — builds and runs the UI host stack
- `pnpm ui:start` — runs the UI host stack from `/dist/`
- `pnpm web:serve` — runs the web host CLI from `/dist/`
- `pnpm standalone:cli` — runs the standalone host CLI from `/dist/`

`/dist/` is git-ignored and is regenerated by `pnpm run build`. CI runs the build before typecheck and test.
```

This block names the Dev_Scripts (R9.1), names the Production_Scripts and ties them to `pnpm run build` (R9.2), and explicitly does not instruct readers to run the build before `pnpm test`, `pnpm typecheck`, `pnpm dev`, or `pnpm try` (R9.3).

## Data Models

This feature does not introduce new runtime data models. The only structured data it touches is the `package.json` `exports` map shape (covered in **Exports Map Rewrite**) and the static list of runtime data files in `scripts/copy-runtime-assets.mjs` (covered in **Runtime Data File Copy**).

## Error Handling

| Failure mode                                               | Surface                                       | Behavior                                                                                                                  | Requirement |
| ---------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `tsc` reports a compile error                              | `pnpm run build`                              | Shell `&&` short-circuits; copy step does not run; exit code is non-zero.                                                 | R6.4        |
| Runtime data file missing or unreadable                    | `scripts/copy-runtime-assets.mjs`             | Script collects all failures, writes each to stderr, exits with code 1.                                                   | R6.5        |
| `pnpm run build` fails inside CI                           | GitHub Actions step                           | Step exits non-zero; subsequent steps (typecheck, test) are skipped; job fails.                                           | R7.2        |
| `pnpm run build` fails inside `prepublishOnly`             | `pnpm publish`                                | pnpm aborts publish before tarball creation; no tarball is produced.                                                      | R11.3       |
| Production script invoked before `pnpm run build` has run  | `node ./dist/...`                             | Node throws `ERR_MODULE_NOT_FOUND`; users are directed to run `pnpm run build` first by the README.                       | R9.2        |
| Vitest accidentally reads `/dist/` instead of source       | `pnpm test` in fresh checkout                 | `resolve.conditions: ["development", "import", "default"]` forces the `development` match; if `/dist/` is missing the test still passes because source is read. | R10.2, R10.5 |

## Out of Scope

The following are explicitly not part of this feature and the design does not address them:

- **Bundling** (Rollup, esbuild, Vite library mode) — `tsc` emits one `.js` per source file, not a bundle.
- **Minification** — emitted JS is unminified.
- **Tree-shaking** — no dead-code elimination beyond what Node's ESM loader does at import time.
- **CommonJS output** — the kernel is `"type": "module"` and the build emits ESM only. No `require`-compatible build is produced.
- **Browser builds** — `/dist/` targets Node. The UI workspace (`ui/`) keeps its own browser build via `pnpm --filter @directive/kernel-ui build`.
- **Source map upload** — `.js.map` and `.d.ts.map` files are emitted (R1.3, R1.4) but not uploaded to any error-tracking service.
- **Build-time benchmarks** — there is no measurement of, or budget for, `tsc` build duration.

## Correctness Pre-Work

Acceptance criteria classification is recorded via the `prework` tool. Most criteria for this feature classify as `SMOKE` because they describe configuration values, file existence, or one-shot pipeline behaviors with no input variation that would benefit from a property test (see the *When PBT Is NOT Appropriate* guidance: configuration validation, infrastructure setup, and one-shot operations).

Two clusters classify as bounded properties:

- **Exports map shape (R3.1-R3.7)** — bounded over the ~50 entries in the `exports` map. A schema check rather than randomized input.
- **Production script shape (R4.1, R4.2)** — bounded over the seven Production_Scripts.

The headline correctness statement, however, is the **post-build smoke property** the requirements call out at R4.5, R6.3, and R10.4: in a clean checkout, after `pnpm run build`, every Production_Script must run successfully against the same inputs that worked before this feature. This bundles together "build succeeded", "production scripts target `/dist/`", "runtime data files are where source expects", and "no experimental Node flag is needed". A single bounded property over the production scripts is the cheapest way to prove the build is healthy end-to-end.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Post-build smoke over Production_Scripts

*For any* script `s` in the bounded set `S = { try, web:serve --help, standalone:cli --help, start (build phase only) }`, after running `pnpm run build` in a clean checkout (no pre-existing `/dist/`), invoking `s` via Node from `/dist/` SHALL exit with status `0`.

The four scripts cover the cheapest possible health check for each production execution surface:

- `try` — exercises the standalone host end-to-end and proves R6.3 (the `try` entrypoint locates `dist/hosts/integration-kit/examples/discovery-submission-front-door.json`).
- `web:serve --help` — proves the web-host CLI imports cleanly from `/dist/` without starting a long-running server.
- `standalone:cli --help` — proves the standalone-host CLI imports cleanly from `/dist/` without invoking a subcommand.
- `start` build phase — runs `pnpm run build && pnpm --filter @directive/kernel-ui build` and stops before binding a port; proves the build composes with the UI build.

The assertion shape is exit code only. We deliberately do not assert on stdout content, timing, or process state — exit code is the cheapest signal that compiled JS, type-stripped runtime data, the exports map, and Node's ESM loader all agree.

**Validates: Requirements 4.5, 6.3, 10.4**
