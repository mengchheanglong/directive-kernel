# Directive Kernel — Fix Plan

> Plan for addressing **current problems** in the codebase as it stands today.
> Companion to `Improvement_Plan.md` (which covers net-new enhancements).
> Each item is scoped so it can be promoted to a Kiro spec when picked up for execution.

---

## How to read this plan

| Field | Meaning |
|-------|---------|
| **Priority** | P0 = blocks credibility, P1 = high pain, P2 = quality-of-life |
| **Effort** | S = ≤1 day, M = 2–5 days, L = 1–2 weeks, XL = 2+ weeks |
| **Risk** | What can break if done wrong |
| **Files** | Key paths the work touches |

Order in the table reflects recommended sequencing within each priority band.

---

## Priority summary

| # | Item | Priority | Effort | Status |
|---|------|----------|--------|--------|
| F1 | Wire up real test infrastructure | P0 | M | ✅ done |
| F2 | Compile to JS for production runs | P0 | M | ✅ done |
| F3 | Build a 60-second hello world quickstart | P0 | S | ✅ done |
| F4 | Vocabulary diet + glossary | P0 | M | ✅ done |
| F5 | Audit and prune `shared/contracts/` | P1 | M | |
| F6 | Resolve the three "runtime" surface confusion | P1 | S | |
| F7 | Freeze `DirectiveEngineRunRecord` schema + migration policy | P1 | M | ✅ done |
| F8 | Decide UI direction: read-only vs operator workbench | P1 | M–L | |
| F9 | Surface-area prune in `engine/` and `runtime/lib/` | P2 | L | |
| F10 | Pick an audience and over-serve them | P2 | varies | |
| F11 | Prefix prune and file/type naming consistency | P1 | M | ✅ done |
| F12 | Decide on the numbered folder convention (keep, simplify, drop) | P2 | S | |
| F13 | Concurrency / locking story for filesystem persistence | P1 | M | |
| F14 | Data retention and ledger rotation policy | P1 | M | |
| F15 | Security posture: threat model, SSRF protection, input sanitization | P0 | M | ✅ done |
| F16 | Schema ↔ example drift CI check | P2 | S | |

---

## F1 — Wire up real test infrastructure

**Status:** ✅ done · **Priority:** P0 · **Effort:** M

**Spec:** `.kiro/specs/directive-kernel-test-infrastructure/`

**Outcome.** Vitest 2.x harness with fast-check 3.x property tests. 46 tests across 10 files, ~3.3s wall clock. CI workflow at `.github/workflows/ci.yml` runs typecheck + test on push and PR; verified green on first push. The custom `check:first-integration` and `check:hardening` scripts now invoke Vitest while keeping their original npm script names; the original `scripts/check-*.ts` entry points kept for one cycle as deprecation shims.

**Coverage delivered.**
- 6 property tests (100 iterations each) covering process-fingerprint determinism + sensitivity, decision-policy-ledger append-only invariant + suggestion compiler determinism, approval-boundary classification consistency across all four guards, and source-input-normalization idempotence.
- 17 lane unit tests covering all three lanes × four plan callbacks, both `transformationSignal` branches on the runtime proof, the architecture `planIntegration` `nextAction` invariant, and `laneOverrides` propagation.
- 9 first-integration tests (one `it(...)` per original `assert.equal`) and 12 hardening tests (one `it(...)` per migrated helper).

**Side fixes during F1.**
- `tsconfig.repo.json` `include` now covers `tests/**/*.ts` so typecheck actually validates test files.
- `vitest.config.ts` ships a tiny resolver plugin that defers `node:sqlite` to `createRequire` (Vite 5 does not yet recognize that experimental Node builtin).

**Unblocks:** F2, F4, F7, F11, F13, F14.

**Original scope note (preserved for history).** ~~The kernel uses `node --experimental-strip-types` for direct TS execution today. Tests should run on the same model OR use Vitest's native TS support — pick whichever is cleaner.~~ → Chose Vitest's native TS support via Vite. The `--experimental-strip-types` flag is no longer needed by the test runner; production scripts still use it pending F2.

---

## F2 — Compile to JS for production runs

**Status:** ✅ done · **Priority:** P0 · **Effort:** M

**Spec:** `.kiro/specs/directive-kernel-js-build/`

**Outcome.** The kernel now ships a real `tsc`-based build emitting compiled ESM JavaScript, type definitions, and source maps to `/dist/`. Production scripts (`web:serve`, `standalone:cli`, `start`, `ui:start`) execute compiled JS on stable Node with no `--experimental-strip-types` flag. Dev tooling (Vitest, `tsx`, `pnpm dev`, `pnpm try`) continues to run against `.ts` source via the new `development` exports condition. CI gates on a real build, and a separate `pnpm run check:build` step asserts post-build smoke.

**Components delivered.**
- `tsconfig.build.json` extending `tsconfig.repo.json` with emit settings (`noEmit:false`, `outDir`, declarations, source maps, `rewriteRelativeImportExtensions:true`).
- `scripts/copy-runtime-assets.mjs` copies the seven JSON examples under `hosts/integration-kit/examples/` into `dist/` so source code that resolves them via `import.meta.url` keeps working post-build.
- `scripts/run-with-check-build.mjs` cross-platform helper that sets `CHECK_BUILD=1` and re-execs Vitest (no `cross-env` devDep).
- `package.json` `exports` rewritten — every entry now uses `{development, types, import, default}` with `development` first so dev tooling resolves source.
- `package.json` scripts updated: `build`, `prepublishOnly`, `check:build` added; `dev`/`ui:dev` use `tsx`; `web:serve`/`standalone:cli`/`start`/`ui:start` run from `/dist/`. `try` stays on `tsx` source so the F3 hello-world stays setup-free.
- `vitest.config.ts` adds `resolve.conditions: ["development", "import", "default"]` so Vitest matches the `development` condition.
- `.github/workflows/ci.yml` runs `install → build → typecheck → test → check:build`.
- `.gitignore` ignores `/dist/` at repo root (preserves existing `ui/dist/`).
- `README.md` adds a "Build and Run" section explaining the dev-vs-prod split.
- `tests/integration/build-smoke.test.ts` is the bounded property test for Post-Build Smoke (Property 1): exits 0 against compiled `try` and asserts the `standalone:cli` and `web-host` CLIs load from `/dist/` without `ERR_MODULE_NOT_FOUND`. Gated by `CHECK_BUILD=1` so `pnpm test` stays source-only.

