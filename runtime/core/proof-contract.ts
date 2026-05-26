import { type IntegrationProof } from "./contract";
import { proofTimestampSuffix } from "./presentation-contract";

export type ProofRequestInput = {
  capabilityId: string;
  method?: unknown;
  reference?: unknown;
  summary?: unknown;
  timestamp?: string;
};

export type ProofRequest = {
  timestamp: string;
  method: string;
  reference: string;
  summary: string;
};

export function normalizeDirectiveProofRequest(
  input: ProofRequestInput,
): ProofRequest {
  const timestamp = input.timestamp || new Date().toISOString();
  const method = String(input.method || "").trim() || "dashboard-proof";
  const reference =
    String(input.reference || "").trim() ||
    `directive-workspace:${input.capabilityId}:proof:${proofTimestampSuffix(timestamp)}`;
  const summary =
    String(input.summary || "").trim() ||
    "Proof artifact generated from directive workspace workflow.";

  return {
    timestamp,
    method,
    reference,
    summary,
  };
}

export function buildDirectiveIntegrationProof(input: {
  reportId: string;
  reportHref: string;
  artifactPath: string;
  request: ProofRequest;
}): IntegrationProof {
  return {
    execution: {
      ok: true,
      method: input.request.method,
      reference: input.request.reference,
      timestamp: input.request.timestamp,
    },
    artifact: {
      reportId: input.reportId,
      reportHref: input.reportHref,
      artifactPath: input.artifactPath,
      summary: input.request.summary,
    },
  };
}
