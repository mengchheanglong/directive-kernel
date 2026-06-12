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
