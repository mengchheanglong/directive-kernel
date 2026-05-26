import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  createMemoryEngineStore,
  createFilesystemEngineStore,
} from "../../../engine/storage.ts";
import { DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION } from "../../../engine/types.ts";
import type { EngineRunRecord } from "../../../engine/types.ts";

const CURRENT = DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION;

function makeRecord(overrides: Record<string, unknown>): Record<string, unknown> {
  const base: Record<string, unknown> = {
    $schema: "shared/schemas/run-record.schema.json",
    schemaVersion: CURRENT,
    recordKind: "directive_engine_run_record",
    runId: randomUUID(),
    receivedAt: new Date().toISOString(),
    source: { sourceType: "paper", sourceRef: "test-ref", title: "Test" },
    selectedLane: { laneId: "discovery", label: "Discovery" },
    candidate: {
      candidateId: randomUUID(),
      candidateName: "Test Candidate",
    },
  };

  // For v8 migration test, include a v8-form key that gets renamed
  if (overrides.schemaVersion === 8) {
    base.earnedAutonomy = { routeClass: "auto", overallScore: 50 };
  }

  return { ...base, ...overrides };
}

interface Case {
  readonly name: string;
  readonly recordVersion: number;
  readonly assert: (read: () => unknown) => void;
  /** Optional check for filesystem store on-disk non-mutation. */
  readonly beforeAfter?: (before: () => Buffer, after: () => Buffer) => void;
}

const CASES: readonly Case[] = [
  {
    name: "v7 refuses: schema_version_unmigratable with both versions",
    recordVersion: 7,
    assert: (read) => {
      expect(read).toThrow(/^schema_version_unmigratable:/);
    },
  },
  {
    name: "v8 migrates: returns v9 with renamed fields and rewritten $schema",
    recordVersion: 8,
    assert: (read) => {
      const result = read() as Record<string, unknown>;
      expect(result.schemaVersion).toBe(9);
      expect(result.operatorTrustScore).not.toBeUndefined();
      expect(result.$schema).toMatch(/run-record\.schema\.json$/);
    },
    beforeAfter: (before, after) => {
      expect(before().equals(after())).toBe(true);
    },
  },
  {
    name: "v9 pass-through: returns the record unchanged on every field",
    recordVersion: CURRENT,
    assert: (read) => {
      const result = read() as Record<string, unknown>;
      expect(result.schemaVersion).toBe(CURRENT);
    },
  },
  {
    name: "v10 refuse-future: schema_version_future with both versions",
    recordVersion: 10,
    assert: (read) => {
      expect(read).toThrow(/^schema_version_future:/);
    },
  },
];

function runMemoryTests(c: Case) {
  it(`memory store readRun: ${c.name}`, () => {
    const record = makeRecord({ schemaVersion: c.recordVersion });
    const store = createMemoryEngineStore([record as EngineRunRecord]);
    c.assert(() => store.readRun(record.runId as string));
  });

  it(`memory store listRuns: ${c.name}`, () => {
    const record = makeRecord({ schemaVersion: c.recordVersion });
    const store = createMemoryEngineStore([record as EngineRunRecord]);
    c.assert(() => {
      const listed = store.listRuns() as EngineRunRecord[];
      if (listed.length !== 1) throw new Error("expected 1 run");
      return listed[0];
    });
  });
}

function runFilesystemTests(c: Case) {
  it(`filesystem store readRun: ${c.name}`, () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "directive-test-"));
    const record = makeRecord({ schemaVersion: c.recordVersion });

    try {
      const store = createFilesystemEngineStore({ engineRunsRoot: tmpDir });
      store.writeRun(record as EngineRunRecord);

      // For throws cases, wrap in a closure for the assert
      if (c.recordVersion === 7 || c.recordVersion === 10) {
        c.assert(() => store.readRun(record.runId as string));
        return;
      }

      let beforeBytes: Buffer | null = null;
      if (c.beforeAfter) {
        const runPaths = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".json"));
        if (runPaths.length === 1) {
          beforeBytes = fs.readFileSync(path.join(tmpDir, runPaths[0]));
        }
      }

      const readResult = store.readRun(record.runId as string);

      if (c.beforeAfter && beforeBytes) {
        const runPaths = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".json"));
        if (runPaths.length === 1) {
          const afterBytes = fs.readFileSync(path.join(tmpDir, runPaths[0]));
          c.beforeAfter(
            () => beforeBytes!,
            () => afterBytes,
          );
        }
      }

      expect(readResult).not.toBeNull();
      c.assert(() => readResult);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
}

describe("Storage_Version_Check (hardening)", () => {
  for (const c of CASES) {
    runMemoryTests(c);
  }
  for (const c of CASES) {
    runFilesystemTests(c);
  }
});
