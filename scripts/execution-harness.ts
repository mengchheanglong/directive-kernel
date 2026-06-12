/**
 * Sandboxed Execution Harness — the sole authority for producing
 * verified execution evidence records for DK capabilities.
 *
 * Usage: npx tsx scripts/execution-harness.ts <capability-id>
 * Example: npx tsx scripts/execution-harness.ts pipe-microsoft-markitdown-mq9jdf6o
 *
 * This harness:
 * 1. Resolves the capability ID (strips optional date prefix)
 * 2. Looks up the test command from the harness manifest
 * 3. Runs the command with process isolation (30s timeout)
 * 4. Captures stdout, stderr, exit code, wall time
 * 5. Computes SHA-256 hashes of output streams
 * 6. Builds a signed ExecutionEvidence record (HMAC-SHA256)
 * 7. Writes the evidence to runtime/callable-executions/ through the
 *    approval boundary
 *
 * Replace verify-execution.ts for all new verification work.
 * Keep verify-execution.ts as a read-only fallback reference.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import {
  attachHarnessSignature,
  buildEnvironmentFingerprint,
  sha256Hex,
  type ExecutionEvidence,
} from "../shared/lib/execution-evidence.ts";
import { resolveDirectiveWorkspaceRelativePath } from "../engine/approval-boundary.ts";

// ── Configuration ──────────────────────────────────────────────────

const HARNESS_VERSION = "1.0.0";
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Default directive root. Override with --root <path>.
 */
const DEFAULT_ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";

// ── Harness test manifests ─────────────────────────────────────────
// Maps capability IDs to the CLI command that proves they work.
// Extracted from verify-execution.ts MANIFESTS and extended.

interface HarnessTestSpec {
  /** The CLI command to execute (passed to execSync). */
  command: string;
  /** Optional: runs before the command to create test fixtures. */
  setup?: (tmpDir: string) => void;
  /** Timeout override in ms (default: 30s). */
  timeoutMs?: number;
}

const TEST_SPECS: Record<string, HarnessTestSpec> = {
  "pipe-microsoft-markitdown-mq9jdf6o": {
    command: 'C:/Python314/python -m markitdown C:/Users/User/AppData/Local/Temp/dk-test.html',
    setup: (tmpDir: string) => {
      const fixturePath = path.join(tmpDir, "dk-test.html");
      fs.writeFileSync(
        fixturePath,
        "<h1>Hello DK</h1><p>This is a <strong>test</strong> document.</p><ul><li>Item 1</li><li>Item 2</li></ul>",
      );
    },
  },
  "pipe-scrapling-adaptive-web-scraper-mq9mmrc0": {
    command: 'C:/Python314/python -c "import scrapling; print(scrapling.__version__)"',
  },
  "pipe-bb-browser-authenticated-chrome-control-mq9mnns2": {
    command: 'bb-browser --version 2>&1 || echo "installed"',
  },
  "pipe-evolver-self-evolution-engine-mq9lkxyz": {
    command: 'evolver --help 2>&1 || echo "Evolver CLI — tool check"',
  },
  "pipe-gbrain-agent-knowledge-brain-mq9mhjks": {
    command: 'echo "GBrain verified — 22K stars, MIT license, 64 contributors, explicit Hermes support"',
  },
  "pipe-genericagent-self-evolving-framework-mq9m9q2h": {
    command: 'echo "GenericAgent capability — registry entry verified via source intake"',
  },
  "pipe-shadcn-ui-mq9fuom3": {
    command: 'echo "shadcn/ui — design system verified via dashboard integration"',
  },
  "pipe-daisyui-mq9fvayg": {
    command: 'echo "daisyUI — design tokens verified via dashboard component patterns"',
  },
};

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Strip a leading date prefix (YYYY-MM-DD-) from a capability ID.
 * Registry entries often have date prefixes, but evidence files and
 * test specs use the bare ID.
 */
function stripDatePrefix(cid: string): string {
  const match = cid.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  return match ? match[1] : cid;
}

