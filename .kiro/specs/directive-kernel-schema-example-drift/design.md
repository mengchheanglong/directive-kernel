# Design Document

## Overview

A single TypeScript script (`scripts/check-example-schemas.ts`) plus an `ajv`/`ajv-formats` devDependency plus one `package.json` script entry plus one CI line. No new abstractions, no new state. The script's only job is to walk a known set of example roots, validate each one against its resolved schema, and exit non-zero on any failure.

## Architecture

```
        for example in walk(Example_Root):
            schema = resolve_schema(example)
            ajv.validate(schema, example) or fail
        exit 0 if all ok else 1
```

There is no caching, no incremental mode, no parallelism. The check runs in <1s on the current schema set; the simplest implementation is the right one.

## Components and Interfaces

### `scripts/check-example-schemas.ts`

```ts
import * as fs from "node:fs";
import * as path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const REPO_ROOT = process.cwd();

const EXAMPLE_ROOTS = [
  "hosts/integration-kit/examples",
  "hosts/standalone-host/examples",
  "runtime/meta",
  "tests/integration/fixtures",
] as const;

type DriftRow = {
  examplePath: string;
  schemaPath: string | null;
  errors: Array<{ kind: string; message: string; instancePath?: string }>;
};

function walkJson(root: string): string[] {
  const abs = path.resolve(REPO_ROOT, root);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      // recursive: true returns relative names, build full path manually
      const rel = path.relative(REPO_ROOT, path.join((entry as fs.Dirent & { parentPath?: string }).parentPath ?? abs, entry.name));
      out.push(rel.replaceAll(path.sep, "/"));
    }
  }
  return out;
}

function resolveSchema(examplePath: string, body: unknown): string | null {
  // Strategy 1: $schema field
  if (typeof body === "object" && body !== null && "$schema" in body) {
    const v = (body as { $schema: unknown }).$schema;
    if (typeof v === "string" && v.startsWith("shared/schemas/")) {
      const candidate = path.resolve(REPO_ROOT, v);
      if (fs.existsSync(candidate)) return v;
    }
  }
  // Strategy 2: filename convention
  const base = path.basename(examplePath).replace(/\.example\.json$/, "").replace(/\.json$/, "");
  const candidate = `shared/schemas/${base}.schema.json`;
  if (fs.existsSync(path.resolve(REPO_ROOT, candidate))) return candidate;
  return null;
}

function validateOne(ajv: Ajv2020, examplePath: string): DriftRow | null {
  let body: unknown;
  try {
    body = JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, examplePath), "utf8"));
  } catch (err) {
    return { examplePath, schemaPath: null, errors: [{ kind: "parse_error", message: String(err) }] };
  }
  const schemaPath = resolveSchema(examplePath, body);
  if (!schemaPath) {
    return { examplePath, schemaPath: null, errors: [{ kind: "no_schema_resolved", message: "no $schema field and no filename convention match" }] };
  }
  let schemaBody: unknown;
  try {
    schemaBody = JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, schemaPath), "utf8"));
  } catch (err) {
    return { examplePath, schemaPath, errors: [{ kind: "schema_parse_error", message: String(err) }] };
  }
  const validate = ajv.compile(schemaBody as object);
  const ok = validate(body);
  if (ok) return null;
  return {
    examplePath,
    schemaPath,
    errors: (validate.errors ?? []).map((e) => ({
      kind: "validation_error",
      message: e.message ?? "(no message)",
      instancePath: e.instancePath,
    })),
  };
}

function main(): void {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const drift: DriftRow[] = [];
  let exampleCount = 0;
  const schemasUsed = new Set<string>();

  for (const root of EXAMPLE_ROOTS) {
    for (const example of walkJson(root)) {
      exampleCount += 1;
      const result = validateOne(ajv, example);
      if (result) {
        drift.push(result);
      } else {
        // resolveSchema was already called inside validateOne, but for the summary
        // we redo a cheap pass.
        const body = JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, example), "utf8"));
        const sp = resolveSchema(example, body);
        if (sp) schemasUsed.add(sp);
      }
    }
  }

  if (drift.length === 0) {
    process.stdout.write(`check:examples ok — ${exampleCount} examples validated against ${schemasUsed.size} schemas\n`);
    process.exit(0);
  }

  process.stderr.write(`check:examples FAILED — ${drift.length} drift rows out of ${exampleCount} examples\n\n`);
  for (const row of drift) {
    process.stderr.write(`  ${row.examplePath}\n`);
    process.stderr.write(`    schema: ${row.schemaPath ?? "(unresolved)"}\n`);
    for (const err of row.errors) {
      process.stderr.write(`    - ${err.kind}: ${err.message}${err.instancePath ? ` (at ${err.instancePath})` : ""}\n`);
    }
    process.stderr.write("\n");
  }
  process.exit(1);
}

main();
```

