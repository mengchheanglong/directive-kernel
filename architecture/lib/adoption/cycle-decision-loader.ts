import type {
  ArchitectureAdoptionDecisionArtifact,
} from "./artifacts.ts";
import {
  listDirectiveArchitectureAdoptionDecisionArtifacts,
} from "./decision-store.ts";
import {
  summarizeDirectiveArchitectureCycleDecisions,
  type ArchitectureCycleDecisionSummary,
} from "./cycle-decision-summary.ts";

export type ArchitectureCycleDecisionRecordLoad = {
  recordRelativePath: string;
  decisionRelativePath: string;
  artifact: ArchitectureAdoptionDecisionArtifact;
};

export type ArchitectureCycleDecisionLoadResult = {
  records: ArchitectureCycleDecisionRecordLoad[];
  summary: ArchitectureCycleDecisionSummary;
};

export function loadDirectiveArchitectureCycleDecisionArtifacts(input: {
  directiveRoot: string;
  recordRelativePaths: string[];
}): ArchitectureCycleDecisionLoadResult {
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
