/**
 * shadcn/ui Runtime Capability
 *
 * Callable adapter for the shadcn/ui component library.
 * Provides component discovery, documentation, theme validation,
 * and installation guidance as executable Runtime tools.
 */

export {
  createShadcnUiCallableCapability,
  executeShadcnUiTool,
  disableShadcnUiCapability,
  enableShadcnUiCapability,
  isShadcnUiCapabilityEnabled,
  listShadcnUiTools,
} from "./executor.ts";
