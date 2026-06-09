import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runFirstHostIntegrationFlow } from "../../hosts/integration-kit/lib/first-host-integration.ts";

const REPO_ROOT = process.cwd();
const CLI_RELATIVE_PATH = "./hosts/standalone-host/cli.ts";
const TSX_BIN = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");

let directiveRoot = "";
let runId = "";
let missionChangePath = "";

describe("engine replay cli", () => {
  beforeAll(async () => {
    directiveRoot = path.resolve(
      os.tmpdir(),
      `directive-kernel-engine-replay-cli-${Date.now()}`,
      "directive-root",
    );
    const firstFlow = await runFirstHostIntegrationFlow({
      directiveRoot,
      goal: {
        goalId: "engine-replay-cli-check",
        goalStatement: "Verify the standalone replay CLI over one real engine run.",
        whyNow: "The replay CLI should expose bounded what-if routing without writes.",
        adoptionTarget: "runtime",
        constraints: ["keep replay non-persistent", "surface drift explicitly"],
        successSignal: "Replay CLI returns one approximate replay with a mission-change drift record.",
      },
      source: {
        candidateId: "engine-replay-cli-source",
        candidateName: "Engine Replay CLI Source",
        sourceType: "workflow-writeup",
        sourceReference: "https://example.com/engine-replay-cli-source",
        summary: "Exercise the replay CLI through a real engine-backed submission.",
        notes: "engine replay cli verification",
        containsWorkflowPattern: true,
        improvesDirectiveWorkspace: true,
        workflowBoundaryShape: "bounded_protocol",
      },
    });
    runId = firstFlow.submission.engine.record.runId;
    missionChangePath = path.join(path.dirname(directiveRoot), "mission-change.json");
    fs.writeFileSync(
      missionChangePath,
      `${JSON.stringify({
        objective: "Shift the replay toward an architecture-first outcome.",
        capabilityLanes: ["Architecture"],
      }, null, 2)}\n`,
      "utf8",
    );
  }, 60_000);

  afterAll(() => {
    if (missionChangePath && fs.existsSync(missionChangePath)) {
      fs.rmSync(missionChangePath, { force: true });
    }
    if (directiveRoot && fs.existsSync(path.dirname(directiveRoot))) {
      fs.rmSync(path.dirname(directiveRoot), { recursive: true, force: true });
    }
  });

  it("prints a non-persistent approximate replay payload", () => {
    const result = spawnSync(
      process.execPath,
      [
        TSX_BIN,
        CLI_RELATIVE_PATH,
        "engine-replay",
        "--directive-root",
        directiveRoot,
        "--run-id",
        runId,
        "--mission-change-json-path",
        missionChangePath,
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
      replay: {
        nonPersistent: boolean;
        determinism: { mode: string; driftedInputs: Array<{ kind: string; }>; };
      };
    };

    expect(body.ok).toBe(true);
    expect(body.replay.nonPersistent).toBe(true);
    expect(body.replay.determinism.mode).toBe("approximate");
    expect(body.replay.determinism.driftedInputs.some((entry) => entry.kind === "mission_change")).toBe(true);
  });
});
