import fs from "node:fs";
import path from "node:path";

import {
  ARCHITECTURE_DEEP_TAIL_STAGES,
  resolveArchitectureDeepTailStage,
} from "../../architecture/lib/architecture-deep-tail-stage-map.ts";
import { normalizeAbsolutePath } from "./path-normalization.ts";

function normalizeRelativePath(relativePath: string) {
  return String(relativePath || "").trim().replace(/\\/g, "/");
}

function resolveDirectiveRelativePathWithinRoot(directiveRoot: string, inputPath: string) {
  const normalizedInput = normalizeRelativePath(inputPath);
  if (!normalizedInput) {
    throw new Error("invalid_input: relativePath is required");
  }

  if (path.isAbsolute(normalizedInput)) {
    throw new Error("invalid_input: relativePath must stay relative to directive-workspace");
  }

  const root = path.resolve(directiveRoot);
  const absolutePath = path.resolve(root, normalizedInput);
  const normalizedRootPrefix = `${root}${path.sep}`;
  if (absolutePath !== root && !absolutePath.startsWith(normalizedRootPrefix)) {
    throw new Error("invalid_input: path must stay within directive-workspace");
  }

  return path.relative(root, absolutePath).replace(/\\/g, "/");
}

function resolveArchitectureDeepTailPhysicalRelativePath(relativePath: string) {
  const normalized = normalizeRelativePath(relativePath);
  const stage = resolveArchitectureDeepTailStage(normalized);
  if (!stage) {
    return normalized;
  }

  const suffix = normalized.slice(stage.pathPrefix.length);
  return suffix.length > 0
    ? path.posix.join(stage.storageRelativeDir, suffix)
    : stage.storageRelativeDir;
}

function resolveArchitectureDeepTailPhysicalRelativeDir(relativeDir: string) {
  const normalized = normalizeRelativePath(relativeDir);
  const stage = ARCHITECTURE_DEEP_TAIL_STAGES.find((candidate) => candidate.relativeDir === normalized);
  return stage?.storageRelativeDir ?? normalized;
}

export function resolveDirectiveWorkspaceArtifactAbsolutePath(input: {
  directiveRoot: string;
  relativePath: string;
  mode?: "read" | "write";
}) {
  const relativePath = resolveDirectiveRelativePathWithinRoot(input.directiveRoot, input.relativePath);
  const logicalAbsolutePath = normalizeAbsolutePath(path.join(input.directiveRoot, relativePath));
  const physicalRelativePath = resolveArchitectureDeepTailPhysicalRelativePath(relativePath);

  if (physicalRelativePath === relativePath) {
    return logicalAbsolutePath;
  }

  const physicalAbsolutePath = normalizeAbsolutePath(path.join(input.directiveRoot, physicalRelativePath));
  if (input.mode === "write") {
    return physicalAbsolutePath;
  }

  return fs.existsSync(physicalAbsolutePath) ? physicalAbsolutePath : logicalAbsolutePath;
}

export function resolveDirectiveWorkspaceArtifactDirectoryAbsolutePath(input: {
  directiveRoot: string;
  relativeDir: string;
  mode?: "read" | "write";
}) {
  const relativeDir = resolveDirectiveRelativePathWithinRoot(input.directiveRoot, input.relativeDir);
  const logicalAbsolutePath = normalizeAbsolutePath(path.join(input.directiveRoot, relativeDir));
  const physicalRelativeDir = resolveArchitectureDeepTailPhysicalRelativeDir(relativeDir);

  if (physicalRelativeDir === relativeDir) {
    return logicalAbsolutePath;
  }

  const physicalAbsolutePath = normalizeAbsolutePath(path.join(input.directiveRoot, physicalRelativeDir));
  if (input.mode === "write") {
    return physicalAbsolutePath;
  }

  return fs.existsSync(physicalAbsolutePath) ? physicalAbsolutePath : logicalAbsolutePath;
}

export function listDirectiveWorkspaceArtifactRelativePaths(input: {
  directiveRoot: string;
  relativeDir: string;
  suffix?: string;
}) {
  const relativeDir = resolveDirectiveRelativePathWithinRoot(input.directiveRoot, input.relativeDir);
  const absoluteDir = resolveDirectiveWorkspaceArtifactDirectoryAbsolutePath({
    directiveRoot: input.directiveRoot,
    relativeDir,
    mode: "read",
  });
  if (!fs.existsSync(absoluteDir)) {
    return [] as string[];
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (!input.suffix || entry.name.endsWith(input.suffix)))
    .map((entry) => normalizeRelativePath(path.posix.join(relativeDir, entry.name)))
    .sort((left, right) => right.localeCompare(left));
}

export function resolveDirectiveWorkspaceArtifactStorageRelativePath(relativePath: string) {
  return resolveArchitectureDeepTailPhysicalRelativePath(relativePath);
}
