import path from "node:path";
import { fileURLToPath } from "node:url";

import { readJson } from "../../../shared/lib/file-io.ts";
import {
  runFirstHostIntegrationFlow,
  type FirstHostGoalEnvelopeInput,
  type FirstHostSourceInput,
} from "../lib/first-host-integration.ts";

function parseArgs(argv: string[]) {
  const flags: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    flags[key] = value;
    index += 1;
  }
  return flags;
}

const EXAMPLES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
);

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const directiveRoot = path.resolve(
    flags["directive-root"] || "./local/first-consuming-host-example/directive-root",
  );
  const goalPath = path.resolve(
    flags["goal-json-path"] || path.join(EXAMPLES_ROOT, "first-consuming-host-goal-envelope.json"),
  );
  const sourcePath = path.resolve(
    flags["source-json-path"] || path.join(EXAMPLES_ROOT, "first-consuming-host-source.json"),
  );

  const goal = readJson<FirstHostGoalEnvelopeInput>(goalPath);
  const source = readJson<FirstHostSourceInput>(sourcePath);

  const result = await runFirstHostIntegrationFlow({
    directiveRoot,
    goal,
    source,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        directiveRoot,
        goalSource: result.goalResolution.source,
        submittedCandidateId: result.request.candidate_id,
        selectedLane: result.submission.engine.record.selectedLane.laneId,
        decisionState: result.submission.engine.record.decision.decisionState,
        routingRecordPath: result.submission.createdPaths.routingRecordPath,
        engineRunRecordPath: result.submission.engine.recordRelativePath,
        queueEntries: result.snapshot.discoveryOverview.totalEntries,
        actionableInboxEntries: result.snapshot.operatorInbox.summary.totalActionableEntries,
        focusArtifact: result.snapshot.workspaceState.focus?.artifactPath ?? null,
      },
      null,
      2,
    )}\n`,
  );
}

void main();
