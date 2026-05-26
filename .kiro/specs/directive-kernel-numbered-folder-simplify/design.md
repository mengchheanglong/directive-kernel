# Design Document

## Overview

The simplification is mechanical. The decision (option 2: simplify, drop nested numbers, keep top-level) was already taken in `Fix_Plan.md`. This design document records the exact set of paths that move, the order they move in to keep CI green between waves, and the property test that asserts the bootstrap scaffold matches the documented shape.

## Architecture

```
            audit pass  →  rename pass  →  lint extension  →  verify
            (rg sweep)     (mechanical)     (check-naming)     (gate)
```

Three stages, one wave each. No phase isolation needed — the surface area is ~10 path strings plus prose.

## Components and Interfaces

### Path_Audit module

`scripts/audit-nested-paths.ts` — one-shot audit script. Walks the kernel with ripgrep, collects every match for `architecture/04-materialization/0[4-9]-`, writes `nested-path-audit.csv`. Not run in CI; the CSV it produces is the input for the rename pass.

```ts
// scripts/audit-nested-paths.ts (sketch)
import { execSync } from "node:child_process";
import * as fs from "node:fs";

const PATTERN = "architecture/04-materialization/0[4-9]-[a-z]";
const EXCLUDE = ["discovery/research-engine/", "dist/", "node_modules/"];
const out: string[] = ["file_path,line_number,old_path,new_path"];
const raw = execSync(`rg --line-number --no-heading "${PATTERN}"`, { encoding: "utf8" });
for (const line of raw.split("\n").filter(Boolean)) {
  const [file, lineNo, ...rest] = line.split(":");
  if (EXCLUDE.some((e) => file.startsWith(e))) continue;
  // extract old path, derive new path by stripping nested number
  // ...
}
fs.writeFileSync("nested-path-audit.csv", out.join("\n") + "\n");
```

### Scaffold_Writer change

In `hosts/standalone-host/bootstrap.ts` the `ARCHITECTURE_SCAFFOLD_DIRS` constant is rewritten in place. Only the six lines under `04-materialization/` change.

```ts
// before
const ARCHITECTURE_SCAFFOLD_DIRS = [
  path.join("architecture", "01-experiments"),
  path.join("architecture", "02-adopted"),
  path.join("architecture", "03-deferred-or-rejected"),
  path.join("architecture", "04-materialization", "04-implementation-targets"),
  path.join("architecture", "04-materialization", "05-implementation-results"),
  path.join("architecture", "04-materialization", "06-retained"),
  path.join("architecture", "04-materialization", "07-integration-records"),
  path.join("architecture", "04-materialization", "08-consumption-records"),
  path.join("architecture", "04-materialization", "09-post-consumption-evaluations"),
] as const;

// after
const ARCHITECTURE_SCAFFOLD_DIRS = [
  path.join("architecture", "01-experiments"),
  path.join("architecture", "02-adopted"),
  path.join("architecture", "03-deferred-or-rejected"),
  path.join("architecture", "04-materialization", "implementation-targets"),
  path.join("architecture", "04-materialization", "implementation-results"),
  path.join("architecture", "04-materialization", "retained"),
  path.join("architecture", "04-materialization", "integration-records"),
  path.join("architecture", "04-materialization", "consumption-records"),
  path.join("architecture", "04-materialization", "post-consumption-evaluations"),
] as const;
```

### Path_Constant rewrite sites

The audit will reveal these in concrete count, but the known sites are:

- `architecture/lib/control/materialization-tail-stage-map.ts` — the stage-map literal contains all six relative paths
- `architecture/lib/materialization/implementation-target.ts` — `ARCHITECTURE_DEEP_TAIL_STAGE.implementation_target.relativeDir` (renamed in v9 cut, value still references the old path)
- `architecture/lib/materialization/due-check.ts` — walks `architecture/02-adopted` and constructs `architecture/04-materialization/04-implementation-targets/...` paths
- `architecture/lib/materialization/implementation-result.ts` — same pattern
- `engine/state/resolve-workspace-state.ts` — may resolve materialization-tail paths

Each of these needs the prefix substring rewritten.

### Naming_Lint extension

`scripts/check-naming.ts` already has Rule 2 (folder-prefix-filename). Add Rule 5: `nested-numbered-subfolder` — fail when a directory matching `^0\d-` exists directly inside a parent directory matching `^0\d-`.

```ts
// new rule in scripts/check-naming.ts
const NESTED_NUMBERED_PATTERN = /^0\d-/;
function checkNestedNumberedSubfolder(dirPath: string): NamingViolation[] {
  const segments = dirPath.split(path.sep);
  for (let i = 1; i < segments.length; i++) {
    if (NESTED_NUMBERED_PATTERN.test(segments[i]) && NESTED_NUMBERED_PATTERN.test(segments[i - 1])) {
      return [{ rule: "nested-numbered-subfolder", path: dirPath, parent: segments[i - 1], child: segments[i] }];
    }
  }
  return [];
}
```

## Data Models

No new data models. The rename does not change the on-disk artifact format, only the path the artifact is written under.

## Correctness Properties

- **Property 1 — Scaffold matches documented shape.** `tests/integration/scaffold-shape.test.ts` runs the standalone host's `init` command into an `os.tmpdir()` directory and asserts that the resulting directory tree exactly matches a frozen list of New_Materialization_Paths plus the unchanged top-level directories.
- **Property 2 — No nested-numbered subfolder regressions.** `tests/unit/check-naming.test.ts` is extended with one synthetic fixture `architecture/04-materialization/04-bad/` and asserts the new Rule 5 fires on exactly that fixture and nowhere else.

## Error Handling

- Rename pass collisions: not possible. The new paths share a top-level parent (`04-materialization/`) and have no name collisions.
- A consuming project's existing directive-root with old-shaped folders: out of scope. The scaffold writer only creates new directories; old directories continue to exist alongside until the consumer renames them.

## Testing Strategy

### Unit tests

- `tests/unit/check-naming.test.ts` extended with one synthetic fixture asserting Rule 5 fires correctly.

### Integration tests

- `tests/integration/scaffold-shape.test.ts` (new) — bootstrap a directive-root in a temp dir, assert the directory tree matches the frozen list.
- `tests/integration/try-command.test.ts` (existing) — must continue to pass; this confirms the F3 hello-world is not broken by the rename.

### Property tests

None for this cut. The shape assertion in `scaffold-shape.test.ts` is a single canonical comparison; property-based generation does not add coverage.

## Wave Plan

| Wave | Scope | Checkpoint |
|---|---|---|
| 1 | Audit script + Path_Audit CSV produced | typecheck + test (no code changes yet) |
| 2 | Scaffold_Writer + Path_Constant rewrites + lane README + repo doc + .gitignore + CONTRIBUTING.md | typecheck + test + check:build |
| 3 | check-naming.ts Rule 5 + unit test fixture + scaffold-shape.test.ts | typecheck + test + check:build + check:naming |

## Open Questions

None. The decision was already locked by `Fix_Plan.md`.
