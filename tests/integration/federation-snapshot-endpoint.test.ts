import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runFirstHostIntegrationFlow } from "../../hosts/integration-kit/lib/first-host-integration.ts";

const HOST = "127.0.0.1";

let origin = "";
let aggregatorRoot = "";
let alphaRoot = "";
let betaRoot = "";
let alphaOrigin = "";
let closeServer: (() => Promise<void>) | null = null;
const closeRemoteServers: Array<() => Promise<void>> = [];

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

describe("federation snapshot endpoint", () => {
  beforeAll(async () => {
    alphaRoot = path.resolve(os.tmpdir(), `directive-kernel-fed-alpha-${Date.now()}`, "directive-root");
    betaRoot = path.resolve(os.tmpdir(), `directive-kernel-fed-beta-${Date.now()}`, "directive-root");
    aggregatorRoot = path.resolve(os.tmpdir(), `directive-kernel-fed-agg-${Date.now()}`, "directive-root");

    await runFirstHostIntegrationFlow({
      directiveRoot: alphaRoot,
      goal: {
        goalId: "federation-alpha",
        goalStatement: "Prepare one remote root for read-only federation aggregation.",
        whyNow: "Verify the multi-root snapshot surface.",
        adoptionTarget: "runtime",
        constraints: ["keep Discovery first", "keep review explicit", "do not widen autonomy"],
        successSignal: "One routed source appears in a remote snapshot.",
      },
      source: {
        candidateId: "federation-alpha-source",
        candidateName: "Federation Alpha Source",
        sourceType: "workflow-writeup",
        sourceReference: "https://example.com/federation-alpha-source",
        summary: "Alpha federation test source.",
        containsWorkflowPattern: true,
        improvesDirectiveWorkspace: true,
        workflowBoundaryShape: "bounded_protocol",
      },
    });

    await runFirstHostIntegrationFlow({
      directiveRoot: betaRoot,
      goal: {
        goalId: "federation-beta",
        goalStatement: "Prepare a second remote root for read-only federation aggregation.",
        whyNow: "Verify aggregation across multiple roots.",
        adoptionTarget: "architecture",
        constraints: ["keep Discovery first", "keep review explicit", "do not widen autonomy"],
        successSignal: "A second routed source appears independently in a remote snapshot.",
      },
      source: {
        candidateId: "federation-beta-source",
        candidateName: "Federation Beta Source",
        sourceType: "workflow-writeup",
        sourceReference: "https://example.com/federation-beta-source",
        summary: "Beta federation test source.",
        containsWorkflowPattern: true,
        improvesDirectiveWorkspace: true,
        workflowBoundaryShape: "bounded_protocol",
      },
    });

    const { startDirectiveUiServer } = await import("../../hosts/web-host/server.ts");
    const alphaHandle = await startDirectiveUiServer({ directiveRoot: alphaRoot, host: HOST, port: 0 });
    const betaHandle = await startDirectiveUiServer({ directiveRoot: betaRoot, host: HOST, port: 0 });
    alphaOrigin = alphaHandle.origin;
    closeRemoteServers.push(() => alphaHandle.close(), () => betaHandle.close());

    fs.mkdirSync(aggregatorRoot, { recursive: true });
    fs.writeFileSync(
      path.join(aggregatorRoot, "kernel-federation.config.json"),
      `${JSON.stringify({
        roots: [
          { name: "alpha", url: alphaOrigin },
          { name: "beta", url: betaHandle.origin },
        ],
      }, null, 2)}\n`,
      "utf8",
    );

    const aggregatorHandle = await startDirectiveUiServer({
      directiveRoot: aggregatorRoot,
      host: HOST,
      port: 0,
    });
    origin = aggregatorHandle.origin;
    closeServer = () => aggregatorHandle.close();
  }, 60_000);

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
    }
    while (closeRemoteServers.length > 0) {
      const close = closeRemoteServers.pop();
      if (close) {
        await close();
      }
    }
    for (const root of [aggregatorRoot, alphaRoot, betaRoot]) {
      if (root) {
        fs.rmSync(path.dirname(root), { recursive: true, force: true });
      }
    }
  });

  it("aggregates snapshot, inbox, and runtime status per configured root", async () => {
    const response = await fetchJson("/api/federation/snapshot");
    expect(response.statusCode).toBe(200);

    const body = response.body as {
      $schema: string;
      configured: boolean;
      roots: Array<{
        name: string;
        ok: boolean;
        snapshot: Record<string, unknown> | null;
        operatorInbox: Record<string, unknown> | null;
        runtimeStatus: Record<string, unknown> | null;
      }>;
      summary: {
        totalRoots: number;
        reachableRoots: number;
        failedRoots: number;
        totalQueueEntries: number;
        totalEngineRuns: number;
      };
    };

    expect(body.$schema).toBe("/api/schemas/federation-snapshot.response.schema.json");
    expect(body.configured).toBe(true);
    expect(body.roots).toHaveLength(2);
    expect(body.roots.every((root) => root.ok)).toBe(true);
    expect(body.roots.map((root) => root.name)).toEqual(["alpha", "beta"]);
    expect(body.summary.totalRoots).toBe(2);
    expect(body.summary.reachableRoots).toBe(2);
    expect(body.summary.failedRoots).toBe(0);
    expect(body.summary.totalQueueEntries).toBe(2);
    expect(body.summary.totalEngineRuns).toBe(2);
    expect(
      body.roots.every(
        (root) =>
          root.snapshot !== null
          && root.operatorInbox !== null
          && root.runtimeStatus !== null,
      ),
    ).toBe(true);
  });

  it("reports partial failures without merging or hiding the failed root", async () => {
    fs.writeFileSync(
      path.join(aggregatorRoot, "kernel-federation.config.json"),
      `${JSON.stringify({
        roots: [
          {
            name: "alpha",
            url: alphaOrigin,
          },
          { name: "missing", url: "http://127.0.0.1:9" },
        ],
      }, null, 2)}\n`,
      "utf8",
    );

    const response = await fetchJson("/api/federation/snapshot");
    expect(response.statusCode).toBe(200);

    const body = response.body as {
      roots: Array<{
        name: string;
        ok: boolean;
        failedReads: string[];
        error: string | null;
      }>;
      summary: {
        reachableRoots: number;
        failedRoots: number;
      };
    };

    expect(body.summary.reachableRoots).toBe(1);
    expect(body.summary.failedRoots).toBe(1);
    const failedRoot = body.roots.find((root) => root.name === "missing");
    expect(failedRoot?.ok).toBe(false);
    expect(failedRoot?.failedReads).toContain("snapshot");
    expect(typeof failedRoot?.error).toBe("string");
  });
});
