/**
 * shadcn/ui Runtime Capability
 * 
 * Descriptor-only callable adapter for the shadcn/ui component library.
 * Registers the capability in the kernel registry for future operationalization.
 */

export {
  createShadcnUiCallableCapability,
  executeShadcnUiTool,
  disableShadcnUiCapability,
  enableShadcnUiCapability,
  isShadcnUiCapabilityEnabled,
  listShadcnUiTools,
} from "./executor.ts";
