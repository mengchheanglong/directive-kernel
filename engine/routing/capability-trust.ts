/**
 * Per-Capability Trust Assessment
 *
 * Derives a capability's trust status from its invocation history
 * in the decision-policy ledger.
 */

import {
  extractCapabilityInvocationSignal,
  readDecisionPolicyLedger,
} from "../decision-policy-ledger.ts";

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

const WARM_UP_THRESHOLD = 5;
const SUCCESS_RATE_THRESHOLD = 0.9;
const RE_GRADUATION_STREAK = 3;
const FAILURE_DEMOTION_STREAK = 2;

export function deriveCapabilityTrust(
  capabilityId: string,
  directiveRoot: string,
): CapabilityTrust {
  const ledger = readDecisionPolicyLedger(directiveRoot, { lookback: "active-only" });
  const invocations = ledger.events.filter(
    (event) => event.source === "capability_invocation" && event.candidateId === capabilityId,
  );

  let successCount = 0;
  let failureCount = 0;
  let contractFailureCount = 0;

  const sorted = [...invocations].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
  const outcomes = sorted.map((event) => extractCapabilityInvocationSignal(event)?.outcome ?? "failure");

  for (const outcome of outcomes) {
    if (outcome === "success") {
      successCount++;
      continue;
    }

    failureCount++;
    if (outcome === "contract_failure") {
      contractFailureCount++;
    }
  }

  const sampleSize = outcomes.length;
  const successRate = sampleSize > 0 ? successCount / sampleSize : 0;

  let consecutiveSuccesses = 0;
  for (let index = outcomes.length - 1; index >= 0; index--) {
    if (outcomes[index] === "success") {
      consecutiveSuccesses++;
    } else {
      break;
    }
  }

  let recentFailureStreak = 0;
  for (let index = outcomes.length - 1; index >= 0; index--) {
    if (outcomes[index] === "success") {
      break;
    }
    recentFailureStreak++;
  }

  const demotedByContractFailure =
    contractFailureCount > 0 && consecutiveSuccesses < RE_GRADUATION_STREAK;
  const demotedByRepeatedFailures =
    recentFailureStreak >= FAILURE_DEMOTION_STREAK && consecutiveSuccesses < RE_GRADUATION_STREAK;
  const demoted = demotedByContractFailure || demotedByRepeatedFailures;

  let autoApprovalEligible = false;
  let reason = "";

  if (sampleSize === 0) {
    reason = `Capability "${capabilityId}" has no invocation history. Manual review required.`;
  } else if (demoted) {
    const demotionCause = demotedByContractFailure
      ? "contract failure"
      : "repeated explicit failures";
    reason = `Capability "${capabilityId}" is demoted due to ${demotionCause}. Needs ${RE_GRADUATION_STREAK - consecutiveSuccesses} more consecutive successes to re-graduate (${consecutiveSuccesses}/${RE_GRADUATION_STREAK}).`;
  } else if (sampleSize < WARM_UP_THRESHOLD) {
    reason = `Capability "${capabilityId}" is in warm-up (${sampleSize}/${WARM_UP_THRESHOLD} invocations). ${WARM_UP_THRESHOLD - sampleSize} more needed before auto-approval.`;
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

export function isCapabilityAutoApprovalEligible(
  capabilityId: string,
  directiveRoot: string,
): boolean {
  return deriveCapabilityTrust(capabilityId, directiveRoot).autoApprovalEligible;
}
