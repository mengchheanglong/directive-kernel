# Host Integration Acceptance

This contract defines the minimum acceptance standard for any host that claims to integrate Directive Workspace correctly.

Directive Workspace is the product.
A host is accepted only if it consumes the canonical product surface without redefining product doctrine, product vocabulary, or Discovery lifecycle behavior locally.

## Acceptance rule

A host integration is acceptable only if it proves all three of these:

1. **Submission path works**
   - the host can submit a canonical Discovery payload through the product-owned submission path
   - queue-only, fast-path, and split-case behavior are preserved

2. **Overview path works**
   - the host can read canonical Discovery queue state and render a recent-entry or queue-summary surface
   - the host does not need to copy Mission Control service logic just to read Discovery state

3. **Signal path works**
   - the host can convert upstream runtime or watchdog events into canonical Discovery submissions
   - the host does not bypass Discovery with a separate host-local incident intake model

## Acceptance report

An acceptance run should produce a bounded report that includes:

- `host_name`
- `accepted`
- `generated_at`
- `module_surface`
- `submission_acceptance`
- `overview_acceptance`
- `signal_acceptance`
- `notes`

The canonical machine-readable form is:
- `shared/schemas/host-integration-acceptance-report.schema.json`

## Minimum expected checks

The host should prove:

- queue-only submission remains `pending`
- fast-path submission routes correctly
- split-case submission routes correctly
- overview reader returns status counts and recent entries from the canonical queue document
- healthy signals do not submit
- detected signals do submit through the canonical Discovery path

## Product-boundary rule

Passing acceptance does **not** mean the host may redefine Directive Workspace.

It only means:

- the host can consume Directive Workspace correctly
- the host can adapt storage/API/UI boundaries safely
- the host respects the canonical Discovery lifecycle

## Integration-kit relationship

The host integration kit starter acceptance harness is the reference implementation for this contract:

- `hosts/integration-kit/starter/host-integration-acceptance.template.ts`

Hosts may replace its storage bridge and adapter wiring, but they should preserve the acceptance semantics.
