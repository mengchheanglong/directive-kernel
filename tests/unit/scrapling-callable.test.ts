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
const originalPythonPath = process.env.PYTHONPATH;

afterEach(() => {
  enableScraplingCapability();
  if (originalPython === undefined) {
    delete process.env.DIRECTIVE_SCRAPLING_PYTHON;
  } else {
    process.env.DIRECTIVE_SCRAPLING_PYTHON = originalPython;
  }
  if (originalPythonPath === undefined) {
    delete process.env.PYTHONPATH;
  } else {
    process.env.PYTHONPATH = originalPythonPath;
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

function writeScraplingStub(mode: "url-success" | "missing-curl-cffi") {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dk-scrapling-stub-"));
  tempDirs.push(tempRoot);
  const packageRoot = path.join(tempRoot, "scrapling");
  const curlPackageRoot = path.join(tempRoot, "curl_cffi");
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.mkdirSync(curlPackageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, "parser.py"),
    [
      "import re",
      "",
      "class Node:",
      "    def __init__(self, html, attrs=None):",
      "        self.html = html",
      "        self.attrib = attrs or {}",
      "        self.text = self.get_all_text()",
      "",
      "    def get_all_text(self, separator=' ', strip=True):",
      "        text = re.sub(r'<[^>]+>', separator, self.html)",
      "        text = re.sub(r'\\s+', ' ', text)",
      "        return text.strip() if strip else text",
      "",
      "class Adaptor:",
      "    def __init__(self, html):",
      "        self.html = html",
      "",
      "    def css(self, selector):",
      "        if selector == 'title':",
      "            return [Node(m.group(1)) for m in re.finditer(r'<title[^>]*>(.*?)</title>', self.html, re.I | re.S)]",
      "        if selector == 'h1':",
      "            return [Node(m.group(1)) for m in re.finditer(r'<h1[^>]*>(.*?)</h1>', self.html, re.I | re.S)]",
      "        if selector == 'p.summary':",
      "            return [Node(m.group(1)) for m in re.finditer(r'<p[^>]*class=[\"\\']summary[\"\\'][^>]*>(.*?)</p>', self.html, re.I | re.S)]",
      "        if selector == 'a[href]':",
      "            nodes = []",
      "            for m in re.finditer(r'<a[^>]*href=[\"\\']([^\"\\']+)[\"\\'][^>]*>(.*?)</a>', self.html, re.I | re.S):",
      "                nodes.append(Node(m.group(2), {'href': m.group(1)}))",
      "            return nodes",
      "        return []",
      "",
      "    def get_all_text(self, separator='\\n', strip=True):",
      "        text = re.sub(r'<[^>]+>', separator, self.html)",
      "        text = re.sub(r'\\s+', ' ', text)",
      "        return text.strip() if strip else text",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(packageRoot, "__init__.py"),
    [
      "from .parser import Adaptor",
      "",
    ].join("\n"),
    "utf8",
  );
  if (mode === "url-success") {
    fs.writeFileSync(
      path.join(curlPackageRoot, "__init__.py"),
      [
        "from . import requests",
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(curlPackageRoot, "requests.py"),
      [
        "class Response:",
        "    status_code = 200",
        "    encoding = 'utf-8'",
        "    content = b''",
        "",
        "class Session:",
        "    def __init__(self, **kwargs):",
        "        assert kwargs.get('trust_env') is False",
        "        assert kwargs.get('allow_redirects') is False",
        "        assert kwargs.get('proxies') == {}",
        "        assert kwargs.get('default_headers') is False",
        "        assert kwargs.get('discard_cookies') is True",
        "",
        "    def __enter__(self):",
        "        return self",
        "",
        "    def __exit__(self, exc_type, exc, tb):",
        "        return False",
        "",
        "    def get(self, url, **kwargs):",
        "        assert url == 'https://example.com/'",
        "        assert kwargs.get('allow_redirects') is False",
        "        assert kwargs.get('max_redirects') == 0",
        "        assert kwargs.get('proxies') == {}",
        "        assert kwargs.get('default_headers') is False",
        "        assert kwargs.get('discard_cookies') is True",
        "        callback = kwargs.get('content_callback')",
        "        html = b'<html><head><title>Example Domain</title></head><body><h1>Example Domain</h1><p class=\"summary\">Public URL proof.</p><a href=\"https://www.iana.org/domains/example\">More information...</a></body></html>'",
        "        if callback:",
        "            callback(html)",
        "        return Response()",
        "",
      ].join("\n"),
      "utf8",
    );
  } else {
    fs.writeFileSync(
      path.join(curlPackageRoot, "__init__.py"),
      [
        "raise ModuleNotFoundError(\"No module named 'curl_cffi'\", name='curl_cffi')",
        "",
      ].join("\n"),
      "utf8",
    );
  }
  process.env.PYTHONPATH = originalPythonPath
    ? `${tempRoot}${path.delimiter}${originalPythonPath}`
    : tempRoot;
}

describe("Scrapling callable capability", () => {
  it("satisfies the shared callable contract", () => {
    const capability = createScraplingCallableCapability();
    const compliance = checkCallableContractCompliance(capability);
    expect(compliance).toEqual({ ok: true, violations: [] });
    expect(capability.descriptor.tools).toEqual(["extract-html"]);
  });

  it("rejects empty input and unsupported network controls", async () => {
    const empty = await executeScraplingTool({
      tool: "extract-html",
      input: {},
    });
    expect(empty.ok).toBe(false);
    expect(empty.status).toBe("validation_error");
    expect(String(empty.result)).toContain("exactly one");

    const headers = await executeScraplingTool({
      tool: "extract-html",
      input: { html: "<h1>Inline</h1>", headers: { authorization: "secret" } },
    });
    expect(headers.ok).toBe(false);
    expect(headers.status).toBe("validation_error");
    expect(String(headers.result)).toContain("headers");
    expect(String(headers.result)).toContain("cookies, auth, or proxies");
  });

  it("rejects inputs that provide more than one source", async () => {
    const result = await executeScraplingTool({
      tool: "extract-html",
      input: {
        html: "<h1>Inline</h1>",
        sourcePath: "C:/tmp/page.html",
        url: "https://example.com",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("validation_error");
    expect(String(result.result)).toContain("exactly one");
  });

  it("rejects unsafe URLs before fetching", async () => {
    const unsafeUrls = [
      "http://localhost/",
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://169.254.10.1/",
      "file:///C:/tmp/page.html",
      "data:text/html,<h1>x</h1>",
      "javascript:alert(1)",
      "ftp://example.com/page.html",
      "https://user:pass@example.com/",
    ];

    for (const url of unsafeUrls) {
      const result = await executeScraplingTool({
        tool: "extract-html",
        input: { url },
      });
      expect(result.ok, url).toBe(false);
      expect(result.status, url).toBe("validation_error");
    }
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

  it("extracts selectors and links from a safe public URL when the durable fetcher is available", async () => {
    writeScraplingStub("url-success");

    const result = await executeScraplingTool({
      tool: "extract-html",
      input: {
        url: "https://example.com",
        selectors: {
          heading: "h1",
          summary: "p.summary",
        },
        includeLinks: true,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("success");
    expect(result.result).toMatchObject({
      ok: true,
      sourceType: "url",
      sourceUrl: "https://example.com/",
      title: "Example Domain",
      fields: {
        heading: "Example Domain",
        summary: "Public URL proof.",
      },
      links: [{
        text: "More information...",
        href: "https://www.iana.org/domains/example",
      }],
    });
  });

  it("returns an honest dependency_missing error when curl_cffi is absent", async () => {
    writeScraplingStub("missing-curl-cffi");

    const result = await executeScraplingTool({
      tool: "extract-html",
      input: {
        url: "https://example.com",
        selectors: {
          heading: "h1",
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(String(result.result)).toContain("dependency_missing");
    expect(String(result.result)).toContain("curl_cffi");
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
