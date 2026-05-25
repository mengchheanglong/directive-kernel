import { describe, it } from "vitest";

import {
  runDirectiveEngineHardeningChecks,
  runEngineContractSurfaceChecks,
  runFilesystemStoreCachingChecks,
} from "../../../scripts/hardening/engine-checks.ts";

describe("engine hardening checks", () => {
  it("runDirectiveEngineHardeningChecks", async () => {
    await runDirectiveEngineHardeningChecks();
  });

  it("runFilesystemStoreCachingChecks", async () => {
    await runFilesystemStoreCachingChecks();
  });

  it("runEngineContractSurfaceChecks", () => {
    runEngineContractSurfaceChecks();
  });
});
