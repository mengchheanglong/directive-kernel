/**
 * Capability Health Report — audits all registry entries for harness-verified
 * vs placeholder evidence. Also provides UI consistency checking and regeneration.
 *
 * Usage:
 *   npx tsx scripts/capability-health.ts [--root <directive-root>]
 *   npx tsx scripts/capability-health.ts --check-ui [--root <directive-root>]
 *   npx tsx scripts/capability-health.ts --write-ui [--root <directive-root>]
 *
 * Modes:
 *   (default)  Health report: registry entries vs evidence, verification rates
 *   --check-ui  Consistency check: compares ui/source-descriptions.json verified
 *               array against evidence-derived classification. Exits 1 on mismatch.
 *   --write-ui  Regenerates ui/source-descriptions.json verified array from evidence
 *               files on disk.
 */
 
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  readValidatedEvidence,
  verificationFromEvidence,
  validateExecutionEvidence,
  type ExecutionEvidence,
  isExecutionEvidenceShape,
} from "../shared/lib/execution-evidence.ts";

// ── Configuration ──────────────────────────────────────────────────

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const KERNEL_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";

interface ParsedArgs {
  root: string;
  mode: "health" | "check-ui" | "write-ui";
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let root = DEFAULT_ROOT;
  let mode: ParsedArgs["mode"] = "health";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root" && i + 1 < args.length) {
      root = args[i + 1];
      i++;
    } else if (args[i] === "--check-ui") {
      mode = "check-ui";
    } else if (args[i] === "--write-ui") {
      mode = "write-ui";
    }
  }
  return { root: path.resolve(root).replace(/\\/g, "/"), mode };
}

// ── Health record ──────────────────────────────────────────────────

interface CapabilityHealth {
  candidateId: string;
  name: string;
  verification: "verified" | "claimed" | "placeholder";
  harnessSigned: boolean;
  exitCode: number | null;
  wallTimeMs: number | null;
  evidenceFile: boolean;
}

function readHealth(cid: string, evDir: string): CapabilityHealth {
  const datePrefixMatch = cid.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  const lookupCandidates = [cid];
  if (datePrefixMatch) {
    lookupCandidates.push(datePrefixMatch[1]);
  }

  for (const candidate of lookupCandidates) {
    const evPath = path.join(evDir, `${candidate}-execution.json`);
    if (fs.existsSync(evPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(evPath, "utf8")) as unknown;

        const validated = readValidatedEvidence(candidate, evDir);
        if (validated) {
          return {
            candidateId: cid,
            name: cid,
            verification: verificationFromEvidence(validated),
            harnessSigned: true,
            exitCode: validated.exitCode,
            wallTimeMs: validated.wallTimeMs,
            evidenceFile: true,
          };
        }

        const r = raw as Record<string, unknown>;
        const inv = (r.invocation as Record<string, unknown> | undefined) ?? {};
        const ver = (inv.verification as Record<string, unknown> | undefined) ?? {};

        return {
          candidateId: cid,
          name: cid,
          verification: "placeholder",
          harnessSigned: false,
          exitCode: typeof inv.exitCode === "number" ? inv.exitCode : null,
          wallTimeMs: typeof inv.durationMs === "number" ? inv.durationMs : null,
          evidenceFile: true,
        };
      } catch {
        // fall through
      }
    }
  }

  return {
    candidateId: cid,
    name: cid,
    verification: "placeholder",
    harnessSigned: false,
    exitCode: null,
    wallTimeMs: null,
    evidenceFile: false,
  };
}

// ── Health report ──────────────────────────────────────────────────

