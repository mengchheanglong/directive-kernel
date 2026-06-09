import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const CLI_RELATIVE_PATH = "./hosts/standalone-host/cli.ts";
const TSX_BIN = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(String(tempDirs.pop()), { recursive: true, force: true });
  }
});

describe("runtime capability scaffold cli", () => {
  it("writes a manifest-backed capability scaffold", () => {
    const capabilitiesRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "directive-runtime-capability-"),
    );
    tempDirs.push(capabilitiesRoot);

    const result = spawnSync(
      process.execPath,
      [
        TSX_BIN,
        CLI_RELATIVE_PATH,
        "runtime-capability-scaffold",
        "--capabilities-root",
        capabilitiesRoot,
        "--name",
        "Example Capability",
        "--description",
        "Example scaffold description.",
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        shell: false,
        timeout: 60_000,
      },
    );

    expect(result.error, String(result.error)).toBeUndefined();
    expect(
      result.status,
      `non-zero exit. stderr:\n${result.stderr}\nstdout:\n${result.stdout}`,
    ).toBe(0);

    const body = JSON.parse(result.stdout) as {
      ok: boolean;
      id: string;
      writtenFiles: string[];
      capabilityRoot: string;
    };

    expect(body.ok).toBe(true);
    expect(body.id).toBe("example-capability");
    expect(fs.existsSync(path.join(body.capabilityRoot, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(body.capabilityRoot, "index.ts"))).toBe(true);
    expect(fs.existsSync(path.join(body.capabilityRoot, "executor.ts"))).toBe(true);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(body.capabilityRoot, "manifest.json"), "utf8"),
    ) as { displayName: string; description: string; domain: string };
    expect(manifest.displayName).toBe("Example Capability");
    expect(manifest.description).toBe("Example scaffold description.");
    expect(manifest.domain).toBe("runtime");
  });
});
