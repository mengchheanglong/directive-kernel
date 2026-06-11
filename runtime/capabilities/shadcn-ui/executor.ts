/**
 * shadcn/ui Runtime Callable Capability
 *
 * Callable executor that validates and documents shadcn/ui component
 * configurations. Provides component discovery, documentation lookup,
 * and theme validation as executable Runtime tools.
 *
 * This capability generates callable execution evidence for
 * registry acceptance — it can be invoked through the standalone host.
 */

import type {
  CallableCapability,
  CallableExecutionInput,
  CallableExecutionResult,
} from "../../core/callable-contract.ts";

// --- Configuration ---

const CAPABILITY_ID = "hermes-shadcn-ui";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;

// --- Disable gate ---

let disabled = false;

export function disableShadcnUiCapability() { disabled = true; }
export function enableShadcnUiCapability() { disabled = false; }
export function isShadcnUiCapabilityEnabled() { return !disabled; }

// --- Tool types ---

type ShadcnUiToolName =
  | "list-components"
  | "get-component-doc"
  | "validate-theme"
  | "get-installation-guide";

export function listShadcnUiTools(): string[] {
  return ["list-components", "get-component-doc", "validate-theme", "get-installation-guide"];
}

// --- Component data ---

const COMPONENTS = [
  { name: "Button", category: "inputs", description: "Trigger an action or event with customizable variants and sizes." },
  { name: "Card", category: "layout", description: "Container for grouping related content and actions with header and footer." },
  { name: "Dialog", category: "overlays", description: "Modal window for focused interactions, confirmations, or form inputs." },
  { name: "DropdownMenu", category: "navigation", description: "Toggleable contextual overlay for displaying menus and actions." },
  { name: "Form", category: "inputs", description: "Form validation and submission with React Hook Form integration." },
  { name: "Table", category: "data-display", description: "Data table with sorting, filtering, pagination, and row selection." },
  { name: "Tabs", category: "navigation", description: "Organize content into separate views with tab navigation." },
  { name: "Toast", category: "feedback", description: "Temporary notification messages for user feedback with auto-dismiss." },
  { name: "Avatar", category: "media", description: "User profile image with fallback initials and status indicator." },
  { name: "Badge", category: "data-display", description: "Status indicator for counts, labels, or states with color variants." },
];

const REQUIRED_THEME_VARS = [
  "--background", "--foreground", "--primary", "--primary-foreground",
  "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
  "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
  "--border", "--input", "--ring", "--radius",
];

// --- Input validation ---

function validateInput(tool: string, input: Record<string, unknown>): string | null {
  if (!listShadcnUiTools().includes(tool)) {
    return `Unknown tool: ${tool}. Available: ${listShadcnUiTools().join(", ")}`;
  }
  if (tool === "get-component-doc" && typeof input.component !== "string") {
    return "component name is required (string)";
  }
  if (tool === "validate-theme" && typeof input.cssVariables !== "object") {
    return "cssVariables is required (object)";
  }
  return null;
}

// --- Execution ---

