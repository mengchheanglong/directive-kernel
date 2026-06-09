import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFederationSnapshot, resolveFederationConfigPath } from "../../hosts/web-host/federation.ts";

function writeFederationConfig(
  directiveRoot: string,
  body: Record<string, unknown>,
) {
  fs.mkdirSync(directiveRoot, { recursive: true });
  fs.writeFileSync(
    resolveFederationConfigPath(directiveRoot),
    `${JSON.stringify(body, null, 2)}\n`,
    "utf8",
  );
}

describe("federation snapshot helper", () => {
  const originalFetch = global.fetch;
  const envName = "DIRECTIVE_KERNEL_FEDERATION_TEST_TOKEN";

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env[envName];
  });

  it("returns configured false when no federation config exists", async () => {
    const directiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), "directive-kernel-federation-none-"));

    try {
      const result = await readFederationSnapshot(directiveRoot);
      expect(result.configured).toBe(false);
      expect(result.roots).toEqual([]);
      expect(result.summary.totalRoots).toBe(0);
    } finally {
      fs.rmSync(directiveRoot, { recursive: true, force: true });
    }
  });

  it("applies static bearer auth from env-backed config and aggregates remote reads", async () => {
    const directiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), "directive-kernel-federation-auth-"));
    process.env[envName] = "test-token";

    writeFederationConfig(directiveRoot, {
      roots: [
        {
          name: "team-beta",
          url: "http://127.0.0.1:9102",
          auth: {
            mode: "static_bearer",
            bearerTokenEnvName: envName,
          },
        },
      ],
    });

    const seenHeaders: string[] = [];
    global.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      const headers = new Headers(init?.headers);
      seenHeaders.push(headers.get("authorization") ?? "");

      const body = url.endsWith("/api/snapshot")
        ? { queue: { totalEntries: 2 }, engineRuns: { totalRuns: 3 } }
        : url.endsWith("/api/operator-decision-inbox")
          ? { summary: { totalActionableEntries: 4 } }
          : { ok: true, storage: { totalBytes: 100 } };

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const result = await readFederationSnapshot(directiveRoot);
      expect(result.configured).toBe(true);
      expect(result.roots).toHaveLength(1);
      expect(result.roots[0]?.authMode).toBe("static_bearer");
      expect(result.roots[0]?.ok).toBe(true);
      expect(result.summary.totalQueueEntries).toBe(2);
      expect(result.summary.totalEngineRuns).toBe(3);
      expect(result.summary.totalActionableInboxEntries).toBe(4);
      expect(seenHeaders).toEqual([
        "Bearer test-token",
        "Bearer test-token",
        "Bearer test-token",
      ]);
    } finally {
      fs.rmSync(directiveRoot, { recursive: true, force: true });
    }
  });
});
