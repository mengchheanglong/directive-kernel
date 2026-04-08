# Integration Kit Examples

These example payloads are the host-neutral input shapes that pair with the integration-kit CLI.

Use them in this order:

1. front-door submission examples
- `discovery-submission-front-door.json`
- `discovery-submission-queue-only.json`
- `discovery-submission-fast-path.json`
- `discovery-submission-split-case.json`

2. acceptance artifact example
- `host-integration-acceptance-report.json`

CLI pairings:

- `print-submission-example --shape <front_door|queue_only|fast_path|split_case>`
- `submission-memory-dry-run --input-json-path <submission example>`
