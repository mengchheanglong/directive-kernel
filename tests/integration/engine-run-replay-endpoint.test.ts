import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runFirstHostIntegrationFlow } from "../../hosts/integration-kit/lib/first-host-integration.ts";

const HOST = "127.0.0.1";

let origin = "";
let closeServer: (() => Promise<void>) | null = null;
let runId = "";

function requestJson(input: {
  method: "GET" | "POST";
  pathname: string;
  body?: unknown;
}): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: unknown;
}> {
  return new Promise((resolve, reject) => {
    const bodyText = input.body === undefined ? null : JSON.stringify(input.body);
    const request = http.request(
      `${origin}${input.pathname}`,
      {
        method: input.method,
        headers: bodyText
          ? {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(bodyText),
          }
          : undefined,
      },
      (response) => {
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
      },
    );
    request.on("error", reject);
    if (bodyText) {
      request.write(bodyText);
    }
    request.end();
  });
}

describe("engine run replay endpoint", () => {
  beforeAll(async () => {
    const directiveRoot = path.resolve(
      os.tmpdir(),
      `directive-kernel-replay-endpoint-${Date.now()}`,
      "directive-root",
    );
    const firstFlow = await runFirstHostIntegrationFlow({
      directiveRoot,
      goal: {
        goalId: "replay-endpoint-check",
        goalStatement: "Verify non-persistent replay over one engine run.",
        whyNow: "Replay should expose bounded what-if routing without mutating the workspace.",
        adoptionTarget: "runtime",
        constraints: ["keep replay non-persistent", "report drift explicitly"],
        successSignal: "Replay returns a diff and determinism label for one run.",
      },
      source: {
        candidateId: "replay-endpoint-source",
        candidateName: "Replay Endpoint Source",
        sourceType: "workflow-writeup",
        sourceReference: "https://example.com/replay-endpoint-source",
        summary: "Exercise the replay endpoint through a real engine-backed submission.",
        notes: "replay endpoint verification",
        containsWorkflowPattern: true,
        improvesDirectiveWorkspace: true,
        workflowBoundaryShape: "bounded_protocol",
      },
    });
    runId = firstFlow.submission.engine.record.runId;

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

  it("returns an exact replay for the baseline request", async () => {
    const response = await requestJson({
      method: "POST",
      pathname: `/api/engine-runs/${encodeURIComponent(runId)}/replay`,
      body: {},
    });

    expect(response.statusCode).toBe(200);
    const body = response.body as {
      $schema: string;
      runId: string;
      nonPersistent: boolean;
      determinism: { mode: string; driftedInputs: unknown[]; };
    };
    expect(body.$schema).toBe("/api/schemas/engine-run-replay.response.schema.json");
    expect(body.runId).toBe(runId);
    expect(body.nonPersistent).toBe(true);
    expect(body.determinism.mode).toBe("exact");
    expect(body.determinism.driftedInputs).toEqual([]);
  });

  it("returns an approximate replay when mission overrides are supplied", async () => {
    const response = await requestJson({
      method: "POST",
      pathname: `/api/engine-runs/${encodeURIComponent(runId)}/replay`,
      body: {
        missionChange: {
          capabilityLanes: ["Architecture"],
          objective: "Re-evaluate this run as a longer-horizon architecture improvement.",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.body as {
      determinism: { mode: string; driftedInputs: Array<{ kind: string; detail: string; }>; };
      overrides: { missionFieldsChanged: string[]; };
      diff: string[];
    };
    expect(body.determinism.mode).toBe("approximate");
    expect(body.overrides.missionFieldsChanged).toEqual(["capabilityLanes", "objective"]);
    expect(body.determinism.driftedInputs.some((entry) => entry.kind === "mission_change")).toBe(true);
    expect(body.diff.length).toBeGreaterThan(0);
  });
});
