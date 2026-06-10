// Hermes host script — advances the held Discovery source into Runtime
import { createStandaloneFilesystemHost } from "../hosts/standalone-host/filesystem-host.ts";
import { writeDiscoveryRoutingReviewResolution } from "../discovery/lib/routing/review-resolution.ts";
import path from "node:path";

const DIRECTIVE_ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const RUN_ID = "c0bea3d9-71ce-48f2-ba86-a3f9f7b887d7";
const host = createStandaloneFilesystemHost({ directiveRoot: DIRECTIVE_ROOT });

// Step 1: Resolve routing review — approve route to Runtime
const routingRecordPath = path.join(
  DIRECTIVE_ROOT,
  "discovery/03-routing-log",
  `routing-${RUN_ID}.json`
);

console.log("=== Step 1: Resolve routing review ===");
try {
  const result = writeDiscoveryRoutingReviewResolution({
    directiveRoot: DIRECTIVE_ROOT,
    routingRecordPath,
    resolution: {
      decision: "approve",
      targetLane: "runtime",
      rationale: "Strengthened mission with explicit constraints, success signal, and runtime adoption target. Source contains executable code that belongs in Runtime.",
      reviewedBy: "hermes-agent-operator",
    },
  });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error("Routing review error:", err.message);
}

console.log("\n=== Done ===");
