import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as http from "node:http";

const HOST = "127.0.0.1";
const PORT = 18787;

let serverHandle: { close(): Promise<void> } | null = null;

beforeAll(async () => {
  const { startDirectiveUiServer } = await import("../../hosts/web-host/server.ts");
  const root = process.cwd();
  const handle = await startDirectiveUiServer({
    directiveRoot: root,
    host: HOST,
    port: PORT,
  });
  serverHandle = handle;
}, 30000);

afterAll(async () => {
  if (serverHandle) {
    await serverHandle.close();
  }
});

function fetchPage(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(`http://${HOST}:${PORT}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

describe("dashboard readonly surface", () => {
  it("has zero mutation paths in the rendered page html", async () => {
    const html = await fetchPage("/");

    // No <form method="POST"> — case-insensitive
    expect(/<form[^>]*method\s*=\s*["']?post["']?/i.test(html)).toBe(false);

    // No inline fetch with POST method
    expect(/fetch\s*\([^)]*method\s*:\s*["']?post["']?/i.test(html)).toBe(false);
  });

  it("contains the read-only dashboard banner in the client bundle", async () => {
    const html = await fetchPage("/");

    const scriptMatch = html.match(/src=["'](\/assets\/[^"']+\.js)["']/);
    if (!scriptMatch) {
      throw new Error("No script bundle found in dashboard HTML");
    }

    const bundle = await fetchPage(scriptMatch[1]);

    // Mutation_Boundary_Note: read-only shell statement
    expect(bundle).toContain("read-only and lane-aware");

    // Mutation_Boundary_Note: references the standalone host CLI surface
    expect(bundle).toContain("standalone-host");
  });
});
