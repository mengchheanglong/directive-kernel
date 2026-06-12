/**
 * Execution Evidence — shared types, signer, validator, and reader
 * for sandboxed capability verification.
 *
 * The harness (scripts/execution-harness.ts) produces signed evidence records.
 * This module provides the reader and validator that reject hand-written files.
 *
 * Contract-grade verification (v2):
 *   - Evidence records may carry an optional `examples` array with per-example
 *     pass/fail results.
 *   - `contractVerification: "full"` means all examples passed AND exit code is 0.
 *     This is the only path to `"verified"`.
 *   - `contractVerification: "exit_only"` means exit code is 0 but no examples
 *     were run (legacy evidence). These downgrade to `"runs_unverified_contract"`.
 *   - Records without `examples` are treated as `contractVerification: "exit_only"`.
 *
 * Security model:
 *   - Evidence records carry an HMAC-SHA256 signature over all fields except `signature`.
 *   - The HMAC key is a constant embedded in this module (not a secret — it prevents
 *     casual hand-crafting, not determined attackers).
 *   - validateExecutionEvidence() recomputes the HMAC and rejects mismatches.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ── Types ──────────────────────────────────────────────────────────

export interface EvidenceExample {
  name: string;
  input: Record<string, unknown>;
  passed: boolean;
  error?: string;
}

export interface ExecutionEvidence {
  schemaVersion: number;
  capabilityId: string;
  command: string;
  exitCode: number;
  stdoutHash: string;
  stderrHash: string;
  wallTimeMs: number;
  environmentFingerprint: string;
  timestamp: string;
  harnessVersion: string;
  signature: string;
  /** Contract-grade verification: per-example pass/fail results. */
  examples?: EvidenceExample[];
  /** How this evidence was verified: "full" = all examples passed, "exit_only" = only exit code checked. */
  contractVerification?: "full" | "exit_only";
}

/** Fields that are signed, in canonical order. */
const SIGNED_FIELDS: (keyof ExecutionEvidence)[] = [
  "schemaVersion",
  "capabilityId",
  "command",
  "exitCode",
  "stdoutHash",
  "stderrHash",
  "wallTimeMs",
  "environmentFingerprint",
  "timestamp",
  "harnessVersion",
  "contractVerification",
];

// ── HMAC key ───────────────────────────────────────────────────────
// Not a cryptographically secret key — it lives in source.
// Its purpose is to make hand-written evidence files distinguishable
// from harness-produced ones without requiring an external secret store.

const HARNESS_HMAC_KEY = "dk-execution-harness/v1";

// ── Serialization helper ───────────────────────────────────────────

/**
 * Deterministic JSON serialization with sorted keys.
 * Required so that HMAC verification is order-independent.
 */
function stableStringify(obj: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return JSON.stringify(sorted);
}

// ── Payload extraction ─────────────────────────────────────────────

/**
 * Extract the fields that are covered by the HMAC (all except `signature`).
 */
function signedPayload(record: ExecutionEvidence): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of SIGNED_FIELDS) {
    payload[key] = record[key];
  }
  return payload;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Compute the HMAC-SHA256 signature for an evidence record.
 * The `signature` field on the input is ignored — it is computed
 * over all other fields.
 */
export function signExecutionEvidence(record: Omit<ExecutionEvidence, "signature">): string {
  const payload = signedPayload(record as ExecutionEvidence);
  const canonical = stableStringify(payload);
  return crypto.createHmac("sha256", HARNESS_HMAC_KEY).update(canonical).digest("hex");
}

/**
 * Attach a signature to an unsigned evidence record.
 * Returns a complete ExecutionEvidence with a valid signature.
 */
export function attachHarnessSignature(
  record: Omit<ExecutionEvidence, "signature">,
): ExecutionEvidence {
  const signature = signExecutionEvidence(record);
  return { ...record, signature };
}

/**
 * Validate that an evidence record carries a valid harness signature.
 * Returns `true` if the record was produced by the harness, `false` if
 * it appears hand-written or tampered with.
 */
export function validateExecutionEvidence(record: ExecutionEvidence): boolean {
  if (!record.signature || typeof record.signature !== "string") {
    return false;
  }
  const expected = signExecutionEvidence(record);
  // Constant-time comparison to avoid timing side-channels
  try {
    return crypto.timingSafeEqual(
      Buffer.from(record.signature, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

/**
 * Build an environment fingerprint string.
 * Captures the OS, architecture, and Node.js version so evidence records
 * are auditable for the environment they were produced in.
 */
export function buildEnvironmentFingerprint(): string {
  const os = process.platform;
  const arch = process.arch;
  const node = process.version;
  return `${os}-${arch}-${node}`;
}

/**
 * Compute the SHA-256 hex digest of a string.
 */
export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// ── Evidence file I/O ──────────────────────────────────────────────

/**
 * Read and validate an execution evidence file from disk.
 *
 * @param capabilityId - The capability identifier (without file extension).
 * @param callableExecutionsDir - Absolute path to the `runtime/callable-executions/` directory.
 * @returns The validated evidence record, or `null` if the file is missing, unparseable, or unsigned.
 */
export function readValidatedEvidence(
  capabilityId: string,
  callableExecutionsDir: string,
): ExecutionEvidence | null {
  const evPath = path.join(callableExecutionsDir, `${capabilityId}-execution.json`);
  if (!fs.existsSync(evPath)) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(evPath, "utf8"));
  } catch {
    return null;
  }
  if (!isExecutionEvidenceShape(raw)) {
    return null;
  }
  if (!validateExecutionEvidence(raw)) {
    return null;
  }
  return raw;
}

/**
 * Type guard: checks that an unknown value has the shape of an ExecutionEvidence record.
 */
export function isExecutionEvidenceShape(value: unknown): value is ExecutionEvidence {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.schemaVersion === "number" &&
    typeof r.capabilityId === "string" &&
    typeof r.command === "string" &&
    typeof r.exitCode === "number" &&
    typeof r.stdoutHash === "string" &&
    typeof r.stderrHash === "string" &&
    typeof r.wallTimeMs === "number" &&
    typeof r.environmentFingerprint === "string" &&
    typeof r.timestamp === "string" &&
    typeof r.harnessVersion === "string" &&
    typeof r.signature === "string"
  );
  // Note: examples and contractVerification are optional fields
  // added in v2 — their absence is handled by verificationFromEvidence.
}

/**
 * Determine verification status from a validated evidence record.
 *
 * Contract-grade verification (v2):
 *   - `"verified"`: contractVerification is "full" AND exit code is 0
 *     (all examples passed). This is the ONLY path to verified.
 *   - `"runs_unverified_contract"`: exit code is 0 but contractVerification
 *     is "exit_only" (legacy evidence without examples, or examples missing).
 *   - `"claimed"`: evidence exists but exit code is non-zero, or no evidence.
 */
export function verificationFromEvidence(
  evidence: ExecutionEvidence | null,
): "verified" | "claimed" | "runs_unverified_contract" {
  if (!evidence) {
    return "claimed";
  }
  if (evidence.exitCode !== 0) {
    return "claimed";
  }
  // exitCode === 0: check contract grade
  if (evidence.contractVerification === "full") {
    const allExamplesPassed = evidence.examples
      ? evidence.examples.every((ex) => ex.passed)
      : false;
    return allExamplesPassed ? "verified" : "runs_unverified_contract";
  }
  // contractVerification is "exit_only" or missing — legacy evidence
  return "runs_unverified_contract";
}