function runHealthReport(root: string) {
  const regDir = path.join(root, "runtime", "08-registry");
  const evDir = path.join(root, "runtime", "callable-executions");

  if (!fs.existsSync(regDir)) {
    console.error(`Registry directory not found: ${regDir}`);
    process.exit(1);
  }

  const registryFiles = fs.readdirSync(regDir).filter((f) => f.endsWith(".md"));
  const results: CapabilityHealth[] = [];

  for (const file of registryFiles) {
    const cid = file.replace("-registry-entry.md", "");
    results.push(readHealth(cid, evDir));
  }

  const verified = results.filter((r) => r.verification === "verified");
  const claimed = results.filter((r) => r.verification === "claimed");
  const placeholder = results.filter((r) => r.verification === "placeholder");
  const harnessSigned = results.filter((r) => r.harnessSigned);
  const rate = results.length > 0 ? ((verified.length / results.length) * 100).toFixed(1) : "0";
  const filterPrecision = results.length > 0 ? verified.length / results.length : 0;

  console.log("=== Capability Health Report ===\n");
  console.log(`Total:            ${results.length}`);
  console.log(`Verified:         ${verified.length} (${rate}%)    ← signed harness evidence, exit 0`);
  console.log(`Claimed:          ${claimed.length}              ← signed harness evidence, exit non-0`);
  console.log(`Placeholder:      ${placeholder.length}              ← no valid harness evidence`);
  console.log(`Harness-signed:   ${harnessSigned.length}              ← files bearing valid HMAC`);
  console.log(`Filter precision: ${filterPrecision.toFixed(3)} (verified / total)\n`);

  if (verified.length > 0) {
    console.log("✓ Harness-verified (signed evidence, exit 0):");
    for (const r of verified) {
      console.log(`  ${r.candidateId}`);
      console.log(`    exit: ${r.exitCode} | ${r.wallTimeMs}ms | signed: ${r.harnessSigned}`);
    }
    console.log();
  }

  if (claimed.length > 0) {
    console.log("⚠ Harness-claimed (signed evidence, exit non-0):");
    for (const r of claimed) {
      console.log(`  ${r.candidateId}`);
      console.log(`    exit: ${r.exitCode} | ${r.wallTimeMs}ms`);
    }
    console.log();
  }

  console.log(`✗ Unverified / placeholder (${placeholder.length}):`);
  for (const r of placeholder.slice(0, 10)) {
    const id = r.candidateId.length > 60 ? r.candidateId.slice(0, 60) : r.candidateId;
    const status = r.evidenceFile ? "legacy evidence (unsigned)" : "no evidence file";
    console.log(`  ${id} | ${status}`);
  }
  if (placeholder.length > 10) {
    console.log(`  ... and ${placeholder.length - 10} more`);
  }

  console.log(`\nTo verify a capability with the harness:`);
  console.log(`  1. Add a test spec to TEST_SPECS in scripts/execution-harness.ts`);
  console.log(`  2. Run: npx tsx scripts/execution-harness.ts <capability-id>`);
  console.log(`\nRoot: ${root}`);
}

// ── Evidence-derived classification ────────────────────────────────

interface EvidenceClassification {
  capabilityId: string;
  command: string | null;
  exitCode: number;
  wallTimeMs: number;
  isHarnessSigned: boolean;
  isEchoBased: boolean;
  isComposite: boolean;
  /** The final classification: "real" means a real CLI tool executed, not an echo placeholder */
  classification: "real" | "echo" | "unknown";
}

const ECHO_COMMAND_RE = /^\s*echo\s/i;
const COMPOSITE_FALLBACK_RE = /\|\|\s*echo\s/i;

function classifyEvidenceRecord(raw: Record<string, unknown>): EvidenceClassification {
  const cmd = typeof raw.command === "string" ? raw.command : null;
  const exit = typeof raw.exitCode === "number" ? raw.exitCode : -1;
  const wall = typeof raw.wallTimeMs === "number" ? raw.wallTimeMs : 0;

  const isEchoBased = cmd !== null && ECHO_COMMAND_RE.test(cmd);
  const isComposite = cmd !== null && COMPOSITE_FALLBACK_RE.test(cmd);

  let classification: EvidenceClassification["classification"] = "unknown";
  if (isEchoBased) {
    classification = "echo";
  } else if (isComposite) {
    // Composite commands have `real-cmd || echo "fallback"`.
    // If exitCode is 0 and wallTime > 50ms, the real command succeeded (not the echo).
    classification = exit === 0 && wall > 50 ? "real" : "echo";
  } else if (cmd !== null && !isEchoBased) {
    classification = "real";
  }

  return {
    capabilityId: typeof raw.capabilityId === "string" ? raw.capabilityId : "(unknown)",
    command: cmd,
    exitCode: exit,
    wallTimeMs: wall,
    isHarnessSigned: true,
    isEchoBased,
    isComposite,
    classification,
  };
}

function loadUIDescriptions(kernelRoot: string): { descriptions: Record<string, string>; verified: string[]; default: string } | null {
  const uiPath = path.join(kernelRoot, "ui", "source-descriptions.json");
  if (!fs.existsSync(uiPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(uiPath, "utf8"));
    return {
      descriptions: raw.descriptions ?? {},
      verified: raw.verified ?? [],
      default: raw.default ?? "",
    };
  } catch {
    return null;
  }
}

function deriveShortName(capabilityId: string, descriptionKeys: string[]): string | null {
  // Sort by length descending to prevent "react" matching before "react-bits"
  const sorted = [...descriptionKeys].sort((a, b) => b.length - a.length);
  const lower = capabilityId.toLowerCase();
  for (const key of sorted) {
    if (lower.includes(key.toLowerCase())) {
      return key;
    }
  }
  return null;
}

