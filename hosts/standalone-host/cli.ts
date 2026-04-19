import { readJson } from "../../shared/lib/file-io.ts";
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
} from "../../engine/index.ts";
import { refreshDiscoveryGapWorklist } from "../../discovery/lib/discovery-gap-worklist-refresh.ts";

import type { DiscoverySubmissionRequest } from "../../discovery/lib/discovery-submission-router.ts";
import type { RuntimeFollowUpRecordRequest } from "../../runtime/lib/runtime-follow-up-record-writer.ts";
import type { RuntimeProofBundleRequest } from "../../runtime/lib/runtime-proof-bundle-writer.ts";
import type { RuntimePromotionRecordRequest } from "../../runtime/lib/runtime-promotion-record-writer.ts";
import type { RuntimeRegistryEntryRequest } from "../../runtime/lib/runtime-registry-entry-writer.ts";
import type { RuntimeRecordRequest } from "../../runtime/lib/runtime-record-writer.ts";
import type { RuntimeTransformationProofRequest } from "../../runtime/lib/runtime-transformation-proof-writer.ts";
import type { RuntimeTransformationRecordRequest } from "../../runtime/lib/runtime-transformation-record-writer.ts";
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
  startStandaloneHostServer,
  startStandaloneHostServerFromConfig,
} from "./server.ts";

type CommandName =
  | "init"
  | "acceptance-quickstart"
  | "discovery-submit"
  | "discovery-overview"
  | "mission-feedback"
  | "mission-preview"
  | "mission-approve"
  | "mission-reject"
  | "mission-revert"
  | "mission-history"
  | "gap-formalize"
  | "gap-approve"
  | "gap-reject"
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
  | "serve";

type FlagMap = Record<string, string[]>;

