import { renderDiscoveryRoutingRecord } from "../discovery/lib/routing/record-writer.ts";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const ROUTE_LOG = path.join(ROOT, "discovery/03-routing-log");

const record = renderDiscoveryRoutingRecord({
  candidate_id: "final-test-001",
  candidate_name: "shadcn/ui",
  route_date: "2026-06-10",
  source_type: "github-repo",
  decision_state: "adopt",
  adoption_target: "runtime",
  route_destination: "runtime",
  why_this_route: "shadcn/ui is an executable React component library with 116K GitHub stars. Contains callable, reusable code patterns for web development.",
  why_not_alternatives: "Runtime is the correct lane for turning reusable code into callable capability.",
  receiving_track_owner: "hermes-agent-operator",
  required_next_artifact: "runtime/00-follow-up/2026-06-10-final-test-001-runtime-follow-up-record.md",
  linked_intake_record: "discovery/intake-queue.json",
  linked_engine_run_record: "runtime/host-artifacts/engine-runs/2026-06-10T18-46-21-728Z-final-test-001-41cc1219.json",
  linked_engine_run_report: "runtime/host-artifacts/engine-runs/2026-06-10T18-46-21-728Z-final-test-001-41cc1219.md",
  reentry_or_promotion_conditions: "After first capability proven, expand to remaining libraries.",
  review_cadence: "After first proof",
  mission_priority_score: 18,
  routing_confidence: "medium",
});

fs.writeFileSync(path.join(ROUTE_LOG, "2026-06-10-final-test-001-routing-record.md"), record);
console.log("Routing record updated.");
