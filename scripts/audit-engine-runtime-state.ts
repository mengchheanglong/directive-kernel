import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = process.cwd();
const AUDIT_ROOT = path.join(REPO_ROOT, "docs", "audits");

// ── scan targets ────────────────────────────────────────────────────────────
const SCAN_ROOTS = ["engine", "runtime/lib"] as const;

// folders excluded from scan
const EXCLUDE_DIRS = new Set(["node_modules", "dist", ".git", ".kiro", "generated", "maintenance"]);

// basenames excluded from audit
const EXCLUDE_BASENAMES = new Set(["index.ts", "README.md"]);

// test / declaration files excluded
const EXCLUDE_EXT = /\.(test|d)\.ts$/;

// ── read/write function patterns ────────────────────────────────────────────
const READ_FNS = [
  "readFileSync",
  "readJson",
  "readJsonOptional",
  "readJsonSafe",
  "readUtf8",
  "readdirSync",
];

const WRITE_FNS = [
  "writeFileSync",
  "writeJsonAtomic",
  "writeJsonPretty",
  "writeJson",
  "appendJsonLine",
  "writeUtf8",
  "appendFileSync",
];

// Build regex: reads = `readFileSync|readJson|...|fs\.readFile`; writes = `writeFileSync|...|fs\.writeFile`
function buildFnRegex(fns: string[], extra: string[]): RegExp {
  const all = [...fns, ...extra].map((s) => s.replace(/\./g, "\\."));
  return new RegExp(`\\b(?:${all.join("|")})\\b`, "g");
}

const READ_RE = buildFnRegex(READ_FNS, ["fs\\.readFile"]);
const WRITE_RE = buildFnRegex(WRITE_FNS, ["fs\\.writeFile"]);

// Match a function call with its first string literal argument.
// Handles: fn(path), fn<Type>(path), fn(path, ...), obj.fn(path)
const STRING_ARG_RE = /(?:readFileSync|readJson(?:Optional|Safe)?|readUtf8|readdirSync|writeFileSync|writeJson(?:Atomic|Pretty)?|writeJson|appendJsonLine|writeUtf8|appendFileSync|fs\.(?:read|write)File)\s*(?:<[^>]*>)?\s*\(\s*(['"`])([^'"`]+)\1/g;

function extractStringArgs(fileContent: string): string[] {
  const args: string[] = [];
  STRING_ARG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = STRING_ARG_RE.exec(fileContent)) !== null) {
    const arg = match[2];
    // Skip arguments that are clearly not file paths (e.g. encoding strings)
    // Common non-path string arguments: "utf8", "utf-8", "utf16le", encoding specs
    if (/^(?:utf-?8|ascii|utf16le|ucs2?|latin1|binary|base64|hex|r\+|w\+?|a\+?|wx|ax)$/i.test(arg)) continue;
    // Skip single-char or format-like strings
    if (arg.length <= 2 && /^[a-zA-Z]$/.test(arg)) continue;
    args.push(arg);
  }
  return args;
}

// ── walk ────────────────────────────────────────────────────────────────────
interface AuditRow {
  file_path: string;
  reads: string;
  writes: string;
  callers: string;
  proposed_destination: string;
  disposition: string;
}

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
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      results.push(...walkDir(path.join(dir, entry.name), baseDir));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, path.join(dir, entry.name)).replace(/\\/g, "/");
      const basename = path.posix.basename(relPath);
      if (EXCLUDE_BASENAMES.has(basename)) continue;
      if (EXCLUDE_EXT.test(basename)) continue;
      if (!basename.endsWith(".ts")) continue;
      results.push(relPath);
    }
  }
  return results;
}

