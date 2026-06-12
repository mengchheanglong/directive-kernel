/**
 * Unit tests: Per-Capability Trust Derivation
 *
 * Tests deriveCapabilityTrust() for:
 *   - Graduation: 5+ samples with >= 0.9 success → autoApprovalEligible
 *   - Warm-up: fewer than 5 samples → not eligible
 *   - Demotion: contract failure → demoted
 *   - Re-graduation: 3 consecutive successes after demotion → re-graduates
 *   - Recency: only recent successes count for re-graduation
 *   - Zero invocations
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { deriveCapabilityTrust } from "../../engine/routing/capability-trust.ts";
import { appendDecisionPolicyEvent } from "../../engine/decision-policy-ledger.ts";

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dk-trust-test-"));
  fs.mkdirSync(path.join(tmpDir, "discovery"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "discovery", "intake-queue.json"), '{"entries":[]}');
  fs.mkdirSync(path.join(tmpDir, "knowledge"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "knowledge", "active-mission.md"), "# Test mission");
  fs.mkdirSync(path.join(tmpDir, "engine"), { recursive: true });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function recordInvocation(capabilityId: string, outcome: "success" | "failure" | "contract_failure") {
  const rationale = outcome === "contract_failure"
    ? `Capability "${capabilityId}" contract_failure: output schema mismatch`
    : outcome === "success"
      ? `Capability "${capabilityId}" invoked successfully (success, 100ms). Tool: test-tool`
      : `Capability "${capabilityId}" invocation failed (100ms): something broke`;
  const tokens = outcome === "contract_failure"
    ? [capabilityId, "contract_failure", "output_validation"]
    : outcome === "success"
      ? [capabilityId, "success", "success"]
      : [capabilityId, "failure"];

  appendDecisionPolicyEvent({
    directiveRoot: tmpDir,
    event: {
      recordedAt: new Date().toISOString(),
      source: "capability_invocation",
      candidateId: capabilityId,
      rationale,
      sourceSignalTokens: tokens,
    },
  });
}

describe("capability trust derivation", () => {
  it("returns zero trust for a capability with no invocations", () => {
    const trust = deriveCapabilityTrust("test-zero", tmpDir);
    expect(trust.sampleSize).toBe(0);
    expect(trust.successRate).toBe(0);
    expect(trust.autoApprovalEligible).toBe(false);
    expect(trust.demoted).toBe(false);
    expect(trust.reason).toContain("no invocation history");
  });

  it("warm-up: fewer than 5 samples → not auto-approve eligible", () => {
    const capId = "test-warmup";
    for (let i = 0; i < 4; i++) {
      recordInvocation(capId, "success");
    }
    const trust = deriveCapabilityTrust(capId, tmpDir);
    expect(trust.sampleSize).toBe(4);
    expect(trust.autoApprovalEligible).toBe(false);
    expect(trust.reason).toContain("warm-up");
    expect(trust.reason).toContain("1 more needed");
  });

  it("graduation: 5 successes out of 5 → autoApprovalEligible", () => {
    const capId = "test-graduate";
    for (let i = 0; i < 5; i++) {
      recordInvocation(capId, "success");
    }
    const trust = deriveCapabilityTrust(capId, tmpDir);
    expect(trust.sampleSize).toBe(5);
    expect(trust.successRate).toBe(1.0);
    expect(trust.autoApprovalEligible).toBe(true);
    expect(trust.demoted).toBe(false);
    expect(trust.consecutiveSuccesses).toBe(5);
  });

  it("graduation: 9/10 success (0.9 rate) → autoApprovalEligible", () => {
    const capId = "test-90pct";
    for (let i = 0; i < 9; i++) recordInvocation(capId, "success");
    recordInvocation(capId, "failure");
    const trust = deriveCapabilityTrust(capId, tmpDir);
    expect(trust.sampleSize).toBe(10);
    expect(trust.successRate).toBe(0.9);
    expect(trust.autoApprovalEligible).toBe(true);
  });

  it("sub-threshold: 4/5 success (0.8 rate) → not eligible", () => {
    const capId = "test-subthresh";
    for (let i = 0; i < 4; i++) recordInvocation(capId, "success");
    recordInvocation(capId, "failure");
    const trust = deriveCapabilityTrust(capId, tmpDir);
    expect(trust.sampleSize).toBe(5);
    expect(trust.successRate).toBe(0.8);
    expect(trust.autoApprovalEligible).toBe(false);
  });

  it("demotion: one contract failure demotes", () => {
    const capId = "test-demote";
    for (let i = 0; i < 5; i++) recordInvocation(capId, "success");
    recordInvocation(capId, "contract_failure");
    const trust = deriveCapabilityTrust(capId, tmpDir);
    expect(trust.sampleSize).toBe(6);
    expect(trust.contractFailureCount).toBe(1);
    expect(trust.demoted).toBe(true);
    expect(trust.autoApprovalEligible).toBe(false);
    expect(trust.reason).toContain("demoted");
  });

  it("re-graduation: 3 consecutive successes after demotion restores trust", () => {
    const capId = "test-regraduate";
    for (let i = 0; i < 7; i++) recordInvocation(capId, "success"); // 7
    recordInvocation(capId, "contract_failure"); // 1 failure → 7/8 = 0.875
    // Now re-graduate with 3 consecutive successes
    recordInvocation(capId, "success"); // 8/9 = 0.889 — still sub-threshold
    recordInvocation(capId, "success"); // 9/10 = 0.9 — hits threshold!
    recordInvocation(capId, "success"); // 10/11 = 0.909

    const trust = deriveCapabilityTrust(capId, tmpDir);
    expect(trust.consecutiveSuccesses).toBe(3);
    expect(trust.demoted).toBe(false);
    expect(trust.autoApprovalEligible).toBe(true); // 10/11 > 0.9
    expect(trust.successRate).toBe(10 / 11);
  });

  it("re-graduation: 2 successes after demotion is not enough", () => {
    const capId = "test-regrad-half";
    for (let i = 0; i < 5; i++) recordInvocation(capId, "success");
    recordInvocation(capId, "contract_failure");
    recordInvocation(capId, "success");
    recordInvocation(capId, "success");
    // Only 2 consecutive — not enough

    const trust = deriveCapabilityTrust(capId, tmpDir);
    expect(trust.consecutiveSuccesses).toBe(2);
    expect(trust.demoted).toBe(true);
    expect(trust.autoApprovalEligible).toBe(false);
    expect(trust.reason).toContain("1 more consecutive successes");
  });
});
