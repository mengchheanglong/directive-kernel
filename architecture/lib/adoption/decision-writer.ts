import {
  buildDirectiveArchitectureCloseoutFile,
  renderDirectiveArchitectureCloseoutFile,
  resolveDirectiveArchitectureCloseoutAbsolutePath,
  resolveDirectiveArchitectureCloseoutPath,
  type ArchitectureCloseoutWriteRequest,
} from "../experiments/closeout-writer.ts";
import type {
  ArchitectureAdoptionDecisionArtifact,
} from "./artifacts.ts";
import type {
  ArchitectureAdoptionResolution,
} from "./resolution.ts";
import type {
  ArchitectureReviewResolution,
} from "./review-resolution.ts";

export type ArchitectureAdoptionDecisionWriteRequest =
  Omit<ArchitectureCloseoutWriteRequest, "recordRelativePath"> & {
    adoptedRecordRelativePath: string;
  };

export function resolveDirectiveArchitectureAdoptionDecisionPath(
  request: ArchitectureAdoptionDecisionWriteRequest,
) {
  return resolveDirectiveArchitectureCloseoutPath({
    ...request,
    recordRelativePath: request.adoptedRecordRelativePath,
  });
}

export function resolveDirectiveArchitectureAdoptionDecisionAbsolutePath(input: {
  directiveRoot: string;
  relativePath: string;
}) {
  return resolveDirectiveArchitectureCloseoutAbsolutePath(input);
}

export function buildDirectiveArchitectureAdoptionDecisionFile(
  request: ArchitectureAdoptionDecisionWriteRequest,
): {
  relativePath: string;
  reviewResolution: ArchitectureReviewResolution | null;
  adoptionResolution: ArchitectureAdoptionResolution;
  artifact: ArchitectureAdoptionDecisionArtifact;
} {
  const closeout = buildDirectiveArchitectureCloseoutFile({
    ...request,
    recordRelativePath: request.adoptedRecordRelativePath,
  });
  return {
    relativePath: closeout.relativePath,
    reviewResolution: closeout.reviewResolution,
    adoptionResolution: closeout.adoptionResolution,
    artifact: closeout.artifact,
  };
}

export function renderDirectiveArchitectureAdoptionDecisionFile(
  request: ArchitectureAdoptionDecisionWriteRequest,
) {
  return renderDirectiveArchitectureCloseoutFile({
    ...request,
    recordRelativePath: request.adoptedRecordRelativePath,
  });
}
