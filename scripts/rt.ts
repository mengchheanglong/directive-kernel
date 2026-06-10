import { renderDiscoveryRoutingRecord } from "../discovery/lib/routing/record-writer.ts";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root-clean/directive-root";
const routeLog = path.join(ROOT, "discovery/03-routing-log");
fs.mkdirSync(routeLog, { recursive: true });

const record = renderDiscoveryRoutingRecord({
  candidate_id: "shadcn-v11",
  candidate_name: "shadcn/ui",
  route_date: "2026-06-10",
  source_type: "github-repo",
  decision_state: "adopt",
  adoption_target: "runtime",
  route_destination: "runtime",
  why_this_route: "shadcn/ui is an executable React component library (116K stars). Contains reusable code patterns.",
  why_not_alternatives: "Runtime is the correct lane.",
  receiving_track_owner: "hermes-agent-operator",
  required_next_artifact: "runtime/00-follow-up/2026-06-10-shadcn-v11-runtime-follow-up-record.md",
  linked_intake_record: "discovery/intake-queue.json",
  linked_engine_run_record: "runtime/host-artifacts/engine-runs/2026-06-10T19-09-36-840Z-shadcn-v11-4a15e2e9.json",
  linked_engine_run_report: "runtime/host-artifacts/engine-runs/2026-06-10T19-09-36-840Z-shadcn-v11-4a15e2e9.md",
  reentry_or_promotion_conditions: "After proof, expand.",
  review_cadence: "After proof",
  mission_priority_score: 18,
  routing_confidence: "medium",
});

const outPath = path.join(routeLog, "2026-06-10-shadcn-v11-routing-record.md");
fs.writeFileSync(outPath, record);
console.log("Wrote:", outPath);
console.log("Size:", record.length, "bytes");
