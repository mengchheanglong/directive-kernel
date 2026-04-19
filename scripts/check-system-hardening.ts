/// <reference types="node" />

import { runAdvisoryIntelligenceChecks } from "./hardening/advisory-checks.ts";
import {
  runDirectiveEngineHardeningChecks,
  runEngineContractSurfaceChecks,
  runFilesystemStoreCachingChecks,
} from "./hardening/engine-checks.ts";
import {
  runMissionFeedbackLoopChecks,
  runStarterAndHostChecks,
  runWebHostSmoke,
} from "./hardening/host-checks.ts";
import {
  runDecisionPolicyCompilerChecks,
  runEarnedAutonomyIntegrationCheck,
  runOutcomeTrackingChecks,
  runReviewResolutionPolicyCompilerIntegrationCheck,
  runRoutingCorrectionLedgerChecks,
} from "./hardening/policy-checks.ts";

async function main() {
  await runDirectiveEngineHardeningChecks();
  await runFilesystemStoreCachingChecks();
  runEngineContractSurfaceChecks();
  await runRoutingCorrectionLedgerChecks();
  await runOutcomeTrackingChecks();
  runDecisionPolicyCompilerChecks();
  await runReviewResolutionPolicyCompilerIntegrationCheck();
  await runEarnedAutonomyIntegrationCheck();
  await runAdvisoryIntelligenceChecks();
  await runMissionFeedbackLoopChecks();
  await runStarterAndHostChecks();
  await runWebHostSmoke();
  console.log("check-system-hardening: ok");
}

await main();
