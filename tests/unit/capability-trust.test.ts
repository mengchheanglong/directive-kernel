import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  appendDecisionPolicyEvent,
  readDecisionPolicyLedger,
} from "../../engine/decision-policy-ledger.ts";
import { deriveCapabilityTrust } from "../../engine/routing/capability-trust.ts";
import { buildCapabilityRecallExecutors } from "../../hosts/mcp-host/executors/capability-recall.ts";
import {
  deriveEntryClass,
  deriveProjectionReadiness,
  type RuntimeCapabilityManifest,
} from "../../runtime/core/capability-registry.ts";
import { deriveCapabilityReliability } from "../../runtime/lib/projections/capability-reliability.ts";

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dk-trust-test-"));
  fs.mkdirSync(path.join(tmpDir, "discovery"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "discovery", "intake-queue.json"), "{\"entries\":[]}");
  fs.mkdirSync(path.join(tmpDir, "knowledge"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "knowledge", "active-mission.md"), "# Test mission");
  fs.mkdirSync(path.join(tmpDir, "engine"), { recursive: true });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function recordInvocation(
  capabilityId: string,
  outcome: "success" | "failure" | "contract_failure",
  overrides: {
    rationale?: string;
    sourceSignalTokens?: string[];
    recordedAt?: string;
  } = {},
) {
  const rationale = overrides.rationale ?? (
    outcome === "contract_failure"
      ? `Capability "${capabilityId}" contract failure: output schema mismatch`
      : outcome === "success"
        ? `Capability "${capabilityId}" invoked successfully (success, 100ms). Tool: test-tool`
        : `Capability "${capabilityId}" invocation failed (100ms): something broke`
  );
  const sourceSignalTokens = overrides.sourceSignalTokens ?? (
    outcome === "contract_failure"
      ? [capabilityId, "outcome_contract_failure", "contract_failure", "output_validation"]
      : outcome === "success"
        ? [capabilityId, "outcome_success", "success"]
        : [capabilityId, "outcome_failure", "failure"]
  );

  appendDecisionPolicyEvent({
    directiveRoot: tmpDir,
    event: {
      recordedAt: overrides.recordedAt ?? new Date().toISOString(),
      source: "capability_invocation",
      candidateId: capabilityId,
      rationale,
      sourceSignalTokens,
      capabilityInvocation: {
        outcome,
        ...(outcome === "contract_failure" ? { gate: "contract_failure", errorClass: "output_validation" } : {}),
      },
    },
  });
}

describe("structured outcomes and capability reliability", () => {
  it("report_outcome accepts structured fields and records metadata", async () => {
    const executors = buildCapabilityRecallExecutors({ directiveRoot: tmpDir });
    const result = await executors.report_outcome({
      capability_id: "cap-structured",
      outcome: "contract_failure",
      task_description: "Convert HTML to Markdown for a malformed document",
      duration_ms: 812,
      error_class: "schema_mismatch",
      operator_notes: "Output contained the word success but violated schema.",
      reported_by: "hermes",
      reported_at: "2026-06-13T00:00:00.000Z",
    }) as { ok: boolean };

    expect(result.ok).toBe(true);

    const ledger = readDecisionPolicyLedger(tmpDir, { lookback: "all" });
    const event = ledger.events.find((entry) =>
      entry.source === "capability_outcome" && entry.candidateId === "cap-structured"
    );
    expect(event).toBeDefined();
    expect(event?.rationale).toContain("contract_failure");
    expect(event?.sourceSignalTokens).toContain("outcome_contract_failure");
    expect((event as Record<string, unknown>).capabilityOutcome).toBeDefined();
  });

  it("reliability counts structured outcomes without fragile rationale matching", async () => {
    const executors = buildCapabilityRecallExecutors({ directiveRoot: tmpDir });

    await executors.report_outcome({
      capability_id: "cap-reliability",
      outcome: "success",
      task_description: "Run the verified document conversion tool",
      reported_by: "operator",
      reported_at: "2026-06-13T00:01:00.000Z",
    });
    await executors.report_outcome({
      capability_id: "cap-reliability",
      outcome: "partial",
      task_description: "Run the tool on a large file",
      operator_notes: "Worked partially; retry needed.",
      reported_by: "operator",
      reported_at: "2026-06-13T00:02:00.000Z",
    });
    await executors.report_outcome({
      capability_id: "cap-reliability",
      outcome: "failure",
      task_description: "Run the tool on a broken file",
      operator_notes: "The output text mentioned success, but the job failed.",
      reported_by: "operator",
      reported_at: "2026-06-13T00:03:00.000Z",
    });
    await executors.report_outcome({
      capability_id: "cap-reliability",
      outcome: "contract_failure",
      task_description: "Validate response schema",
      error_class: "output_validation",
      operator_notes: "Failure text includes the token success in the payload.",
      reported_by: "operator",
      reported_at: "2026-06-13T00:04:00.000Z",
    });

    const reliability = deriveCapabilityReliability("cap-reliability", tmpDir);
    expect(reliability.successCount).toBe(1);
    expect(reliability.partialCount).toBe(1);
    expect(reliability.failureCount).toBe(2);
    expect(reliability.contractFailureCount).toBe(1);
    expect(reliability.outcomeCount).toBe(4);
    expect(reliability.reliability).toBeCloseTo((1.5 + 1) / (4 + 2), 5);
  });

  it("legacy outcome records still read correctly", () => {
    appendDecisionPolicyEvent({
      directiveRoot: tmpDir,
      event: {
        recordedAt: "2026-06-13T00:05:00.000Z",
        source: "capability_outcome",
        candidateId: "cap-legacy-outcome",
        rationale: "Capability \"cap-legacy-outcome\" outcome: partial_success. The task mostly worked.",
        sourceSignalTokens: ["cap-legacy-outcome", "partial"],
      },
    });

    const reliability = deriveCapabilityReliability("cap-legacy-outcome", tmpDir);
    expect(reliability.partialCount).toBe(1);
    expect(reliability.successCount).toBe(0);
    expect(reliability.failureCount).toBe(0);
  });
});

