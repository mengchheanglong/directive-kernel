import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = process.cwd();
const PATTERN = "architecture/04-materialization/0[4-9]-[a-z]";
const EXCLUDE_DIRS = ["discovery/research-engine/", "dist/", "node_modules/", ".kiro/", ".git/"];

const OLD_TO_NEW: Record<string, string> = {
  "architecture/04-materialization/04-implementation-targets": "architecture/04-materialization/implementation-targets",
  "architecture/04-materialization/05-implementation-results": "architecture/04-materialization/implementation-results",
  "architecture/04-materialization/06-retained": "architecture/04-materialization/retained",
  "architecture/04-materialization/07-integration-records": "architecture/04-materialization/integration-records",
  "architecture/04-materialization/08-consumption-records": "architecture/04-materialization/consumption-records",
  "architecture/04-materialization/09-post-consumption-evaluations": "architecture/04-materialization/post-consumption-evaluations",
};

function shouldExclude(filePath: string): boolean {
  return EXCLUDE_DIRS.some((d) => filePath.startsWith(d));
}

function main(): void {
  const out: string[] = ["file_path,line_number,old_path,new_path"];

  let raw: string;
  try {
    raw = execSync(`pnpm exec rg --line-number --no-heading "${PATTERN}"`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch {
    // rg exits non-zero on no matches or other errors
    raw = "";
  }

  for (const line of raw.split("\n").filter(Boolean)) {
    const colonIdx = line.indexOf(":");
    const secondColonIdx = line.indexOf(":", colonIdx + 1);
    if (colonIdx < 0 || secondColonIdx < 0) continue;

    const filePath = line.slice(0, colonIdx).replace(/\\/g, "/");
    if (shouldExclude(filePath)) continue;

    const lineNumber = line.slice(colonIdx + 1, secondColonIdx);
    const rest = line.slice(secondColonIdx + 1).trim();

    // Find matching old path in the scanned text
    for (const [oldPath, newPath] of Object.entries(OLD_TO_NEW)) {
      if (rest.includes(oldPath) || rest.includes(oldPath.replace(/\//g, "\\/"))) {
        out.push(`${filePath},${lineNumber},${oldPath},${newPath}`);
      }
    }
  }

  fs.writeFileSync(
    path.join(REPO_ROOT, "nested-path-audit.csv"),
    out.join("\n") + "\n",
    "utf-8",
  );

  console.log(`Wrote nested-path-audit.csv with ${out.length - 1} rows`);
}

main();
