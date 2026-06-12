import fs from "node:fs";
import path from "node:path";

import {
  readValidatedEvidence,
  verificationFromEvidence,
} from "../../shared/lib/execution-evidence.ts";

export type RuntimeCapabilityVerification = "verified" | "claimed" | "placeholder";

export type RuntimeCapabilityManifest = {
  displayName: string;
  description: string;
  domain: "runtime";
  verification?: RuntimeCapabilityVerification;
  inputSchema?: string;
  outputSchema?: string;
};

export type RuntimeCapabilityMetadata = {
  id: string;
  displayName: string;
  description: string;
  modulePath: string;
  verification: RuntimeCapabilityVerification;
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

function parseRuntimeCapabilityManifest(
  manifestPath: string,
): RuntimeCapabilityManifest {
  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Partial<RuntimeCapabilityManifest>;
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
  return {
    displayName: parsed.displayName,
    description: parsed.description,
    domain: parsed.domain,
    ...(verification ? { verification } : {}),
    ...(parsed.inputSchema ? { inputSchema: parsed.inputSchema } : {}),
    ...(parsed.outputSchema ? { outputSchema: parsed.outputSchema } : {}),
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
  if (directiveRoot) {
    const evDir = path.join(directiveRoot, "runtime", "callable-executions");
    const evidence = readValidatedEvidence(capabilityId, evDir);
    if (evidence) {
      return verificationFromEvidence(evidence);
    }
  }
  return manifestVerification ?? "placeholder";
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
      return {
        id: entry.name,
        displayName,
        description,
        modulePath: `runtime/capabilities/${entry.name}/index.ts`,
        verification,
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
