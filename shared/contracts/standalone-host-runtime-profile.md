# Standalone Host Runtime Profile

This contract defines the bounded runtime profile for the product-owned standalone reference host.

Purpose:
- let a third-party host or local operator boot Directive Workspace from one config file
- keep runtime state outside Mission Control ownership
- persist minimal operational evidence for boot and request activity without claiming full host parity with Mission Control

Canonical config:
- `hosts/standalone-host/standalone-host.config.example.json`
- `shared/schemas/standalone-host-config.schema.json`

Required runtime profile inputs:
- `directiveRoot`
- `server.host`
- `server.port`

Optional runtime profile inputs:
- `receivedAt`
- `unresolvedGapIds`
- `initialQueue`
- `auth.mode`
- `auth.bearerToken`
- `auth.bearerTokenEnvName`
- `persistence.mode`
- `persistence.sqlitePath`
- `runtimeArtifacts.relativeRoot`
- `runtimeArtifacts.writeStatusFile`
- `runtimeArtifacts.writeAccessLog`
- `runtimeArtifacts.writeBootLog`

Default runtime artifact root:
- `runtime/standalone-host/` under the configured `directiveRoot`

Canonical runtime artifacts:
- `status.json`
- `access-log.jsonl`
- `boot-log.jsonl`

Optional persistence artifact:
- `standalone-host.sqlite`

Minimum runtime status expectations:
- lifecycle state is explicit (`starting`, `running`, `stopped`)
- auth mode is visible without exposing the bearer token
- persistence mode is visible, and the resolved SQLite path may be visible when enabled
- bound server host/port/origin is persisted after boot
- request count and last-request metadata are visible
- the artifact root is discoverable from both `status.json` and the HTTP health/status endpoints

Boundary:
- filesystem remains canonical even when the optional SQLite ledger is enabled
- no claim of broader host/runtime parity beyond this bounded lane
- no auth/session model
- no Mission Control API reuse

This contract governs the reference host profile only.
It does not mean Directive Workspace already replaces Mission Control as the broader host surface.
