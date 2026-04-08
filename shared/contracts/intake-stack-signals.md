# Intake Stack Signals Contract

Profile: `intake_stack_signals/v1`

Purpose:
- improve Discovery and Architecture routing quality by capturing stack shape early
- distinguish stack metadata from integration intent
- prevent scaffolder or starter-kit inputs from being mistaken for product adoption targets

Required fields:
- `stack.language`
- `stack.runtime`
- `stack.framework`
- `stack.packageTool`
- `stack.deployment`
- `stack.externalDependencies`
- `stack.dataModelAssumptions`
- `stack.integrationShape`

Routing rules:
- prefer `Directive Architecture` when:
  - value is mostly contract, pattern, workflow, or framework improvement
  - runtime surface is broad or risky
  - the source looks stack-shaped but the useful value is governance or structure
- prefer `Directive Runtime` when:
  - the value is a bounded callable/helper capability
  - runtime objective is explicit and reversible
  - current host gates can validate the runtime surface safely
- prefer `Discovery hold state` when:
  - stack information exists but no explicit adoption target is actionable yet
  - source is useful context without immediate integration pressure

Boilerplate boundary:
- stack signals are routing metadata only
- starter kits, scaffolders, and generated templates must not be treated as product dependencies by default
- a broad scaffolder/runtime import requires a separate explicit decision

Validation hooks:
- `npm run check:directive-celtrix-contracts`
- `npm run check:directive-workflow-doctrine`
- `npm run check:ops-stack`
