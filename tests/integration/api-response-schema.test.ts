import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runFirstHostIntegrationFlow } from "../../hosts/integration-kit/lib/first-host-integration.ts";

const HOST = "127.0.0.1";

let origin = "";
let runId = "";
let candidateId = "";
let routingRecordPath = "";
let currentArtifactPath = "";
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

function extractSchemaPath(response: {
  headers: http.IncomingHttpHeaders;
  body: unknown;
}) {
  if (
    response.body
    && typeof response.body === "object"
    && !Array.isArray(response.body)
    && typeof (response.body as Record<string, unknown>).$schema === "string"
  ) {
    return String((response.body as Record<string, unknown>).$schema);
  }

  const linkHeader = String(response.headers.link ?? "");
  const match = linkHeader.match(/<([^>]+)>;\s*rel="describedby"/u);
  return match?.[1] ?? null;
}

async function validateResponse(response: {
  headers: http.IncomingHttpHeaders;
  body: unknown;
}) {
  const schemaPath = extractSchemaPath(response);
  expect(schemaPath).toMatch(/^\/api\/schemas\/.+\.schema\.json$/u);
  const schemaFile = path.basename(String(schemaPath));
  const schema = JSON.parse(
    await fs.readFile(path.resolve(process.cwd(), "shared", "schemas", schemaFile), "utf8"),
  ) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const ok = validate(response.body);
  expect(ok, JSON.stringify(validate.errors ?? [], null, 2)).toBe(true);
}

describe("api response schema stamping", () => {
  beforeAll(async () => {
    const directiveRoot = path.resolve(
      os.tmpdir(),
      `directive-kernel-response-schema-${Date.now()}`,
      "directive-root",
    );

    const result = await runFirstHostIntegrationFlow({
      directiveRoot,
      goal: {
        goalId: "response-schema-check",
        goalStatement: "Produce one bounded engine-backed source for schema stamping verification.",
        whyNow: "Validate that stable web-host reads now self-identify their schemas.",
        adoptionTarget: "runtime",
        constraints: [
          "keep Discovery first",
          "keep review explicit",
          "do not widen autonomy",
        ],
        successSignal: "Core read routes validate against the schema each response advertises.",
      },
      source: {
        candidateId: "response-schema-source",
        candidateName: "Response Schema Source",
        sourceType: "workflow-writeup",
        sourceReference: "https://example.com/response-schema-source",
        summary: "Bounded source used to verify stable API schema refs.",
        containsWorkflowPattern: true,
        improvesDirectiveWorkspace: true,
        workflowBoundaryShape: "bounded_protocol",
      },
    });

    runId = result.submission.engine.record.runId;
    candidateId = result.request.candidate_id;

    const { startDirectiveUiServer } = await import("../../hosts/web-host/server.ts");
    const handle = await startDirectiveUiServer({
      directiveRoot,
      host: HOST,
      port: 0,
    });
    origin = handle.origin;
    closeServer = () => handle.close();

    const queueResponse = await fetchJson("/api/queue");
    const queueBody = queueResponse.body as {
      entries: Array<{
        candidate_id: string;
        routing_record_path: string | null;
        current_head: { artifact_path: string } | null;
      }>;
    };
    const queueEntry = queueBody.entries.find((entry) => entry.candidate_id === candidateId);
    routingRecordPath = String(queueEntry?.routing_record_path ?? "");
    currentArtifactPath = String(queueEntry?.current_head?.artifact_path ?? "");
  }, 60_000);

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
    }
  });

  it("validates object-based read routes against their advertised body schema", async () => {
    const responses = [
      await fetchJson("/api/runtime/status"),
      await fetchJson("/api/manifest"),
      await fetchJson("/api/telemetry/snapshot"),
      await fetchJson("/api/federation/snapshot"),
      await fetchJson("/api/runtime/capabilities"),
      await fetchJson("/api/glossary"),
      await fetchJson("/api/snapshot"),
      await fetchJson("/api/operator-decision-inbox"),
      await fetchJson("/api/engine-runs"),
      await fetchJson(`/api/engine-runs/${encodeURIComponent(runId)}`),
      await fetchJson("/api/queue"),
      await fetchJson(`/api/queue-entry?candidateId=${encodeURIComponent(candidateId)}`),
      await fetchJson(`/api/explain?runId=${encodeURIComponent(runId)}`),
      await fetchJson(
        `/api/discovery-routing-records/detail?path=${encodeURIComponent(routingRecordPath)}`,
      ),
      await fetchJson(`/api/artifacts?path=${encodeURIComponent(currentArtifactPath)}`),
    ];

    for (const response of responses) {
      expect(response.statusCode).toBe(200);
      await validateResponse(response);
    }
  });

  it("validates array-based read routes against their advertised describedby link", async () => {
    const responses = [
      await fetchJson("/api/handoffs"),
      await fetchJson("/api/mission/feedback"),
      await fetchJson("/api/mission/history"),
      await fetchJson("/api/gaps/pending"),
    ];

    for (const response of responses) {
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      await validateResponse(response);
    }
  });
});
