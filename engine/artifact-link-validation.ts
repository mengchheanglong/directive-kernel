/// <reference types="node" />

import fs from "node:fs";
import { resolveDirectiveWorkspaceArtifactAbsolutePath } from "../shared/lib/directive-workspace-artifact-storage.ts";

export type DirectiveArtifactLinkValidationState = {
  missingExpectedArtifacts: string[];
  inconsistentLinks: string[];
};

const DIRECTIVE_WORKSPACE_ARTIFACT_REFERENCE_PATTERN =
  /^(architecture|discovery|engine|frontend|hosts|runtime|scripts|shared|sources)\//u;

function pushUnique(target: string[], value: string) {
  if (value && !target.includes(value)) {
    target.push(value);
  }
}

export function fileExistsInDirectiveWorkspace(
  directiveRoot: string,
  relativePath: string | null | undefined,
) {
  if (!relativePath) {
    return false;
  }
  return fs.existsSync(resolveDirectiveWorkspaceArtifactAbsolutePath({
    directiveRoot,
    relativePath,
    mode: "read",
  }));
}

export function isDirectiveWorkspaceArtifactReference(relativePath: string | null | undefined) {
  if (typeof relativePath !== "string") {
    return false;
  }
  const normalized = relativePath.trim().replace(/\\/g, "/");
  if (!normalized) {
    return false;
  }
  return DIRECTIVE_WORKSPACE_ARTIFACT_REFERENCE_PATTERN.test(normalized);
}

export function readLinkedArtifactIfPresent<T>(input: {
  directiveRoot: string;
  relativePath: string | null | undefined;
  read: (relativePath: string) => T;
}) {
  if (!input.relativePath || !fileExistsInDirectiveWorkspace(input.directiveRoot, input.relativePath)) {
    return null;
  }
  return input.read(input.relativePath);
}

export function recordMissingExpectedArtifact(
  state: DirectiveArtifactLinkValidationState,
  relativePath: string | null | undefined,
) {
  if (!relativePath) {
    return;
  }
  pushUnique(state.missingExpectedArtifacts, relativePath);
}

export function recordInconsistentLink(
  state: DirectiveArtifactLinkValidationState,
  message: string | null | undefined,
) {
  if (!message) {
    return;
  }
  pushUnique(state.inconsistentLinks, message);
}

export function recordMissingLinkedArtifactIfAbsent(input: {
  directiveRoot: string;
  state: DirectiveArtifactLinkValidationState;
  relativePath: string | null | undefined;
  label: string;
}) {
  if (!input.relativePath) {
    return;
  }
  if (!fileExistsInDirectiveWorkspace(input.directiveRoot, input.relativePath)) {
    recordInconsistentLink(input.state, `missing linked ${input.label}: ${input.relativePath}`);
  }
}

export function recordExpectedArtifactIfMissing(input: {
  directiveRoot: string;
  state: DirectiveArtifactLinkValidationState;
  relativePath: string | null | undefined;
}) {
  if (!input.relativePath) {
    return;
  }
  if (!isDirectiveWorkspaceArtifactReference(input.relativePath)) {
    return;
  }
  if (!fileExistsInDirectiveWorkspace(input.directiveRoot, input.relativePath)) {
    recordMissingExpectedArtifact(input.state, input.relativePath);
  }
}
