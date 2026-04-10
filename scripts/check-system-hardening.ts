/// <reference types="node" />

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DirectiveEngine,
  createDirectiveWorkspaceEngineLanes,
  createMemoryDirectiveEngineStore,
  assessDirectiveEngineRouting,
  readRoutingCorrectionLedger,
  appendRoutingCorrection,
  extractSourceSignalTokens,
  deriveRoutingCorrectionAdjustments,
  type DirectiveEngineCapabilityGap,
  type DirectiveEngineMissionInput,
  type DirectiveEngineProcessSourceInput,
  type RoutingCorrectionEntry,
} from "../engine/index.ts";
import { appendDiscoveryIntakeQueueEntry } from "../discovery/lib/discovery-intake-queue-writer.ts";
import { startDirectiveFrontendServer } from "../hosts/web-host/server.ts";
import {
  runDiscoveryStarterSmoke,
} from "../hosts/integration-kit/starter/discovery-submission-adapter.smoke.template.ts";
import {
  runDiscoveryFrontDoorStarterSmoke,
} from "../hosts/integration-kit/starter/discovery-front-door-adapter.smoke.template.ts";
import {
  runHostIntegrationAcceptanceQuickstart,
} from "../hosts/integration-kit/starter/run-host-integration-acceptance-quickstart.template.ts";

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeUtf8(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function buildArchitectureGap(): DirectiveEngineCapabilityGap {
  return {
    gapId: "gap-arch-routing-clarity",
    description: "Architecture routing clarity and bounded workflow ownership",
    priority: "high",
    relatedMissionObjective: "Improve directive workspace routing workflow architecture boundaries",
    currentState: "Clear architecture candidates still require extra manual routing work",
    desiredState: "High-signal architecture candidates auto-open one bounded downstream stub",
    detectedAt: "2026-04-10T00:00:00.000Z",
  };
}

function buildArchitectureMission(): DirectiveEngineMissionInput {
  return {
    missionId: "hardening-smoke",
    currentObjective: "Improve directive workspace routing workflow architecture boundaries",
    usefulnessSignals: [
      "prefer engine routing and workflow improvements when the source upgrades directive workspace judgment",
      "prefer bounded architecture ownership for sources that improve directive workspace itself",
    ],
    capabilityLanes: [
      "architecture",
      "discovery",
      "runtime",
    ],
  };
}

function buildArchitectureSourceInput(): DirectiveEngineProcessSourceInput {
  return {
    receivedAt: "2026-04-10T00:00:00.000Z",
    mission: buildArchitectureMission(),
    gaps: [buildArchitectureGap()],
    source: {
      sourceId: "architecture-auto-open",
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/architecture-auto-open",
      title: "Architecture Auto-Open Workflow",
      summary: "Improve directive workspace routing workflow architecture boundaries with explicit gates.",
      missionAlignmentHint: "Improve directive workspace routing workflow architecture boundaries",
      capabilityGapId: "gap-arch-routing-clarity",
      primaryAdoptionTarget: "architecture",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
      notes: [
        "Preserve architecture workflow boundaries.",
      ],
    },
  };
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function runDirectiveEngineHardeningChecks() {
  const engine = new DirectiveEngine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: createMemoryDirectiveEngineStore(),
    hostAdapters: [
      {
        id: "throws",
        async onRunRecorded() {
          throw new Error("boom");
        },
      },
      {
        id: "accepts",
        async onRunRecorded() {
          return {
            accepted: true,
            note: "recorded",
          };
        },
      },
    ],
  });

  await assert.rejects(
    engine.processSource({
      mission: buildArchitectureMission(),
      source: {
        sourceType: "paper",
        sourceRef: "",
        title: "",
      },
    }),
    /source\.sourceRef is required/u,
  );

  const first = await engine.processSource(buildArchitectureSourceInput());
  assert.equal(first.record.selectedLane.laneId, "architecture");
  assert.equal(first.record.decision.requiresHumanApproval, false);
  assert.equal(first.record.decision.decisionState, "accept_for_architecture");
  assert.equal(first.adapterResults.length, 2);
  assert.equal(first.adapterResults[0]?.accepted, false);
  assert.match(first.adapterResults[0]?.note ?? "", /adapter error: boom/u);
  assert.equal(first.adapterResults[1]?.accepted, true);

  const second = await engine.processSource(buildArchitectureSourceInput());
  assert.equal(second.deduplicated, true);
  assert.equal(second.duplicateOfRunId, first.record.runId);

  const firstQueueAppend = appendDiscoveryIntakeQueueEntry({
    queue: {
      status: "primary",
      updatedAt: "2026-04-10",
      entries: [],
    },
    submission: {
      candidate_id: "duplicate-a",
      candidate_name: "Duplicate Candidate",
      source_type: "workflow-writeup",
      source_reference: "https://example.com/duplicate-candidate",
      mission_alignment: "Improve directive workspace routing workflow architecture boundaries",
      capability_gap_id: "gap-arch-routing-clarity",
      notes: "first copy",
    },
    receivedAt: "2026-04-10",
    unresolvedGapIds: ["gap-arch-routing-clarity"],
  });

  assert.throws(
    () => appendDiscoveryIntakeQueueEntry({
      queue: firstQueueAppend.queue,
      submission: {
        candidate_id: "duplicate-b",
        candidate_name: "Duplicate Candidate",
        source_type: "workflow-writeup",
        source_reference: "https://example.com/duplicate-candidate",
        mission_alignment: "Improve directive workspace routing workflow architecture boundaries",
        capability_gap_id: "gap-arch-routing-clarity",
        notes: "second copy with different notes",
      },
      receivedAt: "2026-04-10",
      unresolvedGapIds: ["gap-arch-routing-clarity"],
    }),
    /equivalent submission/u,
  );
}

