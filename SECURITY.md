# Security Policy

Directive Kernel is a bounded workflow kernel intended to be embedded by a
host project. This policy describes what the kernel protects, what remains the
host's responsibility, and how to report vulnerabilities.

## Threat Model

### Malicious Source URL

An attacker may submit a source URL that points at local files, loopback
services, private network addresses, metadata endpoints, or DNS names that
resolve to blocked addresses. Kernel-owned TypeScript fetch sites must route
through the shared SSRF guard before making outbound requests.

### Malicious Goal Envelope

An attacker may provide a goal statement, mission alignment note, rationale, or
preview body containing terminal controls, very large text, or misleading
instructions. Host API ingress strips unsafe control characters and enforces
byte-length limits before passing these fields into kernel workflows.

### Stolen Bearer Token

An attacker with a valid standalone-host bearer token can call protected API
routes until the token is revoked by the host operator. When bearer auth is
enabled, the standalone host rate-limits protected POST routes per bearer token
to reduce filesystem write exhaustion.

### Untrusted Directive Root Filesystem

An attacker with write access to the directive root can tamper with artifacts,
ledgers, and workflow state. The kernel does not provide cryptographic
tamper-evidence for directive-root files. Hosts must treat directive roots as
operator-owned local state and protect them with normal filesystem controls.

## In Scope

- SSRF protection on TypeScript kernel external fetch sites.
- Blocking non-HTTP(S) schemes before outbound fetches.
- Blocking loopback, private, link-local, unspecified, multicast, reserved, and
  IPv6 unique-local addresses unless a caller explicitly allows loopback.
- Config-driven offline mode through `runtime.allowExternalFetches: false`.
- Standalone-host bearer-token authentication for protected routes.
- In-memory token-bucket rate limiting for protected POST routes when bearer
  authentication is enabled.
- Free-text control-character stripping and byte-length limits at standalone
  host API ingress.
- Documentation of host/kernel responsibility boundaries.

## Out of Scope

- OAuth, mTLS, identity-provider integration, or user/session management.
- CSRF protection; the reference host uses bearer-token API calls, not cookies.
- Cryptographic signing of run records, ledgers, or artifact files.
- Tamper-evident audit logs.
- OS-level network sandboxing or firewall policy.
- Multi-process or multi-host write coordination for the same directive root.
- Secret storage, rotation, or vault integration.
- Per-provider network guards inside the Python `discovery/research-engine/`
  providers. See Follow-ups.

## Secret Handling

- Standalone-host bearer tokens may be supplied with `auth.bearerToken` or with
  `auth.bearerTokenEnvName`. The environment-variable pointer is preferred.
- `auth.bearerToken` and `auth.bearerTokenEnvName` must not both be set. The
  existing config resolver rejects that ambiguous state.
- Provider API keys consumed by capability executors must come from environment
  variables. They must not be read from files inside the directive root.
- The directive root is expected to be gitignored or otherwise excluded from
  version control by the host project.
- The kernel does not guarantee secrecy for any file written under the
  directive root.

## Offline Mode

Set this in `standalone-host.config.json` to disable outbound TypeScript kernel
fetches:

```json
{
  "runtime": {
    "allowExternalFetches": false
  }
}
```

When this flag is `false`, SSRF guard calls fail with
`ssrf_blocked_offline:` and literature-access executors return structured
failures with `error: "external_fetches_disabled"`.

## Reporting

Reporting channel: use a private GitHub Security Advisory for this repository.
If private advisories are unavailable, contact the repository maintainer
directly and do not open a public issue containing exploit details.

Include:

- affected commit or version
- reproduction steps
- expected vs actual behavior
- whether a source URL, goal envelope, bearer token, or directive-root file is
  involved

## Follow-ups

The Python `discovery/research-engine/` providers are tracked separately for
provider-specific network guards. Known providers:

- GitHub
- Tavily
- Exa
- Firecrawl
- Unpaywall

