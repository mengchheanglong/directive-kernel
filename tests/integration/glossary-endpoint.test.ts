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

describe("glossary endpoint", () => {
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

  it("GET /api/glossary returns 200 with non-empty terms array", async () => {
    const response = await fetchJson("/api/glossary");

    expect(response.statusCode).toBe(200);
    expect(String(response.headers["content-type"] ?? "")).toContain(
      "application/json",
    );

    const body = response.body as { terms: unknown[] };
    expect(body.terms).toBeInstanceOf(Array);
    expect(body.terms.length).toBeGreaterThan(0);
  });

  it("includes 'directive root' in the full glossary", async () => {
    const response = await fetchJson("/api/glossary");
    const body = response.body as { terms: { term: string }[] };

    const termNames = body.terms.map((t) => t.term);
    expect(termNames).toContain("Directive root");
  });

  it("GET /api/glossary?term=directive root returns exactly one matching term", async () => {
    const response = await fetchJson("/api/glossary?term=directive%20root");
    const body = response.body as { terms: { term: string }[] };

    expect(response.statusCode).toBe(200);
    expect(body.terms).toBeInstanceOf(Array);
    expect(body.terms.length).toBe(1);
    expect(body.terms[0].term.toLowerCase()).toBe("directive root");
  });

  it("GET /api/glossary?term=not-a-real-term returns 200 with empty array", async () => {
    const response = await fetchJson("/api/glossary?term=not-a-real-term");
    const body = response.body as { terms: unknown[] };

    expect(response.statusCode).toBe(200);
    expect(body.terms).toEqual([]);
  });
});
