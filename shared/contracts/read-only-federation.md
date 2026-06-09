# Read-Only Federation Contract

## Federation is read-only

First-version federation is read-only. It aggregates visibility across multiple directive roots without introducing shared mutation semantics. A federation layer may read snapshots, queue summaries, and operator inbox state from multiple kernels, but it must not write.

## No merged workflow state

Federation must not merge workflow state across directive roots. Each directive root maintains its own lifecycle, its own queue, its own routing decisions, and its own artifact graph. Federation presents each root's state separately; it does not synthesize a combined or canonical view that could be mistaken for shared state.

## No remote writes

Federation must not perform writes to remote roots. A federation read from root A must not result in a write to root A, and a federation read from root B must not result in a write to root B. All writes remain scoped to each root's normal host.

## Mutation stays scoped

Mutation remains scoped to each directive root's normal host. An operator wishing to mutate root A must do so through root A's host. An operator wishing to mutate root B must do so through root B's host. Federation does not proxy, route, or relay mutation requests between roots.

## Implementation deferred

This contract defines the boundary. Implementation of federation routes, config, and UI aggregation remains deferred until single-host read surfaces are stable and the integration contracts are proven.
