import { describe, expect, it } from "vitest";

import {
  DEFAULT_REGISTRY_ENTRY_VERIFICATION,
  migrateRegistryEntryVerification,
  type RegistryEntryVerification,
} from "../../shared/schemas/migrations/registry-entry-verification.ts";

type TestEntry = {
  candidate_id: string;
  candidate_name?: string;
  runtime_status?: string;
  notes?: string[];
  verification?: RegistryEntryVerification | null;
};

describe("migrateRegistryEntryVerification", () => {
  it("defaults a legacy entry without the field to placeholder", () => {
    const legacy: TestEntry = { candidate_id: "legacy-cap", runtime_status: "live" };
    const migrated = migrateRegistryEntryVerification(legacy);
    expect(migrated.verification).toBe("placeholder");
    expect(DEFAULT_REGISTRY_ENTRY_VERIFICATION).toBe("placeholder");
  });

  it("defaults an explicit null verification to placeholder", () => {
    const legacy: TestEntry = { candidate_id: "legacy-cap", verification: null };
    const migrated = migrateRegistryEntryVerification(legacy);
    expect(migrated.verification).toBe("placeholder");
  });

  it("preserves an existing verification value", () => {
    for (const value of ["verified", "claimed", "placeholder"] as const) {
      const entry: TestEntry = { candidate_id: "cap", verification: value };
      expect(migrateRegistryEntryVerification(entry).verification).toBe(value);
    }
  });

  it("preserves all other fields", () => {
    const entry: TestEntry = {
      candidate_id: "cap",
      candidate_name: "Cap",
      runtime_status: "live",
      notes: ["a", "b"],
    };
    const migrated = migrateRegistryEntryVerification(entry);
    expect(migrated.candidate_id).toBe("cap");
    expect(migrated.candidate_name).toBe("Cap");
    expect(migrated.runtime_status).toBe("live");
    expect(migrated.notes).toEqual(["a", "b"]);
  });

  it("does not mutate its input", () => {
    const entry: TestEntry = {
      candidate_id: "cap",
    };
    const snapshot = JSON.stringify(entry);
    const migrated = migrateRegistryEntryVerification(entry);
    expect(JSON.stringify(entry)).toBe(snapshot);
    expect(entry).not.toHaveProperty("verification");
    expect(migrated).not.toBe(entry);
  });
});
