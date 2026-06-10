// Direct Runtime advancement script
// Calls kernel open functions with existing follow-up paths
import { createStandaloneFilesystemHost } from "../hosts/standalone-host/filesystem-host.ts";

const DIRECTIVE_ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";
const host = createStandaloneFilesystemHost({ directiveRoot: DIRECTIVE_ROOT });
const DATE = "2026-06-10";

const components = [
  { id: "hermes-webdev-shadcn-ui", name: "shadcn/ui" },
  { id: "hermes-webdev-daisyui", name: "daisyUI" },
  { id: "hermes-webdev-react-bits", name: "React Bits" },
  { id: "hermes-webdev-react-bootstrap", name: "React Bootstrap" },
  { id: "hermes-webdev-tremor", name: "Tremor" },
];

for (const { id, name } of components) {
  const followUpPath = `runtime/00-follow-up/${DATE}-${id}-runtime-follow-up-record.md`;
  
  console.log(`\n=== ${name} ===`);
  
  try {
    // Step 1: Open follow-up → creates record
    const r1 = await host.openRuntimeFollowUp({
      followUpPath,
      approved: true,
      approvedBy: "hermes-agent-operator",
    });
    console.log(`1. Follow-up opened: ${(r1 as any).runtimeRecordPath || "OK"}`);
    
    const recordPath = (r1 as any).runtimeRecordPath || `runtime/02-records/${DATE}-${id}-runtime-record.md`;
    
    // Step 2: Open record → creates proof  
    const r2 = await host.openRuntimeRecordProof({
      runtimeRecordPath: recordPath,
      approved: true,
      approvedBy: "hermes-agent-operator",
    });
    console.log(`2. Record proof opened: ${(r2 as any).proofPath || "OK"}`);
    
    const proofPath = (r2 as any).proofPath || `runtime/03-proof/${DATE}-${id}-gate-snapshot.json`;
    
    // Step 3: Open proof → creates capability boundary
    const r3 = await host.openRuntimeProofRuntimeCapabilityBoundary({
      runtimeProofPath: proofPath,
      approved: true,
      approvedBy: "hermes-agent-operator",
    });
    console.log(`3. Capability boundary: ${(r3 as any).capabilityBoundaryPath || "OK"}`);
    
    const cbPath = (r3 as any).capabilityBoundaryPath;
    
    if (cbPath) {
      // Step 4: Open capability boundary → creates promotion readiness
      const r4 = await host.openRuntimePromotionReadiness({
        capabilityBoundaryPath: cbPath,
        approved: true,
        approvedBy: "hermes-agent-operator",
      });
      console.log(`4. Promotion readiness: ${(r4 as any).promotionReadinessPath || "OK"}`);
    }
    
  } catch (err: any) {
    console.log(`ERROR: ${err.message}`);
  }
}

host.close();
console.log("\nDone.");
