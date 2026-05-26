# Runtime

Runtime is the capability operationalization lane of Directive Kernel.

It turns extracted value into reusable callable capability with bounded proof, rollback, and host-facing packaging.

This repo ships the Runtime operating code:
- `lib/`
- `core/`
- `capabilities/`
- `meta/`

Where things live:
- **`lib/`** — lifecycle orchestration code (openers, runners, sequences, projections, control logic, writers)
- **`core/`** — contract types that define the Runtime capability, decision, proof, and workflow interfaces
- **`capabilities/`** — concrete callable implementations (literature-access, research-vault, etc.)
- **`meta/`** — baseline promotion profiles for self-improvement
- **`../hosts/standalone-host/`** — the standalone API host implementation
- **`runtime/host-artifacts/`** — runtime artifact directory used by the standalone host server at the consuming-project level (exists inside a directive-root, NOT a host source directory)

It does not ship the old workspace Runtime artifact corpus.

When a consuming project bootstraps a `directive-root`, it should expose these numbered Runtime folders:
- `00-follow-up/`
- `01-callable-integrations/`
- `02-records/`
- `03-proof/`
- `04-capability-boundaries/`
- `05-promotion-readiness/`
- `06-promotion-specifications/`
- `07-promotion-records/`
- `08-registry/`

Reference host support lives in:
- `../hosts/standalone-host/`
- `../hosts/web-host/`
