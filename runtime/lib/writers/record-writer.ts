import path from "node:path";
import {
  normalizeRuntimeWriterList,
  renderRuntimeWriterList,
  requireRuntimeWriterString,
} from "./writer-support.ts";

export type RuntimeRecordRequest = {
  candidate_id: string;
  candidate_name: string;
  runtime_record_date: string;
  origin_path: string;
  linked_follow_up_record: string;
  runtime_objective: string;
  proposed_host: string;
  proposed_runtime_surface: string;
  execution_slice: string;
  required_proof: string;
  required_gates?: string[] | null;
  risks?: string[] | null;
  rollback: string;
  current_status: string;
  next_decision_point: string;
  supporting_contracts?: string[] | null;
  output_relative_path?: string | null;
};

export function resolveRuntimeRecordPath(input: {
  candidate_id: string;
  runtime_record_date: string;
  output_relative_path?: string | null;
}) {
  if (input.output_relative_path && input.output_relative_path.trim().length > 0) {
    return input.output_relative_path.trim();
  }
  return path
    .join(
      "runtime",
      "02-records",
      `${input.runtime_record_date}-${input.candidate_id}-runtime-record.md`,
    )
    .replace(/\\/g, "/");
}

export function renderRuntimeRecord(request: RuntimeRecordRequest) {
  const candidateId = requireRuntimeWriterString(request.candidate_id, "candidate_id");
  const candidateName = requireRuntimeWriterString(request.candidate_name, "candidate_name");
  const runtimeRecordDate = requireRuntimeWriterString(
    request.runtime_record_date,
    "runtime_record_date",
  );
  const originPath = requireRuntimeWriterString(request.origin_path, "origin_path");
  const linkedFollowUpRecord = requireRuntimeWriterString(
    request.linked_follow_up_record,
    "linked_follow_up_record",
  );
  const runtimeObjective = requireRuntimeWriterString(
    request.runtime_objective,
    "runtime_objective",
  );
  const proposedHost = requireRuntimeWriterString(request.proposed_host, "proposed_host");
  const proposedRuntimeSurface = requireRuntimeWriterString(
    request.proposed_runtime_surface,
    "proposed_runtime_surface",
  );
  const executionSlice = requireRuntimeWriterString(
    request.execution_slice,
    "execution_slice",
  );
  const requiredProof = requireRuntimeWriterString(request.required_proof, "required_proof");
  const rollback = requireRuntimeWriterString(request.rollback, "rollback");
  const currentStatus = requireRuntimeWriterString(request.current_status, "current_status");
  const nextDecisionPoint = requireRuntimeWriterString(
    request.next_decision_point,
    "next_decision_point",
  );

  return `# Runtime Record: ${candidateName}

- Candidate id: ${candidateId}
- Candidate name: ${candidateName}
- Runtime record date: ${runtimeRecordDate}
- Origin path: \`${originPath}\`
- Linked follow-up record: \`${linkedFollowUpRecord}\`
- Runtime objective: ${runtimeObjective}
- Proposed host: ${proposedHost}
- Proposed runtime surface: ${proposedRuntimeSurface}
- Execution slice: ${executionSlice}
- Required proof: \`${requiredProof}\`
- Required gates:
${renderRuntimeWriterList(normalizeRuntimeWriterList(request.required_gates).map((value) =>
    value.startsWith("`") ? value : `\`${value}\``
  ))}
- Risks:
${renderRuntimeWriterList(normalizeRuntimeWriterList(request.risks))}
- Rollback: ${rollback}
- Current status: ${currentStatus}
- Next decision point: ${nextDecisionPoint}
${
    normalizeRuntimeWriterList(request.supporting_contracts).length > 0
      ? `\nSupporting product contracts:\n${normalizeRuntimeWriterList(request.supporting_contracts)
          .map((value) => `- \`${value}\``)
          .join("\n")}`
      : ""
  }
`;
}
