# First Host Integration

Use this path when a larger operating system wants to embed Directive Kernel for the first real bounded integration.

The host should do only four things:

1. resolve one current goal envelope
2. pass one source into Discovery
3. read back kernel-owned state
4. surface bounded review items without inventing a second lifecycle

## Canonical Path

Use the executable integration-kit surface:

- `@directive/kernel/integration-kit`

Relevant helpers:

- `prepareDirectiveKernelFirstHostRoot(...)`
- `buildDiscoverySubmissionFromGoalEnvelope(...)`
- `submitDiscoveryEntryThroughFrontDoor(...)`
- `readFirstHostKernelSnapshot(...)`
- `runFirstHostIntegrationFlow(...)`

## Minimal End-To-End Example

Executable example:

```powershell
node --experimental-strip-types ./hosts/integration-kit/examples/first-consuming-host.flow.ts
```

That example:

1. loads a goal envelope
2. prepares the minimum canonical directive-root files
3. submits one source through the Engine-backed Discovery front door
4. reads back:
   - Discovery overview
   - workspace state
   - operator decision inbox

## Recommended Host Shape

Keep the host thin:

1. resolve current goal locally
2. call `prepareDirectiveKernelFirstHostRoot(...)` for the directive root
3. build a submission with `buildDiscoverySubmissionFromGoalEnvelope(...)`
4. submit with `submitDiscoveryEntryThroughFrontDoor(...)`
5. render `readFirstHostKernelSnapshot(...)`

## Do Not Do This In Host Code

- do not re-score Discovery routing locally
- do not create a second queue or second routing lifecycle
- do not infer current goals from old kernel artifacts
- do not bypass Discovery to open Runtime or Architecture artifacts directly
- do not replace the operator inbox with host-local lifecycle semantics

The host may decide how to display state, but it should not redefine the kernel’s bounded workflow model.
