import path from "node:path";
import {
  type DiscoveryRoutingTarget,
  type DiscoverySourceType,
} from "./discovery-intake-queue-writer.ts";
import {
  optionalString,
  requiredString,
} from "../../shared/lib/validation.ts";

export type DiscoveryRoutingDecisionState =
  | "adopt"
  | "defer"
  | "monitor"
  | "reject";

export type DiscoveryRoutingRecordRequest = {
  candidate_id: string;
  candidate_name: string;
  route_date: string;
  source_type: DiscoverySourceType;
  decision_state: DiscoveryRoutingDecisionState;
  adoption_target: string;
  route_destination: Exclude<DiscoveryRoutingTarget, null>;
  why_this_route: string;
  why_not_alternatives: string;
  receiving_track_owner: string;
  required_next_artifact: string;
  linked_intake_record: string;
  handoff_contract_used?: string | null;
  linked_triage_record?: string | null;
  linked_engine_run_record?: string | null;
  linked_engine_run_report?: string | null;
  reentry_or_promotion_conditions?: string | null;
  review_cadence?: string | null;
  mission_priority_score?: number | null;
  routing_confidence?: string | null;
  matched_gap_id?: string | null;
  matched_gap_rank?: number | null;
  route_conflict?: boolean | null;
  needs_human_review?: boolean | null;
  ambiguity_summary?: {
    top_track: string;
    runner_up_track: string | null;
    score_delta: number;
    conflicting_signal_families: string[];
    conflicting_tracks: string[];
  } | null;
  review_guidance?: {
    guidance_kind: string;
    summary: string;
    operator_action: string;
    required_checks: string[];
    stop_line: string;
  } | null;
  explanation_breakdown?: {
    keyword_signals: string[];
    metadata_signals: string[];
    gap_alignment_signals: string[];
    ambiguity_signals: string[];
  } | null;
  output_relative_path?: string | null;
};

