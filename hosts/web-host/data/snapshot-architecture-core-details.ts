import fs from "node:fs";
import path from "node:path";

import { normalizeRelativePath } from "../../../shared/lib/path-normalization.ts";
import {
  readArchitectureBoundedCloseoutAssist,
  readArchitectureResultEvidenceForResult,
  readArchitectureResultEvidenceForStart,
  readArchitectureBoundedResultArtifact,
  readArchitectureBoundedStartArtifact,
} from "../../../architecture/lib/experiments/closeout.ts";
import {
  readArchitectureAdoptionDetail,
} from "../../../architecture/lib/adoption/result-adoption.ts";
import {
  readDirectiveArchitectureImplementationTargetPathForAdoption,
} from "../../../architecture/lib/materialization/implementation-target.ts";
import { resolveDirectiveWorkspaceState } from "../../../engine/state/index.ts";
import { buildDirectiveFrontendCurrentHead } from "./shared.ts";
import type {
  FrontendArchitectureAdoptionDetail,
  FrontendArchitectureResultDetail,
  FrontendArchitectureStartDetail,
} from "./snapshot.ts";

type ArtifactText = {
  relativePath: string;
  absolutePath: string;
  content: string;
};

type SnapshotArchitectureCoreHelpers = {
  readDirectiveFrontendArtifactText: (input: {
    directiveRoot: string;
    relativePath: string;
  }) => ArtifactText;
  extractMarkdownTitle: (markdown: string) => string;
  extractBulletValue: (markdown: string, label: string) => string;
};

function readDirectiveArchitectureAdoptionPathForResult(input: {
  directiveRoot: string;
  resultRelativePath: string;
}) {
  const adoptedRoot = path.join(input.directiveRoot, "architecture", "02-adopted");
  if (!fs.existsSync(adoptedRoot)) {
    return null;
  }

  const fileName = path.basename(input.resultRelativePath);
  const adoptedCandidates = [
    fileName.replace(/-bounded-result\.md$/u, "-adopted-planned-next.md"),
    fileName.replace(/-bounded-result\.md$/u, "-adopted.md"),
  ];

  for (const candidate of adoptedCandidates) {
    const absolute = path.join(adoptedRoot, candidate);
    if (fs.existsSync(absolute)) {
      return normalizeRelativePath(path.join("architecture", "02-adopted", candidate));
    }
  }
  return null;
}

export function readDirectiveFrontendArchitectureStartDetail(
  input: {
    directiveRoot: string;
    relativePath: string;
  },
  helpers: SnapshotArchitectureCoreHelpers,
): FrontendArchitectureStartDetail {
  const relativePath = normalizeRelativePath(String(input.relativePath || "").trim());
  if (!relativePath) {
    return {
      ok: false,
      error: "missing_relative_path",
      relativePath,
    };
  }

  if (
    !relativePath.startsWith("architecture/01-experiments/")
    || !relativePath.endsWith("-bounded-start.md")
  ) {
    return {
      ok: false,
      error: "invalid_start_artifact_path",
      relativePath,
    };
  }

  try {
    const artifact = helpers.readDirectiveFrontendArtifactText({
      directiveRoot: input.directiveRoot,
      relativePath,
    });
    const parsed = readArchitectureBoundedStartArtifact({
      directiveRoot: input.directiveRoot,
      startPath: relativePath,
    });
    const closeoutAssist = readArchitectureBoundedCloseoutAssist({
      directiveRoot: input.directiveRoot,
      startPath: relativePath,
    });
    const resultEvidence = readArchitectureResultEvidenceForStart({
      directiveRoot: input.directiveRoot,
      startPath: relativePath,
    });

    return {
      ok: true,
      relativePath,
      absolutePath: artifact.absolutePath,
      title: helpers.extractMarkdownTitle(artifact.content),
      candidateId: helpers.extractBulletValue(artifact.content, "Candidate id"),
      candidateName: helpers.extractBulletValue(artifact.content, "Candidate name"),
      objective: helpers.extractBulletValue(artifact.content, "Objective"),
      startApproval: helpers.extractBulletValue(artifact.content, "Start approval"),
      resultSummary: helpers.extractBulletValue(artifact.content, "Result summary"),
      handoffStubPath: helpers.extractBulletValue(artifact.content, "Handoff stub"),
      resultRelativePath: parsed.resultExists ? parsed.resultRelativePath : null,
      decisionRelativePath: parsed.decisionExists ? parsed.decisionRelativePath : null,
      closeoutAssist,
      resultEvidence,
      content: artifact.content,
    };
  } catch (error) {
    return {
      ok: false,
      error: String((error as Error).message || error),
      relativePath,
    };
  }
}

