/**
 * Retroactive Earned Autonomy Assessment
 *
 * Reads the 96 real routing decisions from the decision-policy ledger
 * and runs a retroactive assessment: for each event, checks whether the
 * earned-autonomy system would have flagged that route as auto-approvable
 * or review-first, then compares to the actual operator decision.
 *
 * Usage: npx tsx scripts/retroactive-earned-autonomy.ts --directive-root <path>
 *
 * Reports:
 * - Total events assessed
 * - Agreement rate (earned-autonomy prediction matches historical outcome)
 * - Auto-approve vs review-first breakdown
 * - Contradictions (where the model would auto-approve but operator rejected)
 */

import fs from "node:fs";
import path from "node:path";
import {
  readDecisionPolicyLedger,
  type DecisionPolicyEvent,
} from "../engine/decision-policy-ledger.ts";
import { deriveEngineRouteClass } from "../engine/routing/earned-autonomy.ts";
import { countTokenOverlap } from "../engine/source-utils.ts";
import { extractSourceSignalTokens } from "../engine/routing/correction-ledger.ts";

// ── Types ──────────────────────────────────────────────────────────

interface RetroAssessment {
  eventIndex: number;
  recordedAt: string;
  sourceType: string;
  resolvedLaneId: string;
  originalLaneId: string;
  resolvedConfidence: string;
  originalNeedsHumanReview: boolean;
  resolvedNeedsHumanReview: boolean;
  routeClass: string;
  /** Would the earned-autonomy model approve this route? */
  predictedAutoApprove: boolean;
  /** Did the operator actually approve? (resolved without human review) */
  actualAutoApproved: boolean;
  /** Did the prediction match reality? */
  agreement: boolean;
}

interface RetroReport {
  totalEvents: number;
  predictedAutoApproveCount: number;
  actualAutoApprovedCount: number;
  agreementCount: number;
  agreementRate: string;
  contradictions: RetroAssessment[];
}

// ── Assessment logic ───────────────────────────────────────────────

function assessEvent(
  event: DecisionPolicyEvent,
  allEvents: DecisionPolicyEvent[],
  index: number,
): RetroAssessment {
  const routeClass = [
    event.resolvedLaneId,
    event.sourceType,
    "nonworkflow",
    "external",
    "nocode",
  ].join(":");

  const sourceTokens = event.sourceSignalTokens.length > 0
    ? event.sourceSignalTokens
    : extractSourceSignalTokens(event.rationale);

  // Find matching events for the same route class
  const matchingEvents = allEvents.filter((e, i) => {
    if (i >= index) return false; // only prior events
    const rc = [
      e.resolvedLaneId,
      e.sourceType,
      "nonworkflow",
      "external",
      "nocode",
    ].join(":");
    return rc === routeClass;
  });

  // Count agreements (operator agreed with original lane)
  const operatorAgreementCount = matchingEvents.filter(
    (e) => e.originalLaneId === e.resolvedLaneId,
  ).length;

  // Count review clears (needed review → resolved without)
  const reviewClearCount = matchingEvents.filter(
    (e) =>
      e.originalNeedsHumanReview === true &&
      e.resolvedNeedsHumanReview === false &&
      e.resolvedConfidence === "high",
  ).length;

  // Count reversals
  const contraryEvents = allEvents.filter((e, i) => {
    if (i >= index) return false;
    return (
      e.sourceType === event.sourceType &&
      e.resolvedLaneId !== event.resolvedLaneId &&
      countTokenOverlap(sourceTokens, e.sourceSignalTokens) >= 2
    );
  });

  const reversalCount =
    contraryEvents.length +
    matchingEvents.filter((e) => e.originalLaneId !== e.resolvedLaneId).length;

  const evidenceCount = matchingEvents.length;

  // Simplified autonomy score (no clean runs or quality assessment in retro mode)
  const overallScore = Math.min(
    100,
    Math.max(
      0,
      10 +
        operatorAgreementCount * 10 +
        reviewClearCount * 8 +
        (event.resolvedConfidence === "high" ? 10 : event.resolvedConfidence === "medium" ? 5 : 0) -
        contraryEvents.length * 14 -
        reversalCount * 6,
    ),
  );

  const predictedAutoApprove = Boolean(
    (event.originalNeedsHumanReview ?? false) &&
    event.resolvedLaneId !== "discovery" &&
    event.resolvedConfidence !== "low" &&
    evidenceCount >= 3 &&
    overallScore >= 75 &&
    contraryEvents.length === 0 &&
    reversalCount <= 1 &&
    (operatorAgreementCount >= 2 || reviewClearCount >= 2),
  );

  const actualAutoApproved = Boolean(
    (event.originalNeedsHumanReview ?? false) && !(event.resolvedNeedsHumanReview ?? true),
  );

  return {
    eventIndex: index,
    recordedAt: event.recordedAt,
    sourceType: event.sourceType ?? "unknown",
    resolvedLaneId: event.resolvedLaneId ?? "unknown",
    originalLaneId: event.originalLaneId ?? "unknown",
    resolvedConfidence: event.resolvedConfidence ?? "medium",
    originalNeedsHumanReview: event.originalNeedsHumanReview ?? false,
    resolvedNeedsHumanReview: event.resolvedNeedsHumanReview ?? false,
    routeClass,
    predictedAutoApprove,
    actualAutoApproved,
    agreement: predictedAutoApprove === actualAutoApproved,
  };
}

