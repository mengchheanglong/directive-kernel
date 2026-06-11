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

function slugifyCandidateId(candidateId: string): string {
  return candidateId.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
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

function resolveReviewDecision(
  routingPath: string,
): { decision: "confirm_runtime" | "confirm_architecture"; rationale: string } | null {
  try {
    const artifact = readDirectiveDiscoveryRoutingArtifact({
      directiveRoot: DIRECTIVE_ROOT,
      routingPath,
    });
    const dest = artifact.routeDestination;
    if (dest === "runtime") {
      return {
        decision: "confirm_runtime",
        rationale:
          `Operator confirms route to Runtime for "${artifact.candidateName}" (${artifact.candidateId}).`,
      };
    }
    if (dest === "architecture") {
      return {
        decision: "confirm_architecture",
        rationale:
          `Operator confirms route to Architecture for "${artifact.candidateName}" (${artifact.candidateId}).`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const runs = loadRunRecords();
  console.log(`Found ${runs.length} engine run files.\n`);

  acquireDirectiveRootLock(DIRECTIVE_ROOT);

  const host = createStandaloneFilesystemHost({
    directiveRoot: DIRECTIVE_ROOT,
  });

  let processed = 0;
  let confirmedRuntime = 0;
  let confirmedArchitecture = 0;
  let skippedNoRouting = 0;
  let skippedAlreadyResolved = 0;
  let errors = 0;

  try {
    const reviewNeeded = runs.filter(({ record }) => {
      return (
        record.routingAssessment?.needsHumanReview === true
        || record.decision?.decisionState === "needs_human_review"
      );
    });

    console.log(`${reviewNeeded.length} runs need review.\n`);

    for (const { record } of reviewNeeded) {
      const candidateId: string = record.candidate?.candidateId ?? "";
      const runId: string = record.runId ?? "";

      if (!runId || !candidateId) {
        skippedNoRouting++;
        continue;
      }

      const routingPath = findRoutingRecord(candidateId);
      if (!routingPath) {
        console.log(`[skip] ${candidateId}: no routing record found on disk`);
        skippedNoRouting++;
        continue;
      }

      // Check if review resolution already exists
      const reviewRelativePath = routingPath.replace(
        "routing-record.md",
        "review-resolution.md",
      );
      if (fs.existsSync(path.join(DIRECTIVE_ROOT, reviewRelativePath))) {
        console.log(
          `[skip] ${candidateId}: review resolution already exists`,
        );
        skippedAlreadyResolved++;
        continue;
      }

      processed++;
      const reviewInput = resolveReviewDecision(routingPath);
      if (!reviewInput) {
        console.log(
          `[skip] ${candidateId}: could not determine decision from routing record`,
        );
        skippedNoRouting++;
        continue;
      }

      const { decision, rationale } = reviewInput;

      console.log(
        `[review] ${processed}/${reviewNeeded.length}: ${candidateId}  decision=${decision}`,
      );

      try {
        const result = writeDiscoveryRoutingReviewResolution({
          directiveRoot: DIRECTIVE_ROOT,
          routingRecordPath: routingPath,
          decision,
          rationale,
          reviewedBy: "hermes-agent-operator",
        });

        if (decision === "confirm_runtime") confirmedRuntime++;
        else if (decision === "confirm_architecture") confirmedArchitecture++;

        console.log(
          `  -> ${result.ok ? "OK" : "FAILED"}  created=${result.created}  path=${result.reviewResolutionRelativePath}`,
        );
      } catch (err) {
        errors++;
        console.error(`  x ERROR: ${(err as Error).message}`);
      }
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("  REVIEW RESOLUTION SUMMARY");
    console.log("=".repeat(50));
    console.log(`Total engine runs:              ${runs.length}`);
    console.log(`Needs review:                   ${reviewNeeded.length}`);
    console.log(`Review resolutions written:     ${processed}`);
    console.log(`  - Confirmed Runtime:          ${confirmedRuntime}`);
    console.log(`  - Confirmed Architecture:     ${confirmedArchitecture}`);
    console.log(`Skipped (no routing record):    ${skippedNoRouting}`);
    console.log(`Skipped (already resolved):     ${skippedAlreadyResolved}`);
    console.log(`Errors:                         ${errors}`);
  } finally {
    host.close();
    releaseDirectiveRootLock(DIRECTIVE_ROOT);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
