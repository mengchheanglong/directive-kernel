import http from "node:http";
import os from "node:os";
import path from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { runFirstHostIntegrationFlow } from "../../hosts/integration-kit/lib/first-host-integration.ts";

const HOST = "127.0.0.1";

let origin = "";
let runId = "";
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

describe("explain endpoint", () => {
  beforeAll(async () => {
    const directiveRoot = path.resolve(
      os.tmpdir(),
      `directive-kernel-explain-${Date.now()}`,
      "directive-root",
    );

    const result = await runFirstHostIntegrationFlow({
      directiveRoot,
      goal: {
        goalId: "explain-endpoint-check",
        goalStatement:
          "Route one bounded source and read back a deterministic explanation.",
        whyNow: "Verify the explain projection without reimplementing kernel state assembly.",
        adoptionTarget: "runtime",
        constraints: [
          "keep Discovery first",
          "keep review explicit",
          "do not widen autonomy",
        ],
        successSignal: "One run can be explained through a single web-host endpoint.",
      },
      source: {
        candidateId: "explain-endpoint-source",
        candidateName: "Explain Endpoint Source",
        sourceType: "workflow-writeup",
        sourceReference: "https://example.com/explain-endpoint-source",
        summary: "Bounded source used to verify run explanation output.",
        containsWorkflowPattern: true,
        improvesDirectiveWorkspace: true,
        workflowBoundaryShape: "bounded_protocol",
      },
    });

    runId = result.submission.engine.record.runId;

    const { startDirectiveUiServer } = await import("../../hosts/web-host/server.ts");
    const handle = await startDirectiveUiServer({
      directiveRoot,
      host: HOST,
      port: 0,
    });
    origin = handle.origin;
    closeServer = () => handle.close();
  }, 60_000);

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
    }
  });

  it("returns a deterministic explanation for an existing run", async () => {
    const response = await fetchJson(`/api/explain?runId=${encodeURIComponent(runId)}`);

    expect(response.statusCode).toBe(200);
    expect(String(response.headers["content-type"] ?? "")).toContain("application/json");

    const body = response.body as {
      ok: boolean;
      runId: string;
      summary: string;
      rawRecordPath: string;
      nextLegalActions: unknown[];
      relatedArtifacts: string[];
    };
    expect(body.ok).toBe(true);
    expect(body.runId).toBe(runId);
    expect(body.summary).toContain(runId);
    expect(body.rawRecordPath).toBe(`/api/engine-runs/${encodeURIComponent(runId)}`);
    expect(body.nextLegalActions).toBeInstanceOf(Array);
    expect(body.relatedArtifacts.length).toBeGreaterThan(0);
  });

  it("returns a structured not-found payload for an unknown run", async () => {
    const response = await fetchJson("/api/explain?runId=missing-run-id");
    const body = response.body as { ok: boolean; error: string; runId: string };

    expect(response.statusCode).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("run_not_found");
    expect(body.runId).toBe("missing-run-id");
  });
});
