# Engine Coordination

`engine/coordination/` is the Engine-owned coordination and control-selection surface.

It holds the read-only coordination logic that:
- summarizes live lifecycle pressure
- persists bounded coordination cadence in its own ledger
- selects the next completion slice from the control registry

This is Engine-owned because it interprets cross-lane workflow pressure and control state without becoming lane lifecycle code.
