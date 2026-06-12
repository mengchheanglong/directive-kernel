/**
 * Unit tests: Capability Manifest Contract Validation
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

describe("capability manifest contract validation", () => {
  it("accepts a complete manifest (inputSchema + outputSchema + examples)", () => {
    writeManifest("complete-cap", {
      displayName: "Complete Cap",
      description: "Has full contract.",
      domain: "runtime",
      inputSchema: "shared/schemas/complete-input.schema.json",
      outputSchema: "shared/schemas/complete-output.schema.json",
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
  });

  it("flags manifest with no contract fields as 'missing'", () => {
    writeManifest("missing-contract", {
      displayName: "No Contract",
      description: "Bare minimum.",
      domain: "runtime",
    });

    const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "missing-contract" });
    expect(manifest).not.toBeNull();
    expect(manifest!.contract).toBe("missing");
  });

  it("flags manifest with inputSchema only as 'partial'", () => {
    writeManifest("partial-input", {
      displayName: "Partial",
      description: "Has input only.",
      domain: "runtime",
      inputSchema: "shared/schemas/in.schema.json",
    });

    const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "partial-input" });
    expect(manifest).not.toBeNull();
    expect(manifest!.contract).toBe("partial");
  });

  it("flags manifest with schemas but no examples as 'partial'", () => {
    writeManifest("partial-no-examples", {
      displayName: "Partial",
      description: "Has schemas but no examples.",
      domain: "runtime",
      inputSchema: "shared/schemas/in.schema.json",
      outputSchema: "shared/schemas/out.schema.json",
    });

    const manifest = readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "partial-no-examples" });
    expect(manifest).not.toBeNull();
    expect(manifest!.contract).toBe("partial");
  });

  it("rejects manifest with wrong domain", () => {
    writeManifest("bad-domain", {
      displayName: "Bad",
      description: "Wrong domain.",
      domain: "architecture",
    });

    expect(() =>
      readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "bad-domain" }),
    ).toThrow(/must declare domain "runtime"/);
  });

  it("returns null for non-existent capability", () => {
    expect(readRuntimeCapabilityManifest({ capabilitiesRoot: tmpDir, id: "nope" })).toBeNull();
  });
});
