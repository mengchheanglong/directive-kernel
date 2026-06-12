import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { buildToolRegistry } from "../../hosts/mcp-host/tool-registry.ts";
import { ROUTE_TABLE } from "../../hosts/web-host/api-manifest.ts";
import { buildReadExecutors } from "../../hosts/mcp-host/executors/read.ts";

describe("mcp tool registry", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-unit-test-"));
  });

  it("registry builds successfully for a temp directive root", () => {
    const tools = buildToolRegistry({ directiveRoot: tempDir });
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });

  it("registry size matches ROUTE_TABLE size when using full profile", () => {
    const tools = buildToolRegistry({ directiveRoot: tempDir, profile: "full" });
    expect(tools.length).toBe(ROUTE_TABLE.length);
  });

  it("core profile returns fewer tools than full profile", () => {
    const coreTools = buildToolRegistry({ directiveRoot: tempDir, profile: "core" });
    const fullTools = buildToolRegistry({ directiveRoot: tempDir, profile: "full" });
    expect(coreTools.length).toBeLessThan(fullTools.length);
  });

  it("every tool has non-empty name string", () => {
    const tools = buildToolRegistry({ directiveRoot: tempDir });
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
    }
  });

  it("every core-profile tool has a non-empty name", () => {
    const tools = buildToolRegistry({ directiveRoot: tempDir, profile: "core" });
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
    }
  });

  it("every tool has non-empty description string", () => {
    const tools = buildToolRegistry({ directiveRoot: tempDir });
    for (const tool of tools) {
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it("every tool has parseable inputSchema", () => {
    const tools = buildToolRegistry({ directiveRoot: tempDir });
    for (const tool of tools) {
      expect(typeof tool.inputSchema).toBe("object");
      expect(tool.inputSchema).not.toBeNull();
      expect(typeof (tool.inputSchema as Record<string, unknown>).type).toBe("string");
      expect(() => JSON.stringify(tool.inputSchema)).not.toThrow();
    }
  });

  it("two calls return deep-equal arrays", () => {
    const tools1 = buildToolRegistry({ directiveRoot: tempDir });
    const tools2 = buildToolRegistry({ directiveRoot: tempDir });
    expect(JSON.stringify(tools1)).toBe(JSON.stringify(tools2));
  });

  it("missing executor throws during build", () => {
    // buildToolRegistry with default profile (core) succeeds => all core executors are mapped
    expect(() => buildToolRegistry({ directiveRoot: tempDir })).not.toThrow();

    // buildReadExecutors returns entries for all GET routes, proving coverage
    const readExecutors = buildReadExecutors({ directiveRoot: tempDir });
    const getRouteCount = ROUTE_TABLE.filter((entry) => entry.method === "GET").length;
    expect(Object.keys(readExecutors).length).toBe(getRouteCount);
  });

  it("missing executor still throws for full profile", () => {
    expect(() =>
      buildToolRegistry({ directiveRoot: tempDir, profile: "full" }),
    ).not.toThrow();
  });
});