/** Reads all evidence files and returns the set of short names that have real (non-echo) execution verification. */
function deriveVerifiedFromEvidence(root: string, kernelRoot: string): string[] {
  const evDir = path.join(root, "runtime", "callable-executions");
  if (!fs.existsSync(evDir)) return [];

  const uiData = loadUIDescriptions(kernelRoot);
  const descriptionKeys = uiData ? Object.keys(uiData.descriptions) : [];

  const verified = new Set<string>();

  for (const file of fs.readdirSync(evDir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(evDir, file), "utf8"));
      if (!isExecutionEvidenceShape(raw)) continue;
      if (!validateExecutionEvidence(raw)) continue;

      const cls = classifyEvidenceRecord(raw as unknown as Record<string, unknown>);
      if (cls.classification !== "real" || cls.exitCode !== 0) continue;

      const shortName = deriveShortName(raw.capabilityId, descriptionKeys);
      if (shortName) {
        verified.add(shortName);
      }
    } catch {
      // skip malformed files
    }
  }

  return [...verified].sort();
}

// ── UI consistency check ───────────────────────────────────────────

function runUICheck(root: string, kernelRoot: string): boolean {
  const uiData = loadUIDescriptions(kernelRoot);
  if (!uiData) {
    console.error("ERROR: Cannot read ui/source-descriptions.json");
    process.exit(2);
  }

  const evidenceVerified = deriveVerifiedFromEvidence(root, kernelRoot);
  const uiVerified = [...uiData.verified].sort();
  const evidenceSet = new Set(evidenceVerified);
  const uiSet = new Set(uiVerified);

  const extraInUI = uiVerified.filter((k) => !evidenceSet.has(k));
  const missingInUI = evidenceVerified.filter((k) => !uiSet.has(k));

  console.log("=== UI Consistency Check ===\n");
  console.log(`Evidence-derived verified: ${evidenceVerified.length} [${evidenceVerified.join(", ")}]`);
  console.log(`UI source-descriptions.json: ${uiVerified.length} [${uiVerified.join(", ")}]`);

  if (extraInUI.length === 0 && missingInUI.length === 0) {
    console.log("✓ Consistent — UI verified array matches evidence\n");
    return true;
  }

  console.log();
  if (extraInUI.length > 0) {
    console.log(`✗ EXTRA in UI (not evidence-verified): [${extraInUI.join(", ")}]`);
  }
  if (missingInUI.length > 0) {
    console.log(`✗ MISSING from UI (evidence-verified but not listed): [${missingInUI.join(", ")}]`);
  }
  console.log(`\n✗ MISMATCH — UI verified array does not match evidence-derived classification.`);
  console.log(`Run --write-ui to regenerate from evidence.\n`);
  return false;
}

// ── UI regeneration ────────────────────────────────────────────────

function runUIWrite(root: string, kernelRoot: string) {
  const uiPath = path.join(kernelRoot, "ui", "source-descriptions.json");
  if (!fs.existsSync(uiPath)) {
    console.error(`ERROR: ${uiPath} not found`);
    process.exit(2);
  }

  const evidenceVerified = deriveVerifiedFromEvidence(root, kernelRoot);
  const uiData = JSON.parse(fs.readFileSync(uiPath, "utf8"));

  const oldVerified = uiData.verified ?? [];

  uiData.verified = evidenceVerified;
  if (!uiData._meta) uiData._meta = {};
  uiData._meta.verifiedSource = "evidence-derived";
  uiData._meta.lastVerified = new Date().toISOString().slice(0, 10);
  if (!uiData._meta.criteria) {
    uiData._meta.criteria = "HMAC-signed execution evidence with non-echo CLI command and exitCode 0";
  }
  if (!uiData._meta.evidencePath) {
    uiData._meta.evidencePath = "runtime/callable-executions/<cid>-execution.json";
  }
  if (!uiData._meta.canonicalCheck) {
    uiData._meta.canonicalCheck = "npx tsx scripts/capability-health.ts --check-ui";
  }
  if (!uiData._meta.regenerateCommand) {
    uiData._meta.regenerateCommand = "npx tsx scripts/capability-health.ts --write-ui";
  }

  fs.writeFileSync(uiPath, JSON.stringify(uiData, null, 2) + "\n");

  console.log("=== UI Verified Array Regenerated ===\n");
  console.log(`Previous: ${oldVerified.length} [${oldVerified.join(", ")}]`);
  console.log(`Updated:  ${evidenceVerified.length} [${evidenceVerified.join(", ")}]`);
  console.log(`\nWritten to: ${uiPath}`);
  console.log(`Timestamp: ${uiData._meta.lastVerified}`);
}

// ── Main ───────────────────────────────────────────────────────────

function main() {
  const { root, mode } = parseArgs();

  switch (mode) {
    case "check-ui": {
      const ok = runUICheck(root, KERNEL_ROOT);
      process.exit(ok ? 0 : 1);
    }
    case "write-ui": {
      runUIWrite(root, KERNEL_ROOT);
      process.exit(0);
    }
    case "health":
    default: {
      runHealthReport(root);
    }
  }
}

main();
