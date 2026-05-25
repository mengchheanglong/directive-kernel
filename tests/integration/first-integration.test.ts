import os from "node:os";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { runFirstHostIntegrationFlow } from "../../hosts/integration-kit/lib/first-host-integration.ts";

describe("first host integration flow", () => {
  let result: Awaited<ReturnType<typeof runFirstHostIntegrationFlow>>;

  beforeAll(async () => {
    const directiveRoot = path.resolve(
      os.tmpdir(),
      `directive-kernel-first-integration-${Date.now()}`,
      "directive-root",
    );

    result = await runFirstHostIntegrationFlow({
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
  });

  it("resolves the goal", () => {
    expect(result.goalResolution.ok).toBe(true);
  });

  it("returns the candidate id on the request", () => {
    expect(result.request.candidate_id).toBe("first-integration-check-source");
  });

  it("reports a successful submission", () => {
    expect(result.submission.ok).toBe(true);
  });

  it("records exactly one discovery overview entry", () => {
    expect(result.snapshot.discoveryOverview.totalEntries).toBe(1);
  });

  it("includes the candidate id in the recent discovery overview entries", () => {
    expect(result.snapshot.discoveryOverview.recentEntries[0]?.candidateId).toBe(
      "first-integration-check-source",
    );
  });

  it("records exactly one engine run in the workspace state", () => {
    expect(result.snapshot.workspaceState.engine.totalRuns).toBe(1);
  });

  it("exposes a string artifact path on the workspace focus", () => {
    expect(typeof result.snapshot.workspaceState.focus?.artifactPath).toBe("string");
  });

  it("exposes a numeric total of actionable operator inbox entries", () => {
    expect(typeof result.snapshot.operatorInbox.summary.totalActionableEntries).toBe("number");
  });

  it("ties the workspace focus engine run id to the submission engine record run id", () => {
    expect(result.snapshot.workspaceState.focus?.engine.runId).toBe(
      result.submission.engine.record.runId,
    );
  });
});
