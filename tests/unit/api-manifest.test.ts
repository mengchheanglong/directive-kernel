import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { ARCHITECTURE_DEEP_TAIL_STAGES } from "../../architecture/lib/control/materialization-tail-stage-map.ts";
import { buildApiManifest, ROUTE_TABLE } from "../../hosts/web-host/api-manifest.ts";

const REPO_ROOT = process.cwd();

function loadJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, relativePath), "utf8")) as object;
}

function validateManifest(value: unknown) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(loadJson("shared/schemas/api-manifest.schema.json"));
  const ok = validate(value);
  return { ok, errors: validate.errors ?? [] };
}

function extractRouteSignaturesFromApiRoutesSource() {
  const text = fs.readFileSync(path.resolve(REPO_ROOT, "hosts/web-host/api-routes.ts"), "utf8");
  const signatures: string[] = [];

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    const exactMatch = line.match(/^if \(method === "(GET|POST)" && pathname === "([^"]+)"\) \{$/u);
    if (exactMatch) {
      signatures.push(`${exactMatch[1]} ${exactMatch[2]}`);
      continue;
    }

    if (line === 'if (method === "GET" && pathname.startsWith("/api/engine-runs/")) {') {
      signatures.push("GET /api/engine-runs/:runId");
      continue;
    }
    if (line === 'if (method === "POST" && pathname.startsWith("/api/engine-runs/") && pathname.endsWith("/plan-progress")) {') {
      signatures.push("POST /api/engine-runs/:runId/plan-progress");
      continue;
    }
    if (line === 'if (method === "POST" && pathname.startsWith("/api/engine-runs/") && pathname.endsWith("/reroute")) {') {
      signatures.push("POST /api/engine-runs/:runId/reroute");
      continue;
    }
    if (line === 'if (method === "GET" && pathname === `/api/${segment}/detail`) {') {
      for (const stage of ARCHITECTURE_DEEP_TAIL_STAGES) {
        signatures.push(`GET /api/${stage.apiRouteSegment}/detail`);
      }
    }
  }

  return signatures.sort();
}

describe("api manifest", () => {
  it("buildApiManifest returns a schema-valid manifest with sorted operations", () => {
    const manifest = buildApiManifest();
    const validation = validateManifest(manifest);

    expect(validation.ok, JSON.stringify(validation.errors, null, 2)).toBe(true);

    const names = manifest.operations.map((entry) => entry.name);
    expect([...names].sort()).toEqual(names);
  });

  it("contains one manifest entry per route in api-routes.ts", () => {
    const manifestSignatures = ROUTE_TABLE.map((entry) => `${entry.method} ${entry.path}`).sort();
    const routeSignatures = extractRouteSignaturesFromApiRoutesSource();

    const missing = routeSignatures.filter((signature) => !manifestSignatures.includes(signature));
    const extra = manifestSignatures.filter((signature) => !routeSignatures.includes(signature));

    expect(
      missing,
      `Missing manifest entries for routes: ${missing.join(", ") || "(none)"}`,
    ).toEqual([]);
    expect(
      extra,
      `Manifest contains entries not backed by api-routes.ts: ${extra.join(", ") || "(none)"}`,
    ).toEqual([]);
  });

  it("contains one capability per capability folder and one schema index entry per schema file", () => {
    const manifest = buildApiManifest();
    const capabilityDirs = fs.readdirSync(path.resolve(REPO_ROOT, "runtime/capabilities"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const schemaFiles = fs.readdirSync(path.resolve(REPO_ROOT, "shared/schemas"), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".schema.json"))
      .map((entry) => entry.name.replace(/\.schema\.json$/u, ""))
      .sort();

    expect(manifest.capabilities.map((entry) => entry.id)).toEqual(capabilityDirs);
    expect(Object.keys(manifest.schema_index).sort()).toEqual(schemaFiles);
  });
});
