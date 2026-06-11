import { renderDiscoveryRoutingRecord } from "../discovery/lib/routing/record-writer.ts";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const routeLog = path.join(ROOT, "discovery/03-routing-log");
fs.mkdirSync(routeLog, { recursive: true });

const sources = [
  {
    cid: "cybersec-x64dbg",
    name: "x64dbg",
    desc: "Open-source Windows debugger (48K stars). Reverse engineering and malware analysis tool.",
    engineRunJson: "runtime/host-artifacts/engine-runs/2026-06-11T07-03-14-935Z-cybersec-x64dbg-4bc4c9f0.json",
    engineRunMd: "runtime/host-artifacts/engine-runs/2026-06-11T07-03-14-935Z-cybersec-x64dbg-4bc4c9f0.md",
  },
  {
    cid: "cybersec-security-checklist",
    name: "Personal Security Checklist",
    desc: "300+ digital security tips (21K stars). Comprehensive security hygiene framework.",
    engineRunJson: "runtime/host-artifacts/engine-runs/2026-06-11T07-03-14-937Z-cybersec-security-checklist-7f4c6a3e.json",
    engineRunMd: "runtime/host-artifacts/engine-runs/2026-06-11T07-03-14-937Z-cybersec-security-checklist-7f4c6a3e.md",
  },
  {
    cid: "cybersec-safeline",
    name: "SafeLine WAF",
    desc: "Self-hosted web application firewall (21K stars). Reverse proxy for web app protection.",
    engineRunJson: "runtime/host-artifacts/engine-runs/2026-06-11T07-03-14-939Z-cybersec-safeline-9e3b5d2c.json",
    engineRunMd: "runtime/host-artifacts/engine-runs/2026-06-11T07-03-14-939Z-cybersec-safeline-9e3b5d2c.md",
  },
  {
    cid: "cybersec-ai-skills",
    name: "Anthropic Cybersecurity Skills",
    desc: "754 structured cybersecurity skills for AI agents (15K stars). MITRE ATT&CK and NIST CSF mapped.",
    engineRunJson: "runtime/host-artifacts/engine-runs/2026-06-11T07-03-14-941Z-cybersec-ai-skills-a2d4e8f1.json",
    engineRunMd: "runtime/host-artifacts/engine-runs/2026-06-11T07-03-14-941Z-cybersec-ai-skills-a2d4e8f1.md",
  },
];

for (const s of sources) {
  const record = renderDiscoveryRoutingRecord({
    candidate_id: s.cid,
    candidate_name: s.name,
    route_date: "2026-06-11",
    source_type: "github-repo",
    decision_state: "adopt",
    adoption_target: "runtime",
    route_destination: "runtime",
    why_this_route: `${s.name}: ${s.desc}`,
    why_not_alternatives: "Runtime is the correct lane for operationalizing security tooling.",
    receiving_track_owner: "hermes-agent-operator",
    required_next_artifact: `runtime/00-follow-up/2026-06-11-${s.cid}-runtime-follow-up-record.md`,
    linked_intake_record: "discovery/intake-queue.json",
    linked_engine_run_record: s.engineRunJson,
    linked_engine_run_report: s.engineRunMd,
    reentry_or_promotion_conditions: "After proof, expand capabilities.",
    review_cadence: "After first proof",
    mission_priority_score: 18,
    routing_confidence: "medium",
  });

  fs.writeFileSync(path.join(routeLog, `2026-06-11-${s.cid}-routing-record.md`), record);
  console.log(`Routing: ${s.name}`);
}
console.log("Done — 4 routing records created");
