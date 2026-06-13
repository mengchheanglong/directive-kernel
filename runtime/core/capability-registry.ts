import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  readValidatedEvidence,
  verificationFromEvidence,
} from "../../shared/lib/execution-evidence.ts";

export type RuntimeCapabilityVerification = "verified" | "claimed" | "placeholder" | "runs_unverified_contract";
export type RuntimeCapabilityContract = "complete" | "partial" | "missing";

export type RuntimeEntryClass =
  | "verified_capability"
  | "candidate"
  | "placeholder"
  | "note_only"
  | "rejected"
  | "architecture_experiment";

export type HermesProjectionKind =
  | "mcp_tool"
  | "hermes_skill"
  | "cli_wrapper"
  | "cron_job"
  | "handoff_prompt"
  | "obsidian_note";

export interface RuntimeCapabilityManifestProjection {
  kind?: string;
  id?: string;
  invocation?: string;
  inputContract?: string;
  outputContract?: string;
}

export interface RuntimeCapabilityManifestExample {
  name: string;
  input: Record<string, unknown>;
  expectedOutput: unknown;
  match: "exact" | { invariantFields: string[] };
}

export interface RuntimeCapabilityManifestVerifyBlock {
  command: string;
  fixtures?: string[];
  assertions: Array<{ type: "regex" | "jsonpath" | "schema"; value: string }>;
  timeoutMs: number;
}

export type RuntimeCapabilityManifest = {
  displayName: string;
  description: string;
  domain: "runtime";
  verification?: RuntimeCapabilityVerification;
  inputSchema?: string;
  outputSchema?: string;
  verify?: RuntimeCapabilityManifestVerifyBlock;
  examples?: RuntimeCapabilityManifestExample[];
  contract?: RuntimeCapabilityContract;
  whenToUse?: string;
  failureModes?: string[];
  projection?: RuntimeCapabilityManifestProjection;
  costNotes?: string;
  verificationEvidence?: string;
};

export type RuntimeCapabilityMetadata = {
  id: string;
  displayName: string;
  description: string;
  modulePath: string;
  verification: RuntimeCapabilityVerification;
  contract: RuntimeCapabilityContract;
  entryClass: RuntimeEntryClass;
  projectionKind?: HermesProjectionKind;
  whenToUse?: string;
  failureModes?: string[];
  projectionReady: boolean;
  notUsableReason?: string;
};

export type RuntimeCapabilityScaffoldFile = {
  relativePath: string;
  content: string;
};

export type RuntimeCapabilityScaffold = {
  id: string;
  displayName: string;
  description: string;
  files: RuntimeCapabilityScaffoldFile[];
};

const DEFAULT_CAPABILITIES_ROOT = path.resolve(process.cwd(), "runtime", "capabilities");

