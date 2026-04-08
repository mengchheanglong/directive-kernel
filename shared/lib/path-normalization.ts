import path from "node:path";

export function normalizeAbsolutePath(filePath: string) {
  return path.resolve(filePath).replace(/\\/g, "/");
}

export function normalizeRelativePath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}
