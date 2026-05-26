# Requirements Document

## Introduction

The `@directive/kernel` package ingests external sources, frequently by URL, and the standalone host serves a bearer-auth-guarded API for embedding consumers. There is currently no documented threat model, no Server-Side Request Forgery (SSRF) protection on the source-fetching capability executors, no input sanitization or length bounding at API boundaries, no rate limiting on POST endpoints, no offline-only operating mode, and no documented secret-handling policy. This is the credibility floor for a kernel pitched at "embed in another project."

This feature delivers F15 from `Fix_Plan.md`: a written threat model and security policy in `SECURITY.md`, a shared SSRF guard wired into every external-fetch site in the TypeScript kernel, input sanitization and length limits at every API boundary, a token-bucket rate limiter on the standalone host's POST endpoints, a config-driven offline mode, documented secret handling, and a hardening test that asserts the above in CI.

The Python `discovery/research-engine/` providers (GitHub, Tavily, Exa, Firecrawl, Unpaywall) are out of scope for code changes; they are documented as a follow-up in `SECURITY.md` because the Python bridge is invoked through a manifest file rather than a URL, so the TypeScript kernel's direct exposure is limited to the literature-access capability executors and any host-facing fetches.

This work depends on F1 (test infrastructure), which has shipped, and on F2 (JS build), which has shipped.

## Glossary

- **Kernel**: The root TypeScript package `@directive/kernel` at the repository root. Excludes `ui/`, `discovery/research-engine/`, and `hosts/integration-kit/` workspace members.
- **SSRF_Guard**: A shared TypeScript helper located at `shared/lib/ssrf-guard.ts` that exports an `assertUrlIsSafe(url, options)` function. It validates URL scheme, resolves the hostname through DNS, classifies every resolved IP, and rejects any address that falls in a blocked range.
- **Blocked_Address_Range**: Any of: IPv4 loopback (`127.0.0.0/8`), IPv4 private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), IPv4 link-local (`169.254.0.0/16`), IPv4 unspecified (`0.0.0.0/8`), IPv4 multicast (`224.0.0.0/4`), IPv4 reserved (`240.0.0.0/4`), IPv6 loopback (`::1/128`), IPv6 unspecified (`::/128`), IPv6 link-local (`fe80::/10`), IPv6 unique local addresses (`fc00::/7`), IPv6 multicast (`ff00::/8`), and IPv4-mapped IPv6 forms of any of the above.
- **External_Fetch_Site**: Any TypeScript source location in the Kernel that calls `fetch(...)` against a URL not bound to the local in-process server. Identified sites at the time of writing: `runtime/capabilities/literature-access/arxiv-search.ts`, `runtime/capabilities/literature-access/arxiv-download.ts`, `runtime/capabilities/literature-access/openalex-search.ts`, `runtime/capabilities/literature-access/unpaywall-download.ts`. The host server's own `http://${bindHost}:${bindPort}` URL construction is not a fetch site and is excluded.
- **Standalone_Host**: The HTTP server defined in `hosts/standalone-host/server.ts` and configured by `hosts/standalone-host/config.ts`.
- **Standalone_Host_Config**: The resolved configuration object produced by `resolveStandaloneHostConfig(...)` and persisted in `standalone-host.config.json`.
- **Bearer_Token_Auth_Mode**: The `auth.mode === "static_bearer"` configuration of the Standalone_Host where every protected route requires an `Authorization: Bearer <token>` header.
- **None_Auth_Mode**: The `auth.mode === "none"` configuration of the Standalone_Host where protected routes do not require authentication.
- **Rate_Limiter**: A token-bucket rate limiter applied to POST routes on the Standalone_Host, keyed by bearer token.
- **Text_Sanitizer**: A shared TypeScript helper at `shared/lib/text-sanitizer.ts` that strips C0 control characters (U+0000 through U+001F, except U+0009 tab, U+000A line feed, U+000D carriage return) and U+007F DEL from a string and asserts a maximum byte length.
- **Sanitized_Field_Set**: The set of free-text fields that pass through Text_Sanitizer at API ingress: candidate names and titles, source references, mission alignment text, mission feedback, mission preview reasons, goal statements, and rationale strings.
- **External_Fetch_Allowed**: The boolean `runtime.allowExternalFetches` field on Standalone_Host_Config. When `false`, the Standalone_Host refuses every outbound fetch initiated by Kernel code.
- **Hardening_Test**: A Vitest integration test under `tests/integration/hardening/` whose pass/fail is gated by the same CI workflow as every other test.
- **Security_Policy_Document**: The `SECURITY.md` file at the repository root.
- **Reporting_Channel**: A documented contact path in Security_Policy_Document for reporting vulnerabilities.
- **Property_Test**: A test written with `fast-check` that asserts a universal property over generated inputs, configured to run at least 100 iterations per property.

