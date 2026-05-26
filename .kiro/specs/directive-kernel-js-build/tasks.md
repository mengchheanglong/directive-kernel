# Implementation Plan: Directive Kernel JS Build

## Overview

Land the `tsc`-based JavaScript build for `@directive/kernel` in safe incremental waves:

1. **Build infrastructure (epic 1).** Add the TypeScript devDep, the build config, the runtime-asset copy script, and the `build` npm script. End state: `pnpm run build` produces `/dist/` with `.js`, `.d.ts`, `.d.ts.map`, `.js.map`, and the seven JSON examples copied through.
2. **Repo housekeeping (epic 2).** Ignore `/dist/` in git so post-build working trees are clean.
3. **First post-build smoke (epic 3).** Prove the compiled `try` entrypoint runs end-to-end against the existing sample source.
4. **Wire exports + scripts (epic 4).** Rewrite the `exports` map to the four-key conditional shape, force Vitest onto the `development` condition, then update Production_Scripts to run from `/dist/`, Dev_Scripts to use `tsx`, and add `prepublishOnly`. Ordering matters: the `exports` map must land first so subsequent script changes are exercising the final resolver shape; package.json edits are sequenced one wave each to avoid file conflicts.
5. **CI (epic 5).** Insert `pnpm run build` between install and typecheck.
6. **Full smoke + bounded property (epic 6).** Manual sequence-through of every updated script, then add the post-build smoke property as a `pnpm run check:build` script gated by `CHECK_BUILD=1` so `pnpm test` stays fast and source-only (R10.2) while CI gets the build-gated assertion via a separate explicit step.
7. **Docs + close-out (epic 7).** Add the README "Build and Run" section, then mark Fix_Plan F2 done.

The post-build smoke (Property 1 in design.md) is intentionally **not** added to the default `pnpm test` run — gating tests on a multi-second `tsc` build would violate R10.2. Instead it lives behind `pnpm run check:build` (sets `CHECK_BUILD=1`, runs the dedicated test file via Vitest), which CI invokes as a separate step. `pnpm test` skips it because the test file early-returns when `process.env.CHECK_BUILD !== "1"`.

## Tasks

- [ ] 1. Build infrastructure
  - [ ] 1.1 Add `typescript@^6.0.2` to root `devDependencies`
    - Edit `package.json`: add `"typescript": "^6.0.2"` to `devDependencies`
    - Run `pnpm install` to update the lockfile
    - Verify `pnpm exec tsc --version` prints a `6.x` version
    - Done when: lockfile updated, `pnpm exec tsc --version` reports `Version 6.x.y`
    - _Requirements: R2.11_

  - [ ] 1.2 Add `tsconfig.build.json` per design
    - Create `tsconfig.build.json` at repo root with the exact shape in design.md (Build Config section): extends `./tsconfig.repo.json`, `noEmit:false`, `outDir:./dist`, `rootDir:.`, `declaration:true`, `declarationMap:true`, `sourceMap:true`, `rewriteRelativeImportExtensions:true`, `allowImportingTsExtensions:false`, `isolatedModules:true`
    - `include` mirrors `tsconfig.repo.json` minus `tests/**/*.ts` and `scripts/**/*.ts`
    - `exclude` lists `ui/**`, `node_modules/**`, `local/**`, `tests/**`, `scripts/**`, `dist/**`
    - Do NOT modify `tsconfig.repo.json`
    - Done when: file exists at repo root and matches design; `tsconfig.repo.json` is byte-identical to its current state
    - _Requirements: R2.1, R2.2, R2.3, R2.4, R2.5, R2.6, R2.7, R2.8, R2.9, R2.10_

  - [ ] 1.3 Add `scripts/copy-runtime-assets.mjs` per design
    - Create `scripts/copy-runtime-assets.mjs` exactly as specified in design.md (Runtime Data File Copy section)
    - File extension MUST be `.mjs` (not `.ts`) so it runs under plain Node without `tsx` and is not part of the build graph
    - Whitelists the seven JSON examples under `hosts/integration-kit/examples/`, copies each into `dist/hosts/integration-kit/examples/`, collects failures, exits non-zero on any failure
    - Smoke-run it once manually after `pnpm run build` is in place (covered in task 1.4)
    - Done when: file exists, lists all seven JSONs, exits 0 when sources exist, exits 1 with stderr listing missing files when one is renamed away (verify by temporarily renaming one source then restoring)
    - _Requirements: R1.7, R6.1, R6.5_

  - [ ] 1.4 Add `pnpm run build` script and verify dist shape
    - Edit `package.json`: add `"build": "tsc -p tsconfig.build.json && node ./scripts/copy-runtime-assets.mjs"` to `scripts`
    - Run `pnpm run build` from a clean state (delete `/dist/` first if present)
    - Inspect `/dist/` shape: every TypeScript source under `engine/`, `discovery/`, `runtime/`, `architecture/`, `hosts/`, `shared/`, plus root `index.ts` produces a `.js`, `.d.ts`, `.d.ts.map`, and `.js.map`; nothing under `tests/` or `scripts/` is emitted
    - Verify import rewriting: `grep -r "from \".*\\.ts\"" dist/` returns no matches; spot-check at least one emitted `.js` (e.g. `dist/hosts/standalone-host/cli.js`) and confirm relative imports use `.js`
    - Verify all seven runtime data files are copied into `dist/hosts/integration-kit/examples/`
    - Done when: `pnpm run build` exits 0, dist shape matches the five conditions above
    - _Requirements: R1.1, R1.2, R1.3, R1.4, R1.5, R1.6, R1.7, R6.1, R6.2, R6.4_

