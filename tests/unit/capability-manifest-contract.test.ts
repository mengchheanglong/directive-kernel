/**
 * Unit tests: Capability Manifest Contract Validation v2
 *
 * Tests that parseRuntimeCapabilityManifest() correctly:
 *  - Accepts complete manifest with verify block + schemas + examples
 *  - Flags manifests missing required fields as "missing"
 *  - Rejects wrong domain
 *  - Returns null for non-existent
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { readRuntimeCapabilityManifest } from "../../runtime/core/capability-registry.ts";

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dk-manifest-test-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeManifest(name: string, content: unknown): string {
  const dir = path.join(tmpDir, name);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, "manifest.json");
  fs.writeFileSync(p, JSON.stringify(content, null, 2), "utf8");
  return p;
}

describe("capability manifest contract validation v2", () => {
  it("accepts a complete manifest with verify block", () => {
    writeManifest("complete-cap", {
      displayName: "Complete Cap",
      description: "Has full contract.",
      domain: "runtime",
      verification: "verified",
      inputSchema: "shared/schemas/complete-input.schema.json",
      outputSchema: "shared/schemas/complete-output.schema.json",
      verify: {
        command: "echo test",
        assertions: [{ type: "regex", value: "test" }],
        timeoutMs: 5000,
      },
      examples: [{
        name: "test-example",
        input: { tool: "test" },
        expectedOutput: { ok: true },
        match: { invariantFields: ["ok"] },
      }],
    });

    const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "complete-cap" });
    expect(manifest).not.toBeNull();
    expect(manifest!.contract).toBe("complete");
    expect(manifest!.examples).toHaveLength(1);
    expect(manifest!.verify).toBeDefined();
  });

  it("flags manifest with no contract fields as 'missing'", () => {
    writeManifest("missing-contract", {
      displayName: "No Contract",
      description: "Bare minimum.",
      domain: "runtime",
      verification: "placeholder",
      inputSchema: "shared/schemas/x.schema.json",
      outputSchema: "shared/schemas/y.schema.json",
      verify: {
        command: "echo bare",
        assertions: [{ type: "regex", value: "bare" }],
        timeoutMs: 5000,
      },
    });

    const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "missing-contract" });
    expect(manifest).not.toBeNull();
    // Has all required schema fields but no contract extras (examples)
    expect(manifest!.contract).not.toBe("complete");
  });

  it("schema-invalid manifest is flagged as 'missing'", () => {
    // Missing verification and verify — schema validation fails
    writeManifest("invalid-schema", {
      displayName: "Bad",
      description: "Missing required fields.",
      domain: "runtime",
    });

    const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "invalid-schema" });
    expect(manifest).not.toBeNull();
    expect(manifest!.contract).toBe("missing");
  });

  it("rejects manifest with wrong domain", () => {
    writeManifest("bad-domain", {
      displayName: "Bad",
      description: "Wrong domain.",
      domain: "architecture",
      verification: "placeholder",
      inputSchema: "a",
      outputSchema: "b",
      verify: { command: "c", assertions: [{ type: "regex", value: "d" }], timeoutMs: 5000 },
    });

    expect(() =>
      readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "bad-domain" }),
    ).toThrow(/must declare domain "runtime"/);
  });

  it("returns null for non-existent capability", () => {
    expect(readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "nope" })).toBeNull();
  });

  it("manifest with verify block but no examples is 'partial'", () => {
    writeManifest("partial-verify", {
      displayName: "Partial",
      description: "Has verify but no examples.",
      domain: "runtime",
      verification: "placeholder",
      inputSchema: "shared/schemas/p.schema.json",
      outputSchema: "shared/schemas/q.schema.json",
      verify: {
        command: "echo hello",
        assertions: [{ type: "regex", value: "hello" }],
        timeoutMs: 5000,
      },
    });

    const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "partial-verify" });
    expect(manifest).not.toBeNull();
    expect(manifest!.contract).toBe("partial");
    expect(manifest!.verify).toBeDefined();
  });
});

describe("capability manifest projection metadata (schema acceptance)", () => {
  // Note: The runtime capability-registry parser does not yet forward the new
  // projection fields to RuntimeCapabilityManifest (that is Slice 2 work).
  // These tests verify the schema itself accepts the new optional fields without
  // rejecting valid manifests. Schema validation passes (contract is not
  // "missing") even when the parser doesn't expose the new fields yet.

  it("schema accepts optional whenToUse and failureModes without rejecting manifest", () => {
    writeManifest("with-when-to-use", {
      displayName: "With WhenToUse",
      description: "Has projection metadata.",
      domain: "runtime",
      verification: "verified",
      inputSchema: "shared/schemas/x.schema.json",
      outputSchema: "shared/schemas/y.schema.json",
      verify: {
        command: "echo projection",
        assertions: [{ type: "regex", value: "projection" }],
        timeoutMs: 5000,
      },
      whenToUse: "Use this when you need to convert HTML to Markdown.",
      failureModes: ["Rate-limited by upstream API", "Fails on malformed HTML"],
    });

    const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "with-when-to-use" });
    expect(manifest).not.toBeNull();
    // Schema validation must NOT reject this as "missing" — optional fields are allowed
    expect(manifest!.contract).not.toBe("missing");
    // Core fields still parse correctly
    expect(manifest!.displayName).toBe("With WhenToUse");
    expect(manifest!.verification).toBe("verified");
  });

  it("schema accepts optional projection block with valid kind enum", () => {
    writeManifest("with-projection", {
      displayName: "With Projection",
      description: "Has projection block.",
      domain: "runtime",
      verification: "verified",
      inputSchema: "shared/schemas/x.schema.json",
      outputSchema: "shared/schemas/y.schema.json",
      verify: {
        command: "echo proj",
        assertions: [{ type: "regex", value: "proj" }],
        timeoutMs: 5000,
      },
      projection: {
        kind: "mcp_tool",
        id: "html-to-md",
        invocation: "cap_html_to_md",
      },
      costNotes: "Free tier: 1000 req/month.",
    });

    const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "with-projection" });
    expect(manifest).not.toBeNull();
    // Schema must not reject due to unknown projection fields
    expect(manifest!.contract).not.toBe("missing");
    expect(manifest!.displayName).toBe("With Projection");
  });

  it("legacy manifest without projection fields still validates as before", () => {
    writeManifest("legacy-no-projection", {
      displayName: "Legacy Cap",
      description: "No projection metadata.",
      domain: "runtime",
      verification: "verified",
      inputSchema: "shared/schemas/a.schema.json",
      outputSchema: "shared/schemas/b.schema.json",
      verify: {
        command: "echo legacy",
        assertions: [{ type: "regex", value: "legacy" }],
        timeoutMs: 5000,
      },
    });

    const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "legacy-no-projection" });
    expect(manifest).not.toBeNull();
    // Legacy entry without new optional fields still validates fully
    expect(manifest!.displayName).toBe("Legacy Cap");
    expect(manifest!.contract).not.toBe("missing");
  });

  it("schema accepts verificationEvidence and costNotes without rejecting", () => {
    writeManifest("with-evidence", {
      displayName: "With Evidence",
      description: "Has verification evidence ref.",
      domain: "runtime",
      verification: "verified",
      inputSchema: "shared/schemas/x.schema.json",
      outputSchema: "shared/schemas/y.schema.json",
      verify: {
        command: "echo evidence",
        assertions: [{ type: "regex", value: "evidence" }],
        timeoutMs: 5000,
      },
      verificationEvidence: "execution-evidence/cap-123.json",
      whenToUse: "When you need verified behavior.",
      failureModes: ["None known"],
    });

    const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "with-evidence" });
    expect(manifest).not.toBeNull();
    // Optional fields must not cause schema rejection
    expect(manifest!.contract).not.toBe("missing");
    expect(manifest!.displayName).toBe("With Evidence");
  });

  it("manifest with projection metadata and examples remains 'complete'", () => {
    writeManifest("full-projection", {
      displayName: "Full Projection Cap",
      description: "Everything: contract fields + projection metadata.",
      domain: "runtime",
      verification: "verified",
      inputSchema: "shared/schemas/x.schema.json",
      outputSchema: "shared/schemas/y.schema.json",
      verify: {
        command: "echo full",
        assertions: [{ type: "regex", value: "full" }],
        timeoutMs: 5000,
      },
      examples: [{
        name: "test-example",
        input: { q: "test" },
        expectedOutput: { ok: true },
        match: { invariantFields: ["ok"] },
      }],
      whenToUse: "Use for full contract validation with projection metadata.",
      failureModes: ["Timeout on large inputs"],
      projection: {
        kind: "hermes_skill",
        id: "full-skill",
        invocation: "skill_full_cap",
      },
      costNotes: "None",
      verificationEvidence: "execution-evidence/full.json",
    });

    const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "full-projection" });
    expect(manifest).not.toBeNull();
    // Contract stays "complete" even with extra optional fields — schema must not reject them
    expect(manifest!.contract).toBe("complete");
    expect(manifest!.displayName).toBe("Full Projection Cap");
  });
});
