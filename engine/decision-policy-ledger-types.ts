export type DecisionPolicyEvent = {
  recordedAt: string;
  source: "discovery_routing_review" | "capability_invocation" | "capability_outcome";
  candidateId: string;
  sourceType?: string;
  decision?: string;
  originalLaneId?: string;
  resolvedLaneId?: string;
  originalConfidence?: string | null;
  resolvedConfidence?: string | null;
  originalNeedsHumanReview?: boolean | null;
  resolvedNeedsHumanReview?: boolean | null;
  matchedGapId?: string | null;
  missionSpecificityWarning?: string | null;
  goalCopilotWarnings?: string[];
  followUpRequestedFields?: string[];
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
