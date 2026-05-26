import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { assertUrlIsSafe } from "../../../shared/lib/ssrf-guard.ts";
import { sanitizeText } from "../../../shared/lib/text-sanitizer.ts";
import { arxivSearch } from "../../../runtime/capabilities/literature-access/arxiv-search.ts";
import { startStandaloneHostServer } from "../../../hosts/standalone-host/server.ts";

function ipv6Url(address: string) {
  return `http://[${address}]/`;
}

function readJsonFile(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function schemaAt(schema: Record<string, unknown>, pathSegments: readonly string[]) {
  let current: unknown = schema;
  for (const segment of pathSegments) {
    current = (current as Record<string, unknown>)[segment];
  }
  return current as Record<string, unknown>;
}

function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  const files: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (
      entry.name === "node_modules"
      || entry.name === "dist"
      || entry.name === ".git"
      || entry.name === ".tmp"
      || entry.name.startsWith("tmp")
    ) {
      continue;
    }
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
    } else {
      files.push(entryPath);
    }
  }
  return files;
}

describe("security hardening", () => {
  it("rejects representative blocked address ranges", async () => {
    const blockedUrls = [
      "http://0.0.0.0/",
      "http://10.0.0.5/",
      "http://172.16.0.1/",
      "http://192.168.1.1/",
      "http://127.0.0.1/",
      "http://169.254.0.1/",
      "http://224.0.0.1/",
      "http://240.0.0.1/",
      ipv6Url("::"),
      ipv6Url("::1"),
      ipv6Url("fe80::1"),
      ipv6Url("fc00::1"),
      ipv6Url("ff00::1"),
      ipv6Url("::ffff:192.168.1.1"),
    ];

    for (const url of blockedUrls) {
      await expect(assertUrlIsSafe(url)).rejects.toThrow(
        /^ssrf_blocked_address:/,
      );
    }
  });

  it("rejects non-http schemes and handles loopback/public addresses explicitly", async () => {
    for (const url of [
      "file:///etc/passwd",
      "data:text/plain,hello",
      "ftp://example.com/file",
      "gopher://example.com/",
    ]) {
      await expect(assertUrlIsSafe(url)).rejects.toThrow(
        /^ssrf_blocked_scheme:/,
      );
    }

    await expect(
      assertUrlIsSafe("http://93.184.216.34/"),
    ).resolves.toBeUndefined();

    const localhostResolver = async () => ["127.0.0.1"];
    await expect(
      assertUrlIsSafe("http://localhost/", { resolver: localhostResolver }),
    ).rejects.toThrow(/^ssrf_blocked_address:/);
    await expect(
      assertUrlIsSafe("http://localhost/", {
        allowLoopback: true,
        resolver: localhostResolver,
      }),
    ).resolves.toBeUndefined();
  });

  it("returns 429 with Retry-After when the standalone host token bucket is exhausted", async () => {
    const directiveRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "directive-security-rate-limit-"),
    );
    const handle = await startStandaloneHostServer({
      directiveRoot,
      port: 0,
      auth: {
        mode: "static_bearer",
        bearerToken: "test-token",
        bearerTokenSource: "config",
        protectedRoutePrefixes: ["/api/"],
      },
      rateLimit: {
        requestsPerMinute: 1,
        burst: 1,
      },
    });

    try {
      const headers = {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      };
      await fetch(`${handle.origin}/api/engine/plan-progress`, {
        method: "POST",
        headers,
        body: JSON.stringify({ runId: "missing", updates: [] }),
      });
      const limited = await fetch(`${handle.origin}/api/engine/plan-progress`, {
        method: "POST",
        headers,
        body: JSON.stringify({ runId: "missing", updates: [] }),
      });
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).toBeTruthy();
      await expect(limited.json()).resolves.toMatchObject({
        ok: false,
        error: "rate_limited",
      });

      const artifactRoot = path.join(directiveRoot, "runtime", "host-artifacts");
      const rateLimitArtifacts = walkFiles(artifactRoot).filter((filePath) =>
        /rate[-_]limit/iu.test(path.basename(filePath)),
      );
      expect(rateLimitArtifacts).toEqual([]);
    } finally {
      await handle.close();
      fs.rmSync(directiveRoot, { recursive: true, force: true });
    }
  });

  it("strips controls, enforces length caps, and blocks offline fetches", async () => {
    expect(
      sanitizeText("safe\u0000text\u007F", {
        fieldName: "candidate_name",
        maxBytes: 100,
      }),
    ).toBe("safetext");

    expect(() =>
      sanitizeText("abcdef", {
        fieldName: "candidate_name",
        maxBytes: 5,
      }),
    ).toThrow(/^sanitize_too_long:candidate_name:/);

    await expect(
      assertUrlIsSafe("http://93.184.216.34/", {
        allowExternalFetches: false,
      }),
    ).rejects.toThrow(/^ssrf_blocked_offline:/);

    await expect(
      arxivSearch({ query: "security" }, { allowExternalFetches: false }),
    ).resolves.toMatchObject({
      ok: false,
      error: "external_fetches_disabled",
    });
  });

  it("declares schema maxLength constraints for bounded free-text fields", () => {
    const schemasRoot = path.resolve("shared", "schemas");
    const discovery = readJsonFile(
      path.join(schemasRoot, "discovery-submission-request.schema.json"),
    );
    expect(schemaAt(discovery, ["properties", "candidate_name"]).maxLength).toBe(200);
    expect(schemaAt(discovery, ["properties", "source_reference"]).maxLength).toBe(2000);
    expect(schemaAt(discovery, ["properties", "mission_alignment"]).maxLength).toBe(5000);
    expect(schemaAt(discovery, ["properties", "notes"]).maxLength).toBe(5000);
    expect(
      schemaAt(discovery, [
        "properties",
        "case_record",
        "properties",
        "intake",
        "properties",
        "why_it_entered_the_system",
      ]).maxLength,
    ).toBe(5000);
    expect(
      schemaAt(discovery, [
        "properties",
        "case_record",
        "properties",
        "routing",
        "properties",
        "why_this_route",
      ]).maxLength,
    ).toBe(5000);

    const config = readJsonFile(
      path.join(schemasRoot, "standalone-host-config.schema.json"),
    );
    expect(
      schemaAt(config, ["properties", "runtime", "properties", "allowExternalFetches"]).default,
    ).toBe(true);
    expect(
      schemaAt(config, ["properties", "rateLimit", "properties", "requestsPerMinute"]).default,
    ).toBe(60);
    expect(
      schemaAt(config, ["properties", "rateLimit", "properties", "burst"]).default,
    ).toBe(10);
  });

  it("documents security policy, offline mode, reporting, and README linkage", () => {
    const security = fs.readFileSync("SECURITY.md", "utf8");
    for (const phrase of [
      "Malicious Source URL",
      "Malicious Goal Envelope",
      "Stolen Bearer Token",
      "Untrusted Directive Root Filesystem",
      "runtime.allowExternalFetches",
      "GitHub",
      "Tavily",
      "Exa",
      "Firecrawl",
      "Unpaywall",
      "Reporting channel:",
    ]) {
      expect(security).toContain(phrase);
    }

    const readme = fs.readFileSync("README.md", "utf8");
    expect(readme).toContain("[SECURITY.md](./SECURITY.md)");
  });

  it("does not contain obvious checked-in secret patterns", () => {
    const roots = ["hosts", "runtime", "engine", "discovery", "architecture", "shared"];
    const findings: string[] = [];
    const assignmentPattern =
      /\b(?:bearerToken|apiKey|secret|token)\b\s*[:=]\s*["'][A-Za-z0-9+/=]{32,}["']/giu;

    for (const root of roots) {
      for (const filePath of walkFiles(root)) {
        if (!/\.(?:ts|js|mjs|json|md|py)$/iu.test(filePath)) {
          continue;
        }
        const content = fs.readFileSync(filePath, "utf8");
        if (/aws_access_key_id/iu.test(content)) {
          findings.push(`${filePath}:aws_access_key_id`);
        }
        if (content.includes("BEGIN PRIVATE KEY")) {
          findings.push(`${filePath}:BEGIN PRIVATE KEY`);
        }
        if (assignmentPattern.test(content)) {
          findings.push(`${filePath}:hardcoded secret-like assignment`);
        }
        assignmentPattern.lastIndex = 0;
      }
    }

    expect(findings).toEqual([]);
  });
});
