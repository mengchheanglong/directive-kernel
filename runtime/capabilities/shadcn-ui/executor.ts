/**
 * shadcn/ui Callable Capability Executor
 *
 * Descriptor-only adapter — registers the capability metadata and
 * component reference knowledge for Hermes Agent's web development toolkit.
 * Runtime execution is deferred to future host binding.
 */

import type { RuntimeCallableCapability } from "../../core/callable-execution.ts";

export type ShadcnUiTool = "list_components" | "get_component_docs" | "validate_theme";

const SHADCN_TOOLS: ShadcnUiTool[] = ["list_components", "get_component_docs", "validate_theme"];

let enabled = true;

export function createShadcnUiCallableCapability(): RuntimeCallableCapability {
  return {
    capabilityId: "shadcn-ui",
    displayName: "shadcn/ui",
    description: "Framework-agnostic React component library (116K stars). Accessible, customizable UI components for professional web development.",
    domain: "software-development",
    tools: SHADCN_TOOLS.map((tool) => ({
      name: tool,
      description: getToolDescription(tool),
      inputSchema: { type: "object", properties: {} },
      outputSchema: { type: "object", properties: { result: { type: "string" } } },
    })),
    execute: executeShadcnUiTool,
  };
}

function getToolDescription(tool: ShadcnUiTool): string {
  switch (tool) {
    case "list_components":
      return "List available shadcn/ui components with descriptions and usage patterns.";
    case "get_component_docs":
      return "Get documentation and code examples for a specific shadcn/ui component.";
    case "validate_theme":
      return "Validate a shadcn/ui CSS variable theme configuration.";
  }
}

export async function executeShadcnUiTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (toolName) {
    case "list_components":
      return {
        components: [
          { name: "Button", category: "inputs", description: "Trigger an action or event with customizable variants." },
          { name: "Card", category: "layout", description: "Container for grouping related content and actions." },
          { name: "Dialog", category: "overlays", description: "Modal window for focused interactions or confirmations." },
          { name: "DropdownMenu", category: "navigation", description: "Toggleable contextual overlay for displaying menus." },
          { name: "Form", category: "inputs", description: "Form validation and submission with React Hook Form integration." },
          { name: "Table", category: "data-display", description: "Data table with sorting, filtering, and pagination." },
          { name: "Tabs", category: "navigation", description: "Organize content into separate views with tab navigation." },
          { name: "Toast", category: "feedback", description: "Temporary notification messages for user feedback." },
          { name: "Avatar", category: "media", description: "User profile image with fallback initials support." },
          { name: "Badge", category: "data-display", description: "Status indicator for counts, labels, or states." },
        ],
        totalCount: 10,
        sourceUrl: "https://github.com/shadcn-ui/ui",
        stars: 116200,
      };
    case "get_component_docs":
      return {
        component: args.component || "Button",
        installation: "npx shadcn-ui@latest add button",
        import: 'import { Button } from "@/components/ui/button"',
        usage: '<Button variant="default">Click me</Button>',
        variants: ["default", "destructive", "outline", "secondary", "ghost", "link"],
        props: ["variant", "size", "asChild", "disabled", "className"],
      };
    case "validate_theme": {
      const theme = (args.cssVariables as Record<string, string>) || {};
      const required = ["--background", "--foreground", "--primary", "--primary-foreground"];
      const missing = required.filter((v) => !theme[v]);
      return {
        valid: missing.length === 0,
        missingVariables: missing,
        themeVariablesFound: Object.keys(theme).length,
      };
    }
    default:
      throw new Error(`Unknown shadcn/ui tool: ${toolName}`);
  }
}

export function disableShadcnUiCapability() { enabled = false; }
export function enableShadcnUiCapability() { enabled = true; }
export function isShadcnUiCapabilityEnabled() { return enabled; }
export function listShadcnUiTools() { return [...SHADCN_TOOLS]; }
