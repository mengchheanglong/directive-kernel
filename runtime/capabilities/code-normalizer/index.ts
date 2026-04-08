/**
 * Directive-owned code normalizer capability.
 *
 * Behavior-preserving transformation callable that normalizes
 * TypeScript/JavaScript code while preserving intended behavior.
 *
 * This is the second Runtime callable capability, proving the
 * callable contract is reusable and demonstrating behavior-preserving
 * transformation as a first-class Runtime pattern.
 */

export { normalizeCode } from "./normalizer.ts";
export type {
  CodeNormalizerInput,
  CodeNormalizerResult,
  CodeNormalizerOutput,
  CodeNormalizerTransformRecord,
} from "./normalizer.ts";

export {
  createCodeNormalizerCallableCapability,
  executeCodeNormalizerTool,
  disableCodeNormalizerCapability,
  enableCodeNormalizerCapability,
  isCodeNormalizerCapabilityEnabled,
  listCodeNormalizerTools,
} from "./executor.ts";
