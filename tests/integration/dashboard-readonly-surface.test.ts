import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as http from "node:http";
import { execFileSync } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = 18787;

let serverHandle: { close(): Promise<void> } | null = null;

beforeAll(async () => {
  if (process.platform === "win32") {
    execFileSync("cmd.exe", ["/d", "/s", "/c", "pnpm --filter @directive/kernel-ui build"], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
  } else {
    execFileSync("sh", ["-lc", "pnpm --filter @directive/kernel-ui build"], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
  }

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

describe("dashboard workbench surface", () => {
  it("ships the app shell without server-side POST forms", async () => {
    const html = await fetchPage("/");

    expect(/<form[^>]*method\s*=\s*["']?post["']?/i.test(html)).toBe(false);
    expect(/fetch\s*\([^)]*method\s*:\s*["']?post["']?/i.test(html)).toBe(false);
  });

  it("contains bounded workbench mutations in the client bundle", async () => {
    const html = await fetchPage("/");

    const scriptMatch = html.match(/src=["'](\/assets\/[^"']+\.js)["']/);
    if (!scriptMatch) {
      const hasWorkbenchMarker =
        /bounded operator workbench|Open inbox|Workflow map/i.test(html);
      if (!hasWorkbenchMarker) {
        throw new Error(
          "Neither script bundle nor workbench marker found in dashboard HTML",
        );
      }
      return;
    }

    const bundle = await fetchPage(scriptMatch[1]);

    expect(bundle).toContain("Approve Mission Evolution");
    expect(bundle).toContain("Record Runtime Host Selection");
    expect(bundle).toContain("Submit through front door");
    expect(bundle).toContain(
      "This shell stays lane-aware while exposing bounded mutations through kernel-owned routes.",
    );
    expect(bundle).not.toContain("This is a read-only view. State mutations live in the CLI:");
    expect(bundle).not.toContain("read-only and lane-aware");
  });
});
