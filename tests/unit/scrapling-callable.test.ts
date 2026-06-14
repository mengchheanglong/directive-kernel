import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createScraplingCallableCapability,
  disableScraplingCapability,
  enableScraplingCapability,
  executeScraplingTool,
} from "../../runtime/capabilities/pipe-scrapling-adaptive-web-scraper-mq9mmrc0/index.ts";
import { checkCallableContractCompliance } from "../../runtime/core/callable-contract.ts";

const tempDirs: string[] = [];
const originalPython = process.env.DIRECTIVE_SCRAPLING_PYTHON;

afterEach(() => {
  enableScraplingCapability();
  if (originalPython === undefined) {
    delete process.env.DIRECTIVE_SCRAPLING_PYTHON;
  } else {
    process.env.DIRECTIVE_SCRAPLING_PYTHON = originalPython;
  }
  while (tempDirs.length > 0) {
    fs.rmSync(String(tempDirs.pop()), { recursive: true, force: true });
  }
});

function sampleHtml() {
  return [
    "<html><head><title>Hermes Scrapling Smoke</title></head><body>",
    "<h1>Hermes Scrapling Smoke</h1>",
    "<p class=\"summary\">Local extraction proof.</p>",
    "<a href=\"https://example.com\">Example</a>",
    "</body></html>",
  ].join("");
}

describe("Scrapling callable capability", () => {
  it("satisfies the shared callable contract", () => {
    const capability = createScraplingCallableCapability();
    const compliance = checkCallableContractCompliance(capability);
    expect(compliance).toEqual({ ok: true, violations: [] });
    expect(capability.descriptor.tools).toEqual(["extract-html"]);
  });

  it("rejects empty input and URL/network input", async () => {
    const empty = await executeScraplingTool({
      tool: "extract-html",
      input: {},
    });
    expect(empty.ok).toBe(false);
    expect(empty.status).toBe("validation_error");
    expect(String(empty.result)).toContain("exactly one");

    const url = await executeScraplingTool({
      tool: "extract-html",
      input: { url: "https://example.com" },
    });
    expect(url.ok).toBe(false);
    expect(url.status).toBe("validation_error");
    expect(String(url.result)).toContain("does not support network input");
  });

  it("rejects inputs that provide both html and sourcePath", async () => {
    const result = await executeScraplingTool({
      tool: "extract-html",
      input: {
        html: "<h1>Inline</h1>",
        sourcePath: "C:/tmp/page.html",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("validation_error");
    expect(String(result.result)).toContain("exactly one");
  });

  it("extracts selectors, text, and links from inline HTML", async () => {
    const result = await executeScraplingTool({
      tool: "extract-html",
      input: {
        html: sampleHtml(),
        selectors: {
          heading: "h1",
          summary: "p.summary",
        },
        includeText: true,
        includeLinks: true,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("success");
    expect(result.result).toMatchObject({
      ok: true,
      sourceType: "html",
      title: "Hermes Scrapling Smoke",
      fields: {
        heading: "Hermes Scrapling Smoke",
        summary: "Local extraction proof.",
      },
      warnings: [],
      links: [{ text: "Example", href: "https://example.com" }],
    });
    expect((result.result as { text?: string }).text).toContain("Local extraction proof.");
  });

  it("extracts from a local HTML file", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dk-scrapling-callable-"));
    tempDirs.push(tempRoot);
    const fixturePath = path.join(tempRoot, "page.html");
    fs.writeFileSync(fixturePath, sampleHtml(), "utf8");

    const result = await executeScraplingTool({
      tool: "extract-html",
      input: {
        sourcePath: fixturePath,
        selectors: {
          heading: "h1",
        },
        includeLinks: true,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("success");
    expect(result.result).toMatchObject({
      ok: true,
      sourceType: "sourcePath",
      sourcePath: path.resolve(fixturePath),
      fields: {
        heading: "Hermes Scrapling Smoke",
      },
      links: [{ text: "Example", href: "https://example.com" }],
    });
  });

  it("returns an honest disabled result", async () => {
    disableScraplingCapability();

    const result = await executeScraplingTool({
      tool: "extract-html",
      input: {
        html: sampleHtml(),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("disabled");
  });

  it("returns an honest error when the configured Python is unavailable", async () => {
    process.env.DIRECTIVE_SCRAPLING_PYTHON = "C:/definitely/not/python.exe";

    const result = await executeScraplingTool({
      tool: "extract-html",
      input: {
        html: sampleHtml(),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(String(result.result).length).toBeGreaterThan(0);
  });
});
