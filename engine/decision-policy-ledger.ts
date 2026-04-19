/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";

import { uniqueStrings } from "./engine-source-utils.ts";
import { extractSourceSignalTokens } from "./routing/routing-correction-ledger.ts";

export type DecisionPolicyEvent = {
  recordedAt: string;
  source: "discovery_routing_review";
  candidateId: string;
  sourceType: string;
  decision: string;
  originalLaneId: string;
  resolvedLaneId: string;
  originalConfidence: string | null;
  resolvedConfidence: string | null;
  originalNeedsHumanReview: boolean | null;
  resolvedNeedsHumanReview: boolean | null;
  matchedGapId: string | null;
  missionSpecificityWarning: string | null;
  goalCopilotWarnings: string[];
  followUpRequestedFields: string[];
  sourceSignalTokens: string[];
  rationale: string;
};

export type DecisionPolicySuggestion = {
  suggestionId: string;
  policyKind: "routing_bias" | "goal_hint" | "approval_boundary" | "gap_heuristic";
  confidence: "low" | "medium" | "high";
  evidenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  summary: string;
  recommendedChange: string;
  exampleSignals: string[];
  candidateExamples: string[];
};

export type DecisionPolicyLedger = {
  schemaVersion: 1;
  events: DecisionPolicyEvent[];
  suggestions: DecisionPolicySuggestion[];
};

const LEDGER_RELATIVE_PATH = "engine/decision-policy-ledger.json";

function defaultLedger(): DecisionPolicyLedger {
  return {
    schemaVersion: 1,
    events: [],
    suggestions: [],
  };
}

function toConfidence(count: number): "low" | "medium" | "high" {
  if (count >= 3) {
    return "high";
  }
  if (count >= 2) {
    return "medium";
  }
  return "low";
}

function topRecurringTokens(events: DecisionPolicyEvent[], limit = 4) {
  const counts = new Map<string, number>();
  for (const event of events) {
    for (const token of uniqueStrings(event.sourceSignalTokens)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([token]) => token)
    .slice(0, limit);
}

function buildSuggestion(input: {
  policyKind: DecisionPolicySuggestion["policyKind"];
  events: DecisionPolicyEvent[];
  summary: string;
  recommendedChange: string;
  exampleSignals: string[];
}) {
  const sortedEvents = [...input.events].sort((left, right) =>
    left.recordedAt.localeCompare(right.recordedAt)
  );
  const firstSeenAt = sortedEvents[0]?.recordedAt ?? "";
  const lastSeenAt = sortedEvents[sortedEvents.length - 1]?.recordedAt ?? "";
  return {
    suggestionId: [
      input.policyKind,
      firstSeenAt,
      input.exampleSignals.join("-") || "generic",
    ]
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 96),
    policyKind: input.policyKind,
    confidence: toConfidence(input.events.length),
    evidenceCount: input.events.length,
    firstSeenAt,
    lastSeenAt,
    summary: input.summary,
    recommendedChange: input.recommendedChange,
    exampleSignals: input.exampleSignals,
    candidateExamples: uniqueStrings(input.events.map((event) => event.candidateId)).slice(0, 5),
  } satisfies DecisionPolicySuggestion;
}