**Side fixes during F2.**
- `hosts/web-host/cli.ts` was extended to be a superset of `scripts/start-ui.ts` before consolidation: optional `--directive-root` (defaults to cwd), env var fallbacks (`DIRECTIVE_UI_HOST`, `DIRECTIVE_FRONTEND_HOST`, `DIRECTIVE_UI_PORT`, `DIRECTIVE_FRONTEND_PORT`), SIGINT/SIGTERM graceful shutdown.
- `scripts/run-ui-dev.ts` switched its internal child-process invocation from `--experimental-strip-types` to `tsx`, so the dev path is uniformly source-driven.
- `tests/integration/try-command-cli.test.ts` (from F3) updated to spawn via `tsx` instead of `--experimental-strip-types`, removing the experimental flag from the test path.
- `pnpm try` originally rewritten to run from `/dist/` per the spec but reverted to `tsx ./hosts/standalone-host/cli.ts try` after smoke testing showed it broke the F3 promise of a setup-free hello-world. README "Try It" block stays correct as a result.

**Verification.**
- `pnpm install` → clean
- `pnpm run typecheck` → green (kernel + UI)
- `pnpm run test` → 12 files / 54 passed + 5 skipped (build-smoke deferred to check:build)
- `pnpm try` → green (no `/dist/` required)
- `pnpm run build` → green, dist/ produced with all expected emitted JS, declarations, source maps, and the 7 JSON examples
- `pnpm run check:build` → green (build-smoke property over compiled try, standalone:cli, web-host CLI)
- `git status` → `/dist/` is hidden

**Unblocks:** F4 (vocabulary), F11 (naming), F7 (schema freeze) can now bundle into a clean v8→v9 cut with tests + build gating in place.

---

## F3 — Build a 60-second hello world quickstart

**Status:** ✅ done · **Priority:** P0 · **Effort:** S

**Spec:** `.kiro/specs/directive-kernel-hello-world-quickstart/`

**Outcome.** `pnpm try` runs the kernel end-to-end against the canonical sample source in a fresh `os.tmpdir()` directive root and prints the routing decision, run id, and artifact path on six lines plus a next-step pointer. No config files, no JSON to write. README opens with a 10-line "Try It" block before "What This Repo Is For".

**Components delivered.**
- `hosts/standalone-host/try-command.ts` — exports `runStandaloneHostTryCommand` (in-process runner) and `formatTryCommandOutput` (printer). The runner reads the integration-kit's existing `discovery-submission-front-door.json` example, builds an inline goal envelope, seeds `discovery/capability-gaps.json` with the sample's gap id (because the intake-queue writer rejects unknown gap ids), and composes `runFirstHostIntegrationFlow`.
- `hosts/standalone-host/cli.ts` — new `try` subcommand wired into the dispatcher with `--output-root` flag and matching usage line.
- `package.json` — new `pnpm try` script (and the `try` subcommand also accessible via `standalone:cli try`).
- `README.md` — new "Try It" block at the top, 10 lines, with a TODO marker for the deferred terminal cast.
- `tests/integration/try-command.test.ts` — 6 in-process tests covering run id non-empty, DIRECTIVE_GOAL.md content, candidate id, lane id, artifact existence, and a bounded property test asserting artifact-path realness across default/existing/missing-nested override roots.
- `tests/integration/try-command-cli.test.ts` — 2 subprocess tests asserting plain-text output, regex shapes, no-JSON guarantee, and the `--output-root` missing-value error path.

**Side fix during F3.** Task 1's runner originally produced `capability_gap_id must reference an unresolved gap` because `runFirstHostIntegrationFlow` scaffolds an empty `capability-gaps.json`. The runner now seeds the gap before invoking the flow, exploiting the prepare step's `if (!fs.existsSync)` short-circuit. The sample source JSON stays canonical.

**Out of scope (deferred).**
- `--serve` flag to boot the web host inline. Print-and-exit is the current model; adding `--serve` later is additive.
- Recorded terminal cast. README has a `<!-- TODO -->` marker.

**Original scope note (preserved for history).** Task 5.2 (property test) and 5.3 (subprocess smoke) were spec'd as optional but executed as required because Requirement 7.5 explicitly mandates the subprocess case.

---

## F4 — Vocabulary diet + glossary

**Status:** ✅ done · **Priority:** P0 · **Effort:** M · **Shipped as:** part of the v8 → v9 cut bundle (with F7 + F11)

**Spec:** `.kiro/specs/directive-kernel-v9-cut/`

**Outcome.** The kernel ships a documented vocabulary in `GLOSSARY.md` at the repo root. Eight metaphor-heavy terms have been renamed to plain English across every kernel surface (TypeScript identifiers, JSON property keys, JSON Schema text, contracts, READMEs, root docs). The do-not-touch list (`mission`, `lane`, `discovery`, `runtime`, `architecture`, `kernel`, `directive root`) is documented and enforced. A new contributor opening the kernel for the first time no longer has to learn invented vocabulary before reading a contract or a code path.

**Components delivered.**
- `GLOSSARY.md` at the repo root with one-sentence definitions and canonical-source links for every term in the post-rename vocabulary.
- `GLOSSARY_CANDIDATES.md` — audit deliverable produced by Claude during the audit phase, lists all 8 canonical renames plus the do-not-touch and keep-as-is dispositions.
- 8 vocabulary renames applied repo-wide:
  - `earned autonomy` → `operator trust score` (`earnedAutonomy` → `operatorTrustScore`)
  - `gap radar` → `open gaps view` (`gapRadar` → `openGapsView`)
  - `narrative threading` → `source thread context` (`narrativeThreading` → `sourceThreadContext`)
  - `deep tail` → `materialization tail` (`deepTail` → `materializationTail`)
  - `legal next seams` → `allowed next steps` (`legalNextSeams` → `allowedNextSteps`)
  - `forbidden scope expansion` → `out of scope` (`forbiddenScopeExpansion` → `outOfScope`)
  - `bounded closeout` → `closeout` (`boundedCloseout` → `closeout`)
  - `integrity gate` → `integrity check` (`integrityGate` → `integrityCheck`)