function runEngineContractSurfaceChecks() {
  // Verify routing assessment includes missionSpecificityWarning when mission is vague.
  const vagueResult = assessDirectiveEngineRouting({
    source: {
      sourceType: "paper",
      sourceRef: "https://example.com/test",
      title: "Some paper about improving systems",
      summary: "A paper about improving systems.",
    },
    mission: {
      missionId: "vague",
      currentObjective: "Improve the system",
      usefulnessSignals: [],
      capabilityLanes: ["architecture"],
      activeMissionMarkdown: "",
    },
    openGaps: [],
  });
  assert.ok(
    vagueResult.missionSpecificityWarning !== null,
    "Vague mission objective must produce a specificity warning",
  );
  assert.ok(
    vagueResult.missionSpecificityWarning.includes("generic tokens"),
    "Warning must mention generic tokens",
  );

  // Verify specific mission does NOT produce a warning.
  const specificResult = assessDirectiveEngineRouting({
    source: {
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/test2",
      title: "Architecture routing clarity improvements",
    },
    mission: {
      missionId: "specific",
      currentObjective: "Improve directive workspace routing workflow architecture boundaries",
      usefulnessSignals: ["prefer engine routing improvements"],
      capabilityLanes: ["architecture", "discovery", "runtime"],
      activeMissionMarkdown: "",
    },
    openGaps: [],
  });
  assert.equal(
    specificResult.missionSpecificityWarning,
    null,
    "Specific mission must not produce a specificity warning",
  );

  // Verify strong metadata prevents false keyword conflicts.
  const metadataOverrideResult = assessDirectiveEngineRouting({
    source: {
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/test3",
      title: "Runtime workflow performance evaluation routing analysis",
      summary: "Improve architecture evaluation and runtime automation routing.",
      primaryAdoptionTarget: "architecture",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
    },
    mission: {
      missionId: "test",
      currentObjective: "Improve directive workspace routing workflow architecture boundaries",
      usefulnessSignals: ["prefer engine routing improvements"],
      capabilityLanes: ["architecture", "discovery", "runtime"],
      activeMissionMarkdown: "",
    },
    openGaps: [],
  });
  assert.equal(
    metadataOverrideResult.recommendedLaneId,
    "architecture",
    "Strong architecture metadata must win despite runtime keywords",
  );
  assert.equal(
    metadataOverrideResult.routeConflict,
    false,
    "Strong metadata must suppress keyword-only conflicts",
  );
  assert.equal(
    metadataOverrideResult.confidence,
    "high",
    "Strong metadata + no conflict must produce high confidence",
  );
}

