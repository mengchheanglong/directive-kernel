import fs from "node:fs";
import path from "node:path";

export type RuntimeCapabilityMetadata = {
  id: string;
  displayName: string;
  description: string;
  modulePath: string;
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

const STATIC_CAPABILITIES: RuntimeCapabilityMetadata[] = [
  {
    id: "code-normalizer",
    displayName: "Code Normalizer",
    description:
      "Normalizes source code artifacts into a standardized representation for downstream processing.",
    modulePath: "runtime/capabilities/code-normalizer/index.ts",
  },
  {
    id: "literature-access",
    displayName: "Literature Access",
    description:
      "Provides access to academic and technical literature through the Scientify research bundle.",
    modulePath: "runtime/capabilities/literature-access/index.ts",
  },
  {
    id: "research-vault-source-pack",
    displayName: "Research Vault Source Pack",
    description:
      "Packages research vault sources into consumable bundles for the kernel intake pipeline.",
    modulePath: "runtime/capabilities/research-vault-source-pack/index.ts",
  },
];

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

export function listRuntimeCapabilityMetadata(): RuntimeCapabilityMetadata[] {
  return [...STATIC_CAPABILITIES].sort((a, b) => a.id.localeCompare(b.id));
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
  const manifest = {
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
