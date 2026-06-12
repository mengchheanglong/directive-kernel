import { startDirectiveUiServer } from "./server.ts";
import { readDirectiveFrontendSnapshot } from "./data/snapshot.ts";
import { buildOperatorDecisionInboxReport } from "../../engine/orchestration/operator-decision-inbox/operator-decision-inbox.ts";
import {
  acquireDirectiveRootLock,
  releaseDirectiveRootLock,
} from "../../shared/lib/process-lock.ts";
import { archiveRunRecords, rotateDecisionPolicyLedger, summarizeKernelStorage } from "../../engine/maintenance/archive.ts";
import fs from "node:fs";
import path from "node:path";

function printUsage() {
  process.stdout.write(`Directive Kernel UI CLI

Commands:
  serve [--directive-root <path>] [--host <host>] [--port <port>]
  maintenance archive --directive-root <path> [--max-age-days <n>] [--rotate-ledger] [--no-rotate-ledger] [--dry-run]

Environment variables (overridden by explicit flags):
  DIRECTIVE_UI_HOST, DIRECTIVE_FRONTEND_HOST     default host
  DIRECTIVE_UI_PORT, DIRECTIVE_FRONTEND_PORT     default port
`);
}

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const flags: Record<string, string> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    flags[key] = value;
    index += 1;
  }

  return {
    command,
    flags,
  };
}

async function runMaintenanceArchiveCommand(args: string[]): Promise<void> {
  const flags: Record<string, string> = {};
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
        flags[key] = "true";
        continue;
      }
      throw new Error(`Missing value for --${key}`);
    }
    flags[key] = nextValue;
    index += 1;
  }

  const directiveRoot = String(flags["directive-root"] || "");
  if (!directiveRoot) throw new Error("Missing required flag --directive-root");

  const maxAgeDays = Number(flags["max-age-days"] ?? 30);
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
    await runMaintenanceArchiveCommand(rawArgs.slice(2));
    return;
  }

  const { command, flags } = parseArgs(rawArgs);
  if (command !== "serve") {
    printUsage();
    process.exit(1);
  }

  const directiveRoot = String(flags["directive-root"] || process.cwd()).trim();

  const hostFlag = flags.host
    || process.env.DIRECTIVE_UI_HOST
    || process.env.DIRECTIVE_FRONTEND_HOST
    || "127.0.0.1";

  const portFlag = flags.port
    || process.env.DIRECTIVE_UI_PORT
    || process.env.DIRECTIVE_FRONTEND_PORT;
  const port = portFlag ? Number(portFlag) : undefined;
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) {
    throw new Error("Invalid value for --port");
  }

  try {
    acquireDirectiveRootLock(directiveRoot);
  } catch (error) {
    process.stderr.write(`${String((error as Error).message || error)}\n`);
    process.exit(1);
  }

  // Pre-compute static snapshot so the dashboard loads instantly
  const UI_DIR = path.resolve(directiveRoot, "..", "..", "systems", "directive-kernel", "ui");
  const SNAPSHOT_PATH = path.join(UI_DIR, "snapshot.json");
  const REFRESH_MS = 60_000;

  function refreshSnapshot() {
    try {
      const full = readDirectiveFrontendSnapshot({ directiveRoot, maxRuns: 200, maxQueueEntries: 500, maxHandoffs: 250 });
      // Only keep what the dashboard uses — strip handoffStubs (huge) and keep queue + runtime/architecture summaries
      const light = {
        queue: {
          totalEntries: full.queue.totalEntries,
          entries: (full.queue.entries || []).map((e: any) => ({
            candidate_id: e.candidate_id,
            candidate_name: e.candidate_name,
            routing_target: e.routing_target,
            source_reference: e.source_reference,
            status: e.status,
          })),
        },
        runtimeSummary: { activeCases: (full.runtimeSummary?.activeCases || []).map((c: any) => ({
          candidate_name: c.candidate_name, candidate_id: c.candidate_id,
        })) },
        architectureSummary: { activeCases: (full.architectureSummary?.activeCases || []).map((c: any) => ({
          candidate_name: c.candidate_name, candidate_id: c.candidate_id,
        })) },
      };
      fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
      fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(light));
    } catch (err) {
      process.stderr.write(`[snapshot] error: ${(err as Error).message}\n`);
    }
  }

  refreshSnapshot();
  // No auto-refresh — snapshot is static until server restart.
  // The 60s recompute blocks the event loop for 60-90s.

  const handle = await startDirectiveUiServer({
    directiveRoot,
    host: hostFlag,
    port,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        directiveRoot: handle.directiveRoot,
        origin: handle.origin,
        host: handle.host,
        port: handle.port,
      },
      null,
      2,
    )}\n`,
  );

  const close = async () => {
    await handle.close();
    releaseDirectiveRootLock(directiveRoot);
    process.exit(0);
  };
  process.on("SIGINT", () => void close());
  process.on("SIGTERM", () => void close());
}

void main();
