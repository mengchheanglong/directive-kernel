import { renderDiscoveryRoutingRecord } from "../discovery/lib/routing/record-writer.ts";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const routeLog = path.join(ROOT, "discovery/03-routing-log");

const sources = [
  { cid: "wd-daisyui", name: "daisyUI", json: "runtime/host-artifacts/engine-runs/2026-06-11T08-22-26-242Z-wd-daisyui-bdf89a35.json", md: "runtime/host-artifacts/engine-runs/2026-06-11T08-22-26-242Z-wd-daisyui-bdf89a35.md" },
  { cid: "wd-react-bits", name: "React Bits", json: "runtime/host-artifacts/engine-runs/2026-06-11T08-22-27-021Z-wd-react-bits-0d6d94b9.json", md: "runtime/host-artifacts/engine-runs/2026-06-11T08-22-27-021Z-wd-react-bits-0d6d94b9.md" },
  { cid: "wd-react-bootstrap", name: "React Bootstrap", json: "runtime/host-artifacts/engine-runs/2026-06-11T08-22-27-783Z-wd-react-bootstrap-954cf5f6.json", md: "runtime/host-artifacts/engine-runs/2026-06-11T08-22-27-783Z-wd-react-bootstrap-954cf5f6.md" },
  { cid: "wd-tremor", name: "Tremor", json: "runtime/host-artifacts/engine-runs/2026-06-11T08-22-28-587Z-wd-tremor-99686cc4.json", md: "runtime/host-artifacts/engine-runs/2026-06-11T08-22-28-587Z-wd-tremor-99686cc4.md" },
];

for (const s of sources) {
  const record = renderDiscoveryRoutingRecord({
    candidate_id: s.cid, candidate_name: s.name, route_date: "2026-06-11",
    source_type: "github-repo", decision_state: "adopt", adoption_target: "runtime", route_destination: "runtime",
    why_this_route: `${s.name} component library for web development.`,
    why_not_alternatives: "Runtime for component libraries.",
    receiving_track_owner: "hermes-agent-operator",
    required_next_artifact: `runtime/00-follow-up/2026-06-11-${s.cid}-runtime-follow-up-record.md`,
    linked_intake_record: "discovery/intake-queue.json",
    linked_engine_run_record: s.json, linked_engine_run_report: s.md,
    reentry_or_promotion_conditions: "After proof.", review_cadence: "After first proof",
    mission_priority_score: 18, routing_confidence: "medium",
  });
  fs.writeFileSync(path.join(routeLog, `2026-06-11-${s.cid}-routing-record.md`), record);
  console.log(`Routing: ${s.name}`);
}
console.log("Done");