function slugifyCandidateId(candidateId: string) {
  return candidateId.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function resolveDiscoveryRoutingRecordPath(
  request: DiscoveryRoutingRecordRequest,
) {
  const explicit = optionalString(request.output_relative_path);
  if (explicit) {
    return explicit.replace(/\\/g, "/");
  }
  return `discovery/03-routing-log/${request.route_date}-${slugifyCandidateId(
    request.candidate_id,
  )}-routing-record.md`;
}

export function renderDiscoveryRoutingRecord(
  request: DiscoveryRoutingRecordRequest,
) {
  const candidateId = requiredString(request.candidate_id, "candidate_id");
  const candidateName = requiredString(request.candidate_name, "candidate_name");
  const routeDate = requiredString(request.route_date, "route_date");
  const sourceType = requiredString(request.source_type, "source_type");
  const decisionState = requiredString(request.decision_state, "decision_state");
  const adoptionTarget = requiredString(request.adoption_target, "adoption_target");
  const routeDestination = requiredString(
    request.route_destination,
    "route_destination",
  );
  const whyThisRoute = requiredString(request.why_this_route, "why_this_route");
  const whyNotAlternatives = requiredString(
    request.why_not_alternatives,
    "why_not_alternatives",
  );
  const receivingTrackOwner = requiredString(
    request.receiving_track_owner,
    "receiving_track_owner",
  );
  const requiredNextArtifact = requiredString(
    request.required_next_artifact,
    "required_next_artifact",
  );
  const linkedIntakeRecord = requiredString(
    request.linked_intake_record,
    "linked_intake_record",
  );

  const handoffContractUsed = optionalString(request.handoff_contract_used);
  const linkedTriageRecord = optionalString(request.linked_triage_record);
  const linkedEngineRunRecord = optionalString(request.linked_engine_run_record);
  const linkedEngineRunReport = optionalString(request.linked_engine_run_report);
  const reentryOrPromotionConditions = optionalString(
    request.reentry_or_promotion_conditions,
  );
  const reviewCadence = optionalString(request.review_cadence);
  const missionPriorityScore =
    typeof request.mission_priority_score === "number" && Number.isFinite(request.mission_priority_score)
      ? String(Math.round(request.mission_priority_score))
      : null;
  const routingConfidence = optionalString(request.routing_confidence);
  const matchedGapId = optionalString(request.matched_gap_id);
  const matchedGapRank =
    typeof request.matched_gap_rank === "number" && Number.isFinite(request.matched_gap_rank)
      ? String(Math.round(request.matched_gap_rank))
      : null;
  const routeConflict =
    typeof request.route_conflict === "boolean"
      ? (request.route_conflict ? "yes" : "no")
      : null;
  const needsHumanReview =
    typeof request.needs_human_review === "boolean"
      ? (request.needs_human_review ? "yes" : "no")
      : null;
  const ambiguitySummary = request.ambiguity_summary ?? null;
  const reviewGuidance = request.review_guidance ?? null;
  const explanationBreakdown = request.explanation_breakdown ?? null;

  return `# Discovery Routing Record: ${candidateName}

Date: ${routeDate}

- Candidate id: ${candidateId}
- Candidate name: ${candidateName}
- Routing date: ${routeDate}
- Source type: ${sourceType}
- Decision state: ${decisionState}
- Adoption target: ${adoptionTarget}
- Route destination: ${routeDestination}
- Why this route: ${whyThisRoute}
- Why not the alternatives: ${whyNotAlternatives}
- Handoff contract used: ${handoffContractUsed ?? "n/a"}
- Receiving track owner: ${receivingTrackOwner}
- Required next artifact: ${requiredNextArtifact}
- Re-entry/Promotion trigger conditions: ${reentryOrPromotionConditions ?? "n/a"}
- Review cadence: ${reviewCadence ?? "n/a"}
- Mission priority score: ${missionPriorityScore ?? "n/a"}
- Routing confidence: ${routingConfidence ?? "n/a"}
- Matched gap id: ${matchedGapId ?? "n/a"}
- Matched gap rank: ${matchedGapRank ?? "n/a"}
- Route conflict: ${routeConflict ?? "n/a"}
- Needs human review: ${needsHumanReview ?? "n/a"}
- Linked intake record: ${linkedIntakeRecord}
- Linked triage record: ${linkedTriageRecord ?? "n/a"}
- Linked Engine run record: ${linkedEngineRunRecord ?? "n/a"}
- Linked Engine run report: ${linkedEngineRunReport ?? "n/a"}

${ambiguitySummary ? `## Ambiguity Summary

- Top track: ${ambiguitySummary.top_track}
- Runner-up track: ${ambiguitySummary.runner_up_track ?? "n/a"}
- Score delta: ${ambiguitySummary.score_delta}
- Conflicting signal families: ${ambiguitySummary.conflicting_signal_families.join(", ") || "none"}
- Conflicting tracks: ${ambiguitySummary.conflicting_tracks.join(", ") || "none"}

` : ""}${reviewGuidance ? `## Review Guidance

- Guidance kind: ${reviewGuidance.guidance_kind}
- Summary: ${reviewGuidance.summary}
- Operator action: ${reviewGuidance.operator_action}
- Required checks: ${reviewGuidance.required_checks.join(" | ") || "none"}
- Stop-line: ${reviewGuidance.stop_line}

` : ""}${explanationBreakdown ? `## Routing Explanation Breakdown

${explanationBreakdown.keyword_signals.map((entry) => `- Keyword: ${entry}`).join("\n")}
${explanationBreakdown.metadata_signals.map((entry) => `- Metadata: ${entry}`).join("\n")}
${explanationBreakdown.gap_alignment_signals.map((entry) => `- Gap: ${entry}`).join("\n")}
${explanationBreakdown.ambiguity_signals.map((entry) => `- Ambiguity: ${entry}`).join("\n")}
` : ""}`;
}

export function resolveDiscoveryRoutingRecordAbsolutePath(input: {
  directiveRoot: string;
  relativePath: string;
}) {
  const normalizedRelativePath = input.relativePath.replace(/\\/g, "/");
  const absolutePath = path.resolve(input.directiveRoot, normalizedRelativePath);
  const normalizedRoot = `${path.resolve(input.directiveRoot)}${path.sep}`;
  if (
    absolutePath !== path.resolve(input.directiveRoot) &&
    !absolutePath.startsWith(normalizedRoot)
  ) {
    throw new Error("routing record path must stay within directive-workspace");
  }
  return absolutePath;
}