export function readDirectiveFrontendArchitectureResultDetail(
  input: {
    directiveRoot: string;
    relativePath: string;
  },
  helpers: SnapshotArchitectureCoreHelpers,
): FrontendArchitectureResultDetail {
  const relativePath = normalizeRelativePath(String(input.relativePath || "").trim());
  if (!relativePath) {
    return {
      ok: false,
      error: "missing_relative_path",
      relativePath,
    };
  }

  if (
    !relativePath.startsWith("architecture/01-experiments/")
    || !relativePath.endsWith("-bounded-result.md")
  ) {
    return {
      ok: false,
      error: "invalid_result_artifact_path",
      relativePath,
    };
  }

  try {
    const artifact = helpers.readDirectiveFrontendArtifactText({
      directiveRoot: input.directiveRoot,
      relativePath,
    });
    const focus = resolveDirectiveWorkspaceState({
      directiveRoot: input.directiveRoot,
      artifactPath: relativePath,
      includeAnchors: false,
    }).focus;
    const parsed = readArchitectureBoundedResultArtifact({
      directiveRoot: input.directiveRoot,
      resultPath: relativePath,
    });
    const resultEvidence = readArchitectureResultEvidenceForResult({
      directiveRoot: input.directiveRoot,
      resultPath: relativePath,
    });

    if (!focus || focus.lane !== "architecture") {
      throw new Error("architecture_bounded_result_focus_not_resolved");
    }

    return {
      ok: true,
      relativePath,
      absolutePath: artifact.absolutePath,
      title: parsed.title,
      candidateId: parsed.candidateId,
      candidateName: parsed.candidateName,
      objective: parsed.objective,
      closeoutApproval: parsed.closeoutApproval,
      resultSummary: parsed.resultSummary,
      nextDecision: parsed.nextDecision,
      verdict: parsed.verdict,
      rationale: parsed.rationale,
      startRelativePath: parsed.startRelativePath,
      handoffStubPath: parsed.handoffStubPath,
      decisionRelativePath: parsed.decisionRelativePath,
      continuationStartRelativePath: parsed.continuationStartExists
        ? parsed.continuationStartRelativePath
        : null,
      adoptionRelativePath: readDirectiveArchitectureAdoptionPathForResult({
        directiveRoot: input.directiveRoot,
        resultRelativePath: relativePath,
      }),
      artifactStage: focus.artifactStage,
      artifactNextLegalStep: focus.artifactNextLegalStep,
      currentStage: focus.currentStage,
      nextLegalStep: focus.nextLegalStep,
      currentHead: buildDirectiveFrontendCurrentHead(focus.currentHead),
      resultEvidence,
      content: artifact.content,
    };
  } catch (error) {
    return {
      ok: false,
      error: String((error as Error).message || error),
      relativePath,
    };
  }
}

export function readDirectiveFrontendArchitectureAdoptionDetail(
  input: {
    directiveRoot: string;
    relativePath: string;
  },
): FrontendArchitectureAdoptionDetail {
  const relativePath = normalizeRelativePath(String(input.relativePath || "").trim());
  if (!relativePath) {
    return {
      ok: false,
      error: "missing_relative_path",
      relativePath,
    };
  }

  if (
    !relativePath.startsWith("architecture/02-adopted/")
    || !relativePath.endsWith(".md")
  ) {
    return {
      ok: false,
      error: "invalid_adoption_artifact_path",
      relativePath,
    };
  }

  try {
    const focus = resolveDirectiveWorkspaceState({
      directiveRoot: input.directiveRoot,
      artifactPath: relativePath,
      includeAnchors: false,
    }).focus;
    const detail = readArchitectureAdoptionDetail({
      directiveRoot: input.directiveRoot,
      adoptionPath: relativePath,
    });

    if (!focus || focus.lane !== "architecture") {
      throw new Error("architecture_adoption_focus_not_resolved");
    }

    return {
      ok: true,
      relativePath,
      absolutePath: detail.adoptedAbsolutePath,
      title: detail.title,
      candidateId: detail.candidateId,
      candidateName: detail.candidateName,
      usefulnessLevel: detail.usefulnessLevel,
      finalStatus: detail.finalStatus,
      sourceResultRelativePath: detail.sourceResultRelativePath,
      decisionRelativePath: detail.decisionRelativePath,
      implementationTargetRelativePath: readDirectiveArchitectureImplementationTargetPathForAdoption({
        directiveRoot: input.directiveRoot,
        adoptionRelativePath: relativePath,
      }),
      artifactStage: focus.artifactStage,
      artifactNextLegalStep: focus.artifactNextLegalStep,
      currentStage: focus.currentStage,
      nextLegalStep: focus.nextLegalStep,
      currentHead: buildDirectiveFrontendCurrentHead(focus.currentHead),
      content: detail.content,
    };
  } catch (error) {
    return {
      ok: false,
      error: String((error as Error).message || error),
      relativePath,
    };
  }
}
