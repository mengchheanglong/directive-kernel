# Host Callable Adapter Contract

Contract version: `host_callable_adapter.v1`

Use this contract when a host exposes a Runtime candidate through a bounded callable-facing adapter.

This is a narrow Runtime-to-host contract. It distinguishes a descriptor callable from a real Runtime callable execution path without claiming source execution, registry acceptance, promotion automation, or generic support for every Runtime import.

## Required shape

Every `host_callable_adapter.v1` descriptor must include:

- `contractVersion`
- `adapterId`
- `candidateId`
- `candidateName`
- `hostName`
- `hostSurface`
- `callableSurface`
- `capabilityKind`
- `evidencePaths`
- `acceptance`
- `proof`
- `stopLine`

## Capability kinds

- `descriptor_callable`: the host can call a product-owned descriptor/summary surface. This does not mean the imported source executes.
- `runtime_callable_execution`: the host can invoke a Runtime-owned callable through the Runtime execution surface. This still does not mean the original imported source itself executes unless a later contract explicitly proves that.

## Acceptance flags

The adapter must explicitly report:

- `callableThroughHost`
- `descriptorCallableOnly`
- `runtimeCallableExecution`
- `sourceRuntimeExecutionClaimed`
- `hostIntegrationClaimed`
- `registryAcceptanceClaimed`
- `promotionAutomation`
- `runtimeInternalsBypassed`

## Rules

- `descriptorCallableOnly` and `runtimeCallableExecution` must not both be true.
- `sourceRuntimeExecutionClaimed` must remain false in this contract version.
- `registryAcceptanceClaimed` must remain false unless a later registry-acceptance gate explicitly allows it.
- `promotionAutomation` must remain false unless a later policy-gated automation slice explicitly allows it.
- Hosts must preserve evidence paths and proof references so reports remain inspectable.

## Current bounded adopters

- Research Vault standalone-host descriptor callable:
  - `capabilityKind`: `descriptor_callable`
  - source execution remains unclaimed
- Scientify standalone-host consumption path:
  - `capabilityKind`: `runtime_callable_execution`
  - Runtime-owned callable execution is proven through the existing execution surface
