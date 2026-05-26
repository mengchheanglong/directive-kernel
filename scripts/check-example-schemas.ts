import * as fs from "node:fs";
import * as path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const REPO_ROOT = process.cwd();

const EXAMPLE_ROOTS: readonly string[] = process.env.EXAMPLE_ROOTS_OVERRIDE
  ? process.env.EXAMPLE_ROOTS_OVERRIDE.split(",").map((s) => s.trim()).filter(Boolean)
  : [
      "hosts/integration-kit/examples",
      "hosts/standalone-host/examples",
      "runtime/meta",
      "tests/integration/fixtures",
    ];

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
      const rel = path.relative(REPO_ROOT, path.join((entry as fs.Dirent & { parentPath?: string }).parentPath ?? abs, entry.name));
      out.push(rel.replaceAll(path.sep, "/"));
    }
  }
  return out;
}

export function resolveSchema(examplePath: string, body: unknown): string | null {
  if (typeof body === "object" && body !== null && "$schema" in body) {
    const v = (body as { $schema: unknown }).$schema;
    if (typeof v === "string" && v.startsWith("shared/schemas/")) {
      const candidate = path.resolve(REPO_ROOT, v);
      if (fs.existsSync(candidate)) return v;
    }
  }
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
  const schemaId = (schemaBody as Record<string, unknown>).$id as string | undefined;
  let validate = schemaId ? ajv.getSchema(schemaId) : undefined;
  if (!validate) {
    validate = ajv.compile(schemaBody as object);
  }
  const instanceBody = typeof body === "object" && body !== null
    ? (({ $schema: _, ...rest }) => rest)(body as Record<string, unknown> & { $schema?: unknown })
    : body;
  const ok = validate(instanceBody);
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

function isMain(): boolean {
  const argv1 = process.argv[1] ?? "";
  return argv1.includes("check-example-schemas");
}

if (isMain()) {
  main();
}
