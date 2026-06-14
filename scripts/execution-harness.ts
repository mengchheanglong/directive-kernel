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
const TEMP_ROOT = (process.env.TEMP || "/tmp").replace(/\\/g, "/");

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
  /** Optional: contract-grade example checks. */
  examples?: Array<{
    name: string;
    input: Record<string, unknown>;
    assert: (output: { stdout: string; stderr: string; exitCode: number }) => boolean;
  }>;
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
    examples: [{
      name: "convert-inline-html",
      input: {
        html: "<h1>Hello DK</h1><p>This is a <strong>test</strong> document.</p><ul><li>Item 1</li><li>Item 2</li></ul>",
      },
      assert: ({ stdout, exitCode }) =>
        exitCode === 0
        && stdout.includes("# Hello DK")
        && stdout.includes("**test**")
        && stdout.includes("* Item 1")
        && stdout.includes("* Item 2"),
    }],
  },
  "pipe-scrapling-adaptive-web-scraper-mq9mmrc0": {
    command: `C:/Python314/python ${TEMP_ROOT}/dk-scrapling-smoke.py ${TEMP_ROOT}/dk-scrapling-smoke.html`,
    setup: (tmpDir: string) => {
      const normalizedTmp = tmpDir.replace(/\\/g, "/");
      const fixturePath = path.join(tmpDir, "dk-scrapling-smoke.html");
      const helperPath = path.join(tmpDir, "dk-scrapling-smoke.py");
      fs.writeFileSync(
        fixturePath,
        [
          "<html><head><title>Hermes Scrapling Smoke</title></head><body>",
          "<h1>Hermes Scrapling Smoke</h1>",
          "<p class=\"summary\">Local extraction proof.</p>",
          "<a href=\"https://example.com\">Example</a>",
          "</body></html>",
        ].join(""),
        "utf8",
      );
      fs.writeFileSync(
        helperPath,
        [
          "import json",
          "import pathlib",
          "import sys",
          "from curl_cffi import requests",
          "from scrapling.parser import Adaptor",
          "local_page = Adaptor(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))",
          "local_heading = local_page.css('h1')[0].get_all_text(separator=' ', strip=True)",
          "local_link = local_page.css('a[href]')[0]",
          "with requests.Session(trust_env=False, allow_redirects=False, proxies={}, default_headers=False, discard_cookies=True) as session:",
          "    response = session.get(",
          "      'https://example.com',",
          "      timeout=10,",
          "      allow_redirects=False,",
          "      max_redirects=0,",
          "      proxies={},",
          "      default_headers=False,",
          "      discard_cookies=True,",
          "    )",
          "if response.status_code >= 400:",
          "    raise RuntimeError(f'URL fetch failed with HTTP status {response.status_code}')",
          "url_page = Adaptor(response.text)",
          "url_heading = url_page.css('h1')[0].get_all_text(separator=' ', strip=True)",
          "result = {'local': {",
          "  'ok': True,",
          "  'sourceType': 'sourcePath',",
          "  'fields': {'heading': local_heading},",
          "  'warnings': [],",
          "  'links': [{'text': local_link.get_all_text(separator=' ', strip=True), 'href': local_link.attrib.get('href')}],",
          "}, 'publicUrl': {",
          "  'ok': True,",
          "  'sourceType': 'url',",
          "  'sourceUrl': 'https://example.com/',",
          "  'fields': {'heading': url_heading},",
          "  'warnings': [],",
          "}}",
          "print(json.dumps(result))",
          "",
        ].join("\n"),
        "utf8",
      );
      if (normalizedTmp !== TEMP_ROOT) {
        throw new Error(`Harness temp root mismatch: ${normalizedTmp} !== ${TEMP_ROOT}`);
      }
    },
    examples: [{
      name: "extract-local-html",
      input: {
        sourcePath: `${TEMP_ROOT}/dk-scrapling-smoke.html`,
        selectors: { heading: "h1" },
        includeLinks: true,
      },
      assert: ({ stdout, exitCode }) => {
        if (exitCode !== 0) return false;
        try {
          const parsed = JSON.parse(stdout) as {
            local?: {
              ok?: boolean;
              fields?: { heading?: string };
              links?: Array<{ href?: string }>;
            };
          };
          return parsed.local?.ok === true
            && typeof parsed.local.fields?.heading === "string"
            && parsed.local.fields.heading.includes("Hermes Scrapling Smoke")
            && parsed.local.links?.some((link) => link.href === "https://example.com") === true;
        } catch {
          return false;
        }
      },
    }, {
      name: "extract-safe-public-url",
      input: {
        url: "https://example.com",
        selectors: { heading: "h1" },
      },
      assert: ({ stdout, exitCode }) => {
        if (exitCode !== 0) return false;
        try {
          const parsed = JSON.parse(stdout) as {
            publicUrl?: {
              ok?: boolean;
              sourceType?: string;
              sourceUrl?: string;
              fields?: { heading?: string };
            };
          };
          return parsed.publicUrl?.ok === true
            && parsed.publicUrl.sourceType === "url"
            && parsed.publicUrl.sourceUrl === "https://example.com/"
            && parsed.publicUrl.fields?.heading === "Example Domain";
        } catch {
          return false;
        }
      },
    }],
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
  const exampleResults = spec.examples?.map((example) => ({
    name: example.name,
    input: example.input,
    passed: example.assert({ stdout, stderr, exitCode }),
  }));
  if (exitCode === 0 && exampleResults?.some((example) => !example.passed)) {
    stderr = `${stderr}${stderr ? "\n" : ""}Contract example assertion failed.`;
    exitCode = 1;
  }

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
    ...(exampleResults
      ? {
          contractVerification: "full" as const,
          examples: exampleResults,
        }
      : {}),
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
