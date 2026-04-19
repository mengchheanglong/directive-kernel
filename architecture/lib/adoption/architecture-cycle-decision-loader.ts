import type {
  DirectiveArchitectureAdoptionDecisionArtifact,
} from "./architecture-adoption-artifacts.ts";
import {
  listDirectiveArchitectureAdoptionDecisionArtifacts,
} from "./architecture-adoption-decision-store.ts";
import {
  summarizeDirectiveArchitectureCycleDecisions,
  type DirectiveArchitectureCycleDecisionSummary,
} from "./architecture-cycle-decision-summary.ts";

export type DirectiveArchitectureCycleDecisionRecordLoad = {
  recordRelativePath: string;
  decisionRelativePath: string;
  artifact: DirectiveArchitectureAdoptionDecisionArtifact;
};

export type DirectiveArchitectureCycleDecisionLoadResult = {
  records: DirectiveArchitectureCycleDecisionRecordLoad[];
  summary: DirectiveArchitectureCycleDecisionSummary;
};

export function loadDirectiveArchitectureCycleDecisionArtifacts(input: {
  directiveRoot: string;
  recordRelativePaths: string[];
}): DirectiveArchitectureCycleDecisionLoadResult {
  const records = listDirectiveArchitectureAdoptionDecisionArtifacts({
    directiveRoot: input.directiveRoot,
    recordRelativePaths: input.recordRelativePaths,
  }).map((record) => ({
    recordRelativePath: record.recordRelativePath,
    decisionRelativePath: record.decisionRelativePath,
    artifact: record.artifact,
  }));

  return {
    records,
    summary: summarizeDirectiveArchitectureCycleDecisions({
      adoptionArtifacts: records.map((record) => record.artifact),
    }),
  };
}
