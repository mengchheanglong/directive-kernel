import fs from "node:fs";
import path from "node:path";
import type { DiscoveryHostStorageBridge } from "./discovery-submission-adapter.template.ts";

type JsonValue = Record<string, unknown>;

type CreateFilesystemDiscoveryHostStorageBridgeOptions = {
  directiveRoot: string;
  unresolvedGapIds?: string[];
  receivedAt?: string;
  initialQueue?: JsonValue;
};

type FilesystemDiscoveryHostStorageBridgeHarness = {
  bridge: DiscoveryHostStorageBridge;
  directiveRoot: string;
  readQueue(): JsonValue;
  readText(relativePath: string): string | null;
  listTextArtifactPaths(): string[];
  listJsonArtifactPaths(): string[];
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeAbsolutePath(filePath: string) {
  return path.resolve(filePath).replace(/\\/g, "/");
}

function ensureDirectory(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function createDefaultQueue(receivedAt?: string): JsonValue {
  return {
    status: "primary",
    updatedAt: receivedAt ?? "1970-01-01",
    entries: [],
  };
}

export function createFilesystemDiscoveryHostStorageBridge(
  options: CreateFilesystemDiscoveryHostStorageBridgeOptions,
): FilesystemDiscoveryHostStorageBridgeHarness {
  const directiveRoot = normalizeAbsolutePath(options.directiveRoot);
  const queuePath = normalizeAbsolutePath(
    path.resolve(directiveRoot, "discovery", "intake-queue.json"),
  );

  const writtenTextArtifacts = new Set<string>();
  const writtenJsonArtifacts = new Set<string>();

  ensureDirectory(queuePath);
  if (!fs.existsSync(queuePath)) {
    fs.writeFileSync(
      queuePath,
      `${JSON.stringify(options.initialQueue ?? createDefaultQueue(options.receivedAt), null, 2)}\n`,
      "utf8",
    );
  }
  writtenJsonArtifacts.add(queuePath);

  const bridge: DiscoveryHostStorageBridge = {
    directiveRoot,
    readJson<T>(filePath: string) {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
    },
    writeJson(filePath: string, value: unknown) {
      ensureDirectory(filePath);
      fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      writtenJsonArtifacts.add(normalizeAbsolutePath(filePath));
    },
    writeText(filePath: string, content: string) {
      ensureDirectory(filePath);
      fs.writeFileSync(filePath, content, "utf8");
      writtenTextArtifacts.add(normalizeAbsolutePath(filePath));
    },
    resolveWithinDirectiveRoot(relativePath: string) {
      return normalizeAbsolutePath(path.resolve(directiveRoot, relativePath));
    },
    listUnresolvedGapIds() {
      return [...(options.unresolvedGapIds ?? [])];
    },
    receivedAt: options.receivedAt,
  };

  return {
    bridge,
    directiveRoot,
    readQueue() {
      return cloneJson(JSON.parse(fs.readFileSync(queuePath, "utf8")) as JsonValue);
    },
    readText(relativePath: string) {
      const absolutePath = normalizeAbsolutePath(
        path.resolve(directiveRoot, relativePath),
      );
      if (!fs.existsSync(absolutePath)) {
        return null;
      }
      return fs.readFileSync(absolutePath, "utf8");
    },
    listTextArtifactPaths() {
      return [...writtenTextArtifacts].sort();
    },
    listJsonArtifactPaths() {
      return [...writtenJsonArtifacts].sort();
    },
  };
}
