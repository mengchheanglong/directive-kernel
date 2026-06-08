import http from "node:http";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HOST = "127.0.0.1";

let origin = "";
let closeServer: (() => Promise<void>) | null = null;

function fetchJson(pathname: string): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: unknown }> {
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
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

describe("api manifest endpoint", () => {
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

  it("serves GET /api/manifest as valid JSON matching the schema", async () => {
    const response = await fetchJson("/api/manifest");

    expect(response.statusCode).toBe(200);
    expect(String(response.headers["content-type"] ?? "")).toContain("application/json");

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(
      JSON.parse(
        await import("node:fs/promises").then((fs) =>
          fs.readFile(new URL("../../shared/schemas/api-manifest.schema.json", import.meta.url), "utf8"),
        ),
      ) as object,
    );
    const ok = validate(response.body);
    expect(ok, JSON.stringify(validate.errors ?? [], null, 2)).toBe(true);
  });

  it("returns deterministic output across consecutive reads", async () => {
    const first = await fetchJson("/api/manifest");
    const second = await fetchJson("/api/manifest");

    expect(first.body).toEqual(second.body);
  });
});
