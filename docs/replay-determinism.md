# Replay Determinism

## Exact Replay

Exact replay occurs when every input to the replay matches the original run
exactly. The replay engine must produce bit-identical output: same routing
assessment, same lane scores, same decision state, and same report text.

Exact replay is only possible when:
- The same engine version is used
- The same source payload is submitted
- The same mission context is provided
- The same workspace state exists, with no artifact changes
- No external fetches or live research calls were made during the original run,
  or the same external responses are replayed

## Approximate Replay

Approximate replay occurs when some inputs have drifted. The replay engine
produces a best-effort simulation and reports which inputs differ from the
original run.

Approximate replay must explicitly label itself as approximate. The response
must include a list of drifted inputs and a confidence assessment. Consumers
must not treat approximate replay as authoritative.

## Inputs That Must Match

These inputs must match exactly for the replay to be considered exact:
- Source payload, meaning the original submission
- Mission context, including goal envelope, usefulness signals, and capability
  lanes
- Engine version and lane configuration
- Schema version of the original run record

## Inputs That May Drift

These inputs may differ from the original run without invalidating the replay,
though the replay becomes approximate:
- Operator answers, if replaying with different answers is the point
- External research results, if live research is enabled
- Workspace state, if artifacts have been added or modified since the original
  run
- System time, if the replay time differs

## Non-Persistent Rule

Replay must not write records unless a separate explicit write operation is
invoked. Replay is a read-only simulation by default. Any promotion from replay
to a real write must go through the normal workflow entry points with operator
approval.

This rule ensures replay cannot accidentally mutate the workspace or create
orphaned artifacts.
