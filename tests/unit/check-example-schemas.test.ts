import { describe, it, expect } from "vitest";
import { resolveSchema } from "../../scripts/check-example-schemas.ts";

describe("resolveSchema", () => {
  it("Strategy 1: resolves via $schema field when the referenced file exists", () => {
    const body = { $schema: "shared/schemas/discovery-submission-request.schema.json" };
    const result = resolveSchema("hosts/integration-kit/examples/example.json", body);
    expect(result).toBe("shared/schemas/discovery-submission-request.schema.json");
  });

  it("Strategy 2: resolves via filename convention (foo.example.json -> shared/schemas/foo.schema.json)", () => {
    const body = {};
    const result = resolveSchema(
      "hosts/standalone-host/examples/runtime-follow-up.example.json",
      body,
    );
    expect(result).toBe("shared/schemas/runtime-follow-up.schema.json");
  });

  it("Strategy 2: resolves via filename convention (foo.json -> shared/schemas/foo.schema.json)", () => {
    const body = {};
    const result = resolveSchema(
      "hosts/integration-kit/examples/host-integration-acceptance-report.json",
      body,
    );
    expect(result).toBe("shared/schemas/host-integration-acceptance-report.schema.json");
  });

  it("returns null when no schema can be resolved", () => {
    const body = {};
    const result = resolveSchema("some/unknown/file.json", body);
    expect(result).toBeNull();
  });

  it("returns null when $schema points to a non-existent file and filename convention fails", () => {
    const body = { $schema: "shared/schemas/nonexistent.schema.json" };
    const result = resolveSchema("some/unknown/file.json", body);
    expect(result).toBeNull();
  });
});
