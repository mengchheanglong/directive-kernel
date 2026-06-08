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
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: JSON.parse(data),
          });
        } catch {
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: data,
          });
        }
      });
    });
    request.on("error", reject);
  });
}

describe("schema endpoint", () => {
  beforeAll(async () => {
    const { startDirectiveUiServer } = await import(
      "../../hosts/web-host/server.ts"
    );
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

  it("returns run-record.schema.json with correct $id", async () => {
    const response = await fetchJson("/api/schemas/run-record.schema.json");

    expect(response.statusCode).toBe(200);
    expect(String(response.headers["content-type"] ?? "")).toContain(
      "application/json",
    );

    const body = response.body as Record<string, unknown>;
    expect(body).toHaveProperty("$id");
    expect(String(body["$id"])).toContain("run-record.schema.json");
  });

  it("returns schema_not_found for a missing schema", async () => {
    const response = await fetchJson(
      "/api/schemas/nonexistent.schema.json",
    );

    expect(response.statusCode).toBe(404);

    const body = response.body as Record<string, unknown>;
    expect(body).toEqual({ ok: false, error: "schema_not_found" });
  });

  it("returns invalid_schema_name for a name failing validation", async () => {
    const response = await fetchJson("/api/schemas/bad name.schema.json");

    expect(response.statusCode).toBe(400);

    const body = response.body as Record<string, unknown>;
    expect(body).toEqual({ ok: false, error: "invalid_schema_name" });
  });

  it("returns invalid_schema_name for path traversal containing ..", async () => {
    const response = await fetchJson(
      "/api/schemas/%2e%2e%2fetc%2fpasswd.schema.json",
    );

    expect(response.statusCode).toBe(400);

    const body = response.body as Record<string, unknown>;
    expect(body).toEqual({ ok: false, error: "invalid_schema_name" });
  });
});
