import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { readJson } from "../../shared/lib/file-io.ts";
import { runFirstHostIntegrationFlow, type FirstHostGoalEnvelopeInput, type FirstHostSourceInput } from "../../hosts/integration-kit/lib/first-host-integration.ts";

describe("incident-triage example", () => {
  const tmpDir = path.join(os.tmpdir(), `dk-incident-triage-${randomUUID()}`);
  let result: Awaited<ReturnType<typeof runFirstHostIntegrationFlow>>;

  beforeAll(async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const examplesRoot = path.resolve("hosts/integration-kit/examples/incident-triage");
    const goal = readJson<FirstHostGoalEnvelopeInput>(path.join(examplesRoot, "goal-envelope.json"));
    const source = readJson<FirstHostSourceInput>(path.join(examplesRoot, "sample-source.json"));
    result = await runFirstHostIntegrationFlow({ directiveRoot: tmpDir, goal, source });
  }, 120_000);

  afterAll(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("returns ok", () => {
    expect(result.submission.ok).toBe(true);
  });

  it("routes to a valid lane", () => {
    expect(["discovery", "runtime", "architecture"]).toContain(
      result.submission.engine.record.selectedLane.laneId,
    );
  });

  it("produces a decision state", () => {
    expect(typeof result.submission.engine.record.decision.decisionState).toBe("string");
    expect(result.submission.engine.record.decision.decisionState).toBeTruthy();
  });

  it("writes routing artifacts to disk", () => {
    const recordPath = path.join(tmpDir, result.submission.engine.recordRelativePath);
    expect(fs.existsSync(recordPath)).toBe(true);
  });
});
