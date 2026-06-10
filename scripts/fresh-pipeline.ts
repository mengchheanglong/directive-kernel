// Fresh clean pipeline — one source, all stages via kernel open functions
import { createStandaloneFilesystemHost } from "../hosts/standalone-host/filesystem-host.ts";
import { writeStandaloneRuntimeFollowUp } from "../hosts/standalone-host/runtime/operations.ts";
import { createFilesystemEngineStore } from "../engine/storage.ts";
import path from "node:path";
import fs from "node:fs";

const NEW_ROOT = "C:/Users/User/AppData/Local/hermes/directive-root-clean/directive-root";
const KERNEL_ROOT = "C:/Users/User/AppData/Local/hermes/systems/directive-kernel";
const TODAY = "2026-06-10";

// Ensure clean root
fs.rmSync(NEW_ROOT, { recursive: true, force: true });
fs.mkdirSync(path.dirname(NEW_ROOT), { recursive: true });

// Bootstrap
const { execSync } = await import("node:child_process");
execSync(`node ${path.join(KERNEL_ROOT, "dist/hosts/standalone-host/cli.js")} init --output-root ${path.dirname(NEW_ROOT)} --received-at ${TODAY}`, { cwd: KERNEL_ROOT, stdio: "pipe" });

// Write goal
const goalContent = `# Hermes Capability Mission
## Goal ID: hermes-capability-bootstrap
## Goal Statement
Operationalize shadcn/ui as a callable Hermes capability with proven execution evidence.
## Why Now
Prove the full pipeline end-to-end.
## Adoption Target: runtime
## Constraints
- Prove through real execution before promotion
- Keep review explicit
- Stay bounded
## Success Signal
One capability promoted to registry and absorbed as a Hermes skill.`;
fs.writeFileSync(path.join(NEW_ROOT, "DIRECTIVE_GOAL.md"), goalContent);

// Submit source via engine
const { Engine } = await import("../engine/engine.ts");
const store = createFilesystemEngineStore({ directiveRoot: NEW_ROOT });

const engine = new Engine({
  laneSet: { discovery: true, runtime: true, architecture: true } as any,
  store,
});

const result = await engine.processSource({
  sourceId: "hermes-shadcn-clean",
  sourceType: "github-repo" as any,
  sourceRef: "https://github.com/shadcn-ui/ui",
  title: "shadcn/ui — Professional React Components",
  summary: "Beautifully-designed accessible components (116K stars). Framework-agnostic code distribution platform. Professional web development capability.",
  missionAlignmentHint: "Build a senior web developer capability for Hermes Agent.",
  notes: ["Clean pipeline test", "116K GitHub stars"],
  goal: {
    goalId: "hermes-capability-bootstrap",
    goalStatement: "Operationalize shadcn/ui as a callable Hermes capability.",
    whyNow: "Prove full pipeline end-to-end.",
    adoptionTarget: "runtime",
    constraints: ["Prove through execution", "Keep review explicit", "Stay bounded"],
    successSignal: "One capability promoted to registry."
  },
  recordShape: "engine_full" as any,
});

console.log("Engine decision:", result.record.decision.decisionState, "→", result.record.selectedLane.laneId);

// Now advance through Runtime using the host open functions
const host = createStandaloneFilesystemHost({ directiveRoot: NEW_ROOT });

// Step 1: Create follow-up artifact (write, not open)
const followUpResult: any = await (host as any).writeRuntimeFollowUp({
  candidate_id: "hermes-shadcn-clean",
  candidate_name: "shadcn/ui",
  follow_up_date: TODAY,
  current_decision_state: "accepted_for_bounded_local_follow_up",
  origin_track: "discovery",
  runtime_value_to_operationalize: "Professional React component library (116K stars).",
  proposed_host: "directive-kernel-standalone-host",
  proposed_integration_mode: "local_shareable_workflow",
  source_pack_allowlist_profile: "hermes-web-dev",
  allowed_export_surfaces: ["@directive/kernel/standalone-host"],
  excluded_baggage: [],
  promotion_contract_path: "shared/contracts/capability.md",
  reentry_preconditions: [],
  required_proof: ["Follow-up and record artifacts written"],
  required_gates: ["check:directive-runtime-proof"],
  trial_scope_limit: ["markdown artifacts only"],
  risks: ["External repo API may change"],
  rollback: "Delete generated artifacts.",
  no_op_path: "Keep in Discovery.",
  review_cadence: "review after proof",
  current_status: "pending_review"
});

const fuPath = followUpResult.followUpPath || followUpResult.artifactPath;
console.log("1. Follow-up:", fuPath || followUpResult);

// Step 2-7: Open through each stage
const steps = [
  { name: "2. Open follow-up → record", fn: () => host.openRuntimeFollowUp({ followUpPath: fuPath, approved: true, approvedBy: "hermes" }) },
];

let currentPath = fuPath;
for (const step of steps) {
  try {
    const r: any = await step.fn();
    console.log(`${step.name}: ok=${r.ok}, path=${r.runtimeRecordPath || r.proofPath || r.capabilityBoundaryPath || r.promotionReadinessPath || r.promotionRecordPath || "?"}`);
    if (!r.ok && r.error) console.log(`  ERROR: ${r.error}`);
    currentPath = r.runtimeRecordPath || r.proofPath || r.capabilityBoundaryPath || r.promotionReadinessPath || currentPath;
  } catch (e: any) {
    console.log(`${step.name}: FATAL ${e.message}`);
    break;
  }
}

host.close();
console.log("\nDone. Check runtime/ directories.");
