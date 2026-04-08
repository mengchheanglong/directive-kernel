import type { DirectiveEngineRunRecord } from "./types.ts";

export type DirectiveEngineStore = {
  writeRun(record: DirectiveEngineRunRecord): void | Promise<void>;
  readRun(runId: string): DirectiveEngineRunRecord | null | Promise<DirectiveEngineRunRecord | null>;
  listRuns(): DirectiveEngineRunRecord[] | Promise<DirectiveEngineRunRecord[]>;
};

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
