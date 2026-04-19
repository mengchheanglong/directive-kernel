import type {
  DirectiveEnginePrimaryAdoptionTarget,
  DirectiveEngineSourceItem,
  DirectiveEngineWorkflowBoundaryShape,
} from "./types.ts";
import { normalizeText } from "./engine-source-utils.ts";

export function normalizeOptionalBoolean(value: unknown) {
  if (value === true || value === false) {
    return value;
  }
  return null;
}

export function normalizePrimaryAdoptionTarget(
  value: unknown,
): DirectiveEnginePrimaryAdoptionTarget | null {
  if (value === "discovery" || value === "architecture" || value === "runtime") {
    return value;
  }
  return null;
}

export function normalizeWorkflowBoundaryShape(
  value: unknown,
): DirectiveEngineWorkflowBoundaryShape | null {
  if (value === "bounded_protocol" || value === "iterative_loop") {
    return value;
  }
  return null;
}

export function validateDirectiveEngineSource(source: DirectiveEngineSourceItem) {
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
