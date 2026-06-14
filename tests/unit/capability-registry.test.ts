import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { attachHarnessSignature } from "../../shared/lib/execution-evidence.ts";
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

  it("returns all 7 capability metadata entries", () => {
    const capabilities = listRuntimeCapabilityMetadata();
    expect(capabilities.length).toBe(7);
  });

  it("IDs match the existing capability folders", () => {
    const capabilities = listRuntimeCapabilityMetadata();
    const ids = capabilities.map((c) => c.id);
    expect(ids).toContain("code-normalizer");
    expect(ids).toContain("dw-source-scientify-research-workflow-plugin-2026-03-27");
    expect(ids).toContain("literature-access");
    expect(ids).toContain("research-vault-source-pack");
    expect(ids).toContain("pipe-crawl4ai-mqdt9lfs");
    expect(ids).toContain("pipe-microsoft-markitdown-mq9jdf6o");
    expect(ids).toContain("pipe-scrapling-adaptive-web-scraper-mq9mmrc0");
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
      if (!cap.projectionReady) {
        expect(cap.notUsableReason).toBeDefined();
      }
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

  it("shipped capabilities are honestly labeled by readiness state", () => {
    const capabilities = listRuntimeCapabilityMetadata();
    for (const cap of capabilities) {
      expect(["placeholder", "candidate", "verified_capability"]).toContain(cap.entryClass);
      if (
        cap.id !== "pipe-microsoft-markitdown-mq9jdf6o"
        && cap.id !== "pipe-scrapling-adaptive-web-scraper-mq9mmrc0"
        && cap.id !== "pipe-crawl4ai-mqdt9lfs"
        && cap.id !== "dw-source-scientify-research-workflow-plugin-2026-03-27"
      ) {
        expect(cap.projectionReady).toBe(false);
      }
    }
  });
});

describe("effective verification uses signed evidence when directiveRoot is provided", () => {
  function writeCapability(tempRoot: string, manifest: Record<string, unknown>) {
    const capabilityRoot = path.join(tempRoot, "runtime", "capabilities", "pipe-microsoft-markitdown-mq9jdf6o");
    fs.mkdirSync(capabilityRoot, { recursive: true });
    fs.mkdirSync(path.join(tempRoot, "runtime", "callable-executions"), { recursive: true });
    fs.writeFileSync(path.join(capabilityRoot, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    fs.writeFileSync(path.join(capabilityRoot, "index.ts"), "export {};\n", "utf8");
    fs.writeFileSync(path.join(capabilityRoot, "executor.ts"), "export {};\n", "utf8");
  }

  function writeSignedEvidence(tempRoot: string, exitCode = 0) {
    const evidence = attachHarnessSignature({
      schemaVersion: 1,
      capabilityId: "pipe-microsoft-markitdown-mq9jdf6o",
      command: "C:/Python314/python -m markitdown C:/tmp/example.html",
      exitCode,
      stdoutHash: "stdout-hash",
      stderrHash: "stderr-hash",
      wallTimeMs: 123,
      environmentFingerprint: "win32-x64-v24.14.0",
      timestamp: new Date().toISOString(),
      harnessVersion: "1.0.0",
      contractVerification: "full",
      examples: [{
        name: "convert-inline-html",
        input: { html: "<h1>Hello DK</h1>" },
        passed: exitCode === 0,
      }],
    });
    fs.writeFileSync(
      path.join(tempRoot, "runtime", "callable-executions", "pipe-microsoft-markitdown-mq9jdf6o-execution.json"),
      JSON.stringify(evidence, null, 2),
      "utf8",
    );
  }

  it("does not become projection-ready without signed evidence even if the manifest says verified", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "directive-markitdown-registry-"));
    tempDirs.push(tempRoot);
    const restore = process.cwd;

    try {
      process.cwd = () => tempRoot;
      writeCapability(tempRoot, {
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
        whenToUse: "Convert HTML into Markdown.",
        failureModes: ["Timeout"],
        projection: {
          kind: "mcp_tool",
          id: "markitdown",
          invocation: "cap_pipe-microsoft-markitdown-mq9jdf6o",
        },
      });

      const [metadata] = listRuntimeCapabilityMetadata(tempRoot)
        .filter((capability) => capability.id === "pipe-microsoft-markitdown-mq9jdf6o");
      expect(metadata).toBeDefined();
      expect(metadata.verification).toBe("placeholder");
      expect(metadata.entryClass).toBe("placeholder");
      expect(metadata.projectionReady).toBe(false);
    } finally {
      process.cwd = restore;
    }
  });

  it("becomes projection-ready with signed contract-grade evidence and complete metadata", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "directive-markitdown-registry-"));
    tempDirs.push(tempRoot);
    const restore = process.cwd;

    try {
      process.cwd = () => tempRoot;
      writeCapability(tempRoot, {
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
        whenToUse: "Convert HTML into Markdown for Hermes workflows.",
        failureModes: ["Timeout", "Unsupported input"],
        projection: {
          kind: "mcp_tool",
          id: "markitdown",
          invocation: "cap_pipe-microsoft-markitdown-mq9jdf6o",
        },
      });
      writeSignedEvidence(tempRoot);

      const [metadata] = listRuntimeCapabilityMetadata(tempRoot)
        .filter((capability) => capability.id === "pipe-microsoft-markitdown-mq9jdf6o");
      expect(metadata).toBeDefined();
      expect(metadata.verification).toBe("verified");
      expect(metadata.entryClass).toBe("verified_capability");
      expect(metadata.projectionReady).toBe(true);
      expect(metadata.whenToUse).toContain("Hermes");
    } finally {
      process.cwd = restore;
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
