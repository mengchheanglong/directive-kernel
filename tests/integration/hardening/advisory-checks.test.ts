import { describe, it } from "vitest";

import { runAdvisoryIntelligenceChecks } from "../../../scripts/hardening/advisory-checks.ts";

describe("advisory intelligence checks", () => {
  it("runs advisory intelligence checks", async () => {
    await runAdvisoryIntelligenceChecks();
  });
});
