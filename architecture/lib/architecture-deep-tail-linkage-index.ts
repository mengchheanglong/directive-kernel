import fs from "node:fs";
import path from "node:path";

import type { ArchitectureDeepTailStageId } from "./architecture-deep-tail-stage-map.ts";
import { resolveDirectiveWorkspaceArtifactAbsolutePath } from "../../shared/lib/directive-workspace-artifact-storage.ts";

type ArchitectureDeepTailLinkageIndex = {
  version: 1;
  updatedAt: string;
  links: Partial<Record<ArchitectureDeepTailStageId, Record<string, string>>>;
};

const LINKAGE_INDEX_RELATIVE_PATH = "architecture/04-materialization/linkage-index.json";

function createEmptyIndex(): ArchitectureDeepTailLinkageIndex {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    links: {},
  };
}

function resolveLinkageIndexAbsolutePath(directiveRoot: string) {
  return resolveDirectiveWorkspaceArtifactAbsolutePath({
    directiveRoot,
    relativePath: LINKAGE_INDEX_RELATIVE_PATH,
    mode: "write",
  });
}

function readArchitectureDeepTailLinkageIndex(directiveRoot: string) {
  const absolutePath = resolveLinkageIndexAbsolutePath(directiveRoot);
  if (!fs.existsSync(absolutePath)) {
    return createEmptyIndex();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as ArchitectureDeepTailLinkageIndex;
    if (parsed?.version === 1 && parsed.links && typeof parsed.links === "object") {
      return parsed;
    }
  } catch {
    // fall through to empty index
  }

  return createEmptyIndex();
}

function writeArchitectureDeepTailLinkageIndex(
  directiveRoot: string,
  index: ArchitectureDeepTailLinkageIndex,
) {
  const absolutePath = resolveLinkageIndexAbsolutePath(directiveRoot);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

export function lookupArchitectureDeepTailLinkedArtifactPath(input: {
  directiveRoot: string;
  stageId: ArchitectureDeepTailStageId;
  sourceRelativePath: string;
}) {
  const index = readArchitectureDeepTailLinkageIndex(input.directiveRoot);
  return index.links[input.stageId]?.[input.sourceRelativePath] ?? null;
}

export function recordArchitectureDeepTailLinkedArtifactPath(input: {
  directiveRoot: string;
  stageId: ArchitectureDeepTailStageId;
  sourceRelativePath: string;
  targetRelativePath: string;
}) {
  const index = readArchitectureDeepTailLinkageIndex(input.directiveRoot);
  index.links[input.stageId] = {
    ...(index.links[input.stageId] ?? {}),
    [input.sourceRelativePath]: input.targetRelativePath,
  };
  index.updatedAt = new Date().toISOString();
  writeArchitectureDeepTailLinkageIndex(input.directiveRoot, index);
}