### `package.json` change

Add to `scripts`:

```json
"check:examples": "tsx scripts/check-example-schemas.ts"
```

Add to `devDependencies` (exact pinned versions):

```json
"ajv": "8.17.1",
"ajv-formats": "3.0.1"
```

### `.github/workflows/ci.yml` change

Insert one line between `check:contracts` and `test`:

```yaml
      - run: pnpm run check:contracts
      - run: pnpm run check:examples
      - run: pnpm run test
```

### Coverage report (optional, Wave 3)

`scripts/audit-example-coverage.ts` (one-shot) writes `schema-example-coverage.csv` listing every Schema_File and the count of Example_Files pointing at it. Useful for finding schemas that have no example.

## Data Models

No new data models. The check operates over existing JSON.

## Correctness Properties

- **Property 1 — Resolver determinism.** `tests/unit/check-example-schemas.test.ts` asserts that `resolveSchema` returns the same result on repeated calls with the same input.
- **Property 2 — Drift detection.** `tests/integration/example-drift-detection.test.ts` (new) writes a corrupt example to a temp dir, points the script at that dir, asserts the script exits non-zero with the expected error kind in the Drift_Report.

## Error Handling

- Example with no schema → fail with `no_schema_resolved` (Requirement 1.3, 1.4).
- Schema referenced by `$schema` doesn't exist → fall back to filename convention; if both fail, emit `no_schema_resolved`.
- Example is not valid JSON → fail with `parse_error`.
- Schema is not valid JSON → fail with `schema_parse_error`.
- Schema fails AJV compilation (e.g. invalid keyword) → bubble up the AJV error message; this is a schema bug, not an example bug.

## Testing Strategy

### Unit tests

`tests/unit/check-example-schemas.test.ts` — one test per `resolveSchema` strategy (`$schema` field, filename convention, no match).

### Integration tests

`tests/integration/example-drift-detection.test.ts` — corrupts a copy of a known-good example in a temp dir, asserts the script exits non-zero with the expected drift row.

### Property tests

None for this cut. The validation behavior is determined by AJV; testing AJV is not the kernel's job.

## Wave Plan

| Wave | Scope | Checkpoint |
|---|---|---|
| 1 | Add `ajv` + `ajv-formats` devDeps with pinned versions; `pnpm install` | typecheck + test |
| 2 | Add `scripts/check-example-schemas.ts`; add `package.json` `check:examples` script | typecheck + test + manual `pnpm run check:examples` |
| 3 | Add `tests/unit/check-example-schemas.test.ts`; add `tests/integration/example-drift-detection.test.ts` | typecheck + test + check:build + check:examples |
| 4 | Wire into CI between `check:contracts` and `test` | full gate green |
| 5 | (Optional) audit-example-coverage.ts + commit `schema-example-coverage.csv` | gate stays green |

## Open Questions

- Should `runtime/meta/PROMOTION_PROFILES.json` and `IMPORT_SOURCE_POLICY.json` be schema-validated? Audit Wave 5 will determine if matching schemas exist; if they do not, those files are excluded.
