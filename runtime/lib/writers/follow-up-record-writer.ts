import path from "node:path";
import {
  normalizeRuntimeWriterList,
  optionalRuntimeWriterString,
  renderRuntimeWriterList,
  requireRuntimeWriterString,
} from "./writer-support.ts";

export type RuntimeHostSelectionMode = "inferred" | "manual_required" | "manual";
export type RuntimeHostConfidence = "high" | "medium" | "low";

export type RuntimeFollowUpRecordRequest = {
  candidate_id: string;
  candidate_name: string;
  follow_up_date: string;
  current_decision_state: string;
  origin_track: string;
  runtime_value_to_operationalize: string;
  proposed_host: string;
  host_selection_mode?: RuntimeHostSelectionMode | null;
  proposed_host_confidence?: RuntimeHostConfidence | null;
  proposed_integration_mode: string;
  source_pack_allowlist_profile?: string | null;
  allowed_export_surfaces?: string[] | null;
  excluded_baggage?: string[] | null;
  promotion_contract_path?: string | null;
  reentry_contract_path?: string | null;
  reentry_preconditions?: string[] | null;
  required_proof?: string[] | null;
  required_gates?: string[] | null;
  trial_scope_limit?: string[] | null;
  risks?: string[] | null;
  rollback: string;
  no_op_path: string;
  review_cadence: string;
  current_status: string;
  linked_handoff_path?: string | null;
  linked_runtime_record_path?: string | null;
  linked_proof_checklist_path?: string | null;
  linked_live_proof_path?: string | null;
  output_relative_path?: string | null;
};

export function resolveRuntimeFollowUpRecordPath(input: {
  candidate_id: string;
  follow_up_date: string;
  output_relative_path?: string | null;
}) {
  if (input.output_relative_path && input.output_relative_path.trim().length > 0) {
    return input.output_relative_path.trim();
  }
  return path
    .join(
      "runtime",
      "00-follow-up",
      `${input.follow_up_date}-${input.candidate_id}-runtime-follow-up-record.md`,
    )
    .replace(/\\/g, "/");
}

export function renderRuntimeFollowUpRecord(
  request: RuntimeFollowUpRecordRequest,
) {
  const candidateId = requireRuntimeWriterString(request.candidate_id, "candidate_id");
  const candidateName = requireRuntimeWriterString(request.candidate_name, "candidate_name");
  const followUpDate = requireRuntimeWriterString(request.follow_up_date, "follow_up_date");
  const currentDecisionState = requireRuntimeWriterString(
    request.current_decision_state,
    "current_decision_state",
  );
  const originTrack = requireRuntimeWriterString(request.origin_track, "origin_track");
  const runtimeValueToOperationalize = requireRuntimeWriterString(
    request.runtime_value_to_operationalize,
    "runtime_value_to_operationalize",
  );
  const proposedHost = requireRuntimeWriterString(request.proposed_host, "proposed_host");
  const proposedIntegrationMode = requireRuntimeWriterString(
    request.proposed_integration_mode,
    "proposed_integration_mode",
  );
  const rollback = requireRuntimeWriterString(request.rollback, "rollback");
  const noOpPath = requireRuntimeWriterString(request.no_op_path, "no_op_path");
  const reviewCadence = requireRuntimeWriterString(request.review_cadence, "review_cadence");
  const currentStatus = requireRuntimeWriterString(request.current_status, "current_status");

  const sourcePackAllowlistProfile =
    optionalRuntimeWriterString(request.source_pack_allowlist_profile) ?? "n/a";
  const promotionContractPath =
    optionalRuntimeWriterString(request.promotion_contract_path) ?? "pending";
  const reentryContractPath =
    optionalRuntimeWriterString(request.reentry_contract_path) ?? "n/a";
  const linkedHandoffPath = optionalRuntimeWriterString(request.linked_handoff_path);
  const linkedRuntimeRecordPath = optionalRuntimeWriterString(request.linked_runtime_record_path);
  const linkedProofChecklistPath = optionalRuntimeWriterString(
    request.linked_proof_checklist_path,
  );
  const linkedLiveProofPath = optionalRuntimeWriterString(request.linked_live_proof_path);

  return `# ${candidateName} Runtime Follow-up Record

- Candidate id: \`${candidateId}\`
- Candidate name: \`${candidateName}\`
- Follow-up date: \`${followUpDate}\`
- Current decision state: \`${currentDecisionState}\`
- Origin track: \`${originTrack}\`
- Runtime value to operationalize: ${runtimeValueToOperationalize}
- Proposed host: \`${proposedHost}\`${request.host_selection_mode ? `\n- Host selection mode: \`${request.host_selection_mode}\`` : ""}${request.proposed_host_confidence ? `\n- Proposed host confidence: \`${request.proposed_host_confidence}\`` : ""}
- Proposed integration mode: ${proposedIntegrationMode}
- Source-pack allowlist profile: ${sourcePackAllowlistProfile}
- Allowed export surfaces:
${renderRuntimeWriterList(normalizeRuntimeWriterList(request.allowed_export_surfaces))}
- Excluded baggage:
${renderRuntimeWriterList(normalizeRuntimeWriterList(request.excluded_baggage))}
- Promotion contract path: ${promotionContractPath}
- Re-entry contract path (if deferred): ${reentryContractPath}
- Re-entry preconditions (checklist):
${renderRuntimeWriterList(normalizeRuntimeWriterList(request.reentry_preconditions))}
- Required proof:
${renderRuntimeWriterList(normalizeRuntimeWriterList(request.required_proof))}
- Required gates:
${renderRuntimeWriterList(normalizeRuntimeWriterList(request.required_gates).map((value) =>
    value.startsWith("`") ? value : `\`${value}\``
  ))}
- Trial scope limit (if experimenting):
${renderRuntimeWriterList(normalizeRuntimeWriterList(request.trial_scope_limit))}
- Risks:
${renderRuntimeWriterList(normalizeRuntimeWriterList(request.risks))}
- Rollback: ${rollback}
- No-op path: ${noOpPath}
- Review cadence: ${reviewCadence}
- Current status: \`${currentStatus}\`
${linkedHandoffPath ? `\nLinked handoff:\n- \`${linkedHandoffPath}\`` : ""}
${linkedRuntimeRecordPath ? `\n\nLinked Runtime record:\n- \`${linkedRuntimeRecordPath}\`` : ""}
${linkedProofChecklistPath ? `\n\nLinked proof checklist:\n- \`${linkedProofChecklistPath}\`` : ""}
${linkedLiveProofPath ? `\n\nLinked live proof:\n- \`${linkedLiveProofPath}\`` : ""}
`;
}
