import path from "node:path";

import { requiredString } from "./validation.ts";

export function normalizeDirectiveRelativePath(inputPath: string, fieldName = "path") {
  return requiredString(inputPath, fieldName).replace(/\\/g, "/");
}

export function resolveDirectiveRelativePath(
  directiveRoot: string,
  inputPath: string,
  fieldName = "path",
) {
  const normalizedInput = normalizeDirectiveRelativePath(inputPath, fieldName);
  const root = path.resolve(directiveRoot);
  const absolutePath = path.isAbsolute(normalizedInput)
    ? path.resolve(normalizedInput)
    : path.resolve(root, normalizedInput);
  const normalizedRootPrefix = `${root}${path.sep}`;

  if (absolutePath !== root && !absolutePath.startsWith(normalizedRootPrefix)) {
    throw new Error(`invalid_input: ${fieldName} must stay within directive-workspace`);
  }

  return path.relative(root, absolutePath).replace(/\\/g, "/");
}
