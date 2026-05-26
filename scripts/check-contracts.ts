import * as fs from "node:fs";
import * as path from "node:path";

const CONTRACTS_DIR = path.resolve(process.cwd(), "shared", "contracts");

function findEnforcedFiles(dir: string): Map<string, string> {
  const result = new Map<string, string>();
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const filePath = path.join(dir, entry.name);
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^\*\*Enforced by:\*\*\s+(.+)$/m);
    if (match) {
      result.set(entry.name, match[1].trim());
    }
  }
  return result;
}

function main(): void {
  const enforced = findEnforcedFiles(CONTRACTS_DIR);
  const violations: string[] = [];

  for (const [contract, enforcedPath] of enforced) {
    const absPath = path.resolve(process.cwd(), enforcedPath);
    if (!fs.existsSync(absPath)) {
      violations.push(
        `missing-enforcer: ${contract}: "Enforced by:" path not found: ${enforcedPath}`,
      );
    }
  }

  if (violations.length > 0) {
    for (const v of violations) {
      process.stderr.write(`${v}\n`);
    }
    process.exit(1);
  }

  process.exit(0);
}

main();
