/// <reference types="node" />

import fs from "node:fs";
import { resolveDirectiveWorkspaceArtifactAbsolutePath } from "./state/artifact-storage.ts";

export type ArtifactLinkValidationState = {
  missingExpectedArtifacts: string[];
  inconsistentLinks: string[];
};

const WORKSPACE_ARTIFACT_REFERENCE_PATTERN =
  /^(architecture|discovery|engine|frontend|ui|hosts|runtime|scripts|shared|sources)\//u;

function normalizeRelativeArtifactPath(relativePath: string | null | undefined) {
  if (typeof relativePath !== "string") {
    return null;
  }
  const normalized = relativePath.trim().replace(/\\/g, "/");
  return normalized || null;
}

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
  const normalized = normalizeRelativeArtifactPath(relativePath);
  if (!normalized) {
    return false;
  }
  return WORKSPACE_ARTIFACT_REFERENCE_PATTERN.test(normalized);
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
  state: ArtifactLinkValidationState,
  relativePath: string | null | undefined,
) {
  if (!relativePath) {
    return;
  }
  pushUnique(state.missingExpectedArtifacts, relativePath);
}

export function recordInconsistentLink(
  state: ArtifactLinkValidationState,
  message: string | null | undefined,
) {
  if (!message) {
    return;
  }
  pushUnique(state.inconsistentLinks, message);
}

export function recordMissingLinkedArtifactIfAbsent(input: {
  directiveRoot: string;
  state: ArtifactLinkValidationState;
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
  state: ArtifactLinkValidationState;
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
