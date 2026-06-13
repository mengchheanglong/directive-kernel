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
  deriveEntryClass,
  deriveProjectionReadiness,
  resolveProjectionKind,
  type RuntimeCapabilityManifest,
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

  it("returns all 3 capability metadata entries", () => {
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
      expect(cap.verification.length).toBeGreaterThan(0);
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

describe("metadata exposes Jarvis fields for shipped capabilities", () => {
  it("every capability has entryClass, projectionReady, and notUsableReason", () => {
    const capabilities = listRuntimeCapabilityMetadata();
    for (const cap of capabilities) {
      expect(cap.entryClass).toBeDefined();
      expect(typeof cap.projectionReady).toBe("boolean");
      // All shipped manifests are placeholder — none should be projectionReady
      expect(cap.projectionReady).toBe(false);
      expect(cap.notUsableReason).toBeDefined();
    }
  });

  it("claim/placeholder capabilities are never projectionReady", () => {
    const capabilities = listRuntimeCapabilityMetadata();
    for (const cap of capabilities) {
      if (cap.verification === "claimed" || cap.verification === "placeholder") {
        expect(cap.projectionReady).toBe(false);
      }
    }
  });

  it("shipped capabilities are honestly labeled as placeholder or candidate", () => {
    const capabilities = listRuntimeCapabilityMetadata();
    for (const cap of capabilities) {
      // All 3 shipped manifests are verification=placeholder, no projection
      // code-normalizer + literature-access + research-vault-source-pack should be placeholder
      expect(["placeholder", "candidate"]).toContain(cap.entryClass);
      // None should be projectionReady
      expect(cap.projectionReady).toBe(false);
    }
  });
});

describe("deriveEntryClass", () => {
  function makeManifest(overrides: Partial<RuntimeCapabilityManifest> = {}): RuntimeCapabilityManifest {
    return {
      displayName: "Test Cap",
      description: "Test.",
      domain: "runtime",
      ...overrides,
    };
  }

  it("verified + complete + valid projection metadata => verified_capability", () => {
    expect(deriveEntryClass(makeManifest({
      verification: "verified",
      contract: "complete",
      projection: { kind: "mcp_tool", id: "test", invocation: "cap_test" },
      whenToUse: "When you need to test.",
      failureModes: ["May timeout"],
    }))).toBe("verified_capability");
  });

  it("verified + complete but incomplete projection metadata => candidate", () => {
    expect(deriveEntryClass(makeManifest({
      verification: "verified",
      contract: "complete",
      projection: { kind: "mcp_tool", id: "test" },
      whenToUse: "When you need to test.",
      failureModes: ["May timeout"],
    }))).toBe("candidate");
  });

  it("verified but no projection => candidate", () => {
    expect(deriveEntryClass(makeManifest({
      verification: "verified",
      contract: "complete",
    }))).toBe("candidate");
  });

  it("claimed => candidate", () => {
    expect(deriveEntryClass(makeManifest({
      verification: "claimed",
    }))).toBe("candidate");
  });

  it("placeholder => placeholder", () => {
    expect(deriveEntryClass(makeManifest({
      verification: "placeholder",
    }))).toBe("placeholder");
  });

  it("no verification => placeholder (conservative default)", () => {
    expect(deriveEntryClass(makeManifest({}))).toBe("placeholder");
  });
});

describe("deriveProjectionReadiness", () => {
  function makeManifest(overrides: Partial<RuntimeCapabilityManifest> = {}): RuntimeCapabilityManifest {
    return {
      displayName: "Test Cap",
      description: "Test.",
      domain: "runtime",
      ...overrides,
    };
  }

  it("verified + complete + projection + whenToUse + failureModes => projectionReady", () => {
    const result = deriveProjectionReadiness(makeManifest({
      verification: "verified",
      contract: "complete",
      projection: { kind: "mcp_tool", id: "test", invocation: "cap_test" },
      whenToUse: "When you need to test.",
      failureModes: ["May timeout"],
    }));
    expect(result.projectionReady).toBe(true);
    expect(result.notUsableReason).toBeUndefined();
  });

  it("placeholder => not projectionReady", () => {
    const result = deriveProjectionReadiness(makeManifest({
      verification: "placeholder",
    }));
    expect(result.projectionReady).toBe(false);
    expect(result.notUsableReason).toContain("placeholder");
  });

  it("claimed => not projectionReady", () => {
    const result = deriveProjectionReadiness(makeManifest({
      verification: "claimed",
    }));
    expect(result.projectionReady).toBe(false);
    expect(result.notUsableReason).toContain("claimed");
  });

  it("verified but contract not complete => not projectionReady", () => {
    const result = deriveProjectionReadiness(makeManifest({
      verification: "verified",
      contract: "partial",
      projection: { kind: "mcp_tool", id: "test", invocation: "cap_test" },
      whenToUse: "test",
      failureModes: ["test"],
    }));
    expect(result.projectionReady).toBe(false);
    expect(result.notUsableReason).toContain("contract");
  });

  it("verified + complete but no projection => not projectionReady", () => {
    const result = deriveProjectionReadiness(makeManifest({
      verification: "verified",
      contract: "complete",
      whenToUse: "test",
      failureModes: ["test"],
    }));
    expect(result.projectionReady).toBe(false);
    expect(result.notUsableReason).toContain("projection");
  });

  it("verified + complete + projection but missing whenToUse => not projectionReady", () => {
    const result = deriveProjectionReadiness(makeManifest({
      verification: "verified",
      contract: "complete",
      projection: { kind: "mcp_tool", id: "test", invocation: "cap_test" },
      failureModes: ["test"],
    }));
    expect(result.projectionReady).toBe(false);
    expect(result.notUsableReason).toContain("whenToUse");
  });

  it("verified + complete + projection but empty failureModes => not projectionReady", () => {
    const result = deriveProjectionReadiness(makeManifest({
      verification: "verified",
      contract: "complete",
      projection: { kind: "mcp_tool", id: "test", invocation: "cap_test" },
      whenToUse: "test",
      failureModes: [],
    }));
    expect(result.projectionReady).toBe(false);
    expect(result.notUsableReason).toContain("failureModes");
  });

  it("verified + complete + projection but missing projection.id => not projectionReady", () => {
    const result = deriveProjectionReadiness(makeManifest({
      verification: "verified",
      contract: "complete",
      projection: { kind: "mcp_tool", invocation: "cap_test" },
      whenToUse: "test",
      failureModes: ["test"],
    }));
    expect(result.projectionReady).toBe(false);
    expect(result.notUsableReason).toContain("projection.id");
  });

  it("verified + complete + projection but missing invocation => not projectionReady", () => {
    const result = deriveProjectionReadiness(makeManifest({
      verification: "verified",
      contract: "complete",
      projection: { kind: "mcp_tool", id: "test" },
      whenToUse: "test",
      failureModes: ["test"],
    }));
    expect(result.projectionReady).toBe(false);
    expect(result.notUsableReason).toContain("projection.invocation");
  });

  it("verified + complete + projection but invalid kind => not projectionReady", () => {
    const result = deriveProjectionReadiness(makeManifest({
      verification: "verified",
      contract: "complete",
      projection: { kind: "invalid_kind", id: "test", invocation: "cap_test" },
      whenToUse: "test",
      failureModes: ["test"],
    }));
    expect(result.projectionReady).toBe(false);
    expect(result.notUsableReason).toContain("projection.kind");
  });
});

describe("resolveProjectionKind", () => {
  function makeManifest(kind?: string): RuntimeCapabilityManifest {
    return {
      displayName: "Test",
      description: "Test.",
      domain: "runtime",
      ...(kind ? { projection: { kind } } : {}),
    };
  }

  it("returns valid kind", () => {
    expect(resolveProjectionKind(makeManifest("mcp_tool"))).toBe("mcp_tool");
    expect(resolveProjectionKind(makeManifest("hermes_skill"))).toBe("hermes_skill");
    expect(resolveProjectionKind(makeManifest("cli_wrapper"))).toBe("cli_wrapper");
  });

  it("returns undefined for invalid kind", () => {
    expect(resolveProjectionKind(makeManifest("invalid_kind"))).toBeUndefined();
  });

  it("returns undefined when no projection", () => {
    expect(resolveProjectionKind(makeManifest())).toBeUndefined();
  });
});
