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
| F2 | Compile to JS for production runs | P0 | M | |
| F3 | Build a 60-second hello world quickstart | P0 | S | ✅ done |
| F4 | Vocabulary diet + glossary | P0 | M | |
| F5 | Audit and prune `shared/contracts/` | P1 | M | |
| F6 | Resolve the three "runtime" surface confusion | P1 | S | |
| F7 | Freeze `DirectiveEngineRunRecord` schema + migration policy | P1 | M | |
| F8 | Decide UI direction: read-only vs operator workbench | P1 | M–L | |
| F9 | Surface-area prune in `engine/` and `runtime/lib/` | P2 | L | |
| F10 | Pick an audience and over-serve them | P2 | varies | |
| F11 | Prefix prune and file/type naming consistency | P1 | M | |
| F12 | Decide on the numbered folder convention (keep, simplify, drop) | P2 | S | |
| F13 | Concurrency / locking story for filesystem persistence | P1 | M | |
| F14 | Data retention and ledger rotation policy | P1 | M | |
| F15 | Security posture: threat model, SSRF protection, input sanitization | P0 | M | |
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

**Priority:** P0 · **Effort:** M

**Problem.** Every entry point uses `node --experimental-strip-types`. That flag is experimental, version-coupled, can be removed or changed in any Node release, and offers no diagnostics when it misbehaves. Shipping a kernel on an experimental runtime flag is not a production posture.

**Fix.**
1. Add a `tsc` build that emits ESM JS + `.d.ts` files into `dist/` for the kernel surfaces (`engine/`, `discovery/lib/`, `runtime/`, `architecture/lib/`, `shared/`, `hosts/`).
2. Update `package.json` `exports` to dual-publish: `import` → `./dist/...js`, `types` → `./dist/...d.ts`, with a `development` condition still pointing at `.ts` so contributors keep direct execution.
3. Update `start`, `web:serve`, and `standalone:cli` scripts to run from `dist/` in production. Keep `dev` running TypeScript directly via `tsx` (drop `--experimental-strip-types`).
4. Add `pnpm run build` to the root and wire it into CI.
5. Document the dev-vs-prod execution model in the README.

**Files.** New `tsconfig.build.json`, updated `package.json` (scripts + exports), updated `hosts/standalone-host/cli.ts` and `hosts/web-host/cli.ts` shebangs / docs.

**Risk.** Export-path drift. Mitigated by writing a small `scripts/check-exports.ts` that imports every public path from `dist/` and asserts it resolves.

---

## F3 — Build a 60-second hello world quickstart

**Priority:** P0 · **Effort:** S

**Problem.** The README's path from `init` to "I see a useful result" is a chapter, not a sentence. There is no hardcoded end-to-end path that proves the kernel works without writing config or JSON.

**Fix.**
1. Add a `kernel try` (or `standalone:cli try`) command that:
   - Creates a temp directive root.
   - Writes a minimal `DIRECTIVE_GOAL.md`.
   - Submits a hardcoded sample source (`hosts/integration-kit/examples/discovery-submission-front-door.json` already exists).
   - Runs the engine, prints the routing decision and run id, prints the path to the resulting artifact.
   - Optionally opens the web host on a free port.
2. Add a 5-line "Try it" block at the very top of the README.
3. Add a recorded terminal cast (`vhs` or asciinema) embedded in the README.

**Files.** New command in `hosts/standalone-host/cli.ts`, updated `README.md`, possibly new `docs/quickstart.md`.

**Risk.** Low. The command composes existing entry points.

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

**Priority:** P0 · **Effort:** M · **Depends on:** —

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