// ── callers ─────────────────────────────────────────────────────────────────
function findCallers(filePath: string): string {
  const basename = path.posix.basename(filePath, ".ts");
  // Escape dots in basename
  const escaped = basename.replace(/\./g, "\\.");
  try {
    const raw = execSync(
      `pnpm exec rg --files-with-matches "${escaped}" --glob "*.ts" --glob "!dist/**" --glob "!node_modules/**" --glob "!scripts/**" --glob "!tests/**"`,
      { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    ).trim();
    if (!raw) return "";
    const lines = raw.split("\n").filter(Boolean);
    // Deduplicate and limit to top 5
    const unique: string[] = [];
    for (const line of lines) {
      const normalized = line.replace(/\\/g, "/");
      if (!unique.includes(normalized)) {
        unique.push(normalized);
      }
      if (unique.length >= 5) break;
    }
    if (unique.length === 0) return "";
    if (unique.length < 5 && lines.length > unique.length) {
      return unique.join("; ") + ` +${lines.length - unique.length} more`;
    }
    if (unique.length === 5 && lines.length > 5) {
      return unique.join("; ") + ` +${lines.length - 5} more`;
    }
    return unique.join("; ");
  } catch {
    return "";
  }
}

// ── destination & disposition ────────────────────────────────────────────────
function getDestinationDisposition(filePath: string): { dest: string; disp: string } {
  const basename = path.posix.basename(filePath);
  const dirname = path.posix.dirname(filePath);

  // engine/coordination/ → engine/orchestration/<basename>
  if (dirname.startsWith("engine/coordination")) {
    // Preserve subdirectory structure relative to coordination
    const relToCoordination = path.posix.relative("engine/coordination", dirname);
    const destDir = relToCoordination ? `engine/orchestration/${relToCoordination}` : "engine/orchestration";
    return { dest: `${destDir}/${basename}`, disp: "move-to-orchestration" };
  }

  // engine/execution/ → engine/orchestration/<basename>
  if (dirname.startsWith("engine/execution")) {
    const relToExecution = path.posix.relative("engine/execution", dirname);
    const destDir = relToExecution ? `engine/orchestration/${relToExecution}` : "engine/orchestration";
    return { dest: `${destDir}/${basename}`, disp: "move-to-orchestration" };
  }

  // runtime/lib/openers/ → runtime/lib/operations/<basename>
  if (dirname.startsWith("runtime/lib/openers")) {
    const relToOpeners = path.posix.relative("runtime/lib/openers", dirname);
    const destDir = relToOpeners ? `runtime/lib/operations/${relToOpeners}` : "runtime/lib/operations";
    return { dest: `${destDir}/${basename}`, disp: "move-to-operations" };
  }

  // runtime/lib/runners/ → runtime/lib/operations/<basename>
  if (dirname.startsWith("runtime/lib/runners")) {
    const relToRunners = path.posix.relative("runtime/lib/runners", dirname);
    const destDir = relToRunners ? `runtime/lib/operations/${relToRunners}` : "runtime/lib/operations";
    return { dest: `${destDir}/${basename}`, disp: "move-to-operations" };
  }

  // runtime/lib/sequences/ → runtime/lib/operations/<basename>
  if (dirname.startsWith("runtime/lib/sequences")) {
    const relToSequences = path.posix.relative("runtime/lib/sequences", dirname);
    const destDir = relToSequences ? `runtime/lib/operations/${relToSequences}` : "runtime/lib/operations";
    return { dest: `${destDir}/${basename}`, disp: "move-to-operations" };
  }

  return { dest: "unchanged", disp: "keep" };
}

// ── collision detection ─────────────────────────────────────────────────────
function detectCollisions(rows: { dest: string; source: string }[]): Map<string, string[]> {
  const destToSources = new Map<string, string[]>();
  for (const row of rows) {
    if (row.dest === "unchanged") continue;
    const basename = path.posix.basename(row.dest);
    const existing = destToSources.get(basename);
    if (existing) {
      existing.push(row.source);
    } else {
      destToSources.set(basename, [row.source]);
    }
  }
  const collisions = new Map<string, string[]>();
  for (const [basename, sources] of destToSources) {
    if (sources.length > 1) {
      collisions.set(basename, sources);
    }
  }
  return collisions;
}

// ── main ────────────────────────────────────────────────────────────────────
function main(): void {
  const allFiles: string[] = [];

  for (const root of SCAN_ROOTS) {
    const rootPath = path.join(REPO_ROOT, root);
    const files = walkDir(rootPath, REPO_ROOT);
    allFiles.push(...files);
  }

  // Sort for deterministic output
  allFiles.sort();

  const intermediateRows: { file_path: string; reads: string; writes: string; callers: string; dest: string; disp: string; source: string }[] = [];

  for (const filePath of allFiles) {
    const absPath = path.join(REPO_ROOT, filePath);
    let content: string;
    try {
      content = fs.readFileSync(absPath, "utf8");
    } catch {
      content = "";
    }

    const readArgs = extractStringArgs(content);
    const writeArgs = extractStringArgs(content); // refine below

    // Re-extract with read/write separation
    const reads: string[] = [];
    const writes: string[] = [];

    // Better: find each function call and classify
    const lineRe = /(?:readFileSync|readJson(?:Optional|Safe)?|readUtf8|readdirSync|writeFileSync|writeJson(?:Atomic|Pretty)?|writeJson|appendJsonLine|writeUtf8|appendFileSync|fs\.(?:read|write)File)\s*(?:<[^>]*>)?\s*\(\s*(['"`])([^'"`]+)\1/g;
    lineRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = lineRe.exec(content)) !== null) {
      const full = match[0];
      const argVal = match[2];
      if (/^(?:utf-?8|ascii|utf16le|ucs2?|latin1|binary|base64|hex|r\+|w\+?|a\+?|wx|ax)$/i.test(argVal)) continue;
      if (argVal.length <= 2 && /^[a-zA-Z]$/.test(argVal)) continue;

      // Classify as read or write
      if (READ_RE.test(full)) {
        reads.push(argVal);
      } else if (WRITE_RE.test(full)) {
        writes.push(argVal);
      }
    }

    READ_RE.lastIndex = 0;
    WRITE_RE.lastIndex = 0;

    const calls = findCallers(filePath);
    const { dest, disp } = getDestinationDisposition(filePath);

    intermediateRows.push({
      file_path: filePath,
      reads: reads.join(","),
      writes: writes.join(","),
      callers: calls,
      dest,
      disp,
      source: filePath,
    });
  }

  // Detect collisions
  const collisions = detectCollisions(intermediateRows.map((r) => ({ dest: r.dest, source: r.source })));
  const collisionBasenames = new Set(collisions.keys());

  // Build final rows with collision resolution
  const outRows: AuditRow[] = [];
  for (const row of intermediateRows) {
    let { dest, disp } = row;
    if (dest !== "unchanged") {
      const destBasename = path.posix.basename(dest);
      if (collisionBasenames.has(destBasename)) {
        const sources = collisions.get(destBasename)!;
        // If there's a collision, mark as defer
        disp = "defer";
        const collidingSources = sources.filter((s) => s !== row.source);
        const collisionNote = collidingSources.length > 0
          ? ` [COLLISION: ${collidingSources.map((s) => path.posix.basename(s, ".ts")).join(", ")}]`
          : "";
        dest = `${dest}${collisionNote}`;
      }
    }
    outRows.push({
      file_path: row.file_path,
      reads: row.reads,
      writes: row.writes,
      callers: row.callers,
      proposed_destination: dest,
      disposition: disp,
    });
  }

  // Build CSV
  const header = "file_path,reads,writes,callers,proposed_destination,disposition";
  const csvLines = [header];
  for (const row of outRows) {
    const escaped = [
      row.file_path,
      `"${row.reads.replace(/"/g, '""')}"`,
      `"${row.writes.replace(/"/g, '""')}"`,
      `"${row.callers.replace(/"/g, '""')}"`,
      row.proposed_destination,
      row.disposition,
    ];
    csvLines.push(escaped.join(","));
  }

  fs.mkdirSync(AUDIT_ROOT, { recursive: true });
  const csvPath = path.join(AUDIT_ROOT, "engine-runtime-state-audit.csv");
  fs.writeFileSync(csvPath, csvLines.join("\n") + "\n", "utf8");

  // Summary
  const dispositionCounts: Record<string, number> = {};
  for (const row of outRows) {
    dispositionCounts[row.disposition] = (dispositionCounts[row.disposition] || 0) + 1;
  }

  console.log(`Wrote docs/audits/engine-runtime-state-audit.csv with ${outRows.length} rows`);
  console.log("Disposition counts:");
  for (const [d, c] of Object.entries(dispositionCounts).sort()) {
    console.log(`  ${d}: ${c}`);
  }
  if (collisions.size > 0) {
    console.log(`Collisions (${collisions.size}):`);
    for (const [basename, sources] of collisions) {
      console.log(`  ${basename}: ${sources.join(", ")}`);
    }
  }
}

main();