function printUsage() {
  process.stdout.write(`Directive Kernel Standalone Host CLI

Commands:
  init --output-root <path> [--host-name <name>] [--received-at <yyyy-mm-dd>] [--config-filename <name>] [--persistence-mode <filesystem|filesystem_and_sqlite>] [--auth-template <none|include>]
  acceptance-quickstart --output-root <path> [--host-name <name>] [--relative-output-path <path>] [--generated-at <iso>]
  discovery-submit (--directive-root <path> | --config <path>) --input-json-path <path> [--received-at <yyyy-mm-dd>] [--unresolved-gap-id <id> ...] [--persistence-sqlite-path <path>] [--dry-run] [--process-with-engine]
  discovery-overview (--directive-root <path> | --config <path>) [--max-entries <n>] [--received-at <yyyy-mm-dd>] [--persistence-sqlite-path <path>]
  mission-feedback (--directive-root <path> | --config <path>)
  mission-preview (--directive-root <path> | --config <path>) --feedback-id <id>
  mission-approve (--directive-root <path> | --config <path>) --feedback-id <id> --rationale <text> [--cascade-scope <none|low_confidence|conflicted|discovery_held>] [--run-id <id> ...]
  mission-reject (--directive-root <path> | --config <path>) --feedback-id <id> --rationale <text>
  mission-revert (--directive-root <path> | --config <path>) --rationale <text>
  mission-history (--directive-root <path> | --config <path>)
  gap-formalize (--directive-root <path> | --config <path>)
  gap-approve (--directive-root <path> | --config <path>) --formalization-id <id> --priority <high|medium|low> --rationale <text>
  gap-reject (--directive-root <path> | --config <path>) --formalization-id <id> --rationale <text>
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
  serve (--directive-root <path> | --config <path>) [--host <host>] [--port <port>] [--received-at <yyyy-mm-dd>] [--unresolved-gap-id <id> ...] [--auth-bearer-token <token>] [--persistence-sqlite-path <path>]
`);
}

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const flags: FlagMap = {};
  const flagWithoutValue = new Set(["dry-run", "process-with-engine"]);

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

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
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

    const result = bootstrapStandaloneHostWorkspace({
      outputRoot: readRequiredFlag(flags, "output-root"),
      hostName: readOptionalFlag(flags, "host-name"),
      receivedAt: readOptionalFlag(flags, "received-at"),
      configFilename: readOptionalFlag(flags, "config-filename"),
      includeSqlitePersistence: persistenceMode === "filesystem_and_sqlite",
      includeAuthTemplate: authTemplate === "include",
    });

    process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    return;
  }

  if (command === "acceptance-quickstart") {
    const outputRoot = readRequiredFlag(flags, "output-root");
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
    return;
  }

  if (command === "discovery-submit") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const dryRun = flags["dry-run"]?.[0] === "true";
    const processWithEngine = flags["process-with-engine"]?.[0] === "true";

    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<DiscoverySubmissionRequest>(inputJsonPath);
      const result = processWithEngine
        ? await host.submitDiscoveryEntryWithEngine(request, dryRun)
        : await host.submitDiscoveryEntry(request, dryRun);

      process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    } finally {
      host.close();
    }
    return;
  }

  if (command === "discovery-overview") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const maxEntriesRaw = readOptionalFlag(flags, "max-entries");
    const maxEntries = maxEntriesRaw ? Number(maxEntriesRaw) : undefined;

    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const overview = host.readDiscoveryOverview(
        Number.isFinite(maxEntries) ? maxEntries : undefined,
      );

      process.stdout.write(`${JSON.stringify({ ok: true, overview }, null, 2)}\n`);
    } finally {
      host.close();
    }
    return;
  }

  if (command === "mission-feedback") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      activeEvolution: readActiveMissionEvolution({ directiveRoot }),
      entries: listMissionFeedbackEntries({ directiveRoot }),
    }, null, 2)}\n`);
    return;
  }

  if (command === "mission-preview") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    const result = previewMissionFeedbackEntry({
      directiveRoot,
      feedbackId: readRequiredFlag(flags, "feedback-id"),
    });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    return;
  }

  if (command === "mission-approve") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
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
    return;
  }

  if (command === "mission-reject") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    const result = rejectMissionFeedbackEntry({
      directiveRoot,
      feedbackId: readRequiredFlag(flags, "feedback-id"),
      operatorRationale: readRequiredFlag(flags, "rationale"),
    });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    return;
  }

  if (command === "mission-revert") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    const result = revertMissionEvolution({
      directiveRoot,
      operatorRationale: readRequiredFlag(flags, "rationale"),
    });
    process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
    return;
  }

  if (command === "mission-history") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      history: listMissionEvolutionHistory({ directiveRoot }),
    }, null, 2)}\n`);
    return;
  }

  if (command === "gap-formalize") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      pending: listPendingGapFormalizationCandidates({ directiveRoot }),
      history: listGapFormalizationRecords({ directiveRoot }),
    }, null, 2)}\n`);
    return;
  }

  if (command === "gap-approve") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    const priority = readRequiredFlag(flags, "priority");
    if (priority !== "high" && priority !== "medium" && priority !== "low") {
      throw new Error("Invalid value for --priority");
    }
    const result = approveGapFormalization({
      directiveRoot,
      formalizationId: readRequiredFlag(flags, "formalization-id"),
      operatorRationale: readRequiredFlag(flags, "rationale"),
      operatorApprovedPriority: priority,
    });
    const refreshedWorklist = refreshDiscoveryGapWorklist({
      directiveRoot,
    });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result, refreshedWorklist }, null, 2)}\n`);
    return;
  }

  if (command === "gap-reject") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const directiveRoot = resolveDirectiveRootFromFlags(flags, runtimeConfig);
    const result = rejectGapFormalization({
      directiveRoot,
      formalizationId: readRequiredFlag(flags, "formalization-id"),
      operatorRationale: readRequiredFlag(flags, "rationale"),
    });
    process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
    return;
  }

  if (command === "runtime-followup-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);

    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<RuntimeFollowUpRecordRequest>(inputJsonPath);
      const result = await host.writeRuntimeFollowUp(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
    }
    return;
  }

  if (command === "runtime-record-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);

    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<RuntimeRecordRequest>(inputJsonPath);
      const result = await host.writeRuntimeRecord(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
    }
    return;
  }

  if (command === "runtime-promotion-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);

    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<RuntimePromotionRecordRequest>(inputJsonPath);
      const result = await host.writeRuntimePromotionRecord(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
    }
    return;
  }

  if (command === "runtime-proof-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);

    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<RuntimeProofBundleRequest>(inputJsonPath);
      const result = await host.writeRuntimeProofBundle(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
    }
    return;
  }

  if (command === "runtime-transformation-proof-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);

    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<RuntimeTransformationProofRequest>(inputJsonPath);
      const result = await host.writeRuntimeTransformationProof(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
    }
    return;
  }

  if (command === "runtime-transformation-record-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);

    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<RuntimeTransformationRecordRequest>(inputJsonPath);
      const result = await host.writeRuntimeTransformationRecord(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
    }
    return;
  }

  if (command === "runtime-registry-write") {
    const inputJsonPath = readRequiredFlag(flags, "input-json-path");
    const runtimeConfig = readOptionalRuntimeConfig(flags);

    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const request = readJson<RuntimeRegistryEntryRequest>(inputJsonPath);
      const result = await host.writeRuntimeRegistryEntry(request);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
      host.close();
    }
    return;
  }

  if (command === "runtime-overview") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const maxEntriesRaw = readOptionalFlag(flags, "max-entries");
    const maxEntries = maxEntriesRaw ? Number(maxEntriesRaw) : undefined;

    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const overview = await host.readRuntimeOverview(
        Number.isFinite(maxEntries) ? maxEntries : undefined,
      );
      process.stdout.write(`${JSON.stringify({ ok: true, overview }, null, 2)}\n`);
    } finally {
      host.close();
    }
    return;
  }

  if (command === "runtime-scientify-bundle") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);

    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const descriptor = await host.readScientifyLiteratureAccessBundle();
      process.stdout.write(`${JSON.stringify({ ok: true, descriptor }, null, 2)}\n`);
    } finally {
      host.close();
    }
    return;
  }

  if (command === "runtime-scientify-invoke") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const timeoutMsRaw = readOptionalFlag(flags, "timeout-ms");
    const timeoutMs = timeoutMsRaw ? Number(timeoutMsRaw) : undefined;
    if (timeoutMsRaw && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
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
    }
    return;
  }

  if (command === "runtime-research-vault-descriptor") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const descriptor = await host.readResearchVaultDescriptor();
      process.stdout.write(`${JSON.stringify({ ok: true, descriptor }, null, 2)}\n`);
    } finally {
      host.close();
    }
    return;
  }

  if (command === "runtime-research-vault-descriptor-callable") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const includeOpenDecisionsRaw = readOptionalFlag(flags, "include-open-decisions");
    if (
      includeOpenDecisionsRaw
      && includeOpenDecisionsRaw !== "true"
      && includeOpenDecisionsRaw !== "false"
    ) {
      throw new Error("Invalid value for --include-open-decisions");
    }
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
    }
    return;
  }

  if (command === "runtime-research-vault-source-pack-query") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
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
    }
    return;
  }

  if (command === "runtime-blisspixel-deepr-descriptor") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const descriptor = await host.readBlisspixelDeeprDescriptor();
      process.stdout.write(`${JSON.stringify({ ok: true, descriptor }, null, 2)}\n`);
    } finally {
      host.close();
    }
    return;
  }

  if (command === "runtime-blisspixel-deepr-descriptor-callable") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);
    const includeOpenDecisionsRaw = readOptionalFlag(flags, "include-open-decisions");
    if (
      includeOpenDecisionsRaw
      && includeOpenDecisionsRaw !== "true"
      && includeOpenDecisionsRaw !== "false"
    ) {
      throw new Error("Invalid value for --include-open-decisions");
    }
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
    }
    return;
  }

  if (command === "runtime-live-mini-swe-agent") {
    const runtimeConfig = readOptionalRuntimeConfig(flags);

    const host = createRuntimeHostFromFlags(flags, runtimeConfig);
    try {
      const descriptor = await host.readLiveMiniSweAgentDescriptor();
      process.stdout.write(`${JSON.stringify({ ok: true, descriptor }, null, 2)}\n`);
    } finally {
      host.close();
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
      ? await startStandaloneHostServerFromConfig(runtimeConfig)
      : await startStandaloneHostServer({
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

    const shutdown = async () => {
      await handle.close();
      process.exit(0);
    };

    process.on("SIGINT", () => {
      void shutdown();
    });
    process.on("SIGTERM", () => {
      void shutdown();
    });
    return;
  }

  throw new Error(`Unsupported command: ${String(command)}`);
}

main().catch((error) => {
  process.stderr.write(`${String((error as Error).message || error)}\n`);
  process.exit(1);
});