function toDisplayName(id: string) {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function toPascalCase(id: string) {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("");
}

export function resolveRuntimeCapabilitiesRoot(capabilitiesRoot?: string) {
  return path.resolve(capabilitiesRoot ?? DEFAULT_CAPABILITIES_ROOT);
}

function resolveCapabilityRoot(capabilitiesRoot: string, id: string) {
  return path.resolve(capabilitiesRoot, id);
}

function resolveCapabilityManifestPath(capabilitiesRoot: string, id: string) {
  return path.resolve(resolveCapabilityRoot(capabilitiesRoot, id), "manifest.json");
}

/**
 * Derive the runtime entry class from manifest verification, contract,
 * and projection metadata. Conservative default: missing fields → placeholder.
 */
export function deriveEntryClass(
  manifest: RuntimeCapabilityManifest,
): RuntimeEntryClass {
  const v = manifest.verification;
  const { projectionReady } = deriveProjectionReadiness(manifest);

  if (projectionReady) {
    return "verified_capability";
  }
  if (v === "verified") {
    return "candidate"; // verified but not projection-ready
  }
  if (v === "runs_unverified_contract") {
    return "candidate";
  }
  if (v === "claimed") {
    return "candidate";
  }
  return "placeholder";
}

/**
 * Derive projection readiness based on manifest verification, contract
 * completeness, and presence of Hermes projection metadata.
 *
 * Rules:
 *  - verified + contract=complete + valid projection metadata + has whenToUse + has failureModes → ready
 *  - verified but missing projection or metadata → not ready (honest label)
 *  - claimed/placeholder → never ready
 */
export function deriveProjectionReadiness(
  manifest: RuntimeCapabilityManifest,
): { projectionReady: boolean; notUsableReason?: string } {
  const v = manifest.verification;

  if (v !== "verified") {
    return {
      projectionReady: false,
      notUsableReason: `verification is '${v ?? "undefined"}' — must be "verified" for projection`,
    };
  }

  if (manifest.contract !== "complete") {
    return {
      projectionReady: false,
      notUsableReason: `contract is '${manifest.contract ?? "missing"}' — must be "complete" for projection`,
    };
  }

  if (!manifest.projection) {
    return {
      projectionReady: false,
      notUsableReason: "no Hermes projection block defined in manifest",
    };
  }

  const projectionKind = resolveProjectionKind(manifest);
  if (!projectionKind) {
    return {
      projectionReady: false,
      notUsableReason: "projection.kind is missing or invalid for Hermes projection",
    };
  }

  if (!manifest.projection.id || manifest.projection.id.trim().length === 0) {
    return {
      projectionReady: false,
      notUsableReason: "missing projection.id — projection-ready capabilities must declare a projection identifier",
    };
  }

  if (!manifest.projection.invocation || manifest.projection.invocation.trim().length === 0) {
    return {
      projectionReady: false,
      notUsableReason: "missing projection.invocation — projection-ready capabilities must declare how Hermes invokes them",
    };
  }

  if (!manifest.whenToUse || manifest.whenToUse.trim().length === 0) {
    return {
      projectionReady: false,
      notUsableReason: "missing whenToUse — must describe when Hermes should invoke this capability",
    };
  }

  if (!manifest.failureModes || manifest.failureModes.length === 0) {
    return {
      projectionReady: false,
      notUsableReason: "missing failureModes — must list known failure modes",
    };
  }

  return { projectionReady: true };
}

/**
 * Resolve the Hermes projection kind from the manifest projection block.
 */
export function resolveProjectionKind(
  manifest: RuntimeCapabilityManifest,
): HermesProjectionKind | undefined {
  const k = manifest.projection?.kind;
  if (!k) return undefined;
  const validKinds: readonly string[] = [
    "mcp_tool", "hermes_skill", "cli_wrapper",
    "cron_job", "handoff_prompt", "obsidian_note",
  ];
  if (validKinds.includes(k)) {
    return k as HermesProjectionKind;
  }
  return undefined;
}

/**
 * Parse the optional projection block from raw manifest JSON.
 */
function parseProjectionBlock(raw: Record<string, unknown>): RuntimeCapabilityManifestProjection | undefined {
  const p = raw.projection;
  if (typeof p !== "object" || p === null) return undefined;
  const proj = p as Record<string, unknown>;
  const parsed = {
    ...(typeof proj.kind === "string" ? { kind: proj.kind } : {}),
    ...(typeof proj.id === "string" ? { id: proj.id } : {}),
    ...(typeof proj.invocation === "string" ? { invocation: proj.invocation } : {}),
    ...(typeof proj.inputContract === "string" ? { inputContract: proj.inputContract } : {}),
    ...(typeof proj.outputContract === "string" ? { outputContract: proj.outputContract } : {}),
  };

  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

/**
 * Extract all Jarvis projection fields from raw manifest JSON.
 * Returns an object with only the fields that are present and valid.
 */
function parseProjectionFields(raw: Record<string, unknown>): Partial<{
  whenToUse: string;
  failureModes: string[];
  projection: RuntimeCapabilityManifestProjection;
  costNotes: string;
  verificationEvidence: string;
}> {
  const result: Partial<{
    whenToUse: string;
    failureModes: string[];
    projection: RuntimeCapabilityManifestProjection;
    costNotes: string;
    verificationEvidence: string;
  }> = {};

  if (typeof raw.whenToUse === "string" && raw.whenToUse.trim().length > 0) {
    result.whenToUse = raw.whenToUse.trim();
  }

  if (Array.isArray(raw.failureModes)) {
    const modes = raw.failureModes.filter((e: unknown): e is string => typeof e === "string" && e.length > 0);
    if (modes.length > 0) {
      result.failureModes = modes;
    }
  }

  const proj = parseProjectionBlock(raw);
  if (proj) {
    result.projection = proj;
  }

  if (typeof raw.costNotes === "string" && raw.costNotes.trim().length > 0) {
    result.costNotes = raw.costNotes.trim();
  }

  if (typeof raw.verificationEvidence === "string" && raw.verificationEvidence.trim().length > 0) {
    result.verificationEvidence = raw.verificationEvidence.trim();
  }

  return result;
}

function parseRuntimeCapabilityManifest(
  manifestPath: string,
): RuntimeCapabilityManifest {
  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Partial<RuntimeCapabilityManifest & { examples?: unknown[] }>;

  // Validate against the JSON Schema — failure flags contract as "missing" but still returns a valid manifest
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  const schemaPath = path.resolve(process.cwd(), "shared/schemas/capability-manifest.schema.json");
  let schemaValid = true;
  if (fs.existsSync(schemaPath)) {
    try {
      const manifestSchema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
      const validate = ajv.compile(manifestSchema);
      schemaValid = validate(parsed);
    } catch {
      schemaValid = false;
    }
  }

  if (parsed.domain !== "runtime") {
    throw new Error(`invalid_runtime_capability_manifest: ${manifestPath} must declare domain "runtime"`);
  }
  if (!parsed.displayName || !parsed.description) {
    throw new Error(`invalid_runtime_capability_manifest: ${manifestPath} must declare displayName and description`);
  }
  const verification =
    parsed.verification === "verified"
    || parsed.verification === "claimed"
    || parsed.verification === "placeholder"
      ? parsed.verification
      : undefined;

  // Parse examples array
  let examples: RuntimeCapabilityManifestExample[] | undefined;
  if (Array.isArray(parsed.examples) && parsed.examples.length > 0) {
    const parsedExamples: RuntimeCapabilityManifestExample[] = [];
    for (const ex of parsed.examples) {
      if (typeof ex !== "object" || ex === null) continue;
      const example = ex as unknown as Record<string, unknown>;
      if (typeof example.name !== "string" || !example.name) continue;
      if (typeof example.input !== "object" || example.input === null) continue;
      const match = example.match;
      if (match === "exact") {
        parsedExamples.push({
          name: example.name,
          input: example.input as Record<string, unknown>,
          expectedOutput: example.expectedOutput,
          match: "exact",
        });
      } else if (typeof match === "object" && match !== null && Array.isArray((match as Record<string, unknown>).invariantFields)) {
        parsedExamples.push({
          name: example.name,
          input: example.input as Record<string, unknown>,
          expectedOutput: example.expectedOutput,
          match: { invariantFields: (match as Record<string, unknown>).invariantFields as string[] },
        });
      }
    }
    if (parsedExamples.length > 0) {
      examples = parsedExamples;
    }
  }

  // Parse verify block if present
  let verify: RuntimeCapabilityManifestVerifyBlock | undefined;
  const rawVerify = (parsed as Record<string, unknown>).verify;
  if (typeof rawVerify === "object" && rawVerify !== null) {
    const v = rawVerify as Record<string, unknown>;
    const assertions = Array.isArray(v.assertions) ? v.assertions as Array<{ type: unknown; value: unknown }> : [];
    const validAssertions = assertions.filter(
      (a) => typeof a === "object" && a !== null &&
        (a.type === "regex" || a.type === "jsonpath" || a.type === "schema") &&
        typeof a.value === "string"
    ).map((a) => ({ type: a.type as "regex" | "jsonpath" | "schema", value: a.value as string }));
    if (typeof v.command === "string" && validAssertions.length > 0) {
      verify = {
        command: v.command,
        ...(Array.isArray(v.fixtures) ? { fixtures: v.fixtures as string[] } : {}),
        assertions: validAssertions,
        timeoutMs: typeof v.timeoutMs === "number" && v.timeoutMs >= 1000 ? v.timeoutMs : 30000,
      };
    }
  }

  // Schema validation failure overrides contract to "missing"
  if (!schemaValid) {
    // Parse projection metadata from raw JSON even when schema fails
    const raw = parsed as Record<string, unknown>;
    const whenToUse = typeof raw.whenToUse === "string" && raw.whenToUse.length > 0 ? raw.whenToUse : undefined;
    const failureModes = Array.isArray(raw.failureModes)
      ? raw.failureModes.filter((e: unknown): e is string => typeof e === "string" && e.length > 0)
      : undefined;
    const projection = parseProjectionBlock(raw);
    const costNotes = typeof raw.costNotes === "string" && raw.costNotes.length > 0 ? raw.costNotes : undefined;
    const verificationEvidence = typeof raw.verificationEvidence === "string" && raw.verificationEvidence.length > 0
      ? raw.verificationEvidence : undefined;

    return {
      displayName: parsed.displayName,
      description: parsed.description,
      domain: parsed.domain,
      ...(verification ? { verification } : {}),
      ...(parsed.inputSchema ? { inputSchema: parsed.inputSchema } : {}),
      ...(parsed.outputSchema ? { outputSchema: parsed.outputSchema } : {}),
      ...(examples ? { examples } : {}),
      ...(verify ? { verify } : {}),
      ...(whenToUse ? { whenToUse } : {}),
      ...(failureModes ? { failureModes } : {}),
      ...(projection ? { projection } : {}),
      ...(costNotes ? { costNotes } : {}),
      ...(verificationEvidence ? { verificationEvidence } : {}),
      contract: "missing",
    };
  }

  // Contract grade: complete = inputSchema + outputSchema + examples
  // partial = has some contract fields but not all
  // missing = no contract fields at all
  let contract: RuntimeCapabilityContract = "missing";
  const hasInput = typeof parsed.inputSchema === "string" && parsed.inputSchema.length > 0;
  const hasOutput = typeof parsed.outputSchema === "string" && parsed.outputSchema.length > 0;
  const hasExamples = examples && examples.length > 0;
  if (hasInput && hasOutput && hasExamples) {
    contract = "complete";
  } else if (hasInput || hasOutput || hasExamples) {
    contract = "partial";
  }

  return {
    displayName: parsed.displayName,
    description: parsed.description,
    domain: parsed.domain,
    ...(verification ? { verification } : {}),
    ...(parsed.inputSchema ? { inputSchema: parsed.inputSchema } : {}),
    ...(parsed.outputSchema ? { outputSchema: parsed.outputSchema } : {}),
    ...(examples ? { examples } : {}),
    ...(verify ? { verify } : {}),
    ...(parseProjectionFields(parsed as Record<string, unknown>)),
    contract,
  };
}

export function readRuntimeCapabilityManifest(input: {
  capabilitiesRoot?: string;
  id: string;
}): RuntimeCapabilityManifest | null {
  const capabilitiesRoot = resolveRuntimeCapabilitiesRoot(input.capabilitiesRoot);
  const manifestPath = resolveCapabilityManifestPath(capabilitiesRoot, input.id);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  return parseRuntimeCapabilityManifest(manifestPath);
}

export function normalizeRuntimeCapabilityId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/g, "")
    .replace(/-+$/g, "")
    .replace(/-+/g, "-");

  if (!normalized) {
    throw new Error("invalid_input: capability name must contain at least one alphanumeric character");
  }

  return normalized;
}

