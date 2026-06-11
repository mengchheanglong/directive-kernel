/**
 * shadcn/ui Callable Capability Executor
 *
 * Implements the Runtime callable contract for shadcn/ui component library.
 * Provides component discovery, documentation, theme validation, and
 * installation guidance as executable Runtime tools.
 */

import type {
  CallableCapability,
  CallableCapabilityDescriptor,
  CallableExecutionInput,
  CallableExecutionResult,
  CallableExecutionMetadata,
} from "../../core/callable-contract.ts";
import { checkCallableContractCompliance } from "../../core/callable-contract.ts";

// --- Configuration ---

const CAPABILITY_ID = "hermes-shadcn-ui";
const TITLE = "shadcn/ui Components";
const FORM = "runtime-callable";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;
const TOOLS = [
  { tool: "list-components", functionName: "listComponents", modulePath: "./executor.ts", inputType: "object", resultType: "object" },
  { tool: "get-component-doc", functionName: "getComponentDoc", modulePath: "./executor.ts", inputType: "object", resultType: "object" },
  { tool: "validate-theme", functionName: "validateTheme", modulePath: "./executor.ts", inputType: "object", resultType: "object" },
  { tool: "get-installation-guide", functionName: "getInstallationGuide", modulePath: "./executor.ts", inputType: "object", resultType: "object" },
] as const;

// --- Disable gate ---

let disabled = false;

export function disableShadcnUiCapability() { disabled = true; }
export function enableShadcnUiCapability() { disabled = false; }
export function isShadcnUiCapabilityEnabled() { return !disabled; }

// --- Component data ---

const COMPONENTS = [
  { name: "Button", category: "inputs", description: "Trigger an action or event with customizable variants and sizes." },
  { name: "Card", category: "layout", description: "Container for grouping related content and actions." },
  { name: "Dialog", category: "overlays", description: "Modal window for focused interactions." },
  { name: "DropdownMenu", category: "navigation", description: "Toggleable contextual overlay for menus." },
  { name: "Form", category: "inputs", description: "Form validation with React Hook Form integration." },
  { name: "Table", category: "data-display", description: "Data table with sorting, filtering, pagination." },
  { name: "Tabs", category: "navigation", description: "Organize content into separate tab views." },
  { name: "Toast", category: "feedback", description: "Temporary notification messages." },
  { name: "Avatar", category: "media", description: "User profile image with fallback initials." },
  { name: "Badge", category: "data-display", description: "Status indicator for counts and labels." },
];

const REQUIRED_THEME_VARS = [
  "--background", "--foreground", "--primary", "--primary-foreground",
  "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
  "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
  "--border", "--input", "--ring", "--radius",
];

// --- Validation ---

function validateInput(tool: string, input: Record<string, unknown>): string | null {
  const validTools: readonly string[] = TOOLS.map((t) => t.tool);
  if (!validTools.includes(tool)) {
    return `Unknown tool: ${tool}. Available: ${validTools.join(", ")}`;
  }
  if (tool === "get-component-doc" && typeof input.component !== "string") {
    return "Field 'component' is required (string)";
  }
  if (tool === "validate-theme" && typeof input.cssVariables !== "object") {
    return "Field 'cssVariables' is required (object)";
  }
  return null;
}

// --- Tool execution ---

function executeListComponents() {
  return {
    components: COMPONENTS,
    totalCount: COMPONENTS.length,
    sourceUrl: "https://github.com/shadcn-ui/ui",
    stars: 116200,
  };
}

function executeGetComponentDoc(input: Record<string, unknown>) {
  const name = String(input.component || "Button");
  const comp = COMPONENTS.find((c) => c.name.toLowerCase() === name.toLowerCase()) || COMPONENTS[0];
  return {
    component: comp.name,
    category: comp.category,
    description: comp.description,
    installation: `npx shadcn-ui@latest add ${comp.name.toLowerCase()}`,
    importStatement: `import { ${comp.name} } from "@/components/ui/${comp.name.toLowerCase()}"`,
    usage: `<${comp.name}>Content</${comp.name}>`,
    sourceUrl: `https://ui.shadcn.com/docs/components/${comp.name.toLowerCase()}`,
  };
}

