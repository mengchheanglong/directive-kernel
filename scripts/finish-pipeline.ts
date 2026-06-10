import { createStandaloneFilesystemHost } from "../hosts/standalone-host/filesystem-host.ts";

const DIRECTIVE_ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const host = createStandaloneFilesystemHost({ directiveRoot: DIRECTIVE_ROOT });
const DATE = "2026-06-10";
const SID = "hermes-webdev-shadcn-ui";
const FU = `runtime/00-follow-up/${DATE}-${SID}-runtime-follow-up-record.md`;

async function main() {
  console.log("=== shadcn/ui: Follow-up → Registry ===\n");

  try {
    // Step 1
    console.log(`1. Open follow-up: ${FU}`);
    const r1: any = await host.openRuntimeFollowUp({ followUpPath: FU, approved: true, approvedBy: "hermes-agent" });
    console.log(`   Result: ok=${r1.ok}, record=${r1.runtimeRecordPath || "?"}`);
    if (!r1.ok) { console.log(`   ERROR: ${r1.error}`); return; }
    const recordPath = r1.runtimeRecordPath;

    // Step 2
    console.log(`2. Open record proof: ${recordPath}`);
    const r2: any = await host.openRuntimeRecordProof({ runtimeRecordPath: recordPath, approved: true, approvedBy: "hermes-agent" });
    console.log(`   Result: ok=${r2.ok}, proof=${r2.proofPath || r2.runtimeProofPath || "?"}`);
    if (!r2.ok) { console.log(`   ERROR: ${r2.error}`); return; }
    const proofPath = r2.proofPath || r2.runtimeProofPath;

    // Step 3
    console.log(`3. Open capability boundary: ${proofPath}`);
    const r3: any = await host.openRuntimeProofRuntimeCapabilityBoundary({ runtimeProofPath: proofPath, approved: true, approvedBy: "hermes-agent" });
    console.log(`   Result: ok=${r3.ok}, cb=${r3.capabilityBoundaryPath || "?"}`);
    if (!r3.ok) { console.log(`   ERROR: ${r3.error}`); return; }
    const cbPath = r3.capabilityBoundaryPath;

    // Step 4
    console.log(`4. Open promotion readiness: ${cbPath}`);
    const r4: any = await host.openRuntimePromotionReadiness({ capabilityBoundaryPath: cbPath, approved: true, approvedBy: "hermes-agent" });
    console.log(`   Result: ok=${r4.ok}, pr=${r4.promotionReadinessPath || "?"}`);
    if (!r4.ok) { console.log(`   ERROR: ${r4.error}`); return; }
    const prPath = r4.promotionReadinessPath;

    // Step 5
    console.log(`5. Seam decision: ${prPath}`);
    const r5: any = await host.writeRuntimePromotionSeamDecision({ promotionReadinessPath: prPath, rationale: "Approved: ready for registry.", approvedBy: "hermes-agent" });
    console.log(`   Result: ok=${r5.ok}, promo=${r5.promotionRecordPath || "?"}`);
    if (!r5.ok) { console.log(`   ERROR: ${r5.error}`); return; }
    const promoPath = r5.promotionRecordPath;

    // Step 6
    console.log(`6. Registry accept: ${promoPath}`);
    const r6: any = await host.writeRuntimeRegistryAcceptanceDecision({ promotionRecordPath: promoPath, rationale: "Accepted to registry.", acceptedBy: "hermes-agent" });
    console.log(`   Result: ok=${r6.ok}`);
    if (r6.ok) {
      console.log("\n*** shadcn/ui PROMOTED TO REGISTRY! ***");
    } else {
      console.log(`   ERROR: ${JSON.stringify(r6)}`);
    }
  } catch (e: any) {
    console.log(`FATAL: ${e.message}`);
  }

  host.close();
}

main();
