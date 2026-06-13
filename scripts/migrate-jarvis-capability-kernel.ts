import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  listRuntimeCapabilityMetadata,
  type RuntimeCapabilityMetadata,
  type RuntimeEntryClass,
  type RuntimeCapabilityVerification,
} from "../runtime/core/capability-registry.ts";
import {
  isExecutionEvidenceShape,
  validateExecutionEvidence,
  verificationFromEvidence,
  type ExecutionEvidence,
} from "../shared/lib/execution-evidence.ts";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const DEFAULT_DIRECTIVE_ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";

export type JarvisMigrationCategory =
  | "verified_projection_ready"
  | "verified_missing_projection"
  | "candidate"
  | "claimed"
  | "placeholder"
  | "note_only"
  | "rejected"
  | "architecture_experiment";

export type JarvisInventorySourceKind = "registry_entry" | "manifest_only";

export type JarvisMigrationRecord = {
  id: string;
  displayName: string;
  sourceKind: JarvisInventorySourceKind;
  category: JarvisMigrationCategory;
  proposedEntryClass: RuntimeEntryClass;
  projectionReady: boolean;
  verification: RuntimeCapabilityVerification | "missing";
  contract: "complete" | "partial" | "missing" | "unknown";
  rationale: string;
  recommendedAction: string;
  registryPath?: string;
  evidencePath?: string;
  legacyVerification?: string | null;
  notUsableReason?: string;
};

export type JarvisMigrationInventory = {
  root: string;
  registryEntriesScanned: number;
  manifestCapabilitiesScanned: number;
  matchedRegistryEntries: number;
  registryOnlyEntries: number;
  manifestOnlyEntries: number;
  records: JarvisMigrationRecord[];
};

type ParsedArgs = {
  root: string;
  explicitDryRun: boolean;
  apply: boolean;
};

type ParsedRegistryEntry = {
  id: string;
  displayName: string;
  relativePath: string;
  legacyVerification: string | null;
  evidencePath: string | null;
};

const CATEGORY_ORDER: JarvisMigrationCategory[] = [
  "verified_projection_ready",
  "verified_missing_projection",
  "candidate",
  "claimed",
  "placeholder",
  "note_only",
  "rejected",
  "architecture_experiment",
];

const CATEGORY_LABELS: Record<JarvisMigrationCategory, string> = {
  verified_projection_ready: "verified projection-ready",
  verified_missing_projection: "verified but missing projection",
  candidate: "candidate",
  claimed: "claimed",
  placeholder: "placeholder",
  note_only: "note_only",
  rejected: "rejected",
  architecture_experiment: "architecture_experiment",
};

const CATEGORY_ACTIONS: Record<JarvisMigrationCategory, string> = {
  verified_projection_ready: "Keep as a usable Hermes power and refresh verification evidence on the normal cadence.",
  verified_missing_projection: "Backfill a complete Hermes projection block, whenToUse, and failureModes before exposing this as a power.",
  candidate: "Finish proof and contract verification, then add projection metadata only after the capability is honestly verified.",
  claimed: "Re-run the capability with signed verification evidence and keep it non-usable until failures are resolved.",
  placeholder: "Leave it non-usable; either add real manifest and verification evidence or keep it as historical inventory only.",
  note_only: "Keep it as note/wiki memory and do not project it as a Runtime power.",
  rejected: "Retain only for audit/history and do not promote it into Runtime.",
  architecture_experiment: "Route it to Architecture with a bounded experiment, measurement command, and rollback plan.",
};

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let root = DEFAULT_DIRECTIVE_ROOT;
  let explicitDryRun = false;
  let apply = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--root" && index + 1 < args.length) {
      root = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      explicitDryRun = true;
      continue;
    }
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  return {
    root: path.resolve(root).replace(/\\/g, "/"),
    explicitDryRun,
    apply,
  };
}

