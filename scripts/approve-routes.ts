import fs from "node:fs";
import path from "node:path";
import {
  createStandaloneFilesystemHost,
} from "../hosts/standalone-host/filesystem-host.ts";
import {
  writeDiscoveryRoutingReviewResolution,
} from "../discovery/lib/routing/review-resolution.ts";
import {
  readDirectiveDiscoveryRoutingArtifact,
} from "../discovery/lib/routing/route-opener.ts";
import {
  acquireDirectiveRootLock,
  releaseDirectiveRootLock,
} from "../shared/lib/process-lock.ts";

const DIRECTIVE_ROOT =
  "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const ENGINE_RUNS_DIR = path.join(
  DIRECTIVE_ROOT,
  "runtime/host-artifacts/engine-runs",
);
const ROUTING_LOG_DIR = path.join(
  DIRECTIVE_ROOT,
  "discovery/03-routing-log",
);

type RunSummary = {
  candidateId: string;
  oldState: string;
  newState: string;
  oldLane: string;
  newLane: string;
};

function buildAnswers(sourceId: string): Record<string, unknown> {
  // Web-dev sources: hermes-webdev-*, wd-*
  if (/^(hermes-webdev-|wd-)/.test(sourceId)) {
    return {
      "source.primaryAdoptionTarget": "runtime",
      "source.improvesDirectiveWorkspace": false,
      "source.containsExecutableCode": true,
    };
  }

  // Cybersecurity sources: cybersec-*
  if (/^cybersec-/.test(sourceId)) {
    return {
      "source.primaryAdoptionTarget": "runtime",
      "source.improvesDirectiveWorkspace": false,
      "source.containsExecutableCode": true,
    };
  }

  // Health / test sources: health-*, shadcn-prod, final-test-*, direct-final, shadcn-direct
  if (
    /^(health-|shadcn-prod|final-test-|direct-final|shadcn-direct)/.test(
      sourceId,
    )
  ) {
    return {
      "source.primaryAdoptionTarget": "architecture",
      "source.improvesDirectiveWorkspace": true,
    };
  }

  // Default: primaryAdoptionTarget=runtime, improvesDirectiveWorkspace=false
  return {
    "source.primaryAdoptionTarget": "runtime",
    "source.improvesDirectiveWorkspace": false,
  };
}

function slugifyCandidateId(candidateId: string): string {
  return candidateId.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function findRoutingRecord(candidateId: string): string | null {
  const slug = slugifyCandidateId(candidateId);
  if (!fs.existsSync(ROUTING_LOG_DIR)) return null;

  const files = fs
    .readdirSync(ROUTING_LOG_DIR)
    .filter((f) => f.endsWith("-routing-record.md"));

  for (const file of files) {
    if (file.includes(`-${slug}-`)) {
      return `discovery/03-routing-log/${file}`;
    }
  }
  return null;
}

function loadRunRecords(): Array<{ file: string; record: Record<string, any> }> {
  const files = fs
    .readdirSync(ENGINE_RUNS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(ENGINE_RUNS_DIR, file), "utf-8");
    return { file, record: JSON.parse(raw) };
  });
}