/**
 * Resolve the effective verification status for a capability by
 * checking signed execution evidence.
 *
 * Promotion rule: a capability flips to "verified" ONLY when a current,
 * signed evidence record exists AND its exit code is success (0).
 * Hand-written evidence files without a valid harness signature are
 * rejected — they cannot promote a capability to "verified".
 *
 * @param directiveRoot - Path to the directive root (used to locate
 *   runtime/callable-executions/). If omitted, evidence is not checked
 *   and only the manifest value is used.
 * @param manifestVerification - The verification field from manifest.json
 *   (or undefined for capabilities without one).
 * @param capabilityId - The capability folder name.
 */
export function resolveCapabilityVerification(
  directiveRoot: string | undefined,
  manifestVerification: RuntimeCapabilityVerification | undefined,
  capabilityId: string,
): RuntimeCapabilityVerification {
  if (!directiveRoot) {
    return manifestVerification ?? "placeholder";
  }

  const evDir = path.join(directiveRoot, "runtime", "callable-executions");
  const evidence = readValidatedEvidence(capabilityId, evDir);
  if (evidence) {
    return verificationFromEvidence(evidence);
  }

  if (manifestVerification === "claimed" || manifestVerification === "placeholder") {
    return manifestVerification;
  }

  return "placeholder";
}

