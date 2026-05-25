import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import {
  runStandaloneHostTryCommand,
  type StandaloneHostTryCommandResult,
} from "../../hosts/standalone-host/try-command.ts";

describe("standalone host try command", () => {
  let result: StandaloneHostTryCommandResult;

  beforeAll(async () => {
    // Mirror tests/integration/first-integration.test.ts: each run lands in a
    // unique path under os.tmpdir() with a Date.now() suffix. The runner does
    // this internally when outputRoot is undefined, so we let it own the math
    // and just confirm os is the same module the runner resolves against.
    void os.tmpdir();
    result = await runStandaloneHostTryCommand({ outputRoot: undefined });
  });

  it("returns a non-empty engine run id", () => {
    expect(typeof result.runId).toBe("string");
    expect(result.runId.length).toBeGreaterThan(0);
  });

  it("writes DIRECTIVE_GOAL.md into the directive root", () => {
    expect(fs.existsSync(result.directiveGoalPath)).toBe(true);
    const goalMarkdown = fs.readFileSync(result.directiveGoalPath, "utf8");
    expect(goalMarkdown).toContain("Demonstrate the Directive Kernel");
  });

  it("returns a candidate id matching the sample source", () => {
    expect(result.candidateId).toBe("dw-example-front-door");
  });

  it("returns one of the three known lane ids", () => {
    expect(["discovery", "architecture", "runtime"]).toContain(result.laneId);
  });

  it("returns an artifact path that exists on disk", () => {
    expect(fs.existsSync(result.artifactAbsolutePath)).toBe(true);
    expect(fs.statSync(result.artifactAbsolutePath).size).toBeGreaterThan(0);
  });

  // Property 1 (design.md): For any successful invocation of the Try Command —
  // whether with no --output-root flag, with an explicit --output-root pointing
  // at an existing directory, or with an explicit --output-root pointing at a
  // non-existent nested directory — the artifact path returned points to a
  // file that exists on disk and has non-zero size.
  it("ensures the artifact path is real for default, existing-override, and missing-override roots (Property 1)", async () => {
    // Default: let the runner pick its own temp root.
    const defaultResult = await runStandaloneHostTryCommand({
      outputRoot: undefined,
    });

    // Existing override: pre-create a temp dir and pass it explicitly.
    const existingRoot = path.join(
      os.tmpdir(),
      `directive-kernel-try-prop-existing-${Date.now()}`,
    );
    fs.mkdirSync(existingRoot, { recursive: true });
    const existingResult = await runStandaloneHostTryCommand({
      outputRoot: existingRoot,
    });

    // Missing nested override: deeply nested, never created.
    const missingRoot = path.join(
      os.tmpdir(),
      `directive-kernel-try-prop-missing-${Date.now()}`,
      "deeply",
      "nested",
      "non-existent",
    );
    const missingResult = await runStandaloneHostTryCommand({
      outputRoot: missingRoot,
    });

    for (const propertyResult of [
      defaultResult,
      existingResult,
      missingResult,
    ]) {
      expect(fs.existsSync(propertyResult.artifactAbsolutePath)).toBe(true);
      expect(
        fs.statSync(propertyResult.artifactAbsolutePath).size,
      ).toBeGreaterThan(0);
    }
  });
});