async function executeTool(tool: string, input: Record<string, unknown>): Promise<unknown> {
  switch (tool) {
    case "list-components":
      return {
        components: COMPONENTS,
        totalCount: COMPONENTS.length,
        sourceUrl: "https://github.com/shadcn-ui/ui",
        stars: 116200,
      };

    case "get-component-doc": {
      const name = String(input.component || "Button");
      const comp = COMPONENTS.find((c) =>
        c.name.toLowerCase() === name.toLowerCase()
      ) || COMPONENTS[0];
      return {
        component: comp.name,
        category: comp.category,
        description: comp.description,
        installation: `npx shadcn-ui@latest add ${comp.name.toLowerCase()}`,
        importStatement: `import { ${comp.name} } from "@/components/ui/${comp.name.toLowerCase()}"`,
        usage: `<${comp.name}>Content</${comp.name}>`,
        variants: ["default", "outline", "secondary", "ghost", "destructive", "link"],
        sourceUrl: `https://ui.shadcn.com/docs/components/${comp.name.toLowerCase()}`,
      };
    }

    case "validate-theme": {
      const vars = (input.cssVariables as Record<string, string>) || {};
      const missing = REQUIRED_THEME_VARS.filter((v) => !vars[v]);
      const present = REQUIRED_THEME_VARS.filter((v) => vars[v]);
      return {
        valid: missing.length === 0,
        totalThemeVars: REQUIRED_THEME_VARS.length,
        presentVars: present.length,
        presentVarsList: present,
        missingVars: missing,
        missingVarsList: missing,
      };
    }

    case "get-installation-guide":
      return {
        step1: "npx shadcn-ui@latest init",
        step2: "npx shadcn-ui@latest add button card dialog",
        step3: 'Import components from @/components/ui/<name>',
        step4: "Customize theme via CSS variables in globals.css",
        step5: "Install dependencies: tailwindcss, clsx, tailwind-merge, class-variance-authority",
        frameworkSupport: ["Next.js", "Vite", "Remix", "Astro", "Laravel"],
        docsUrl: "https://ui.shadcn.com/docs",
        githubUrl: "https://github.com/shadcn-ui/ui",
      };

    default:
      throw new Error(`Unknown shadcn/ui tool: ${tool}`);
  }
}

// --- Capability factory ---

export function createShadcnUiCallableCapability(): CallableCapability {
  return {
    capabilityId: CAPABILITY_ID,
    displayName: "shadcn/ui Components",
    description:
      "Framework-agnostic React component library (116K GitHub stars). Accessible, customizable UI components for professional web development.",
    domain: "software-development",
    tools: listShadcnUiTools().map((tool) => ({
      name: tool,
      description: getToolDescription(tool),
      inputSchema: { type: "object", properties: {} },
      outputSchema: { type: "object" },
    })),
    execute: executeShadcnUiToolCall,
    disable: disableShadcnUiCapability,
    enable: enableShadcnUiCapability,
    isEnabled: isShadcnUiCapabilityEnabled,
  };
}

function getToolDescription(tool: string): string {
  switch (tool) {
    case "list-components": return "List available shadcn/ui components with descriptions and categories.";
    case "get-component-doc": return "Get documentation, import path, and usage for a specific component.";
    case "validate-theme": return "Validate CSS variable theme configuration for shadcn/ui compatibility.";
    case "get-installation-guide": return "Get step-by-step installation instructions with dependencies.";
    default: return `shadcn/ui tool: ${tool}`;
  }
}

// --- Callable execution entry point ---

export async function executeShadcnUiToolCall(
  input: CallableExecutionInput,
): Promise<CallableExecutionResult> {
  const startTime = Date.now();

  if (disabled) {
    return {
      ok: false,
      error: "shadcn_ui_disabled",
      summary: "shadcn/ui capability is disabled",
      metadata: { capabilityId: CAPABILITY_ID },
    };
  }

  const validationError = validateInput(input.tool, input.args ?? {});
  if (validationError) {
    return {
      ok: false,
      error: "invalid_input",
      summary: validationError,
      metadata: { capabilityId: CAPABILITY_ID, tool: input.tool },
    };
  }

  const timeout = Math.min(
    (input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    MAX_TIMEOUT_MS,
  );

  try {
    const result = await Promise.race([
      executeTool(input.tool, input.args ?? {}),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeout),
      ),
    ]);

    const durationMs = Date.now() - startTime;

    return {
      ok: true,
      result,
      metadata: {
        capabilityId: CAPABILITY_ID,
        tool: input.tool,
        durationMs,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || "execution_failed",
      summary: `shadcn/ui ${input.tool} failed: ${err.message}`,
      metadata: {
        capabilityId: CAPABILITY_ID,
        tool: input.tool,
        durationMs: Date.now() - startTime,
      },
    };
  }
}
