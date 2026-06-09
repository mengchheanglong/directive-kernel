import { describe, expect, it } from "vitest";

import { Engine, createMemoryEngineStore, createDirectiveWorkspaceEngineLanes } from "../../engine/index.ts";

describe("run replay", () => {
  it("returns an exact non-persistent replay when inputs match the original run", async () => {
    const engine = new Engine({
      laneSet: createDirectiveWorkspaceEngineLanes(),
      store: createMemoryEngineStore(),
    });

    const processed = await engine.processSource({
      receivedAt: "2026-06-09T00:00:00.000Z",
      mission: {
        currentObjective: "Turn a bounded source into one reusable runtime capability or architecture improvement.",
        usefulnessSignals: ["bounded reuse", "clear workflow step"],
        capabilityLanes: ["Runtime", "Architecture"],
        constraints: ["keep discovery first", "do not widen autonomy"],
        successSignal: "One clear next legal action is produced.",
        adoptionTarget: "runtime",
      },
      source: {
        sourceId: "replay-unit-source",
        sourceType: "internal-signal",
        sourceRef: "inline://replay-unit-source",
        title: "Replay Unit Source",
        summary: "Replay baseline coverage.",
        containsWorkflowPattern: true,
        improvesDirectiveWorkspace: true,
        workflowBoundaryShape: "bounded_protocol",
      },
    });

    const replay = await engine.replayRun({
      runId: processed.record.runId,
    });

    expect(replay.nonPersistent).toBe(true);
    expect(replay.determinism.mode).toBe("exact");
    expect(replay.determinism.driftedInputs).toEqual([]);
    expect(replay.baseline.recommendedLaneId).toBe(processed.record.routingAssessment.recommendedLaneId);
    expect(replay.replay.recommendedLaneId).toBe(processed.record.routingAssessment.recommendedLaneId);
  });

  it("marks replay approximate when mission changes are applied", async () => {
    const engine = new Engine({
      laneSet: createDirectiveWorkspaceEngineLanes(),
      store: createMemoryEngineStore(),
    });

    const processed = await engine.processSource({
      receivedAt: "2026-06-09T00:00:00.000Z",
      mission: {
        currentObjective: "Improve the directive workspace with one bounded change.",
        usefulnessSignals: ["clear improvement"],
        capabilityLanes: ["Architecture"],
        constraints: ["keep review explicit"],
        successSignal: "One bounded improvement route is chosen.",
        adoptionTarget: "architecture",
      },
      source: {
        sourceId: "replay-unit-source-approximate",
        sourceType: "internal-signal",
        sourceRef: "inline://replay-unit-source-approximate",
        title: "Replay Approximate Source",
        summary: "Replay mission-change coverage.",
        containsWorkflowPattern: true,
        improvesDirectiveWorkspace: true,
        workflowBoundaryShape: "bounded_protocol",
      },
    });

    const replay = await engine.replayRun({
      runId: processed.record.runId,
      replayInput: {
        missionChange: {
          capabilityLanes: ["Runtime"],
          objective: "Shift this source toward a reusable runtime capability.",
        },
      },
    });

    expect(replay.nonPersistent).toBe(true);
    expect(replay.determinism.mode).toBe("approximate");
    expect(replay.overrides.missionFieldsChanged).toEqual(["capabilityLanes", "objective"]);
    expect(replay.determinism.driftedInputs.some((entry) => entry.kind === "mission_change")).toBe(true);
  });
});
