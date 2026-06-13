import {
  extractCapabilityOutcomeSignal,
  readDecisionPolicyLedger,
} from "../../../engine/decision-policy-ledger.ts";

export interface CapabilityReliability {
  capabilityId: string;
  successCount: number;
  partialCount: number;
  failureCount: number;
  contractFailureCount: number;
  totalCount: number;
  /** Laplace-smoothed reliability (0.0-1.0) using success + 0.5 x partial as effective successes. */
  reliability: number;
  /** Freshness: how recent the last activity is (0.0-1.0), decaying over 30 days. */
  freshness: number;
  lastReportedAt: string | null;
  /** Tags/descriptions extracted from structured outcome tokens. */
  outcomeTags: string[];
  /** Number of outcomes reported. */
  outcomeCount: number;
}

const HALF_LIFE_DAYS = 30;

function laplaceSmooth(successes: number, total: number): number {
  return (successes + 1) / (total + 2);
}

function computeFreshness(lastReportedAt: string | null): number {
  if (!lastReportedAt) return 0;
  const ageDays = (Date.now() - new Date(lastReportedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 0) return 1.0;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export function deriveCapabilityReliability(
  capabilityId: string,
  directiveRoot: string,
): CapabilityReliability {
  const ledger = readDecisionPolicyLedger(directiveRoot, { lookback: "all" });
  const outcomes = ledger.events.filter(
    (event) => event.source === "capability_outcome" && event.candidateId === capabilityId,
  );

  let successCount = 0;
  let partialCount = 0;
  let failureCount = 0;
  let contractFailureCount = 0;
  const tags: string[] = [];
  let lastReportedAt: string | null = null;

  for (const outcomeEvent of [...outcomes].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  )) {
    if (!lastReportedAt) {
      lastReportedAt = outcomeEvent.recordedAt;
    }

    const outcomeSignal = extractCapabilityOutcomeSignal(outcomeEvent);
    switch (outcomeSignal?.outcome) {
      case "success":
        successCount++;
        break;
      case "partial":
        partialCount++;
        break;
      case "contract_failure":
        contractFailureCount++;
        failureCount++;
        break;
      case "failure":
        failureCount++;
        break;
      default:
        failureCount++;
        break;
    }

    for (const token of outcomeEvent.sourceSignalTokens) {
      if (
        token !== capabilityId
        && token !== "success"
        && token !== "partial"
        && token !== "failure"
        && token !== "contract_failure"
        && token !== "outcome_success"
        && token !== "outcome_partial"
        && token !== "outcome_failure"
        && token !== "outcome_contract_failure"
        && !token.startsWith("reported_by_")
        && !token.startsWith("error_")
        && !tags.includes(token)
      ) {
        tags.push(token);
      }
    }
  }

  const effectiveSuccesses = successCount + partialCount * 0.5;
  const reliability = laplaceSmooth(effectiveSuccesses, outcomes.length);
  const freshness = computeFreshness(lastReportedAt);

  return {
    capabilityId,
    successCount,
    partialCount,
    failureCount,
    contractFailureCount,
    totalCount: outcomes.length,
    reliability,
    freshness,
    lastReportedAt,
    outcomeCount: outcomes.length,
    outcomeTags: tags.slice(0, 20),
  };
}
