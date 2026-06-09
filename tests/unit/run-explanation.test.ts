import { describe, expect, it } from "vitest";
import { buildRunExplanation } from "../../hosts/web-host/data/run-explanation.ts";
import type { NextLegalAction } from "../../hosts/web-host/data/next-legal-actions.ts";

describe("buildRunExplanation", () => {
  it("uses selectedLane.laneId first", () => {
    const explanation = buildRunExplanation({
      run: {
        runId: "run_1",
        selectedLane: { laneId: "runtime" },
        routingAssessment: { recommendedLaneId: "architecture" },
      },
    });
    expect(explanation.lane).toBe("runtime");
    expect(explanation.status).toBe("routed");
    expect(explanation.blockingConditions).toEqual([]);
  });

  it("falls back to routingAssessment.recommendedLaneId", () => {
    const explanation = buildRunExplanation({
      run: {
        runId: "run_2",
        routingAssessment: { recommendedLaneId: "discovery" },
      },
    });
    expect(explanation.lane).toBe("discovery");
    expect(explanation.status).toBe("routed");
  });

  it("returns null lane and unknown status when both are absent", () => {
    const explanation = buildRunExplanation({
      run: { runId: "run_3" },
    });
    expect(explanation.lane).toBeNull();
    expect(explanation.status).toBe("unknown");
    expect(explanation.blockingConditions).toEqual(["routing lane unavailable"]);
  });

  it("returns unknown status and blocking condition when selectedLane has no laneId", () => {
    const explanation = buildRunExplanation({
      run: { runId: "run_4", selectedLane: {} },
    });
    expect(explanation.status).toBe("unknown");
    expect(explanation.blockingConditions).toEqual(["routing lane unavailable"]);
  });

  it("encodes runId in rawRecordPath", () => {
    const explanation = buildRunExplanation({
      run: { runId: "run 5/with special chars!" },
    });
    expect(explanation.rawRecordPath).toBe(
      "/api/engine-runs/run%205%2Fwith%20special%20chars!",
    );
  });

  it("produces deterministic summary with lane", () => {
    const explanation = buildRunExplanation({
      run: {
        runId: "run_6",
        selectedLane: { laneId: "runtime" },
      },
    });
    expect(explanation.summary).toBe("Run run_6: routed to runtime.");
  });

  it("produces deterministic summary without lane", () => {
    const explanation = buildRunExplanation({
      run: { runId: "run_7" },
    });
    expect(explanation.summary).toBe("Run run_7: no lane assigned.");
  });

  it("passes through nextLegalActions and relatedArtifacts", () => {
    const actions: NextLegalAction[] = [{
      name: "test",
      label: "Test",
      requiresApproval: true,
      source: "nextLegalStep",
    }];
    const artifacts = ["path/to/artifact.md"];
    const explanation = buildRunExplanation({
      run: { runId: "run_8" },
      nextLegalActions: actions,
      relatedArtifacts: artifacts,
    });
    expect(explanation.nextLegalActions).toEqual(actions);
    expect(explanation.relatedArtifacts).toEqual(artifacts);
  });

  it("defaults nextLegalActions and relatedArtifacts to empty arrays", () => {
    const explanation = buildRunExplanation({
      run: { runId: "run_9" },
    });
    expect(explanation.nextLegalActions).toEqual([]);
    expect(explanation.relatedArtifacts).toEqual([]);
  });
});
