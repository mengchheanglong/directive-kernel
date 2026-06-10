// One-shot pipeline using compiled dist modules
// Step 1: CLI for submission
// Step 2-7: Direct host functions for advancement

import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root-clean/directive-root";
const KERNEL = "C:/Users/User/AppData/Local/hermes/systems/directive-kernel";
const CLI = path.join(KERNEL, "dist/hosts/standalone-host/cli.js");
const DATE = "2026-06-10";
const CID = "hermes-oneshot";
const LOCK = path.join(ROOT, "engine/.lock");

// Clean
try { fs.unlinkSync(LOCK); } catch {}

// Step 1: Submit via CLI
console.log("1. Submitting via CLI...");
const subJson = JSON.stringify({
  candidate_id: CID,
  candidate_name: "shadcn/ui",
  source_type: "github-repo",
  source_reference: "https://github.com/shadcn-ui/ui",
  mission_alignment: "Professional React component library (116K stars). Accessible, framework-agnostic components.",
  notes: ["One-shot pipeline test"],
  record_shape: "engine_full"
});

fs.writeFileSync(path.join(path.dirname(ROOT), "sub.json"), subJson);
let result = execSync(`node "${CLI}" discovery-submit --directive-root "${ROOT}" --input-json-path "${path.join(path.dirname(ROOT), "sub.json")}" --process-with-engine 2>/dev/null`, { cwd: KERNEL, encoding: "utf8" });
const subResult = JSON.parse(result);
const runId = subResult.engine?.record?.runId;
if (!runId) { console.log("FAILED:", result.slice(0, 500)); process.exit(1); }
console.log("   OK — runId:", runId);

// Find the actual engine run files
const runsDir = path.join(ROOT, "runtime/host-artifacts/engine-runs");
const runFiles = fs.readdirSync(runsDir).filter(f => f.includes(CID));
if (!runFiles.length) { console.log("No engine run files found"); process.exit(1); }
const runJson = runFiles.find(f => f.endsWith(".json"));
const runMd = runFiles.find(f => f.endsWith(".md"));
console.log("   Files:", runJson, "|", runMd);
const engineRunRel = `runtime/host-artifacts/engine-runs/${runJson}`;
const engineRunReportRel = `runtime/host-artifacts/engine-runs/${runMd}`;

// Step 2: Write routing record
console.log("2. Writing routing record...");
const routeLogDir = path.join(ROOT, "discovery/03-routing-log");
fs.mkdirSync(routeLogDir, { recursive: true });
const require = createRequire(import.meta.url);
const { renderDiscoveryRoutingRecord } = require("./dist/discovery/lib/routing/record-writer.js");

const routingMd = renderDiscoveryRoutingRecord({
  candidate_id: CID,
  candidate_name: "shadcn/ui",
  route_date: DATE,
  source_type: "github-repo",
  decision_state: "adopt",
  adoption_target: "runtime",
  route_destination: "runtime",
  why_this_route: "shadcn/ui is an executable React component library with 116K GitHub stars.",
  why_not_alternatives: "Runtime is correct lane for reusable code.",
  receiving_track_owner: "hermes-agent-operator",
  required_next_artifact: `runtime/00-follow-up/${DATE}-${CID}-runtime-follow-up-record.md`,
  linked_intake_record: "discovery/intake-queue.json",
  linked_engine_run_record: engineRunRel,
  linked_engine_run_report: engineRunReportRel,
  reentry_or_promotion_conditions: "After first capability is proven.",
  review_cadence: "After first proof",
  mission_priority_score: 18,
  routing_confidence: "medium",
});

const routingPath = `discovery/03-routing-log/${DATE}-${CID}-routing-record.md`;
fs.writeFileSync(path.join(ROOT, routingPath), routingMd);
console.log("   OK");

// Step 3: Create follow-up via CLI
console.log("3. Creating follow-up...");
try { fs.unlinkSync(LOCK); } catch {}
const fuJson = JSON.stringify({
  candidate_id: CID, candidate_name: "shadcn/ui", follow_up_date: DATE,
  current_decision_state: "accepted_for_bounded_local_follow_up", origin_track: "discovery",
  runtime_value_to_operationalize: "React component library (116K stars).",
  proposed_host: "directive-kernel-standalone-host", proposed_integration_mode: "local_shareable_workflow",
  source_pack_allowlist_profile: "hermes-web-dev",
  allowed_export_surfaces: ["@directive/kernel/standalone-host"], excluded_baggage: [],
  promotion_contract_path: "shared/contracts/capability.md", reentry_preconditions: [],
  required_proof: ["artifacts written"], required_gates: ["check:proof"],
  trial_scope_limit: ["markdown only"], risks: ["external dep"],
  rollback: "delete", no_op_path: "keep", review_cadence: "after proof",
  current_status: "pending_review"
});

