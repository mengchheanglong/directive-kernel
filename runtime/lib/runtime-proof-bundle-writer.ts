import path from "node:path";
import {
  normalizeRuntimeWriterList,
  renderRuntimeWriterList,
  requireRuntimeWriterString,
} from "./runtime-writer-support.ts";

export type RuntimeProofBundleRequest = {
  candidate_id: string;
  candidate_name: string;
  proof_date: string;
  linked_runtime_record: string;
  required_proof_items?: string[] | null;
  validation_commands?: string[] | null;
  source_proof_artifacts?: string[] | null;
  gate_snapshot: Record<string, unknown>;
  pass_fail_summary: string;
  rollback_verification: string;
  status: string;
  output_relative_path?: string | null;
  gate_snapshot_relative_path?: string | null;
};

export function resolveRuntimeProofChecklistPath(input: {
  candidate_id: string;
  proof_date: string;
  output_relative_path?: string | null;
}) {
  if (input.output_relative_path && input.output_relative_path.trim().length > 0) {
    return input.output_relative_path.trim();
  }
  return path
    .join(
      "runtime",
      "03-proof",
      `${input.proof_date}-${input.candidate_id}-proof-checklist.md`,
    )
    .replace(/\\/g, "/");
}

export function resolveRuntimeProofGateSnapshotPath(input: {
  candidate_id: string;
  proof_date: string;
  gate_snapshot_relative_path?: string | null;
}) {
  if (
    input.gate_snapshot_relative_path
    && input.gate_snapshot_relative_path.trim().length > 0
  ) {
    return input.gate_snapshot_relative_path.trim();
  }
  return path
    .join(
      "runtime",
      "03-proof",
      `${input.proof_date}-${input.candidate_id}-gate-snapshot.json`,
    )
    .replace(/\\/g, "/");
}

export function renderRuntimeProofChecklist(input: {
  request: RuntimeProofBundleRequest;
  gateSnapshotPath: string;
}) {
  const candidateId = requireRuntimeWriterString(input.request.candidate_id, "candidate_id");
  const candidateName = requireRuntimeWriterString(input.request.candidate_name, "candidate_name");
  const proofDate = requireRuntimeWriterString(input.request.proof_date, "proof_date");
  const linkedRuntimeRecord = requireRuntimeWriterString(
    input.request.linked_runtime_record,
    "linked_runtime_record",
  );
  const passFailSummary = requireRuntimeWriterString(
    input.request.pass_fail_summary,
    "pass_fail_summary",
  );
  const rollbackVerification = requireRuntimeWriterString(
    input.request.rollback_verification,
    "rollback_verification",
  );
  const status = requireRuntimeWriterString(input.request.status, "status");

  return `# Proof Checklist Artifact: ${candidateName}

- Artifact type: \`ProofChecklistArtifact\`
- Candidate id: ${candidateId}
- Candidate name: ${candidateName}
- Capability id: ${candidateId}
- Capability name: ${candidateName}
- Generated at: ${proofDate}
- Linked Runtime record: \`${linkedRuntimeRecord}\`
- Required proof items:
${renderRuntimeWriterList(normalizeRuntimeWriterList(input.request.required_proof_items))}
- Validation commands:
${renderRuntimeWriterList(normalizeRuntimeWriterList(input.request.validation_commands).map((value) =>
    value.startsWith("`") ? value : `\`${value}\``
  ))}
- Source proof artifacts:
${renderRuntimeWriterList(normalizeRuntimeWriterList(input.request.source_proof_artifacts).map((value) =>
    value.startsWith("`") ? value : `\`${value}\``
  ))}
- Gate snapshot: \`${input.gateSnapshotPath}\`
- Pass/fail summary: ${passFailSummary}
- Rollback verification: ${rollbackVerification}
- Status: ${status}
`;
}