async function runRoutingCorrectionLedgerChecks() {
  const ledgerRoot = path.resolve(
    os.tmpdir(),
    `directive-kernel-ledger-check-${Date.now()}`,
  );

  // Empty ledger returns default.
  const empty = readRoutingCorrectionLedger(ledgerRoot);
  assert.equal(empty.schemaVersion, 1);
  assert.equal(empty.corrections.length, 0);

  // Append a correction.
  const entry: RoutingCorrectionEntry = {
    correctedAt: "2026-04-10",
    candidateId: "test-candidate",
    sourceType: "workflow-writeup",
    originalLaneId: "runtime",
    correctedLaneId: "architecture",
    reason: "This was actually an architecture workflow improvement",
    sourceSignalTokens: ["workflow", "architecture", "improvement", "routing", "engine"],
  };
  appendRoutingCorrection({ directiveRoot: ledgerRoot, entry });

  // Read back and verify.
  const afterAppend = readRoutingCorrectionLedger(ledgerRoot);
  assert.equal(afterAppend.corrections.length, 1);
  assert.equal(afterAppend.corrections[0].candidateId, "test-candidate");
  assert.equal(afterAppend.corrections[0].originalLaneId, "runtime");
  assert.equal(afterAppend.corrections[0].correctedLaneId, "architecture");

  // Derive adjustments for matching source text.
  const adjustments = deriveRoutingCorrectionAdjustments({
    sourceText: "This workflow architecture improvement routing engine feature",
    corrections: afterAppend.corrections,
  });
  assert.ok(
    (adjustments.architecture ?? 0) > 0,
    "Corrected lane must get a positive adjustment",
  );
  assert.ok(
    (adjustments.runtime ?? 0) < 0,
    "Original lane must get a negative adjustment",
  );

  // Non-matching source text should produce no adjustments.
  const noMatch = deriveRoutingCorrectionAdjustments({
    sourceText: "Completely unrelated topic about cooking",
    corrections: afterAppend.corrections,
  });
  assert.equal(Object.keys(noMatch).length, 0, "Non-matching text must produce no adjustments");

  // Token extraction.
  const tokens = extractSourceSignalTokens("Architecture Workflow Improvement Engine");
  assert.ok(tokens.length > 0);
  assert.ok(tokens.every((t) => t === t.toLowerCase()), "Tokens must be lowercased");
  assert.ok(tokens.every((t) => t.length >= 4), "Tokens must be at least 4 chars");

  // Verify corrections flow through processSource.
  const engine = new DirectiveEngine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: createMemoryDirectiveEngineStore(),
  });
  // A source that mentions the same tokens as the correction should route
  // with the correction bias applied.
  const correctedSource: DirectiveEngineProcessSourceInput = {
    source: {
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/correction-test",
      title: "Workflow architecture improvement routing engine",
      summary: "This source improves architecture workflow routing and engine evaluation.",
      primaryAdoptionTarget: "architecture",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
    },
    mission: buildArchitectureMission(),
    gaps: [buildArchitectureGap()],
    corrections: afterAppend.corrections,
  };
  // This should not throw — the corrections parameter is accepted and processed.
  const correctedResult = await engine.processSource(correctedSource);
  assert.equal(correctedResult.record.selectedLane.laneId, "architecture");
  assert.ok(
    correctedResult.record.routingAssessment.rationale.some((line) =>
      line.includes("Routing correction ledger applied adjustments:")
    ),
    "Engine result must record when routing correction adjustments were applied",
  );
}

async function runStarterAndHostChecks() {
  const discoveryStarter = await runDiscoveryStarterSmoke();
  assert.equal(discoveryStarter.ok, true);

  const frontDoorStarter = await runDiscoveryFrontDoorStarterSmoke();
  assert.equal(frontDoorStarter.ok, true);
  assert.ok(fs.existsSync(path.resolve(frontDoorStarter.directiveRoot, frontDoorStarter.routingRecordPath)));
  assert.ok(fs.existsSync(path.resolve(frontDoorStarter.directiveRoot, frontDoorStarter.engineRunRecordPath)));

  const acceptanceOutputRoot = path.resolve(
    os.tmpdir(),
    `directive-workspace-acceptance-${Date.now()}`,
  );
  const acceptance = await runHostIntegrationAcceptanceQuickstart({
    hostName: "Directive Kernel Hardening Smoke",
    moduleSurface: "mixed",
    generatedAt: "2026-04-10T00:00:00.000Z",
    outputRoot: acceptanceOutputRoot,
  });
  assert.ok(fs.existsSync(acceptance.outputPath));
  const acceptanceReport = JSON.parse(fs.readFileSync(acceptance.outputPath, "utf8")) as {
    accepted?: boolean;
    front_door_acceptance?: { ok?: boolean };
    engine_contract_surface?: { ok?: boolean };
  };
  assert.equal(acceptanceReport.accepted, true);
  assert.equal(acceptanceReport.front_door_acceptance?.ok, true);
  assert.equal(acceptanceReport.engine_contract_surface?.ok, true);
}

