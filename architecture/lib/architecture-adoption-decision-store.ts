import fs from "node:fs";
import path from "node:path";
import { readJson, writeJsonAtomic } from "../../shared/lib/file-io.ts";
import {
  isDirectiveArchitectureAdoptionDecisionArtifact,
  type DirectiveArchitectureAdoptionDecisionArtifact,
} from "./architecture-adoption-artifacts.ts";
import {
  resolveDirectiveArchitectureCloseoutAbsolutePath,
  resolveDirectiveArchitectureCloseoutPathForRecord,
} from "./architecture-closeout.ts";

export type DirectiveArchitectureAdoptionDecisionStoreRecord = {
  recordRelativePath: string;
  decisionRelativePath: string;
  decisionAbsolutePath: string;
  artifact: DirectiveArchitectureAdoptionDecisionArtifact;
};

function normalizeRelativePath(relativePath: string, fieldName: string) {
  if (typeof relativePath !== "string" || relativePath.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return relativePath.trim().replace(/\\/g, "/");
}



function resolveStoredDecisionPaths(input: {
  directiveRoot: string;
  recordRelativePath: string;
  outputRelativePath?: string | null;
}) {
  const recordRelativePath = normalizeRelativePath(
    input.recordRelativePath,
    "recordRelativePath",
  );
  const decisionRelativePath = normalizeRelativePath(
    input.outputRelativePath || resolveDirectiveArchitectureCloseoutPathForRecord(recordRelativePath),
    "outputRelativePath",
  );
  const decisionAbsolutePath = resolveDirectiveArchitectureCloseoutAbsolutePath({
    directiveRoot: input.directiveRoot,
    relativePath: decisionRelativePath,
  });

  return {
    recordRelativePath,
    decisionRelativePath,
    decisionAbsolutePath,
  };
}

export function getDirectiveArchitectureAdoptionDecisionArtifact(input: {
  directiveRoot: string;
  recordRelativePath: string;
  outputRelativePath?: string | null;
}): DirectiveArchitectureAdoptionDecisionStoreRecord | null {
  const resolved = resolveStoredDecisionPaths(input);
  if (!fs.existsSync(resolved.decisionAbsolutePath)) {
    return null;
  }

  const parsed = readJson(resolved.decisionAbsolutePath);
  if (!isDirectiveArchitectureAdoptionDecisionArtifact(parsed)) {
    throw new Error(
      `Invalid architecture adoption decision artifact for record: ${resolved.recordRelativePath}`,
    );
  }

  return {
    ...resolved,
    artifact: parsed,
  };
}

export function loadDirectiveArchitectureAdoptionDecisionArtifact(input: {
  directiveRoot: string;
  recordRelativePath: string;
  outputRelativePath?: string | null;
}): DirectiveArchitectureAdoptionDecisionStoreRecord {
  const loaded = getDirectiveArchitectureAdoptionDecisionArtifact(input);
  if (!loaded) {
    throw new Error(
      `Missing architecture adoption decision artifact for record: ${normalizeRelativePath(
        input.recordRelativePath,
        "recordRelativePath",
      )}`,
    );
  }
  return loaded;
}

export function listDirectiveArchitectureAdoptionDecisionArtifacts(input: {
  directiveRoot: string;
  recordRelativePaths: string[];
}): DirectiveArchitectureAdoptionDecisionStoreRecord[] {
  return input.recordRelativePaths.map((recordRelativePath) =>
    loadDirectiveArchitectureAdoptionDecisionArtifact({
      directiveRoot: input.directiveRoot,
      recordRelativePath,
    }),
  );
}

export function upsertDirectiveArchitectureAdoptionDecisionArtifact(input: {
  directiveRoot: string;
  recordRelativePath: string;
  outputRelativePath?: string | null;
  artifact: DirectiveArchitectureAdoptionDecisionArtifact;
}): DirectiveArchitectureAdoptionDecisionStoreRecord {
  const resolved = resolveStoredDecisionPaths(input);
  writeJsonAtomic(resolved.decisionAbsolutePath, input.artifact);

  return {
    ...resolved,
    artifact: input.artifact,
  };
}

export function deleteDirectiveArchitectureAdoptionDecisionArtifact(input: {
  directiveRoot: string;
  recordRelativePath: string;
  outputRelativePath?: string | null;
}) {
  const resolved = resolveStoredDecisionPaths(input);
  if (!fs.existsSync(resolved.decisionAbsolutePath)) {
    return false;
  }
  fs.unlinkSync(resolved.decisionAbsolutePath);
  return true;
}
