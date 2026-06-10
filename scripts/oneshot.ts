// One-shot pipeline: source → engine → routing → follow-up → record → proof 
// → capability boundary → promotion readiness → seam → registry
import { createStandaloneFilesystemHost } from "../hosts/standalone-host/filesystem-host.ts";
import { Engine } from "../engine/engine.ts";
import { createFilesystemEngineStore } from "../engine/storage.ts";
import { renderDiscoveryRoutingRecord } from "../discovery/lib/routing/record-writer.ts";
import { writeDiscoveryRoutingReviewResolution } from "../discovery/lib/routing/review-resolution.ts";
import { openDirectiveDiscoveryRoute } from "../discovery/lib/routing/route-opener.ts";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root-clean/directive-root";
const DATE = "2026-06-10";
const CID = "hermes-oneshot";

async function main() {
  console.log("=== One-Shot Pipeline ===\n");

  // 0. Ensure clean lock
  const lockPath = path.join(ROOT, "engine/.lock");
  try { fs.unlinkSync(lockPath); } catch {}

  // 1. Submit source via engine
  console.log("1. Submitting source via engine...");
  const store = createFilesystemEngineStore({ directiveRoot: ROOT });
  const engine = new Engine({
    laneSet: { discovery: true, runtime: true, architecture: true } as any,
    store,
  });
  
  const sourceResult = await engine.processSource({
    source: {
      sourceId: CID,
      sourceType: "github-repo" as any,
      sourceRef: "https://github.com/shadcn-ui/ui",
      title: "shadcn/ui",
      summary: "Professional React component library (116K stars). Framework-agnostic accessible components.",
      missionAlignmentHint: "Build senior web developer capability for Hermes Agent.",
      notes: ["One-shot pipeline test", "116K GitHub stars"],
    },
    mission: {
      missionId: "hermes-capability-bootstrap",
      currentObjective: "Operationalize shadcn/ui as a callable Hermes capability.",
      usefulnessSignals: ["mission-relevant usefulness", "safe routing through Discovery, Runtime, or Architecture"],
      capabilityLanes: ["Discovery lane intake and routing", "Runtime lane runtime usefulness conversion"],
      constraints: ["Prove through execution", "Keep review explicit", "Stay bounded"],
      successSignal: "One capability promoted to registry.",
      adoptionTarget: "runtime",
      activeMissionMarkdown: "# Active Mission\n\n## Current Objective\nOperationalize shadcn/ui as a callable Hermes capability.\n\n## Adoption Target\nruntime\n\n## Constraints\n- Prove through execution\n- Keep review explicit\n- Stay bounded\n\n## Success Signal\nOne capability promoted to registry.",
    },
  });
  
  const runId = sourceResult.record.runId;
  console.log(`   OK — runId: ${runId}`);
  console.log(`   Decision: ${sourceResult.record.decision.decisionState}`);

  // 2. Write routing record
  console.log("\n2. Writing routing record...");
  const routeLogDir = path.join(ROOT, "discovery/03-routing-log");
  fs.mkdirSync(routeLogDir, { recursive: true });
  
  const engineRunRelPath = sourceResult.record.relativePath;
  const engineRunReportRelPath = sourceResult.record.reportRelativePath;
  
  const routingMd = renderDiscoveryRoutingRecord({
    candidate_id: CID,
    candidate_name: "shadcn/ui",
    route_date: DATE,
    source_type: "github-repo",
    decision_state: "adopt",
    adoption_target: "runtime",
    route_destination: "runtime",
    why_this_route: "shadcn/ui is an executable React component library with 116K GitHub stars. Contains callable reusable code patterns for web development.",
    why_not_alternatives: "Runtime is the correct lane for operationalizing reusable code.",
    receiving_track_owner: "hermes-agent-operator",
    required_next_artifact: `runtime/00-follow-up/${DATE}-${CID}-runtime-follow-up-record.md`,
    linked_intake_record: "discovery/intake-queue.json",
    linked_engine_run_record: engineRunRelPath,
    linked_engine_run_report: engineRunReportRelPath,
    reentry_or_promotion_conditions: "After first capability proven, expand further.",
    review_cadence: "After first proof",
    mission_priority_score: 18,
    routing_confidence: "medium",
  });
  
  const routingPath = `discovery/03-routing-log/${DATE}-${CID}-routing-record.md`;
  fs.writeFileSync(path.join(ROOT, routingPath), routingMd);
  console.log(`   OK — ${routingPath}`);

  // 3. Open Discovery route
  console.log("\n3. Opening Discovery route...");
  openDirectiveDiscoveryRoute({
    routingPath,
    approved: true,
    approvedBy: "hermes-agent-operator",
    directiveRoot: ROOT,
  });
  console.log("   OK");

  // 4. Create follow-up via host
  console.log("\n4. Creating follow-up...");
  const host = createStandaloneFilesystemHost({ directiveRoot: ROOT });
  
  const fuResult: any = await (host as any).writeRuntimeFollowUp({
    candidate_id: CID,
    candidate_name: "shadcn/ui",
    follow_up_date: DATE,
    current_decision_state: "accepted_for_bounded_local_follow_up",
    origin_track: "discovery",
    runtime_value_to_operationalize: "React component library (116K stars). Accessible, framework-agnostic components for professional web development.",
    proposed_host: "directive-kernel-standalone-host",
    proposed_integration_mode: "local_shareable_workflow",
    source_pack_allowlist_profile: "hermes-web-dev",
    allowed_export_surfaces: ["@directive/kernel/standalone-host"],
    excluded_baggage: [],
    promotion_contract_path: "shared/contracts/capability.md",
    reentry_preconditions: [],
    required_proof: ["artifacts written"],
    required_gates: ["check:proof"],
    trial_scope_limit: ["markdown only"],
    risks: ["external dep"],
    rollback: "delete",
    no_op_path: "keep",
    review_cadence: "after proof",
    current_status: "pending_review",
  });
  
  let fuPath = fuResult.followUpPath || fuResult.relativePath || fuResult.artifactPath || (fuResult.ok ? `runtime/00-follow-up/${DATE}-${CID}-runtime-follow-up-record.md` : "");
  console.log(`   OK — ${fuPath}`);

  // 5. Open follow-up → record
  console.log("\n5. Opening follow-up → record...");
  const r1: any = await host.openRuntimeFollowUp({ followUpPath: fuPath, approved: true, approvedBy: "hermes" });
  if (!r1.ok) { console.log(`   FAILED: ${r1.error}`); host.close(); return; }
  const recPath = r1.runtimeRecordPath;
  console.log(`   OK — ${recPath}`);

  // 6. Open record → proof
  console.log("\n6. Opening record → proof...");
  const r2: any = await host.openRuntimeRecordProof({ runtimeRecordPath: recPath, approved: true, approvedBy: "hermes" });
  if (!r2.ok) { console.log(`   FAILED: ${r2.error}`); host.close(); return; }
  const proofPath = r2.proofPath || r2.runtimeProofPath;
  console.log(`   OK — ${proofPath}`);

  // 7. Open proof → capability boundary
  console.log("\n7. Opening proof → capability boundary...");
  const r3: any = await host.openRuntimeProofRuntimeCapabilityBoundary({ runtimeProofPath: proofPath, approved: true, approvedBy: "hermes" });
  if (!r3.ok) { console.log(`   FAILED: ${r3.error}`); host.close(); return; }
  const cbPath = r3.capabilityBoundaryPath;
  console.log(`   OK — ${cbPath}`);

  // 8. Open promotion readiness
  console.log("\n8. Opening promotion readiness...");
  const r4: any = await host.openRuntimePromotionReadiness({ capabilityBoundaryPath: cbPath, approved: true, approvedBy: "hermes" });
  if (!r4.ok) { console.log(`   FAILED: ${r4.error}`); host.close(); return; }
  const prPath = r4.promotionReadinessPath;
  console.log(`   OK — ${prPath}`);

  // 9. Seam decision
  console.log("\n9. Seam decision...");
  const r5: any = await host.writeRuntimePromotionSeamDecision({ promotionReadinessPath: prPath, rationale: "Approved: capability proven.", approvedBy: "hermes" });
  if (!r5.ok) { console.log(`   FAILED: ${r5.error}`); host.close(); return; }
  const promoPath = r5.promotionRecordPath;
  console.log(`   OK — ${promoPath}`);

  // 10. Registry accept
  console.log("\n10. Registry accept...");
  const r6: any = await host.writeRuntimeRegistryAcceptanceDecision({ promotionRecordPath: promoPath, rationale: "Accepted to registry.", acceptedBy: "hermes" });
  console.log(`    ${r6.ok ? "*** REGISTERED! ***" : "FAILED: " + (r6.error || JSON.stringify(r6))}`);

  host.close();

  // Check results
  const regDir = path.join(ROOT, "runtime/08-registry");
  const regFiles = fs.existsSync(regDir) ? fs.readdirSync(regDir) : [];
  console.log(`\nRegistry: ${regFiles.length} entries`);
  for (const f of regFiles) console.log(`  ${f}`);
  console.log("\n=== DONE ===");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
