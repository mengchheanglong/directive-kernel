# Engine Execution

`engine/execution/` is the Engine-owned run and execution support surface.

It holds:
- runner and sequence state substrate
- persisted Engine run artifact readers
- run evidence aggregation across the live run corpus

This is Engine-owned because these files support cross-lane execution and reporting rather than a single lane lifecycle.