- [ ] 2. Repo housekeeping
  - [ ] 2.1 Add `/dist/` to root `.gitignore`
    - Edit `.gitignore`: insert `/dist/` directly under the existing `ui/dist/` line (preserves R8.2)
    - Verify `git status` reports no untracked entries inside `dist/` after `pnpm run build`
    - Done when: `.gitignore` contains both `ui/dist/` and `/dist/`; `git status` after a build shows a clean tree
    - _Requirements: R8.1, R8.2, R8.3_

- [ ] 3. First post-build smoke
  - [ ] 3.1 Smoke-verify the build output end-to-end
    - From a state where `pnpm run build` has produced `/dist/`, run `node ./dist/hosts/standalone-host/cli.js try`
    - Confirm the command exits 0, prints a routing decision and run id, and resolves `dist/hosts/integration-kit/examples/discovery-submission-front-door.json` (no "sample source not found" error)
    - This validates the runtime-asset copy step against the real `try` entrypoint code path
    - Done when: command exits 0 and prints the standard `try` output shape
    - _Requirements: R6.2, R6.3_

- [ ] 4. Wire exports map and scripts
  - [ ] 4.1 Rewrite `package.json` `exports` map to the four-key conditional shape
    - For every entry in `exports` whose value is a `./<path>.ts` string, replace with an object containing exactly the keys in this order: `development` (the original `./<path>.ts`), `types` (`./dist/<path>.d.ts`), `import` (`./dist/<path>.js`), `default` (`./dist/<path>.js`)
    - Confirm key order is `development → types → import → default` for every entry (R3.6)
    - Confirm the set of subpath keys is identical before/after (no entries added or removed) — diff against the current map
    - Smoke: `node -e "require('./package.json').exports['./standalone-host/cli'].development"` prints the source path; `.import` prints the dist path
    - Done when: every entry has the four keys in the exact order above; subpath set unchanged
    - _Requirements: R3.1, R3.2, R3.3, R3.4, R3.5, R3.6, R3.7_

  - [ ] 4.2 Update `vitest.config.ts` to add `resolve.conditions`
    - Edit `vitest.config.ts`: replace the existing empty `resolve: {}` block (or its placeholder comment) with `resolve: { conditions: ["development", "import", "default"] }`
    - Run `pnpm run test` and confirm all tests still pass — Vitest must resolve in-repo imports through the `development` condition (the `.ts` source)
    - Done when: `pnpm run test` exits 0; `resolve.conditions` is set on the Vitest config
    - _Requirements: R5.4, R10.2, R10.5_

  - [ ] 4.3 Update Production_Scripts to drop `--experimental-strip-types` and run from `/dist/`
    - Edit `package.json` scripts per the design table:
      - `start`: `pnpm run build && pnpm --filter @directive/kernel-ui build && node ./dist/hosts/web-host/cli.js serve --directive-root .`
      - `ui:start`: `node ./dist/hosts/web-host/cli.js serve --directive-root .`
      - `web:serve`: `node ./dist/hosts/web-host/cli.js serve --directive-root .`
      - `standalone:cli`: `node ./dist/hosts/standalone-host/cli.js`
      - `try`: `node ./dist/hosts/standalone-host/cli.js try`
    - Confirm `frontend:install` and `frontend:build` aliases still equal `pnpm install` and `pnpm --filter @directive/kernel-ui build` respectively (R4.4)
    - Confirm no Production_Script contains `--experimental-strip-types` (R4.2)
    - Done when: every Production_Script targets `./dist/...js` and the strip-types flag is gone
    - _Requirements: R4.1, R4.2, R4.3, R4.4, R4.5_

  - [ ] 4.4 Update Dev_Scripts to use `tsx` and rewire the internal start-ui spawn
    - Edit `package.json` scripts:
      - `dev`: `tsx ./scripts/run-ui-dev.ts`
      - `ui:dev`: `tsx ./scripts/run-ui-dev.ts`
    - Edit `scripts/run-ui-dev.ts`: replace the internal `spawn(process.execPath, ["--experimental-strip-types", "./scripts/start-ui.ts", ...])` call with a `tsx` invocation. Resolve the `tsx` binary the same way `VITE_BIN` is resolved (e.g. `path.join(DIRECTIVE_ROOT, "node_modules", "tsx", "dist", "cli.mjs")`), then `spawnChild(process.execPath, [TSX_BIN, "./scripts/start-ui.ts", ...])`. The `--experimental-strip-types` flag MUST disappear from this file. Verify the `tsx` cli path exists in node_modules before relying on it
    - From a clean checkout (delete `/dist/` first), run `pnpm dev` briefly, confirm the dev stack boots, Ctrl-C, confirm clean shutdown
    - Done when: both `dev` and `ui:dev` use `tsx`; `scripts/run-ui-dev.ts` no longer contains `--experimental-strip-types`; `pnpm dev` starts and shuts down cleanly without `/dist/`
    - _Requirements: R5.1, R5.2, R5.3, R5.4, R10.3_

  - [ ] 4.5 Add `prepublishOnly` script
    - Edit `package.json` scripts: add `"prepublishOnly": "pnpm run build"`
    - Smoke-verify by running `pnpm run prepublishOnly` directly — it should run the build and exit 0
    - Done when: `prepublishOnly` script exists and invokes the build
    - _Requirements: R11.1, R11.2, R11.3_