- `tests/integration/vocabulary-sweep.test.ts` — CI-gated sweep that scans the repo for residual LHS matches outside the documented allowlist (`GLOSSARY_CANDIDATES.md`, `Fix_Plan.md` history, `shared/schemas/migrations/v8-to-v9.ts`).

**Side fixes during F4.**
- The vocabulary sweep test rejected one near-miss occurrence in a code comment that was not on the audit's call-site list; the audit was extended during execution to keep the sweep test green.
- Several lane README sentences had ambiguous tense after the rename (e.g. "the gap radar surfaces" → "the open gaps view surfaces"); reworded for grammar.

**Verification.**
- `pnpm run typecheck` → green (kernel + UI)
- `pnpm run test` → 88 passed / 5 skipped, 21 files, ~5s
- `pnpm run check:build` → green (post-build smoke over the four production scripts)
- `pnpm run check:naming` → green
- `pnpm try` → green (engine routes the sample source end-to-end)
- `tests/integration/vocabulary-sweep.test.ts` → green (zero LHS matches outside the allowlist)

**Unblocks:** F5 (the contracts pruning will be reviewed against the renamed vocabulary, not the old one), F8 (UI direction decisions reference the post-rename concept names).

---

## F7 — Freeze `DirectiveEngineRunRecord` schema + migration policy

**Status:** ✅ done · **Priority:** P1 · **Effort:** M · **Shipped as:** part of the v8 → v9 cut bundle (with F4 + F11)

**Spec:** `.kiro/specs/directive-kernel-v9-cut/`

**Outcome.** The run-record schema ships at version 9 with a written versioning policy at `shared/contracts/schema-versioning.md`. A minimal migration framework lives at `shared/schemas/migrations/` with one file per version bump. The engine store applies migrations in-flight on read so adopters with v8 records on disk continue to work; future-version records are rejected with a clear error. The `package.json` bumps from `0.1.x` to `0.2.0` to mark the schema break.

**Components delivered.**
- `shared/schemas/migrations/index.ts` — `Schema_Migration_Registry` keyed by source version. Adding a future migration is exactly two changes: drop in `v<v>-to-v<v+1>.ts`, add one entry to the registry. No plugin discovery, no CLI.
- `shared/schemas/migrations/v8-to-v9.ts` — first concrete migration. `migrate(record)` rewrites every Vocabulary_Rename_Set field, rewrites `$schema` URI in both relative and absolute forms, sets `schemaVersion: 9`. `rollback(record)` is bijective on the documented field set.
- `shared/schemas/run-record.schema.json` — v9 schema at `$id: https://directive-workspace.dev/schemas/run-record.schema.json`. Old `directive-engine-run-record.schema.json` deleted outright (no redirect per the documented hard-break rule).
- `engine/storage.ts` — new `readThroughVersionCheck` helper wired into `readRun` and `listRuns` for both `createFilesystemDirectiveEngineStore` and `createMemoryDirectiveEngineStore` (4 call sites). Three error families: `schema_version_unreadable:`, `schema_version_unmigratable:`, `schema_version_future:`. Never mutates the on-disk file.
- `shared/contracts/schema-versioning.md` — written policy: version-bump rule, migration requirement, forward+reverse property-test requirement, schema-URI hard-break rule, package-version bump rule, link to v8-to-v9 as the first concrete application.
- `tests/property/v8-to-v9-migration.property.test.ts` — Properties 1 + 2 (structural lossless + round-trip lossless on the lossless field set).
- `tests/property/storage-version-check.property.test.ts` — Properties 3 + 4 + 5 (pass-through, future-version reject, unmigratable reject).
- `tests/integration/hardening/schema-version-check.test.ts` — 12 hardening tests covering v7/v8/v9/v10 read paths × both stores × both read methods.
- `package.json` version flipped `0.1.0` → `0.2.0`.

**Side fixes during F7.**
- `engine/types.ts` widened the schema-version history-aware union from `8` to `8 | 9` so the migration framework's intermediate states typecheck cleanly.
- The schema-versioning policy document explicitly grandfathers `DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` as the one allowed `Directive`-prefixed identifier inside the kernel; renaming it would have rippled through the migration framework during the v8→v9 cut itself.

**Verification.**
- `pnpm run typecheck` → green
- `pnpm run test` → 88 passed including the 5 new property tests + 12 hardening tests
- `pnpm run check:build` → green
- v7 read fails with `schema_version_unmigratable: no migration registered for v7 → v8 (record at v7, target v9)`
- v8 read returns a v9 record with renamed fields and rewritten `$schema`; on-disk file unchanged (byte-comparison in the hardening test)
- v9 read returns the record unchanged on every field
- v10 read fails with `schema_version_future: record is v10, kernel supports up to v9`