describe("capability trust derivation", () => {
  it("returns zero trust for a capability with no invocations", () => {
    const trust = deriveCapabilityTrust("test-zero", tmpDir);
    expect(trust.sampleSize).toBe(0);
    expect(trust.successRate).toBe(0);
    expect(trust.autoApprovalEligible).toBe(false);
    expect(trust.demoted).toBe(false);
    expect(trust.reason).toContain("no invocation history");
  });

  it("warm-up: fewer than 5 samples keeps capability manual review", () => {
    const capabilityId = "test-warmup";
    for (let index = 0; index < 4; index++) {
      recordInvocation(capabilityId, "success");
    }
    const trust = deriveCapabilityTrust(capabilityId, tmpDir);
    expect(trust.sampleSize).toBe(4);
    expect(trust.autoApprovalEligible).toBe(false);
    expect(trust.reason).toContain("warm-up");
  });

  it("graduation: 5 successes out of 5 enables auto-approval", () => {
    const capabilityId = "test-graduate";
    for (let index = 0; index < 5; index++) {
      recordInvocation(capabilityId, "success");
    }
    const trust = deriveCapabilityTrust(capabilityId, tmpDir);
    expect(trust.sampleSize).toBe(5);
    expect(trust.successRate).toBe(1);
    expect(trust.autoApprovalEligible).toBe(true);
    expect(trust.demoted).toBe(false);
  });

  it("contract failure demotes until three consecutive successes recover it", () => {
    const capabilityId = "test-contract-demotion";
    for (let index = 0; index < 7; index++) {
      recordInvocation(capabilityId, "success");
    }
    recordInvocation(capabilityId, "contract_failure");

    let trust = deriveCapabilityTrust(capabilityId, tmpDir);
    expect(trust.contractFailureCount).toBe(1);
    expect(trust.demoted).toBe(true);
    expect(trust.autoApprovalEligible).toBe(false);

    recordInvocation(capabilityId, "success");
    recordInvocation(capabilityId, "success");
    trust = deriveCapabilityTrust(capabilityId, tmpDir);
    expect(trust.demoted).toBe(true);

    recordInvocation(capabilityId, "success");
    trust = deriveCapabilityTrust(capabilityId, tmpDir);
    expect(trust.consecutiveSuccesses).toBe(3);
    expect(trust.demoted).toBe(false);
    expect(trust.autoApprovalEligible).toBe(true);
  });

  it("repeated explicit failures demote even without contract failure", () => {
    const capabilityId = "test-repeated-failures";
    for (let index = 0; index < 5; index++) {
      recordInvocation(capabilityId, "success");
    }
    recordInvocation(capabilityId, "failure");
    recordInvocation(capabilityId, "failure");

    const trust = deriveCapabilityTrust(capabilityId, tmpDir);
    expect(trust.contractFailureCount).toBe(0);
    expect(trust.failureCount).toBe(2);
    expect(trust.demoted).toBe(true);
    expect(trust.reason).toContain("repeated explicit failures");
  });

  it("false-success strings inside failure rationales do not inflate success counts", () => {
    const capabilityId = "test-false-success-string";
    recordInvocation(capabilityId, "failure", {
      rationale: `Capability "${capabilityId}" invocation failed (200ms): upstream payload said success but the run failed`,
      sourceSignalTokens: [capabilityId, "outcome_failure", "failure"],
    });

    const trust = deriveCapabilityTrust(capabilityId, tmpDir);
    expect(trust.successCount).toBe(0);
    expect(trust.failureCount).toBe(1);
    expect(trust.successRate).toBe(0);
  });

  it("legacy invocation records remain readable", () => {
    appendDecisionPolicyEvent({
      directiveRoot: tmpDir,
      event: {
        recordedAt: "2026-06-13T00:06:00.000Z",
        source: "capability_invocation",
        candidateId: "cap-legacy-invocation",
        rationale: "Capability \"cap-legacy-invocation\" invoked successfully (success, 99ms). Tool: test",
        sourceSignalTokens: ["cap-legacy-invocation", "success"],
      },
    });

    const trust = deriveCapabilityTrust("cap-legacy-invocation", tmpDir);
    expect(trust.successCount).toBe(1);
    expect(trust.failureCount).toBe(0);
  });
});

