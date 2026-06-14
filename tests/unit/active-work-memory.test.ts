import { execSync } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  appendActiveWorkTransition,
  formatActiveWorkTransitionJsonlLine,
  normalizeActiveWorkTransition,
  parseActiveWorkTransitionsJsonl,
} from "../../scripts/active-work-memory";

const CLI_SCRIPT = path.resolve("scripts/active-work-memory.ts");

const VALID_RECORD = {
  transition_id: "awm-test",
  timestamp: "2026-06-14T20:13:32.000Z",
  from_status: "planned",
  to_status: "in_progress",
  actor: "Hermes",
  reason: "test append",
  changed_files: [".hermes/active/NEXT.md"],
  next_actor: "Codex",
  next_action: "implement AWM-1",
  evidence_refs: [
    ".hermes/evaluations/langgraph-active-memory-architecture-experiment/REPORT.md",
  ],
  side_effects: ["none"],
  resume_hint: "read NEXT.md",
};

async function withTempDir<T>(work: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "awm1-"));
  try {
    return await work(dir);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
}

function runCli(args: string[]) {
  const cmd = `pnpm exec tsx ${JSON.stringify(
    CLI_SCRIPT,
  )} ${args.map((arg) => JSON.stringify(arg)).join(" ")}`;
  try {
    const output = execSync(cmd, { encoding: "utf8" });
    return {
      status: 0,
      stdout: output.toString(),
      stderr: "",
    };
  } catch (error) {
    const thrown = error as {
      status?: number;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    return {
      status: thrown.status ?? 1,
      stdout: thrown.stdout?.toString() ?? "",
      stderr: thrown.stderr?.toString() ?? "",
    };
  }
}

describe("normalizeActiveWorkTransition", () => {
  it("accepts a complete valid record and preserves fields", () => {
    const record = normalizeActiveWorkTransition(VALID_RECORD);
    expect(record).toEqual(
      expect.objectContaining({
        transition_id: VALID_RECORD.transition_id,
        timestamp: VALID_RECORD.timestamp,
        from_status: VALID_RECORD.from_status,
        to_status: VALID_RECORD.to_status,
        actor: VALID_RECORD.actor,
        reason: VALID_RECORD.reason,
        changed_files: VALID_RECORD.changed_files,
        next_actor: VALID_RECORD.next_actor,
        next_action: VALID_RECORD.next_action,
        evidence_refs: VALID_RECORD.evidence_refs,
        side_effects: VALID_RECORD.side_effects,
        resume_hint: VALID_RECORD.resume_hint,
      }),
    );
  });

  it("rejects missing required strings", () => {
    expect(() =>
      normalizeActiveWorkTransition({
        ...VALID_RECORD,
        transition_id: "",
      }),
    ).toThrow("transition_id");
    expect(() =>
      normalizeActiveWorkTransition({
        ...VALID_RECORD,
        actor: "",
      }),
    ).toThrow("actor");
    expect(() =>
      normalizeActiveWorkTransition({
        ...VALID_RECORD,
        reason: "",
      }),
    ).toThrow("reason");
    expect(() =>
      normalizeActiveWorkTransition({
        ...VALID_RECORD,
        resume_hint: "",
      }),
    ).toThrow("resume_hint");
  });

  it("rejects invalid timestamps", () => {
    expect(() =>
      normalizeActiveWorkTransition({
        ...VALID_RECORD,
        timestamp: "not-a-date",
      }),
    ).toThrow("timestamp must be a valid date string");
  });
});

describe("JSONL formatting and parsing", () => {
  it("formatActiveWorkTransitionJsonlLine returns one JSON object line", () => {
    const record = normalizeActiveWorkTransition(VALID_RECORD);
    const line = formatActiveWorkTransitionJsonlLine(record);
    expect(line).toBe(JSON.stringify(record));
    expect(line.includes("\n")).toBe(false);
  });

  it("parseActiveWorkTransitionsJsonl ignores blank lines", () => {
    const first = formatActiveWorkTransitionJsonlLine(
      normalizeActiveWorkTransition(VALID_RECORD),
    );
    const second = formatActiveWorkTransitionJsonlLine(
      normalizeActiveWorkTransition({
        ...VALID_RECORD,
        transition_id: "awm-test-2",
      }),
    );
    const text = `\n${first}\n\n${second}\n\n`;
    const records = parseActiveWorkTransitionsJsonl(text);
    expect(records.map((record) => record.transition_id)).toEqual([
      "awm-test",
      "awm-test-2",
    ]);
  });

  it("parseActiveWorkTransitionsJsonl reports malformed JSON with line number", () => {
    const text = `${formatActiveWorkTransitionJsonlLine(
      normalizeActiveWorkTransition(VALID_RECORD),
    )}\n{bad-json}`;
    expect(() => parseActiveWorkTransitionsJsonl(text)).toThrow("line 2");
  });
});

describe("append helpers", () => {
  beforeEach(() => {
    expect.hasAssertions();
  });

  it("appendActiveWorkTransition appends without rewriting prior lines", async () => {
    await withTempDir(async (dir) => {
      await appendActiveWorkTransition({
        activeDir: dir,
        record: {
          ...VALID_RECORD,
          transition_id: "awm-base",
          timestamp: "2026-06-14T20:13:31.000Z",
        },
      });
      await appendActiveWorkTransition({
        activeDir: dir,
        record: {
          ...VALID_RECORD,
          transition_id: "awm-new",
          timestamp: "2026-06-14T20:13:32.000Z",
        },
      });
      const raw = await readFile(path.join(dir, "TRANSITIONS.jsonl"), "utf8");
      const lines = raw.trim().split("\n");
      const parsed = parseActiveWorkTransitionsJsonl(raw);
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('"transition_id":"awm-base"');
      expect(lines[1]).toContain('"transition_id":"awm-new"');
      expect(parsed.map((record) => record.transition_id)).toEqual([
        "awm-base",
        "awm-new",
      ]);
    });
  });

  it("validate command on missing/empty temp dir exits 0 and reports zero records", async () => {
    await withTempDir(async (dir) => {
      const result = runCli(["validate", "--active-dir", dir]);
      expect(result.status).toBe(0);
      expect((result.stdout + result.stderr).toLowerCase()).toContain("no transitions");
    });
  });

  it("append CLI writes a record and validate reports one record", async () => {
    await withTempDir(async (dir) => {
      const appendResult = runCli([
        "append",
        "--active-dir",
        dir,
        "--transition-id",
        "awm-test",
        "--timestamp",
        "2026-06-14T20:13:32.000Z",
        "--from-status",
        "planned",
        "--to-status",
        "in_progress",
        "--actor",
        "Hermes",
        "--reason",
        "test append",
        "--changed-file",
        ".hermes/active/NEXT.md",
        "--next-actor",
        "Codex",
        "--next-action",
        "implement AWM-1",
        "--evidence-ref",
        ".hermes/evaluations/langgraph-active-memory-architecture-experiment/REPORT.md",
        "--side-effect",
        "none",
        "--resume-hint",
        "read NEXT.md",
      ]);
      expect(appendResult.status).toBe(0);

      const validateResult = runCli(["validate", "--active-dir", dir]);
      expect(validateResult.status).toBe(0);
      expect(validateResult.stdout + validateResult.stderr).toMatch(/1/);
    });
  });
});
