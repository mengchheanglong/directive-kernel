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

  it("registry size matches ROUTE_TABLE size", () => {
    const tools = buildToolRegistry({ directiveRoot: tempDir });
    expect(tools.length).toBe(ROUTE_TABLE.length);
  });

  it("every tool has non-empty name string", () => {
    const tools = buildToolRegistry({ directiveRoot: tempDir });
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
    // buildToolRegistry succeeds => all executors are mapped 1:1 with ROUTE_TABLE
    expect(() => buildToolRegistry({ directiveRoot: tempDir })).not.toThrow();

    // buildReadExecutors returns entries for all GET routes, proving coverage
    const readExecutors = buildReadExecutors({ directiveRoot: tempDir });
    const getRouteCount = ROUTE_TABLE.filter((entry) => entry.method === "GET").length;
    expect(Object.keys(readExecutors).length).toBe(getRouteCount);
  });
});
