import type {
  EnginePrimaryAdoptionTarget,
  EngineSourceItem,
  EngineWorkflowBoundaryShape,
} from "./types.ts";
import { normalizeText } from "./source-utils.ts";

export function normalizeOptionalBoolean(value: unknown) {
  if (value === true || value === false) {
    return value;
  }
  return null;
}

export function normalizePrimaryAdoptionTarget(
  value: unknown,
): EnginePrimaryAdoptionTarget | null {
  if (value === "discovery" || value === "architecture" || value === "runtime") {
    return value;
  }
  return null;
}

export function normalizeWorkflowBoundaryShape(
  value: unknown,
): EngineWorkflowBoundaryShape | null {
  if (value === "bounded_protocol" || value === "iterative_loop") {
    return value;
  }
  return null;
}

export function validateEngineSource(source: EngineSourceItem) {
  const sourceId = normalizeText(source.sourceId);
  const sourceRef = normalizeText(source.sourceRef);
  const title = normalizeText(source.title);
  const summary = normalizeText(source.summary);

  if (!sourceRef) {
    throw new Error("invalid_input: source.sourceRef is required");
  }

  if (!title && !summary && !sourceId) {
    throw new Error(
      "invalid_input: source must include at least one non-empty title, summary, or sourceId field",
    );
  }
}