describe("invoke projection gate - placeholder/claimed never invocable", () => {
  function makeManifest(overrides: Partial<RuntimeCapabilityManifest>): RuntimeCapabilityManifest {
    return {
      displayName: "Gate Test",
      description: "Test.",
      domain: "runtime",
      ...overrides,
    };
  }

  it("placeholder manifest is not projectionReady", () => {
    const manifest = makeManifest({ verification: "placeholder" });
    const entryClass = deriveEntryClass(manifest);
    const { projectionReady, notUsableReason } = deriveProjectionReadiness(manifest);
    expect(entryClass).toBe("placeholder");
    expect(projectionReady).toBe(false);
    expect(notUsableReason).toContain("placeholder");
  });

  it("claimed manifest is not projectionReady", () => {
    const manifest = makeManifest({ verification: "claimed" });
    const { projectionReady, notUsableReason } = deriveProjectionReadiness(manifest);
    expect(projectionReady).toBe(false);
    expect(notUsableReason).toContain("claimed");
  });

  it("verified without complete contract is not projectionReady", () => {
    const manifest = makeManifest({ verification: "verified", contract: "partial" });
    const { projectionReady, notUsableReason } = deriveProjectionReadiness(manifest);
    expect(projectionReady).toBe(false);
    expect(notUsableReason).toContain("contract");
  });

  it("verified with projection metadata is projectionReady", () => {
    const manifest = makeManifest({
      verification: "verified",
      contract: "complete",
      projection: { kind: "mcp_tool", id: "test", invocation: "cap_test" },
      whenToUse: "When testing.",
      failureModes: ["Timeout"],
    });
    const { projectionReady, notUsableReason } = deriveProjectionReadiness(manifest);
    expect(projectionReady).toBe(true);
    expect(notUsableReason).toBeUndefined();
  });

  it("deriveEntryClass labels verified plus projection as verified_capability", () => {
    const manifest = makeManifest({
      verification: "verified",
      contract: "complete",
      projection: { kind: "mcp_tool", id: "test", invocation: "cap_test" },
      whenToUse: "When testing.",
      failureModes: ["Timeout"],
    });
    expect(deriveEntryClass(manifest)).toBe("verified_capability");
  });

  it("deriveEntryClass labels verified without projection as candidate", () => {
    const manifest = makeManifest({
      verification: "verified",
      contract: "complete",
    });
    expect(deriveEntryClass(manifest)).toBe("candidate");
    const { projectionReady } = deriveProjectionReadiness(manifest);
    expect(projectionReady).toBe(false);
  });
});
