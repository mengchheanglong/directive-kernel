import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { createMemoryEngineStore } from "../../engine/storage.ts";
import { DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION } from "../../engine/types.ts";
import type { EngineRunRecord } from "../../engine/types.ts";
import { v9RecordArb, recordAtVersionArb } from "./_arbitraries/run-record.ts";

const CURRENT = DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION;

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord).filter((k) => aRecord[k] !== undefined);
    const bKeys = Object.keys(bRecord).filter((k) => bRecord[k] !== undefined);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(aRecord[key], bRecord[key]));
  }

  return false;
}

function asRecord(r: unknown): Record<string, unknown> {
  return r as Record<string, unknown>;
}

function createStore(records: ReadonlyArray<unknown>) {
  return createMemoryEngineStore(records as EngineRunRecord[]);
}

function getListRuns(store: ReturnType<typeof createMemoryEngineStore>) {
  const result = store.listRuns();
  if (result instanceof Promise) throw new Error("unexpected promise");
  return result;
}


describe("storage version check", () => {
  // Property 3: Storage version check passes through records at Current_Schema_Version unchanged.
  // Design: design.md → "Correctness Properties → Property 3".
  // Validates: Requirements 10.1, 10.2, 10.6, 10.7, 14.4.
  it("Property 3: readRun and listRuns return records at Current_Schema_Version unchanged", () => {
    fc.assert(
      fc.property(v9RecordArb, (record) => {
        const store = createStore([record]);

        const readResult = store.readRun(asRecord(record).runId as string);
        expect(readResult).not.toBeNull();
        expect(deepEqual(readResult, record)).toBe(true);

        const listed = getListRuns(store);
        expect(listed.length).toBe(1);
        expect(deepEqual(listed[0], record)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Property 4: Storage version check rejects future-version records with schema_version_future:.
  // Design: design.md → "Correctness Properties → Property 4".
  // Validates: Requirements 10.5, 15.5.
  it("Property 4: future-version records fail with schema_version_future:", () => {
    const futureVersionArb = fc.integer({
      min: CURRENT + 1,
      max: CURRENT + 50,
    });
    fc.assert(
      fc.property(
        recordAtVersionArb(futureVersionArb),
        (record) => {
          const store = createStore([record]);
          const runId = asRecord(record).runId as string;

          expect(() => store.readRun(runId)).toThrow(
            /^schema_version_future:/,
          );
          expect(() => getListRuns(store)).toThrow(
            /^schema_version_future:/,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 5: Storage version check rejects unmigratable records with schema_version_unmigratable:.
  // Design: design.md → "Correctness Properties → Property 5".
  // Validates: Requirements 10.4, 14.3, 15.2.
  it("Property 5: unmigratable records fail with schema_version_unmigratable:", () => {
    const unmigratableVersionArb = fc.integer({ min: 0, max: 7 });
    fc.assert(
      fc.property(
        recordAtVersionArb(unmigratableVersionArb),
        (record) => {
          const store = createStore([record]);
          const runId = asRecord(record).runId as string;

          expect(() => store.readRun(runId)).toThrow(
            /^schema_version_unmigratable:/,
          );
          expect(() => getListRuns(store)).toThrow(
            /^schema_version_unmigratable:/,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