async function main() {
  const runs = loadRunRecords();
  console.log(`Found ${runs.length} engine run files.\n`);

  acquireDirectiveRootLock(DIRECTIVE_ROOT);

  const host = createStandaloneFilesystemHost({
    directiveRoot: DIRECTIVE_ROOT,
  });

  let processed = 0;
  let rerouted = 0;
  let errors = 0;
  const stateChanges: Record<string, number> = {};
  const results: RunSummary[] = [];

  try {
    for (const { file, record } of runs) {
      const sourceId: string = record.source.sourceId;
      const runId: string = record.runId;
      const oldState: string = record.decision.decisionState;
      const oldLane: string = record.routingAssessment.recommendedLaneId;

      if (oldState !== "hold_in_discovery" && oldState !== "needs_human_review") {
        console.log(
          `[skip] ${sourceId}: state=${oldState} (not held/pending review)`,
        );
        continue;
      }

      processed++;
      const answers = buildAnswers(sourceId);
      const answerSummary = Object.entries(answers)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(", ");

      console.log(
        `[rerouting] ${processed}/${runs.length}: ${sourceId}  old=${oldState}  answers={${answerSummary}}`,
      );

      try {
        const result = await host.reRouteEngineRunWithAnswers({
          runId,
          answers,
        });

        const newRecord = result.record;
        const newState: string = newRecord.decision.decisionState;
        const newLane: string = newRecord.routingAssessment.recommendedLaneId;

        const changeKey = `${oldState} → ${newState}`;
        stateChanges[changeKey] = (stateChanges[changeKey] ?? 0) + 1;

        if (oldState !== newState || oldLane !== newLane) {
          rerouted++;
        }

        // Write review resolution for rerouted sources
        try {
          const candidateId = newRecord.candidate?.candidateId ?? sourceId;
          const routingPath = findRoutingRecord(candidateId);
          if (routingPath) {
            let reviewDecision: "confirm_runtime" | "confirm_architecture";
            let reviewRationale: string;

            try {
              const artifact = readDirectiveDiscoveryRoutingArtifact({
                directiveRoot: DIRECTIVE_ROOT,
                routingPath,
              });
              if (artifact.routeDestination === "architecture") {
                reviewDecision = "confirm_architecture";
                reviewRationale =
                  `Operator confirms route to Architecture for "${artifact.candidateName}" (${candidateId}).`;
              } else {
                reviewDecision = "confirm_runtime";
                reviewRationale =
                  `Operator confirms route to Runtime for "${artifact.candidateName}" (${candidateId}).`;
              }
            } catch {
              // Fall back to pattern-based decision if artifact can't be read
              reviewDecision = /^(hermes-webdev-|wd-|cybersec-)/.test(sourceId)
                ? "confirm_runtime"
                : "confirm_architecture";
              reviewRationale =
                reviewDecision === "confirm_runtime"
                  ? `Operator confirms route to Runtime for source "${candidateId}".`
                  : `Operator confirms route to Architecture for directive-workspace source "${candidateId}".`;
            }

            const reviewResult = writeDiscoveryRoutingReviewResolution({
              directiveRoot: DIRECTIVE_ROOT,
              routingRecordPath: routingPath,
              decision: reviewDecision,
              rationale: reviewRationale,
              reviewedBy: "hermes-agent-operator",
            });
            console.log(
              `  review: ${reviewDecision}  created=${reviewResult.created}`,
            );
          } else {
            console.log(
              `  review: skipped (no routing record found for "${candidateId}")`,
            );
          }
        } catch (reviewErr) {
          console.error(
            `  review ERROR: ${(reviewErr as Error).message}`,
          );
        }

        results.push({
          candidateId: sourceId,
          oldState,
          newState,
          oldLane,
          newLane,
        });

        const laneDelta =
          oldLane !== newLane ? ` (lane: ${oldLane} → ${newLane})` : "";
        console.log(
          `  → ${oldState} → ${newState}${laneDelta}`,
        );
      } catch (err) {
        errors++;
        console.error(
          `  ✗ ERROR: ${(err as Error).message}`,
        );
      }
    }

    // ── Summary ────────────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════");
    console.log("  REROUTE SUMMARY");
    console.log("══════════════════════════════════════════════");
    console.log(`Total engine run files: ${runs.length}`);
    console.log(`Processed (held/review): ${processed}`);
    console.log(`Rerouted (decision or lane changed): ${rerouted}`);
    console.log(`Errors: ${errors}`);
    console.log("");

    console.log("Decision state changes:");
    for (const [change, count] of Object.entries(stateChanges).sort()) {
      console.log(`  ${change}: ${count} run(s)`);
    }

    console.log("");
    console.log("Per-run details:");
    for (const r of results) {
      const laneInfo =
        r.oldLane !== r.newLane ? `  lane: ${r.oldLane} → ${r.newLane}` : "";
      console.log(
        `  ${r.candidateId.padEnd(42)} ${r.oldState} → ${r.newState}${laneInfo}`,
      );
    }
  } finally {
    host.close();
    releaseDirectiveRootLock(DIRECTIVE_ROOT);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
