import { describe, it, expect } from "vitest";
import { scanForNamingViolations } from "../../scripts/check-naming.ts";

const FIXTURE: Record<string, string> = {
  "discovery/lib/intake/directive-intake-queue.ts":
    "export interface IntakeQueue {}",
  "runtime/lib/openers/openers-follow-up.ts":
    "export const followUp = () => {};",
  "discovery/lib/test-export.ts":
    "export interface DirectiveEngineRunRecord { runId: string }",
  "runtime/lib/openers/runtime-runtime-capability.ts":
    "export const x = 1;",
  "runtime/lib/openers/follow-up.ts":
    "export const ok = () => {};",
  "architecture/04-materialization/04-bad/some-file.ts":
    "export const x = 1;",
};

describe("check-naming", () => {
  it("fires each rule at least once on its target", () => {
    const violations = scanForNamingViolations(FIXTURE);

    const byRule = (rule: string) => violations.filter((v) => v.rule === rule);
    expect(byRule("directive-prefix-filename").length).toBeGreaterThanOrEqual(1);
    expect(byRule("folder-prefix-filename").length).toBeGreaterThanOrEqual(1);
    expect(byRule("directive-prefix-export").length).toBeGreaterThanOrEqual(1);
    expect(byRule("double-prefix-filename").length).toBeGreaterThanOrEqual(1);
    expect(byRule("nested-numbered-subfolder").length).toBe(1);
  });
});
