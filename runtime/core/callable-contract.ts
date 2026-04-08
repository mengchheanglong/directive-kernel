/**
 * Directive Runtime Callable Capability Contract.
 *
 * This is the minimal shared contract that every Runtime-owned callable
 * capability must satisfy. Extracted from the first real callable
 * (Scientify literature-access) to support reusable capability execution.
 *
 * A callable capability is a Directive-owned execution unit that:
 * - accepts validated input
 * - executes within a bounded timeout
 * - returns structured results with execution metadata
 * - can be disabled/enabled for rollback
 */

// --- Capability descriptor ---

export interface DirectiveCallableCapabilityDescriptor {
  capabilityId: string;
  status: "callable" | "disabled";
  form: string;
  title: string;
  toolCount: number;
  tools: readonly string[];
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
}

// --- Execution input/output ---

export interface DirectiveCallableExecutionInput {
  tool: string;
  input: Record<string, unknown>;
  timeoutMs?: number;
}

export type DirectiveCallableExecutionStatus =
  | "success"
  | "error"
  | "timeout"
  | "disabled"
  | "validation_error";

export interface DirectiveCallableExecutionMetadata {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  timeoutMs: number;
  capabilityId: string;
}

export interface DirectiveCallableExecutionResult {
  ok: boolean;
  tool: string;
  status: DirectiveCallableExecutionStatus;
  result: unknown;
  metadata: DirectiveCallableExecutionMetadata;
}

// --- Callable capability interface ---

export interface DirectiveCallableCapability {
  descriptor: DirectiveCallableCapabilityDescriptor;
  execute: (input: DirectiveCallableExecutionInput) => Promise<DirectiveCallableExecutionResult>;
  disable: () => void;
  enable: () => void;
  isEnabled: () => boolean;
  listTools: () => Array<{
    tool: string;
    functionName: string;
    modulePath: string;
    inputType: string;
    resultType: string;
  }>;
}

// --- Contract compliance check ---

export function checkCallableContractCompliance(
  capability: DirectiveCallableCapability,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  const d = capability.descriptor;

  if (!d.capabilityId || typeof d.capabilityId !== "string") {
    violations.push("descriptor.capabilityId must be a non-empty string");
  }
  if (d.status !== "callable" && d.status !== "disabled") {
    violations.push("descriptor.status must be 'callable' or 'disabled'");
  }
  if (!d.form || typeof d.form !== "string") {
    violations.push("descriptor.form must be a non-empty string");
  }
  if (!d.title || typeof d.title !== "string") {
    violations.push("descriptor.title must be a non-empty string");
  }
  if (typeof d.toolCount !== "number" || d.toolCount < 1) {
    violations.push("descriptor.toolCount must be >= 1");
  }
  if (!Array.isArray(d.tools) || d.tools.length === 0) {
    violations.push("descriptor.tools must be a non-empty array");
  }
  if (d.tools.length !== d.toolCount) {
    violations.push(`descriptor.toolCount (${d.toolCount}) must match tools.length (${d.tools.length})`);
  }
  if (typeof d.defaultTimeoutMs !== "number" || d.defaultTimeoutMs <= 0) {
    violations.push("descriptor.defaultTimeoutMs must be a positive number");
  }
  if (typeof d.maxTimeoutMs !== "number" || d.maxTimeoutMs <= 0) {
    violations.push("descriptor.maxTimeoutMs must be a positive number");
  }
  if (d.maxTimeoutMs < d.defaultTimeoutMs) {
    violations.push("descriptor.maxTimeoutMs must be >= defaultTimeoutMs");
  }

  if (typeof capability.execute !== "function") {
    violations.push("execute must be a function");
  }
  if (typeof capability.disable !== "function") {
    violations.push("disable must be a function");
  }
  if (typeof capability.enable !== "function") {
    violations.push("enable must be a function");
  }
  if (typeof capability.isEnabled !== "function") {
    violations.push("isEnabled must be a function");
  }
  if (typeof capability.listTools !== "function") {
    violations.push("listTools must be a function");
  }

  const tools = capability.listTools();
  if (tools.length !== d.toolCount) {
    violations.push(`listTools() returned ${tools.length} tools but descriptor says ${d.toolCount}`);
  }

  return { ok: violations.length === 0, violations };
}