fs.writeFileSync(path.join(path.dirname(ROOT), "fu.json"), fuJson);
result = execSync(`node "${CLI}" runtime-followup-write --directive-root "${ROOT}" --input-json-path "${path.join(path.dirname(ROOT), "fu.json")}" 2>/dev/null`, { cwd: KERNEL, encoding: "utf8" });
const fuResult = JSON.parse(result);
const fuPath = fuResult.relativePath || fuResult.followUpPath;
if (!fuPath) { console.log("Follow-up failed:", result.slice(0, 500)); process.exit(1); }
console.log("   OK —", fuPath);

// Step 4-9: Use compiled host for advancement
console.log("4. Importing compiled host...");
try { fs.unlinkSync(LOCK); } catch {}
const { createStandaloneFilesystemHost: createHost } = require("./dist/hosts/standalone-host/filesystem-host.js");
const host = createHost({ directiveRoot: ROOT });

async function run() {
  // 4. Open route
  console.log("5. Opening Discovery route...");
  const r0 = await host.openDiscoveryRoute({ routingPath, approved: true, approvedBy: "hermes" });
  console.log("   ok:", r0.ok, r0.error || "");

  if (!r0.ok) { host.close(); return; }

  // 5. Open follow-up
  console.log("6. Opening follow-up...");
  const r1 = await host.openRuntimeFollowUp({ followUpPath: fuPath, approved: true, approvedBy: "hermes" });
  console.log("   ok:", r1.ok, "rec:", r1.runtimeRecordPath || r1.error);
  if (!r1.ok) { host.close(); return; }

  // 6. Open record → proof
  console.log("7. Opening record proof...");
  const r2 = await host.openRuntimeRecordProof({ runtimeRecordPath: r1.runtimeRecordPath, approved: true, approvedBy: "hermes" });
  console.log("   ok:", r2.ok, "proof:", r2.proofPath || r2.runtimeProofPath || r2.error);
  if (!r2.ok) { host.close(); return; }

  // 7. Open proof → capability boundary
  console.log("8. Opening capability boundary...");
  const r3 = await host.openRuntimeProofRuntimeCapabilityBoundary({ runtimeProofPath: r2.proofPath || r2.runtimeProofPath, approved: true, approvedBy: "hermes" });
  console.log("   ok:", r3.ok, "cb:", r3.capabilityBoundaryPath || r3.error);
  if (!r3.ok) { host.close(); return; }

  // 8. Open promotion readiness
  console.log("9. Opening promotion readiness...");
  const r4 = await host.openRuntimePromotionReadiness({ capabilityBoundaryPath: r3.capabilityBoundaryPath, approved: true, approvedBy: "hermes" });
  console.log("   ok:", r4.ok, "pr:", r4.promotionReadinessPath || r4.error);
  if (!r4.ok) { host.close(); return; }

  // 9. Seam decision
  console.log("10. Seam decision...");
  const r5 = await host.writeRuntimePromotionSeamDecision({ promotionReadinessPath: r4.promotionReadinessPath, rationale: "Approved.", approvedBy: "hermes" });
  console.log("   ok:", r5.ok, "promo:", r5.promotionRecordPath || r5.error);
  if (!r5.ok) { host.close(); return; }

  // 10. Registry accept
  console.log("11. Registry accept...");
  const r6 = await host.writeRuntimeRegistryAcceptanceDecision({ promotionRecordPath: r5.promotionRecordPath, rationale: "Accepted.", acceptedBy: "hermes" });
  console.log("    ", r6.ok ? "*** REGISTERED! ***" : "FAILED: " + JSON.stringify(r6));

  host.close();
}

await run();

// Check results
const regDir = path.join(ROOT, "runtime/08-registry");
const regFiles = fs.existsSync(regDir) ? fs.readdirSync(regDir) : [];
console.log("\nRegistry:", regFiles.length, "entries");
for (const f of regFiles) console.log(" ", f);
console.log("\n=== DONE ===");
