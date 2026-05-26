# Implementation Plan: Directive Kernel Security Posture

## Overview

Land F15 from `Fix_Plan.md`: a written threat model, a shared SSRF guard wired into every external-fetch site in the TypeScript kernel, length-bounded and control-character-stripped input at every API ingress, a token-bucket rate limiter on the standalone host's POST endpoints, a config-driven offline mode, documented secret handling, and a hardening test that asserts all of it in CI.

Tasks are ordered so that helper modules land first (they are pure, easy to test in isolation), then they wire into the host and capability executors, then SECURITY.md is written, then the hardening test ties everything together. Property tests for SSRF guard, sanitizer, and rate limiter sit immediately next to the modules they exercise so a regression in any helper is caught before the wiring step that depends on it.

The Python `discovery/research-engine/` providers are not modified in this spec; they are documented as a follow-up in SECURITY.md.

Every task in this plan is mandatory. No task is marked optional.

## Tasks

- [x] 1. Add the SSRF guard module
  - [x] 1.1 Create `shared/lib/ssrf-guard.ts`
    - Export `assertUrlIsSafe(url, options)` matching the signature in the design
    - Implement the algorithm: offline short-circuit → scheme check → allowlist check → IP classification (literal IP path and DNS path)
    - Implement `classifyAddress(addr)` covering IPv4 loopback/private/link-local/unspecified/multicast/reserved and IPv6 loopback/unspecified/link-local/ULA/multicast plus IPv4-mapped IPv6 unmapping
    - Use `dns.lookup` with `{ all: true, family: 0, verbatim: true }` for the default resolver
    - Throw plain `Error` instances with the message prefixes `ssrf_blocked_offline:`, `ssrf_blocked_scheme:`, `ssrf_blocked_allowlist:`, `ssrf_blocked_address:`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 1.2 Add `tests/property/_arbitraries/ip-address.ts`
    - Export `blockedIpv4Arb`, `publicIpv4Arb`, `blockedIpv6Arb`, `publicIpv6Arb`, and tagged-union `classifiedIpArb` returning `{ kind: "blocked" | "public", address }`
    - Cover every blocked range named in the requirements Glossary
    - _Requirements: 2.4, 2.5, 2.9_

  - [x] 1.3 Add `tests/property/_arbitraries/url.ts`
    - Export `nonHttpSchemeArb` (any single-token scheme other than `http`/`https`) and `urlWithHostnameArb`
    - _Requirements: 2.2, 2.6_

  - [x] 1.4 Write property tests for SSRF guard
    - File: `tests/property/ssrf-guard.property.test.ts`
    - **Property 1: SSRF guard scheme rejection** — for any non-http(s) scheme, `assertUrlIsSafe` throws with prefix `ssrf_blocked_scheme:`
    - **Property 2: SSRF guard address classification** — for any classified blocked IP (literal or via stub resolver), `assertUrlIsSafe` throws `ssrf_blocked_address:`; for any classified public IP, it accepts
    - **Property 3: SSRF guard offline mode** — for any URL, with `allowExternalFetches: false`, `assertUrlIsSafe` throws `ssrf_blocked_offline:`
    - **Property 4: SSRF guard allowlist** — for any URL and non-empty allowlist, the guard accepts iff the registered hostname matches an allowlist entry
    - All four properties run with `{ numRuns: 100 }`
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.9, 2.10, 3.7, 5.2**

- [x] 2. Add the text sanitizer module
  - [x] 2.1 Create `shared/lib/text-sanitizer.ts`
    - Export `sanitizeText(value, options)` and `TEXT_FIELD_LIMITS` constant matching the design
    - Strip C0 controls except U+0009/U+000A/U+000D and strip U+007F
    - After stripping, check UTF-8 byte length against `maxBytes`; throw `sanitize_too_long:<fieldName>:<byteLength>` when exceeded
    - Throw `sanitize_invalid_type:<fieldName>` when called with a non-string
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 2.2 Write property tests for text sanitizer
    - File: `tests/property/text-sanitizer.property.test.ts`
    - **Property 5: Text sanitizer strip-and-preserve** — for any string, the output equals the input with exactly the strip-set code points removed and every other code point preserved in order
    - **Property 6: Text sanitizer length cap** — for any string whose UTF-8 byte length after stripping exceeds `maxBytes`, the sanitizer throws with prefix `sanitize_too_long:`
    - **Property 7: Text sanitizer idempotence** — for any string and options, `sanitizeText(sanitizeText(x, o), o)` deep-equals `sanitizeText(x, o)`
    - All three properties run with `{ numRuns: 100 }`
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.9**