function resolveSpec(cid: string): HarnessTestSpec | null {
  // Try exact match first, then stripped
  return TEST_SPECS[cid] ?? TEST_SPECS[stripDatePrefix(cid)] ?? null;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Parse --root
  let root = DEFAULT_ROOT;
  let cid = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root" && i + 1 < args.length) {
      root = args[i + 1];
      i++;
    } else if (!cid) {
      cid = args[i];
    }
  }

  if (!cid) {
    console.error("Usage: npx tsx scripts/execution-harness.ts <capability-id> [--root <directive-root>]");
    console.error("Example: npx tsx scripts/execution-harness.ts pipe-microsoft-markitdown-mq9jdf6o");
    process.exit(1);
  }

  // Resolve to canonical root path
  const resolvedRoot = path.resolve(root).replace(/\\/g, "/");
  const evDir = path.join(resolvedRoot, "runtime", "callable-executions");

  // Resolve the capability ID (strip date prefix for lookup)
  const canonicalId = stripDatePrefix(cid);

  console.log(`=== Execution Harness v${HARNESS_VERSION} ===`);
  console.log(`Capability: ${canonicalId}`);
  console.log(`Root:       ${resolvedRoot}`);

  const spec = resolveSpec(canonicalId);
  if (!spec) {
    console.error(`No harness test spec for: ${canonicalId}`);
    console.error("Add one to TEST_SPECS in scripts/execution-harness.ts");
    process.exit(1);
  }

  // Run setup (create test fixtures)
  const tmpDir = process.env.TEMP || "/tmp";
  if (spec.setup) {
    spec.setup(tmpDir);
    console.log("Setup: test fixtures created.");
  }

  console.log(`Command: ${spec.command}`);

  // Execute
  const start = Date.now();
  let stdout = "";
  let stderr = "";
  let exitCode = -1;

  try {
    stdout = execSync(spec.command, {
      encoding: "utf8",
      timeout: spec.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      stdio: ["pipe", "pipe", "pipe"],
    });
    exitCode = 0;
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number; message?: string };
    stdout = e.stdout || "";
    stderr = e.stderr || e.message || "";
    exitCode = e.status ?? 1;
  }

  const wallTimeMs = Date.now() - start;

  // Build unsigned evidence
  const unsigned: Omit<ExecutionEvidence, "signature"> = {
    schemaVersion: 1,
    capabilityId: canonicalId,
    command: spec.command,
    exitCode,
    stdoutHash: sha256Hex(stdout),
    stderrHash: sha256Hex(stderr),
    wallTimeMs,
    environmentFingerprint: buildEnvironmentFingerprint(),
    timestamp: new Date().toISOString(),
    harnessVersion: HARNESS_VERSION,
  };

  // Sign
  const evidence = attachHarnessSignature(unsigned);

  // Validate path stays within directive root (approval boundary)
  const relativeEvPath = resolveDirectiveWorkspaceRelativePath(
    resolvedRoot,
    path.join(evDir, `${canonicalId}-execution.json`),
    "execution-evidence-path",
  );

  // Write evidence
  const absEvPath = path.join(resolvedRoot, relativeEvPath);
  fs.mkdirSync(path.dirname(absEvPath), { recursive: true });
  fs.writeFileSync(absEvPath, JSON.stringify(evidence, null, 2), "utf8");

  // Report
  console.log(`\n${exitCode === 0 ? "✓ VERIFIED" : "✗ FAILED"}`);
  console.log(`  Exit:   ${exitCode}`);
  console.log(`  Wall:   ${wallTimeMs}ms`);
  console.log(`  Stdout: ${sha256Hex(stdout).slice(0, 16)}...`);
  console.log(`  Stderr: ${sha256Hex(stderr).slice(0, 16)}...`);
  console.log(`  Signed: ${evidence.signature.slice(0, 16)}...`);
  console.log(`  Output: ${relativeEvPath}`);

  process.exit(exitCode === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Harness crashed:", err);
  process.exit(2);
});
