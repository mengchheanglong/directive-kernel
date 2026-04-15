/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";

import type { DirectiveEngineRunRecord } from "./types.ts";

export type DirectiveEngineStore = {
  writeRun(record: DirectiveEngineRunRecord): void | Promise<void>;
  updateRun(record: DirectiveEngineRunRecord): void | Promise<void>;
  readRun(runId: string): DirectiveEngineRunRecord | null | Promise<DirectiveEngineRunRecord | null>;
  listRuns(): DirectiveEngineRunRecord[] | Promise<DirectiveEngineRunRecord[]>;
};

type FilesystemRunRecordCacheEntry = {
  record: DirectiveEngineRunRecord | null;
  mtimeMs: number;
  size: number;
};

function sanitizeIdSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizeEngineStoreAbsolutePath(filePath: string) {
  return path.resolve(filePath).replace(/\\/g, "/");
}

function resolveDefaultDirectiveEngineRunsRoot() {
  return normalizeEngineStoreAbsolutePath(
    path.join(process.cwd(), "runtime", "standalone-host", "engine-runs"),
  );
}

function listFilesystemRunPaths(engineRunsRoot: string) {
  if (!fs.existsSync(engineRunsRoot)) {
    return [] as string[];
  }

  return fs.readdirSync(engineRunsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(engineRunsRoot, entry.name))
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)));
}

function readFilesystemRunRecord(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as DirectiveEngineRunRecord;
  } catch {
    return null;
  }
}

export function resolveDirectiveEngineStoreRecordPath(input: {
  engineRunsRoot: string;
  record: DirectiveEngineRunRecord;
}) {
  const engineRunsRoot = normalizeEngineStoreAbsolutePath(input.engineRunsRoot);
  const timestamp = input.record.receivedAt.replace(/[:.]/g, "-");
  const candidateSegment =
    sanitizeIdSegment(input.record.candidate.candidateId)
    || sanitizeIdSegment(input.record.runId)
    || "directive-engine-run";
  const runSegment = input.record.runId.slice(0, 8).toLowerCase();
  const baseName = `${timestamp}-${candidateSegment}-${runSegment}`;

  return normalizeEngineStoreAbsolutePath(path.join(engineRunsRoot, `${baseName}.json`));
}

export function createFilesystemDirectiveEngineStore(input: {
  engineRunsRoot?: string;
} = {}): DirectiveEngineStore {
  const engineRunsRoot = normalizeEngineStoreAbsolutePath(
    input.engineRunsRoot || resolveDefaultDirectiveEngineRunsRoot(),
  );
  const recordCache = new Map<string, FilesystemRunRecordCacheEntry>();
  let runPathIndex = new Map<string, string>();

  function readCachedFilesystemRunRecord(filePath: string) {
    try {
      const stat = fs.statSync(filePath);
      const cached = recordCache.get(filePath);
      if (
        cached
        && cached.mtimeMs === stat.mtimeMs
        && cached.size === stat.size
      ) {
        return cached.record;
      }

      const record = readFilesystemRunRecord(filePath);
      recordCache.set(filePath, {
        record,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      });
      return record;
    } catch {
      recordCache.delete(filePath);
      return null;
    }
  }

  function syncCacheForWrittenRecord(filePath: string, record: DirectiveEngineRunRecord) {
    const stat = fs.statSync(filePath);
    recordCache.set(filePath, {
      record,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
    });
    runPathIndex.set(record.runId, filePath);
  }

  function removeMissingPathsFromCache(recordPaths: string[]) {
    const activePaths = new Set(recordPaths);
    for (const cachedPath of recordCache.keys()) {
      if (!activePaths.has(cachedPath)) {
        recordCache.delete(cachedPath);
      }
    }
    for (const [runId, recordPath] of runPathIndex.entries()) {
      if (!activePaths.has(recordPath)) {
        runPathIndex.delete(runId);
      }
    }
  }

  function listRunsFromFilesystemCache() {
    const recordPaths = listFilesystemRunPaths(engineRunsRoot);
    removeMissingPathsFromCache(recordPaths);

    const nextRunPathIndex = new Map<string, string>();
    const records: DirectiveEngineRunRecord[] = [];
    for (const recordPath of recordPaths) {
      const record = readCachedFilesystemRunRecord(recordPath);
      if (!record) {
        continue;
      }
      records.push(record);
      nextRunPathIndex.set(record.runId, recordPath);
    }
    runPathIndex = nextRunPathIndex;
    return records;
  }

  return {
    writeRun(record) {
      const recordPath = resolveDirectiveEngineStoreRecordPath({
        engineRunsRoot,
        record,
      });
      fs.mkdirSync(path.dirname(recordPath), { recursive: true });
      fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
      syncCacheForWrittenRecord(recordPath, record);
    },
    updateRun(record) {
      let existingPath = runPathIndex.get(record.runId) ?? null;
      if (!existingPath) {
        for (const recordPath of listFilesystemRunPaths(engineRunsRoot)) {
          const existingRecord = readCachedFilesystemRunRecord(recordPath);
          if (existingRecord?.runId === record.runId) {
            existingPath = recordPath;
            break;
          }
        }
      }
      const recordPath = existingPath ?? resolveDirectiveEngineStoreRecordPath({
        engineRunsRoot,
        record,
      });
      fs.mkdirSync(path.dirname(recordPath), { recursive: true });
      fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
      syncCacheForWrittenRecord(recordPath, record);
    },
    readRun(runId) {
      const indexedPath = runPathIndex.get(runId);
      if (indexedPath && fs.existsSync(indexedPath)) {
        const indexedRecord = readCachedFilesystemRunRecord(indexedPath);
        if (indexedRecord?.runId === runId) {
          return indexedRecord;
        }
        runPathIndex.delete(runId);
      }

      for (const recordPath of listFilesystemRunPaths(engineRunsRoot)) {
        const record = readCachedFilesystemRunRecord(recordPath);
        if (record?.runId === runId) {
          runPathIndex.set(runId, recordPath);
          return record;
        }
      }
      return null;
    },
    listRuns() {
      return listRunsFromFilesystemCache();
    },
  };
}

export function createMemoryDirectiveEngineStore(
  initialRecords: DirectiveEngineRunRecord[] = [],
): DirectiveEngineStore {
  const records = [...initialRecords];

  return {
    writeRun(record) {
      records.push(record);
    },
    updateRun(record) {
      const index = records.findIndex((entry) => entry.runId === record.runId);
      if (index >= 0) {
        records[index] = record;
        return;
      }
      records.push(record);
    },
    readRun(runId) {
      return records.find((record) => record.runId === runId) ?? null;
    },
    listRuns() {
      return [...records];
    },
  };
}
