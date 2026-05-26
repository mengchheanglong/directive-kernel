// Unit tests for `engine/workspace-lanes.ts` (task 10.2).
//
// Covers the three lane definitions returned by
// `createDirectiveWorkspaceEngineLanes`:
//
//   - lane id ordering and identity (Requirements 7.1, 7.2)
//   - every plan callback (`planExtraction`, `planAdaptation`,
//     `planImprovement`, `planProof`) on every lane returns a structurally
//     valid plan (Requirement 7.3)
//   - runtime `planProof` branches on
//     `routingAssessment.scoreBreakdown.transformationSignal`:
//     `> 0` → `runtime_transformation_proof`, `=== 0` → `runtime_proof`
//     (Requirements 7.4, 7.5)
//   - architecture `planIntegration` returns a non-empty `nextAction`
//     (Requirement 7.6)
//   - `laneOverrides` propagate from the override map onto the returned
//     lane definitions (Requirement 7.1, override mechanism)
//
// Per the task spec, when invoking a per-lane callback we override
// `planningInput.lane` with the actual lane definition under test;
// otherwise the discovery-shaped fixture lane would leak into
// architecture/runtime callback paths and obscure lane-specific behavior.

import { describe, expect, it } from "vitest";

import { createDirectiveWorkspaceEngineLanes } from "../../../engine/workspace-lanes.ts";
import type { EngineLaneDefinition } from "../../../engine/lane.ts";
import {
  buildAdaptationPlanningInput,
  buildExtractionPlanningInput,
  buildImprovementPlanningInput,
  buildIntegrationPlanningInput,
  buildProofPlanningInput,
  buildRoutingAssessmentWithTransformationSignal,
  buildRoutingAssessmentWithoutTransformationSignal,
} from "./_fixtures/lane-planning-inputs.ts";

const EXPECTED_LANE_IDS = ["discovery", "architecture", "runtime"] as const;
type ExpectedLaneId = (typeof EXPECTED_LANE_IDS)[number];

function findLane(
  set: ReturnType<typeof createDirectiveWorkspaceEngineLanes>,
  laneId: string,
): EngineLaneDefinition {
  const lane = set.lanes.find((candidate) => candidate.laneId === laneId);
  if (!lane) {
    throw new Error(`expected lane "${laneId}" to be present in the lane set`);
  }
  return lane;
}

