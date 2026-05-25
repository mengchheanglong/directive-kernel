import { describe, it } from "vitest";

import {
  runMissionFeedbackLoopChecks,
  runStarterAndHostChecks,
  runWebHostSmoke,
} from "../../../scripts/hardening/host-checks.ts";

describe("host hardening checks", () => {
  it("runMissionFeedbackLoopChecks", async () => {
    await runMissionFeedbackLoopChecks();
  });

  it("runStarterAndHostChecks", async () => {
    await runStarterAndHostChecks();
  });

  it("runWebHostSmoke", async () => {
    await runWebHostSmoke();
  });
});
