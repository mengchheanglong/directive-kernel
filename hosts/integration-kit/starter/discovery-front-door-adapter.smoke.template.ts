import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { DiscoverySubmissionRequest } from "../../../discovery/lib/discovery-submission-router.ts";
import { submitDiscoveryEntryThroughFrontDoor } from "./discovery-front-door-adapter.template.ts";

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeUtf8(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

const starterFrontDoorRequest: DiscoverySubmissionRequest = {
  candidate_id: "dw-starter-front-door",
  candidate_name: "Starter Front-Door Candidate",
  source_type: "workflow-writeup",
  source_reference: "https://example.com/starter-front-door",
  mission_alignment: "Improve Directive Workspace engine routing and review clarity.",
  capability_gap_id: "gap-starter-front-door",
  notes: "Starter smoke request for Engine-backed Discovery front door.",
  primary_adoption_target: "architecture",
  contains_workflow_pattern: true,
  improves_directive_workspace: true,
  workflow_boundary_shape: "bounded_protocol",
};

export type DiscoveryFrontDoorStarterSmokeResult = {
  ok: true;
  directiveRoot: string;
  routingTarget: string;
  confidence: string;
  matchedGapId: string | null;
  queuePath: string;
  routingRecordPath: string;
  engineRunRecordPath: string;
};

export async function runDiscoveryFrontDoorStarterSmoke():
Promise<DiscoveryFrontDoorStarterSmokeResult> {
  const directiveRoot = path.resolve(
    os.tmpdir(),
    `directive-workspace-front-door-starter-${Date.now()}`,
  );

  writeJson(path.join(directiveRoot, "discovery", "intake-queue.json"), {
    status: "primary",
    updatedAt: "2026-04-06",
    entries: [],
  });
  writeJson(path.join(directiveRoot, "discovery", "capability-gaps.json"), {
    gaps: [
      {
        gap_id: "gap-starter-front-door",
        description: "Discovery front-door starter smoke needs a structural Engine-improvement gap.",
        priority: "high",
        related_mission_objective: "Improve Directive Workspace engine routing and review clarity.",
        current_state: "External hosts still need a preferred Engine-backed starter path.",
        desired_state: "The integration kit teaches Engine-backed front-door submission first.",
        detected_at: "2026-04-06T00:00:00.000Z",
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
      "Improve the Directive Workspace engine.",
      "",
      "## What Usefulness Means Under This Objective",
      "",
      "- Prefer Engine workflow and reporting improvements when a source primarily upgrades Directive Workspace judgment.",
      "- Prefer reusable runtime capability only when repeated runtime value is the dominant pressure.",
      "",
      "## Capability Lanes That Matter Most",
      "",
      "1. Discovery",
      "2. Runtime",
      "3. Architecture",
      "",
    ].join("\n"),
  );

  const result = await submitDiscoveryEntryThroughFrontDoor({
    directiveRoot,
    request: starterFrontDoorRequest,
    receivedAt: "2026-04-06",
  });

  assert.equal(result.ok, true);
  assert.equal(result.discovery.routingTarget, "architecture");
  assert.ok(["high", "medium"].includes(result.discovery.confidence));
  assert.equal(result.discovery.matchedGapId, "gap-starter-front-door");
  assert.ok(fs.existsSync(path.resolve(directiveRoot, result.createdPaths.routingRecordPath)));
  assert.ok(fs.existsSync(path.resolve(directiveRoot, result.engine.recordRelativePath)));

  return {
    ok: true,
    directiveRoot,
    routingTarget: result.discovery.routingTarget,
    confidence: result.discovery.confidence,
    matchedGapId: result.discovery.matchedGapId,
    queuePath: result.queuePath,
    routingRecordPath: result.createdPaths.routingRecordPath,
    engineRunRecordPath: result.engine.recordRelativePath,
  };
}