## Requirements

### Requirement 1 — Security policy document

**User Story:** As a kernel adopter, I want a written security policy at the repository root, so that I can understand what the kernel guarantees, what my host must guarantee, and how to report a vulnerability before I embed it.

#### Acceptance Criteria

1. THE Kernel SHALL include a Security_Policy_Document at `SECURITY.md` in the repository root.
2. THE Security_Policy_Document SHALL contain a "Threat model" section that describes attacker capabilities for at least four scenarios: a malicious source URL, a malicious goal envelope, a stolen bearer token, and untrusted access to the directive root filesystem.
3. THE Security_Policy_Document SHALL contain an "In scope" section that enumerates what the Kernel guarantees and an "Out of scope" section that enumerates what the embedding host must guarantee.
4. THE Security_Policy_Document SHALL contain a "Reporting" section that names a Reporting_Channel for vulnerability reports.
5. THE Security_Policy_Document SHALL document the Python `discovery/research-engine/` providers as a known follow-up, naming the providers (GitHub, Tavily, Exa, Firecrawl, Unpaywall) and stating that their per-provider guards are tracked separately.
6. THE Security_Policy_Document SHALL document secret handling per Requirement 6.
7. THE Security_Policy_Document SHALL document the `runtime.allowExternalFetches` flag and its behavior per Requirement 5.
8. THE `README.md` at the repository root SHALL link to Security_Policy_Document from its installation or quickstart section.

### Requirement 2 — SSRF guard module

**User Story:** As a kernel contributor, I want a single shared SSRF_Guard helper that every external fetch routes through, so that the rejection logic is defined once, tested once, and impossible to forget at a call site.

#### Acceptance Criteria

1. THE Kernel SHALL include an SSRF_Guard module at `shared/lib/ssrf-guard.ts` that exports an `assertUrlIsSafe(url, options)` function.
2. WHEN `assertUrlIsSafe` is invoked with a URL whose scheme is not `http` or `https`, THE SSRF_Guard SHALL throw an error whose message starts with `ssrf_blocked_scheme:`.
3. WHEN `assertUrlIsSafe` is invoked with a URL whose hostname resolves through DNS to one or more IP addresses, THE SSRF_Guard SHALL inspect every resolved address.
4. IF any resolved address falls in a Blocked_Address_Range, THEN THE SSRF_Guard SHALL throw an error whose message starts with `ssrf_blocked_address:` and includes both the hostname and the offending address.
5. WHEN `assertUrlIsSafe` is invoked with a URL whose hostname is a literal IP address, THE SSRF_Guard SHALL classify the literal address against Blocked_Address_Range without performing DNS resolution.
6. WHEN `assertUrlIsSafe` is invoked with the option `allowlistDomains` set to a non-empty list, THE SSRF_Guard SHALL reject any URL whose registered hostname does not match the allowlist.
7. WHEN `assertUrlIsSafe` is invoked with the option `allowExternalFetches` set to `false`, THE SSRF_Guard SHALL reject every URL with an error whose message starts with `ssrf_blocked_offline:`.
8. WHEN `assertUrlIsSafe` is invoked with the option `allowLoopback` set to `true`, THE SSRF_Guard SHALL accept URLs whose only resolved addresses are loopback addresses but SHALL still reject every other Blocked_Address_Range.
9. THE SSRF_Guard SHALL accept any URL whose scheme is `http` or `https` and whose every resolved address is a public, non-blocked address.
10. THE SSRF_Guard SHALL reject URLs with the schemes `file`, `data`, `ftp`, `gopher`, and any other scheme not equal to `http` or `https`.

### Requirement 3 — SSRF guard wired into every external fetch site

**User Story:** As a kernel maintainer, I want every existing fetch call in the kernel to route through SSRF_Guard, so that adding the guard changes runtime behavior at the boundary, not just adds a dormant module.

#### Acceptance Criteria

