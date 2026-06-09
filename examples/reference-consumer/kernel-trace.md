# Kernel Trace

This document traces one source through the kernel from submission to operator review. It shows the canonical flow without reimplementing kernel logic.

## 1. Goal Resolution

The host reads the current goal from `DIRECTIVE_GOAL.md` and resolves it into a goal envelope matching the kernel's `shared/contracts/goal-input.md` contract.

```
Goal: "Improve the host project's intake pipeline."
Why now: "Inbound sources are piling up without review."
Adoption target: "runtime"
```

## 2. Discovery Submission

The host submits the source through the Discovery front door with the resolved goal envelope.

The source enters Discovery's intake queue. The kernel assigns a candidate id and begins the intake pipeline.

## 3. Routing

Discovery routes the source. The routing engine scores the source against the current mission, evaluates lane fit, and produces a routing assessment.

The routing assessment includes:
- The recommended lane (runtime, architecture, or hold)
- A confidence score
- Why this route (and why not alternatives)
- Any review guidance for the operator

## 4. State Read

The host reads back kernel-owned state through the snapshot and detail read surfaces.

The snapshot shows:
- The queue entry for this source
- The engine run record with the routing assessment
- The current case stage and next legal step

## 5. Operator Review

The operator reviews the routing decision through the operator decision inbox or detail read surfaces.

If the operator confirms the route, the host opens the route into the downstream lane. If the operator reroutes, the host submits answers through the reroute surface.

Every lifecycle transition requiring operator approval stays explicit. The host does not make autonomous workflow decisions.
