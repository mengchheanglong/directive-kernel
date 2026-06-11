import { renderDiscoveryRoutingRecord } from "../discovery/lib/routing/record-writer.ts";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const routeLog = path.join(ROOT, "discovery/03-routing-log");
const BASE = "runtime/host-artifacts/engine-runs";

const sources = [
  { cid: "cybersec-x64dbg", name: "x64dbg", desc: "Open-source Windows debugger (48K stars).", json: `${BASE}/2026-06-11T07-03-14-068Z-cybersec-x64dbg-9b619fcc.json`, md: `${BASE}/2026-06-11T07-03-14-068Z-cybersec-x64dbg-9b619fcc.md` },
  { cid: "cybersec-security-checklist", name: "Security Checklist", desc: "300+ digital security tips (21K stars).", json: `${BASE}/2026-06-11T07-03-14-359Z-cybersec-security-checklist-bf18927d.json`, md: `${BASE}/2026-06-11T07-03-14-359Z-cybersec-security-checklist-bf18927d.md` },
  { cid: "cybersec-safeline", name: "SafeLine WAF", desc: "Self-hosted WAF (21K stars).", json: `${BASE}/2026-06-11T07-03-14-646Z-cybersec-safeline-0f3536dc.json`, md: `${BASE}/2026-06-11T07-03-14-646Z-cybersec-safeline-0f3536dc.md` },
  { cid: "cybersec-ai-skills", name: "AI Skills", desc: "754 cybersecurity skills for AI agents (15K stars).", json: `${BASE}/2026-06-11T07-03-15-243Z-cybersec-ai-skills-15124245.json`, md: `${BASE}/2026-06-11T07-03-15-243Z-cybersec-ai-skills-15124245.md` },
];

for (const s of sources) {
  const record = renderDiscoveryRoutingRecord({
    candidate_id: s.cid, candidate_name: s.name, route_date: "2026-06-11",
    source_type: "github-repo", decision_state: "adopt", adoption_target: "runtime", route_destination: "runtime",
    why_this_route: s.desc, why_not_alternatives: "Runtime for security tooling.",
    receiving_track_owner: "hermes-agent-operator",
    required_next_artifact: `runtime/00-follow-up/2026-06-11-${s.cid}-runtime-follow-up-record.md`,
    linked_intake_record: "discovery/intake-queue.json",
    linked_engine_run_record: s.json, linked_engine_run_report: s.md,
    reentry_or_promotion_conditions: "After proof, expand.", review_cadence: "After first proof",
    mission_priority_score: 18, routing_confidence: "medium",
  });
  fs.writeFileSync(path.join(routeLog, `2026-06-11-${s.cid}-routing-record.md`), record);
  console.log(`Fixed: ${s.name}`);
}
console.log("Done — 4 routing records fixed");