// ── Main ───────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let root = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--directive-root" && i + 1 < args.length) {
      root = path.resolve(args[i + 1]).replace(/\\/g, "/");
      i++;
    }
  }

  if (!fs.existsSync(root)) {
    console.error(`Directive root not found: ${root}`);
    process.exit(1);
  }

  const ledger = readDecisionPolicyLedger(root, { lookback: "all" });
  const events = ledger.events;

  if (events.length === 0) {
    console.log("No ledger events found.");
    return;
  }

  console.log(`=== Retroactive Earned Autonomy Assessment ===\n`);
  console.log(`Directive root: ${root}`);
  console.log(`Total events:   ${events.length}\n`);

  const assessments: RetroAssessment[] = events.map((event, i) =>
    assessEvent(event, events, i),
  );

  const predictedAuto = assessments.filter((a) => a.predictedAutoApprove);
  const actualAuto = assessments.filter((a) => a.actualAutoApproved);
  const agreements = assessments.filter((a) => a.agreement);
  const contradictions = assessments.filter(
    (a) => a.predictedAutoApprove && !a.actualAutoApproved,
  );
  const missedOpportunities = assessments.filter(
    (a) => !a.predictedAutoApprove && a.actualAutoApproved,
  );

  const agreementRate =
    assessments.length > 0
      ? ((agreements.length / assessments.length) * 100).toFixed(1)
      : "0";

  console.log(`Results:`);
  console.log(`  Predicted auto-approve:    ${predictedAuto.length}`);
  console.log(`  Actual auto-approved:       ${actualAuto.length}`);
  console.log(`  Agreement:                  ${agreements.length} (${agreementRate}%)`);
  console.log(`  Contradictions:             ${contradictions.length} (predicted auto, operator rejected)`);
  console.log(`  Missed opportunities:       ${missedOpportunities.length} (predicted review, operator approved)`);

  // Breakdown by lane
  console.log(`\nBreakdown by lane:`);
  const lanes = ["discovery", "runtime", "architecture"] as const;
  for (const lane of lanes) {
    const laneEvents = assessments.filter((a) => a.resolvedLaneId === lane);
    if (laneEvents.length === 0) continue;
    const laneAgreements = laneEvents.filter((a) => a.agreement);
    const laneRate =
      laneEvents.length > 0
        ? ((laneAgreements.length / laneEvents.length) * 100).toFixed(1)
        : "0";
    console.log(`  ${lane}: ${laneEvents.length} events, ${laneAgreements.length} agreements (${laneRate}%)`);
  }

  // Show contradictions
  if (contradictions.length > 0) {
    console.log(`\n⚠ Contradictions (model would auto-approve but operator required review):`);
    for (const c of contradictions.slice(0, 5)) {
      console.log(`  Event #${c.eventIndex} | ${c.sourceType} → ${c.resolvedLaneId}`);
      console.log(`    Original lane: ${c.originalLaneId} | Confidence: ${c.resolvedConfidence}`);
      console.log(`    Model: auto-approve | Operator: review-required`);
    }
    if (contradictions.length > 5) {
      console.log(`  ... and ${contradictions.length - 5} more`);
    }
  }

  // Show missed opportunities
  if (missedOpportunities.length > 0) {
    console.log(`\n⚠ Missed opportunities (model would require review but operator approved):`);
    for (const m of missedOpportunities.slice(0, 5)) {
      console.log(`  Event #${m.eventIndex} | ${m.sourceType} → ${m.resolvedLaneId}`);
      console.log(`    Model: review-required | Operator: auto-approved`);
    }
    if (missedOpportunities.length > 5) {
      console.log(`  ... and ${missedOpportunities.length - 5} more`);
    }
  }

  console.log(`\nAgreement rate: ${agreementRate}%`);
}

main();
