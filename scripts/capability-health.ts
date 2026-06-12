/**
 * Capability Health Report — audits all registry entries for real vs synthetic evidence.
 *
 * Usage: npx tsx scripts/capability-health.ts
 *
 * Reports:
 * - Total registered capabilities
 * - Real execution count (verified by actual CLI run)
 * - Synthetic count (pipeline template, never verified)
 * - Verification rate (%)
 * - Which capabilities need verification manifests
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const REG_DIR = path.join(ROOT, "runtime/08-registry");
const EV_DIR = path.join(ROOT, "runtime/callable-executions");

interface CapabilityHealth {
  candidateId: string;
  name: string;
  realExecution: boolean;
  tool: string;
  exitCode: number | null;
  durationMs: number | null;
  verification: string;
}

function readEvidence(cid: string): CapabilityHealth | null {
  // Registry entries have date prefixes like "2026-06-11-pipe-name-hash"
  // but evidence files are just "pipe-name-hash-execution.json"
  // Try both: exact match first, then strip date prefix
  const candidates = [cid];
  const datePrefixMatch = cid.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  if (datePrefixMatch) {
    candidates.push(datePrefixMatch[1]);
  }

  for (const candidate of candidates) {
    const evPath = path.join(EV_DIR, `${candidate}-execution.json`);
    if (fs.existsSync(evPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(evPath, "utf8"));
        const inv = data.invocation || {};
        const ver = inv.verification || {};

        return {
          candidateId: cid,
          name: data.capability?.displayName || cid,
          realExecution: ver.realExecution === true,
          tool: inv.tool || "unknown",
          exitCode: inv.exitCode ?? null,
          durationMs: inv.durationMs ?? null,
          verification: ver.method || (ver.realExecution ? "real" : "synthetic"),
        };
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Main
const registryFiles = fs.readdirSync(REG_DIR).filter((f) => f.endsWith(".md"));
const results: CapabilityHealth[] = [];

for (const file of registryFiles) {
  const cid = file.replace("-registry-entry.md", "");
  const health = readEvidence(cid);

  if (health) {
    results.push(health);
  } else {
    results.push({
      candidateId: cid,
      name: cid,
      realExecution: false,
      tool: "unknown",
      exitCode: null,
      durationMs: null,
      verification: "no evidence file",
    });
  }
}

// Report
const real = results.filter((r) => r.realExecution);
const synthetic = results.filter((r) => !r.realExecution);
const rate = results.length > 0 ? ((real.length / results.length) * 100).toFixed(1) : "0";

console.log("=== Capability Health Report ===\n");
console.log(`Total:     ${results.length}`);
console.log(`Verified:  ${real.length} (${rate}%)`);
console.log(`Synthetic: ${synthetic.length}\n`);

if (real.length > 0) {
  console.log("✓ Real execution:");
  for (const r of real) {
    console.log(`  ${r.name}`);
    console.log(`    tool: ${r.tool} | exit: ${r.exitCode} | ${r.durationMs}ms | ${r.verification}`);
  }
}

console.log(`\n✗ Synthetic / unverified (${synthetic.length}):`);
for (const r of synthetic.slice(0, 10)) {
  console.log(`  ${r.candidateId.slice(0, 60)} | ${r.verification}`);
}
if (synthetic.length > 10) {
  console.log(`  ... and ${synthetic.length - 10} more`);
}

console.log(`\nTo verify a capability:`);
console.log(`  1. Add a manifest to scripts/verify-execution.ts`);
console.log(`  2. Run: npx tsx scripts/verify-execution.ts <candidate-id>`);
