import { renderDiscoveryRoutingRecord } from "../discovery/lib/routing/record-writer.ts";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const ROUTE_LOG = path.join(ROOT, "discovery/03-routing-log");
fs.mkdirSync(ROUTE_LOG, { recursive: true });

const record = renderDiscoveryRoutingRecord({
  candidate_id: "final-test-001",
  candidate_name: "shadcn/ui",
  route_date: "2026-06-10",
  source_type: "github-repo",
  decision_state: "adopt",
  adoption_target: "runtime",
  route_destination: "runtime",
  why_this_route: "shadcn/ui is an executable React component library with 116K GitHub stars. It contains callable, reusable code — component composition, theme customization, responsive layout patterns, accessibility patterns. This code should be operationalized as a Runtime capability.",
  why_not_alternatives: "Architecture is for long-horizon improvements, not operationalizing existing component libraries. Discovery is for intake only. Runtime is the correct lane for turning reusable code into callable capability.",
  receiving_track_owner: "hermes-agent-operator",
  required_next_artifact: "runtime/00-follow-up/shadcn-ui-follow-up.md",
  linked_intake_record: "discovery/intake-queue.json",
  reentry_or_promotion_conditions: "After first capability is proven, expand to remaining component libraries.",
  review_cadence: "After first proof",
  mission_priority_score: 18,
  routing_confidence: "medium",
});

const filePath = path.join(ROUTE_LOG, "2026-06-10-final-test-001-routing-record.md");
fs.writeFileSync(filePath, record);
console.log(`Routing record written:\n  ${filePath}`);
console.log("\nPreview:");
console.log(record.slice(0, 500) + "\n...");
