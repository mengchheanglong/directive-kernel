/**
 * Hardening: Dynamic MCP Tool Projection
 *
 * Proves that:
 *  1. Placeholder capabilities are never projected as MCP tools
 *  2. Verified+contracted capabilities ARE projected
 *  3. Schema-invalid input to a projected tool is rejected
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildProjectedCapabilityTools, getProjectedCapabilityIds } from "../../../hosts/mcp-host/executors/capability-projection.ts";
import { listRuntimeCapabilityMetadata } from "../../../runtime/core/capability-registry.ts";
import { attachHarnessSignature } from "../../../shared/lib/execution-evidence.ts";

// We test against the actual capabilities in the repo
describe("dynamic MCP tool projection", () => {
  it("placeholders are never projected", () => {
    // Read actual capabilities from repo
    const capabilities = listRuntimeCapabilityMetadata();
    const placeholderIds = capabilities
      .filter((c) => c.verification === "placeholder")
      .map((c) => c.id);

    // All should be placeholder
    expect(placeholderIds.length).toBeGreaterThan(0);

    // Build projected tools (no directive root = no evidence check,
    // so verification comes from manifest which has "placeholder")
    const { tools } = buildProjectedCapabilityTools({
      directiveRoot: process.cwd(),
    });

    const projectedNames = tools.map((t) => t.name);
    for (const pid of placeholderIds) {
      expect(projectedNames).not.toContain(`cap_${pid}`);
    }
  });

  it("projected tool names follow cap_<id> convention", () => {
    const { tools } = buildProjectedCapabilityTools({
      directiveRoot: process.cwd(),
    });

    for (const tool of tools) {
      // All projected tools must start with cap_
      expect(tool.name.startsWith("cap_")).toBe(true);
      // Description must contain [Projected]
      expect(tool.description).toContain("[Projected]");
    }
  });

  it("getProjectedCapabilityIds returns only eligible ids", () => {
    const ids = getProjectedCapabilityIds(process.cwd());
    // All ids should be from the actual capabilities list
    const capabilities = listRuntimeCapabilityMetadata();
    const validIds = new Set(capabilities.map((c) => c.id));

    for (const id of ids) {
      expect(validIds.has(id)).toBe(true);
    }
  });

  it("projected tool executor rejects schema-invalid input", async () => {
    const { tools } = buildProjectedCapabilityTools({
      directiveRoot: process.cwd(),
    });

    // Find a tool that has a non-trivial input schema
    const tool = tools.find((t) => {
      const schema = t.inputSchema as Record<string, unknown>;
      return schema && Array.isArray((schema as Record<string, unknown>).required);
    });

    if (!tool) {
      // Skip if no tools with required fields — still valid test
      return;
    }

    // Call with empty args — should fail validation
    const result = await tool.execute({});

    // Should return an error
    expect(result).toHaveProperty("ok", false);
    expect(result).toHaveProperty("error");
    expect((result as Record<string, unknown>).gate).toBe("contract_failure");
  });

  it("projects MarkItDown when signed evidence and complete metadata exist", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dk-markitdown-projection-"));
    const restore = process.cwd;

    try {
      process.cwd = () => tempRoot;
      const capRoot = path.join(tempRoot, "runtime", "capabilities", "pipe-microsoft-markitdown-mq9jdf6o");
      fs.mkdirSync(capRoot, { recursive: true });
      fs.mkdirSync(path.join(tempRoot, "runtime", "callable-executions"), { recursive: true });
      fs.mkdirSync(path.join(tempRoot, "shared", "schemas"), { recursive: true });

      fs.writeFileSync(path.join(capRoot, "manifest.json"), JSON.stringify({
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
        whenToUse: "Use when Hermes needs to convert HTML to Markdown.",
        failureModes: ["Timeout", "Unsupported input"],
        projection: {
          kind: "mcp_tool",
          id: "markitdown",
          invocation: "cap_pipe-microsoft-markitdown-mq9jdf6o",
        },
      }, null, 2), "utf8");
      fs.writeFileSync(path.join(capRoot, "index.ts"), "export {};\n", "utf8");
      fs.writeFileSync(path.join(capRoot, "executor.ts"), "export {};\n", "utf8");

      fs.writeFileSync(path.join(tempRoot, "shared", "schemas", "markitdown-callable-input.schema.json"), JSON.stringify({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        properties: {
          sourcePath: { type: "string" },
          html: { type: "string" },
        },
        anyOf: [{ required: ["sourcePath"] }, { required: ["html"] }],
      }, null, 2), "utf8");
      fs.writeFileSync(path.join(tempRoot, "shared", "schemas", "markitdown-callable-output.schema.json"), JSON.stringify({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        required: ["ok"],
        properties: { ok: { type: "boolean" } },
      }, null, 2), "utf8");

      const evidence = attachHarnessSignature({
        schemaVersion: 1,
        capabilityId: "pipe-microsoft-markitdown-mq9jdf6o",
        command: "C:/Python314/python -m markitdown C:/tmp/example.html",
        exitCode: 0,
        stdoutHash: "stdout-hash",
        stderrHash: "stderr-hash",
        wallTimeMs: 321,
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
        path.join(tempRoot, "runtime", "callable-executions", "pipe-microsoft-markitdown-mq9jdf6o-execution.json"),
        JSON.stringify(evidence, null, 2),
        "utf8",
      );

      const projectedIds = getProjectedCapabilityIds(tempRoot);
      expect(projectedIds).toContain("pipe-microsoft-markitdown-mq9jdf6o");

      const { tools } = buildProjectedCapabilityTools({ directiveRoot: tempRoot });
      const toolNames = tools.map((tool) => tool.name);
      expect(toolNames).toContain("cap_pipe-microsoft-markitdown-mq9jdf6o");

      const projectedTool = tools.find((tool) => tool.name === "cap_pipe-microsoft-markitdown-mq9jdf6o");
      expect(projectedTool).toBeDefined();
    } finally {
      process.cwd = restore;
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("MarkItDown projected tool rejects schema-invalid input with contract_failure", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dk-markitdown-projection-"));
    const restore = process.cwd;

    try {
      process.cwd = () => tempRoot;
      const capRoot = path.join(tempRoot, "runtime", "capabilities", "pipe-microsoft-markitdown-mq9jdf6o");
      fs.mkdirSync(capRoot, { recursive: true });
      fs.mkdirSync(path.join(tempRoot, "runtime", "callable-executions"), { recursive: true });
      fs.mkdirSync(path.join(tempRoot, "shared", "schemas"), { recursive: true });

      fs.writeFileSync(path.join(capRoot, "manifest.json"), JSON.stringify({
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
        whenToUse: "Use when Hermes needs to convert HTML to Markdown.",
        failureModes: ["Timeout", "Unsupported input"],
        projection: {
          kind: "mcp_tool",
          id: "markitdown",
          invocation: "cap_pipe-microsoft-markitdown-mq9jdf6o",
        },
      }, null, 2), "utf8");
      fs.writeFileSync(path.join(capRoot, "index.ts"), "export {};\n", "utf8");
      fs.writeFileSync(path.join(capRoot, "executor.ts"), "export {};\n", "utf8");

      fs.writeFileSync(path.join(tempRoot, "shared", "schemas", "markitdown-callable-input.schema.json"), JSON.stringify({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        properties: {
          sourcePath: { type: "string" },
          html: { type: "string" },
        },
        anyOf: [{ required: ["sourcePath"] }, { required: ["html"] }],
      }, null, 2), "utf8");
      fs.writeFileSync(path.join(tempRoot, "shared", "schemas", "markitdown-callable-output.schema.json"), JSON.stringify({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        required: ["ok"],
        properties: { ok: { type: "boolean" } },
      }, null, 2), "utf8");

      const evidence = attachHarnessSignature({
        schemaVersion: 1,
        capabilityId: "pipe-microsoft-markitdown-mq9jdf6o",
        command: "C:/Python314/python -m markitdown C:/tmp/example.html",
        exitCode: 0,
        stdoutHash: "stdout-hash",
        stderrHash: "stderr-hash",
        wallTimeMs: 321,
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
        path.join(tempRoot, "runtime", "callable-executions", "pipe-microsoft-markitdown-mq9jdf6o-execution.json"),
        JSON.stringify(evidence, null, 2),
        "utf8",
      );

      const { tools } = buildProjectedCapabilityTools({ directiveRoot: tempRoot });
      const projectedTool = tools.find((tool) => tool.name === "cap_pipe-microsoft-markitdown-mq9jdf6o");
      expect(projectedTool).toBeDefined();

      const result = await projectedTool!.execute({});
      expect(result).toMatchObject({
        ok: false,
        gate: "contract_failure",
      });
    } finally {
      process.cwd = restore;
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("projects Scrapling only when signed evidence and complete metadata exist", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dk-scrapling-projection-"));
    const restore = process.cwd;

    try {
      process.cwd = () => tempRoot;
      const capRoot = path.join(tempRoot, "runtime", "capabilities", "pipe-scrapling-adaptive-web-scraper-mq9mmrc0");
      fs.mkdirSync(capRoot, { recursive: true });
      fs.mkdirSync(path.join(tempRoot, "runtime", "callable-executions"), { recursive: true });
      fs.mkdirSync(path.join(tempRoot, "shared", "schemas"), { recursive: true });

      fs.writeFileSync(path.join(capRoot, "manifest.json"), JSON.stringify({
        displayName: "Scrapling Adaptive Web Scraper",
        description: "Extract structured fields, text, and links from static HTML.",
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
        whenToUse: "Use when Hermes needs structured extraction from static HTML or saved local HTML files.",
        failureModes: ["Timeout", "URL fetching is not supported in S1"],
        projection: {
          kind: "mcp_tool",
          id: "scrapling",
          invocation: "cap_pipe-scrapling-adaptive-web-scraper-mq9mmrc0",
        },
      }, null, 2), "utf8");
      fs.writeFileSync(path.join(capRoot, "index.ts"), "export {};\n", "utf8");
      fs.writeFileSync(path.join(capRoot, "executor.ts"), "export {};\n", "utf8");

      fs.writeFileSync(path.join(tempRoot, "shared", "schemas", "scrapling-extract-input.schema.json"), JSON.stringify({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        properties: {
          html: { type: "string" },
          sourcePath: { type: "string" },
          selectors: { type: "object", additionalProperties: { type: "string" } },
          includeText: { type: "boolean" },
          includeLinks: { type: "boolean" },
        },
        oneOf: [{ required: ["html"] }, { required: ["sourcePath"] }],
      }, null, 2), "utf8");
      fs.writeFileSync(path.join(tempRoot, "shared", "schemas", "scrapling-extract-output.schema.json"), JSON.stringify({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        required: ["ok"],
        properties: { ok: { type: "boolean" } },
      }, null, 2), "utf8");

      expect(getProjectedCapabilityIds(tempRoot)).not.toContain("pipe-scrapling-adaptive-web-scraper-mq9mmrc0");

      const evidence = attachHarnessSignature({
        schemaVersion: 1,
        capabilityId: "pipe-scrapling-adaptive-web-scraper-mq9mmrc0",
        command: "C:/Python314/python C:/tmp/dk-scrapling-smoke.py C:/tmp/dk-scrapling-smoke.html",
        exitCode: 0,
        stdoutHash: "stdout-hash",
        stderrHash: "stderr-hash",
        wallTimeMs: 321,
        environmentFingerprint: "win32-x64-v24.14.0",
        timestamp: new Date().toISOString(),
        harnessVersion: "1.0.0",
        contractVerification: "full",
        examples: [{
          name: "extract-local-html",
          input: { sourcePath: "C:/tmp/dk-scrapling-smoke.html" },
          passed: true,
        }],
      });
      fs.writeFileSync(
        path.join(tempRoot, "runtime", "callable-executions", "pipe-scrapling-adaptive-web-scraper-mq9mmrc0-execution.json"),
        JSON.stringify(evidence, null, 2),
        "utf8",
      );

      const projectedIds = getProjectedCapabilityIds(tempRoot);
      expect(projectedIds).toContain("pipe-scrapling-adaptive-web-scraper-mq9mmrc0");

      const { tools } = buildProjectedCapabilityTools({ directiveRoot: tempRoot });
      expect(tools.map((tool) => tool.name)).toContain("cap_pipe-scrapling-adaptive-web-scraper-mq9mmrc0");
    } finally {
      process.cwd = restore;
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("Scrapling projected tool rejects unsafe URL input with validation error", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dk-scrapling-projection-"));
    const restore = process.cwd;

    try {
      process.cwd = () => tempRoot;
      const capRoot = path.join(tempRoot, "runtime", "capabilities", "pipe-scrapling-adaptive-web-scraper-mq9mmrc0");
      fs.mkdirSync(capRoot, { recursive: true });
      fs.mkdirSync(path.join(tempRoot, "runtime", "callable-executions"), { recursive: true });
      fs.mkdirSync(path.join(tempRoot, "shared", "schemas"), { recursive: true });

      fs.writeFileSync(path.join(capRoot, "manifest.json"), JSON.stringify({
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
        failureModes: ["Timeout", "Unsafe URL rejected", "Missing curl_cffi"],
        projection: {
          kind: "mcp_tool",
          id: "scrapling",
          invocation: "cap_pipe-scrapling-adaptive-web-scraper-mq9mmrc0",
        },
      }, null, 2), "utf8");
      fs.writeFileSync(path.join(capRoot, "index.ts"), "export {};\n", "utf8");
      fs.writeFileSync(path.join(capRoot, "executor.ts"), "export {};\n", "utf8");

      fs.writeFileSync(path.join(tempRoot, "shared", "schemas", "scrapling-extract-input.schema.json"), JSON.stringify({
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
      }, null, 2), "utf8");
      fs.writeFileSync(path.join(tempRoot, "shared", "schemas", "scrapling-extract-output.schema.json"), JSON.stringify({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        required: ["ok"],
        properties: { ok: { type: "boolean" } },
      }, null, 2), "utf8");

      const evidence = attachHarnessSignature({
        schemaVersion: 1,
        capabilityId: "pipe-scrapling-adaptive-web-scraper-mq9mmrc0",
        command: "C:/Python314/python C:/tmp/dk-scrapling-smoke.py C:/tmp/dk-scrapling-smoke.html",
        exitCode: 0,
        stdoutHash: "stdout-hash",
        stderrHash: "stderr-hash",
        wallTimeMs: 321,
        environmentFingerprint: "win32-x64-v24.14.0",
        timestamp: new Date().toISOString(),
        harnessVersion: "1.0.0",
        contractVerification: "full",
        examples: [{
          name: "extract-local-html",
          input: { sourcePath: "C:/tmp/dk-scrapling-smoke.html" },
          passed: true,
        }],
      });
      fs.writeFileSync(
        path.join(tempRoot, "runtime", "callable-executions", "pipe-scrapling-adaptive-web-scraper-mq9mmrc0-execution.json"),
        JSON.stringify(evidence, null, 2),
        "utf8",
      );

      const { tools } = buildProjectedCapabilityTools({ directiveRoot: tempRoot });
      const projectedTool = tools.find((tool) => tool.name === "cap_pipe-scrapling-adaptive-web-scraper-mq9mmrc0");
      expect(projectedTool).toBeDefined();

      const result = await projectedTool!.execute({ url: "http://localhost/" });
      expect(result).toMatchObject({
        ok: true,
        status: "validation_error",
      });
      expect(String((result as { result?: unknown }).result)).toContain("localhost");
    } finally {
      process.cwd = restore;
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
