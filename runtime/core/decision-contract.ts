import {
  normalizeDirectiveDecision,
  normalizeDirectiveIntegrationMode,
  normalizeDirectiveIntegrationStatus,
  type Decision,
  type IntegrationMode,
  type IntegrationProof,
  type IntegrationStatus,
} from "./contract.js";
import {
  normalizeDirectiveAdoptDueAt,
  normalizeDirectiveRequiredGates,
  normalizeDirectiveRollbackPlan,
  requireDirectiveIntegrationProof,
} from "./decision-policy.js";

export type DecisionContractInput = {
  decision: unknown;
  integrationSurface?: unknown;
  targetRuntimeSurface?: unknown;
  integrationMode?: unknown;
  owner?: unknown;
  dueAt?: unknown;
  requiredGates?: unknown;
  integrationStatus?: unknown;
  rollbackPlan?: unknown;
  rollbackNotes?: unknown;
  integrationProof?: unknown;
};

export type AdoptContract = {
  integrationSurface: string;
  targetRuntimeSurface: string;
  integrationMode: IntegrationMode;
  owner: string;
  dueAt: string;
  requiredGates: string[];
  integrationStatus: IntegrationStatus;
  rollbackPlan: string;
  integrationProof: IntegrationProof;
};

export type DecisionContract = {
  decision: Decision;
  adopt: AdoptContract | null;
};

export function normalizeDirectiveDecisionContract(
  input: DecisionContractInput,
): DecisionContract {
  const decision = normalizeDirectiveDecision(input.decision);
  if (decision !== "adopt") {
    return { decision, adopt: null };
  }

  const integrationSurface = String(input.integrationSurface || "").trim();
  if (!integrationSurface) {
    throw new Error(
      "invalid_input: integrationSurface is required when decision=adopt",
    );
  }

  const targetRuntimeSurface = String(
    input.targetRuntimeSurface || integrationSurface,
  ).trim();
  if (!targetRuntimeSurface) {
    throw new Error(
      "invalid_input: targetRuntimeSurface is required when decision=adopt",
    );
  }

  const owner = String(input.owner || "").trim();
  if (!owner) {
    throw new Error("invalid_input: owner is required when decision=adopt");
  }

  return {
    decision,
    adopt: {
      integrationSurface,
      targetRuntimeSurface,
      integrationMode: normalizeDirectiveIntegrationMode(
        input.integrationMode || "adapt",
      ),
      owner,
      dueAt: normalizeDirectiveAdoptDueAt(input.dueAt),
      requiredGates: normalizeDirectiveRequiredGates(input.requiredGates),
      integrationStatus: normalizeDirectiveIntegrationStatus(
        input.integrationStatus || "active",
      ),
      rollbackPlan: normalizeDirectiveRollbackPlan(
        input.rollbackPlan || input.rollbackNotes,
      ),
      integrationProof: requireDirectiveIntegrationProof(input.integrationProof),
    },
  };
}
