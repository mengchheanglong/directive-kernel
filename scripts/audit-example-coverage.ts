import * as fs from "node:fs";
import * as path from "node:path";
import { resolveSchema } from "./check-example-schemas.js";

const REPO_ROOT = process.cwd();

const EXAMPLE_ROOTS: readonly string[] = [
  "hosts/integration-kit/examples",
  "hosts/standalone-host/examples",
  "runtime/meta",
  "tests/integration/fixtures",
];

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

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

function main(): void {
  const schemaDir = path.resolve(REPO_ROOT, "shared/schemas");
  const schemaFiles = fs.readdirSync(schemaDir)
    .filter((f) => f.endsWith(".schema.json"))
    .map((f) => `shared/schemas/${f}`)
    .sort();

  const exampleFiles: string[] = [];
  for (const root of EXAMPLE_ROOTS) {
    exampleFiles.push(...walkJson(root));
  }

  const schemaCounts = new Map<string, number>();
  for (const sf of schemaFiles) {
    schemaCounts.set(sf, 0);
  }

  for (const examplePath of exampleFiles) {
    const body = readJson(path.resolve(REPO_ROOT, examplePath));
    const resolved = resolveSchema(examplePath, body);
    if (resolved && schemaCounts.has(resolved)) {
      schemaCounts.set(resolved, (schemaCounts.get(resolved) ?? 0) + 1);
    }
  }

  const lines: string[] = ["schema_file,example_count"];
  for (const sf of schemaFiles) {
    lines.push(`${sf},${schemaCounts.get(sf) ?? 0}`);
  }

  fs.writeFileSync(path.resolve(REPO_ROOT, "schema-example-coverage.csv"), lines.join("\n") + "\n", "utf8");
  process.stdout.write(`audit-example-coverage: wrote ${schemaFiles.length} schema rows to schema-example-coverage.csv\n`);
  process.exit(0);
}

main();
