import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildRuntimeCapabilityScaffold,
  readRuntimeCapabilityManifest,
  listRuntimeCapabilityMetadata,
  normalizeRuntimeCapabilityId,
  writeRuntimeCapabilityScaffold,
} from "../../runtime/core/capability-registry.ts";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(String(tempDirs.pop()), { recursive: true, force: true });
  }
});

describe("listRuntimeCapabilityMetadata", () => {
  it("reads manifest-backed metadata for shipped capabilities", () => {
    const manifest = readRuntimeCapabilityManifest({ id: "code-normalizer" });
    expect(manifest).not.toBeNull();
    expect(manifest?.displayName).toBe("Code Normalizer");
    expect(manifest?.domain).toBe("runtime");
  });

  it("returns exactly 3 capabilities", () => {
    const capabilities = listRuntimeCapabilityMetadata();
    expect(capabilities.length).toBe(3);
  });

  it("IDs match the three existing capability folders", () => {
    const capabilities = listRuntimeCapabilityMetadata();
    const ids = capabilities.map((c) => c.id);
    expect(ids).toContain("code-normalizer");
    expect(ids).toContain("literature-access");
    expect(ids).toContain("research-vault-source-pack");
  });

  it("entries are sorted by id", () => {
    const capabilities = listRuntimeCapabilityMetadata();
    const ids = capabilities.map((c) => c.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("IDs are unique", () => {
    const capabilities = listRuntimeCapabilityMetadata();
    const ids = capabilities.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("metadata fields are non-empty", () => {
    const capabilities = listRuntimeCapabilityMetadata();
    for (const cap of capabilities) {
      expect(cap.id.length).toBeGreaterThan(0);
      expect(cap.displayName.length).toBeGreaterThan(0);
      expect(cap.description.length).toBeGreaterThan(0);
      expect(cap.modulePath.length).toBeGreaterThan(0);
    }
  });
});

describe("runtime capability scaffold", () => {
  it("normalizes capability ids into kebab-case", () => {
    expect(normalizeRuntimeCapabilityId("  My New Capability  ")).toBe("my-new-capability");
  });

  it("builds manifest and source files for a scaffold", () => {
    const scaffold = buildRuntimeCapabilityScaffold({
      name: "My Capability",
      description: "Bounded capability scaffold.",
    });

    expect(scaffold.id).toBe("my-capability");
    expect(scaffold.files.map((file) => file.relativePath)).toEqual([
      "my-capability/manifest.json",
      "my-capability/index.ts",
      "my-capability/executor.ts",
    ]);
    expect(scaffold.files[0]?.content).toContain("\"displayName\": \"My Capability\"");
    expect(scaffold.files[0]?.content).toContain("\"domain\": \"runtime\"");
    expect(scaffold.files[2]?.content).toContain("not_implemented: scaffolded capability executor");
  });

  it("writes scaffold files to disk", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "directive-capability-scaffold-"));
    tempDirs.push(tempRoot);

    const result = writeRuntimeCapabilityScaffold({
      capabilitiesRoot: tempRoot,
      name: "Example Capability",
      description: "Example scaffold description.",
    });

    expect(result.capabilityRoot).toBe(path.join(tempRoot, "example-capability"));
    expect(fs.existsSync(path.join(result.capabilityRoot, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(result.capabilityRoot, "index.ts"))).toBe(true);
    expect(fs.existsSync(path.join(result.capabilityRoot, "executor.ts"))).toBe(true);
  });
});
