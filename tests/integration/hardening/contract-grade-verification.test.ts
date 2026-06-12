/**
 * Hardening: Contract-Grade Verification
 *
 * Proves that:
 *  1. Evidence with contractVerification="full" AND all examples passed + exit 0 → "verified"
 *  2. Evidence with contractVerification="exit_only" (legacy, no examples) → "runs_unverified_contract"
 *  3. Evidence without examples field → "runs_unverified_contract" (backward compat)
 *  4. Evidence with failed examples → "runs_unverified_contract" (even if exit is 0)
 *  5. Null evidence → "claimed"
 *  6. Evidence with exitCode !== 0 → "claimed" (regardless of examples)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

import {
  attachHarnessSignature,
  validateExecutionEvidence,
  verificationFromEvidence,
  readValidatedEvidence,
  buildEnvironmentFingerprint,
  sha256Hex,
  type ExecutionEvidence,
  type EvidenceExample,
} from "../../../shared/lib/execution-evidence.ts";

// ── Helpers ────────────────────────────────────────────────────────

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dk-contract-evidence-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function evPath(capabilityId: string): string {
  return path.join(tmpDir, `${capabilityId}-execution.json`);
}

function writeEvidence(capabilityId: string, evidence: ExecutionEvidence): string {
  const p = evPath(capabilityId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(evidence, null, 2), "utf8");
  return p;
}

function buildUnsigned(overrides: Partial<Omit<ExecutionEvidence, "signature">> = {}): Omit<ExecutionEvidence, "signature"> {
  return {
    schemaVersion: 2,
    capabilityId: "test-cap",
    command: "echo test",
    exitCode: 0,
    stdoutHash: sha256Hex("test\n"),
    stderrHash: sha256Hex(""),
    wallTimeMs: 100,
    environmentFingerprint: buildEnvironmentFingerprint(),
    timestamp: new Date().toISOString(),
    harnessVersion: "2.0.0",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe("contract-grade verification", () => {
  // ── Core property: full contract → verified ────────────────────

  it("full contract evidence with all examples passed yields 'verified'", () => {
    const unsigned = buildUnsigned({
      exitCode: 0,
      contractVerification: "full",
      examples: [
        { name: "ex1", input: { a: 1 }, passed: true },
        { name: "ex2", input: { b: 2 }, passed: true },
      ],
    });
    const signed = attachHarnessSignature(unsigned);
    const result = verificationFromEvidence(signed);
    expect(result).toBe("verified");
  });

  it("full contract evidence with a single example passed yields 'verified'", () => {
    const unsigned = buildUnsigned({
      exitCode: 0,
      contractVerification: "full",
      examples: [{ name: "ex", input: {}, passed: true }],
    });
    const signed = attachHarnessSignature(unsigned);
    expect(verificationFromEvidence(signed)).toBe("verified");
  });

  // ── Core hardening: no examples → never "verified" ─────────────

  it("evidence without examples field yields 'runs_unverified_contract' (NOT verified)", () => {
    const unsigned = buildUnsigned({ exitCode: 0 });
    // No examples field at all
    const signed = attachHarnessSignature(unsigned);
    const result = verificationFromEvidence(signed);
    expect(result).toBe("runs_unverified_contract");
    expect(result).not.toBe("verified");
  });

  it("evidence with contractVerification='exit_only' yields 'runs_unverified_contract'", () => {
    const unsigned = buildUnsigned({
      exitCode: 0,
      contractVerification: "exit_only",
    });
    const signed = attachHarnessSignature(unsigned);
    const result = verificationFromEvidence(signed);
    expect(result).toBe("runs_unverified_contract");
    expect(result).not.toBe("verified");
  });

  it("evidence with full contract but a failed example yields 'runs_unverified_contract'", () => {
    const unsigned = buildUnsigned({
      exitCode: 0,
      contractVerification: "full",
      examples: [
        { name: "pass", input: {}, passed: true },
        { name: "fail", input: {}, passed: false, error: "output mismatch" },
      ],
    });
    const signed = attachHarnessSignature(unsigned);
    const result = verificationFromEvidence(signed);
    expect(result).toBe("runs_unverified_contract");
  });

  // ── Null / error cases ─────────────────────────────────────────

  it("null evidence yields 'claimed'", () => {
    expect(verificationFromEvidence(null)).toBe("claimed");
  });

  it("evidence with non-zero exit yields 'claimed' regardless of contract", () => {
    const unsigned = buildUnsigned({
      exitCode: 1,
      contractVerification: "full",
      examples: [{ name: "ex", input: {}, passed: true }],
    });
    const signed = attachHarnessSignature(unsigned);
    expect(verificationFromEvidence(signed)).toBe("claimed");
  });

  // ── readValidatedEvidence integration ──────────────────────────

  it("readValidatedEvidence returns evidence with examples intact", () => {
    const unsigned = buildUnsigned({
      capabilityId: "test-readback",
      exitCode: 0,
      contractVerification: "full",
      examples: [{ name: "ex", input: { x: 1 }, passed: true }],
    });
    const signed = attachHarnessSignature(unsigned);
    writeEvidence("test-readback", signed);

    const result = readValidatedEvidence("test-readback", tmpDir);
    expect(result).not.toBeNull();
    expect(result!.examples).toHaveLength(1);
    expect(result!.examples![0].passed).toBe(true);
    expect(result!.contractVerification).toBe("full");
  });

  it("readValidatedEvidence still works with legacy (no examples) evidence", () => {
    const unsigned = buildUnsigned({
      capabilityId: "test-legacy",
      exitCode: 0,
    });
    const signed = attachHarnessSignature(unsigned);
    writeEvidence("test-legacy", signed);

    const result = readValidatedEvidence("test-legacy", tmpDir);
    expect(result).not.toBeNull();
    expect(result!.exitCode).toBe(0);
    expect(result!.examples).toBeUndefined();
  });

  // ── Proof: signed + examples + failed example ≠ verified ──────

  it("a tampered example.passed flag demotes to runs_unverified_contract", () => {
    const unsigned = buildUnsigned({
      capabilityId: "test-tamper",
      exitCode: 0,
      contractVerification: "full",
      examples: [{ name: "ex", input: {}, passed: true }],
    });
    const signed = attachHarnessSignature(unsigned);

    // Tamper: change passed to false
    const tampered: ExecutionEvidence = {
      ...signed,
      examples: [{ name: "ex", input: {}, passed: false }],
    };
    // The HMAC is still valid (examples not in signed fields),
    // but verificationFromEvidence checks examples.passed.
    const hmacValid = validateExecutionEvidence(tampered);
    expect(hmacValid).toBe(true);
    // But the verification status should demote due to failed example
    const result = verificationFromEvidence(tampered);
    expect(result).not.toBe("verified");
    expect(result).toBe("runs_unverified_contract");
  });
});