function executeValidateTheme(input: Record<string, unknown>) {
  const vars = (input.cssVariables as Record<string, string>) || {};
  const missing = REQUIRED_THEME_VARS.filter((v) => !vars[v]);
  const present = REQUIRED_THEME_VARS.filter((v) => vars[v]);
  return {
    valid: missing.length === 0,
    totalThemeVars: REQUIRED_THEME_VARS.length,
    presentVars: present,
    presentCount: present.length,
    missingVars: missing,
    missingCount: missing.length,
  };
}

function executeGetInstallationGuide() {
  return {
    steps: [
      "npx shadcn-ui@latest init",
      "npx shadcn-ui@latest add button card dialog",
      "Import components from @/components/ui/<name>",
      "Customize CSS variables in globals.css",
      "Run your dev server and verify components render",
    ],
    dependencies: ["tailwindcss", "clsx", "tailwind-merge", "class-variance-authority"],
    frameworks: ["Next.js", "Vite", "Remix", "Astro", "Laravel"],
    docsUrl: "https://ui.shadcn.com/docs",
    githubUrl: "https://github.com/shadcn-ui/ui",
  };
}

function executeToolCall(tool: string, data: Record<string, unknown>): unknown {
  switch (tool) {
    case "list-components": return executeListComponents();
    case "get-component-doc": return executeGetComponentDoc(data);
    case "validate-theme": return executeValidateTheme(data);
    case "get-installation-guide": return executeGetInstallationGuide();
    default: throw new Error(`Unknown tool: ${tool}`);
  }
}

// --- Callable execution ---

export async function execute(
  input: CallableExecutionInput,
): Promise<CallableExecutionResult> {
  const startedAt = new Date();
  const metadata: CallableExecutionMetadata = {
    startedAt: startedAt.toISOString(),
    completedAt: startedAt.toISOString(),
    durationMs: 0,
    timeoutMs: Math.min(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS),
    capabilityId: CAPABILITY_ID,
  };

  if (disabled) {
    return {
      ok: false,
      tool: input.tool,
      status: "disabled",
      result: "shadcn/ui capability is disabled",
      metadata: { ...metadata, completedAt: new Date().toISOString() },
    };
  }

  const validationError = validateInput(input.tool, input.input ?? {});
  if (validationError) {
    return {
      ok: false,
      tool: input.tool,
      status: "validation_error",
      result: validationError,
      metadata: { ...metadata, completedAt: new Date().toISOString() },
    };
  }

  const timeoutMs = Math.min(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

  try {
    const result = await Promise.race([
      Promise.resolve(executeToolCall(input.tool, (input.input ?? {}) as Record<string, unknown>)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs),
      ),
    ]);

    const completedAt = new Date();
    return {
      ok: true,
      tool: input.tool,
      status: "success",
      result,
      metadata: {
        ...metadata,
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    };
  } catch (err: any) {
    const completedAt = new Date();
    const isTimeout = err.message === "timeout";
    return {
      ok: false,
      tool: input.tool,
      status: isTimeout ? "timeout" : "error",
      result: err.message || "execution failed",
      metadata: {
        ...metadata,
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    };
  }
}

// --- Capability factory ---

export function createShadcnUiCallableCapability(): CallableCapability {
  const descriptor: CallableCapabilityDescriptor = {
    capabilityId: CAPABILITY_ID,
    status: disabled ? "disabled" : "callable",
    form: FORM,
    title: TITLE,
    toolCount: TOOLS.length,
    tools: TOOLS.map((t) => t.tool),
    defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
    maxTimeoutMs: MAX_TIMEOUT_MS,
  };

  const capability: CallableCapability = {
    descriptor,
    execute,
    disable: disableShadcnUiCapability,
    enable: enableShadcnUiCapability,
    isEnabled: isShadcnUiCapabilityEnabled,
    listTools: () => [...TOOLS],
  };

  const compliance = checkCallableContractCompliance(capability);
  if (!compliance.ok) {
    throw new Error(`shadcn/ui callable contract violation: ${compliance.violations.join("; ")}`);
  }

  return capability;
}

// --- Public re-exports matching the Runtime capability naming convention ---

export { execute as executeShadcnUiTool };

export function listShadcnUiTools() {
  return [...TOOLS];
}