**Unblocks:** F13 (concurrency/locking story can build on the documented schema-versioning policy and the existing storage-layer contract), F14 (data retention will reuse the migration framework's per-version-bump pattern).

---

## F11 — Prefix prune and file/type naming consistency

**Status:** ✅ done · **Priority:** P1 · **Effort:** M · **Shipped as:** part of the v8 → v9 cut bundle (with F4 + F7)

**Spec:** `.kiro/specs/directive-kernel-v9-cut/`

**Outcome.** The kernel no longer carries the `Directive` brand prefix on internal exports, redundant lane-name prefixes on file basenames, or the `directive-` filename prefix. Every Naming_Rename_Table row landed; ~376 `Directive`-prefixed exports were renamed across roughly 80 files; ~52 lane-prefix files were moved via `smartRelocate`. A CI lint at `scripts/check-naming.ts` enforces the four naming rules going forward.

**Components delivered.**
- 13 canonical Naming_Rename_Table renames from `requirements.md` Requirement 4:
  - 5 type renames (`DirectiveEngineSourceItem` → `EngineSourceItem`, etc.)
  - 2 function renames (`requireDirectiveExplicitApproval` → `requireExplicitApproval`, etc.)
  - 5 file moves (`discovery-front-door.ts` → `front-door.ts`, etc.)
  - 1 schema-file rename (`directive-engine-run-record.schema.json` → `run-record.schema.json`)
- Section B bulk-rename rules applied:
  - **B1**: ~376 `Directive`-prefixed exports renamed across the kernel (only the allowlisted `DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION` constant in `engine/types.ts` remains)
  - **B2**: ~52 files moved across `discovery/lib/`, `runtime/lib/`, `architecture/lib/`, plus barrel-file rewrites and importer updates
  - **B3**: 6 `directive-*.ts` files moved (the schema file is part of Section A row 13)
- `package.json` `exports` map retargeted in lockstep across all four conditions (`development`, `types`, `import`, `default`); subpath keys preserved.
- `DIRECTIVE_PREFIX_INVENTORY.md` — audit deliverable produced by Claude during the audit phase, lists Section A canonical 13 + Section B bulk rules + Section C allowlist seed.
- `CONTRIBUTING.md` — new naming-rules section with the four rules + the `pnpm run check:naming` invocation + cross-links to `GLOSSARY.md` and `shared/contracts/schema-versioning.md`.
- `scripts/check-naming.ts` — CI lint with four rules: `directive-prefix-filename`, `folder-prefix-filename` (walks every ancestor folder, not just the immediate parent), `directive-prefix-export`, `double-prefix-filename`. Exports `scanForNamingViolations` for unit testing; CLI entry walks the real file tree and exits non-zero on any violation.
- `tests/unit/check-naming.test.ts` — synthetic-fixture unit test asserting each of the 4 rules fires exactly once on its target.
- `.github/workflows/ci.yml` — new `check:naming` step inserted between `typecheck` and `test`.

**Side fixes during F11.**
- The original `check-naming.ts` Rule 2 was scoped too narrowly — it only flagged files starting with the immediate parent folder name, missing the much more common pattern of `runtime-*.ts` files inside `runtime/lib/openers/` (the lane name, not the immediate parent). Fixed in the eval feedback loop by walking every ancestor folder name in the path.
- The lint script's CLI initially scanned compiled `.js`/`.d.ts` files in the working tree, producing false positives. Added skips for `research-engine/`, `generated/`, `.js`, and `.d.ts` files.
- The `bounded-closeout.ts` / `closeout.ts` collision in `architecture/lib/experiments/` was resolved during execution: the larger 70KB implementation kept the canonical `closeout.ts` name, the smaller 6.8KB companion became `closeout-writer.ts` to preserve the separate concern.
- The `discovery/lib/front-door/discovery-front-door.ts` rename initially landed as a barrel `index.ts` re-exporting the original file (incorrect). Resolved during the eval feedback loop: the impl is now `front-door.ts`, the barrel `index.ts` re-exports it.
- The `runtime/core/generated/runtime-core-contract.d.ts` declaration file was left as-is per the lint's `.d.ts` skip rule — it regenerates from source.

**Verification.**
- `pnpm run typecheck` → green (kernel + UI clean across all 165 changed files + 52 file moves)
- `pnpm run test` → 88 passed
- `pnpm run check:build` → green (every `package.json` `exports` retarget resolves from `dist/`)
- `pnpm run check:naming` → green (zero violations across `discovery/`, `runtime/`, `architecture/`, `engine/`, `shared/`, `hosts/`, `scripts/`)
- `tests/unit/check-naming.test.ts` → green (each of 4 rules fires once on its synthetic-fixture target)
- Audit re-sweeps:
  - `^export ... Directive[A-Z]` declarations outside `engine/types.ts` → zero
  - `<lane>-*.ts` files inside `<lane>/` folders → zero (the one remaining is a generated `.d.ts` correctly excluded by the lint)
  - `^directive-*.ts` files → zero in source paths
  - `architecture-bounded-closeout.ts` → resolved into `closeout.ts` + `closeout-writer.ts`
  - `discovery-front-door.ts` → resolved into `front-door.ts` + `index.ts` barrel

**Unblocks:** F5 (the contracts review can rely on the lint to keep the post-rename naming stable), F8 (UI direction decisions get a clean public surface to design against), F9 (surface-area prune can build on the audited inventory rather than rediscovering it), F13 (concurrency story can reference the post-rename type names without disambiguation).

---

## F4 — Vocabulary diet + glossary (original spec, preserved for history)

**Priority:** P0 · **Effort:** M

**Problem.** A new contributor must learn ~25 domain terms before they can submit a source: lanes, missions, capability gaps, earned autonomy, gap radar, source memory, narrative threading, deep-tail stages, bounded closeout, materialization, post-consumption evaluation, integration mode, adoption target, usefulness levels, decision policy events, routing correction ledger, generation boundary note, transformation proof, promotion readiness, approval boundary, integrity gate, legal next seams, forbidden scope expansion, and more. Half can be renamed to plain English without losing meaning.

**Fix.**
1. Audit every term in `shared/contracts/`, `engine/types.ts`, and lane READMEs. Output a CSV: `term, current_meaning, proposed_replacement, status`.
2. For each term, choose: keep, rename to plain English, or remove (concept not actually used).
3. Suggested initial renames (open to discussion):
   - `earned autonomy` → `operator trust score`
   - `gap radar` → `open gaps view`
   - `narrative threading` → `source thread context`
   - `deep tail` → `materialization tail`
   - `legal next seams` → `allowed next steps`
   - `forbidden scope expansion` → `out of scope` (with a link to the rule)
   - `bounded closeout` → `closeout`
   - `integrity gate` → `integrity check` (less metaphor, same meaning)
4. Use `semanticRename` for code identifiers, plain rename + grep for markdown.
5. Publish `GLOSSARY.md` at the repo root listing every term with a one-sentence plain-English definition and a link to its canonical use.
6. Bump the schema version once for the field renames; document the migration.

**Files.** Most of `shared/contracts/`, `engine/types.ts`, `engine/routing/*`, lane READMEs, plus generated `GLOSSARY.md`.

**Risk.** Medium. Renames touch the public export surface. Sequence after F1 (so tests catch breakage) and F7 (so the schema bump is bundled).

---

## F5 — Audit and prune `shared/contracts/`

**Priority:** P1 · **Effort:** M

**Problem.** `shared/contracts/` holds ~50 markdown files. Either they're enforced (then most should be code or JSON Schema, not prose) or aspirational (then most should be deleted or moved). Markdown contracts that aren't checked anywhere drift fast. This is the kind of debt that quietly poisons trust in the rest of the project.

**Fix.**
1. For each contract, classify:
   - **Enforced** — there is code that references the contract's rules. Keep it but link the enforcing file.
   - **Schema-shaped** — the contract describes a data shape. Convert to JSON Schema in `shared/schemas/` and replace the markdown with a stub that links to the schema.
   - **Aspirational** — describes intent but is not checked. Move to `docs/contracts/` or delete.
2. Add a header to every kept contract: `Enforced by: <file path>` or `Status: aspirational, see <issue>`.
3. Add a `scripts/check-contracts.ts` that asserts every enforced contract is referenced from at least one operating-code file.
4. Target outcome: ~15–20 contracts in `shared/contracts/`, the rest moved or deleted.

**Files.** All of `shared/contracts/`, possibly new `docs/` tree, possibly new schemas in `shared/schemas/`.

**Risk.** Low if the move/delete is staged behind a deprecation note. The contracts are markdown so nothing imports them directly.

---

## F6 — Resolve the three "runtime" surface confusion

**Priority:** P1 · **Effort:** S

**Problem.** `runtime/lib/` (lifecycle code), `runtime/core/` (contract types), `runtime/capabilities/` (concrete callables), and `runtime/standalone-host/` (artifact directory used by the standalone host server, not a host) — plus `hosts/standalone-host/` (the actual host). The runtime/standalone-host vs hosts/standalone-host collision has burned someone already; it will burn more people.

**Fix.**
1. Rename `runtime/standalone-host/` → `runtime/host-artifacts/` (or `runtime/runtime-state/`). It is a state directory, name it like one.
2. Update all references (`hosts/standalone-host/server.ts`, `config.ts`, docs).
3. Add a one-paragraph "where things live" map to `runtime/README.md` distinguishing `lib/`, `core/`, `capabilities/`, `meta/`, and the artifact directory.
4. Consider folding `runtime/core/` into `runtime/lib/contracts/` so there's one operating-code root per lane. Lower priority; do only if it doesn't break consumers.

**Files.** `runtime/standalone-host/` rename, `hosts/standalone-host/config.ts` defaults, `hosts/standalone-host/server.ts` paths, `runtime/README.md`.

**Risk.** Low. The directory is gitignored content; the rename is mostly path-string updates.

---

## F7 — Freeze `DirectiveEngineRunRecord` schema + migration policy

**Priority:** P1 · **Effort:** M

**Problem.** Schema version 8 on a kernel without published consumers is a smell. Either the model is still being discovered (in which case stop calling it shippable) or migrations are happening without an explicit policy.

**Fix.**
1. Document the current schema version 8 as the **stable baseline** with a written contract: any breaking change requires a major version bump and a migration script.
2. Add `shared/schemas/migrations/` with one migration file per future version bump. Each file: `from`, `to`, `migrate(record)`, `rollback(record)?`.
3. Add a runtime check in the engine store: when reading a record, if its schema version is below current, run migrations in sequence; if above, refuse and surface a clear error.
4. Add property tests asserting forward-and-back migrations are lossless where possible, lossy with explicit reasons where not.
5. Bundle the F4 vocabulary renames into a single v8 → v9 migration so consumers cross one bump, not many.

**Files.** New `shared/schemas/migrations/`, updated `engine/storage.ts`, updated `shared/schemas/directive-engine-run-record.schema.json`.

**Risk.** Medium. Migrations need test coverage. F1 must land first.

---

## F8 — Decide UI direction: read-only or operator workbench

**Priority:** P1 · **Effort:** M (decision only) / L (full implementation)

**Problem.** The UI today is read-only. Every mutation requires the CLI or hand-crafted POST. For a system that pitches "make workflow visible," shipping a read-only operator view is half a product. Either commit to read-only and stop pretending it's an operator console, or finish the job.

**Fix — Decision step (M).**
1. Spec out the operator actions a real workbench needs: submit source, approve route, reroute with answers, write decision, formalize gap, mission edit, runtime opener, architecture handoff. The web-host already exposes the POST endpoints (`hosts/web-host/api-routes.ts`); the gap is purely UI.
2. Decide: ship the workbench, or rename the UI to "operator dashboard" and document that mutations live in CLI only.

**Fix — Workbench path (L).**
1. Add Lit form components for the 6–8 high-frequency mutations.
2. Wire to existing `page-actions.ts` POST helpers.
3. Add optimistic UI + error toasts.
4. Add a "what can I do here?" hint per artifact based on `legalNextSeams` (ties into Improvement Plan I6).

**Files.** `ui/src/renderers/`, `ui/src/page-actions.ts`, possibly new `ui/src/forms/`.

**Risk.** Medium. UI mutations against the existing API need careful approval-boundary respect; the F1 test infrastructure should cover the API path before the UI path lands.

---

## F9 — Surface-area prune in `engine/` and `runtime/lib/`

**Priority:** P2 · **Effort:** L

**Problem.** The "smallest but highest-leverage layer" has 7 grouped subfolders in `engine/` and 7 in `runtime/lib/`. Some of these are real boundaries (`routing/` vs `mission/`); some are organizational habit (`coordination/` and `execution/` overlap; `openers/` vs `runners/` vs `sequences/` is three names for "things that drive state forward").

**Fix.**
1. Map every file to: "what state does it read", "what state does it write", "who calls it". Output as a CSV.
2. For each grouped subfolder, ask: does this name describe a real boundary or just a folder of files we put together? Merge the second kind.
3. Likely consolidations to evaluate:
   - `engine/coordination/` + `engine/execution/` → `engine/orchestration/`
   - `runtime/lib/openers/` + `runtime/lib/runners/` + `runtime/lib/sequences/` → `runtime/lib/operations/`
4. Each merge is a separate spec/PR.

**Files.** Many. Use `smartRelocate` to preserve imports. F1 must land first so test breakage surfaces immediately.

**Risk.** High if rushed. Sequence late and stage carefully.

---

## F10 — Pick an audience and over-serve them

**Priority:** P2 · **Effort:** varies

**Problem.** Literature-access capability + research-engine sub-package + Scientify lineage suggests this came from a research/literature curation context. The generalization to "any workflow kernel" feels premature. Solo devs won't tolerate the ceremony; large teams want roles, audit, persistence guarantees the kernel doesn't ship.

**Fix.**
1. Pick one of:
   - **(a) Research curation kernel** — embrace the lineage. Ship 5–10 capabilities, lean into source-pack vocabulary, position against Zotero/Obsidian/Readwise as a pipeline backbone.
   - **(b) General workflow kernel** — prove it. Add 2 non-research example consumers (e.g. customer feedback triage, security advisory triage). Drop research-only language from the core docs.
2. Document the pick in `README.md` "What This Repo Is For" with a single named audience and one example use case.
3. Trim or relocate features that don't serve the picked audience.

**Files.** `README.md`, possibly new `examples/` consumers, possibly `runtime/capabilities/` additions.

**Risk.** Strategic, not technical. Worth doing before more code is added.

---

## F11 — Prefix prune and file/type naming consistency

**Priority:** P1 · **Effort:** M · **Depends on:** F1 (tests must catch breakage)

**Problem.** Naming hangover from earlier eras of the project shows up in three places, all of them paper-cuts that compound:

1. **`Directive` / `directive-` prefix noise.** Inside a package called `@directive/kernel`, almost every type, function, file, and constant repeats the word: `DirectiveEngineSourceItem`, `DirectiveEngineMissionContext`, `DirectiveEngineCapabilityGap`, `DirectiveEngineLaneDefinition`, `DirectiveEngineRunRecord`, `requireDirectiveExplicitApproval`, `requireDirectiveIntegrityForOpening`, `directive-engine-run-record.schema.json`, `directive-workspace-lanes.ts`. The prefix is meaningful at the package boundary (when a consumer imports it) but inside the kernel it's pure noise that makes every line longer than it needs to be and crowds out the meaningful part of every name.

2. **Lane-name-as-file-prefix inside lane folders.** Files like `discovery-front-door-coverage.ts` live inside `discovery/lib/front-door/`. Inside that folder the `discovery-` and `front-door-` prefix is redundant. Same pattern in `runtime/lib/openers/runtime-follow-up-opener.ts` and across `architecture/lib/`. The architecture lib README already flagged this and asked future work to use the grouped folders, but the existing files weren't renamed.

3. **Inconsistent file naming across surfaces.** Some files use kebab-case-with-domain-prefix (`architecture-deep-tail-stage-map.ts`), some use kebab-case-without (`storage.ts`, `lane.ts`, `usefulness.ts`), some use kebab-case-with-double-prefix (`runtime-runtime-capability-boundary-promotion-readiness-opener.ts` — yes, "runtime" appears twice). Pick one rule, apply it everywhere.

**Fix.**

1. **Establish the rule.** Document in `CONTRIBUTING.md`:
   - Inside a folder, files do not repeat the folder's name.
   - Types and functions inside the kernel do not carry a `Directive` / `directive-` prefix. The prefix is added back only at the public export boundary if disambiguation is needed there.
   - Schema files in `shared/schemas/` keep the unprefixed shape name (`run-record.schema.json`, not `directive-engine-run-record.schema.json`).
   - Folder names stay lowercase-kebab, file names stay lowercase-kebab, types stay PascalCase, constants stay SCREAMING_SNAKE.
2. **Audit pass.** Use ripgrep to find every occurrence of `Directive`, `directive-`, the lane-as-prefix patterns, and the double-prefix offenders. Output a CSV: `current_name, proposed_name, file_count, callers`.
3. **Mechanical rename.** Use `semanticRename` for code identifiers (catches all callers), `smartRelocate` for files (preserves imports), grep + plain rename for markdown and JSON references.
4. **Bundle into the F4/F7 v8 → v9 schema cut.** Schema field renames, type renames, and file renames should hit consumers as a single major version bump, not three.
5. **Add a lint rule** in `scripts/check-naming.ts` (run in CI) that flags new violations of the rule above.

**Suggested first batch of renames** (open to discussion):

| Current | Proposed |
|---------|----------|
| `DirectiveEngineSourceItem` | `EngineSourceItem` (or just `SourceItem` inside `engine/`) |
| `DirectiveEngineMissionContext` | `MissionContext` |
| `DirectiveEngineCapabilityGap` | `CapabilityGap` |
| `DirectiveEngineLaneDefinition` | `LaneDefinition` |
| `DirectiveEngineRunRecord` | `RunRecord` |
| `requireDirectiveExplicitApproval` | `requireExplicitApproval` |
| `requireDirectiveIntegrityForOpening` | `requireIntegrityForOpening` |
| `discovery/lib/front-door/discovery-front-door.ts` | `discovery/lib/front-door/index.ts` (it's already the entry; let it be named like one) |
| `discovery/lib/front-door/discovery-front-door-coverage.ts` | `discovery/lib/front-door/coverage.ts` |
| `runtime/lib/openers/runtime-follow-up-opener.ts` | `runtime/lib/openers/follow-up.ts` |
| `runtime/lib/openers/runtime-runtime-capability-boundary-promotion-readiness-opener.ts` | `runtime/lib/openers/promotion-readiness.ts` |
| `architecture/lib/control/architecture-deep-tail-stage-map.ts` | `architecture/lib/control/deep-tail-stage-map.ts` (also rename per F4) |
| `shared/schemas/directive-engine-run-record.schema.json` | `shared/schemas/run-record.schema.json` |

**Files.** Hundreds touched, but nearly all by mechanical tools. The risk is concentrated in the public export surface, which is small (`package.json` exports + `STANDALONE_SURFACE.json`).

**Risk.** Medium. The renames are easy mechanically but consumers who pinned a path break. Mitigated by: (a) F1 tests in CI, (b) bundling with the v8 → v9 schema bump so consumers cross one boundary, (c) keeping a deprecation shim file for one minor version that re-exports old names.

---

## F12 — Decide on the numbered folder convention (keep, simplify, drop)

**Priority:** P2 · **Effort:** S (decision) / M (if simplifying)

**Problem.** Numbered folders (`01-intake/`, `02-triage/`, `04-materialization/04-implementation-targets/`, etc.) are everywhere in the artifact surfaces. The README correctly notes they are state, not code. But the convention itself is unexamined:

- The numbers imply a strict sequence, but several folders are siblings that don't have an order (e.g. `04-monitor/` vs `05-deferred-or-rejected/` are both terminal states).
- Nested numbering (`04-materialization/04-implementation-targets/`) makes the path unreadable.
- Filesystem listings sort by name, not by number, which is the only argument *for* the prefix — but that argument loses force the moment a UI or DB renders the data.
- New contributors and agents both have to learn the prefix scheme before they can find anything.

**Fix.** Pick one of three:

1. **Keep as-is.** Document the rule explicitly in `CONTRIBUTING.md`: "numbers indicate canonical ordering, sibling folders share a prefix when they share a stage." Stop adding numbers ad-hoc.
2. **Simplify.** Drop nested numbers (`04-materialization/04-implementation-targets/` → `04-materialization/implementation-targets/`). Keep the top-level numbers since the lifecycle is real there.
3. **Drop entirely.** Use plain names (`intake/`, `triage/`, `routing-log/`, `monitor/`, `deferred-or-rejected/`). The lifecycle ordering lives in `engine/state/` and the workspace truth constants — that's where it should live, not in folder names. Filesystem listing order doesn't matter when humans/agents read through the API anyway.

My recommendation: option 2. Top-level numbers are useful (they survive `ls` and a quick browse); nested numbers are noise.

**Files.** `hosts/standalone-host/bootstrap.ts` (the scaffold writer), the lane READMEs that document the folder layout, the .gitignore entries.

**Risk.** Low. The folders are gitignored content in consuming projects, and the bootstrap function builds them. Existing directive roots need a one-time migration script.

---

## F13 — Concurrency / locking story for filesystem persistence

**Priority:** P1 · **Effort:** M · **Depends on:** F1

**Problem.** Several files are written by multiple code paths against the same directive root: `engine/decision-policy-ledger.json` (every routing review appends), `discovery/intake-queue.json` (every submission writes), the case store under `engine/cases/`, and the run record store. `shared/lib/file-io.ts` provides `writeJsonAtomic` (write-temp-then-rename) but that protects against torn writes, not against lost updates when two writers race. There is no documented locking model, no documented ordering guarantee, and no test that exercises concurrent writers.

If two host processes hit the same directive root — or even one process with two requests in flight against the standalone host — the outcome is undefined.

**Fix.**
1. Document the current concurrency model honestly: "single-writer per directive root; multi-writer is unsupported; standalone host is single-process."
2. Add a process-level advisory lock at the directive root (`engine/.lock` with a PID and start timestamp). Refuse to start a second host against a locked root.
3. For append-only ledgers, switch from "read-modify-write whole file" to "append a single line atomically" using `appendJsonLine` (already exists in `shared/lib/file-io.ts`) and a tail-reader. This eliminates lost-update on the hot path.
4. For mutable JSON (intake queue, case store), use a per-file `.lock` file with a short TTL.
5. Property test: spawn N concurrent submissions against a single directive root, assert no records lost, no records duplicated, ledger ordering monotonic.
6. Document the multi-host story explicitly: it isn't supported now, and federation (Improvement Plan I12) is the path to it.

**Files.** `shared/lib/file-io.ts` (locking helpers), `engine/storage.ts`, `engine/decision-policy-ledger.ts`, `discovery/lib/intake/discovery-intake-queue-writer.ts`, `engine/cases/case-store.ts`, new tests.

**Risk.** Medium. Locking has subtle edge cases (stale locks from crashed processes). The PID-and-timestamp approach handles the common cases; document the recovery procedure.

---

## F14 — Data retention and ledger rotation policy

**Priority:** P1 · **Effort:** M · **Depends on:** F1, F13

**Problem.** `decision-policy-ledger.json` is append-only forever. The case store accumulates. Run records accumulate. There is no archival, no rotation, no retention policy. After a year of real use, every read scans more data than necessary, and `process-fingerprint.ts`'s "scan existing runs for matches" becomes O(n) over an unbounded n.

The kernel ships with no opinion on this, which means every consuming project has to invent one — badly.

**Fix.**
1. Document a retention policy in `shared/contracts/data-retention.md`:
   - Run records: retained indefinitely by default; consumer may set `maxAgeDays` to archive older records.
   - Decision policy ledger: rotate to `decision-policy-ledger.<yyyy-mm>.json` monthly. Suggestion compiler reads only the most recent N segments.
   - Case store: same rotation as run records.
   - Intake queue: bounded; entries that route to a downstream lane move out of the queue immediately, so it stays small by design (verify this is true in code; if not, fix it).
2. Add an archival writer that moves old records into `archive/<year>/<month>/` under the directive root.
3. Update readers to scan archive segments lazily only when explicit historical lookback is requested.
4. Add a `kernel maintenance archive` CLI command and a recommended cron pattern.
5. Add a metric (ties into Improvement Plan I10): "active record count," "archived record count," "ledger size on disk."

**Files.** New `shared/contracts/data-retention.md`, `engine/storage.ts` (segment-aware reader), `engine/decision-policy-ledger.ts` (rotation), new CLI command, telemetry instrumentation.

**Risk.** Medium. Segmented reads must preserve correctness for fingerprint dedup and routing-correction lookups. F1 tests cover this.

---

## F15 — Security posture: threat model, SSRF protection, input sanitization

**Status:** ✅ done · **Priority:** P0 · **Effort:** M · **Depends on:** —

**Spec:** `.kiro/specs/directive-kernel-security-posture/`

**Outcome.** The kernel now has a documented security policy, a shared SSRF
guard wired into every TypeScript literature-access fetch site, config-driven
offline mode, standalone-host API input sanitization, per-token POST rate
limiting under bearer auth, and a Vitest hardening gate covering the full F15
security surface.

**Components delivered.**
- `SECURITY.md` documents the threat model, in-scope/out-of-scope boundary,
  offline mode, secret-handling policy, reporting channel, and Python provider
  follow-ups.
- `shared/lib/ssrf-guard.ts` blocks non-HTTP(S) schemes, blocked IP ranges,
  poisoned DNS/literal IPs, optional allowlist mismatches, and offline mode.
- `shared/lib/text-sanitizer.ts` strips unsafe controls and enforces UTF-8 byte
  caps on API free-text fields.
- `hosts/standalone-host/rate-limiter.ts` provides an in-memory token bucket
  with a proved `requestsPerMinute + burst` sliding-window bound.
- Standalone host config/schema/bootstrap examples now expose
  `runtime.allowExternalFetches` and `rateLimit`.
- Standalone host protected POST routes now rate-limit in bearer mode and emit
  a boot warning when auth is disabled.
- Standalone host POST bodies now sanitize recognized free-text fields before
  existing handlers receive them.
- Literature-access tools (`arxiv-search`, `arxiv-download`,
  `openalex-search`, `unpaywall-download`) call the SSRF guard immediately
  before fetch and return `external_fetches_disabled` in offline mode.
- New property tests cover SSRF guard behavior, sanitizer behavior, and the
  rate limiter invariant.
- New hardening integration test covers blocked ranges, schemes, loopback
  handling, rate-limit 429, sanitizer behavior, offline executor failure,
  schema constraints, policy docs, README linkage, and secret-pattern audit.

**Verification.**
- `pnpm run typecheck` → green
- `pnpm run test` → 16 files / 69 passed + 5 skipped
- `pnpm run check:build` → green compiled-output smoke

**Problem.** The kernel's whole job is ingesting external sources, often by URL. The research-engine has live providers (GitHub, Tavily, Exa, Firecrawl, Unpaywall) that fetch arbitrary HTTP. The standalone host serves a bearer-auth-guarded API but there is no documented threat model, no SSRF protection, no input sanitization policy, no rate limiting, no documentation about what running the host actually exposes.

For a system pitched at "embed in another project," this is the gap that will get someone burned. P0 because it's a credibility floor.

**Fix.**
1. **Write `SECURITY.md`** at the repo root. Cover:
   - Threat model: what an attacker can do with a malicious source URL, a malicious goal envelope, a stolen bearer token, access to the directive root filesystem.
   - In-scope vs out-of-scope: what the kernel guarantees, what the host must guarantee.
   - Reporting channel.
2. **Add SSRF protection** to all source-fetching code paths. Block private IP ranges (RFC1918, link-local, loopback, IPv6 ULA), block file://, only allow http/https, optional allowlist of domains. Configurable in `standalone-host.config.json`.
3. **Add input sanitization** for: source titles, goal statements, mission descriptions. Length limits, control-character stripping, schema validation at every API boundary.
4. **Add rate limiting** to the standalone host's POST endpoints. Token bucket per bearer token; reject when exhausted.
5. **Add a `--no-network` mode** that disables every external fetch path. Useful for consuming projects that want to vet sources offline.
6. **Document secret handling.** API keys for research-engine providers must come from env vars or a secrets file outside the directive root. Bearer tokens must support env-var resolution (already partly done, document and audit).
7. **Add a hardening check** to `scripts/check-system-hardening.ts` that asserts the above is configured before allowing the host to start in non-dev mode.

**Files.** New `SECURITY.md`, `hosts/standalone-host/server.ts` (rate limiting + SSRF middleware), `discovery/research-engine/` (provider-side guards), `hosts/standalone-host/config.ts` (new fields), updated hardening check.

**Risk.** Low to land, high if not done. Adding guards rarely breaks correctness; the cost of *not* having them grows with adoption.

---

## F16 — Schema ↔ example drift CI check

**Priority:** P2 · **Effort:** S · **Depends on:** F1

**Problem.** `hosts/integration-kit/examples/*.json` and the example payloads written by `bootstrap.ts` will lie the moment a schema in `shared/schemas/` changes. There is currently no check that catches the drift.

**Fix.**
1. Add `scripts/check-example-schemas.ts`: walk every example JSON in `hosts/integration-kit/examples/`, `runtime/meta/`, `control/state/`, and the bootstrap output. For each, find its schema in `shared/schemas/` (by filename convention or an explicit `$schema` field) and validate.
2. Add to CI as a hard gate.
3. Add a `pnpm run check:examples` script.

**Files.** New script, CI config update, possibly minor schema additions.

**Risk.** None. Pure consistency check.

---

## Suggested execution order

1. **F1** (tests), **F3** (hello world), and **F15** (security posture) in parallel — F1 unblocks everything, F3 is small, F15 is P0 and independent.
2. **F2** (JS build) once tests are green.
3. **F6** (runtime rename), **F12** (numbered folder decision), and **F16** (example drift check) — small, free mental space.
4. **F4** (vocabulary) + **F11** (prefix/naming prune) + **F7** (schema freeze) bundled into one v8 → v9 cut. These three touch overlapping files and one bump is much cheaper than three.
5. **F13** (concurrency/locking) and **F14** (retention) in sequence — F13 first since rotation depends on safe writes.
6. **F5** (contracts audit) and **F8** (UI decision) in parallel.
7. **F9** (surface prune) and **F10** (audience pick) once the above are stable.

---

*Each F-item can become a Kiro spec on demand. Keep this file as the rolling list of known problems; remove items as they ship.*
