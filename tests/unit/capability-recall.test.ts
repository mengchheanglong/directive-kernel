/**
 * Unit tests: Capability Recall & Projection Gates
 *
 * Tests:
 *  - getProjectedCapabilityIds: only projectionReady capabilities
 *  - buildProjectedCapabilityTools: no placeholder/claimed leak
 *  - manifest contract with projection metadata produces correct projectionReady
 *  - recall ranking: projection-ready first via multiplier
 *  - include_candidates: honest labeling of non-usable entries
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { attachHarnessSignature } from "../../shared/lib/execution-evidence.ts";
import {
  readRuntimeCapabilityManifest,
  deriveEntryClass,
  deriveProjectionReadiness,
} from "../../runtime/core/capability-registry.ts";

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dk-recall-test-"));
  // Create minimal directive-root structure for getProjectedCapabilityIds
  fs.mkdirSync(path.join(tmpDir, "discovery"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "discovery", "intake-queue.json"), '{"entries":[]}');
  fs.mkdirSync(path.join(tmpDir, "knowledge"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "knowledge", "active-mission.md"), "# Test");
  fs.mkdirSync(path.join(tmpDir, "engine"), { recursive: true });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Write a capability manifest + scaffold in the temp directory
function writeCapability(id: string, manifest: Record<string, unknown>) {
  const capRoot = path.join(tmpDir, "runtime", "capabilities", id);
  fs.mkdirSync(capRoot, { recursive: true });
  fs.writeFileSync(
    path.join(capRoot, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(capRoot, "index.ts"),
    `export {};\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(capRoot, "executor.ts"),
    `export const DUMMY = 1;\n`,
    "utf8",
  );
}

function writeSchema(relativePath: string, schema: Record<string, unknown>) {
  const target = path.join(tmpDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(schema, null, 2), "utf8");
}

function writeSignedEvidence(capabilityId: string) {
  const evidenceDir = path.join(tmpDir, "runtime", "callable-executions");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidence = attachHarnessSignature({
    schemaVersion: 1,
    capabilityId,
    command: "C:/Python314/python -m markitdown C:/tmp/example.html",
    exitCode: 0,
    stdoutHash: "stdout-hash",
    stderrHash: "stderr-hash",
    wallTimeMs: 200,
    environmentFingerprint: "win32-x64-v24.14.0",
    timestamp: new Date().toISOString(),
    harnessVersion: "1.0.0",
    contractVerification: "full",
    examples: [{
      name: "convert-inline-html",
      input: { html: "<h1>Hello DK</h1>" },
      passed: true,
    }],
  });
  fs.writeFileSync(
    path.join(evidenceDir, `${capabilityId}-execution.json`),
    JSON.stringify(evidence, null, 2),
    "utf8",
  );
}

// Override the default capabilities root to our temp directory
const originalCwd = process.cwd;

function withTempRoot(fn: () => void) {
  const restore = process.cwd;
  try {
    process.cwd = () => tmpDir;
    fn();
  } finally {
    process.cwd = restore;
  }
}

async function withTempRootAsync<T>(fn: () => Promise<T>): Promise<T> {
  const restore = process.cwd;
  try {
    process.cwd = () => tmpDir;
    return await fn();
  } finally {
    process.cwd = restore;
  }
}

describe("capability recall projection gates", () => {
  it("projectionReady manifest produces projectionReady = true", () => {
    withTempRoot(() => {
      writeCapability("proj-ready-cap", {
        displayName: "Projection Ready Cap",
        description: "Has everything for projection.",
        domain: "runtime",
        verification: "verified",
        inputSchema: "shared/schemas/x.schema.json",
        outputSchema: "shared/schemas/y.schema.json",
        verify: {
          command: "echo ready",
          assertions: [{ type: "regex", value: "ready" }],
          timeoutMs: 5000,
        },
        examples: [{
          name: "test",
          input: { x: 1 },
          expectedOutput: { ok: true },
          match: { invariantFields: ["ok"] },
        }],
        whenToUse: "When you need a projection-ready capability.",
        failureModes: ["None known"],
        projection: {
          kind: "mcp_tool",
          id: "proj-ready",
          invocation: "cap_proj_ready_cap",
        },
      });

      const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: path.join(tmpDir, "runtime", "capabilities"), id: "proj-ready-cap" });
      expect(manifest).not.toBeNull();
      expect(manifest!.whenToUse).toBeDefined();
      expect(manifest!.projection).toBeDefined();
      expect(manifest!.contract).toBe("complete");

      const readiness = deriveProjectionReadiness(manifest!);
      expect(readiness.projectionReady).toBe(true);
      expect(readiness.notUsableReason).toBeUndefined();
    });
  });

  it("placeholder manifest is never projectionReady", () => {
    withTempRoot(() => {
      writeCapability("placeholder-cap", {
        displayName: "Placeholder Cap",
        description: "No projection metadata.",
        domain: "runtime",
        verification: "placeholder",
        inputSchema: "shared/schemas/x.schema.json",
        outputSchema: "shared/schemas/y.schema.json",
        verify: {
          command: "echo ph",
          assertions: [{ type: "regex", value: "ph" }],
          timeoutMs: 5000,
        },
      });

      const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: path.join(tmpDir, "runtime", "capabilities"), id: "placeholder-cap" });
      expect(manifest).not.toBeNull();

      const readiness = deriveProjectionReadiness(manifest!);
      expect(readiness.projectionReady).toBe(false);
      expect(readiness.notUsableReason).toContain("placeholder");
    });
  });

  it("claimed manifest is never projectionReady", () => {
    withTempRoot(() => {
      writeCapability("claimed-cap", {
        displayName: "Claimed Cap",
        description: "Claimed but not verified.",
        domain: "runtime",
        verification: "claimed",
        inputSchema: "shared/schemas/x.schema.json",
        outputSchema: "shared/schemas/y.schema.json",
        verify: {
          command: "echo claimed",
          assertions: [{ type: "regex", value: "claimed" }],
          timeoutMs: 5000,
        },
      });

      const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: path.join(tmpDir, "runtime", "capabilities"), id: "claimed-cap" });
      expect(manifest).not.toBeNull();

      const readiness = deriveProjectionReadiness(manifest!);
      expect(readiness.projectionReady).toBe(false);
      expect(readiness.notUsableReason).toContain("claimed");
    });
  });

  it("verified with projection but missing whenToUse is not projectionReady", () => {
    withTempRoot(() => {
      writeCapability("no-when", {
        displayName: "No WhenToUse Cap",
        description: "Verified + projection but no whenToUse.",
        domain: "runtime",
        verification: "verified",
        inputSchema: "shared/schemas/x.schema.json",
        outputSchema: "shared/schemas/y.schema.json",
        verify: {
          command: "echo no",
          assertions: [{ type: "regex", value: "no" }],
          timeoutMs: 5000,
        },
        examples: [{
          name: "test",
          input: { x: 1 },
          expectedOutput: { ok: true },
          match: { invariantFields: ["ok"] },
        }],
        projection: {
          kind: "mcp_tool",
          id: "no-when",
          invocation: "cap_no_when",
        },
        failureModes: ["Timeout"],
        // Missing: whenToUse
      });

      const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: path.join(tmpDir, "runtime", "capabilities"), id: "no-when" });
      expect(manifest).not.toBeNull();
      expect(manifest!.contract).toBe("complete");

      const readiness = deriveProjectionReadiness(manifest!);
      expect(readiness.projectionReady).toBe(false);
      expect(readiness.notUsableReason).toContain("whenToUse");
    });
  });

  it("projectionReady filter excludes placeholder/claimed/verified-no-proj", () => {
    withTempRoot(() => {
      // Write a projection-ready capability
      writeCapability("ready-one", {
        displayName: "Ready One", description: "Projection ready.", domain: "runtime",
        verification: "verified",
        inputSchema: "shared/schemas/x.schema.json", outputSchema: "shared/schemas/y.schema.json",
        verify: { command: "echo one", assertions: [{ type: "regex", value: "one" }], timeoutMs: 5000 },
        examples: [{ name: "test", input: { x: 1 }, expectedOutput: { ok: true }, match: { invariantFields: ["ok"] } }],
        whenToUse: "When you need ready-one.",
        failureModes: ["None"],
        projection: { kind: "mcp_tool", id: "r1", invocation: "cap_ready_one" },
      });

      // Write a placeholder (not ready)
      writeCapability("not-ready-placeholder", {
        displayName: "Not Ready", description: "Placeholder.", domain: "runtime",
        verification: "placeholder",
        inputSchema: "shared/schemas/x.schema.json", outputSchema: "shared/schemas/y.schema.json",
        verify: { command: "echo nr", assertions: [{ type: "regex", value: "nr" }], timeoutMs: 5000 },
      });

      // Write a claimed (not ready)
      writeCapability("not-ready-claimed", {
        displayName: "Claimed", description: "Claimed.", domain: "runtime",
        verification: "claimed",
        inputSchema: "shared/schemas/x.schema.json", outputSchema: "shared/schemas/y.schema.json",
        verify: { command: "echo cl", assertions: [{ type: "regex", value: "cl" }], timeoutMs: 5000 },
      });

      // Write a verified but missing projection (not ready)
      writeCapability("verified-no-proj", {
        displayName: "Verified No Proj", description: "Verified but no projection.", domain: "runtime",
        verification: "verified",
        inputSchema: "shared/schemas/x.schema.json", outputSchema: "shared/schemas/y.schema.json",
        verify: { command: "echo vnp", assertions: [{ type: "regex", value: "vnp" }], timeoutMs: 5000 },
        examples: [{ name: "test", input: { x: 1 }, expectedOutput: { ok: true }, match: { invariantFields: ["ok"] } }],
      });

      const capsRoot = path.join(tmpDir, "runtime", "capabilities");

      // Use individual helper functions to verify projection readiness for each
      const ready = readRuntimeCapabilityManifest({ capabilitiesRoot: capsRoot, id: "ready-one" })!;
      expect(deriveProjectionReadiness(ready).projectionReady).toBe(true);
      expect(deriveEntryClass(ready)).toBe("verified_capability");

      const ph = readRuntimeCapabilityManifest({ capabilitiesRoot: capsRoot, id: "not-ready-placeholder" })!;
      expect(deriveProjectionReadiness(ph).projectionReady).toBe(false);
      expect(deriveProjectionReadiness(ph).notUsableReason).toContain("placeholder");
      expect(deriveEntryClass(ph)).toBe("placeholder");

      const cl = readRuntimeCapabilityManifest({ capabilitiesRoot: capsRoot, id: "not-ready-claimed" })!;
      expect(deriveProjectionReadiness(cl).projectionReady).toBe(false);
      expect(deriveProjectionReadiness(cl).notUsableReason).toContain("claimed");
      expect(deriveEntryClass(cl)).toBe("candidate");

      const vnp = readRuntimeCapabilityManifest({ capabilitiesRoot: capsRoot, id: "verified-no-proj" })!;
      expect(deriveProjectionReadiness(vnp).projectionReady).toBe(false);
      expect(deriveProjectionReadiness(vnp).notUsableReason).toContain("projection");
      expect(deriveEntryClass(vnp)).toBe("candidate");
    });
  });

  it("projectionReady=true entry is derived as verified_capability entryClass", () => {
    withTempRoot(() => {
      writeCapability("entry-class-test", {
        displayName: "Entry Class Test",
        description: "Should be verified_capability.",
        domain: "runtime",
        verification: "verified",
        inputSchema: "shared/schemas/x.schema.json",
        outputSchema: "shared/schemas/y.schema.json",
        verify: {
          command: "echo ect",
          assertions: [{ type: "regex", value: "ect" }],
          timeoutMs: 5000,
        },
        examples: [{
          name: "test",
          input: { x: 1 },
          expectedOutput: { ok: true },
          match: { invariantFields: ["ok"] },
        }],
        whenToUse: "Test entry class.",
        failureModes: ["None"],
        projection: { kind: "mcp_tool", id: "ect", invocation: "cap_entry_class_test" },
      });

      const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: path.join(tmpDir, "runtime", "capabilities"), id: "entry-class-test" });
      expect(manifest).not.toBeNull();

      const ec = deriveEntryClass(manifest!);
      expect(ec).toBe("verified_capability");

      const readiness = deriveProjectionReadiness(manifest!);
      expect(readiness.projectionReady).toBe(true);
    });
  });

  it("placeholder entryClass never has projectionReady=true", () => {
    withTempRoot(() => {
      writeCapability("ph-class", {
        displayName: "PH Class",
        description: "Placeholder.",
        domain: "runtime",
        verification: "placeholder",
        inputSchema: "shared/schemas/x.schema.json",
        outputSchema: "shared/schemas/y.schema.json",
        verify: {
          command: "echo phc",
          assertions: [{ type: "regex", value: "phc" }],
          timeoutMs: 5000,
        },
      });

      const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: path.join(tmpDir, "runtime", "capabilities"), id: "ph-class" });
      expect(manifest).not.toBeNull();

      const ec = deriveEntryClass(manifest!);
      expect(ec).toBe("placeholder");

      const readiness = deriveProjectionReadiness(manifest!);
      expect(readiness.projectionReady).toBe(false);
      expect(readiness.notUsableReason).toBeDefined();
    });
  });

  it("placeholder manifest derivation produces correct entryClass and reasoning", () => {
    withTempRoot(() => {
      writeCapability("ph-meta", {
        displayName: "PH Meta", description: "Placeholder.", domain: "runtime",
        verification: "placeholder",
        inputSchema: "shared/schemas/x.schema.json", outputSchema: "shared/schemas/y.schema.json",
        verify: { command: "echo phm", assertions: [{ type: "regex", value: "phm" }], timeoutMs: 5000 },
      });

      const capsRoot = path.join(tmpDir, "runtime", "capabilities");
      const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: capsRoot, id: "ph-meta" });
      expect(manifest).not.toBeNull();

      const ec = deriveEntryClass(manifest!);
      expect(ec).toBe("placeholder");

      const { projectionReady, notUsableReason } = deriveProjectionReadiness(manifest!);
      expect(projectionReady).toBe(false);
      expect(notUsableReason).toBeDefined();
      expect(notUsableReason).toContain("placeholder");
    });
  });

  it("default recall excludes non-projection-ready capabilities", async () => {
    await withTempRootAsync(async () => {
      writeCapability("recall-ready-only", {
        displayName: "Search Ready Tool",
        description: "Projection-ready search capability.",
        domain: "runtime",
        verification: "verified",
        inputSchema: "shared/schemas/x.schema.json",
        outputSchema: "shared/schemas/y.schema.json",
        verify: { command: "echo ready", assertions: [{ type: "regex", value: "ready" }], timeoutMs: 5000 },
        examples: [{ name: "test", input: { q: "x" }, expectedOutput: { ok: true }, match: { invariantFields: ["ok"] } }],
        whenToUse: "Use when Hermes needs a ready search tool.",
        failureModes: ["Rate limit"],
        projection: { kind: "mcp_tool", id: "search-ready", invocation: "cap_recall_ready_only" },
      });
      writeCapability("recall-candidate-only", {
        displayName: "Search Candidate Tool",
        description: "Candidate search capability.",
        domain: "runtime",
        verification: "verified",
        inputSchema: "shared/schemas/x.schema.json",
        outputSchema: "shared/schemas/y.schema.json",
        verify: { command: "echo candidate", assertions: [{ type: "regex", value: "candidate" }], timeoutMs: 5000 },
        examples: [{ name: "test", input: { q: "x" }, expectedOutput: { ok: true }, match: { invariantFields: ["ok"] } }],
      });
      writeSignedEvidence("recall-ready-only");

      vi.resetModules();
      const { buildCapabilityRecallExecutors } = await import("../../hosts/mcp-host/executors/capability-recall.ts");
      const executors = buildCapabilityRecallExecutors({ directiveRoot: tmpDir });
      const result = await executors.find_capability({ query: "search tool" }) as {
        ok: boolean;
        includeCandidates: boolean;
        results: Array<{ capabilityId: string; projectionReady: boolean; whenToUse?: string; failureModes?: string[] }>;
      };
      expect(result.ok).toBe(true);
      expect(result.includeCandidates).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].capabilityId).toBe("recall-ready-only");
      expect(result.results[0].projectionReady).toBe(true);
      expect(result.results[0].whenToUse).toContain("ready search tool");
      expect(result.results[0].failureModes).toEqual(["Rate limit"]);
    });
  });

  it("include_candidates returns non-usable entries with honest labels and demotion", async () => {
    await withTempRootAsync(async () => {
      writeCapability("rank-ready", {
        displayName: "Ranking Search Ready",
        description: "Ready ranking capability.",
        domain: "runtime",
        verification: "verified",
        inputSchema: "shared/schemas/x.schema.json",
        outputSchema: "shared/schemas/y.schema.json",
        verify: { command: "echo ready", assertions: [{ type: "regex", value: "ready" }], timeoutMs: 5000 },
        examples: [{ name: "test", input: { q: "x" }, expectedOutput: { ok: true }, match: { invariantFields: ["ok"] } }],
        whenToUse: "Use for ranking search requests.",
        failureModes: ["Timeout"],
        projection: { kind: "mcp_tool", id: "rank-ready", invocation: "cap_rank_ready" },
      });
      writeCapability("rank-placeholder", {
        displayName: "Ranking Search Placeholder",
        description: "Placeholder ranking capability.",
        domain: "runtime",
        verification: "placeholder",
        inputSchema: "shared/schemas/x.schema.json",
        outputSchema: "shared/schemas/y.schema.json",
        verify: { command: "echo ph", assertions: [{ type: "regex", value: "ph" }], timeoutMs: 5000 },
      });
      writeSignedEvidence("rank-ready");

      vi.resetModules();
      const { buildCapabilityRecallExecutors } = await import("../../hosts/mcp-host/executors/capability-recall.ts");
      const executors = buildCapabilityRecallExecutors({ directiveRoot: tmpDir });
      const result = await executors.find_capability({ query: "ranking search", include_candidates: true }) as {
        ok: boolean;
        includeCandidates: boolean;
        results: Array<{ capabilityId: string; projectionReady: boolean; entryClass: string; notUsableReason?: string; rankScore: number }>;
      };
      expect(result.ok).toBe(true);
      expect(result.includeCandidates).toBe(true);
      expect(result.results.length).toBeGreaterThanOrEqual(2);
      expect(result.results[0].capabilityId).toBe("rank-ready");
      const placeholder = result.results.find((r) => r.capabilityId === "rank-placeholder");
      expect(placeholder).toBeDefined();
      expect(placeholder!.projectionReady).toBe(false);
      expect(placeholder!.entryClass).toBe("placeholder");
      expect(placeholder!.notUsableReason).toContain("placeholder");
      expect(result.results[0].rankScore).toBeGreaterThan(placeholder!.rankScore);
    });
  });

  it("default recall surfaces MarkItDown as usable for convert html to markdown", async () => {
    await withTempRootAsync(async () => {
      writeSchema("shared/schemas/markitdown-callable-input.schema.json", {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
          sourcePath: { type: "string" },
          html: { type: "string" },
        },
        anyOf: [{ required: ["sourcePath"] }, { required: ["html"] }],
      });
      writeSchema("shared/schemas/markitdown-callable-output.schema.json", {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        required: ["ok"],
        properties: { ok: { type: "boolean" } },
      });
      writeCapability("pipe-microsoft-markitdown-mq9jdf6o", {
        displayName: "Microsoft MarkItDown",
        description: "Convert HTML and documents into Markdown.",
        domain: "runtime",
        verification: "verified",
        inputSchema: "shared/schemas/markitdown-callable-input.schema.json",
        outputSchema: "shared/schemas/markitdown-callable-output.schema.json",
        verify: {
          command: "C:/Python314/python -m markitdown C:/tmp/example.html",
          assertions: [{ type: "regex", value: "Hello DK" }],
          timeoutMs: 30000,
        },
        examples: [{
          name: "convert-inline-html",
          input: { html: "<h1>Hello DK</h1>" },
          expectedOutput: { ok: true, markdown: "# Hello DK" },
          match: { invariantFields: ["ok", "markdown"] },
        }],
        whenToUse: "Use when Hermes needs to convert HTML or document content into Markdown.",
        failureModes: ["Missing MarkItDown install", "Timeout", "Unsupported input"],
        projection: {
          kind: "mcp_tool",
          id: "markitdown",
          invocation: "cap_pipe-microsoft-markitdown-mq9jdf6o",
        },
      });
      writeSignedEvidence("pipe-microsoft-markitdown-mq9jdf6o");

      vi.resetModules();
      const { buildCapabilityRecallExecutors } = await import("../../hosts/mcp-host/executors/capability-recall.ts");
      const executors = buildCapabilityRecallExecutors({ directiveRoot: tmpDir });
      const result = await executors.find_capability({ query: "convert html to markdown" }) as {
        ok: boolean;
        results: Array<{ capabilityId: string; projectionReady: boolean; entryClass: string; notUsableReason?: string }>;
      };
      expect(result.ok).toBe(true);
      expect(result.results[0]?.capabilityId).toBe("pipe-microsoft-markitdown-mq9jdf6o");
      expect(result.results[0]?.projectionReady).toBe(true);
      expect(result.results[0]?.entryClass).toBe("verified_capability");
      expect(result.results[0]?.notUsableReason).toBeUndefined();
    });
  });

  it("default recall surfaces Scrapling for static HTML extraction", async () => {
    await withTempRootAsync(async () => {
      writeSchema("shared/schemas/scrapling-extract-input.schema.json", {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        properties: {
          html: { type: "string" },
          sourcePath: { type: "string" },
          url: { type: "string" },
          selectors: { type: "object", additionalProperties: { type: "string" } },
          includeText: { type: "boolean" },
          includeLinks: { type: "boolean" },
        },
        oneOf: [{ required: ["html"] }, { required: ["sourcePath"] }, { required: ["url"] }],
      });
      writeSchema("shared/schemas/scrapling-extract-output.schema.json", {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        required: ["ok"],
        properties: { ok: { type: "boolean" } },
      });
      writeCapability("pipe-scrapling-adaptive-web-scraper-mq9mmrc0", {
        displayName: "Scrapling Adaptive Web Scraper",
        description: "Extract structured fields, text, and links from static HTML or safe public URLs using curl_cffi fetch plus Scrapling parse.",
        domain: "runtime",
        verification: "verified",
        inputSchema: "shared/schemas/scrapling-extract-input.schema.json",
        outputSchema: "shared/schemas/scrapling-extract-output.schema.json",
        verify: {
          command: "C:/Python314/python C:/tmp/dk-scrapling-smoke.py C:/tmp/dk-scrapling-smoke.html",
          assertions: [{ type: "regex", value: "Hermes Scrapling Smoke" }],
          timeoutMs: 30000,
        },
        examples: [{
          name: "extract-local-html",
          input: { html: "<h1>Hermes Scrapling Smoke</h1>", selectors: { heading: "h1" } },
          expectedOutput: { ok: true, sourceType: "html", fields: { heading: "Hermes Scrapling Smoke" }, warnings: [] },
          match: { invariantFields: ["ok", "sourceType", "fields", "warnings"] },
        }],
        whenToUse: "Use when Hermes needs structured extraction from static HTML, saved local HTML files, or safe public URLs.",
        failureModes: ["Missing Scrapling install", "Missing curl_cffi for URL input", "Unsafe URL rejected", "Timeout"],
        projection: {
          kind: "mcp_tool",
          id: "scrapling",
          invocation: "cap_pipe-scrapling-adaptive-web-scraper-mq9mmrc0",
        },
      });
      writeSignedEvidence("pipe-scrapling-adaptive-web-scraper-mq9mmrc0");

      vi.resetModules();
      const { buildCapabilityRecallExecutors } = await import("../../hosts/mcp-host/executors/capability-recall.ts");
      const executors = buildCapabilityRecallExecutors({ directiveRoot: tmpDir });
      const result = await executors.find_capability({ query: "static html extraction fields links" }) as {
        ok: boolean;
        results: Array<{ capabilityId: string; projectionReady: boolean; entryClass: string; notUsableReason?: string }>;
      };
      expect(result.ok).toBe(true);
      expect(result.results[0]?.capabilityId).toBe("pipe-scrapling-adaptive-web-scraper-mq9mmrc0");
      expect(result.results[0]?.projectionReady).toBe(true);
      expect(result.results[0]?.entryClass).toBe("verified_capability");
      expect(result.results[0]?.notUsableReason).toBeUndefined();
    });
  });
});
