# Host Integration Kit

Use this kit when another project wants to embed Directive Kernel instead of using the reference hosts directly.

The integration rule is:

1. keep the host thin
2. keep the consuming project's goal resolver outside the kernel
3. keep the human-facing goal source of truth in `DIRECTIVE_GOAL.md` at the consuming project root or directive root
4. submit work through the canonical Discovery front door
5. consume kernel contracts, schemas, and libs before inventing host-local lifecycle surfaces

Primary exports:
- `@directive/kernel/integration-kit`
- `@directive/kernel/integration-kit/starter`
- `@directive/kernel/integration-kit/cli`

Internal structure:
- `starter/` is the copy-facing template and smoke surface
- `lib/` is the reusable executable support surface used by hosts and the integration CLI

Use `lib/` for real executable dependencies. Use `starter/` only when you need copyable template shapes.

Main references:
- `shared/contracts/host-integration-boundary.md`
- `shared/contracts/host-integration-acceptance.md`
- `shared/contracts/goal-input.md`
- `DIRECTIVE_GOAL.md`
- `shared/contracts/runtime-to-host.md`
- `hosts/integration-kit/FIRST_INTEGRATION.md`

Use the starter folder when your host needs copied templates.
Use direct package imports when your host can depend on the kernel repo directly.

For the first real consuming-host path, start with:
- `hosts/integration-kit/FIRST_INTEGRATION.md`
- `hosts/integration-kit/examples/first-consuming-host.flow.ts`
- `examples/reference-consumer/flow.ts`
