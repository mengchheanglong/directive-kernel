import path from "node:path";
import type { DiscoveryHostStorageBridge } from "./discovery-submission-adapter.template.ts";

type JsonValue = Record<string, unknown>;

type CreateMemoryDiscoveryHostStorageBridgeOptions = {
  directiveRoot?: string;
  unresolvedGapIds?: string[];
  receivedAt?: string;
  initialQueue?: JsonValue;
};

type MemoryDiscoveryHostStorageBridgeHarness = {
  bridge: DiscoveryHostStorageBridge;
  readQueue(): JsonValue;
  readText(relativePath: string): string | null;
  listTextArtifactPaths(): string[];
  listJsonArtifactPaths(): string[];
};

function normalizeFilePath(filePath: string) {
  return path.resolve(filePath).replace(/\\/g, "/");
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createMemoryDiscoveryHostStorageBridge(
  options: CreateMemoryDiscoveryHostStorageBridgeOptions = {},
): MemoryDiscoveryHostStorageBridgeHarness {
  const directiveRoot = normalizeFilePath(
    options.directiveRoot ?? "C:/example/directive-workspace",
  );
  const queuePath = normalizeFilePath(
    path.resolve(directiveRoot, "discovery", "intake-queue.json"),
  );
  let queue = cloneJson(
    options.initialQueue ?? {
      status: "primary",
      updatedAt: options.receivedAt ?? "1970-01-01",
      entries: [],
    },
  );
  const jsonArtifacts = new Map<string, JsonValue>();
  const textArtifacts = new Map<string, string>();
  jsonArtifacts.set(queuePath, cloneJson(queue));

  const bridge: DiscoveryHostStorageBridge = {
    directiveRoot,
    readJson<T>(filePath: string) {
      const normalizedPath = normalizeFilePath(filePath);
      if (!jsonArtifacts.has(normalizedPath)) {
        throw new Error(`No JSON artifact registered for ${normalizedPath}`);
      }
      return cloneJson(jsonArtifacts.get(normalizedPath)) as T;
    },
    async writeJson(filePath: string, value: unknown) {
      const normalizedPath = normalizeFilePath(filePath);
      const jsonValue = cloneJson(value) as JsonValue;
      jsonArtifacts.set(normalizedPath, jsonValue);
      if (normalizedPath === queuePath) {
        queue = cloneJson(jsonValue);
      }
    },
    async writeText(filePath: string, content: string) {
      textArtifacts.set(normalizeFilePath(filePath), content);
    },
    resolveWithinDirectiveRoot(relativePath: string) {
      return normalizeFilePath(path.resolve(directiveRoot, relativePath));
    },
    listUnresolvedGapIds() {
      return [...(options.unresolvedGapIds ?? [])];
    },
    receivedAt: options.receivedAt,
  };

  return {
    bridge,
    readQueue() {
      return cloneJson(queue);
    },
    readText(relativePath: string) {
      return (
        textArtifacts.get(
          normalizeFilePath(path.resolve(directiveRoot, relativePath)),
        ) ?? null
      );
    },
    listTextArtifactPaths() {
      return [...textArtifacts.keys()].sort();
    },
    listJsonArtifactPaths() {
      return [...jsonArtifacts.keys()].sort();
    },
  };
}
