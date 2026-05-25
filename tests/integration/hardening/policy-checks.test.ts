import { describe, it } from "vitest";

import {
  runDecisionPolicyCompilerChecks,
  runEarnedAutonomyIntegrationCheck,
  runOutcomeTrackingChecks,
  runReviewResolutionPolicyCompilerIntegrationCheck,
  runRoutingCorrectionLedgerChecks,
} from "../../../scripts/hardening/policy-checks.ts";

describe("policy hardening checks", () => {
  it("runRoutingCorrectionLedgerChecks", async () => {
    await runRoutingCorrectionLedgerChecks();
  });

  it("runOutcomeTrackingChecks", async () => {
    await runOutcomeTrackingChecks();
  });

  it("runDecisionPolicyCompilerChecks", () => {
    runDecisionPolicyCompilerChecks();
  });

  it("runReviewResolutionPolicyCompilerIntegrationCheck", async () => {
    await runReviewResolutionPolicyCompilerIntegrationCheck();
  });

  it("runEarnedAutonomyIntegrationCheck", async () => {
    await runEarnedAutonomyIntegrationCheck();
  });
});
