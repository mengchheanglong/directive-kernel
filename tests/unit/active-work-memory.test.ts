import { execSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  appendActiveWorkTransition,
  createActiveWorkCheckpoint,
  formatActiveWorkTransitionJsonlLine,
  normalizeActiveWorkCheckpoint,
  normalizeActiveWorkTransition,
  parseActiveWorkTransitionsJsonl,
  readActiveWorkCheckpoint,
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

const VALID_CHECKPOINT = {
  checkpoint_id: "awm3-valid",
  timestamp: "2026-06-14T20:54:31.000+07:00",
  actor: "Hermes",
  reason: "manual checkpoint",
  source_files: ["CURRENT.md", "NEXT.md"],
  files: [
    {
      path: "CURRENT.md",
      content: "current state",
      bytes: Buffer.from("current state", "utf8").byteLength,
    },
    {
      path: "NEXT.md",
      content: "next state",
      bytes: Buffer.from("next state", "utf8").byteLength,
    },
  ],
  resume_hint: "read CURRENT.md and NEXT.md",
};

async function withTempDir<T>(work: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "awm-"));
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

describe("normalizeActiveWorkCheckpoint", () => {
  it("accepts a valid record and preserves fields", () => {
    const checkpoint = normalizeActiveWorkCheckpoint({
      ...VALID_CHECKPOINT,
    });
    expect(checkpoint).toEqual(
      expect.objectContaining({
        checkpoint_id: VALID_CHECKPOINT.checkpoint_id,
        timestamp: VALID_CHECKPOINT.timestamp,
        actor: VALID_CHECKPOINT.actor,
        reason: VALID_CHECKPOINT.reason,
        source_files: VALID_CHECKPOINT.source_files,
        files: VALID_CHECKPOINT.files,
        resume_hint: VALID_CHECKPOINT.resume_hint,
      }),
    );
  });

  it("rejects missing required strings and invalid timestamps", () => {
    expect(() =>
      normalizeActiveWorkCheckpoint({
        ...VALID_CHECKPOINT,
        checkpoint_id: "",
      }),
    ).toThrow("checkpoint_id");
    expect(() =>
      normalizeActiveWorkCheckpoint({
        ...VALID_CHECKPOINT,
        actor: "",
      }),
    ).toThrow("actor");
    expect(() =>
      normalizeActiveWorkCheckpoint({
        ...VALID_CHECKPOINT,
        timestamp: "not-a-date",
      }),
    ).toThrow("timestamp must be a valid date");
  });

  it("rejects unsafe checkpoint IDs and file paths", () => {
    expect(() =>
      normalizeActiveWorkCheckpoint({
        ...VALID_CHECKPOINT,
        checkpoint_id: "bad/id",
      }),
    ).toThrow("safe for filenames");
    expect(() =>
      normalizeActiveWorkCheckpoint({
        ...VALID_CHECKPOINT,
        source_files: ["../CURRENT.md"],
      }),
    ).toThrow("source_files");
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

describe("active work checkpoints", () => {
  beforeEach(() => {
    expect.hasAssertions();
  });

  it("createActiveWorkCheckpoint captures selected files into checkpoint payload", async () => {
    await withTempDir(async (dir) => {
      const currentPath = path.join(dir, "CURRENT.md");
      const nextPath = path.join(dir, "NEXT.md");
      await writeFile(currentPath, "current");
      await writeFile(nextPath, "next");

      const record = await createActiveWorkCheckpoint({
        activeDir: dir,
        checkpoint: {
          checkpoint_id: "awm3-capture",
          timestamp: "2026-06-14T20:54:31.000+07:00",
          actor: "Hermes",
          reason: "manual checkpoint",
          resume_hint: "read CURRENT.md",
        },
        files: ["CURRENT.md", "NEXT.md"],
      });

      const checkpointPath = path.join(dir, "CHECKPOINTS", "awm3-capture.json");
      const raw = await readFile(checkpointPath, "utf8");
      const onDisk = JSON.parse(raw);

      expect(record.files).toHaveLength(2);
      expect(record.source_files).toEqual(["CURRENT.md", "NEXT.md"]);
      expect(onDisk.files).toHaveLength(2);
      expect(onDisk.checkpoint_id).toBe("awm3-capture");
    });
  });

  it("missing selected files are skipped without failing", async () => {
    await withTempDir(async (dir) => {
      await writeFile(path.join(dir, "CURRENT.md"), "current");
      const record = await createActiveWorkCheckpoint({
        activeDir: dir,
        checkpoint: {
          checkpoint_id: "awm3-missing",
          timestamp: "2026-06-14T20:54:31.000+07:00",
          actor: "Hermes",
          reason: "manual checkpoint",
          resume_hint: "missing file test",
        },
        files: ["CURRENT.md", "MISSING.md"],
      });
      expect(record.files).toHaveLength(1);
      expect(record.source_files).toEqual(["CURRENT.md", "MISSING.md"]);
    });
  });

  it("existing active source files are not rewritten by checkpoint creation", async () => {
    await withTempDir(async (dir) => {
      const currentFile = path.join(dir, "CURRENT.md");
      await writeFile(currentFile, "current");
      const before = await readFile(currentFile, "utf8");
      await createActiveWorkCheckpoint({
        activeDir: dir,
        checkpoint: {
          checkpoint_id: "awm3-no-rewrite",
          timestamp: "2026-06-14T20:54:31.000+07:00",
          actor: "Hermes",
          reason: "manual checkpoint",
          resume_hint: "read CURRENT.md",
        },
        files: ["CURRENT.md"],
      });
      const after = await readFile(currentFile, "utf8");
      expect(after).toBe(before);
    });
  });

  it("readActiveWorkCheckpoint loads and validates checkpoint payload", async () => {
    await withTempDir(async (dir) => {
      const written = await createActiveWorkCheckpoint({
        activeDir: dir,
        checkpoint: {
          checkpoint_id: "awm3-read",
          timestamp: "2026-06-14T20:54:31.000+07:00",
          actor: "Hermes",
          reason: "manual checkpoint",
          resume_hint: "read CURRENT.md",
        },
        files: [],
      });
      const read = await readActiveWorkCheckpoint({
        activeDir: dir,
        checkpointId: "awm3-read",
      });
      expect(read).toEqual(written);
    });
  });

  it("checkpoint CLI writes one checkpoint and prints captured file count", async () => {
    await withTempDir(async (dir) => {
      await writeFile(path.join(dir, "CURRENT.md"), "current");
      const result = runCli([
        "checkpoint",
        "--active-dir",
        dir,
        "--checkpoint-id",
        "awm3-cli",
        "--timestamp",
        "2026-06-14T20:54:31.000+07:00",
        "--actor",
        "Hermes",
        "--reason",
        "manual checkpoint",
        "--file",
        "CURRENT.md",
        "--resume-hint",
        "read CURRENT.md",
      ]);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("awm3-cli");
      expect(result.stdout).toContain("1 file(s) captured");
      const checkpointPath = path.join(dir, "CHECKPOINTS", "awm3-cli.json");
      const exists = await readFile(checkpointPath, "utf8");
      expect(exists).toContain('"checkpoint_id": "awm3-cli"');
    });
  });

  it("list-checkpoints reports zero checkpoints when directory missing and lists ids after creation", async () => {
    await withTempDir(async (dir) => {
      const zero = runCli(["list-checkpoints", "--active-dir", dir]);
      expect(zero.status).toBe(0);
      expect(zero.stdout.toLowerCase()).toContain("no checkpoints");

      await writeFile(path.join(dir, "CURRENT.md"), "current");
      runCli([
        "checkpoint",
        "--active-dir",
        dir,
        "--checkpoint-id",
        "awm3-z",
        "--timestamp",
        "2026-06-14T20:54:31.000+07:00",
        "--actor",
        "Hermes",
        "--reason",
        "manual checkpoint",
        "--file",
        "CURRENT.md",
        "--resume-hint",
        "read CURRENT.md",
      ]);
      runCli([
        "checkpoint",
        "--active-dir",
        dir,
        "--checkpoint-id",
        "awm3-a",
        "--timestamp",
        "2026-06-14T20:54:31.000+07:00",
        "--actor",
        "Hermes",
        "--reason",
        "manual checkpoint",
        "--file",
        "CURRENT.md",
        "--resume-hint",
        "read CURRENT.md",
      ]);

      const list = runCli(["list-checkpoints", "--active-dir", dir]);
      expect(list.status).toBe(0);
      const lines = list.stdout
        .trim()
        .split(/\r?\n/)
        .filter((line) => line);
      expect(lines).toEqual(["awm3-a", "awm3-z"]);
    });
  });
});
