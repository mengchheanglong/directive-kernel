import { renderDiscoveryRoutingRecord } from "../discovery/lib/routing/record-writer.ts";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const routeLog = path.join(ROOT, "discovery/03-routing-log");

const sources = [
  { cid: "hermes-webdev-daisyui", name: "daisyUI", json: "runtime/host-artifacts/engine-runs/2026-06-10T15-44-50-077Z-hermes-webdev-daisyui-c397cb7d.json", md: "runtime/host-artifacts/engine-runs/2026-06-10T15-44-50-077Z-hermes-webdev-daisyui-c397cb7d.md" },
  { cid: "hermes-webdev-react-bits", name: "React Bits", json: "runtime/host-artifacts/engine-runs/2026-06-10T15-45-03-106Z-hermes-webdev-react-bits-6408971e.json", md: "runtime/host-artifacts/engine-runs/2026-06-10T15-45-03-106Z-hermes-webdev-react-bits-6408971e.md" },
  { cid: "hermes-webdev-react-bootstrap", name: "React Bootstrap", json: "runtime/host-artifacts/engine-runs/2026-06-10T15-45-05-240Z-hermes-webdev-react-bootstrap-24246500.json", md: "runtime/host-artifacts/engine-runs/2026-06-10T15-45-05-240Z-hermes-webdev-react-bootstrap-24246500.md" },
  { cid: "hermes-webdev-tremor", name: "Tremor", json: "runtime/host-artifacts/engine-runs/2026-06-10T15-45-07-529Z-hermes-webdev-tremor-fd28ce07.json", md: "runtime/host-artifacts/engine-runs/2026-06-10T15-45-07-529Z-hermes-webdev-tremor-fd28ce07.md" },
];

for (const s of sources) {
  const record = renderDiscoveryRoutingRecord({
    candidate_id: s.cid, candidate_name: s.name, route_date: "2026-06-11",
    source_type: "github-repo", decision_state: "adopt", adoption_target: "runtime", route_destination: "runtime",
    why_this_route: `${s.name} component library for web development.`,
    why_not_alternatives: "Runtime is the correct lane for component libraries.",
    receiving_track_owner: "hermes-agent-operator",
    required_next_artifact: `runtime/00-follow-up/2026-06-10-${s.cid}-runtime-follow-up-record.md`,
    linked_intake_record: "discovery/intake-queue.json",
    linked_engine_run_record: s.json, linked_engine_run_report: s.md,
    reentry_or_promotion_conditions: "After proof, expand.", review_cadence: "After first proof",
    mission_priority_score: 18, routing_confidence: "medium",
  });
  fs.writeFileSync(path.join(routeLog, `2026-06-11-${s.cid}-routing-record.md`), record);
  console.log(`Routing: ${s.name}`);
}
console.log("Done — 4 routing records");