function printUsage() {
  console.log("Usage: npx tsx scripts/migrate-jarvis-capability-kernel.ts [--root <directive-root>] [--dry-run]");
  console.log("Default behavior is dry-run safe and does not mutate registry entries.");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractBulletValue(content: string, label: string): string | null {
  const match = content.match(new RegExp(`^- ${escapeRegex(label)}: ?(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function stripCodeFence(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const fenced = trimmed.match(/^`(.+)`$/);
  return fenced ? fenced[1] : trimmed;
}

function normalizeOptionalValue(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || /^n\/a$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function readValidatedEvidenceAtPath(absolutePath: string): ExecutionEvidence | null {
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as unknown;
    if (!isExecutionEvidenceShape(parsed)) {
      return null;
    }
    if (!validateExecutionEvidence(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseRegistryEntry(root: string, absolutePath: string): ParsedRegistryEntry | null {
  try {
    const content = fs.readFileSync(absolutePath, "utf8");
    const relativePath = path.relative(root, absolutePath).replace(/\\/g, "/");
    const fallbackId = path.basename(absolutePath).replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-registry-entry\.md$/, "");
    const id = normalizeOptionalValue(extractBulletValue(content, "Candidate id")) ?? fallbackId;
    const displayName = normalizeOptionalValue(extractBulletValue(content, "Candidate name")) ?? id;
    const evidencePath = stripCodeFence(
      normalizeOptionalValue(extractBulletValue(content, "Callable execution evidence"))
      ?? normalizeOptionalValue(extractBulletValue(content, "Proof path")),
    );
    const legacyVerification = normalizeOptionalValue(extractBulletValue(content, "Verification"));

    return {
      id,
      displayName,
      relativePath,
      legacyVerification,
      evidencePath,
    };
  } catch {
    return null;
  }
}

function categoryFromManifestMetadata(metadata: RuntimeCapabilityMetadata): {
  category: JarvisMigrationCategory;
  proposedEntryClass: RuntimeEntryClass;
  rationale: string;
} {
  if (metadata.entryClass === "note_only") {
    return {
      category: "note_only",
      proposedEntryClass: "note_only",
      rationale: "manifest already marks this entry as note_only; it should not surface as a Runtime power",
    };
  }
  if (metadata.entryClass === "rejected") {
    return {
      category: "rejected",
      proposedEntryClass: "rejected",
      rationale: "manifest already marks this entry as rejected; keep it out of Runtime projection",
    };
  }
  if (metadata.entryClass === "architecture_experiment") {
    return {
      category: "architecture_experiment",
      proposedEntryClass: "architecture_experiment",
      rationale: "manifest already marks this entry as an architecture experiment; route it to Architecture instead of Runtime",
    };
  }
  if (metadata.verification === "verified" && metadata.projectionReady) {
    return {
      category: "verified_projection_ready",
      proposedEntryClass: "verified_capability",
      rationale: "verified execution, complete contract, and usable Hermes projection metadata are all present",
    };
  }
  if (metadata.verification === "verified") {
    return {
      category: "verified_missing_projection",
      proposedEntryClass: "candidate",
      rationale: metadata.notUsableReason ?? "verified execution exists, but projection metadata is incomplete",
    };
  }
  if (metadata.verification === "runs_unverified_contract") {
    return {
      category: "candidate",
      proposedEntryClass: "candidate",
      rationale: "execution evidence exists, but it is exit-only or otherwise below contract-grade verification",
    };
  }
  if (metadata.verification === "claimed") {
    return {
      category: "claimed",
      proposedEntryClass: "candidate",
      rationale: "signed evidence exists, but the latest reported outcome is still a failure",
    };
  }
  if (metadata.entryClass === "candidate") {
    return {
      category: "candidate",
      proposedEntryClass: "candidate",
      rationale: metadata.notUsableReason ?? "the entry is not yet verified enough to become a Hermes power",
    };
  }
  return {
    category: "placeholder",
    proposedEntryClass: "placeholder",
    rationale: metadata.notUsableReason ?? "no manifest-backed verification or projection evidence is available",
  };
}

function categoryFromRegistryOnlyEvidence(input: {
  legacyVerification: string | null;
  evidence: ExecutionEvidence | null;
}): {
  category: JarvisMigrationCategory;
  proposedEntryClass: RuntimeEntryClass;
  verification: RuntimeCapabilityVerification | "missing";
  rationale: string;
} {
  if (input.evidence) {
    const evidenceVerification = verificationFromEvidence(input.evidence);
    if (evidenceVerification === "verified") {
      return {
        category: "verified_missing_projection",
        proposedEntryClass: "candidate",
        verification: "verified",
        rationale: "contract-grade execution evidence exists, but no manifest-backed Hermes projection metadata was found",
      };
    }
    if (evidenceVerification === "runs_unverified_contract") {
      return {
        category: "candidate",
        proposedEntryClass: "candidate",
        verification: "runs_unverified_contract",
        rationale: "legacy exit-only evidence exists, but the capability has not reached contract-grade verification",
      };
    }
    return {
      category: "claimed",
      proposedEntryClass: "candidate",
      verification: "claimed",
      rationale: "signed execution evidence exists, but the latest run is still failing",
    };
  }

  return {
    category: "placeholder",
    proposedEntryClass: "placeholder",
    verification: "missing",
    rationale:
      input.legacyVerification === "verified"
        ? "legacy registry text says verified, but no current signed contract-grade evidence or projection metadata exists"
        : "no valid signed execution evidence or manifest-backed projection metadata was found",
  };
}

function resolveRegistryEvidence(root: string, entry: ParsedRegistryEntry): {
  evidence: ExecutionEvidence | null;
  evidencePath?: string;
} {
  const candidatePaths = new Set<string>();
  if (entry.evidencePath) {
    candidatePaths.add(path.resolve(root, entry.evidencePath).replace(/\\/g, "/"));
  }
  candidatePaths.add(path.resolve(root, "runtime", "callable-executions", `${entry.id}-execution.json`).replace(/\\/g, "/"));

  for (const candidatePath of candidatePaths) {
    const evidence = readValidatedEvidenceAtPath(candidatePath);
    if (evidence) {
      return { evidence, evidencePath: candidatePath };
    }
  }

  return { evidence: null };
}

function buildRecordFromMetadata(
  metadata: RuntimeCapabilityMetadata,
  sourceKind: JarvisInventorySourceKind,
  registryPath?: string,
): JarvisMigrationRecord {
  const classification = categoryFromManifestMetadata(metadata);
  return {
    id: metadata.id,
    displayName: metadata.displayName,
    sourceKind,
    category: classification.category,
    proposedEntryClass: classification.proposedEntryClass,
    projectionReady: metadata.projectionReady,
    verification: metadata.verification,
    contract: metadata.contract,
    rationale: classification.rationale,
    recommendedAction: CATEGORY_ACTIONS[classification.category],
    ...(registryPath ? { registryPath } : {}),
    ...(metadata.notUsableReason ? { notUsableReason: metadata.notUsableReason } : {}),
  };
}

function buildRecordFromRegistryOnly(root: string, entry: ParsedRegistryEntry): JarvisMigrationRecord {
  const { evidence, evidencePath } = resolveRegistryEvidence(root, entry);
  const classification = categoryFromRegistryOnlyEvidence({
    legacyVerification: entry.legacyVerification,
    evidence,
  });

  return {
    id: entry.id,
    displayName: entry.displayName,
    sourceKind: "registry_entry",
    category: classification.category,
    proposedEntryClass: classification.proposedEntryClass,
    projectionReady: false,
    verification: classification.verification,
    contract: evidence ? (classification.verification === "verified" ? "unknown" : "unknown") : "unknown",
    rationale: classification.rationale,
    recommendedAction: CATEGORY_ACTIONS[classification.category],
    registryPath: entry.relativePath,
    ...(evidencePath ? { evidencePath } : {}),
    ...(entry.legacyVerification ? { legacyVerification: entry.legacyVerification } : {}),
  };
}

export function deriveJarvisMigrationInventory(input?: {
  root?: string;
}): JarvisMigrationInventory {
  const root = path.resolve(input?.root ?? DEFAULT_DIRECTIVE_ROOT).replace(/\\/g, "/");
  const registryDir = path.join(root, "runtime", "08-registry");
  const metadataList = listRuntimeCapabilityMetadata(root);
  const metadataById = new Map(metadataList.map((metadata) => [metadata.id, metadata]));
  const records: JarvisMigrationRecord[] = [];
  const seenIds = new Set<string>();
  let registryEntriesScanned = 0;
  let matchedRegistryEntries = 0;
  let registryOnlyEntries = 0;

  if (fs.existsSync(registryDir)) {
    const registryFiles = fs.readdirSync(registryDir)
      .filter((fileName) => fileName.endsWith("-registry-entry.md"))
      .sort();

    for (const fileName of registryFiles) {
      const absolutePath = path.join(registryDir, fileName);
      const entry = parseRegistryEntry(root, absolutePath);
      if (!entry) {
        continue;
      }
      registryEntriesScanned += 1;
      seenIds.add(entry.id);
      const metadata = metadataById.get(entry.id);
      if (metadata) {
        matchedRegistryEntries += 1;
        records.push(buildRecordFromMetadata(metadata, "registry_entry", entry.relativePath));
      } else {
        registryOnlyEntries += 1;
        records.push(buildRecordFromRegistryOnly(root, entry));
      }
    }
  }

  let manifestOnlyEntries = 0;
  for (const metadata of metadataList) {
    if (seenIds.has(metadata.id)) {
      continue;
    }
    manifestOnlyEntries += 1;
    records.push(buildRecordFromMetadata(metadata, "manifest_only"));
  }

  return {
    root,
    registryEntriesScanned,
    manifestCapabilitiesScanned: metadataList.length,
    matchedRegistryEntries,
    registryOnlyEntries,
    manifestOnlyEntries,
    records: records.sort((left, right) => {
      if (left.category !== right.category) {
        return CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
      }
      return left.id.localeCompare(right.id);
    }),
  };
}

export function summarizeJarvisMigrationInventory(
  inventory: JarvisMigrationInventory,
): Record<JarvisMigrationCategory, number> {
  const counts = Object.fromEntries(
    CATEGORY_ORDER.map((category) => [category, 0]),
  ) as Record<JarvisMigrationCategory, number>;

  for (const record of inventory.records) {
    counts[record.category] += 1;
  }

  return counts;
}

function printCategoryExamples(inventory: JarvisMigrationInventory, category: JarvisMigrationCategory) {
  const matches = inventory.records.filter((record) => record.category === category).slice(0, 5);
  if (matches.length === 0) {
    return;
  }

  console.log(`  Examples (${matches.length}${inventory.records.filter((record) => record.category === category).length > matches.length ? "+" : ""}):`);
  for (const record of matches) {
    const sourceTag = record.sourceKind === "registry_entry" ? "registry" : "manifest";
    console.log(`    - ${record.id} [${sourceTag}] -> ${record.proposedEntryClass}`);
    console.log(`      rationale: ${record.rationale}`);
    if (record.notUsableReason) {
      console.log(`      blocked by: ${record.notUsableReason}`);
    }
  }
}

export function printJarvisMigrationSummary(input: {
  inventory: JarvisMigrationInventory;
  modeLabel?: string;
}): void {
  const inventory = input.inventory;
  const counts = summarizeJarvisMigrationInventory(inventory);
  const modeLabel = input.modeLabel ?? "dry-run";

  console.log("=== Jarvis Capability Kernel Migration Audit ===\n");
  console.log(`Mode: ${modeLabel}`);
  console.log("Mutation: none");
  console.log(`Directive root: ${inventory.root}`);
  console.log(`Registry entries scanned: ${inventory.registryEntriesScanned}`);
  console.log(`Manifest capabilities scanned: ${inventory.manifestCapabilitiesScanned}`);
  console.log(`Registry entries already backed by manifests: ${inventory.matchedRegistryEntries}`);
  console.log(`Registry-only historical entries: ${inventory.registryOnlyEntries}`);
  console.log(`Manifest-only capabilities: ${inventory.manifestOnlyEntries}`);
  console.log("\nProposed Jarvis migration categories:");

  for (const category of CATEGORY_ORDER) {
    console.log(`- ${CATEGORY_LABELS[category]}: ${counts[category]}`);
  }

  console.log("\nNext recommended action per class:");
  for (const category of CATEGORY_ORDER) {
    console.log(`- ${CATEGORY_LABELS[category]}: ${CATEGORY_ACTIONS[category]}`);
  }

  console.log("\nClass detail:");
  for (const category of CATEGORY_ORDER) {
    console.log(`- ${CATEGORY_LABELS[category]} (${counts[category]})`);
    printCategoryExamples(inventory, category);
  }

  console.log("\nSafety notes:");
  console.log("- Default behavior is dry-run safe. This script does not rewrite or delete registry entries.");
  console.log("- Placeholder and claimed entries remain non-usable until they become honestly verified and projection-ready.");
  console.log("- Verified-but-missing-projection entries stay blocked until projection metadata is complete.");
}

function main() {
  const args = parseArgs();
  if (args.apply) {
    console.error("Refusing to mutate: BUILD 8 ships a dry-run-only migration audit. Re-run without --apply.");
    process.exit(2);
  }

  const inventory = deriveJarvisMigrationInventory({ root: args.root });
  const modeLabel = args.explicitDryRun ? "dry-run (explicit)" : "dry-run (default)";
  printJarvisMigrationSummary({
    inventory,
    modeLabel,
  });
}

const isMain = process.argv[1] ? path.resolve(process.argv[1]) === SCRIPT_PATH : false;
if (isMain) {
  main();
}