1. WHEN any External_Fetch_Site is about to invoke `fetch(url, ...)`, THE Kernel SHALL invoke `assertUrlIsSafe(url, ...)` immediately before the fetch call and SHALL not invoke the fetch if the assertion throws.
2. THE External_Fetch_Site at `runtime/capabilities/literature-access/arxiv-search.ts` SHALL invoke SSRF_Guard before calling `fetch`.
3. THE External_Fetch_Site at `runtime/capabilities/literature-access/arxiv-download.ts` SHALL invoke SSRF_Guard before calling `fetch`, including for both the PDF URL and the source archive URL.
4. THE External_Fetch_Site at `runtime/capabilities/literature-access/openalex-search.ts` SHALL invoke SSRF_Guard before calling `fetch`.
5. THE External_Fetch_Site at `runtime/capabilities/literature-access/unpaywall-download.ts` SHALL invoke SSRF_Guard before calling `fetch`, including for both the API URL and any redirect-followed download URL.
6. WHEN SSRF_Guard rejects a URL inside an External_Fetch_Site, THE External_Fetch_Site SHALL surface the rejection through its existing error contract (return a structured failure result for executor sites that already do so) without leaking internal stack traces.
7. THE Kernel SHALL include a property test under `tests/property/` that, given an arbitrary URL whose resolved address falls in a Blocked_Address_Range, asserts SSRF_Guard rejects the URL.
8. THE Property_Test for SSRF_Guard SHALL run with at least 100 generated examples per property.

### Requirement 4 — Rate limiter on standalone host POST endpoints

**User Story:** As a host operator, I want POST endpoints rate-limited per bearer token, so that a misbehaving or malicious client cannot exhaust the kernel's filesystem-bound write paths.

#### Acceptance Criteria

1. THE Standalone_Host_Config SHALL expose a `rateLimit` object with fields `requestsPerMinute` (positive integer, default 60) and `burst` (positive integer, default 10).
2. WHILE the Standalone_Host is running in Bearer_Token_Auth_Mode, THE Rate_Limiter SHALL apply a token bucket per distinct bearer token to every POST request whose path matches a protected route prefix.
3. WHEN a POST request arrives in Bearer_Token_Auth_Mode and the token's bucket has at least one token available, THE Rate_Limiter SHALL consume one token and forward the request to the existing handler.
4. IF a POST request arrives in Bearer_Token_Auth_Mode and the token's bucket is empty, THEN THE Rate_Limiter SHALL respond with HTTP 429, set a `Retry-After` header in seconds, and not invoke the existing handler.
5. WHILE the Standalone_Host is running in None_Auth_Mode, THE Rate_Limiter SHALL not apply per-request limits.
6. WHEN the Standalone_Host starts in None_Auth_Mode, THE Standalone_Host SHALL emit a single boot-log warning entry stating that rate limiting is disabled because authentication is disabled.
7. THE Rate_Limiter SHALL keep its state in process memory only and SHALL not persist tokens, buckets, or counters to disk.
8. THE Rate_Limiter SHALL refill each bucket continuously such that, over any sliding 60-second window, a single token receives at most `requestsPerMinute + burst` requests.
9. THE Standalone_Host_Config schema at `shared/schemas/standalone-host-config.schema.json` SHALL document the `rateLimit` object and its defaults.

### Requirement 5 — Offline mode

**User Story:** As an embedding consumer, I want a single configuration switch that disables every external fetch path, so that I can vet the kernel against my directive root without it ever reaching the network.

#### Acceptance Criteria

1. THE Standalone_Host_Config SHALL expose a `runtime.allowExternalFetches` boolean field that defaults to `true`.
2. WHEN `runtime.allowExternalFetches` resolves to `false`, THE Standalone_Host SHALL pass `allowExternalFetches: false` into every SSRF_Guard call performed under its lifetime.
3. WHEN `runtime.allowExternalFetches` resolves to `false` and any External_Fetch_Site is invoked, THE External_Fetch_Site SHALL return its structured failure result with reason `external_fetches_disabled` and SHALL not invoke `fetch`.
4. THE Standalone_Host_Config schema SHALL document the `runtime` object with the `allowExternalFetches` field and its default.
5. THE Security_Policy_Document SHALL document the offline mode, including how to enable it and what executors it disables.

### Requirement 6 — Input sanitization and length limits

**User Story:** As a host operator, I want every free-text field that crosses the API boundary to be length-bounded and stripped of control characters, so that the directive root cannot be polluted with multi-megabyte writes or terminal-control sequences.

#### Acceptance Criteria

