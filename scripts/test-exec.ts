import { createShadcnUiCallableCapability } from "../runtime/capabilities/shadcn-ui/index.ts";
import { checkCallableContractCompliance } from "../runtime/core/callable-contract.ts";

const cap = createShadcnUiCallableCapability();
const check = checkCallableContractCompliance(cap);
console.log("Contract check:", check.ok ? "PASS" : "FAIL — " + check.violations.join("; "));

// Test each tool
for (const tool of ["list-components", "get-component-doc", "validate-theme", "get-installation-guide"]) {
  const input: any = { tool };
  if (tool === "get-component-doc") input.input = { component: "Button" };
  if (tool === "validate-theme") input.input = { cssVariables: { "--background": "#fff" } };
  const result = await cap.execute(input);
  console.log(`${tool}: ok=${result.ok} status=${result.status} ${result.ok ? "(data returned)" : ""}`);
}

console.log("\nDisable test...");
cap.disable();
const disabled = await cap.execute({ tool: "list-components", input: {} });
console.log(`Disabled: ok=${disabled.ok} status=${disabled.status}`);
cap.enable();
console.log("Re-enabled:", cap.isEnabled());
