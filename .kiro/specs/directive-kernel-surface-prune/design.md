# Design Document

## Overview

Two coordinated mechanical merges, each landed as a separate change set. The pattern is identical to the v9-cut Section A renames: enumerate file moves in an audit deliverable, apply them via `smartRelocate` so importers update automatically, then update the corresponding `package.json` `exports` map keys, then re-run the verification gate.

The work is judgment-light: the audit phase establishes which files belong together based on their on-disk read/write footprint, and the execution phase is mechanical relocation. The audit must be done by Claude (or equivalent) once and committed before any moves begin, so the execution phase has zero ambiguity.

## Architecture

```
   Audit phase (Claude / Codex):
       walk Engine_Surface and Runtime_Lib_Surface
       → Read_Write_Audit (CSV)
       → Boundary_Map (Markdown)
       → committed before any moves

   Execution phase (any agent):
       Sub_Cut_A: engine/coordination/ + engine/execution/ → engine/orchestration/
           - smartRelocate each file
           - update engine/index.ts
           - update package.json exports
           - update **Enforced by:** headers
           - delete now-empty source dirs
           - verify gate
       Sub_Cut_B: same pattern for runtime/lib/{openers,runners,sequences}/ → runtime/lib/operations/
```

## Components and Interfaces

### Audit script

`scripts/audit-engine-runtime-state.ts` — one-shot, not run in CI. Walks the two surfaces, ripgrep imports, classifies each file. Output: `docs/audits/engine-runtime-state-audit.csv` + the body of `docs/audits/engine-runtime-boundary-map.md`.

```ts
// pseudocode
for each file in walk('engine/') ∪ walk('runtime/lib/'):
  reads = []
  writes = []
  for each match in ripgrep(`(readFileSync|readJson|fs\.read)`, file):
    reads.push(extractPath(match))
  for each match in ripgrep(`(writeFileSync|writeJsonAtomic|appendJsonLine|fs\.write)`, file):
    writes.push(extractPath(match))
  callers = ripgrep(`from .*${relativePathFromRepoRoot(file)}`, '**/*.ts')
  proposed = decideDestination(file)  // see below
  disposition = decideDisposition(file)
  emit(row)

function decideDestination(file):
  if file is under engine/coordination/ or engine/execution/:
    return 'engine/orchestration/' + basename(file)
  if file is under runtime/lib/openers/, runtime/lib/runners/, runtime/lib/sequences/:
    return 'runtime/lib/operations/' + basename(file)
  return 'unchanged'
```

### Sub_Cut_A execution

```bash
# pseudocode for the move set
for f in engine/coordination/*.ts engine/execution/*.ts:
  smartRelocate $f engine/orchestration/$(basename $f)

# update engine/index.ts
sed -i 's|./coordination/|./orchestration/|g; s|./execution/|./orchestration/|g' engine/index.ts

# update package.json exports
# (manual: find every "./engine/coordination*" or "./engine/execution*" key, retarget)

# update contract headers (F5 enforcement)
for c in shared/contracts/*.md:
  sed -i 's|engine/coordination/|engine/orchestration/|g; s|engine/execution/|engine/orchestration/|g' $c
```

In practice, `smartRelocate` is invoked per-file via the tooling, not via shell. The header-rewrite pass uses a simple sed (or the equivalent file-edit tool) since the strings are unique.

### Collision handling

If `engine/coordination/foo.ts` and `engine/execution/foo.ts` both exist, the audit catches it. Resolution: rename one with a context-preserving prefix (e.g. `coordination-foo.ts` and `execution-foo.ts`), or merge their contents if they're related. Audit row records which approach is taken.

### `package.json` `exports` retargeting

Every key under `engine/coordination` or `engine/execution` becomes a key under `engine/orchestration`. Each key has 4 conditions to update (`development`, `types`, `import`, `default`).

```json
// before
"./engine/coordination": {
  "development": "./engine/coordination/index.ts",
  "types": "./dist/engine/coordination/index.d.ts",
  "import": "./dist/engine/coordination/index.js",
  "default": "./dist/engine/coordination/index.js"
},

// after — if both keys consolidated:
"./engine/orchestration": {
  "development": "./engine/orchestration/index.ts",
  "types": "./dist/engine/orchestration/index.d.ts",
  "import": "./dist/engine/orchestration/index.js",
  "default": "./dist/engine/orchestration/index.js"
}
// keep "./engine/coordination" and "./engine/execution" as deprecation aliases for one minor cycle if downstream consumers exist; remove on next major
```

## Data Models

No new data models. The merge does not change file content semantics.

## Correctness Properties

- **Property 1 — Import resolution preserved.** After Sub_Cut_A, every import statement in the kernel that previously resolved to a file under `engine/coordination/` or `engine/execution/` SHALL now resolve to a file under `engine/orchestration/`. Validated by `pnpm run typecheck` (any unresolved import fails compilation) and `pnpm run check:build` (post-build dist resolves).
- **Property 2 — Test suite invariant.** The full test suite SHALL pass with the same passed/skipped counts before and after each sub-cut. Validated by running `pnpm run test` pre- and post-cut.
- **Property 3 — Contract-header continuity.** After each sub-cut, `pnpm run check:contracts` SHALL pass with zero `missing-enforcer` violations. Validated by the F5 lint.

## Error Handling

- File basename collision: caught by the audit; resolved manually before execution.
- `smartRelocate` failure: usually means the destination directory doesn't exist yet; ensure `engine/orchestration/` and `runtime/lib/operations/` are created before any move.
- Contract header pointing at a path that no longer exists: caught by `check:contracts`; fix the header to the new path in the same change set.

## Testing Strategy

### Unit tests

None new. The relocation does not change semantics.

### Integration tests

The existing test suite is sufficient. Every test that imports from `engine/coordination/` or `engine/execution/` will be updated automatically by `smartRelocate`; if any test breaks, the merge is incorrect and must be fixed.

### Property tests

None new for this cut.

## Wave Plan

| Wave | Scope | Checkpoint |
|---|---|---|
| 1 | Audit script + Read_Write_Audit + Boundary_Map | typecheck + test (no code changes) |
| 2 | Sub_Cut_A: move + barrels + exports + contract headers | full gate green |
| 3 | Sub_Cut_B: same pattern for runtime/lib/ | full gate green |

## Open Questions

- Should we keep deprecation aliases in `package.json` `exports` for one minor cycle (i.e. `./engine/coordination` and `./engine/execution` keys remain as duplicates pointing at `engine/orchestration/`)? Default: no, because the kernel is pre-1.0 and a 0.2 → 0.3 minor bump can be a breaking change. Confirm during audit.
- Are there `runtime/lib/<other>/` folders that should also merge into `operations/`? Audit will tell. Anything that the audit classifies as `defer` stays where it is.
- Is `engine/planning/` separate from orchestration? Likely yes (plans are not the same as their execution). Audit confirms; if the audit shows `engine/planning/` is just one file that's really another orchestrator, fold it in too.
