import { readJson } from "../../shared/lib/file-io.ts";
import {
  acquireDirectiveRootLock,
  releaseDirectiveRootLock,
} from "../../shared/lib/process-lock.ts";
import type { EnginePlanProgressUpdate } from "../../engine/types.ts";
import {
  approveGapFormalization,
  approveMissionFeedbackEntry,
  listGapFormalizationRecords,
  listMissionFeedbackEntries,
  listMissionEvolutionHistory,
  listPendingGapFormalizationCandidates,
  previewMissionFeedbackEntry,
  readActiveMissionEvolution,
  rejectGapFormalization,
  rejectMissionFeedbackEntry,
  revertMissionEvolution,
} from "../../engine/mission/index.ts";
import { refreshDiscoveryGapWorklist } from "../../discovery/lib/gaps/gap-worklist-refresh.ts";

import { archiveRunRecords, rotateDecisionPolicyLedger, summarizeKernelStorage } from "../../engine/maintenance/archive.ts";
import { writeRuntimeCapabilityScaffold } from "../../runtime/core/capability-registry.ts";

import type { DiscoverySubmissionRequest } from "../../discovery/lib/front-door/submission-router.ts";
import type { RuntimeFollowUpRecordRequest } from "../../runtime/lib/writers/follow-up-record-writer.ts";
import type { RuntimeProofBundleRequest } from "../../runtime/lib/writers/proof-bundle-writer.ts";
import type { RuntimePromotionRecordRequest } from "../../runtime/lib/writers/promotion-record-writer.ts";
import type { RuntimeRegistryEntryRequest } from "../../runtime/lib/writers/registry-entry-writer.ts";
import { migrateRegistryEntryVerification } from "../../shared/schemas/migrations/registry-entry-verification.ts";
import type { RuntimeRecordRequest } from "../../runtime/lib/writers/record-writer.ts";
import type { RuntimeTransformationProofRequest } from "../../runtime/lib/writers/transformation-proof-writer.ts";
import type { RuntimeTransformationRecordRequest } from "../../runtime/lib/writers/transformation-record-writer.ts";
import { bootstrapStandaloneHostWorkspace } from "./bootstrap.ts";
import {
  applyStandaloneHostConfigOverrides,
  loadStandaloneHostConfig,
  type ResolvedStandaloneHostConfig,
} from "./config.ts";
import {
  createStandaloneFilesystemHost,
  createStandaloneFilesystemHostFromConfig,
  DEFAULT_STANDALONE_HOST_NAME,
  runStandaloneHostAcceptanceQuickstart,
} from "./filesystem-host.ts";
import {
  start,
  startFromConfig,
} from "./server.ts";
import {
  formatTryCommandOutput,
  runStandaloneHostTryCommand,
} from "./try-command.ts";

type CommandName =
  | "init"
  | "acceptance-quickstart"
  | "discovery-submit"
  | "discovery-overview"
  | "engine-plan-progress"
  | "engine-reroute"
  | "engine-replay"
  | "mission-feedback"
  | "mission-preview"
  | "mission-approve"
  | "mission-reject"
  | "mission-revert"
  | "mission-history"
  | "gap-formalize"
  | "gap-approve"
  | "gap-reject"
  | "runtime-host-selection-resolve"
  | "runtime-promotion-seam-resolve"
  | "runtime-registry-accept"
  | "runtime-followup-write"
  | "runtime-record-write"
  | "runtime-proof-write"
  | "runtime-transformation-proof-write"
  | "runtime-transformation-record-write"
  | "runtime-promotion-write"
  | "runtime-registry-write"
  | "runtime-scientify-bundle"
  | "runtime-scientify-invoke"
  | "runtime-research-vault-descriptor"
  | "runtime-research-vault-descriptor-callable"
  | "runtime-research-vault-source-pack-query"
  | "runtime-blisspixel-deepr-descriptor"
  | "runtime-blisspixel-deepr-descriptor-callable"
  | "runtime-live-mini-swe-agent"
  | "runtime-overview"
  | "runtime-capability-scaffold"
  | "serve"
  | "try"
  | "maintenance";

type FlagMap = Record<string, string[]>;

