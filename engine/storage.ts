/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";

import type { EngineRunRecord } from "./types.ts";
import { DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION } from "./types.ts";
import { applyRunRecordMigrationChain } from "../shared/schemas/migrations/index.ts";

export type EngineStore = {
  writeRun(record: EngineRunRecord): void | Promise<void>;
  updateRun(record: EngineRunRecord): void | Promise<void>;
  readRun(runId: string): EngineRunRecord | null | Promise<EngineRunRecord | null>;
  listRuns(): EngineRunRecord[] | Promise<EngineRunRecord[]>;
};

type FilesystemRunRecordCacheEntry = {
  record: EngineRunRecord | null;
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

function resolveDefaultEngineRunsRoot() {
  return normalizeEngineStoreAbsolutePath(
    path.join(process.cwd(), "runtime", "host-artifacts", "engine-runs"),
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
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as EngineRunRecord;
  } catch {
    return null;
  }
}

function readThroughVersionCheck(record: unknown): EngineRunRecord {
  if (record === null || typeof record !== "object") {
    throw new Error("schema_version_unreadable: record is not an object");
  }
  const version = (record as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new Error(
      `schema_version_unreadable: schemaVersion is missing or non-integer (got ${typeof version})`,
    );
  }
  const current = DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION;
  if (version === current) return record as EngineRunRecord;
  if (version > current) {
    throw new Error(
      `schema_version_future: record is v${version}, kernel supports up to v${current}`,
    );
  }
  return applyRunRecordMigrationChain(record, version, current) as EngineRunRecord;
}

export function resolveEngineStoreRecordPath(input: {
  engineRunsRoot: string;
  record: EngineRunRecord;
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

export function createFilesystemEngineStore(input: {
  engineRunsRoot?: string;
} = {}): EngineStore {
  const engineRunsRoot = normalizeEngineStoreAbsolutePath(
    input.engineRunsRoot || resolveDefaultEngineRunsRoot(),
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

  function syncCacheForWrittenRecord(filePath: string, record: EngineRunRecord) {
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
    const records: EngineRunRecord[] = [];
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
      const recordPath = resolveEngineStoreRecordPath({
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
      const recordPath = existingPath ?? resolveEngineStoreRecordPath({
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
          return readThroughVersionCheck(indexedRecord);
        }
        runPathIndex.delete(runId);
      }

      for (const recordPath of listFilesystemRunPaths(engineRunsRoot)) {
        const record = readCachedFilesystemRunRecord(recordPath);
        if (record?.runId === runId) {
          runPathIndex.set(runId, recordPath);
          return readThroughVersionCheck(record);
        }
      }
      return null;
    },
    listRuns() {
      return listRunsFromFilesystemCache().map(readThroughVersionCheck);
    },
  };
}

export function createMemoryEngineStore(
  initialRecords: EngineRunRecord[] = [],
): EngineStore {
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
      const found = records.find((record) => record.runId === runId) ?? null;
      return found ? readThroughVersionCheck(found) : null;
    },
    listRuns() {
      return records.map(readThroughVersionCheck);
    },
  };
}
