import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import {
  runFirstHostIntegrationFlow,
} from "../hosts/integration-kit/lib/first-host-integration.ts";

async function main() {
  const directiveRoot = path.resolve(
    os.tmpdir(),
    `directive-kernel-first-integration-${Date.now()}`,
    "directive-root",
  );

  const result = await runFirstHostIntegrationFlow({
    directiveRoot,
    goal: {
      goalId: "first-integration-check",
      goalStatement:
        "Improve the host operating system with one bounded useful capability or one bounded engine improvement.",
      whyNow:
        "Verify the first real consuming-host integration path without reimplementing kernel logic.",
      adoptionTarget: "architecture",
      constraints: [
        "keep Discovery first",
        "keep review explicit",
        "do not widen autonomy",
      ],
      successSignal:
        "One source passes through Discovery and yields a kernel-owned summary plus bounded review state.",
    },
    source: {
      candidateId: "first-integration-check-source",
      candidateName: "First Integration Check Source",
      sourceType: "workflow-writeup",
      sourceReference: "https://example.com/first-integration-check-source",
      summary:
        "Probe a bounded first-host integration path through the Engine-backed Discovery front door.",
      notes: "first integration verification",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
    },
  });

  assert.equal(result.goalResolution.ok, true);
  assert.equal(result.request.candidate_id, "first-integration-check-source");
  assert.equal(result.submission.ok, true);
  assert.equal(result.snapshot.discoveryOverview.totalEntries, 1);
  assert.equal(result.snapshot.discoveryOverview.recentEntries[0]?.candidateId, "first-integration-check-source");
  assert.equal(result.snapshot.workspaceState.engine.totalRuns, 1);
  assert.equal(typeof result.snapshot.workspaceState.focus?.artifactPath, "string");
  assert.equal(typeof result.snapshot.operatorInbox.summary.totalActionableEntries, "number");
  assert.equal(
    result.snapshot.workspaceState.focus?.engine.runId,
    result.submission.engine.record.runId,
  );

  process.stdout.write("check-first-integration: ok\n");
}

void main();
