# Runtime

Runtime is the capability operationalization lane of Directive Kernel.

It turns extracted value into reusable callable capability with bounded proof, rollback, and host-facing packaging.

This repo ships the Runtime operating code:
- `lib/`
- `core/`
- `capabilities/`
- `meta/`

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
