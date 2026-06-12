/**
 * Per-Capability Trust Assessment
 *
 * Derives a capability's trust status from its invocation history
 * in the decision-policy ledger, replacing the synthetic-source hack
 * previously used in the invoke executor.
 *
 * Trust model:
 *   - First 5 invocations always require operator confirmation ("warm-up").
 *   - At >= 5 samples with >= 0.9 success rate → autoApprovalEligible.
 *   - A single contract failure (invocation where schema validation fails)
 *     → demoted. Needs 3 consecutive successes to re-graduate.
 *   - Capabilities with zero invocations are always manual-review.
 *
 * Exported functions:
 *   - deriveCapabilityTrust(capabilityId, directiveRoot) → CapabilityTrust
 *   - isCapabilityAutoApprovalEligible(capabilityId, directiveRoot) → boolean
 */

import { readDecisionPolicyLedger } from "../decision-policy-ledger.ts";

// ── Types ──────────────────────────────────────────────────────────

export interface CapabilityTrust {
  capabilityId: string;
  sampleSize: number;
  successCount: number;
  failureCount: number;
  contractFailureCount: number;
  successRate: number;
  autoApprovalEligible: boolean;
  demoted: boolean;
  consecutiveSuccesses: number;
  /** Policy explanation for the trust result. */
  reason: string;
}

// ── Constants ──────────────────────────────────────────────────────

/** Minimum invocations before auto-approval is considered. */
const WARM_UP_THRESHOLD = 5;

/** Success rate required for auto-approval (0.0 – 1.0). */
const SUCCESS_RATE_THRESHOLD = 0.9;

/** Consecutive successes needed to re-graduate after demotion. */
const RE_GRADUATION_STREAK = 3;

// ── Core logic ────────────────────────────────────────────────────

/**
 * Derive a capability's trust status from its invocation history
 * in the decision-policy ledger.
 */
export function deriveCapabilityTrust(
  capabilityId: string,
  directiveRoot: string,
): CapabilityTrust {
  const ledger = readDecisionPolicyLedger(directiveRoot, { lookback: "active-only" });
  const invocations = ledger.events.filter(
    (e) => e.source === "capability_invocation" && e.candidateId === capabilityId,
  );

  // Count results
  let successCount = 0;
  let failureCount = 0;
  let contractFailureCount = 0;

  // Sort by timestamp for recency analysis
  const sorted = [...invocations].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );

  for (const inv of sorted) {
    if (inv.rationale.includes("success")) {
      successCount++;
    } else if (inv.rationale.includes("contract_failure")) {
      contractFailureCount++;
      failureCount++;
    } else {
      failureCount++;
    }
  }

  const sampleSize = sorted.length;
  const successRate = sampleSize > 0 ? successCount / sampleSize : 0;

  // Compute consecutive successes from the most recent invocations
  let consecutiveSuccesses = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].rationale.includes("success")) {
      consecutiveSuccesses++;
    } else {
      break;
    }
  }

  // Determine demotion: any contract failure demotes until re-graduated
  const demoted = contractFailureCount > 0 && consecutiveSuccesses < RE_GRADUATION_STREAK;

  // Auto-approval eligibility
  let autoApprovalEligible = false;
  let reason = "";

  if (sampleSize === 0) {
    reason = `Capability "${capabilityId}" has no invocation history. Manual review required.`;
  } else if (sampleSize < WARM_UP_THRESHOLD) {
    reason = `Capability "${capabilityId}" is in warm-up (${sampleSize}/${WARM_UP_THRESHOLD} invocations). ${WARM_UP_THRESHOLD - sampleSize} more needed before auto-approval.`;
  } else if (demoted) {
    reason = `Capability "${capabilityId}" is demoted due to contract failure. Needs ${RE_GRADUATION_STREAK - consecutiveSuccesses} more consecutive successes to re-graduate (${consecutiveSuccesses}/${RE_GRADUATION_STREAK}).`;
  } else if (successRate >= SUCCESS_RATE_THRESHOLD) {
    autoApprovalEligible = true;
    reason = `Capability "${capabilityId}" is trusted: ${successCount}/${sampleSize} successes (${(successRate * 100).toFixed(0)}% rate). Auto-approval eligible.`;
  } else {
    reason = `Capability "${capabilityId}" success rate is ${(successRate * 100).toFixed(0)}% (${successCount}/${sampleSize}), below the ${(SUCCESS_RATE_THRESHOLD * 100).toFixed(0)}% threshold. Manual review required.`;
  }

  return {
    capabilityId,
    sampleSize,
    successCount,
    failureCount,
    contractFailureCount,
    successRate,
    autoApprovalEligible,
    demoted,
    consecutiveSuccesses,
    reason,
  };
}

/**
 * Shorthand: is this capability eligible for auto-approval?
 */
export function isCapabilityAutoApprovalEligible(
  capabilityId: string,
  directiveRoot: string,
): boolean {
  return deriveCapabilityTrust(capabilityId, directiveRoot).autoApprovalEligible;
}
