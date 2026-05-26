export type LifecycleState =
  | "intake"
  | "analyzed"
  | "experimenting"
  | "evaluated"
  | "decided"
  | "integrated"
  | "blocked";

export type LifecycleRole =
  | "operator"
  | "reviewer"
  | "evaluator"
  | "decision_owner"
  | "integration_owner"
  | "recovery_patrol"
  | "planner";

export type ReviewResult = "approved" | "rejected";
export type ReviewScore = 1 | 2 | 3 | 4 | 5;
export type ReviewQualityBand =
  | "strong_pass"
  | "acceptable"
  | "mixed"
  | "weak"
  | "fail";
export type ReviewOutcome =
  | "promote_to_decision"
  | "accept_with_follow_up"
  | "resume_experiment"
  | "blocked_recovery";
export type RecoveryStep = "detect" | "reassign" | "resume";

export type LifecycleTransitionRequest = {
  from: LifecycleState;
  to: LifecycleState;
  role: LifecycleRole;
};

export type LifecycleTransitionGate = {
  from: LifecycleState;
  to: LifecycleState;
  allowedRoles: LifecycleRole[];
};

export type BlockedRecoveryPlan = {
  blockedReason: string;
  resumeTarget: Extract<LifecycleState, "analyzed" | "experimenting">;
  steps: Array<{
    step: RecoveryStep;
    owner: Extract<LifecycleRole, "recovery_patrol" | "planner">;
    description: string;
  }>;
};

export type ReviewFeedbackInput = {
  reviewResult: ReviewResult;
  reviewScore: ReviewScore;
  recoveryOwnerAssigned?: boolean;
  blockedReason?: string;
  resumeTarget?: Extract<LifecycleState, "analyzed" | "experimenting">;
};

export type ReviewFeedbackPlan = {
  scoreDelta: number;
  qualityBand: ReviewQualityBand;
  degradedQuality: boolean;
  shouldRecordRecoveryFollowUp: boolean;
  outcome: ReviewOutcome;
  recommendedNextState: Extract<
    LifecycleState,
    "decided" | "experimenting" | "blocked"
  >;
  requiredRole: Extract<
    LifecycleRole,
    "decision_owner" | "planner" | "recovery_patrol"
  >;
  recoveryPlan?: BlockedRecoveryPlan;
};

export const DIRECTIVE_LIFECYCLE_TRANSITIONS: Record<
  LifecycleState,
  LifecycleState[]
> = {
  intake: ["analyzed"],
  analyzed: ["experimenting"],
  experimenting: ["evaluated", "blocked"],
  evaluated: ["decided", "blocked", "experimenting"],
  decided: ["integrated", "blocked"],
  integrated: [],
  blocked: ["analyzed", "experimenting"],
};

export const DIRECTIVE_LIFECYCLE_ROLE_GATES: LifecycleTransitionGate[] = [
  { from: "intake", to: "analyzed", allowedRoles: ["operator"] },
  { from: "analyzed", to: "experimenting", allowedRoles: ["operator"] },
  { from: "experimenting", to: "evaluated", allowedRoles: ["reviewer", "evaluator"] },
  { from: "evaluated", to: "decided", allowedRoles: ["decision_owner"] },
  { from: "decided", to: "integrated", allowedRoles: ["integration_owner"] },
  { from: "experimenting", to: "blocked", allowedRoles: ["recovery_patrol"] },
  { from: "evaluated", to: "blocked", allowedRoles: ["recovery_patrol"] },
  { from: "decided", to: "blocked", allowedRoles: ["recovery_patrol"] },
  { from: "blocked", to: "analyzed", allowedRoles: ["planner"] },
  { from: "blocked", to: "experimenting", allowedRoles: ["planner"] },
  { from: "evaluated", to: "experimenting", allowedRoles: ["planner"] },
];

export const DIRECTIVE_REVIEW_SCORE_DELTAS: Record<ReviewScore, number> = {
  1: -2,
  2: -1,
  3: 0,
  4: 1,
  5: 2,
};

