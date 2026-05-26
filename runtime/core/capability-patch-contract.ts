import {
  resolveStatusAfterDecision,
} from "./decision-policy";
import type {
  CapabilityStatus,
  Decision,
  FrameworkStatus,
  IntegrationProof,
  RuntimeStatus,
} from "./contract";
import type {
  AnalysisContract,
} from "./workflow-contract";

export type CapabilityPatch = {
  status?: CapabilityStatus;
  frameworkStatus?: FrameworkStatus;
  runtimeStatus?: RuntimeStatus;
  analysisSummary?: string;
  category?: string | null;
  problemFit?: string | null;
  overlapNotes?: string | null;
  riskNotes?: string | null;
  recommendation?: AnalysisContract["recommendation"];
  metadata?: Record<string, unknown>;
};

export function buildDirectiveAnalysisCapabilityPatch(
  analysis: AnalysisContract,
): CapabilityPatch {
  return {
    status: "analyzed",
    frameworkStatus: "analyzed",
    analysisSummary: analysis.analysisSummary,
    category: analysis.category,
    problemFit: analysis.problemFit,
    overlapNotes: analysis.overlapNotes,
    riskNotes: analysis.riskNotes,
    recommendation: analysis.recommendation,
    metadata: analysis.metadata,
  };
}

export function buildDirectiveExperimentCapabilityPatch(): CapabilityPatch {
  return {
    status: "experimenting",
    frameworkStatus: "experimenting",
  };
}

export function buildDirectiveEvaluationCapabilityPatch(): CapabilityPatch {
  return {
    status: "evaluated",
    frameworkStatus: "evaluated",
  };
}

export function buildDirectiveDecisionCapabilityPatch(input: {
  decision: Decision;
  runtimeStatus: RuntimeStatus;
}): CapabilityPatch {
  return {
    status: resolveStatusAfterDecision(
      input.decision,
      input.runtimeStatus,
    ),
    frameworkStatus: "decided",
    runtimeStatus: input.runtimeStatus,
  };
}

export function buildDirectiveProofMetadata(input: {
  capabilityMetadata: Record<string, unknown>;
  integrationProof: IntegrationProof;
  timestamp: string;
}): Record<string, unknown> {
  return {
    ...input.capabilityMetadata,
    latestIntegrationProof: input.integrationProof,
    latestIntegrationProofAt: input.timestamp,
  };
}