describe("createDirectiveWorkspaceEngineLanes", () => {
  it("returns three lanes with the expected ids", () => {
    const set = createDirectiveWorkspaceEngineLanes();
    expect(set.lanes.map((lane) => lane.laneId)).toEqual([
      "discovery",
      "architecture",
      "runtime",
    ]);
  });

  describe.each(EXPECTED_LANE_IDS)("lane %s", (laneId: ExpectedLaneId) => {
    it("planExtraction returns a structurally valid plan", () => {
      const lane = findLane(createDirectiveWorkspaceEngineLanes(), laneId);
      if (!lane.planExtraction) {
        throw new Error(`lane "${laneId}" is missing planExtraction`);
      }
      const input = buildExtractionPlanningInput();
      input.planningInput.lane = lane;
      const plan = lane.planExtraction(input);
      expect(Array.isArray(plan.extractedValue)).toBe(true);
      expect(plan.extractedValue.length).toBeGreaterThan(0);
      expect(Array.isArray(plan.excludedBaggage)).toBe(true);
    });

    it("planAdaptation returns a structurally valid plan", () => {
      const lane = findLane(createDirectiveWorkspaceEngineLanes(), laneId);
      if (!lane.planAdaptation) {
        throw new Error(`lane "${laneId}" is missing planAdaptation`);
      }
      const input = buildAdaptationPlanningInput();
      input.planningInput.lane = lane;
      const plan = lane.planAdaptation(input);
      expect(typeof plan.directiveOwnedForm).toBe("string");
      expect(plan.directiveOwnedForm.length).toBeGreaterThan(0);
      expect(Array.isArray(plan.adaptedValue)).toBe(true);
      expect(plan.adaptedValue.length).toBeGreaterThan(0);
    });

    it("planImprovement returns a structurally valid plan", () => {
      const lane = findLane(createDirectiveWorkspaceEngineLanes(), laneId);
      if (!lane.planImprovement) {
        throw new Error(`lane "${laneId}" is missing planImprovement`);
      }
      const input = buildImprovementPlanningInput();
      input.planningInput.lane = lane;
      const plan = lane.planImprovement(input);
      expect(Array.isArray(plan.improvementGoals)).toBe(true);
      expect(plan.improvementGoals.length).toBeGreaterThan(0);
      expect(typeof plan.intendedDelta).toBe("string");
      expect(plan.intendedDelta.length).toBeGreaterThan(0);
    });

    it("planProof returns a structurally valid plan", () => {
      const lane = findLane(createDirectiveWorkspaceEngineLanes(), laneId);
      if (!lane.planProof) {
        throw new Error(`lane "${laneId}" is missing planProof`);
      }
      const input = buildProofPlanningInput();
      input.planningInput.lane = lane;
      const plan = lane.planProof(input);
      expect(typeof plan.proofKind).toBe("string");
      expect(plan.proofKind.length).toBeGreaterThan(0);
      expect(typeof plan.objective).toBe("string");
      expect(plan.objective.length).toBeGreaterThan(0);
      expect(Array.isArray(plan.requiredEvidence)).toBe(true);
      expect(plan.requiredEvidence.length).toBeGreaterThan(0);
      expect(Array.isArray(plan.requiredGates)).toBe(true);
      expect(plan.requiredGates.length).toBeGreaterThan(0);
      expect(typeof plan.rollbackPrompt).toBe("string");
      expect(plan.rollbackPrompt.length).toBeGreaterThan(0);
    });
  });

  it("runtime planProof returns runtime_transformation_proof when transformationSignal > 0", () => {
    const runtimeLane = findLane(createDirectiveWorkspaceEngineLanes(), "runtime");
    if (!runtimeLane.planProof) {
      throw new Error("runtime lane is missing planProof");
    }
    const input = buildProofPlanningInput();
    input.planningInput.lane = runtimeLane;
    input.planningInput.routingAssessment =
      buildRoutingAssessmentWithTransformationSignal();
    const plan = runtimeLane.planProof(input);
    expect(plan.proofKind).toBe("runtime_transformation_proof");
  });

  it("runtime planProof returns runtime_proof when transformationSignal === 0", () => {
    const runtimeLane = findLane(createDirectiveWorkspaceEngineLanes(), "runtime");
    if (!runtimeLane.planProof) {
      throw new Error("runtime lane is missing planProof");
    }
    const input = buildProofPlanningInput();
    input.planningInput.lane = runtimeLane;
    input.planningInput.routingAssessment =
      buildRoutingAssessmentWithoutTransformationSignal();
    const plan = runtimeLane.planProof(input);
    expect(plan.proofKind).toBe("runtime_proof");
  });

  it("architecture planIntegration returns a non-empty nextAction", () => {
    const architectureLane = findLane(
      createDirectiveWorkspaceEngineLanes(),
      "architecture",
    );
    if (!architectureLane.planIntegration) {
      throw new Error("architecture lane is missing planIntegration");
    }
    const input = buildIntegrationPlanningInput();
    input.planningInput.lane = architectureLane;
    const proposal = architectureLane.planIntegration(input);
    expect(typeof proposal.nextAction).toBe("string");
    expect((proposal.nextAction ?? "").length).toBeGreaterThan(0);
  });

  it("respects laneOverrides", () => {
    const customLabel = "Custom Discovery Label";
    const set = createDirectiveWorkspaceEngineLanes({
      laneOverrides: { discovery: { label: customLabel } },
    });
    const discoveryLane = findLane(set, "discovery");
    expect(discoveryLane.label).toBe(customLabel);
    // Other lanes are untouched.
    expect(findLane(set, "architecture").label).toBe("Architecture");
    expect(findLane(set, "runtime").label).toBe("Runtime");
  });
});