function toQualityBand(score: ReviewScore): ReviewQualityBand {
  if (score === 5) {
    return "strong_pass";
  }
  if (score === 4) {
    return "acceptable";
  }
  if (score === 3) {
    return "mixed";
  }
  if (score === 2) {
    return "weak";
  }
  return "fail";
}

function normalizeBlockedReason(value: string | undefined) {
  const normalized = String(value || "").trim();
  return normalized || "review rejected and no explicit recovery owner was assigned";
}

export function getDirectiveAllowedLifecycleTargets(
  state: LifecycleState,
) {
  return [...DIRECTIVE_LIFECYCLE_TRANSITIONS[state]];
}

export function isDirectiveLifecycleTransitionAllowed(
  request: LifecycleTransitionRequest,
) {
  const allowedTargets = DIRECTIVE_LIFECYCLE_TRANSITIONS[request.from];
  if (!allowedTargets.includes(request.to)) {
    return false;
  }

  const gate = DIRECTIVE_LIFECYCLE_ROLE_GATES.find(
    (item) => item.from === request.from && item.to === request.to,
  );
  if (!gate) {
    return false;
  }

  return gate.allowedRoles.includes(request.role);
}

export function assertDirectiveLifecycleTransitionAllowed(
  request: LifecycleTransitionRequest,
) {
  if (isDirectiveLifecycleTransitionAllowed(request)) {
    return;
  }

  throw new Error(
    `invalid_transition: ${request.role} cannot move ${request.from} -> ${request.to}`,
  );
}

export function getDirectiveReviewScoreDelta(score: ReviewScore) {
  return DIRECTIVE_REVIEW_SCORE_DELTAS[score];
}

export function buildDirectiveBlockedRecoveryPlan(input?: {
  blockedReason?: string;
  resumeTarget?: Extract<LifecycleState, "analyzed" | "experimenting">;
}): BlockedRecoveryPlan {
  const resumeTarget = input?.resumeTarget || "experimenting";
  const blockedReason = normalizeBlockedReason(input?.blockedReason);

  return {
    blockedReason,
    resumeTarget,
    steps: [
      {
        step: "detect",
        owner: "recovery_patrol",
        description: "Record the blocked condition and capture the blocking reason explicitly.",
      },
      {
        step: "reassign",
        owner: "planner",
        description:
          "Assign a recovery owner or planner decision before the item returns to active flow.",
      },
      {
        step: "resume",
        owner: "planner",
        description: `Return the item to ${resumeTarget} with explicit recovery rationale.`,
      },
    ],
  };
}

export function resolveDirectiveReviewFeedback(
  input: ReviewFeedbackInput,
): ReviewFeedbackPlan {
  const qualityBand = toQualityBand(input.reviewScore);
  const scoreDelta = getDirectiveReviewScoreDelta(input.reviewScore);
  const degradedQuality = input.reviewScore <= 3;
  const shouldRecordRecoveryFollowUp =
    input.reviewResult === "rejected" || degradedQuality;

  if (input.reviewResult === "approved") {
    return {
      scoreDelta,
      qualityBand,
      degradedQuality,
      shouldRecordRecoveryFollowUp,
      outcome: degradedQuality
        ? "accept_with_follow_up"
        : "promote_to_decision",
      recommendedNextState: "decided",
      requiredRole: "decision_owner",
    };
  }

  if (input.recoveryOwnerAssigned) {
    return {
      scoreDelta,
      qualityBand,
      degradedQuality,
      shouldRecordRecoveryFollowUp: true,
      outcome: "resume_experiment",
      recommendedNextState: "experimenting",
      requiredRole: "planner",
    };
  }

  return {
    scoreDelta,
    qualityBand,
    degradedQuality,
    shouldRecordRecoveryFollowUp: true,
    outcome: "blocked_recovery",
    recommendedNextState: "blocked",
    requiredRole: "recovery_patrol",
    recoveryPlan: buildDirectiveBlockedRecoveryPlan({
      blockedReason: input.blockedReason,
      resumeTarget: input.resumeTarget,
    }),
  };
}
