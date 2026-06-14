import { mkdir, readFile, appendFile, access } from "node:fs/promises";
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

const TRANSITIONS_FILE = "TRANSITIONS.jsonl";

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
} as const;

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

async function runCli(): Promise<void> {
  const [, , ...args] = process.argv;
  const command = args[0];
  if (!command) {
    throw new Error("No command provided. Use validate or append.");
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

  throw new Error(`Unknown command: ${command}`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  runCli().catch((error) => {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(message);
    process.exitCode = 1;
  });
}
