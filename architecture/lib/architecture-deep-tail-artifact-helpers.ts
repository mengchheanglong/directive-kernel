import fs from "node:fs";
import path from "node:path";

import {
  readJson,
  writeJson,
  writeUtf8,
} from "../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import {
  normalizeDirectiveRelativePath,
  resolveDirectiveRelativePath,
} from "../../shared/lib/directive-relative-path.ts";
import {
  requiredString,
  optionalString,
} from "../../shared/lib/validation.ts";
import {
  getDefaultDirectiveWorkspaceRoot,
  resolveDirectiveWorkspaceRoot,
} from "../../shared/lib/workspace-root.ts";
import {
  ARCHITECTURE_DEEP_TAIL_STAGE,
  matchesArchitectureDeepTailStagePath,
  type ArchitectureDeepTailStageDefinition,
  type ArchitectureDeepTailStageId,
} from "./architecture-deep-tail-stage-map.ts";
import { recordArchitectureDeepTailLinkedArtifactPath } from "./architecture-deep-tail-linkage-index.ts";
import { resolveDirectiveWorkspaceArtifactAbsolutePath } from "../../shared/lib/directive-workspace-artifact-storage.ts";

export { readJson };
export { normalizeAbsolutePath as normalizePath };
export { requiredString, optionalString };
export { getDefaultDirectiveWorkspaceRoot, resolveDirectiveWorkspaceRoot };
export { normalizeDirectiveRelativePath as normalizeRelativePath, resolveDirectiveRelativePath };

export function resolveArchitectureDeepTailRelativePath(input: {
  sourceRelativePath: string;
  expectedSourceSuffix: string;
  targetStage: ArchitectureDeepTailStageId;
  inputFieldName: string;
  targetSuffix?: string;
}) {
  const fileName = path.posix.basename(input.sourceRelativePath);
  if (!fileName.endsWith(input.expectedSourceSuffix)) {
    throw new Error(`invalid_input: ${input.inputFieldName} must point to an ${input.expectedSourceSuffix.replace(/^-/, "").replace(/\.md$/, "")} artifact`);
  }

  const targetSuffix = input.targetSuffix || ARCHITECTURE_DEEP_TAIL_STAGE[input.targetStage].artifactSuffix;

  return path.posix.join(
    ARCHITECTURE_DEEP_TAIL_STAGE[input.targetStage].relativeDir,
    fileName.replace(new RegExp(`${escapeRegExp(input.expectedSourceSuffix)}$`, "u"), targetSuffix),
  );
}

export function readDirectiveArchitectureDeepTailArtifact(input: {
  directiveRoot: string;
  artifactPath: string;
  stage: ArchitectureDeepTailStageDefinition;
  fieldName: string;
}) {
  const relativePath = resolveDirectiveRelativePath(input.directiveRoot, input.artifactPath, input.fieldName);
  if (!matchesArchitectureDeepTailStagePath(input.stage, relativePath)) {
    throw new Error(
      `invalid_input: ${input.fieldName} must point to ${input.stage.pathPrefix} or ${input.stage.storagePathPrefix}`,
    );
  }

  const absolutePath = resolveDirectiveWorkspaceArtifactAbsolutePath({
    directiveRoot: input.directiveRoot,
    relativePath,
    mode: "read",
  });
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: ${input.fieldName} not found: ${relativePath}`);
  }

  return {
    relativePath,
    absolutePath,
    content: fs.readFileSync(absolutePath, "utf8"),
  };
}

export function readDirectiveArchitectureDeepTailDetailArtifact(input: {
  directiveRoot?: string;
  artifactPath: string;
  stage: ArchitectureDeepTailStageDefinition;
  fieldName: string;
}) {
  const directiveRoot = resolveDirectiveWorkspaceRoot(input.directiveRoot);
  const artifact = readDirectiveArchitectureDeepTailArtifact({
    directiveRoot,
    artifactPath: input.artifactPath,
    stage: input.stage,
    fieldName: input.fieldName,
  });

  return {
    directiveRoot,
    relativePath: artifact.relativePath,
    absolutePath: artifact.absolutePath,
    content: artifact.content,
  };
}

export function prepareDirectiveArchitectureDeepTailWrite(input: {
  directiveRoot?: string;
  sourcePath: string;
  sourceFieldName: string;
  resolveTargetRelativePath: (sourceRelativePath: string) => string;
  actor?: string | null;
  defaultActor?: string;
}) {
  const directiveRoot = resolveDirectiveWorkspaceRoot(input.directiveRoot);
  const sourceRelativePath = resolveDirectiveRelativePath(
    directiveRoot,
    input.sourcePath,
    input.sourceFieldName,
  );
  const targetRelativePath = input.resolveTargetRelativePath(sourceRelativePath);
  const targetAbsolutePath = resolveDirectiveWorkspaceArtifactAbsolutePath({
    directiveRoot,
    relativePath: targetRelativePath,
    mode: "write",
  });
  const created = !fs.existsSync(targetAbsolutePath);
  const snapshotAt = new Date().toISOString();
  const actor = String(input.actor || input.defaultActor || "directive-frontend-operator").trim()
    || "directive-frontend-operator";

  return {
    directiveRoot,
    sourceRelativePath,
    targetRelativePath,
    targetAbsolutePath,
    created,
    snapshotAt,
    actor,
  };
}

export function writeDirectiveArtifactMarkdown(absolutePath: string, markdown: string) {
  writeUtf8(absolutePath, markdown);
}

export { writeJson as writeJsonPretty };

export function writeDirectiveArchitectureDeepTailArtifact(input: {
  directiveRoot: string;
  stageId: ArchitectureDeepTailStageId;
  sourceRelativePath: string;
  targetRelativePath: string;
  targetAbsolutePath: string;
  markdown: string;
}) {
  writeDirectiveArtifactMarkdown(input.targetAbsolutePath, input.markdown);
  recordArchitectureDeepTailLinkedArtifactPath({
    directiveRoot: input.directiveRoot,
    stageId: input.stageId,
    sourceRelativePath: input.sourceRelativePath,
    targetRelativePath: input.targetRelativePath,
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
