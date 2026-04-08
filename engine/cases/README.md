# Engine Cases

`engine/cases/` is the Engine-owned mirrored case substrate.

It holds the cross-lane case state that:
- mirrors Discovery-first submissions into durable case records
- records mirrored case events
- materializes case snapshots
- plans read-only next-step recommendations from that mirrored substrate

This is Engine-owned because it spans Discovery, Runtime, and Architecture without becoming a lane lifecycle.