- [x] 3. Add the rate limiter module
  - [x] 3.1 Create `hosts/standalone-host/rate-limiter.ts`
    - Export `createRateLimiter(config)` with the token-bucket algorithm in the design
    - Bucket capacity is `burst`; refill rate is `requestsPerMinute / 60_000` per ms
    - Inject `now` from config so tests can use a virtual clock
    - `consume(key)` returns `{ allowed: true }` or `{ allowed: false, retryAfterSeconds }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 4.8_

  - [x] 3.2 Write property test for rate limiter sliding-window invariant
    - File: `tests/property/rate-limiter.property.test.ts`
    - **Property 8: Rate limiter sliding-window invariant** — for any positive `requestsPerMinute`, non-negative `burst`, and any sequence of timestamps, the count of accepted consumes within any 60-second sliding window is at most `requestsPerMinute + burst`
    - Drive with a virtual clock fed by an arbitrary increasing-timestamp generator
    - Run with `{ numRuns: 100 }`
    - **Validates: Requirements 4.3, 4.4, 4.8**

- [x] 4. Wire offline-mode and rate-limit fields into the standalone host config
  - [x] 4.1 Extend `hosts/standalone-host/config.ts`
    - Add `runtime?: { allowExternalFetches?: boolean }` to `StandaloneHostConfig`
    - Add `rateLimit?: { requestsPerMinute?: number; burst?: number }` to `StandaloneHostConfig`
    - In `resolveStandaloneHostConfig`, default `runtime.allowExternalFetches` to `true`, `rateLimit.requestsPerMinute` to `60`, `rateLimit.burst` to `10`
    - Validate `requestsPerMinute >= 1` and `burst >= 0`
    - Add the resolved fields to `ResolvedStandaloneHostConfig`
    - _Requirements: 4.1, 5.1_

  - [x] 4.2 Update `shared/schemas/standalone-host-config.schema.json`
    - Declare `runtime` object with `allowExternalFetches` boolean (default `true`)
    - Declare `rateLimit` object with `requestsPerMinute` integer (min 1, default 60) and `burst` integer (min 0, default 10)
    - _Requirements: 4.9, 5.4_

  - [x] 4.3 Update `hosts/standalone-host/bootstrap.ts` example config
    - Surface the two new fields in the example written by bootstrap with their defaults so adopters see them
    - _Requirements: 4.1, 5.1_

- [x] 5. Wire rate limiter into the standalone host server
  - [x] 5.1 Update `hosts/standalone-host/server.ts`
    - Instantiate `createRateLimiter` once at startup if `auth.mode === "static_bearer"`
    - For every POST request matching a protected route prefix, call `consume(bearerToken)` before invoking the existing handler
    - On `{ allowed: false, retryAfterSeconds }`, respond `429` with `Retry-After` header and JSON body `{ ok: false, error: "rate_limited", retryAfterSeconds }`; do not invoke the handler
    - Pass `StartStandaloneHostServerOptions` a new `rateLimit` field that mirrors the resolved config
    - In `startStandaloneHostServerFromConfig`, thread `rateLimit` through
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 5.2 Emit the boot warning in `none` auth mode
    - Append a single boot-log entry `{ event: "warning", reason: "rate_limit_disabled_due_to_no_auth", recordedAt }` when the host starts in `auth.mode === "none"`
    - _Requirements: 4.5, 4.6_

- [x] 6. Wire input sanitization into the standalone host server
  - [x] 6.1 Add a sanitizer wrapper near the body-parsing path in `hosts/standalone-host/server.ts`
    - For each POST route, call `sanitizeText` on the field set defined in the design (candidate name, source title, source reference, mission alignment, goal statement, rationale strings, mission preview markdown)
    - Use `TEXT_FIELD_LIMITS` from the sanitizer module
    - On `sanitize_too_long:` or `sanitize_invalid_type:`, respond `400` with JSON body `{ ok: false, error: "invalid_input", field, reason }`
    - _Requirements: 6.6_

  - [x] 6.2 Add `maxLength` constraints to schemas
    - `shared/schemas/discovery-submission-request.schema.json`: 200 on `candidate_name`, 2000 on `source_reference`, 5000 on `mission_alignment`, `notes`, and the case-record free-text fields named in the design table
    - Other request schemas with free-text fields: apply 5000 to rationale-shaped fields per the design table
    - _Requirements: 6.7_

- [x] 7. Wire SSRF guard and offline mode into capability executors
  - [x] 7.1 Thread `allowExternalFetches` into the capability executor context
    - Identify the literature-access executor's context type (read `runtime/capabilities/literature-access/executor.ts` and any context module it imports)
    - Add `allowExternalFetches: boolean` to that context shape
    - Wire the value from the standalone host's resolved config into the context at call time
    - _Requirements: 5.2, 5.3_

  - [x] 7.2 Wire SSRF guard into `runtime/capabilities/literature-access/arxiv-search.ts`
    - Call `assertUrlIsSafe(url, { allowExternalFetches })` immediately before the existing `fetch(url)` call
    - On rejection, return the executor's structured failure variant with `reason: "external_fetches_disabled"` for offline rejections and `reason: "ssrf_blocked"` for other SSRF rejections
    - _Requirements: 3.1, 3.2, 3.6, 5.3_

  - [x] 7.3 Wire SSRF guard into `runtime/capabilities/literature-access/arxiv-download.ts`
    - Apply the wrap to both the PDF URL fetch and the source archive URL fetch
    - _Requirements: 3.1, 3.3, 3.6, 5.3_

  - [x] 7.4 Wire SSRF guard into `runtime/capabilities/literature-access/openalex-search.ts`
    - Apply the wrap before the existing `fetch(url, ...)` call
    - _Requirements: 3.1, 3.4, 3.6, 5.3_

  - [x] 7.5 Wire SSRF guard into `runtime/capabilities/literature-access/unpaywall-download.ts`
    - Apply the wrap before the API URL fetch and before the redirect-followed download URL fetch
    - _Requirements: 3.1, 3.5, 3.6, 5.3_

- [x] 8. Checkpoint — ssrf, sanitizer, rate limiter, and wiring all green
  - Run `pnpm run typecheck` to confirm no TypeScript regressions from the new modules and the executor wiring
  - Run `pnpm run test` and confirm the four property test files pass
  - Ensure all tests pass, ask the user if questions arise

- [x] 9. Write `SECURITY.md`
  - [x] 9.1 Create `SECURITY.md` at the repository root following the design's outline
    - "Threat model" section with the four scenarios (malicious source URL, malicious goal envelope, stolen bearer token, untrusted directive root)
    - "In scope" and "Out of scope" sections enumerating kernel guarantees vs host responsibilities
    - "Secret handling" section per Requirement 7.1, 7.2, 7.3
    - "Offline mode" section naming `runtime.allowExternalFetches`
    - "Reporting" section naming a Reporting_Channel
    - "Follow-ups" section naming GitHub, Tavily, Exa, Firecrawl, Unpaywall as known per-provider gaps
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.5, 7.1, 7.2, 7.3_

  - [x] 9.2 Update `README.md` to link to `SECURITY.md`
    - Add a link from the install or quickstart section
    - _Requirements: 1.8_

- [x] 10. Add the security hardening integration test
  - [x] 10.1 Create `tests/integration/hardening/security-checks.test.ts`
    - Table-driven blocked-address rejection (one example per IPv4 and IPv6 range named in the Glossary)
    - Named scheme rejection (`file:`, `data:`, `ftp:`, `gopher:`)
    - Loopback flag interaction: rejects `http://localhost` with `allowLoopback: false`, accepts with `allowLoopback: true`
    - Rate limiter exhaustion: under `auth.mode: static_bearer`, drive the host past `requestsPerMinute + burst` and assert the next response is `429` with `Retry-After`
    - Rate limiter does not persist: assert no rate-limit-named files appear under `runtime/standalone-host/` after a burst
    - Sanitizer behavior: one strip case and one length-cap case
    - Offline mode integration: stand up the host with `runtime.allowExternalFetches: false` and call one literature-access executor; assert the failure carries `reason: "external_fetches_disabled"`
    - Schema constraints: read each schema named in the design table and assert the named fields carry the expected `maxLength`
    - SECURITY.md content: assert presence of the four threat scenarios, the five Python provider names, the `runtime.allowExternalFetches` mention, and a non-empty Reporting section
    - README link: assert `README.md` links to `SECURITY.md`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 10.2 Add the secret-pattern audit to the same hardening file
    - Walk the directory tree under `hosts/`, `runtime/`, `engine/`, `discovery/`, `architecture/`, `shared/`
    - Skip `node_modules`, `dist`, and `.git`
    - Reject any source file containing `aws_access_key_id` (case-insensitive), `BEGIN PRIVATE KEY`, or a 32+ character base64 string assigned to a variable named `bearerToken`, `apiKey`, `secret`, or `token` (case-insensitive on the variable name)
    - _Requirements: 7.5, 8.9_

- [x] 11. Final checkpoint — full suite green, build green, hardening checks pass
  - Run `pnpm run typecheck` — no errors
  - Run `pnpm run test` — every unit, property, and integration test passes
  - Run `pnpm run check:build` — post-build smoke passes
  - Update `Fix_Plan.md` to mark F15 complete
  - Ensure all tests pass, ask the user if questions arise

## Notes

- No task is marked optional. The seven sub-items in `Fix_Plan.md` F15 are all mandatory for the P0 credibility floor.
- Property tests sit next to the modules they exercise so regressions are caught before the wiring step that depends on them.
- The Python `discovery/research-engine/` providers are not modified here; they are documented as a follow-up in `SECURITY.md`.
- The rate limiter is in-memory only by design (Requirement 4.7). Persistence is explicitly out of scope.
- This work depends on F1 (test infrastructure) and F2 (JS build), both of which have shipped.
