import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HOST = "127.0.0.1";

let origin = "";
let closeServer: (() => Promise<void>) | null = null;

function fetchJson(pathname: string): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: unknown;
}> {
  return new Promise((resolve, reject) => {
    const request = http.get(`${origin}${pathname}`, (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          headers: response.headers,
          body: JSON.parse(data),
        });
      });
    });
    request.on("error", reject);
  });
}

describe("telemetry endpoint", () => {
  beforeAll(async () => {
    const { startDirectiveUiServer } = await import("../../hosts/web-host/server.ts");
    const handle = await startDirectiveUiServer({
      directiveRoot: process.cwd(),
      host: HOST,
      port: 0,
    });
    origin = handle.origin;
    closeServer = () => handle.close();
  }, 30_000);

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
    }
  });

  it("returns counters and gauges after API traffic", async () => {
    await fetchJson("/api/manifest");
    await fetchJson("/api/telemetry/snapshot");
    const response = await fetchJson("/api/telemetry/snapshot");

    expect(response.statusCode).toBe(200);
    expect(String(response.headers["content-type"] ?? "")).toContain("application/json");

    const body = response.body as {
      counters: Record<string, number>;
      gauges: Record<string, number>;
      events: unknown[];
    };

    expect(body.counters["web_host.requests_total"]).toBeGreaterThanOrEqual(3);
    expect(body.counters["web_host.api_requests_total"]).toBeGreaterThanOrEqual(3);
    expect(typeof body.gauges["web_host.last_request_duration_ms"]).toBe("number");
    expect(body.events).toBeInstanceOf(Array);
  });
});
