import { describe, expect, it } from "vitest";

import {
  DEFAULT_REGISTRY_ENTRY_VERIFICATION,
  migrateRegistryEntryVerification,
  type RegistryEntryVerification,
} from "../../shared/schemas/migrations/registry-entry-verification.ts";

type EntryClass =
  | "verified_capability"
  | "candidate"
  | "placeholder"
  | "note_only"
  | "rejected"
  | "architecture_experiment";

type TestEntry = {
  candidate_id: string;
  candidate_name?: string;
  runtime_status?: string;
  notes?: string[];
  verification?: RegistryEntryVerification | null;
  entry_class?: EntryClass | null;
  projection_kind?: string | null;
  projection_ref?: string | null;
  when_to_use?: string | null;
  failure_modes?: string[] | null;
  verification_ref?: string | null;
  trust_state?: Record<string, unknown> | null;
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

describe("registry entry class and optional Jarvis fields", () => {
  it("legacy entry without entry_class validates (backward compatible)", () => {
    // A legacy entry has only the required fields + verification
    const legacy: TestEntry = {
      candidate_id: "legacy-cap",
      runtime_status: "live",
    };
    const migrated = migrateRegistryEntryVerification(legacy);
    expect(migrated.verification).toBe("placeholder");
    // entry_class is optional and absent — must not throw
    expect(migrated).not.toHaveProperty("entry_class");
  });

  it("legacy entry preserves all existing fields after migration", () => {
    const entry: TestEntry = {
      candidate_id: "full-legacy",
      candidate_name: "Full Legacy Cap",
      runtime_status: "live",
      notes: ["note1", "note2"],
    };
    const migrated = migrateRegistryEntryVerification(entry);
    expect(migrated.candidate_id).toBe("full-legacy");
    expect(migrated.candidate_name).toBe("Full Legacy Cap");
    expect(migrated.runtime_status).toBe("live");
    expect(migrated.notes).toEqual(["note1", "note2"]);
    expect(migrated.verification).toBe("placeholder");
    // New optional Jarvis fields are absent on legacy entries
    expect(migrated).not.toHaveProperty("entry_class");
    expect(migrated).not.toHaveProperty("projection_kind");
    expect(migrated).not.toHaveProperty("trust_state");
  });

  it("entry with explicit entry_class and projection fields is preserved", () => {
    const entry: TestEntry = {
      candidate_id: "verified-cap",
      verification: "verified",
      entry_class: "verified_capability",
      projection_kind: "mcp_tool",
      projection_ref: "shared/schemas/hermes-projection.schema.json",
      when_to_use: "Convert HTML to Markdown",
      failure_modes: ["Timeout on large files", "Malformed HTML"],
      verification_ref: "execution-evidence/html-to-md.json",
      trust_state: {
        score: 0.95,
        success_count: 42,
        partial_count: 3,
        failure_count: 1,
        contract_failure_count: 0,
        last_outcome: "success",
        last_outcome_at: "2026-06-12T10:00:00Z",
      },
    };
    const migrated = migrateRegistryEntryVerification(entry);
    expect(migrated.verification).toBe("verified");
    expect(migrated.entry_class).toBe("verified_capability");
    expect(migrated.projection_kind).toBe("mcp_tool");
    expect(migrated.when_to_use).toBe("Convert HTML to Markdown");
    expect(migrated.failure_modes).toEqual(["Timeout on large files", "Malformed HTML"]);
    expect(migrated.trust_state).toBeDefined();
    expect(migrated.trust_state!.score).toBe(0.95);
    expect(migrated.trust_state!.success_count).toBe(42);
  });

  it("entry_class candidate with no projection is valid", () => {
    const entry: TestEntry = {
      candidate_id: "candidate-cap",
      verification: "claimed",
      entry_class: "candidate",
      when_to_use: "Potentially useful for PDF parsing.",
    };
    const migrated = migrateRegistryEntryVerification(entry);
    expect(migrated.verification).toBe("claimed");
    expect(migrated.entry_class).toBe("candidate");
    expect(migrated.projection_kind).toBeUndefined();
    expect(migrated.when_to_use).toBe("Potentially useful for PDF parsing.");
  });

  it("entry_class with all six allowed values validates", () => {
    const classes: EntryClass[] = [
      "verified_capability",
      "candidate",
      "placeholder",
      "note_only",
      "rejected",
      "architecture_experiment",
    ];
    for (const cls of classes) {
      const entry: TestEntry = {
        candidate_id: `cap-${cls}`,
        verification: cls === "verified_capability" ? "verified" : "placeholder",
        entry_class: cls,
      };
      const migrated = migrateRegistryEntryVerification(entry);
      expect(migrated.entry_class).toBe(cls);
    }
  });
});