export function listRuntimeCapabilityMetadata(
  directiveRoot?: string,
): RuntimeCapabilityMetadata[] {
  const capabilitiesRoot = resolveRuntimeCapabilitiesRoot();
  if (!fs.existsSync(capabilitiesRoot)) {
    return [];
  }

  return fs.readdirSync(capabilitiesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifest = readRuntimeCapabilityManifest({
        capabilitiesRoot,
        id: entry.name,
      });
      const displayName = manifest?.displayName ?? toDisplayName(entry.name);
      const description = manifest?.description
        ?? `Describe the bounded Runtime value exposed by ${displayName}.`;
      const verification = resolveCapabilityVerification(
        directiveRoot,
        manifest?.verification,
        entry.name,
      );
      const contract = manifest?.contract ?? "missing";
      const effectiveManifest = manifest
        ? {
            ...manifest,
            verification,
          }
        : null;

      // Derive Jarvis capability kernel metadata
      const entryClass = effectiveManifest ? deriveEntryClass(effectiveManifest) : "placeholder";
      const { projectionReady, notUsableReason } = effectiveManifest
        ? deriveProjectionReadiness(effectiveManifest)
        : { projectionReady: false, notUsableReason: "no manifest" };
      const projectionKind = effectiveManifest ? resolveProjectionKind(effectiveManifest) : undefined;

      return {
        id: entry.name,
        displayName,
        description,
        modulePath: `runtime/capabilities/${entry.name}/index.ts`,
        verification,
        contract,
        entryClass,
        projectionKind,
        whenToUse: manifest?.whenToUse,
        failureModes: manifest?.failureModes,
        projectionReady,
        ...(notUsableReason ? { notUsableReason } : {}),
      } satisfies RuntimeCapabilityMetadata;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function buildRuntimeCapabilityScaffold(input: {
  name: string;
  description?: string;
}): RuntimeCapabilityScaffold {
  const id = normalizeRuntimeCapabilityId(input.name);
  const displayName = toDisplayName(id);
  const description = String(input.description || "").trim()
    || `Describe the bounded Runtime value exposed by ${displayName}.`;
  const pascalName = toPascalCase(id);
  const manifest: RuntimeCapabilityManifest = {
    displayName,
    description,
    domain: "runtime",
  };

  return {
    id,
    displayName,
    description,
    files: [
      {
        relativePath: `${id}/manifest.json`,
        content: `${JSON.stringify(manifest, null, 2)}\n`,
      },
      {
        relativePath: `${id}/index.ts`,
        content: [
          `export { ${pascalName.toUpperCase()}_CAPABILITY_ID } from "./executor.ts";`,
          `export {`,
          `  create${pascalName}CallableCapability,`,
          `  execute${pascalName}Tool,`,
          `  disable${pascalName}Capability,`,
          `  enable${pascalName}Capability,`,
          `  is${pascalName}CapabilityEnabled,`,
          `  list${pascalName}Tools,`,
          `} from "./executor.ts";`,
          "",
        ].join("\n"),
      },
      {
        relativePath: `${id}/executor.ts`,
        content: [
          `export const ${pascalName.toUpperCase()}_CAPABILITY_ID = "${id}" as const;`,
          "",
          `let enabled = true;`,
          "",
          `export function create${pascalName}CallableCapability() {`,
          `  return {`,
          `    capabilityId: ${pascalName.toUpperCase()}_CAPABILITY_ID,`,
          `    enabled,`,
          `  };`,
          `}`,
          "",
          `export async function execute${pascalName}Tool() {`,
          `  throw new Error("not_implemented: scaffolded capability executor");`,
          `}`,
          "",
          `export function disable${pascalName}Capability() {`,
          `  enabled = false;`,
          `}`,
          "",
          `export function enable${pascalName}Capability() {`,
          `  enabled = true;`,
          `}`,
          "",
          `export function is${pascalName}CapabilityEnabled() {`,
          `  return enabled;`,
          `}`,
          "",
          `export function list${pascalName}Tools() {`,
          `  return [];`,
          `}`,
          "",
        ].join("\n"),
      },
    ],
  };
}

export function writeRuntimeCapabilityScaffold(input: {
  capabilitiesRoot: string;
  name: string;
  description?: string;
  overwrite?: boolean;
}) {
  const scaffold = buildRuntimeCapabilityScaffold({
    name: input.name,
    description: input.description,
  });
  const capabilityRoot = path.resolve(input.capabilitiesRoot, scaffold.id);

  if (fs.existsSync(capabilityRoot) && input.overwrite !== true) {
    throw new Error(`invalid_input: capability scaffold already exists at ${capabilityRoot}`);
  }

  fs.mkdirSync(capabilityRoot, { recursive: true });

  const writtenFiles = scaffold.files.map((file) => {
    const destination = path.resolve(input.capabilitiesRoot, file.relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, file.content, "utf8");
    return destination;
  });

  return {
    ...scaffold,
    capabilityRoot,
    writtenFiles,
  };
}
