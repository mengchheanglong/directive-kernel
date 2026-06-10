import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

const VOCAB_LHS_TERMS = [
  "earnedAutonomy",
  "gapRadar",
  "narrativeThreading",
  "deepTail",
  "legalNextSeams",
  "forbiddenScopeExpansion",
  "boundedCloseout",
  "integrityGate",
];

const ALLOWLIST = new Set([
  "vocabulary-audit.csv",
  "shared/schemas/migrations/v8-to-v9.ts",
  "shared/schemas/directive-engine-run-record.schema.json",
]);

function runRg(term: string): string[] {
  try {
    const output = execSync(
      `pnpm exec rg --files-with-matches --case-sensitive --glob '!dist/**' --glob '!ui/**' --glob '!discovery/research-engine/**' --glob '!node_modules/**' -- "${term}"`,
      {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    return output
      .trim()
      .split(/\r?\n/)
      .filter((f) => f.length > 0)
      .map((f) => f.replace(/\\/g, "/"));
  } catch {
    return [];
  }
}

function isAllowlisted(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  for (const allowed of ALLOWLIST) {
    if (normalized.endsWith(allowed) || normalized.includes(allowed)) {
      return true;
    }
  }
  return false;
}

describe("vocabulary sweep", () => {
  it("has zero LHS vocabulary terms outside the allowlist", () => {
    const violations: string[] = [];

    for (const term of VOCAB_LHS_TERMS) {
      const matches = runRg(term);

      for (const match of matches) {
        if (!isAllowlisted(match)) {
          violations.push(`${term}: ${match}`);
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} vocabulary LHS term(s) outside allowlist:\n${violations.join("\n")}`,
    ).toHaveLength(0);
  });
});