function printUsage() {
  process.stdout.write(`Directive Kernel Standalone Host CLI

Commands:
  init --output-root <path> [--host-name <name>] [--received-at <yyyy-mm-dd>] [--config-filename <name>] [--persistence-mode <filesystem|filesystem_and_sqlite>] [--auth-template <none|include>]
  acceptance-quickstart --output-root <path> [--host-name <name>] [--relative-output-path <path>] [--generated-at <iso>]
  discovery-submit (--directive-root <path> | --config <path>) --input-json-path <path> [--received-at <yyyy-mm-dd>] [--unresolved-gap-id <id> ...] [--persistence-sqlite-path <path>] [--dry-run] [--process-with-engine]
  discovery-overview (--directive-root <path> | --config <path>) [--max-entries <n>] [--received-at <yyyy-mm-dd>] [--persistence-sqlite-path <path>]
  engine-plan-progress (--directive-root <path> | --config <path>) --run-id <id> --plan <extraction|adaptation|improvement|proof> --item-type <type> [--index <n>] --status <pending|in_progress|completed|skipped> [--at <iso>] [--persistence-sqlite-path <path>]
  engine-reroute (--directive-root <path> | --config <path>) --run-id <id> --answers-json-path <path> [--received-at <iso>] [--persistence-sqlite-path <path>]
  engine-replay (--directive-root <path> | --config <path>) --run-id <id> [--answers-json-path <path>] [--mission-change-json-path <path>] [--received-at <iso>] [--persistence-sqlite-path <path>]
  mission-feedback (--directive-root <path> | --config <path>)
  mission-preview (--directive-root <path> | --config <path>) --feedback-id <id>
  mission-approve (--directive-root <path> | --config <path>) --feedback-id <id> --rationale <text> [--cascade-scope <none|low_confidence|conflicted|discovery_held>] [--run-id <id> ...]
  mission-reject (--directive-root <path> | --config <path>) --feedback-id <id> --rationale <text>
  mission-revert (--directive-root <path> | --config <path>) --rationale <text>
  mission-history (--directive-root <path> | --config <path>)
  gap-formalize (--directive-root <path> | --config <path>)
  gap-approve (--directive-root <path> | --config <path>) --formalization-id <id> --priority <high|medium|low> --rationale <text>
  gap-reject (--directive-root <path> | --config <path>) --formalization-id <id> --rationale <text>
  runtime-host-selection-resolve (--directive-root <path> | --config <path>) --promotion-readiness-path <path> --decision <select_standalone|select_web|confirm_inferred|override|defer> --rationale <text> [--selected-host <text>] [--reviewed-by <actor>] [--resolved-confidence <high|medium|low>] [--persistence-sqlite-path <path>]
  runtime-promotion-seam-resolve (--directive-root <path> | --config <path>) --promotion-readiness-path <path> --rationale <text> [--approved-by <actor>] [--persistence-sqlite-path <path>]
  runtime-registry-accept (--directive-root <path> | --config <path>) --promotion-record-path <path> --rationale <text> [--accepted-by <actor>] [--persistence-sqlite-path <path>]
  runtime-followup-write (--directive-root <path> | --config <path>) --input-json-path <path> [--persistence-sqlite-path <path>]
  runtime-record-write (--directive-root <path> | --config <path>) --input-json-path <path> [--persistence-sqlite-path <path>]
  runtime-proof-write (--directive-root <path> | --config <path>) --input-json-path <path> [--persistence-sqlite-path <path>]
  runtime-transformation-proof-write (--directive-root <path> | --config <path>) --input-json-path <path> [--persistence-sqlite-path <path>]
  runtime-transformation-record-write (--directive-root <path> | --config <path>) --input-json-path <path> [--persistence-sqlite-path <path>]
  runtime-promotion-write (--directive-root <path> | --config <path>) --input-json-path <path> [--persistence-sqlite-path <path>]
  runtime-registry-write (--directive-root <path> | --config <path>) --input-json-path <path> [--persistence-sqlite-path <path>]
  runtime-scientify-bundle (--directive-root <path> | --config <path>) [--persistence-sqlite-path <path>]
  runtime-scientify-invoke (--directive-root <path> | --config <path>) --tool <tool> --input-json-path <path> [--timeout-ms <n>] [--execution-at <iso>] [--persist-artifacts <true|false>] [--persistence-sqlite-path <path>]
  runtime-research-vault-descriptor (--directive-root <path> | --config <path>) [--persistence-sqlite-path <path>]
  runtime-research-vault-descriptor-callable (--directive-root <path> | --config <path>) [--include-open-decisions <true|false>] [--execution-at <iso>] [--persistence-sqlite-path <path>]
  runtime-research-vault-source-pack-query (--directive-root <path> | --config <path>) --query <text> [--include-evidence <true|false>] [--max-items <n>] [--timeout-ms <n>] [--execution-at <iso>] [--persist-artifacts <true|false>] [--persistence-sqlite-path <path>]
  runtime-blisspixel-deepr-descriptor (--directive-root <path> | --config <path>) [--persistence-sqlite-path <path>]
  runtime-blisspixel-deepr-descriptor-callable (--directive-root <path> | --config <path>) [--include-open-decisions <true|false>] [--execution-at <iso>] [--persistence-sqlite-path <path>]
  runtime-live-mini-swe-agent (--directive-root <path> | --config <path>) [--persistence-sqlite-path <path>]
  runtime-overview (--directive-root <path> | --config <path>) [--max-entries <n>] [--persistence-sqlite-path <path>]
  runtime-capability-scaffold --name <name> [--description <text>] [--capabilities-root <path>] [--overwrite]
  serve (--directive-root <path> | --config <path>) [--host <host>] [--port <port>] [--received-at <yyyy-mm-dd>] [--unresolved-gap-id <id> ...] [--auth-bearer-token <token>] [--persistence-sqlite-path <path>]
  try [--output-root <path>]
  maintenance archive --directive-root <path> [--max-age-days <n>] [--rotate-ledger] [--no-rotate-ledger] [--dry-run]
`);
}

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const flags: FlagMap = {};
  const flagWithoutValue = new Set(["dry-run", "process-with-engine", "no-rotate-ledger", "rotate-ledger", "overwrite"]);

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }

    const key = token.slice(2);
    const nextValue = rest[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      if (flagWithoutValue.has(key)) {
        flags[key] ??= [];
        flags[key].push("true");
        continue;
      }
      throw new Error(`Missing value for --${key}`);
    }

    flags[key] ??= [];
    flags[key].push(nextValue);
    index += 1;
  }

  return {
    command: command as CommandName | undefined,
    flags,
  };
}

