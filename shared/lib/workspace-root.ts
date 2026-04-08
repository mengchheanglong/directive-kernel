import { fileURLToPath } from "node:url";
import { normalizeAbsolutePath } from "./path-normalization.ts";

export function getDefaultDirectiveWorkspaceRoot() {
  return normalizeAbsolutePath(fileURLToPath(new URL("../..", import.meta.url)));
}

export function resolveDirectiveWorkspaceRoot(directiveRoot?: string) {
  return normalizeAbsolutePath(directiveRoot || getDefaultDirectiveWorkspaceRoot());
}
