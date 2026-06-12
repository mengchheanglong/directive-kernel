/**
 * Hardening: Execution Evidence Signature Validation
 *
 * Proves that hand-written evidence files cannot be used to promote
 * a capability to "verified". Only files bearing a valid HMAC-SHA256
 * signature from the execution harness are accepted.
 *
 * Tests:
 *  1. A hand-written file (no valid HMAC) is rejected — returns null
 *  2. A properly signed evidence record is accepted
 *  3. A tampered record (one field changed after signing) is rejected
 *  4. A record missing the signature field entirely is rejected
 *  5. A record with a random signature is rejected
 *  6. The readValidatedEvidence() function rejects non-execution-evidence JSON
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

import {
  attachHarnessSignature,
  signExecutionEvidence,
  validateExecutionEvidence,
  readValidatedEvidence,
  buildEnvironmentFingerprint,
  sha256Hex,
  type ExecutionEvidence,
} from "../../../shared/lib/execution-evidence.ts";

// ── Helpers ────────────────────────────────────────────────────────

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dk-evidence-test-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function evPath(capabilityId: string): string {
  return path.join(tmpDir, `${capabilityId}-execution.json`);
}

function writeFile(capabilityId: string, content: string): string {
  const p = evPath(capabilityId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  return p;
}

/** Build a minimal unsigned evidence record (no signature). */
function buildUnsigned(overrides: Partial<Omit<ExecutionEvidence, "signature">> = {}): Omit<ExecutionEvidence, "signature"> {
  return {
    schemaVersion: 1,
    capabilityId: "test-cap-001",
    command: "echo hello",
    exitCode: 0,
    stdoutHash: sha256Hex("hello\n"),
    stderrHash: sha256Hex(""),
    wallTimeMs: 42,
    environmentFingerprint: buildEnvironmentFingerprint(),
    timestamp: new Date().toISOString(),
    harnessVersion: "1.0.0",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe("execution evidence signature validation", () => {
  // ── Unit: sign + validate ──────────────────────────────────────

  it("a signed record passes validateExecutionEvidence", () => {
    const unsigned = buildUnsigned();
    const signed = attachHarnessSignature(unsigned);
    expect(validateExecutionEvidence(signed)).toBe(true);
  });

  it("an unsigned record (no signature field) fails validation", () => {
    // TypeScript won't let us pass a record without signature, so we cast
    const unsigned = buildUnsigned() as unknown as ExecutionEvidence;
    expect(validateExecutionEvidence(unsigned)).toBe(false);
  });

  it("a record with an empty signature fails validation", () => {
    const unsigned = buildUnsigned();
    const fake = { ...unsigned, signature: "" } as ExecutionEvidence;
    expect(validateExecutionEvidence(fake)).toBe(false);
  });

  it("a record with a random/garbage signature fails validation", () => {
    const unsigned = buildUnsigned();
    const fake = { ...unsigned, signature: "deadbeef".repeat(8) } as ExecutionEvidence;
    expect(validateExecutionEvidence(fake)).toBe(false);
  });

  it("detects a single field tampered after signing", () => {
    const unsigned = buildUnsigned();
    const signed = attachHarnessSignature(unsigned);
    // Tamper with exit code
    const tampered: ExecutionEvidence = { ...signed, exitCode: 1 };
    expect(validateExecutionEvidence(tampered)).toBe(false);
  });

  it("detects tampered stdoutHash after signing", () => {
    const unsigned = buildUnsigned();
    const signed = attachHarnessSignature(unsigned);
    const tampered: ExecutionEvidence = {
      ...signed,
      stdoutHash: sha256Hex("different output"),
    };
    expect(validateExecutionEvidence(tampered)).toBe(false);
  });

  // ── Schema shape guard ─────────────────────────────────────────

  it("isExecutionEvidenceShape rejects non-execution-evidence JSON", () => {
    // readValidatedEvidence should return null for files that don't match the shape
    const handWritten = JSON.stringify({
      hostCallableAdapter: { candidateId: "fake" },
      capability: { capabilityId: "fake" },
      invocation: { ok: true, verification: { realExecution: true } },
    }, null, 2);
    writeFile("test-fake", handWritten);
    const result = readValidatedEvidence("test-fake", tmpDir);
    expect(result).toBeNull();
  });

  it("readValidatedEvidence rejects a perfectly-shaped but unsigned file", () => {
    const unsigned = buildUnsigned();
    const json = JSON.stringify({ ...unsigned, signature: "not-real" }, null, 2);
    writeFile("test-unsigned", json);
    const result = readValidatedEvidence("test-unsigned", tmpDir);
    expect(result).toBeNull();
  });

  it("readValidatedEvidence returns the record for a valid signed file", () => {
    const unsigned = buildUnsigned({ capabilityId: "test-valid" });
    const signed = attachHarnessSignature(unsigned);
    writeFile("test-valid", JSON.stringify(signed, null, 2));
    const result = readValidatedEvidence("test-valid", tmpDir);
    expect(result).not.toBeNull();
    expect(result!.capabilityId).toBe("test-valid");
    expect(result!.exitCode).toBe(0);
    expect(result!.harnessVersion).toBe("1.0.0");
  });

  it("readValidatedEvidence returns null for a missing file", () => {
    const result = readValidatedEvidence("test-nonexistent", tmpDir);
    expect(result).toBeNull();
  });

  it("readValidatedEvidence returns null for malformed JSON", () => {
    writeFile("test-malformed", "not valid json {{{");
    const result = readValidatedEvidence("test-malformed", tmpDir);
    expect(result).toBeNull();
  });

  // ── Hand-written rejection (the core hardening property) ───────

  it("hand-written evidence file is rejected — cannot promote to verified", () => {
    // Simulate what someone might hand-write to claim a cap is verified
    const handWritten = JSON.stringify({
      schemaVersion: 1,
      capabilityId: "test-hand",
      command: "echo hello",
      exitCode: 0,
      stdoutHash: sha256Hex("hello\n"),
      stderrHash: sha256Hex(""),
      wallTimeMs: 100,
      environmentFingerprint: buildEnvironmentFingerprint(),
      timestamp: new Date().toISOString(),
      harnessVersion: "1.0.0",
      signature: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    }, null, 2);

    writeFile("test-hand", handWritten);

    // readValidatedEvidence should reject because the HMAC is wrong
    const result = readValidatedEvidence("test-hand", tmpDir);
    expect(result).toBeNull();
  });

  // ── Signature determinism ──────────────────────────────────────

  it("signExecutionEvidence is deterministic — same input, same signature", () => {
    const unsigned = buildUnsigned();
    const sig1 = signExecutionEvidence(unsigned);
    const sig2 = signExecutionEvidence(unsigned);
    expect(sig1).toBe(sig2);
    expect(sig1.length).toBe(64); // hex-encoded SHA-256
  });

  // ── Sha256 helper ──────────────────────────────────────────────

  it("sha256Hex produces correct-length lowercase hex digests", () => {
    const h = sha256Hex("hello");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  // ── Environment fingerprint ────────────────────────────────────

  it("buildEnvironmentFingerprint includes os, arch, and node version", () => {
    const fp = buildEnvironmentFingerprint();
    expect(fp).toContain(process.platform);
    expect(fp).toContain(process.arch);
    expect(fp).toContain(process.version);
  });
});