1. THE Kernel SHALL include a Text_Sanitizer module at `shared/lib/text-sanitizer.ts` that exports a `sanitizeText(value, options)` function.
2. WHEN `sanitizeText` is invoked with a string containing any C0 control character other than U+0009, U+000A, or U+000D, THE Text_Sanitizer SHALL remove every such character from the returned string.
3. WHEN `sanitizeText` is invoked with a string containing U+007F DEL, THE Text_Sanitizer SHALL remove the DEL character from the returned string.
4. IF `sanitizeText` is invoked with a string whose UTF-8 byte length exceeds the configured `maxBytes`, THEN THE Text_Sanitizer SHALL throw an error whose message starts with `sanitize_too_long:` and includes the field name.
5. THE Text_Sanitizer SHALL preserve every code point that is not a stripped control character, including non-ASCII letters, digits, punctuation, and emoji.
6. WHEN the Standalone_Host receives a POST request whose body contains a field in Sanitized_Field_Set, THE Standalone_Host SHALL invoke Text_Sanitizer on that field before passing the request to its handler.
7. THE Kernel SHALL apply `maxLength: 200` to candidate name and source title fields, `maxLength: 5000` to mission alignment, goal statement, and rationale fields, and `maxLength: 50000` to mission preview markdown fields, expressed as JSON Schema constraints in the corresponding files under `shared/schemas/`.
8. WHEN the Standalone_Host receives a request body whose serialized size exceeds 2 MB, THE Standalone_Host SHALL reject the request with HTTP 400 and error code `request_body_too_large` (existing behavior, codified here).
9. THE Kernel SHALL include a Property_Test under `tests/property/` that asserts `sanitizeText` is idempotent: applying it twice produces the same output as applying it once.

### Requirement 7 — Secret handling policy

**User Story:** As a kernel adopter, I want a written, audited policy on how secrets are sourced, so that my consuming project cannot accidentally check a bearer token or provider API key into version control.

#### Acceptance Criteria

1. THE Security_Policy_Document SHALL state that bearer tokens for the Standalone_Host MAY be supplied via the `auth.bearerToken` config field or via the `auth.bearerTokenEnvName` env-var pointer, and that the env-var path is preferred.
2. THE Security_Policy_Document SHALL state that provider API keys consumed by capability executors MUST be sourced from environment variables and MUST NOT be read from any file inside the directive root.
3. THE Security_Policy_Document SHALL state that the directive root is expected to be gitignored or otherwise excluded from version control by the host project, and that the Kernel guarantees nothing about the secrecy of files written under it.
4. THE existing `auth.bearerToken` versus `auth.bearerTokenEnvName` resolution path in `hosts/standalone-host/config.ts` SHALL remain backward compatible, accepting either source but rejecting both being set simultaneously (existing behavior, codified here).
5. THE Hardening_Test SHALL assert that no source file under `hosts/`, `runtime/`, `engine/`, `discovery/`, `architecture/`, or `shared/` contains a literal string matching the patterns `aws_access_key_id`, `BEGIN PRIVATE KEY`, or a 32+ character base64 string assigned to a variable named `bearerToken`, `apiKey`, `secret`, or `token` (case-insensitive on the variable name).

### Requirement 8 — Hardening test

**User Story:** As a CI gatekeeper, I want every assertion in this spec checkable from a single Vitest file, so that a regression in any one of them fails the build the same way every other test failure does.

#### Acceptance Criteria

1. THE Kernel SHALL include a Hardening_Test file at `tests/integration/hardening/security-checks.test.ts`.
2. THE Hardening_Test SHALL assert that SSRF_Guard rejects URLs resolving to every Blocked_Address_Range listed in the Glossary.
3. THE Hardening_Test SHALL assert that SSRF_Guard rejects the schemes `file:`, `data:`, `ftp:`, and `gopher:`.
4. THE Hardening_Test SHALL assert that SSRF_Guard accepts at least one public-IP test URL with `allowLoopback: false` and rejects `http://localhost` with `allowLoopback: false` while accepting it with `allowLoopback: true`.
5. THE Hardening_Test SHALL assert that the Standalone_Host responds with HTTP 429 when a token's rate-limit bucket is exhausted under Bearer_Token_Auth_Mode.
6. THE Hardening_Test SHALL assert that Text_Sanitizer rejects a string that exceeds its configured `maxBytes` and strips a representative control character.
7. THE Hardening_Test SHALL assert that, when `runtime.allowExternalFetches` resolves to `false`, an SSRF_Guard call rejects a public-IP test URL with the offline error.
8. THE Hardening_Test SHALL run as part of `pnpm run test` and SHALL fail the CI workflow when any assertion above fails.
9. THE Hardening_Test SHALL run the secret-pattern audit defined in Requirement 7.5 across the repository directory tree.
