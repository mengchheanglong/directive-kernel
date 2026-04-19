import fs from "node:fs";
import path from "node:path";
import { readJson } from "../../../shared/lib/file-io.ts";
import { fileURLToPath } from "node:url";

import {
  createMemoryDiscoveryHostStorageBridge,
} from "../lib/discovery-host-storage-bridge.memory.ts";
import {
  submitDiscoveryEntryWithHostBridge,
  type DiscoveryHostStorageBridge,
} from "../lib/discovery-submission-adapter.ts";
import {
  runHostIntegrationAcceptanceQuickstart,
} from "../lib/run-host-integration-acceptance-quickstart.ts";
import type { DiscoverySubmissionRequest } from "../../../discovery/lib/discovery-submission-router.ts";

type CommandName =
  | "acceptance-quickstart"
  | "submission-memory-dry-run"
  | "print-submission-example";

type FlagMap = Record<string, string[]>;

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const integrationKitRoot = path.resolve(currentDirectory, "..");
const examplesRoot = path.resolve(integrationKitRoot, "examples");

function printUsage() {
  process.stdout.write(`Directive Kernel Host Integration Kit CLI

Commands:
  acceptance-quickstart --host-name <name> --module-surface <package_import|starter_copy|mixed> --output-root <path> [--relative-output-path <path>] [--generated-at <iso>]
  submission-memory-dry-run --input-json-path <path> [--directive-root <path>] [--received-at <yyyy-mm-dd>] [--unresolved-gap-id <id> ...]
  print-submission-example --shape <front_door|queue_only|fast_path|split_case>
`);
}

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const flags: FlagMap = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    const nextValue = rest[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
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

function readRepeatedFlag(flags: FlagMap, name: string) {
  return flags[name] ?? [];
}



function resolveSubmissionExamplePath(shape: string) {
  const fileNameByShape: Record<string, string> = {
    front_door: "discovery-submission-front-door.json",
    queue_only: "discovery-submission-queue-only.json",
    fast_path: "discovery-submission-fast-path.json",
    split_case: "discovery-submission-split-case.json",
  };
  const fileName = fileNameByShape[shape];
  if (!fileName) {
    throw new Error(`Unsupported submission example shape: ${shape}`);
  }
  return path.resolve(examplesRoot, fileName);
}

async function handleAcceptanceQuickstart(flags: FlagMap) {
  const hostName = readRequiredFlag(flags, "host-name");
  const moduleSurface = readRequiredFlag(flags, "module-surface") as
    | "package_import"
    | "starter_copy"
    | "mixed";
  const outputRoot = readRequiredFlag(flags, "output-root");
  const relativeOutputPath = readOptionalFlag(flags, "relative-output-path");
  const generatedAt = readOptionalFlag(flags, "generated-at");

  const result = await runHostIntegrationAcceptanceQuickstart({
    hostName,
    moduleSurface,
    outputRoot,
    relativeOutputPath,
    generatedAt,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        command: "acceptance-quickstart",
        outputPath: result.outputPath,
        report: result.report,
      },
      null,
      2,
    )}\n`,
  );
}

function createSubmissionMemoryBridge(flags: FlagMap): {
  bridge: DiscoveryHostStorageBridge;
  queuePath: string;
} {
  const directiveRoot =
    readOptionalFlag(flags, "directive-root") ?? "C:/example/directive-workspace";
  const receivedAt = readOptionalFlag(flags, "received-at");
  const unresolvedGapIds = readRepeatedFlag(flags, "unresolved-gap-id");
  const harness = createMemoryDiscoveryHostStorageBridge({
    directiveRoot,
    receivedAt,
    unresolvedGapIds,
  });

  return {
    bridge: harness.bridge,
    queuePath: path.resolve(directiveRoot, "discovery", "intake-queue.json"),
  };
}

async function handleSubmissionMemoryDryRun(flags: FlagMap) {
  const inputJsonPath = readRequiredFlag(flags, "input-json-path");
  const request = readJson<DiscoverySubmissionRequest>(inputJsonPath);
  const { bridge } = createSubmissionMemoryBridge(flags);
  const result = await submitDiscoveryEntryWithHostBridge({
    request,
    storage: bridge,
    dryRun: true,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        command: "submission-memory-dry-run",
        inputJsonPath,
        result,
      },
      null,
      2,
    )}\n`,
  );
}

function handlePrintSubmissionExample(flags: FlagMap) {
  const shape = readRequiredFlag(flags, "shape");
  const examplePath = resolveSubmissionExamplePath(shape);
  const payload = readJson<Record<string, unknown>>(examplePath);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        command: "print-submission-example",
        shape,
        examplePath,
        payload,
      },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command) {
    printUsage();
    process.exit(1);
  }

  switch (command) {
    case "acceptance-quickstart":
      await handleAcceptanceQuickstart(flags);
      return;
    case "submission-memory-dry-run":
      await handleSubmissionMemoryDryRun(flags);
      return;
    case "print-submission-example":
      handlePrintSubmissionExample(flags);
      return;
    default:
      printUsage();
      throw new Error(`Unsupported command: ${String(command)}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
