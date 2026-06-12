import { readDecisionPolicyLedger } from "../../../engine/decision-policy-ledger.ts";

export interface CapabilityReliability {
  capabilityId: string;
  successCount: number;
  totalCount: number;
  /** Laplace-smoothed reliability (0.0–1.0). Adds 1 pseudo-success and 1 pseudo-failure. */
  reliability: number;
  /** Freshness: how recent the last activity is (0.0–1.0), decaying over 30 days. */
  freshness: number;
  lastReportedAt: string | null;
  /** Tags/descriptions extracted from successful outcomes. */
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
  // Exponential decay: 0.5^(age/halfLife)
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export function deriveCapabilityReliability(
  capabilityId: string,
  directiveRoot: string,
): CapabilityReliability {
  const ledger = readDecisionPolicyLedger(directiveRoot, { lookback: "all" });
  const outcomes = ledger.events.filter(
    (e) => e.source === "capability_outcome" && e.candidateId === capabilityId,
  );

  let successCount = 0;
  const tags: string[] = [];
  let lastReportedAt: string | null = null;

  for (const out of [...outcomes].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  )) {
    if (!lastReportedAt) lastReportedAt = out.recordedAt;
    if (out.rationale.includes("success")) successCount++;
    // Extract tags from signal tokens
    for (const token of out.sourceSignalTokens) {
      if (token !== capabilityId && token !== "success" && token !== "failure" && !tags.includes(token)) {
        tags.push(token);
      }
    }
  }

  const reliability = laplaceSmooth(successCount, outcomes.length);
  const freshness = computeFreshness(lastReportedAt);

  return {
    capabilityId,
    successCount,
    totalCount: outcomes.length,
    reliability,
    freshness,
    lastReportedAt,
    outcomeCount: outcomes.length,
    outcomeTags: tags.slice(0, 20),
  };
}
