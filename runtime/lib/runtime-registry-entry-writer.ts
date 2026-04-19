import path from "node:path";

import {
  RUNTIME_REGISTRY_ACCEPTANCE_GATE_VERSION,
  type RuntimeRegistryAcceptanceGateRequest,
} from "./runtime-registry-acceptance-gate.ts";
import {
  normalizeRuntimeWriterList,
  renderRuntimeWriterList,
  requireRuntimeWriterString,
} from "./writers/runtime-writer-support.ts";

export type RuntimeRegistryEntryRequest = {
  candidate_id: string;
  candidate_name: string;
  registry_date: string;
  linked_promotion_record: string;
  host: string;
  runtime_surface: string;
  runtime_status: string;
  proof_path: string;
  last_validated_by: string;
  last_validation_date: string;
  active_risks?: string[] | null;
  rollback_path: string;
  notes?: string[] | null;
  acceptance_gate?: RuntimeRegistryAcceptanceGateRequest | null;
  output_relative_path?: string | null;
};

export function resolveRuntimeRegistryEntryPath(input: {
  candidate_id: string;
  registry_date: string;
  output_relative_path?: string | null;
}) {
  if (input.output_relative_path && input.output_relative_path.trim().length > 0) {
    return input.output_relative_path.trim();
  }
  return path
    .join(
      "runtime",
      "08-registry",
      `${input.registry_date}-${input.candidate_id}-registry-entry.md`,
    )
    .replace(/\\/g, "/");
}

export function renderRuntimeRegistryEntry(
  request: RuntimeRegistryEntryRequest,
) {
  const candidateId = requireRuntimeWriterString(request.candidate_id, "candidate_id");
  const candidateName = requireRuntimeWriterString(request.candidate_name, "candidate_name");
  const registryDate = requireRuntimeWriterString(request.registry_date, "registry_date");
  const linkedPromotionRecord = requireRuntimeWriterString(
    request.linked_promotion_record,
    "linked_promotion_record",
  );
  const host = requireRuntimeWriterString(request.host, "host");
  const runtimeSurface = requireRuntimeWriterString(
    request.runtime_surface,
    "runtime_surface",
  );
  const runtimeStatus = requireRuntimeWriterString(
    request.runtime_status,
    "runtime_status",
  );
  const proofPath = requireRuntimeWriterString(request.proof_path, "proof_path");
  const lastValidatedBy = requireRuntimeWriterString(
    request.last_validated_by,
    "last_validated_by",
  );
  const lastValidationDate = requireRuntimeWriterString(
    request.last_validation_date,
    "last_validation_date",
  );
  const rollbackPath = requireRuntimeWriterString(
    request.rollback_path,
    "rollback_path",
  );

  const acceptanceGate = request.acceptance_gate;
  const acceptanceGateSection = acceptanceGate
    ? `
## Registry Acceptance Gate

- Gate version: \`${acceptanceGate.gate_version ?? RUNTIME_REGISTRY_ACCEPTANCE_GATE_VERSION}\`
- Acceptance state: \`${acceptanceGate.acceptance_state}\`
- Accepted by: ${acceptanceGate.accepted_by}
- Accepted at: \`${acceptanceGate.accepted_at}\`
- Host callable adapter report: \`${acceptanceGate.host_callable_adapter_report_path}\`
- Callable execution evidence: \`${acceptanceGate.callable_execution_evidence_path ?? "n/a"}\`
- Descriptor-only registry status allowed: \`${acceptanceGate.descriptor_only_registry_status_allowed === true}\`
- Gate notes:
${renderRuntimeWriterList(normalizeRuntimeWriterList(acceptanceGate.notes), { bulletPrefix: "- " })}
`
    : "";

  return `# Registry Entry: ${candidateName}

- Candidate id: ${candidateId}
- Candidate name: ${candidateName}
- Registry date: ${registryDate}
- Linked promotion record: \`${linkedPromotionRecord}\`
- Host: ${host}
- Runtime surface: ${runtimeSurface}
- Runtime status: ${runtimeStatus}
- Proof path: \`${proofPath}\`
- Last validated by: ${lastValidatedBy}
- Last validation date: ${lastValidationDate}
- Active risks:
${renderRuntimeWriterList(normalizeRuntimeWriterList(request.active_risks), { bulletPrefix: "- " })}
- Rollback path: ${rollbackPath}
- Notes:
${renderRuntimeWriterList(normalizeRuntimeWriterList(request.notes), { bulletPrefix: "- " })}
${acceptanceGateSection}
`;
}
