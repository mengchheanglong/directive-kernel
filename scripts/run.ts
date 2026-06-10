import { createStandaloneFilesystemHost } from "../hosts/standalone-host/filesystem-host.ts";

const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root-clean/directive-root";
const host = createStandaloneFilesystemHost({ directiveRoot: ROOT });
const FU = "runtime/00-follow-up/2026-06-10-hermes-shadcn-clean-runtime-follow-up-record.md";
const ROUTE = "discovery/03-routing-log/routing-hermes-shadcn-clean.json";

async function main() {
  // Step 0: Open Discovery route
  process.stdout.write("0. Open Discovery route...\n");
  const r0: any = await host.openDiscoveryRoute({ routingPath: ROUTE, approved: true, approvedBy: "hermes" });
  process.stdout.write(`   ok=${r0.ok} err=${r0.error || "none"}\n`);
  if (!r0.ok) { host.close(); process.exit(1); }

  // Step 1: Open follow-up
  process.stdout.write("1. Open follow-up...\n");
  const r1: any = await host.openRuntimeFollowUp({ followUpPath: FU, approved: true, approvedBy: "hermes" });
  process.stdout.write(`   ok=${r1.ok} record=${r1.runtimeRecordPath || "?"} err=${r1.error || "none"}\n`);
  if (!r1.ok) { host.close(); process.exit(1); }

  // Step 2: Open record proof
  process.stdout.write("2. Open record proof...\n");
  const r2: any = await host.openRuntimeRecordProof({ runtimeRecordPath: r1.runtimeRecordPath, approved: true, approvedBy: "hermes" });
  process.stdout.write(`   ok=${r2.ok} proof=${r2.proofPath || r2.runtimeProofPath || "?"} err=${r2.error || "none"}\n`);
  if (!r2.ok) { host.close(); process.exit(1); }

  // Step 3: Open capability boundary
  process.stdout.write("3. Open capability boundary...\n");
  const r3: any = await host.openRuntimeProofRuntimeCapabilityBoundary({ runtimeProofPath: r2.proofPath || r2.runtimeProofPath, approved: true, approvedBy: "hermes" });
  process.stdout.write(`   ok=${r3.ok} cb=${r3.capabilityBoundaryPath || "?"} err=${r3.error || "none"}\n`);
  if (!r3.ok) { host.close(); process.exit(1); }

  // Step 4: Open promotion readiness
  process.stdout.write("4. Open promotion readiness...\n");
  const r4: any = await host.openRuntimePromotionReadiness({ capabilityBoundaryPath: r3.capabilityBoundaryPath, approved: true, approvedBy: "hermes" });
  process.stdout.write(`   ok=${r4.ok} pr=${r4.promotionReadinessPath || "?"} err=${r4.error || "none"}\n`);
  if (!r4.ok) { host.close(); process.exit(1); }

  // Step 5: Seam decision
  process.stdout.write("5. Seam decision...\n");
  const r5: any = await host.writeRuntimePromotionSeamDecision({ promotionReadinessPath: r4.promotionReadinessPath, rationale: "Approved.", approvedBy: "hermes" });
  process.stdout.write(`   ok=${r5.ok} promo=${r5.promotionRecordPath || "?"} err=${r5.error || "none"}\n`);
  if (!r5.ok) { host.close(); process.exit(1); }

  // Step 6: Registry accept
  process.stdout.write("6. Registry accept...\n");
  const r6: any = await host.writeRuntimeRegistryAcceptanceDecision({ promotionRecordPath: r5.promotionRecordPath, rationale: "Accepted.", acceptedBy: "hermes" });
  process.stdout.write(`   ok=${r6.ok} ${r6.ok ? "*** REGISTERED! ***" : "err=" + (r6.error || "unknown")}\n`);

  host.close();
  process.exit(0);
}

main().catch((e) => { process.stderr.write("FATAL: " + e.message + "\n"); process.exit(1); });
