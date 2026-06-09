import { describe, expect, it } from "vitest";
import {
  projectNextLegalActions,
} from "../../hosts/web-host/data/next-legal-actions.ts";

describe("projectNextLegalActions", () => {
  it("returns empty array for null", () => {
    expect(projectNextLegalActions(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(projectNextLegalActions(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(projectNextLegalActions("")).toEqual([]);
  });

  it("returns empty array for text starting with 'No automatic'", () => {
    expect(projectNextLegalActions("No automatic advancement is legal.")).toEqual([]);
  });

  it("maps follow-up text to runtime_open_follow_up", () => {
    const result = projectNextLegalActions(
      "Open runtime follow-up from the current record.",
    );
    expect(result).toContainEqual({
      name: "runtime_open_follow_up",
      label: "Open runtime follow-up",
      requiresApproval: true,
      source: "nextLegalStep",
    });
  });

  it("maps proof text to runtime_open_proof", () => {
    const result = projectNextLegalActions(
      "Open runtime proof from the runtime record.",
    );
    expect(result).toContainEqual({
      name: "runtime_open_proof",
      label: "Open runtime proof",
      requiresApproval: true,
      source: "nextLegalStep",
    });
  });

  it("maps promotion-readiness text to runtime_open_promotion_readiness", () => {
    const result = projectNextLegalActions(
      "Open promotion-readiness from the capability boundary.",
    );
    expect(result).toContainEqual({
      name: "runtime_open_promotion_readiness",
      label: "Open promotion readiness",
      requiresApproval: true,
      source: "nextLegalStep",
    });
  });

  it("returns both proof and promotion-readiness when both patterns are present", () => {
    const result = projectNextLegalActions(
      "Open promotion-readiness after proof is complete.",
    );
    const actionNames = result.map((a) => a.name);
    expect(actionNames).toContain("runtime_open_proof");
    expect(result).toContainEqual({
      name: "runtime_open_promotion_readiness",
      label: "Open promotion readiness",
      requiresApproval: true,
      source: "nextLegalStep",
    });
  });

  it("maps confirm retention text to architecture_confirm_retention", () => {
    const result = projectNextLegalActions(
      "Confirm retention of the implementation result.",
    );
    expect(result).toContainEqual({
      name: "architecture_confirm_retention",
      label: "Confirm retention",
      requiresApproval: true,
      source: "nextLegalStep",
    });
  });

  it("maps record consumption text to architecture_record_consumption", () => {
    const result = projectNextLegalActions(
      "Record consumption of the integrated artifact.",
    );
    expect(result).toContainEqual({
      name: "architecture_record_consumption",
      label: "Record consumption",
      requiresApproval: true,
      source: "nextLegalStep",
    });
  });

  it("returns multiple actions when text mentions several patterns", () => {
    const result = projectNextLegalActions(
      "Open runtime follow-up and confirm retention of the result.",
    );
    expect(result.length).toBe(2);
    expect(result.map((a) => a.name)).toContain("runtime_open_follow_up");
    expect(result.map((a) => a.name)).toContain("architecture_confirm_retention");
  });
});
