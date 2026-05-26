import * as fs from "node:fs";
import * as path from "node:path";

export interface Violation {
  rule: string;
  file: string;
  detail: string;
}

// Rule 5: segments matching ^0\d- nested directly inside another segment also matching ^0\d-
const NUMBERED_SEGMENT_RE = /^0\d-/;
const NESTED_NUMBERED_SCOPE_DIRS = new Set([
  "architecture",
  "runtime",
  "discovery",
]);

export const DIRECTIVE_PREFIX_ALLOWLIST: ReadonlyArray<string> = [
  // engine/types.ts:DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION
  // Why: This constant gates Storage_Version_Check. Renaming it would
  // ripple through the migration framework during the v8→v9 cut.
  // Deferred to a follow-up cut. See Fix_Plan.md F4/F7/F11 outcome paragraphs.
  "engine/types.ts",
] as const;

// Rule 1: basename matches ^directive-
const DIRECTIVE_FILENAME_RE = /^directive-/;

// Rule 4: basename matches ^<prefix>-<prefix>-
const DOUBLE_PREFIX_RE = /^([a-z][a-z0-9]*)-\1-/i;

// Rule 3: exported type/interface/class/function/const named ^Directive[A-Z]
const DIRECTIVE_EXPORT_RE =
  /export\s+(type|interface|class|function|const)\s+(Directive[A-Z]\w*)/g;

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

export function scanForNamingViolations(
  files: Record<string, string>,
): Violation[] {
  const violations: Violation[] = [];

  for (const rawRel of Object.keys(files)) {
    const rel = normalizePath(rawRel);
    const source = files[rawRel];
    const basename = path.posix.basename(rel);
    const dirname = path.posix.dirname(rel);
    const parentFolder = path.posix.basename(dirname);

    // Rule 1: directive-prefix-filename
    if (DIRECTIVE_FILENAME_RE.test(basename)) {
      violations.push({
        rule: "directive-prefix-filename",
        file: rel,
        detail: `filename "${basename}" starts with "directive-"`,
      });
    }

    // Rule 2: folder-prefix-filename
    // Check every ancestor folder name — not just the immediate parent.
    // A file whose basename starts with any ancestor directory name + "-"
    // is a violation (the folder already provides the namespace).
    if (dirname && dirname !== ".") {
      const ancestorSegments = dirname.split("/");
      for (const ancestor of ancestorSegments) {
        if (!ancestor || ancestor === ".") continue;
        const ancestorPrefix = ancestor + "-";
        if (basename.startsWith(ancestorPrefix)) {
          violations.push({
            rule: "folder-prefix-filename",
            file: rel,
            detail: `filename "${basename}" repeats ancestor folder "${ancestor}" as prefix`,
          });
        }
      }
    }

    // Rule 3: directive-prefix-export
    if (source && /\.(ts|tsx)$/i.test(rel)) {
      if (!(DIRECTIVE_PREFIX_ALLOWLIST as ReadonlyArray<string>).includes(rel)) {
        let match: RegExpExecArray | null;
        DIRECTIVE_EXPORT_RE.lastIndex = 0;
        while ((match = DIRECTIVE_EXPORT_RE.exec(source)) !== null) {
          violations.push({
            rule: "directive-prefix-export",
            file: rel,
            detail: `exported name "${match[2]}" has "Directive" prefix`,
          });
        }
      }
    }

    // Rule 4: double-prefix-filename
    const doubleMatch = DOUBLE_PREFIX_RE.exec(basename);
    if (doubleMatch) {
      violations.push({
        rule: "double-prefix-filename",
        file: rel,
        detail: `filename "${basename}" has repeated prefix "${doubleMatch[1]}-${doubleMatch[1]}-"`,
      });
    }

    // Rule 5: nested-numbered-subfolder
    if (dirname && dirname !== ".") {
      const segments = dirname.split("/");
      const topScope = segments[0];
      if (NESTED_NUMBERED_SCOPE_DIRS.has(topScope)) {
        for (let i = 1; i < segments.length; i++) {
          const current = segments[i];
          const parent = segments[i - 1];
          if (
            NUMBERED_SEGMENT_RE.test(current) &&
            NUMBERED_SEGMENT_RE.test(parent)
          ) {
            violations.push({
              rule: "nested-numbered-subfolder",
              file: rel,
              detail: `numbered segment "${current}" is nested inside numbered segment "${parent}"`,
            });
          }
        }
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".kiro", "research-engine", "generated"]);

function walkDir(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(
        ...walkDir(path.join(dir, entry.name), baseDir),
      );
    } else {
      results.push(normalizePath(path.relative(baseDir, path.join(dir, entry.name))));
    }
  }
  return results;
}

function readFileSafe(absPath: string): string {
  try {
    return fs.readFileSync(absPath, "utf-8");
  } catch {
    return "";
  }
}

function scanRealTree(): Violation[] {
  const root = process.cwd();
  const scanDirs = [
    "discovery",
    "runtime",
    "architecture",
    "engine",
    "shared",
    "hosts",
    "scripts",
  ];

  const fileSet = new Set<string>();

  for (const dir of scanDirs) {
    const dirPath = path.join(root, dir);
    for (const rel of walkDir(dirPath, root)) {
      // Skip non-source files and research-engine
      if (rel.includes("research-engine/")) continue;
      if (/\.(js|d\.ts)$/.test(rel)) continue;
      fileSet.add(rel);
    }
  }

  // Explicit pass over shared/schemas/ to ensure all JSON Schema files are
  // included (they are already covered by the shared/ scan above, but we
  // double-check in case the scan root changes).
  const schemasDir = path.join(root, "shared", "schemas");
  for (const rel of walkDir(schemasDir, root)) {
    fileSet.add(rel);
  }

  const files: Record<string, string> = {};
  for (const rel of fileSet) {
    files[rel] = readFileSafe(path.join(root, rel));
  }

  return scanForNamingViolations(files);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function isMain(): boolean {
  const argv1 = process.argv[1] ?? "";
  return argv1.includes("check-naming");
}

if (isMain()) {
  const violations = scanRealTree();
  if (violations.length > 0) {
    for (const v of violations) {
      process.stderr.write(`${v.rule}: ${v.file}: ${v.detail}\n`);
    }
    process.exit(1);
  }
  process.exit(0);
}