function readRequiredFlag(flags: FlagMap, name: string) {
  const value = flags[name]?.[0];
  if (!value) {
    throw new Error(`Missing required flag --${name}`);
  }
  return value;
}

function readOptionalFlag(flags: FlagMap, name: string) {
  return flags[name]?.[0];
}

function readOptionalNumberFlag(flags: FlagMap, name: string) {
  const value = readOptionalFlag(flags, name);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid value for --${name}`);
  }
  return parsed;
}

function readRepeatedFlag(flags: FlagMap, name: string) {
  return flags[name] ?? [];
}

function buildPlanProgressUpdate(input: {
  plan: "extraction" | "adaptation" | "improvement" | "proof";
  itemType: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  index?: number;
}): EnginePlanProgressUpdate {
  const index = input.index;
  switch (input.plan) {
    case "extraction":
      if (
        (input.itemType === "extractedValue" || input.itemType === "excludedBaggage")
        && index !== undefined
      ) {
        return { plan: input.plan, itemType: input.itemType, index, status: input.status };
      }
      break;
    case "adaptation":
      if (input.itemType === "directiveOwnedForm" && index === undefined) {
        return { plan: input.plan, itemType: input.itemType, status: input.status };
      }
      if (input.itemType === "adaptedValue" && index !== undefined) {
        return { plan: input.plan, itemType: input.itemType, index, status: input.status };
      }
      break;
    case "improvement":
      if (input.itemType === "intendedDelta" && index === undefined) {
        return { plan: input.plan, itemType: input.itemType, status: input.status };
      }
      if (input.itemType === "improvementGoals" && index !== undefined) {
        return { plan: input.plan, itemType: input.itemType, index, status: input.status };
      }
      break;
    case "proof":
      if (
        (input.itemType === "objective" || input.itemType === "rollbackPrompt")
        && index === undefined
      ) {
        return { plan: input.plan, itemType: input.itemType, status: input.status };
      }
      if (
        (input.itemType === "requiredEvidence" || input.itemType === "requiredGates")
        && index !== undefined
      ) {
        return { plan: input.plan, itemType: input.itemType, index, status: input.status };
      }
      break;
  }

  throw new Error(`Invalid item type/index combination for --plan ${input.plan}`);
}



function readOptionalRuntimeConfig(
  flags: FlagMap,
  includeServerOverrides = false,
) {
  const configPath = readOptionalFlag(flags, "config");
  if (!configPath) {
    return null;
  }

  return applyStandaloneHostConfigOverrides(loadStandaloneHostConfig(configPath), {
    directiveRoot: readOptionalFlag(flags, "directive-root"),
    receivedAt: readOptionalFlag(flags, "received-at"),
    unresolvedGapIds: flags["unresolved-gap-id"]
      ? readRepeatedFlag(flags, "unresolved-gap-id")
      : undefined,
    authBearerToken: readOptionalFlag(flags, "auth-bearer-token"),
    persistenceSqlitePath: readOptionalFlag(flags, "persistence-sqlite-path"),
    host: includeServerOverrides ? readOptionalFlag(flags, "host") : undefined,
    port: includeServerOverrides
      ? readOptionalNumberFlag(flags, "port")
      : undefined,
  });
}

function createRuntimeHostFromFlags(
  flags: FlagMap,
  config: ResolvedStandaloneHostConfig | null,
) {
  if (config) {
    return createStandaloneFilesystemHostFromConfig(config);
  }

  return createStandaloneFilesystemHost({
    directiveRoot: readRequiredFlag(flags, "directive-root"),
    receivedAt: readOptionalFlag(flags, "received-at"),
    unresolvedGapIds: readRepeatedFlag(flags, "unresolved-gap-id"),
    persistence: readOptionalFlag(flags, "persistence-sqlite-path")
      ? {
          mode: "filesystem_and_sqlite",
          sqlitePath: readOptionalFlag(flags, "persistence-sqlite-path")!,
          sqlitePathSource: "override",
          experimentalRuntime: true,
        }
      : undefined,
  });
}

function resolveDirectiveRootFromFlags(
  flags: FlagMap,
  config: ResolvedStandaloneHostConfig | null,
) {
  return config?.directiveRoot ?? readRequiredFlag(flags, "directive-root");
}

interface MaintenanceFlags {
  [key: string]: string[] | undefined;
  "directive-root"?: string[];
  "max-age-days"?: string[];
  "dry-run"?: string[];
  "no-rotate-ledger"?: string[];
  "rotate-ledger"?: string[];
}

function parseMaintenanceFlags(args: string[]): MaintenanceFlags {
  const flags: MaintenanceFlags = {};
  const valueless = new Set(["dry-run", "no-rotate-ledger", "rotate-ledger"]);
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    const nextValue = args[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      if (valueless.has(key)) {
        flags[key] = ["true"];
        continue;
      }
      throw new Error(`Missing value for --${key}`);
    }
    flags[key] = [nextValue];
    index += 1;
  }
  return flags;
}

async function runMaintenanceArchiveCommand(flags: MaintenanceFlags): Promise<void> {
  const directiveRoot = flags["directive-root"]?.[0];
  if (!directiveRoot) throw new Error("Missing required flag --directive-root");

  const maxAgeDays = Number(flags["max-age-days"]?.[0] ?? 30);
  const dryRun = "dry-run" in flags;
  const rotateLedger = !("no-rotate-ledger" in flags);

  if (!dryRun) {
    acquireDirectiveRootLock(directiveRoot);
  }
  try {
    const beforeSummary = summarizeKernelStorage(directiveRoot);
    if (dryRun) {
      process.stdout.write(`${JSON.stringify({
        dry_run: true,
        before: beforeSummary,
        maxAgeDays,
        rotateLedger,
      }, null, 2)}\n`);
      return;
    }
    const { archivedCount, bytesMoved } = await archiveRunRecords(directiveRoot, { maxAgeDays });
    let rotatedSegments = 0;
    if (rotateLedger) {
      const { rotated } = await rotateDecisionPolicyLedger(directiveRoot);
      rotatedSegments = rotated ? 1 : 0;
    }
    const afterSummary = summarizeKernelStorage(directiveRoot);
    process.stdout.write(`archived ${archivedCount} run records, rotated ${rotatedSegments} ledger segments, total bytes moved ${bytesMoved}\n`);
  } finally {
    if (!dryRun) releaseDirectiveRootLock(directiveRoot);
  }
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === "maintenance") {
    const subcommand = rawArgs[1];
    if (!subcommand) {
      printUsage();
      process.exit(1);
    }
    if (subcommand !== "archive") {
      throw new Error(`Unknown maintenance subcommand: ${subcommand}`);
    }
    const flags = parseMaintenanceFlags(rawArgs.slice(2));
    await runMaintenanceArchiveCommand(flags);
    return;
  }

  const { command, flags } = parseArgs(rawArgs);
  if (!command) {
    printUsage();
    process.exit(1);
  }

  if (command === "init") {
    const persistenceMode =
      readOptionalFlag(flags, "persistence-mode") ?? "filesystem_and_sqlite";
    if (
      persistenceMode !== "filesystem"
      && persistenceMode !== "filesystem_and_sqlite"
    ) {
      throw new Error("Invalid value for --persistence-mode");
    }
    const authTemplate = readOptionalFlag(flags, "auth-template") ?? "none";
    if (authTemplate !== "none" && authTemplate !== "include") {
      throw new Error("Invalid value for --auth-template");
    }

    const outputRoot = readRequiredFlag(flags, "output-root");
    acquireDirectiveRootLock(outputRoot);
    try {
      const result = bootstrapStandaloneHostWorkspace({
        outputRoot,
        hostName: readOptionalFlag(flags, "host-name"),
        receivedAt: readOptionalFlag(flags, "received-at"),
        configFilename: readOptionalFlag(flags, "config-filename"),
        includeSqlitePersistence: persistenceMode === "filesystem_and_sqlite",
        includeAuthTemplate: authTemplate === "include",
      });

      process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    } finally {
      releaseDirectiveRootLock(outputRoot);
    }
    return;
  }

  if (command === "acceptance-quickstart") {
    const outputRoot = readRequiredFlag(flags, "output-root");
    acquireDirectiveRootLock(outputRoot);
    try {
      const hostName =
        readOptionalFlag(flags, "host-name") ?? DEFAULT_STANDALONE_HOST_NAME;
      const relativeOutputPath = readOptionalFlag(flags, "relative-output-path");
      const generatedAt = readOptionalFlag(flags, "generated-at");

      const result = await runStandaloneHostAcceptanceQuickstart({
        outputRoot,
        hostName,
        relativeOutputPath,
        generatedAt,
      });
      process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    } finally {
      releaseDirectiveRootLock(outputRoot);
    }
    return;
  }

  if (command === "discovery-submit") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    const dryRun = flags["dry-run"]?.[0] === "true";
    const processWithEngine = flags["process-with-engine"]?.[0] === "true";

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<DiscoverySubmissionRequest>(inputJsonPath);
      const result = processWithEngine
        ? await host.submitDiscoveryEntryWithEngine(request, dryRun)
        : await host.submitDiscoveryEntry(request, dryRun);

      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "discovery-overview") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    const maxEntriesRaw = readOptionalFlag(flags, "max-entries");
    const maxEntries = maxEntriesRaw ? Number(maxEntriesRaw) : undefined;

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const overview = host.readDiscoveryOverview(
        Number.isFinite(maxEntries) ? maxEntries : undefined,
      );

      process.stdout.write(`${JSON.stringify({ ok: true, overview }, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "mission-feedback") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    try {
      process.stdout.write(`${JSON.stringify({
        ok: true,
        activeEvolution: readActiveMissionEvolution({ directiveRoot }),
        entries: listMissionFeedbackEntries({ directiveRoot }),
      }, null, 2)}\n`);
    } finally {
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "engine-plan-progress") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const plan = readRequiredFlag(flags, "plan");
      if (
        plan !== "extraction"
        && plan !== "adaptation"
        && plan !== "improvement"
        && plan !== "proof"
      ) {
        throw new Error("Invalid value for --plan");
      }
      const status = readRequiredFlag(flags, "status");
      if (
        status !== "pending"
        && status !== "in_progress"
        && status !== "completed"
        && status !== "skipped"
      ) {
        throw new Error("Invalid value for --status");
      }

      const itemType = readRequiredFlag(flags, "item-type");
      const indexRaw = readOptionalFlag(flags, "index");
      const index = indexRaw == null ? undefined : Number(indexRaw);
      if (indexRaw != null && (index === undefined || !Number.isInteger(index) || index < 0)) {
        throw new Error("Invalid value for --index");
      }

      const update = buildPlanProgressUpdate({
        plan,
        itemType,
        index,
        status,
      });
      const result = await host.updateEnginePlanProgress({
        runId: readRequiredFlag(flags, "run-id"),
        updates: [update],
        at: readOptionalFlag(flags, "at") ?? null,
      });
      process.stdout.write(`${JSON.stringify({ ok: true, record: result }, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "engine-reroute") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const answers = readJson<Record<string, unknown>>(
        readRequiredFlag(flags, "answers-json-path"),
      );
      const result = await host.reRouteEngineRunWithAnswers({
        runId: readRequiredFlag(flags, "run-id"),
        answers,
        receivedAt: readOptionalFlag(flags, "received-at") ?? null,
      });
      process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "engine-replay") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const answersJsonPath = readOptionalFlag(flags, "answers-json-path");
      const missionChangeJsonPath = readOptionalFlag(flags, "mission-change-json-path");
      const result = await host.replayEngineRun({
        runId: readRequiredFlag(flags, "run-id"),
        replayInput: {
          answers: answersJsonPath
            ? readJson<Record<string, unknown>>(answersJsonPath)
            : null,
          missionChange: missionChangeJsonPath
            ? readJson<import("../../engine/types.ts").EngineMissionPreviewChange>(
              missionChangeJsonPath,
            )
            : null,
          receivedAt: readOptionalFlag(flags, "received-at") ?? null,
        },
      });
      process.stdout.write(`${JSON.stringify({ ok: true, replay: result }, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "mission-preview") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    try {
      const result = previewMissionFeedbackEntry({
        directiveRoot,
        feedbackId: readRequiredFlag(flags, "feedback-id"),
      });
      process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    } finally {
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "mission-approve") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    try {
      const cascadeScope = readOptionalFlag(flags, "cascade-scope") ?? "none";
      if (
        cascadeScope !== "none"
        && cascadeScope !== "low_confidence"
        && cascadeScope !== "conflicted"
        && cascadeScope !== "discovery_held"
      ) {
        throw new Error("Invalid value for --cascade-scope");
      }
      const result = approveMissionFeedbackEntry({
        directiveRoot,
        feedbackId: readRequiredFlag(flags, "feedback-id"),
        operatorRationale: readRequiredFlag(flags, "rationale"),
        approvedRunIds: readRepeatedFlag(flags, "run-id"),
        cascadeScope,
      });
      process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    } finally {
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "mission-reject") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    try {
      const result = rejectMissionFeedbackEntry({
        directiveRoot,
        feedbackId: readRequiredFlag(flags, "feedback-id"),
        operatorRationale: readRequiredFlag(flags, "rationale"),
      });
      process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    } finally {
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "mission-revert") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    try {
      const result = revertMissionEvolution({
        directiveRoot,
        operatorRationale: readRequiredFlag(flags, "rationale"),
      });
      process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
    } finally {
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "mission-history") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    try {
      process.stdout.write(`${JSON.stringify({
        ok: true,
        history: listMissionEvolutionHistory({ directiveRoot }),
      }, null, 2)}\n`);
    } finally {
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "gap-formalize") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    try {
      process.stdout.write(`${JSON.stringify({
        ok: true,
        pending: listPendingGapFormalizationCandidates({ directiveRoot }),
        history: listGapFormalizationRecords({ directiveRoot }),
      }, null, 2)}\n`);
    } finally {
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "gap-approve") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    try {
      const priority = readRequiredFlag(flags, "priority");
      if (priority !== "high" && priority !== "medium" && priority !== "low") {
        throw new Error("Invalid value for --priority");
      }
      const result = await approveGapFormalization({
        directiveRoot,
        formalizationId: readRequiredFlag(flags, "formalization-id"),
        operatorRationale: readRequiredFlag(flags, "rationale"),
        operatorApprovedPriority: priority,
      });
      const refreshedWorklist = refreshDiscoveryGapWorklist({
        directiveRoot,
      });
      process.stdout.write(`${JSON.stringify({ ok: true, ...result, refreshedWorklist }, null, 2)}\n`);
    } finally {
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "gap-reject") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    try {
      const result = rejectGapFormalization({
        directiveRoot,
        formalizationId: readRequiredFlag(flags, "formalization-id"),
        operatorRationale: readRequiredFlag(flags, "rationale"),
      });
      process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
    } finally {
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-host-selection-resolve") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const decision = readRequiredFlag(flags, "decision");
      if (
        decision !== "select_standalone"
        && decision !== "select_web"
        && decision !== "confirm_inferred"
        && decision !== "override"
        && decision !== "defer"
      ) {
        throw new Error("Invalid value for --decision");
      }
      const resolvedConfidence = readOptionalFlag(flags, "resolved-confidence");
      if (
        resolvedConfidence
        && resolvedConfidence !== "high"
        && resolvedConfidence !== "medium"
        && resolvedConfidence !== "low"
      ) {
        throw new Error("Invalid value for --resolved-confidence");
      }
      const result = await host.writeRuntimeHostSelectionResolution({
        promotionReadinessPath: readRequiredFlag(flags, "promotion-readiness-path"),
        decision,
        selectedHost: readOptionalFlag(flags, "selected-host") ?? "",
        rationale: readRequiredFlag(flags, "rationale"),
        reviewedBy: readOptionalFlag(flags, "reviewed-by") ?? "standalone-host-cli",
        resolvedConfidence: resolvedConfidence as "high" | "medium" | "low" | undefined,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-promotion-seam-resolve") {
    const promotionReadinessPath = readRequiredFlag(flags, "promotion-readiness-path");
    const rationale = readRequiredFlag(flags, "rationale");
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const result = await host.writeRuntimePromotionSeamDecision({
        promotionReadinessPath,
        rationale,
        approvedBy: readOptionalFlag(flags, "approved-by") ?? "standalone-host-cli",
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-registry-accept") {
    const promotionRecordPath = readRequiredFlag(flags, "promotion-record-path");
    const rationale = readRequiredFlag(flags, "rationale");
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const result = await host.writeRuntimeRegistryAcceptanceDecision({
        promotionRecordPath,
        rationale,
        acceptedBy: readOptionalFlag(flags, "accepted-by") ?? "standalone-host-cli",
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-followup-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<RuntimeFollowUpRecordRequest>(inputJsonPath);
      const result = await host.writeRuntimeFollowUp(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-record-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<RuntimeRecordRequest>(inputJsonPath);
      const result = await host.writeRuntimeRecord(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-promotion-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<RuntimePromotionRecordRequest>(inputJsonPath);
      const result = await host.writeRuntimePromotionRecord(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-proof-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<RuntimeProofBundleRequest>(inputJsonPath);
      const result = await host.writeRuntimeProofBundle(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-transformation-proof-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<RuntimeTransformationProofRequest>(inputJsonPath);
      const result = await host.writeRuntimeTransformationProof(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-transformation-record-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<RuntimeTransformationRecordRequest>(inputJsonPath);
      const result = await host.writeRuntimeTransformationRecord(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-registry-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = migrateRegistryEntryVerification(
        readJson<RuntimeRegistryEntryRequest>(inputJsonPath),
      );
      const result = await host.writeRuntimeRegistryEntry(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-overview") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    const maxEntriesRaw = readOptionalFlag(flags, "max-entries");
    const maxEntries = maxEntriesRaw ? Number(maxEntriesRaw) : undefined;

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const overview = await host.readRuntimeOverview(
        Number.isFinite(maxEntries) ? maxEntries : undefined,
      );
      process.stdout.write(`${JSON.stringify({ ok: true, overview }, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-capability-scaffold") {
    const capabilitiesRoot = readOptionalFlag(flags, "capabilities-root")
      ?? "runtime/capabilities";
    const result = writeRuntimeCapabilityScaffold({
      capabilitiesRoot,
      name: readRequiredFlag(flags, "name"),
      description: readOptionalFlag(flags, "description"),
      overwrite: flags["overwrite"]?.[0] === "true",
    });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    return;
  }

  if (command === "runtime-scientify-bundle") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const descriptor = await host.readScientifyLiteratureAccessBundle();
      process.stdout.write(`${JSON.stringify({ ok: true, descriptor }, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-scientify-invoke") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    const timeoutMsRaw = readOptionalFlag(flags, "timeout-ms");
    const timeoutMs = timeoutMsRaw ? Number(timeoutMsRaw) : undefined;
    if (timeoutMsRaw && (timeoutMs === undefined || !Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
      throw new Error("Invalid value for --timeout-ms");
    }
    const persistArtifactsRaw = readOptionalFlag(flags, "persist-artifacts");
    if (
      persistArtifactsRaw
      && persistArtifactsRaw !== "true"
      && persistArtifactsRaw !== "false"
    ) {
      throw new Error("Invalid value for --persist-artifacts");
    }

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const input = readJson<Record<string, unknown>>(
        readRequiredFlag(flags, "input-json-path"),
      );
      const result = await host.invokeScientifyLiteratureAccessTool({
        tool: readRequiredFlag(flags, "tool") as
          | "arxiv-search"
          | "arxiv-download"
          | "openalex-search"
          | "unpaywall-download",
        input,
        timeoutMs,
        executionAt: readOptionalFlag(flags, "execution-at"),
        persistArtifacts: persistArtifactsRaw
          ? persistArtifactsRaw === "true"
          : undefined,
      });
      process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-research-vault-descriptor") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const descriptor = await host.readResearchVaultDescriptor();
      process.stdout.write(`${JSON.stringify({ ok: true, descriptor }, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-research-vault-descriptor-callable") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    const includeOpenDecisionsRaw = readOptionalFlag(flags, "include-open-decisions");
    if (
      includeOpenDecisionsRaw
      && includeOpenDecisionsRaw !== "true"
      && includeOpenDecisionsRaw !== "false"
    ) {
      throw new Error("Invalid value for --include-open-decisions");
    }
    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const result = await host.invokeResearchVaultDescriptorCallable({
        action: "summarize_descriptor",
        includeOpenDecisions: includeOpenDecisionsRaw
          ? includeOpenDecisionsRaw === "true"
          : undefined,
        executedAt: readOptionalFlag(flags, "execution-at"),
      });
      process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-research-vault-source-pack-query") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    const includeEvidenceRaw = readOptionalFlag(flags, "include-evidence");
    if (
      includeEvidenceRaw
      && includeEvidenceRaw !== "true"
      && includeEvidenceRaw !== "false"
    ) {
      throw new Error("Invalid value for --include-evidence");
    }
    const persistArtifactsRaw = readOptionalFlag(flags, "persist-artifacts");
    if (
      persistArtifactsRaw
      && persistArtifactsRaw !== "true"
      && persistArtifactsRaw !== "false"
    ) {
      throw new Error("Invalid value for --persist-artifacts");
    }
    const maxItems = readOptionalNumberFlag(flags, "max-items");
    if (maxItems !== undefined && (maxItems < 1 || maxItems > 5)) {
      throw new Error("Invalid value for --max-items");
    }
    const timeoutMs = readOptionalNumberFlag(flags, "timeout-ms");
    if (timeoutMs !== undefined && timeoutMs < 1) {
      throw new Error("Invalid value for --timeout-ms");
    }
    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const result = await host.invokeResearchVaultSourcePackTool({
        tool: "query-source-pack",
        input: {
          query: readRequiredFlag(flags, "query"),
          includeEvidence: includeEvidenceRaw
            ? includeEvidenceRaw === "true"
            : undefined,
          maxItems,
        },
        timeoutMs,
        executionAt: readOptionalFlag(flags, "execution-at"),
        persistArtifacts: persistArtifactsRaw
          ? persistArtifactsRaw === "true"
          : undefined,
      });
      process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-blisspixel-deepr-descriptor") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const descriptor = await host.readBlisspixelDeeprDescriptor();
      process.stdout.write(`${JSON.stringify({ ok: true, descriptor }, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-blisspixel-deepr-descriptor-callable") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    const includeOpenDecisionsRaw = readOptionalFlag(flags, "include-open-decisions");
    if (
      includeOpenDecisionsRaw
      && includeOpenDecisionsRaw !== "true"
      && includeOpenDecisionsRaw !== "false"
    ) {
      throw new Error("Invalid value for --include-open-decisions");
    }
    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const result = await host.invokeBlisspixelDeeprDescriptorCallable({
        action: "summarize_descriptor",
        includeOpenDecisions: includeOpenDecisionsRaw
          ? includeOpenDecisionsRaw === "true"
          : undefined,
        executedAt: readOptionalFlag(flags, "execution-at"),
      });
      process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "runtime-live-mini-swe-agent") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);

    acquireDirectiveRootLock(directiveRoot);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const descriptor = await host.readLiveMiniSweAgentDescriptor();
      process.stdout.write(`${JSON.stringify({ ok: true, descriptor }, null, 2)}\n`);
    } finally {
      host.close();
      releaseDirectiveRootLock(directiveRoot);
    }
    return;
  }

  if (command === "serve") {
    const runtimeConfig = readOptionalRuntimeConfig(flags, true);
    const directiveRoot =
      runtimeConfig?.directiveRoot ?? readRequiredFlag(flags, "directive-root");
    const bindHost = readOptionalFlag(flags, "host");
    const port = readOptionalNumberFlag(flags, "port");

    const handle = runtimeConfig
      ? await startFromConfig(runtimeConfig)
      : await start({
          directiveRoot,
          host: bindHost,
          port,
          receivedAt: readOptionalFlag(flags, "received-at"),
          unresolvedGapIds: readRepeatedFlag(flags, "unresolved-gap-id"),
          auth: readOptionalFlag(flags, "auth-bearer-token")
            ? {
                mode: "static_bearer",
                bearerToken: readOptionalFlag(flags, "auth-bearer-token")!,
                bearerTokenSource: "override",
                protectedRoutePrefixes: ["/api/"],
              }
            : undefined,
          persistence: readOptionalFlag(flags, "persistence-sqlite-path")
            ? {
                mode: "filesystem_and_sqlite",
                sqlitePath: readOptionalFlag(flags, "persistence-sqlite-path")!,
                sqlitePathSource: "override",
                experimentalRuntime: true,
              }
            : undefined,
        });

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          mode: "serving",
          origin: handle.origin,
          directiveRoot,
          runtimeArtifactsRoot: handle.runtimeArtifactsRoot,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (command === "try") {
    const outputRoot = readOptionalFlag(flags, "output-root") ?? null;
    if (outputRoot) {
      acquireDirectiveRootLock(outputRoot);
    }
    try {
      const result = await runStandaloneHostTryCommand({ outputRoot });
      process.stdout.write(`${formatTryCommandOutput(result)}\n`);
    } finally {
      if (outputRoot) {
        releaseDirectiveRootLock(outputRoot);
      }
    }
    return;
  }

  throw new Error(`Unsupported command: ${String(command)}`);
}

main().catch((error) => {
  process.stderr.write(`${String((error as Error).message || error)}\n`);
  process.exit(1);
});
