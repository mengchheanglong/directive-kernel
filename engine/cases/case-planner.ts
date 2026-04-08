import type { DirectiveMirroredCaseSnapshotResult } from "./case-snapshot.ts";

export type DirectiveCasePlannerRecommendation =
  | {
      outcome: "stop";
      reason: string;
      legalBecause: string;
      highestConfidenceWhy: string;
    }
  | {
      outcome: "parked";
      reason: string;
      legalBecause: string;
      highestConfidenceWhy: string;
    }
  | {
      outcome: "waiting_review";
      reason: string;
      legalBecause: string;
      highestConfidenceWhy: string;
      reviewTarget: "architecture" | "runtime" | "discovery";
    }
  | {
      outcome: "blocked";
      reason: string;
      legalBecause: string;
      highestConfidenceWhy: string;
      blockedOn: string[];
    }
  | {
      outcome: "recommend_task";
      task: {
        kind: string;
        reason: string;
        requiredPreconditionsSatisfied: string[];
        legalBecause: string;
        highestConfidenceWhy: string;
      };
    };

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function containsAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

export function planDirectiveMirroredCaseNextStep(input: {
  snapshot: DirectiveMirroredCaseSnapshotResult;
}): DirectiveCasePlannerRecommendation {
  if (!input.snapshot.ok) {
    return {
      outcome: "blocked",
      reason: "No mirrored case snapshot exists yet for this case.",
      legalBecause: "Phase 2 planner mode is read-only and only plans from the mirrored snapshot substrate.",
      highestConfidenceWhy: "Missing snapshot state is a hard blocker for recommendation mode.",
      blockedOn: ["mirrored_case_snapshot_missing"],
    };
  }

  const stage = normalizeText(input.snapshot.currentStage);
  const nextLegalStep = normalizeText(input.snapshot.nextLegalStep);
  const operatingMode = normalizeText(input.snapshot.operatingMode);

  if (!stage && !nextLegalStep) {
    return {
      outcome: "stop",
      reason: "Legacy entry with no canonical stage or next-step data. Completed before the case modeling system existed.",
      legalBecause: "No workflow state is available to plan from.",
      highestConfidenceWhy: "The case has no stage or legal-next-step, indicating it is a pre-system terminal entry.",
    };
  }

  if (
    stage === "architecture.bounded_result.adopt"
    || (stage.startsWith("architecture.bounded_result") && containsAny(nextLegalStep, ["confirm retention", "open the retained"]))
  ) {
    return {
      outcome: "recommend_task",
      task: {
        kind: "confirm_retention",
        reason: "The case adopted its bounded result and the next explicit step is retention confirmation.",
        requiredPreconditionsSatisfied: ["snapshot_current_stage_known", "bounded_result_adopted"],
        legalBecause: input.snapshot.nextLegalStep ?? "Adoption opens the retention confirmation boundary.",
        highestConfidenceWhy: "The adopted bounded result explicitly opens a retention confirmation step.",
      },
    };
  }

  if (
    containsAny(nextLegalStep, [
      "no workflow advancement is legal",
      "broken or inconsistent artifact state",
    ])
  ) {
    return {
      outcome: "blocked",
      reason: "The mirrored snapshot reflects a broken or inconsistent case boundary.",
      legalBecause: "Current doctrine blocks advancement when integrity is broken.",
      highestConfidenceWhy: "The legal-next-step text already declares advancement blocked.",
      blockedOn: ["integrity_repair"],
    };
  }

  if (
    stage === "architecture.handoff.pending_review"
    || stage === "runtime.follow_up.pending_review"
    || containsAny(nextLegalStep, ["explicitly approve", "review the routed architecture handoff"])
  ) {
    return {
      outcome: "waiting_review",
      reason: "The next legal move is still an explicit review boundary, not execution.",
      legalBecause: input.snapshot.nextLegalStep ?? "Current doctrine requires explicit review.",
      highestConfidenceWhy: "The case has not crossed its review gate yet.",
      reviewTarget: stage.includes("runtime") ? "runtime" : "architecture",
    };
  }

  if (
    stage === "architecture.bounded_result.stay_experimental"
    && operatingMode === "note"
  ) {
    return {
      outcome: "stop",
      reason: "This NOTE-mode Architecture case already closed at its explicit bounded-result stop.",
      legalBecause: input.snapshot.nextLegalStep ?? "NOTE-mode bounded result is an explicit stop.",
      highestConfidenceWhy: "NOTE doctrine favors explicit stop over speculative continuation.",
    };
  }

  if (
    stage === "architecture.bounded_result.stay_experimental"
    || containsAny(nextLegalStep, ["continue the experimental architecture slice or stop without auto-advancing"])
  ) {
    return {
      outcome: "parked",
      reason: "The case is still experimental and should not auto-continue without new bounded pressure.",
      legalBecause: input.snapshot.nextLegalStep ?? "stay_experimental does not open an automatic continuation.",
      highestConfidenceWhy: "The highest-confidence move is to park rather than reopen by momentum.",
    };
  }

  if (
    stage === "discovery.monitor.active"
    || containsAny(nextLegalStep, [
      "keep the source in discovery monitor",
      "keep the source in discovery until the adoption target becomes clearer",
    ])
  ) {
    return {
      outcome: "parked",
      reason: "The source is intentionally being held in Discovery monitor until a later explicit reroute is justified.",
      legalBecause: input.snapshot.nextLegalStep ?? "Discovery monitor is a non-advancing hold boundary.",
      highestConfidenceWhy: "The case is intentionally non-advancing and should not be reopened by momentum.",
    };
  }

  if (stage === "runtime.promotion_readiness.opened") {
    return {
      outcome: "parked",
      reason: "Promotion-readiness is a non-executing Runtime stop until a later explicit seam is opened.",
      legalBecause: input.snapshot.nextLegalStep ?? "Promotion-readiness does not authorize automatic continuation.",
      highestConfidenceWhy: "Current doctrine explicitly keeps host-facing promotion, implementation, and execution unopened.",
    };
  }

  if (stage === "runtime.promotion_record.opened") {
    return {
      outcome: "parked",
      reason: "The first manual Runtime promotion record is a bounded stop until a later evidence-to-decision loop is explicitly opened.",
      legalBecause: input.snapshot.nextLegalStep ?? "The manual Runtime promotion record does not authorize automatic continuation.",
      highestConfidenceWhy: "Current doctrine still keeps registry acceptance, host integration, and runtime execution closed after the bounded manual promotion step.",
    };
  }

  if (
    stage === "architecture.implementation_target.opened"
    || containsAny(nextLegalStep, ["record the implementation result"])
  ) {
    return {
      outcome: "recommend_task",
      task: {
        kind: "record_implementation_result",
        reason: "The current boundary explicitly opens a bounded implementation-result step.",
        requiredPreconditionsSatisfied: ["snapshot_current_stage_known", "legal_next_step_explicit"],
        legalBecause: input.snapshot.nextLegalStep ?? "Implementation-result recording is the explicit next legal step.",
        highestConfidenceWhy: "The snapshot exposes a concrete bounded Architecture output that is now ready to be completed.",
      },
    };
  }

  if (stage === "architecture.post_consumption_evaluation.keep") {
    return {
      outcome: "stop",
      reason: "The case resolved to keep and does not currently justify another bounded move.",
      legalBecause: input.snapshot.nextLegalStep ?? "Keep is an explicit stop unless new bounded pressure is introduced.",
      highestConfidenceWhy: "The evaluated case has already reached a stable retained stop boundary.",
    };
  }

  if (containsAny(nextLegalStep, ["no automatic"])) {
    return {
      outcome: "stop",
      reason: "The truthful next move is to stop because no automatic step is currently open.",
      legalBecause: input.snapshot.nextLegalStep ?? "No automatic step is open.",
      highestConfidenceWhy: "The snapshot already says continuation is not currently opened.",
    };
  }

  if (containsAny(nextLegalStep, ["confirm retention"])) {
    return {
      outcome: "recommend_task",
      task: {
        kind: "confirm_retention",
        reason: "The current boundary explicitly opens a bounded retention confirmation step.",
        requiredPreconditionsSatisfied: ["snapshot_current_stage_known", "legal_next_step_explicit"],
        legalBecause: input.snapshot.nextLegalStep ?? "Retention confirmation is the explicit next legal step.",
        highestConfidenceWhy: "The snapshot exposes a concrete bounded product artifact that does not yet exist.",
      },
    };
  }

  if (containsAny(nextLegalStep, ["record integration", "create the integration record"])) {
    return {
      outcome: "recommend_task",
      task: {
        kind: "record_integration",
        reason: "The current boundary explicitly opens a bounded integration-record step.",
        requiredPreconditionsSatisfied: ["snapshot_current_stage_known", "legal_next_step_explicit"],
        legalBecause: input.snapshot.nextLegalStep ?? "Integration recording is the explicit next legal step.",
        highestConfidenceWhy: "The snapshot exposes a concrete bounded product artifact that does not yet exist.",
      },
    };
  }

  if (containsAny(nextLegalStep, ["record consumption", "create the consumption record"])) {
    return {
      outcome: "recommend_task",
      task: {
        kind: "record_consumption",
        reason: "The current boundary explicitly opens a bounded consumption-record step.",
        requiredPreconditionsSatisfied: ["snapshot_current_stage_known", "legal_next_step_explicit"],
        legalBecause: input.snapshot.nextLegalStep ?? "Consumption recording is the explicit next legal step.",
        highestConfidenceWhy: "The snapshot exposes a concrete bounded product artifact that does not yet exist.",
      },
    };
  }

  if (containsAny(nextLegalStep, ["evaluate the applied architecture output after use"])) {
    return {
      outcome: "recommend_task",
      task: {
        kind: "evaluate_post_consumption",
        reason: "The current boundary explicitly opens a bounded post-consumption evaluation step.",
        requiredPreconditionsSatisfied: ["snapshot_current_stage_known", "legal_next_step_explicit"],
        legalBecause: input.snapshot.nextLegalStep ?? "Post-consumption evaluation is the explicit next legal step.",
        highestConfidenceWhy: "The snapshot exposes a concrete bounded product artifact that does not yet exist.",
      },
    };
  }

  return {
    outcome: "blocked",
    reason: "The snapshot does not yet map cleanly onto a minimal planner doctrine rule.",
    legalBecause: "Phase 2 first-slice planner only recommends when the legal boundary is explicit and high-confidence.",
    highestConfidenceWhy: "Defaulting to blocked is safer than inventing a new planning semantic.",
    blockedOn: ["unsupported_snapshot_stage"],
  };
}
