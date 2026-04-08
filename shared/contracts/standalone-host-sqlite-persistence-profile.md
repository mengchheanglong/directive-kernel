# Standalone Host SQLite Persistence Profile

This contract defines the optional SQLite-backed persistence lane for the Directive Workspace standalone reference host.

Purpose:
- keep filesystem artifacts canonical and host-readable
- add stronger product-owned persistence than JSON/JSONL files alone
- avoid coupling Directive Workspace to Mission Control's database stack

Mode:
- `persistence.mode = filesystem` keeps the reference host file-backed only
- `persistence.mode = filesystem_and_sqlite` keeps filesystem artifacts and also writes a product-owned SQLite ledger

SQLite runtime boundary:
- implementation uses Node `node:sqlite`
- this is explicitly an experimental runtime dependency owned by the standalone reference host, suitable for local/shareable standalone use but not proof of broader host parity
- the SQLite lane must stay optional and fail-closed

Default path behavior:
- when `persistence.mode = filesystem_and_sqlite` and `persistence.sqlitePath` is omitted, the host must default to `runtime/standalone-host/standalone-host.sqlite` under the configured Directive root
- when `persistence.sqlitePath` is provided, it becomes the resolved database path for the host

Minimum required ledger coverage:
- runtime session start/stop events
- served request log entries
- discovery queue snapshots whenever `discovery/intake-queue.json` is rewritten
- text/json artifact write ledger entries with content hash and byte length

Visibility rules:
- runtime status must expose `persistence.mode`
- runtime status may expose the resolved SQLite path
- runtime status must state that the SQLite lane is experimental when enabled

Non-goals:
- replacing canonical Markdown/JSON artifacts
- replacing Mission Control's runtime database
- claiming broader host/runtime completeness beyond this local/shareable persistence lane