- [ ] 5. CI
  - [ ] 5.1 Insert `pnpm run build` into the CI workflow
    - Edit `.github/workflows/ci.yml`: add `- run: pnpm run build` as a step that comes after `pnpm install --frozen-lockfile` and before `pnpm run typecheck`
    - Preserve the existing `typecheck` and `test` steps in their current relative order (R7.3)
    - GitHub Actions handles step short-circuiting natively, so a non-zero build exit fails the job and skips later steps (R7.2 — verified by the runner's default behavior, no extra config needed)
    - Done when: ci.yml shows the four steps in order: install → build → typecheck → test
    - _Requirements: R7.1, R7.2, R7.3_

- [ ] 6. Full smoke and bounded property
  - [ ] 6.1 Manual smoke checkpoint — run all updated scripts in sequence
    - From a fresh clone (or after `git clean -fdx node_modules dist`), execute in order:
      1. `pnpm install`
      2. `pnpm run typecheck` (no build needed — confirms R10.1)
      3. `pnpm run test` (no build needed — confirms R10.2)
      4. `pnpm dev` for a few seconds, then Ctrl-C (no build needed — confirms R10.3)
      5. `pnpm try` (no build needed — runs against source via the dev resolver — confirms R10.4)
      6. `pnpm run build` (produces /dist/)
      7. `node ./dist/hosts/standalone-host/cli.js try` (post-build smoke — confirms R6.3)
      8. `node ./dist/hosts/web-host/cli.js serve --help` (or equivalent flag the CLI exposes — confirms web-host imports cleanly from /dist/)
      9. `git status` (confirms /dist/ is ignored — R8.3)
    - All nine steps must succeed
    - Done when: every step exits 0 (or, for `pnpm dev`, was cleanly Ctrl-C'd) and `git status` reports a clean tree
    - _Requirements: R10.1, R10.2, R10.3, R10.4, R6.3, R8.3, R4.5_

  - [ ] 6.2 Add `pnpm run check:build` script and the post-build smoke property test (Property 1)
    - Rationale: gating `pnpm test` on a multi-second `tsc` build would violate R10.2 (tests must work without a prior build). Instead, the property test lives in a dedicated file that early-returns unless `process.env.CHECK_BUILD === "1"`, and the `check:build` script sets that env var. CI invokes `pnpm run check:build` as a separate step after the existing build step in 5.1; developer-facing `pnpm test` stays source-only and fast.
    - Create `tests/integration/build-smoke.test.ts`:
      - At top of file: `if (process.env.CHECK_BUILD !== "1") { describe.skip(...); /* or return early */ }`
      - When enabled, import `spawnSync` from `node:child_process` and define a single bounded property test (fast-check, with `numRuns: 1` since the bounded set is fixed) that iterates over the four entries in `S = ["try", "web-serve-help", "standalone-cli-help", "start-build-phase"]` and asserts each returns exit 0 when invoked via `node ./dist/<...>` (or `pnpm run build` for the start-build-phase shape)
      - The test assumes `/dist/` already exists (it does — the script runs the build first). Do not call `pnpm run build` from inside the test file; that responsibility lives in the npm script
    - Edit `package.json` scripts: add `"check:build": "pnpm run build && cross-env CHECK_BUILD=1 vitest run tests/integration/build-smoke.test.ts"`. If `cross-env` is not desired as a new dep, use `CHECK_BUILD=1 vitest ...` and document that Windows callers should run via Git Bash or pwsh `$env:CHECK_BUILD="1"; ...` — pick whichever fits the repo's existing cross-platform pattern (the repo already uses Node scripts for cross-platform; preferred shape: a one-liner shell-agnostic invocation. If unsure, use `cross-env` since it is small and explicit, and add it to `devDependencies`)
    - Edit `.github/workflows/ci.yml`: add `- run: pnpm run check:build` as a step after `pnpm run test`. (The build step from 5.1 stays; `check:build` re-runs the build as part of the script but that's acceptable — a few seconds of duplicate build cost in CI is the price of an explicit, named property gate.)
    - Confirm `pnpm test` does NOT run the property test (because `CHECK_BUILD` is unset → file is skipped)
    - Confirm `pnpm run check:build` DOES run it and exits 0 in a working tree
    - Done when: test file exists with the env-gated skip, `check:build` script exists, CI workflow has the new step, `pnpm test` skips the property test, `pnpm run check:build` runs the property test and exits 0
    - _Requirements: R4.5, R6.3, R10.4 (Property 1 in design.md)_

- [ ] 7. Docs and close-out
  - [ ] 7.1 Add the README "Build and Run" section per design
    - Edit `README.md`: insert the markdown block from design.md (README Change section) between the existing `## Install` section and the `## Fastest Bootstrap` section
    - Block names every Dev_Script with "no build required" (R9.1), every Production_Script with "requires `pnpm run build` first, except `pnpm start`" (R9.2), and explicitly states `pnpm run build` is NOT a prerequisite for `pnpm test`, `pnpm typecheck`, `pnpm dev`, or `pnpm try` (R9.3)
    - Done when: README contains the section verbatim (or with minor wording tweaks that preserve the three constraints above)
    - _Requirements: R9.1, R9.2, R9.3_

  - [ ] 7.2 Final checkpoint — full suite green, build green, README updated, Fix_Plan F2 marked done
    - Re-run task 6.1's nine-step sequence one more time end-to-end to confirm nothing regressed during 6.2 and 7.1
    - Run `pnpm run check:build` and confirm it exits 0
    - Verify the CI workflow file shows: install → build → typecheck → test → check:build (in that order)
    - Edit `Fix_Plan.md`: change the F2 row in the priority summary table from blank to `✅ done`, and append a `**Status:** ✅ done` line under the F2 heading with a one-paragraph outcome summary mirroring the F1/F3 pattern (link to `.kiro/specs/directive-kernel-js-build/`, list the components delivered: `tsconfig.build.json`, `scripts/copy-runtime-assets.mjs`, rewritten `exports` map, updated scripts, CI insertion, `check:build` property gate, README "Build and Run" section)
    - Ask the user if questions arise.
    - Done when: full suite + build + check:build all green, README contains the new section, Fix_Plan.md F2 row marked `✅ done` with an outcome paragraph
    - _Requirements: closes F2 in Fix_Plan.md; cross-validates all 11 requirements_

## Notes

- Every task is required (no asterisks) because every requirement R1.1–R11.3 is mandatory per the spec.
- The 4.x sub-tasks are sequenced one-per-wave because they all touch `package.json`. Parallel waves only kick in for independent files (1.2, 1.3, 2.1).
- Property 1 (post-build smoke over Production_Scripts) is implemented as task 6.2 and gated behind `CHECK_BUILD=1` so `pnpm test` stays source-only and fast (R10.2). CI runs it as a separate explicit step so the property is always asserted on every push and PR.
- Each task references the specific sub-requirements it satisfies. Several requirements (notably R10.1–R10.4) are validated indirectly by task 6.1's sequenced run-through rather than by a single edit, which matches their cross-cutting nature.
- The `cross-env` dependency choice in 6.2 is a small judgment call — if the repo prefers no new devDeps, swap for a one-line Node helper script that sets `process.env.CHECK_BUILD = "1"` then re-execs Vitest. Either shape satisfies the requirement.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["4.1", "4.2"] },
    { "id": 5, "tasks": ["4.3"] },
    { "id": 6, "tasks": ["4.4"] },
    { "id": 7, "tasks": ["4.5", "5.1"] },
    { "id": 8, "tasks": ["6.1"] },
    { "id": 9, "tasks": ["6.2"] },
    { "id": 10, "tasks": ["7.1"] },
    { "id": 11, "tasks": ["7.2"] }
  ]
}
```
