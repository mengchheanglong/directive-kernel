/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";

import type { DirectiveEngineRunRecord } from "./types.ts";

export type DirectiveEngineStore = {
  writeRun(record: DirectiveEngineRunRecord): void | Promise<void>;
  readRun(runId: string): DirectiveEngineRunRecord | null | Promise<DirectiveEngineRunRecord | null>;
  listRuns(): DirectiveEngineRunRecord[] | Promise<DirectiveEngineRunRecord[]>;
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

  return {
    writeRun(record) {
      const recordPath = resolveDirectiveEngineStoreRecordPath({
        engineRunsRoot,
        record,
      });
      fs.mkdirSync(path.dirname(recordPath), { recursive: true });
      fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    },
    readRun(runId) {
      for (const recordPath of listFilesystemRunPaths(engineRunsRoot)) {
        const record = readFilesystemRunRecord(recordPath);
        if (!record || record.runId !== runId) {
          continue;
        }
        return record;
      }
      return null;
    },
    listRuns() {
      return listFilesystemRunPaths(engineRunsRoot)
        .map((recordPath) => readFilesystemRunRecord(recordPath))
        .filter((record): record is DirectiveEngineRunRecord => Boolean(record));
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
    readRun(runId) {
      return records.find((record) => record.runId === runId) ?? null;
    },
    listRuns() {
      return [...records];
    },
  };
}