function compileRoutingBiasSuggestions(events: DecisionPolicyEvent[]) {
  const redirects = events.filter((event) =>
    event.originalLaneId !== event.resolvedLaneId
    && event.resolvedLaneId !== "reject"
  );
  const groups = new Map<string, DecisionPolicyEvent[]>();

  for (const event of redirects) {
    const key = `${event.originalLaneId}->${event.resolvedLaneId}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return [...groups.entries()].map(([key, groupEvents]) => {
    const [originalLaneId, resolvedLaneId] = key.split("->");
    const exampleSignals = topRecurringTokens(groupEvents);
    const signalSummary = exampleSignals.length > 0
      ? ` when signals mention ${exampleSignals.join(", ")}`
      : "";

    return buildSuggestion({
      policyKind: "routing_bias",
      events: groupEvents,
      summary:
        `Operators redirected ${originalLaneId} routes to ${resolvedLaneId}${signalSummary}.`,
      recommendedChange:
        `Bias ${resolvedLaneId} upward and ${originalLaneId} downward for similar cases, then replay the adjustment against historical runs before expanding auto-approval.`,
      exampleSignals,
    });
  });
}

function compileGoalHintSuggestions(events: DecisionPolicyEvent[]) {
  const suggestions: DecisionPolicySuggestion[] = [];

  const vagueObjectiveEvents = events.filter((event) =>
    Boolean(event.missionSpecificityWarning)
    || event.followUpRequestedFields.includes("mission.currentObjective")
  );
  if (vagueObjectiveEvents.length > 0) {
    suggestions.push(buildSuggestion({
      policyKind: "goal_hint",
      events: vagueObjectiveEvents,
      summary:
        "Operators repeatedly had to compensate for vague mission objectives before routing could be trusted.",
      recommendedChange:
        "Strengthen the goal template so current objectives require 2-3 concrete capability nouns and a bounded success condition.",
      exampleSignals: topRecurringTokens(vagueObjectiveEvents),
    }));
  }

  const weakConstraintEvents = events.filter((event) =>
    event.goalCopilotWarnings.some((warning) => /constraint/i.test(warning))
  );
  if (weakConstraintEvents.length > 0) {
    suggestions.push(buildSuggestion({
      policyKind: "goal_hint",
      events: weakConstraintEvents,
      summary:
        "Weak or missing constraints repeatedly forced extra review because the mission did not define how work should stay bounded.",
      recommendedChange:
        "Require every goal to include explicit review, scope, and rollback constraints before enabling confident routing.",
      exampleSignals: topRecurringTokens(weakConstraintEvents),
    }));
  }

  const laneAmbiguityEvents = events.filter((event) =>
    event.goalCopilotWarnings.some((warning) => /lane|target|ownership/i.test(warning))
    || event.followUpRequestedFields.includes("source.primaryAdoptionTarget")
  );
  if (laneAmbiguityEvents.length > 0) {
    suggestions.push(buildSuggestion({
      policyKind: "goal_hint",
      events: laneAmbiguityEvents,
      summary:
        "Mission lane ownership is repeatedly under-specified, so operators keep adding explicit adoption-target context by hand.",
      recommendedChange:
        "Require a dominant mission adoption target or a clearly ordered lane list whenever all three lanes remain in play.",
      exampleSignals: topRecurringTokens(laneAmbiguityEvents),
    }));
  }

  return suggestions;
}

function compileApprovalBoundarySuggestions(events: DecisionPolicyEvent[]) {
  const autoClearCandidates = events.filter((event) =>
    event.originalNeedsHumanReview === true
    && event.resolvedNeedsHumanReview === false
    && event.resolvedConfidence === "high"
    && (event.resolvedLaneId === "architecture" || event.resolvedLaneId === "runtime")
  );
  const groups = new Map<string, DecisionPolicyEvent[]>();

  for (const event of autoClearCandidates) {
    groups.set(event.resolvedLaneId, [...(groups.get(event.resolvedLaneId) ?? []), event]);
  }

  return [...groups.entries()].map(([laneId, groupEvents]) =>
    buildSuggestion({
      policyKind: "approval_boundary",
      events: groupEvents,
      summary:
        `Operators repeatedly cleared high-confidence ${laneId} reviews without preserving the original human-review requirement.`,
      recommendedChange:
        `Use these decisions as earned-autonomy evidence for ${laneId}, but gate any automation behind route-class replay and rollback checks first.`,
      exampleSignals: topRecurringTokens(groupEvents),
    })
  );
}

function compileGapHeuristicSuggestions(events: DecisionPolicyEvent[]) {
  const noGapEvents = events.filter((event) =>
    !event.matchedGapId
    && (event.resolvedLaneId === "architecture" || event.resolvedLaneId === "runtime")
  );
  const groups = new Map<string, DecisionPolicyEvent[]>();

  for (const event of noGapEvents) {
    const tokens = topRecurringTokens([event], 2);
    if (tokens.length === 0) {
      continue;
    }
    const key = `${event.resolvedLaneId}:${tokens.join(",")}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return [...groups.values()]
    .filter((groupEvents) => groupEvents.length >= 2)
    .map((groupEvents) => {
      const laneId = groupEvents[0]?.resolvedLaneId ?? "architecture";
      const exampleSignals = topRecurringTokens(groupEvents);
      return buildSuggestion({
        policyKind: "gap_heuristic",
        events: groupEvents,
        summary:
          `Reviewed ${laneId} cases keep landing without an open gap match when signals mention ${exampleSignals.join(", ")}.`,
        recommendedChange:
          `Open or reprioritize a capability gap around ${exampleSignals.join(", ")} so similar sources stop depending on ad hoc operator memory.`,
        exampleSignals,
      });
    });
}

export function compileDecisionPolicySuggestions(events: DecisionPolicyEvent[]) {
  return [
    ...compileRoutingBiasSuggestions(events),
    ...compileGoalHintSuggestions(events),
    ...compileApprovalBoundarySuggestions(events),
    ...compileGapHeuristicSuggestions(events),
  ].sort((left, right) => {
    if (right.evidenceCount !== left.evidenceCount) {
      return right.evidenceCount - left.evidenceCount;
    }
    return left.summary.localeCompare(right.summary);
  });
}

export function resolveDecisionPolicyLedgerPath(directiveRoot: string) {
  return path.resolve(directiveRoot, LEDGER_RELATIVE_PATH).replace(/\\/g, "/");
}

export function readDecisionPolicyLedger(directiveRoot: string): DecisionPolicyLedger {
  const ledgerPath = resolveDecisionPolicyLedgerPath(directiveRoot);
  if (!fs.existsSync(ledgerPath)) {
    return defaultLedger();
  }

  try {
    const raw = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    if (
      raw
      && typeof raw === "object"
      && Array.isArray(raw.events)
      && Array.isArray(raw.suggestions)
    ) {
      return raw as DecisionPolicyLedger;
    }
    return defaultLedger();
  } catch {
    return defaultLedger();
  }
}

export function appendDecisionPolicyEvent(input: {
  directiveRoot: string;
  event: DecisionPolicyEvent;
}) {
  const ledger = readDecisionPolicyLedger(input.directiveRoot);
  ledger.events.push({
    ...input.event,
    sourceSignalTokens: uniqueStrings(
      input.event.sourceSignalTokens.length > 0
        ? input.event.sourceSignalTokens
        : extractSourceSignalTokens(input.event.rationale),
    ).slice(0, 40),
  });
  ledger.suggestions = compileDecisionPolicySuggestions(ledger.events);

  const ledgerPath = resolveDecisionPolicyLedgerPath(input.directiveRoot);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

  return {
    ledgerPath,
    ledger,
    suggestions: ledger.suggestions,
  };
}
