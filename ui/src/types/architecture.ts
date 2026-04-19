import type { FrontendCurrentHead } from "./shared.ts";

export type FrontendArchitectureStartDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  objective?: string;
  startApproval?: string;
  resultSummary?: string;
  handoffStubPath?: string;
  resultRelativePath?: string | null;
  decisionRelativePath?: string | null;
  closeoutAssist?: {
    missionFitSummary: string;
    primaryAdoptionQuestion: string;
    extractedValue: string[];
    excludedBaggage: string[];
    directiveOwnedForm: string;
    adaptedValue: string[];
    improvementGoals: string[];
    intendedDelta: string;
    structuralStages: string[];
    stagePreservationExpectation: "preserve_explicit_stages" | "not_applicable";
    stagePreservationSummary: string;
    decisionGuidance: string;
    readinessGuidance: string[];
    suggestedResultSummary: string;
  };
  resultEvidence?: {
    availability: "direct_evidence" | "artifact_only" | "not_available";
    primaryKind: "code_path" | "artifact_path" | "none";
    primaryPath: string | null;
    primaryLabel: string;
    summary: string;
    supportingEvidence: Array<{
      kind: "bounded_result" | "closeout_decision" | "engine_run_record";
      path: string;
      label: string;
    }>;
  };
  content?: string;
};

export type FrontendArchitectureResultDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  objective?: string;
  closeoutApproval?: string;
  resultSummary?: string;
  nextDecision?: string;
  verdict?: string;
  rationale?: string;
  startRelativePath?: string;
  handoffStubPath?: string;
  decisionRelativePath?: string;
  continuationStartRelativePath?: string | null;
  adoptionRelativePath?: string | null;
  resultEvidence?: {
    availability: "direct_evidence" | "artifact_only" | "not_available";
    primaryKind: "code_path" | "artifact_path" | "none";
    primaryPath: string | null;
    primaryLabel: string;
    summary: string;
    supportingEvidence: Array<{
      kind: "bounded_result" | "closeout_decision" | "engine_run_record";
      path: string;
      label: string;
    }>;
  };
  content?: string;
};

export type FrontendArchitectureAdoptionDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  finalStatus?: string;
  sourceResultRelativePath?: string;
  decisionRelativePath?: string;
  implementationTargetRelativePath?: string | null;
  content?: string;
};

export type FrontendArchitectureImplementationTargetDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  title?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  artifactType?: string;
  finalStatus?: string;
  objective?: string;
  expectedOutcome?: string;
  adoptionRelativePath?: string;
  decisionRelativePath?: string;
  sourceResultRelativePath?: string;
  implementationResultRelativePath?: string | null;
  content?: string;
};

export type FrontendArchitectureImplementationResultDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  objective?: string;
  outcome?: "success" | "failure";
  resultSummary?: string;
  validationResult?: string;
  rollbackNote?: string;
  targetRelativePath?: string;
  adoptionRelativePath?: string;
  sourceResultRelativePath?: string;
  retainedRelativePath?: string | null;
  content?: string;
};

export type FrontendArchitectureRetentionDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  objective?: string;
  stabilityLevel?: string;
  reuseScope?: string;
  confirmationDecision?: string;
  rollbackBoundary?: string;
  resultRelativePath?: string;
  targetRelativePath?: string;
  adoptionRelativePath?: string;
  sourceResultRelativePath?: string;
  integrationRecordRelativePath?: string | null;
  content?: string;
};

export type FrontendArchitectureIntegrationRecordDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  objective?: string;
  integrationTargetSurface?: string;
  readinessSummary?: string;
  expectedEffect?: string;
  validationBoundary?: string;
  integrationDecision?: string;
  rollbackBoundary?: string;
  retainedRelativePath?: string;
  resultRelativePath?: string;
  targetRelativePath?: string;
  adoptionRelativePath?: string;
  sourceResultRelativePath?: string;
  consumptionRelativePath?: string | null;
  content?: string;
};

export type FrontendArchitectureConsumptionRecordDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  objective?: string;
  appliedSurface?: string;
  applicationSummary?: string;
  observedEffect?: string;
  validationResult?: string;
  outcome?: "success" | "failure";
  rollbackNote?: string;
  integrationRelativePath?: string;
  retainedRelativePath?: string;
  resultRelativePath?: string;
  targetRelativePath?: string;
  adoptionRelativePath?: string;
  sourceResultRelativePath?: string;
  evaluationRelativePath?: string | null;
  content?: string;
};

export type FrontendArchitecturePostConsumptionEvaluationDetail = {
  ok: boolean;
  error?: string;
  relativePath?: string;
  absolutePath?: string;
  candidateId?: string;
  candidateName?: string;
  usefulnessLevel?: string;
  objective?: string;
  decision?: "keep" | "reopen";
  rationale?: string;
  observedStability?: string;
  retainedUsefulnessAssessment?: string;
  nextBoundedAction?: string;
  rollbackNote?: string;
  reopenedStartRelativePath?: string | null;
  consumptionRelativePath?: string;
  integrationRelativePath?: string;
  retainedRelativePath?: string;
  resultRelativePath?: string;
  targetRelativePath?: string;
  adoptionRelativePath?: string;
  sourceResultRelativePath?: string;
  content?: string;
};

export type FrontendArchitectureSummaryCase = {
  candidate_id: string;
  candidate_name: string;
  current_case_stage: string | null;
  current_case_next_legal_step: string | null;
  current_head: FrontendCurrentHead | null;
};
