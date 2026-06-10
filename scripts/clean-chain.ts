// Clean chain: fresh follow-up → full Runtime pipeline
import { createStandaloneFilesystemHost } from "../hosts/standalone-host/filesystem-host.ts";

const DIRECTIVE_ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const host = createStandaloneFilesystemHost({ directiveRoot: DIRECTIVE_ROOT });
const DATE = "2026-06-10";

// Use fresh candidate IDs to avoid conflicts with existing records
const FRESH = "hermes-webdev-shadcn-fresh";

async function main() {
  console.log(`=== Clean Pipeline: shadcn/ui (${FRESH}) ===\n`);

  // Step 1: Write follow-up via CLI (proper artifact)
  const followUpPath = `runtime/00-follow-up/${DATE}-${FRESH}-runtime-follow-up-record.md`;
  
  // First create the follow-up via the host's write function
  const followUpResult = await host.writeRuntimeFollowUp({
    candidate_id: FRESH,
    candidate_name: "shadcn/ui",
    follow_up_date: DATE,
    current_decision_state: "accepted_for_bounded_local_follow_up",
    origin_track: "discovery",
    runtime_value_to_operationalize: "React component library (116K stars). Accessible, framework-agnostic components for professional web development.",
    proposed_host: "directive-kernel-standalone-host",
    proposed_integration_mode: "local_shareable_workflow",
    source_pack_allowlist_profile: "hermes-web-dev-allowlist",
    allowed_export_surfaces: ["@directive/kernel/standalone-host"],
    excluded_baggage: ["unverified claims"],
    promotion_contract_path: "shared/contracts/capability.md",
    reentry_preconditions: ["confirm capability usable"],
    required_proof: ["runtime proof artifacts written"],
    required_gates: ["check:directive-runtime-proof"],
    trial_scope_limit: ["markdown workflow only"],
    risks: ["external repo API may change"],
    rollback: "Delete follow-up and linked artifacts.",
    no_op_path: "Keep in Discovery.",
    review_cadence: "review after proof",
    current_status: "follow_up_only"
  });
  console.log(`1. Follow-up: ${(followUpResult as any).followUpPath || "OK"}`);

  // Step 2: Open follow-up → creates record
  const r2 = await host.openRuntimeFollowUp({
    followUpPath,
    approved: true,
    approvedBy: "hermes-agent-operator",
  });
  const recordPath = (r2 as any).runtimeRecordPath;
  console.log(`2. Record opened: ${recordPath}`);

  if (!recordPath) {
    console.log("FAILED: no record path returned");
    host.close();
    return;
  }

  // Step 3: Open record → creates proof
  const r3 = await host.openRuntimeRecordProof({
    runtimeRecordPath: recordPath,
    approved: true,
    approvedBy: "hermes-agent-operator",
  });
  const proofPath = (r3 as any).proofPath;
  console.log(`3. Proof opened: ${proofPath}`);

  if (!proofPath) {
    console.log("FAILED: no proof path returned");
    host.close();
    return;
  }

  // Step 4: Open proof → creates capability boundary
  const r4 = await host.openRuntimeProofRuntimeCapabilityBoundary({
    runtimeProofPath: proofPath,
    approved: true,
    approvedBy: "hermes-agent-operator",
  });
  const cbPath = (r4 as any).capabilityBoundaryPath;
  console.log(`4. Capability boundary: ${cbPath}`);

  if (!cbPath) {
    console.log("FAILED: no capability boundary path");
    host.close();
    return;
  }

  // Step 5: Open capability boundary → creates promotion readiness
  const r5 = await host.openRuntimePromotionReadiness({
    capabilityBoundaryPath: cbPath,
    approved: true,
    approvedBy: "hermes-agent-operator",
  });
  const prPath = (r5 as any).promotionReadinessPath;
  console.log(`5. Promotion readiness: ${prPath}`);

  if (!prPath) {
    console.log("FAILED: no promotion readiness path");
    host.close();
    return;
  }

  // Step 6: Seam decision via host
  const r6 = await host.writeRuntimePromotionSeamDecision({
    promotionReadinessPath: prPath,
    rationale: "Approved: shadcn/ui capability ready for registry.",
    approvedBy: "hermes-agent-operator",
  });
  const promoPath = (r6 as any).promotionRecordPath;
  console.log(`6. Seam decision → promotion: ${promoPath}`);

  if (!promoPath) {
    console.log("FAILED: no promotion record path");
    host.close();
    return;
  }

  // Step 7: Registry acceptance
  const r7 = await host.writeRuntimeRegistryAcceptanceDecision({
    promotionRecordPath: promoPath,
    rationale: "Accepted: shadcn/ui capability promoted to Hermes registry.",
    acceptedBy: "hermes-agent-operator",
  });
  console.log(`7. Registry: ${JSON.stringify(r7)}`);

  // Final: check registry
  const fs = await import("fs");
  const regDir = `${DIRECTIVE_ROOT}/runtime/08-registry`;
  if (fs.existsSync(regDir)) {
    const files = fs.readdirSync(regDir);
    console.log(`\nRegistry: ${files.length} entries`);
    files.forEach(f => console.log(`  ${f}`));
  }

  host.close();
  console.log("\n*** PIPELINE COMPLETE ***");
}

main().catch(err => {
  console.error("FATAL:", err.message);
  host.close();
});
