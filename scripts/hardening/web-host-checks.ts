import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

import { startDirectiveFrontendServer } from "../../hosts/web-host/server.ts";
import {
  readJsonResponse,
  writeJson,
  writeUtf8,
} from "./support.ts";

export async function runWebHostSmoke() {
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
      learningSummary?: {
        gapRadar?: { suggestionCount?: number };
        earnedAutonomy?: { autoApprovedRecentRuns?: number; routeClasses?: unknown[] };
      };
    };
    assert.equal(snapshot.queue?.totalEntries ?? 0, 0);
    assert.equal(typeof snapshot.learningSummary?.gapRadar?.suggestionCount, "number");
    assert.equal(typeof snapshot.learningSummary?.earnedAutonomy?.autoApprovedRecentRuns, "number");

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

    const afterSubmissionResponse = await fetch(`${handle.origin}/api/snapshot`);
    assert.equal(afterSubmissionResponse.status, 200);
    const afterSubmission = await readJsonResponse(afterSubmissionResponse) as {
      learningSummary?: {
        earnedAutonomy?: { routeClasses?: unknown[] };
      };
    };
    assert.ok((afterSubmission.learningSummary?.earnedAutonomy?.routeClasses?.length ?? 0) >= 1);
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
