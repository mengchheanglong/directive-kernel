import {
  appendFile,
  access,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ActiveWorkTransitionStatus =
  | "planned"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled"
  | "handoff"
  | "evaluating";

export type ActiveWorkTransitionRecord = {
  transition_id: string;
  timestamp: string;
  from_status: ActiveWorkTransitionStatus | string;
  to_status: ActiveWorkTransitionStatus | string;
  actor: string;
  reason: string;
  changed_files: string[];
  next_actor: string | null;
  next_action: string | null;
  evidence_refs: string[];
  side_effects: string[];
  resume_hint: string;
};

export type ActiveWorkCheckpointFile = {
  path: string;
  content: string;
  bytes: number;
};

export type ActiveWorkCheckpointRecord = {
  checkpoint_id: string;
  timestamp: string;
  actor: string;
  reason: string;
  source_files: string[];
  files: ActiveWorkCheckpointFile[];
  resume_hint: string;
};

const TRANSITIONS_FILE = "TRANSITIONS.jsonl";
const CHECKPOINTS_DIR = "CHECKPOINTS";
const CHECKPOINT_ID_SAFE_PATTERN = /^[A-Za-z0-9._-]+$/;
const aliasMap = {
  "active-dir": "active-dir",
  "transition-id": "transition-id",
  "timestamp": "timestamp",
  "from-status": "from-status",
  "to-status": "to-status",
  "actor": "actor",
  "reason": "reason",
  "changed-file": "changed-file",
  "next-actor": "next-actor",
  "next-action": "next-action",
  "evidence-ref": "evidence-ref",
  "side-effect": "side-effect",
  "resume-hint": "resume-hint",
  "checkpoint-id": "checkpoint-id",
  "file": "file",
} as const;

const DEFAULT_ACTIVE_WORK_CHECKPOINT_FILES = [
  "CURRENT.md",
  "NEXT.md",
  "STATE.json",
  "DECISIONS.md",
  "BLOCKERS.md",
  "EVIDENCE.md",
  "TASKS.md",
  "HANDOFF.md",
  "SESSION-BOOT.md",
  "SESSION-CLOSE.md",
  "README.md",
  "TRANSITIONS.jsonl",
] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array of strings`);
  }
  if (!value.every((entry) => typeof entry === "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
  return value;
}

function assertSafeCheckpointId(value: unknown): asserts value is string {
  if (!isNonEmptyString(value)) {
    throw new Error("checkpoint_id must be a non-empty string");
  }
  if (!CHECKPOINT_ID_SAFE_PATTERN.test(value)) {
    throw new Error("checkpoint_id must be safe for filenames");
  }
}

function assertSafeRelativePath(value: unknown, field: string): asserts value is string {
  if (!isNonEmptyString(value)) {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (path.isAbsolute(value) || path.win32.isAbsolute(value) || path.posix.isAbsolute(value)) {
    throw new Error(`${field} must be a relative path`);
  }
  if (/^[a-zA-Z]:[\\/]/.test(value)) {
    throw new Error(`${field} must not be a Windows drive path`);
  }
  const parts = value.split(/[\\/]/);
  if (parts.includes("..") || parts.includes("")) {
    throw new Error(`${field} must be a safe relative path`);
  }
}

function isValidUtf8ByteLength(pathValue: string, content: string, bytes: unknown): void {
  if (typeof bytes !== "number" || !Number.isInteger(bytes) || bytes < 0) {
    throw new Error(`bytes for ${pathValue} must be a non-negative integer`);
  }
  const actual = Buffer.from(content, "utf8").byteLength;
  if (bytes !== actual) {
    throw new Error(`bytes for ${pathValue} must equal UTF-8 byte length`);
  }
}

function normalizeStatus(value: unknown, field: string): ActiveWorkTransitionStatus | string {
  if (value === undefined || value === null) {
    return "unknown";
  }
  if (!isNonEmptyString(value)) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function normalizeNullableString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isNonEmptyString(value)) {
    throw new Error(`${field} must be null or a non-empty string`);
  }
  return value;
}

export function normalizeActiveWorkTransition(
  input: Partial<ActiveWorkTransitionRecord>,
): ActiveWorkTransitionRecord {
  if (!isNonEmptyString(input.transition_id)) {
    throw new Error("transition_id must be a non-empty string");
  }
  if (!isNonEmptyString(input.timestamp)) {
    throw new Error("timestamp must be a non-empty string");
  }
  const timestamp = input.timestamp;
  if (Number.isNaN(new Date(timestamp).getTime())) {
    throw new Error("timestamp must be a valid date string");
  }
  if (!isNonEmptyString(input.actor)) {
    throw new Error("actor must be a non-empty string");
  }
  if (!isNonEmptyString(input.reason)) {
    throw new Error("reason must be a non-empty string");
  }
  if (!isNonEmptyString(input.resume_hint)) {
    throw new Error("resume_hint must be a non-empty string");
  }

  const changedFiles = isStringArray(input.changed_files, "changed_files");
  const evidenceRefs = isStringArray(input.evidence_refs, "evidence_refs");
  const sideEffects = isStringArray(input.side_effects, "side_effects");

  return {
    transition_id: input.transition_id,
    timestamp: input.timestamp,
    from_status: normalizeStatus(input.from_status, "from_status"),
    to_status: normalizeStatus(input.to_status, "to_status"),
    actor: input.actor,
    reason: input.reason,
    changed_files: changedFiles,
    next_actor: normalizeNullableString(input.next_actor, "next_actor"),
    next_action: normalizeNullableString(input.next_action, "next_action"),
    evidence_refs: evidenceRefs,
    side_effects: sideEffects,
    resume_hint: input.resume_hint,
  };
}

export function getDefaultActiveWorkCheckpointFiles(): string[] {
  return [...DEFAULT_ACTIVE_WORK_CHECKPOINT_FILES];
}

export function normalizeActiveWorkCheckpoint(
  input: ActiveWorkCheckpointRecord,
): ActiveWorkCheckpointRecord {
  assertSafeCheckpointId(input.checkpoint_id);
  if (!isNonEmptyString(input.timestamp)) {
    throw new Error("timestamp must be a non-empty string");
  }
  if (Number.isNaN(new Date(input.timestamp).getTime())) {
    throw new Error("timestamp must be a valid date");
  }
  if (!isNonEmptyString(input.actor)) {
    throw new Error("actor must be a non-empty string");
  }
  if (!isNonEmptyString(input.reason)) {
    throw new Error("reason must be a non-empty string");
  }
  const sourceFiles = isStringArray(input.source_files, "source_files");
  if (!Array.isArray(input.files)) {
    throw new Error("files must be an array of checkpoint files");
  }

  sourceFiles.forEach((entry) => {
    assertSafeRelativePath(entry, "source_files");
  });

  const normalizedFiles: ActiveWorkCheckpointFile[] = input.files.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("files must be an array of { path, content, bytes } objects");
    }
    assertSafeRelativePath(entry.path, "files.path");
    if (typeof entry.content !== "string") {
      throw new Error("files.content must be a string");
    }
    isValidUtf8ByteLength(entry.path, entry.content, entry.bytes);
    return {
      path: entry.path,
      content: entry.content,
      bytes: entry.bytes,
    };
  });

  if (!isNonEmptyString(input.resume_hint)) {
    throw new Error("resume_hint must be a non-empty string");
  }

  return {
    checkpoint_id: input.checkpoint_id,
    timestamp: input.timestamp,
    actor: input.actor,
    reason: input.reason,
    source_files: sourceFiles,
    files: normalizedFiles,
    resume_hint: input.resume_hint,
  };
}

export async function createActiveWorkCheckpoint(input: {
  activeDir: string;
  checkpoint: Pick<
    ActiveWorkCheckpointRecord,
    "checkpoint_id" | "timestamp" | "actor" | "reason" | "resume_hint"
  >;
  files?: string[];
}): Promise<ActiveWorkCheckpointRecord> {
  assertSafeCheckpointId(input.checkpoint.checkpoint_id);
  const sourceFiles = input.files ?? getDefaultActiveWorkCheckpointFiles();

  if (!Array.isArray(sourceFiles)) {
    throw new Error("files must be an array of file names");
  }

  const checkpointDir = path.join(input.activeDir, CHECKPOINTS_DIR);
  await mkdir(checkpointDir, { recursive: true });
  const candidateRecords: ActiveWorkCheckpointFile[] = [];

  for (const filePath of sourceFiles) {
    assertSafeRelativePath(filePath, "source_files");
    const absoluteFilePath = path.join(input.activeDir, filePath);
    try {
      const content = await readFile(absoluteFilePath, "utf8");
      candidateRecords.push({
        path: filePath,
        content,
        bytes: Buffer.byteLength(content, "utf8"),
      });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }

  const record = normalizeActiveWorkCheckpoint({
    checkpoint_id: input.checkpoint.checkpoint_id,
    timestamp: input.checkpoint.timestamp,
    actor: input.checkpoint.actor,
    reason: input.checkpoint.reason,
    source_files: sourceFiles,
    files: candidateRecords,
    resume_hint: input.checkpoint.resume_hint,
  });

  const checkpointPath = path.join(
    input.activeDir,
    CHECKPOINTS_DIR,
    `${input.checkpoint.checkpoint_id}.json`,
  );
  await writeFile(
    checkpointPath,
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );
  return record;
}

export async function readActiveWorkCheckpoint(input: {
  activeDir: string;
  checkpointId: string;
}): Promise<ActiveWorkCheckpointRecord> {
  assertSafeCheckpointId(input.checkpointId);
  const checkpointPath = path.join(
    input.activeDir,
    CHECKPOINTS_DIR,
    `${input.checkpointId}.json`,
  );
  const text = await readFile(checkpointPath, "utf8");
  const parsed = JSON.parse(text);
  return normalizeActiveWorkCheckpoint(parsed as ActiveWorkCheckpointRecord);
}

export function parseActiveWorkTransitionsJsonl(
  text: string,
): ActiveWorkTransitionRecord[] {
  if (!text.trim()) {
    return [];
  }

  const lines = text.split(/\r?\n/);
  const records: ActiveWorkTransitionRecord[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown parse error";
      throw new Error(`Malformed JSONL at line ${lineNumber}: ${message}`);
    }

    try {
      records.push(
        normalizeActiveWorkTransition(parsed as Partial<ActiveWorkTransitionRecord>),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid record";
      throw new Error(`Invalid transition record at line ${lineNumber}: ${message}`);
    }
  }

  return records;
}

export function formatActiveWorkTransitionJsonlLine(
  record: ActiveWorkTransitionRecord,
): string {
  return JSON.stringify(record);
}

export async function readActiveWorkTransitions(
  activeDir: string,
): Promise<ActiveWorkTransitionRecord[]> {
  const transitionsPath = path.join(activeDir, TRANSITIONS_FILE);
  try {
    await access(transitionsPath, constants.F_OK);
  } catch {
    return [];
  }

  const text = await readFile(transitionsPath, "utf8");
  return parseActiveWorkTransitionsJsonl(text);
}

export async function appendActiveWorkTransition(input: {
  activeDir: string;
  record: Partial<ActiveWorkTransitionRecord>;
}): Promise<ActiveWorkTransitionRecord> {
  const activeDir = input.activeDir;
  const record = normalizeActiveWorkTransition(input.record);
  const filePath = path.join(activeDir, TRANSITIONS_FILE);
  const line = formatActiveWorkTransitionJsonlLine(record);
  await mkdir(activeDir, { recursive: true });
  await appendFile(filePath, `${line}\n`, "utf8");
  return record;
}

type CliOptions = Record<string, string[]>;

function parseCliArgs(argv: string[]): Record<string, string[]> {
  const options: CliOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    if (!aliasMap[key as keyof typeof aliasMap]) {
      throw new Error(`Unknown option --${key}`);
    }
    if (!options[key]) {
      options[key] = [];
    }
    options[key].push(value);
    i += 1;
  }

  return options;
}

function getSingle(options: Record<string, string[]>, key: string): string | undefined {
  const values = options[key];
  if (!values || values.length === 0) {
    return undefined;
  }
  return values[values.length - 1];
}

function getRequired(options: Record<string, string[]>, key: string): string {
  const value = getSingle(options, key);
  if (!isNonEmptyString(value)) {
    throw new Error(`Missing required flag: --${key}`);
  }
  return value;
}

function getOptional(options: Record<string, string[]>, key: string): string | null {
  const value = getSingle(options, key);
  if (value === undefined) {
    return null;
  }
  return value;
}

async function runValidate(activeDir: string): Promise<void> {
  return readActiveWorkTransitions(activeDir)
    .then((transitions) => {
      const filePath = path.join(activeDir, TRANSITIONS_FILE);
      if (!transitions.length) {
        console.log(`No transitions found in ${filePath}.`);
      } else {
        console.log(`Parsed ${transitions.length} transition(s) from ${filePath}.`);
      }
    });
}

async function runAppend(
  options: Record<string, string[]>,
): Promise<number> {
  const activeDir = getSingle(options, "active-dir");
  if (!isNonEmptyString(activeDir)) {
    throw new Error("Missing required flag: --active-dir");
  }

  const record = await appendActiveWorkTransition({
    activeDir,
    record: {
      transition_id: getRequired(options, "transition-id"),
      timestamp: getRequired(options, "timestamp"),
      from_status: getSingle(options, "from-status") ?? "unknown",
      to_status: getSingle(options, "to-status") ?? "unknown",
      actor: getRequired(options, "actor"),
      reason: getRequired(options, "reason"),
      changed_files: getSingle(options, "changed-file")
        ? options["changed-file"]
        : [],
      next_actor: getOptional(options, "next-actor"),
      next_action: getOptional(options, "next-action"),
      evidence_refs: getSingle(options, "evidence-ref")
        ? options["evidence-ref"]
        : [],
      side_effects: getSingle(options, "side-effect")
        ? options["side-effect"]
        : [],
      resume_hint: getRequired(options, "resume-hint"),
    },
  });

  const filePath = path.join(activeDir, TRANSITIONS_FILE);
  console.log(`Appended transition ${record.transition_id} to ${filePath}`);
  return 0;
}

async function runCheckpoint(options: Record<string, string[]>): Promise<number> {
  const activeDir = getSingle(options, "active-dir");
  if (!isNonEmptyString(activeDir)) {
    throw new Error("Missing required flag: --active-dir");
  }

  const checkpoint = await createActiveWorkCheckpoint({
    activeDir,
    checkpoint: {
      checkpoint_id: getRequired(options, "checkpoint-id"),
      timestamp: getRequired(options, "timestamp"),
      actor: getRequired(options, "actor"),
      reason: getRequired(options, "reason"),
      resume_hint: getRequired(options, "resume-hint"),
    },
    files: getSingle(options, "file") ? options.file : undefined,
  });
  const message = `Created checkpoint ${checkpoint.checkpoint_id} with ${checkpoint.files.length} file(s) captured.`;
  console.log(message);
  return 0;
}

async function runListCheckpoints(options: Record<string, string[]>): Promise<number> {
  const activeDir = getSingle(options, "active-dir");
  if (!isNonEmptyString(activeDir)) {
    throw new Error("Missing required flag: --active-dir");
  }

  const checkpointsDir = path.join(activeDir, CHECKPOINTS_DIR);
  try {
    await access(checkpointsDir, constants.F_OK);
  } catch {
    console.log(`No checkpoints found in ${checkpointsDir}.`);
    return 0;
  }

  const dirents = await readdir(checkpointsDir, { withFileTypes: true });
  const ids = dirents
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/, ""))
    .sort((left, right) => left.localeCompare(right));

  if (ids.length === 0) {
    console.log(`No checkpoints found in ${checkpointsDir}.`);
    return 0;
  }

  ids.forEach((id) => {
    console.log(id);
  });
  return 0;
}

async function runCli(): Promise<void> {
  const [, , ...args] = process.argv;
  const command = args[0];
  if (!command) {
    throw new Error("No command provided. Use validate, append, checkpoint, or list-checkpoints.");
  }
  const options = parseCliArgs(args.slice(1));

  if (command === "validate") {
    const activeDir = getRequired(options, "active-dir");
    await runValidate(activeDir);
    return;
  }

  if (command === "append") {
    await runAppend(options);
    return;
  }

  if (command === "checkpoint") {
    await runCheckpoint(options);
    return;
  }

  if (command === "list-checkpoints") {
    await runListCheckpoints(options);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  runCli().catch((error) => {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(message);
    process.exitCode = 1;
  });
}
