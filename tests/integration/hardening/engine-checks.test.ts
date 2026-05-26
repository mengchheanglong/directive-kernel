import { describe, it } from "vitest";

import {
  runEngineHardeningChecks,
  runEngineContractSurfaceChecks,
  runFilesystemStoreCachingChecks,
} from "../../../scripts/hardening/engine-checks.ts";

describe("engine hardening checks", () => {
  it("runEngineHardeningChecks", async () => {
    await runEngineHardeningChecks();
  });

  it("runFilesystemStoreCachingChecks", async () => {
    await runFilesystemStoreCachingChecks();
  });

  it("runEngineContractSurfaceChecks", () => {
    runEngineContractSurfaceChecks();
  });
});
