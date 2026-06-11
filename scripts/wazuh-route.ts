import { renderDiscoveryRoutingRecord } from "../discovery/lib/routing/record-writer.ts";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const routeLog = path.join(ROOT, "discovery/03-routing-log");
fs.mkdirSync(routeLog, { recursive: true });

const record = renderDiscoveryRoutingRecord({
  candidate_id: "cybersec-wazuh",
  candidate_name: "Wazuh XDR/SIEM",
  route_date: "2026-06-11",
  source_type: "github-repo",
  decision_state: "adopt",
  adoption_target: "runtime",
  route_destination: "runtime",
  why_this_route: "Wazuh is an open-source security platform (15K stars) providing XDR and SIEM capabilities.",
  why_not_alternatives: "Runtime is the correct lane for operationalizing security tooling.",
  receiving_track_owner: "hermes-agent-operator",
  required_next_artifact: "runtime/00-follow-up/2026-06-11-cybersec-wazuh-runtime-follow-up-record.md",
  linked_intake_record: "discovery/intake-queue.json",
  linked_engine_run_record: "runtime/host-artifacts/engine-runs/2026-06-11T07-03-14-938Z-cybersec-wazuh-c1d14d55.json",
  linked_engine_run_report: "runtime/host-artifacts/engine-runs/2026-06-11T07-03-14-938Z-cybersec-wazuh-c1d14d55.md",
  reentry_or_promotion_conditions: "After proof, expand to remaining cybersecurity tools.",
  review_cadence: "After first proof",
  mission_priority_score: 18,
  routing_confidence: "medium",
});

const outPath = path.join(routeLog, "2026-06-11-cybersec-wazuh-routing-record.md");
fs.writeFileSync(outPath, record);
console.log("Wrote:", outPath);
