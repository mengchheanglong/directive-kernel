/**
 * React Bits Callable Capability Executor
 *
 * Implements the Runtime callable contract for React Bits.
 * Provides component discovery, documentation lookup, theme/config validation,
 * and installation guidance as executable Runtime tools.
 */

import type {
  CallableCapability,
  CallableCapabilityDescriptor,
  CallableExecutionInput,
  CallableExecutionResult,
  CallableExecutionMetadata,
} from "../../core/callable-contract.ts";
import { checkCallableContractCompliance } from "../../core/callable-contract.ts";

const CAPABILITY_ID = "hermes-react-bits";
const TITLE = "React Bits Components";
const FORM = "runtime-callable";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;
const TOOLS = [
  { tool: "list-components", functionName: "listComponents", modulePath: "./executor.ts", inputType: "object", resultType: "object" },
  { tool: "get-component-doc", functionName: "getComponentDoc", modulePath: "./executor.ts", inputType: "object", resultType: "object" },
  { tool: "validate-config", functionName: "validateConfig", modulePath: "./executor.ts", inputType: "object", resultType: "object" },
  { tool: "get-installation-guide", functionName: "getInstallationGuide", modulePath: "./executor.ts", inputType: "object", resultType: "object" },
] as const;

let disabled = false;
export function disableCapability() { disabled = true; }
export function enableCapability() { disabled = false; }
export function isCapabilityEnabled() { return !disabled; }

const COMPONENTS = [
  { name: "Animated Button", category: "inputs", description: "Motion-enhanced call-to-action buttons." },
  { name: "Magnetic Card", category: "layout", description: "Interactive hover/magnetic card patterns." },
  { name: "Text Reveal", category: "typography", description: "Animated text entrance and reveal effects." },
  { name: "Particle Background", category: "media", description: "Interactive animated particle backdrops." },
  { name: "Spotlight", category: "effects", description: "Spotlight and glow visual effects for hero areas." },
  { name: "Marquee", category: "motion", description: "Animated marquee and looping content rails." },
];

function validateInput(tool: string, input: Record<string, unknown>): string | null {
  const validTools = TOOLS.map((t) => t.tool);
  if (!(validTools as readonly string[]).includes(tool)) {
    return `Unknown tool: ${tool}. Available: ${validTools.join(", ")}`;
  }
  if (tool === "get-component-doc" && typeof input.component !== "string") {
    return "Field 'component' is required (string)";
  }
  if (tool === "validate-config" && typeof input.config !== "object") {
    return "Field 'config' is required (object)";
  }
  return null;
}

function executeListComponents() {
  return {
    components: COMPONENTS,
    totalCount: COMPONENTS.length,
    sourceUrl: "https://github.com/DavidHDev/react-bits",
    stars: 40729,
  };
}

function executeGetComponentDoc(input: Record<string, unknown>) {
  const name = String(input.component || COMPONENTS[0].name);
  const comp = COMPONENTS.find((c) => c.name.toLowerCase() === name.toLowerCase()) || COMPONENTS[0];
  return {
    component: comp.name,
    category: comp.category,
    description: comp.description,
    sourceUrl: "https://www.reactbits.dev/",
    repoUrl: "https://github.com/DavidHDev/react-bits",
  };
}

function executeValidateConfig(input: Record<string, unknown>) {
  const config = (input.config as Record<string, unknown>) || {};
  return {
    valid: true,
    keysProvided: Object.keys(config),
    note: "Descriptor-level validation only; integrate library-specific checks in host adapters as needed.",
  };
}

function executeGetInstallationGuide() {
  return {
    steps: ["pnpm add react-bits", "Import components from react-bits package or local copies", "Configure animation dependencies when required"],
    frameworks: ["Next.js", "Vite", "Remix", "Astro"],
    docsUrl: "https://www.reactbits.dev/",
    githubUrl: "https://github.com/DavidHDev/react-bits",
  };
}

function executeToolCall(tool: string, data: Record<string, unknown>): unknown {
  switch (tool) {
    case "list-components": return executeListComponents();
    case "get-component-doc": return executeGetComponentDoc(data);
    case "validate-config": return executeValidateConfig(data);
    case "get-installation-guide": return executeGetInstallationGuide();
    default: throw new Error(`Unknown tool: ${tool}`);
  }
}

export async function execute(input: CallableExecutionInput): Promise<CallableExecutionResult> {
  const startedAt = new Date();
  const metadata: CallableExecutionMetadata = {
    startedAt: startedAt.toISOString(),
    completedAt: startedAt.toISOString(),
    durationMs: 0,
    timeoutMs: Math.min(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS),
    capabilityId: CAPABILITY_ID,
  };

  if (disabled) {
    return { ok: false, tool: input.tool, status: "disabled", result: "capability is disabled", metadata: { ...metadata, completedAt: new Date().toISOString() } };
  }

  const validationError = validateInput(input.tool, input.input ?? {});
  if (validationError) {
    return { ok: false, tool: input.tool, status: "validation_error", result: validationError, metadata: { ...metadata, completedAt: new Date().toISOString() } };
  }

  const timeoutMs = Math.min(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
  try {
    const result = await Promise.race([
      Promise.resolve(executeToolCall(input.tool, (input.input ?? {}) as Record<string, unknown>)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    const completedAt = new Date();
    return { ok: true, tool: input.tool, status: "success", result, metadata: { ...metadata, completedAt: completedAt.toISOString(), durationMs: completedAt.getTime() - startedAt.getTime() } };
  } catch (err: any) {
    const completedAt = new Date();
    const isTimeout = err.message === "timeout";
    return { ok: false, tool: input.tool, status: isTimeout ? "timeout" : "error", result: err.message || "execution failed", metadata: { ...metadata, completedAt: completedAt.toISOString(), durationMs: completedAt.getTime() - startedAt.getTime() } };
  }
}

export function createCallableCapability(): CallableCapability {
  const descriptor: CallableCapabilityDescriptor = {
    capabilityId: CAPABILITY_ID,
    status: "callable",
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
    disable: disableCapability,
    enable: enableCapability,
    isEnabled: isCapabilityEnabled,
    listTools: () => [...TOOLS],
  };

  const compliance = checkCallableContractCompliance(capability);
  if (!compliance.ok) {
    throw new Error(`React Bits callable contract violation: ${compliance.violations.join("; ")}`);
  }
  return capability;
}
