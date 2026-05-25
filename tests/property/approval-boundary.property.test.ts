import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  requireDirectiveCurrentStageForOpening,
  requireDirectiveEligibleStatus,
  requireDirectiveExplicitApproval,
  requireDirectiveIntegrityForOpening,
} from "../../engine/approval-boundary.ts";
import { approvalStateArb, type ApprovalScenario } from "./_arbitraries/approval-state.ts";

// `approvalStateArb` covers four guards. For `explicitApproval` and
// `eligibleStatus` it produces both `allowed` and `disallowed` scenarios
// inside Property 5 below. For `integrityForOpening` and
// `currentStageForOpening` it only produces `disallowed` scenarios because
// the `allowed` direction depends on a real on-disk directive root (per the
// note inside `_arbitraries/approval-state.ts`). The two `it(...)` blocks
// after Property 5 cover that allowed direction with a hand-built minimal
// engine-run fixture written to `os.tmpdir()`.

function invokeGuard(scenario: ApprovalScenario): void {
  switch (scenario.guard) {
    case "explicitApproval":
      requireDirectiveExplicitApproval(scenario.input);
      return;
    case "eligibleStatus":
      requireDirectiveEligibleStatus(scenario.input);
      return;
    case "integrityForOpening":
      requireDirectiveIntegrityForOpening(scenario.input);
      return;
    case "currentStageForOpening":
      requireDirectiveCurrentStageForOpening(scenario.input);
      return;
  }
}

// Build a directive-root with one valid `engine_run` artifact (record JSON
// plus its sibling `.md` report). `resolveEngineFocus` reads the JSON,
// `recordMissingLinkedArtifactIfAbsent` checks the `.md` exists, and
// `applyDirectiveWorkspaceIntegrityGate` therefore reports
// `integrityState === "ok"`. This is the cheapest fixture that exercises
// the allowed direction of `requireDirectiveIntegrityForOpening` and
// `requireDirectiveCurrentStageForOpening`.
function seedEngineRunFixture(): { directiveRoot: string; artifactPath: string } {
  const directiveRoot = path.join(os.tmpdir(), `dk-approval-boundary-${randomUUID()}`);
  const runId = "approval-boundary-allowed-fixture";
  const engineRunsDir = path.join(directiveRoot, "runtime", "standalone-host", "engine-runs");
  fs.mkdirSync(engineRunsDir, { recursive: true });

  const artifactPath = `runtime/standalone-host/engine-runs/${runId}.json`;
  const record = {
    runId,
    receivedAt: new Date().toISOString(),
    source: { sourceType: "test", sourceRef: "test://approval-boundary-allowed", title: "fixture" },
    selectedLane: {
      laneId: "discovery",
      label: "Discovery",
      hostDependence: "none",
      valuableWithoutHostRuntime: true,
    },
    candidate: {
      candidateId: "approval-boundary-allowed-candidate",
      candidateName: "Approval Boundary Allowed Fixture",
      recommendedLaneId: "discovery",
      usefulnessLevel: "structural",
      confidence: "low",
      requiresHumanReview: false,
      rationale: ["fixture"],
    },
    analysis: {
      missionFitSummary: "fixture",
      primaryAdoptionQuestion: "fixture",
      usefulnessRationale: "fixture",
      rationale: ["fixture"],
    },
    decision: {
      decisionState: "hold_in_discovery",
      summary: "fixture",
      requiresHumanApproval: false,
      rationale: ["fixture"],
    },
    integrationProposal: {
      targetLaneId: "discovery",
      integrationMode: "structural",
      hostDependence: "none",
      valuableWithoutHostRuntime: true,
      nextAction: "fixture",
    },
    proofPlan: { proofKind: "structural_proof", objective: "fixture" },
    reportPlan: { reportKind: "structural", summary: "fixture", usefulnessRationale: "fixture" },
    events: [],
  };

  fs.writeFileSync(path.join(directiveRoot, artifactPath), JSON.stringify(record), "utf8");
  fs.writeFileSync(path.join(engineRunsDir, `${runId}.md`), "# fixture\n", "utf8");

  return { directiveRoot, artifactPath };
}

describe("approval-boundary", () => {
  // Property 5: Approval boundary classification consistency — see
  // design.md ("Correctness Properties → Property 5: Approval boundary
  // classification consistency"). For any generated `(state, kind)`
  // scenario, the matching guard rejects iff `kind === "disallowed"` and
  // accepts iff `kind === "allowed"`. Generated coverage:
  //   * `explicitApproval` — both directions
  //   * `eligibleStatus` — both directions
  //   * `integrityForOpening` — disallowed only (allowed direction is
  //     covered by the example test below)
  //   * `currentStageForOpening` — disallowed only (allowed direction is
  //     covered by the example test below)
  it("Property 5: guard rejects iff kind === \"disallowed\", accepts iff kind === \"allowed\"", () => {
    fc.assert(
      fc.property(approvalStateArb, (scenario) => {
        if (scenario.kind === "allowed") {
          // Must not throw. Surface any thrown error as a property
          // failure with a readable message — fast-check shows the
          // shrunk scenario alongside.
          invokeGuard(scenario);
        } else {
          expect(() => invokeGuard(scenario)).toThrow();
        }
      }),
      { numRuns: 100 },
    );
  });

  // Example test backing the `allowed` direction of
  // `requireDirectiveIntegrityForOpening`. The integrity-dependent guards
  // resolve workspace state from disk via `resolveDirectiveWorkspaceState`,
  // which Property 5 cannot drive without a seeded fixture (per the note
  // in `_arbitraries/approval-state.ts`).
  it("requireDirectiveIntegrityForOpening accepts an integrity-ok engine_run artifact (example, Property 5)", () => {
    const { directiveRoot, artifactPath } = seedEngineRunFixture();
    expect(() =>
      requireDirectiveIntegrityForOpening({
        directiveRoot,
        artifactPath,
        subject: "approval-boundary fixture",
      }),
    ).not.toThrow();
  });

  // Example test backing the `allowed` direction of
  // `requireDirectiveCurrentStageForOpening`. The fixture's selected lane
  // is `discovery`, so `currentStage` resolves to `engine.route.discovery`
  // (see `resolveEngineFocus` in `engine/state/focus-builders.ts`). Using
  // the prefix selector `engine.route.` exercises the trailing-dot match
  // branch in `directiveStageSelectorMatches`.
  it("requireDirectiveCurrentStageForOpening accepts when current stage matches the allowed list (example, Property 5)", () => {
    const { directiveRoot, artifactPath } = seedEngineRunFixture();
    expect(() =>
      requireDirectiveCurrentStageForOpening({
        directiveRoot,
        artifactPath,
        subject: "approval-boundary fixture",
        allowedCurrentStages: ["engine.route."],
      }),
    ).not.toThrow();
  });
});