async function runWebHostSmoke() {
  const directiveRoot = path.resolve(
    os.tmpdir(),
    `directive-kernel-web-smoke-${Date.now()}`,
  );

  writeJson(path.join(directiveRoot, "discovery", "intake-queue.json"), {
    status: "primary",
    updatedAt: "2026-04-10",
    entries: [],
  });
  writeJson(path.join(directiveRoot, "discovery", "capability-gaps.json"), {
    gaps: [
      {
        gap_id: "gap-web-architecture",
        description: "Auto-open clear architecture candidates from the web host front door",
        priority: "high",
        related_mission_objective: "Improve directive workspace routing workflow architecture boundaries",
        current_state: "Operators still spend time opening obvious architecture routes manually",
        desired_state: "The web host auto-opens one bounded architecture handoff when the route is clear",
        detected_at: "2026-04-10T00:00:00.000Z",
        resolved_at: null,
        resolution_notes: null,
      },
    ],
  });
  writeUtf8(
    path.join(directiveRoot, "knowledge", "active-mission.md"),
    [
      "# Active Mission",
      "",
      "## Current Objective",
      "",
      "Improve directive workspace routing workflow architecture boundaries.",
      "",
      "## What Usefulness Means Under This Objective",
      "",
      "- Prefer architecture when the source improves directive workspace routing quality.",
      "- Keep runtime only for repeated executable runtime value.",
      "",
      "## Capability Lanes That Matter Most",
      "",
      "1. Architecture",
      "2. Discovery",
      "3. Runtime",
      "",
    ].join("\n"),
  );

  const handle = await startDirectiveFrontendServer({
    directiveRoot,
    host: "127.0.0.1",
    port: 0,
  });

  try {
    const snapshotResponse = await fetch(`${handle.origin}/api/snapshot`);
    assert.equal(snapshotResponse.status, 200);
    const snapshot = await readJsonResponse(snapshotResponse) as {
      queue?: { totalEntries?: number };
    };
    assert.equal(snapshot.queue?.totalEntries ?? 0, 0);

    const submissionPayload = {
      candidate_id: "web-host-auto-architecture",
      candidate_name: "Web Host Auto Architecture",
      source_type: "workflow-writeup",
      source_reference: "https://example.com/web-host-auto-architecture",
      mission_alignment: "Improve directive workspace routing workflow architecture boundaries",
      capability_gap_id: "gap-web-architecture",
      notes: "web-host smoke",
      primary_adoption_target: "architecture",
      contains_workflow_pattern: true,
      improves_directive_workspace: true,
      workflow_boundary_shape: "bounded_protocol",
    };

    const frontDoorResponse = await fetch(`${handle.origin}/api/discovery/front-door`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(submissionPayload),
    });
    assert.equal(frontDoorResponse.status, 200);
    const frontDoorResult = await readJsonResponse(frontDoorResponse) as {
      createdPaths: { routingRecordPath: string };
      downstream: {
        autoOpened: boolean;
        stubRelativePath: string | null;
      };
      queueEntry: {
        result_record_path: string | null;
      };
      engine: {
        record: {
          decision: {
            requiresHumanApproval: boolean;
          };
        };
      };
    };
    assert.equal(frontDoorResult.engine.record.decision.requiresHumanApproval, false);
    assert.equal(frontDoorResult.downstream.autoOpened, true);
    assert.ok(frontDoorResult.downstream.stubRelativePath);
    assert.equal(
      frontDoorResult.queueEntry.result_record_path,
      frontDoorResult.downstream.stubRelativePath,
    );
    assert.ok(fs.existsSync(path.resolve(directiveRoot, frontDoorResult.createdPaths.routingRecordPath)));
    assert.ok(fs.existsSync(path.resolve(directiveRoot, frontDoorResult.downstream.stubRelativePath ?? "")));

    const duplicateResponse = await fetch(`${handle.origin}/api/discovery/front-door`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...submissionPayload,
        candidate_id: "web-host-auto-architecture-duplicate",
        notes: "same source, different note",
      }),
    });
    assert.equal(duplicateResponse.status, 409);

    const queueResponse = await fetch(`${handle.origin}/api/queue`);
    assert.equal(queueResponse.status, 200);
    const queue = await readJsonResponse(queueResponse) as {
      totalEntries?: number;
      entries?: Array<{ candidate_id?: string }>;
    };
    assert.equal(queue.totalEntries, 1);
    assert.equal(queue.entries?.[0]?.candidate_id, "web-host-auto-architecture");
  } finally {
    await handle.close();
  }
}

async function main() {
  await runDirectiveEngineHardeningChecks();
  runEngineContractSurfaceChecks();
  await runRoutingCorrectionLedgerChecks();
  await runStarterAndHostChecks();
  await runWebHostSmoke();
  console.log("check-system-hardening: ok");
}

await main();
