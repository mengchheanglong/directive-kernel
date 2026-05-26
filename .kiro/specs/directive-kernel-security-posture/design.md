# Design Document

## Overview

This design hardens the `@directive/kernel` package against the threats called out in F15 of `Fix_Plan.md`. Five things change:

1. A written `SECURITY.md` at the repository root captures the threat model, the in-scope/out-of-scope boundary, the secret-handling policy, and a reporting channel.
2. A new `shared/lib/ssrf-guard.ts` module exports `assertUrlIsSafe(url, options)`, called from every external-fetch site in the kernel before `fetch(...)`. It rejects non-http(s) schemes, resolves hostnames through DNS, and rejects any URL whose IP set falls in a blocked range. It also short-circuits when an offline flag is set.
3. A new `shared/lib/text-sanitizer.ts` module exports `sanitizeText(value, options)` for stripping C0 control characters and DEL and asserting a maximum UTF-8 byte length. It is wired into the standalone host's POST request handlers for every free-text field crossing the API boundary. Schema files under `shared/schemas/` get `maxLength` constraints documenting the bounds.
4. The standalone host gains a token-bucket rate limiter on POST routes when `auth.mode === "static_bearer"`, with defaults of 60 requests per minute and a burst of 10. Buckets are keyed by bearer token and live in process memory only. In `none` auth mode, the limiter is inert and the host emits a single boot-log warning.
5. A new `runtime.allowExternalFetches` boolean field on `standalone-host.config.json` (default `true`) threads through SSRF_Guard so that operators can run the host with no outbound network access.

A new `tests/integration/hardening/security-checks.test.ts` exercises every assertion above and runs in the same CI workflow as the rest of the test suite. Property tests for SSRF_Guard, the rate limiter's sliding-window invariant, and the text sanitizer live under `tests/property/`.

The Python `discovery/research-engine/` providers are out of scope for code changes; `SECURITY.md` documents them as a known follow-up.

## Architecture

### Module map

```
shared/
  lib/
    ssrf-guard.ts                 ← new
    text-sanitizer.ts             ← new
  schemas/
    standalone-host-config.schema.json   ← rateLimit + runtime fields added
    discovery-submission-request.schema.json   ← maxLength on free-text fields
    ... other request schemas with free-text fields ← maxLength added

hosts/standalone-host/
  config.ts                       ← rateLimit + runtime fields resolved
  server.ts                       ← rate limiter middleware + sanitizer wiring
  rate-limiter.ts                 ← new (token bucket)

runtime/capabilities/literature-access/
  arxiv-search.ts                 ← assertUrlIsSafe before fetch
  arxiv-download.ts               ← assertUrlIsSafe before fetch (PDF + src)
  openalex-search.ts              ← assertUrlIsSafe before fetch
  unpaywall-download.ts           ← assertUrlIsSafe before fetch (API + redirect)

tests/
  property/
    _arbitraries/
      ip-address.ts               ← new (blocked-range and public-IP arbitraries)
      url.ts                      ← new
    ssrf-guard.property.test.ts   ← new
    text-sanitizer.property.test.ts   ← new
    rate-limiter.property.test.ts ← new
  integration/
    hardening/
      security-checks.test.ts     ← new

SECURITY.md                       ← new (root)
README.md                         ← link to SECURITY.md added
```

### Why a single shared SSRF guard

Every external-fetch site today calls `await fetch(url, ...)` directly. Wiring SSRF behavior into a base HTTP wrapper would change too many files and introduce a layer the kernel does not need elsewhere. A single helper at `shared/lib/ssrf-guard.ts` with an explicit `assertUrlIsSafe` call at each fetch site keeps the change local, auditable by grep, and easy to unit-test in isolation. The hardening test treats the call sites as the contract: a regression that adds a new fetch without a guard fails the secret-pattern audit's grep step.

### Why an in-memory token bucket only

Rate limiting on a kernel that owns the filesystem and runs on the operator's machine should fail closed, not fail in a database. An in-memory bucket per token is small (under 100 bytes), accurate at sub-millisecond granularity, and dies with the process. We are not running multiple kernels behind a load balancer. Persistence is explicitly out of scope (Requirement 4.7).

### Why config-only offline mode

The original Fix_Plan wording mentioned a `--no-network` CLI flag. The user clarified during Clarify that a single config field is preferred. The flag becomes `runtime.allowExternalFetches` on `standalone-host.config.json` and threads through SSRF_Guard via the `allowExternalFetches` option. Embedding consumers who construct the host programmatically pass the same flag through their config file. There is no CLI override, which keeps the precedence story simple: config is the single source of truth.

## Components and Interfaces

### `shared/lib/ssrf-guard.ts`

Public surface:

```typescript
export type AssertUrlIsSafeOptions = {
  // When false, every URL is rejected with ssrf_blocked_offline:.
  // When true (default), URLs are classified by scheme and IP.
  allowExternalFetches?: boolean;
  // When non-empty, the URL's registered hostname must equal one of these.
  allowlistDomains?: readonly string[];
  // When true, loopback addresses (127.0.0.0/8, ::1) are accepted.
  // When false (default), loopback is rejected like any other blocked range.
  allowLoopback?: boolean;
  // Injectable resolver for testing. Must return one or more IP literals.
  resolver?: (hostname: string) => Promise<readonly string[]>;
};

export async function assertUrlIsSafe(
  url: string | URL,
  options?: AssertUrlIsSafeOptions,
): Promise<void>;
```

Algorithm:

```
function assertUrlIsSafe(url, options):
  parsed = new URL(url)                              // throws on malformed URL

  if options.allowExternalFetches === false:
    throw Error("ssrf_blocked_offline:" + parsed.href)

  if parsed.protocol not in {"http:", "https:"}:
    throw Error("ssrf_blocked_scheme:" + parsed.protocol)

  hostname = parsed.hostname                         // strips port and path

  if options.allowlistDomains is non-empty:
    if hostname not in options.allowlistDomains:
      throw Error("ssrf_blocked_allowlist:" + hostname)

  // Classify by IP, regardless of allowlist match (allowlist domains
  // can still resolve to private IPs through poisoning or rebinding).
  if hostname is a literal IPv4 or IPv6 address:
    addresses = [hostname]
  else:
    resolver = options.resolver ?? defaultResolver
    addresses = await resolver(hostname)

  for each address in addresses:
    classification = classifyAddress(address)
    if classification === "loopback" and options.allowLoopback === true:
      continue
    if classification !== "public":
      throw Error("ssrf_blocked_address:" + hostname + ":" + address)
```

The default resolver uses Node's `dns.lookup(hostname, { all: true, family: 0, verbatim: true })` so both IPv4 and IPv6 records are returned and classified.

`classifyAddress(addr)` returns one of `"loopback" | "private" | "linkLocal" | "unspecified" | "multicast" | "reserved" | "uniqueLocal" | "public"` by parsing the address with Node's `net.isIPv4`/`net.isIPv6` and checking the numeric ranges from the Glossary. IPv4-mapped IPv6 forms (e.g. `::ffff:192.168.1.1`) are unmapped before classification so the same rules apply.

Errors are plain `Error` instances; the caller is responsible for wrapping them into structured failure results.

### `shared/lib/text-sanitizer.ts`

Public surface:

```typescript
export type SanitizeTextOptions = {
  fieldName: string;
  maxBytes: number;            // hard byte cap (UTF-8)
};

export function sanitizeText(value: string, options: SanitizeTextOptions): string;

export const TEXT_FIELD_LIMITS = {
  candidateName: 200,
  sourceTitle: 200,
  sourceReference: 2000,        // URLs can be long
  missionAlignment: 5000,
  goalStatement: 5000,
  rationale: 5000,
  missionPreviewMarkdown: 50000,
} as const;
```

Algorithm:

```
function sanitizeText(value, options):
  if typeof value !== "string":
    throw TypeError("sanitize_invalid_type:" + options.fieldName)

  // Strip C0 control characters except U+0009, U+000A, U+000D, plus U+007F.
  stripped = ""
  for codepoint in value:
    if codepoint < 0x20 and codepoint not in {0x09, 0x0A, 0x0D}:
      continue
    if codepoint === 0x7F:
      continue
    stripped += String.fromCodePoint(codepoint)

  // Byte cap is checked AFTER stripping. This is intentional: it bounds
  // the persisted size, not the input size. Stripping shrinks input.
  byteLength = Buffer.byteLength(stripped, "utf8")
  if byteLength > options.maxBytes:
    throw Error("sanitize_too_long:" + options.fieldName + ":" + byteLength)

  return stripped
```

The host's POST handlers call `sanitizeText` field-by-field in a thin wrapper before passing the request body to the existing handler. The wrapper lives in `hosts/standalone-host/server.ts` near the body-parsing path and has no knowledge of business logic.

### `hosts/standalone-host/rate-limiter.ts`

Public surface:

```typescript
export type RateLimiterConfig = {
  requestsPerMinute: number;    // default 60
  burst: number;                // default 10
  now?: () => number;           // injectable clock for tests
};

export type RateLimiterDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type RateLimiter = {
  consume(key: string): RateLimiterDecision;
};

export function createRateLimiter(config: RateLimiterConfig): RateLimiter;
```

Algorithm (token bucket):

```
state per key:
  tokens: number                  // starts at burst
  lastRefillAt: number (ms)       // wall-clock or injected clock

refillRatePerMs = requestsPerMinute / 60_000
bucketCapacity  = burst                           // saved burst capacity

consume(key):
  now = config.now ?? Date.now
  s = state.get(key) ?? { tokens: burst, lastRefillAt: now() }
  elapsed = now() - s.lastRefillAt
  s.tokens = min(bucketCapacity, s.tokens + elapsed * refillRatePerMs)
  s.lastRefillAt = now()
  if s.tokens >= 1:
    s.tokens -= 1
    state.set(key, s)
    return { allowed: true }
  retryAfterSeconds = ceil((1 - s.tokens) / refillRatePerMs / 1000)
  state.set(key, s)
  return { allowed: false, retryAfterSeconds }
```

The bucket's hard cap `bucketCapacity` is `burst`. This produces the required sliding-window invariant: in any 60-second window, the count of accepted requests for one key is at most `requestsPerMinute + burst` (proof: the bucket can start a window with at most `burst` saved tokens and can refill at most `requestsPerMinute` tokens during the next 60 seconds). A hard cap of `requestsPerMinute + burst` would violate the invariant after an idle refill, so the implementation intentionally uses classic token-bucket capacity.

In `server.ts`, the limiter is instantiated once at startup if `auth.mode === "static_bearer"`. POST handlers consume one token per request keyed by `resolveBearerToken(req)`. On `allowed: false`, the response is `429 Too Many Requests` with `Retry-After: <seconds>` and JSON body `{ ok: false, error: "rate_limited", retryAfterSeconds: ... }`. In `none` auth mode, the limiter is `null`, the warning is appended to the boot log once, and POST handlers proceed without rate-limit bookkeeping.

### `hosts/standalone-host/config.ts`

Two new fields on `StandaloneHostConfig`:

```typescript
type StandaloneHostConfig = {
  // ... existing fields
  runtime?: {
    allowExternalFetches?: boolean;       // default: true
  };
  rateLimit?: {
    requestsPerMinute?: number;           // default: 60, must be positive integer
    burst?: number;                       // default: 10, must be non-negative integer
  };
};
```

Resolved shape:

```typescript
type ResolvedStandaloneHostConfig = {
  // ... existing fields
  runtime: {
    allowExternalFetches: boolean;
  };
  rateLimit: {
    requestsPerMinute: number;
    burst: number;
  };
};
```

Defaults are applied in `resolveStandaloneHostConfig`. `applyStandaloneHostConfigOverrides` is unchanged for these fields (no programmatic override path needed).

### Schema updates

`shared/schemas/standalone-host-config.schema.json` gains:

```jsonc
{
  "properties": {
    "runtime": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "allowExternalFetches": { "type": "boolean", "default": true }
      }
    },
    "rateLimit": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "requestsPerMinute": { "type": "integer", "minimum": 1, "default": 60 },
        "burst": { "type": "integer", "minimum": 0, "default": 10 }
      }
    }
  }
}
```

Existing request schemas with free-text fields gain `maxLength` constraints. The fields and their limits:

| Schema | Field | maxLength |
|---|---|---|
| `discovery-submission-request.schema.json` | `candidate_name` | 200 |
| `discovery-submission-request.schema.json` | `source_reference` | 2000 |
| `discovery-submission-request.schema.json` | `mission_alignment` | 5000 |
| `discovery-submission-request.schema.json` | `notes` | 5000 |
| `discovery-submission-request.schema.json` | `case_record.intake.why_it_entered_the_system` | 5000 |
| `discovery-submission-request.schema.json` | `case_record.intake.claimed_value` | 5000 |
| `discovery-submission-request.schema.json` | `case_record.triage.first_pass_summary` | 5000 |
| `discovery-submission-request.schema.json` | `case_record.routing.why_this_route` | 5000 |
| `discovery-submission-request.schema.json` | `case_record.routing.why_not_alternatives` | 5000 |
| `discovery-submission-request.schema.json` | `fast_path.first_pass_summary` | 5000 |
| `gap-formalization-record.schema.json` | rationale-shaped fields | 5000 |
| `mission-evolution-record.schema.json` | `summary`, free-text reasons | 50000 |

The schemas are constraints documents only; runtime enforcement comes from the sanitizer wrapper in the host. The hardening test reads each schema and asserts the named fields carry the expected `maxLength`.

### External fetch site changes

Each of the four sites is a thin wrap. Pattern at every site:

```typescript
import { assertUrlIsSafe } from "../../../shared/lib/ssrf-guard.ts";

// inside the function that builds the URL:
try {
  await assertUrlIsSafe(url, {
    allowExternalFetches: capabilityContext.allowExternalFetches,
  });
} catch (error) {
  return {
    ok: false,
    reason: (error as Error).message.startsWith("ssrf_blocked_offline:")
      ? "external_fetches_disabled"
      : "ssrf_blocked",
    detail: (error as Error).message,
  };
}

const response = await fetch(url, fetchOptions);
```

`capabilityContext.allowExternalFetches` is plumbed through the executor's existing context object. For the literature-access executors, that context already exists; the new field is added to its type.

### `SECURITY.md` outline

```markdown
# Security policy — @directive/kernel

## Threat model
### Malicious source URL
### Malicious goal envelope
### Stolen bearer token
### Untrusted directive root filesystem

## In scope
- SSRF protection on every kernel-initiated outbound fetch
- Bearer-token authentication on the standalone host's protected routes
- Rate limiting per token on POST routes when auth is enabled
- Length bounds and control-character stripping on free-text API fields
- Offline mode via `runtime.allowExternalFetches: false`

## Out of scope
- mTLS, OAuth, identity provider integration
- CSRF (the API is bearer-token only; there is no cookie/session model)
- Cryptographic signing of run records or ledger entries
- Audit log tamper-evidence
- Network egress sandboxing at the OS level (operator's responsibility)
- Per-provider guards inside the Python `discovery/research-engine/` (see Follow-ups)

## Secret handling
- Bearer tokens: prefer `auth.bearerTokenEnvName`; never commit tokens
- Provider API keys: environment variables only; never inside the directive root
- Directive root: gitignored or otherwise excluded by the host project

## Offline mode
- Set `runtime.allowExternalFetches: false` in `standalone-host.config.json`

## Reporting
- Report vulnerabilities to <reporting-channel-here>

## Follow-ups
- Python `discovery/research-engine/` provider guards (GitHub, Tavily, Exa, Firecrawl, Unpaywall)
```

### Hardening test outline

```typescript
import { describe, it, expect } from "vitest";
import { assertUrlIsSafe } from "../../../shared/lib/ssrf-guard.ts";
import { sanitizeText } from "../../../shared/lib/text-sanitizer.ts";
import { createRateLimiter } from "../../../hosts/standalone-host/rate-limiter.ts";

describe("security hardening", () => {
  describe("SSRF guard rejection ranges", () => {
    it.each([
      ["10.0.0.5"],     // RFC1918
      ["172.20.10.1"],  // RFC1918
      ["192.168.1.1"],  // RFC1918
      ["127.0.0.1"],    // loopback
      ["169.254.0.1"],  // link-local
      ["0.0.0.0"],      // unspecified
      ["224.0.0.1"],    // multicast
      ["::1"],          // IPv6 loopback
      ["fe80::1"],      // IPv6 link-local
      ["fc00::1"],      // IPv6 ULA
      ["ff00::1"],      // IPv6 multicast
      ["::"],           // IPv6 unspecified
    ])("rejects %s", async (ip) => { /* ... */ });
  });

  describe("SSRF guard scheme rejection", () => {
    it.each(["file:", "data:", "ftp:", "gopher:"])("rejects %s", ...);
  });

  describe("SSRF guard offline mode", () => {
    it("rejects every URL when allowExternalFetches=false", ...);
  });

  describe("rate limiter", () => {
    it("returns 429 once token bucket is exhausted", ...);
    it("does not persist state to disk", ...);
  });

  describe("text sanitizer", () => {
    it("strips a control character", ...);
    it("rejects strings over maxBytes", ...);
  });

  describe("offline mode integration", () => {
    it("rejects a public-IP test URL with the offline error when flag is false", ...);
  });

  describe("schema constraints", () => {
    it("declares maxLength on the named free-text fields", ...);
  });

  describe("SECURITY.md", () => {
    it("contains the four threat scenarios", ...);
    it("names the five Python providers in follow-ups", ...);
    it("documents runtime.allowExternalFetches", ...);
    it("names a reporting channel", ...);
  });

  describe("README link to SECURITY.md", () => {
    it("links from README install/quickstart section", ...);
  });

  describe("secret-pattern audit", () => {
    it("finds no aws_access_key_id, BEGIN PRIVATE KEY, or hardcoded bearer/api keys", ...);
  });
});
```

## Data Models

This feature does not introduce new domain data models. The new types are:

- `AssertUrlIsSafeOptions`, the SSRF guard's option bag.
- `SanitizeTextOptions` and `TEXT_FIELD_LIMITS`, the sanitizer's option bag and the named limits map.
- `RateLimiterConfig`, `RateLimiterDecision`, `RateLimiter`, the limiter's three types.
- The two new resolved-config fields `runtime.allowExternalFetches` and `rateLimit.{requestsPerMinute, burst}`.

All other data shapes are unchanged.

## Error Handling

- **SSRF rejection**: thrown as a plain `Error` from `assertUrlIsSafe`. External fetch sites catch the error and surface it as a structured failure result on their existing return shape. The standalone host's POST handlers do not catch SSRF errors directly because their requests do not initiate outbound fetches; SSRF is a capability-executor concern.
- **Sanitizer rejection**: thrown as a plain `Error` from `sanitizeText` with messages prefixed `sanitize_too_long:` or `sanitize_invalid_type:`. The host's POST handler wrapper translates these into HTTP 400 responses with `error: "invalid_input"` and the field name.
- **Rate-limiter rejection**: returned (not thrown) by `consume()` as `{ allowed: false, retryAfterSeconds }`. The handler emits HTTP 429 with `Retry-After`. No exception path.
- **Offline mode**: SSRF guard short-circuits with `ssrf_blocked_offline:` before scheme classification, so external fetch sites get a single, dedicated reason `external_fetches_disabled` distinguishable from other SSRF rejections.
- **DNS resolution failure**: surfaced as the underlying `dns.lookup` error. SSRF_Guard does not swallow it; the caller's existing fetch-error path handles it. The point of SSRF_Guard is to reject when DNS *succeeds* with a blocked address; it is not a substitute for general network-error handling.

## Migration / Compatibility

- **Config schema changes are additive.** Existing configs without `runtime` or `rateLimit` fields continue to resolve with default values applied. No bootstrap example needs to change unless we want to surface the new fields in `bootstrap.ts`'s example; we do (Tasks).
- **Bearer-token resolution is unchanged.** The `auth.bearerToken` vs `auth.bearerTokenEnvName` resolution path stays as-is; Requirement 7.4 codifies the existing behavior.
- **External fetch sites change return shape only on rejection.** When SSRF_Guard accepts a URL, the call site is byte-identical to today. When SSRF_Guard rejects, the site returns its existing structured failure variant with a new `reason` value.
- **Schema `maxLength` constraints document bounds the host enforces.** Adding `maxLength` to a field that did not have it is technically a tightening, but every limit chosen here is large enough that no current legitimate input exceeds it. The hardening test asserts the limits as a contract so future drift is caught.
- **Rate limiter is a new gate.** Existing call sites that exceed 60 requests per minute under bearer auth will start receiving 429s. The default of 60+10 is set conservatively; embedding consumers can raise it via `rateLimit.requestsPerMinute`. The boot log warning in `none` mode informs operators that the gate is off.
- **No public export changes.** New modules (`ssrf-guard`, `text-sanitizer`, `rate-limiter`) are kernel-internal and not added to `package.json` `exports`.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: SSRF guard scheme rejection

For any URL whose scheme is not `http` or `https`, `assertUrlIsSafe` throws an error whose message starts with `ssrf_blocked_scheme:`.

**Validates: Requirements 2.2, 2.10**

### Property 2: SSRF guard address classification

For any URL whose hostname (literal IP or DNS-resolved) classifies to one or more addresses in any Blocked_Address_Range, `assertUrlIsSafe` throws an error whose message starts with `ssrf_blocked_address:`. For any URL whose hostname classifies entirely to public, non-blocked addresses, `assertUrlIsSafe` returns successfully.

**Validates: Requirements 2.3, 2.4, 2.5, 2.9, 3.7**

### Property 3: SSRF guard offline mode

For any URL, when `assertUrlIsSafe` is invoked with `allowExternalFetches: false`, it throws an error whose message starts with `ssrf_blocked_offline:` and never advances to scheme or address classification.

**Validates: Requirements 2.7, 5.2**

### Property 4: SSRF guard allowlist

For any URL and any non-empty `allowlistDomains`, `assertUrlIsSafe` accepts the URL only when the URL's registered hostname is exactly equal (case-insensitive) to one of the allowlist entries; otherwise it throws.

**Validates: Requirements 2.6**

### Property 5: Text sanitizer strip-and-preserve

For any string `x`, `sanitizeText(x)` is the string formed by removing exactly the code points in `{ U+0000..U+0008, U+000B, U+000C, U+000E..U+001F, U+007F }` from `x` while preserving every other code point in original order.

**Validates: Requirements 6.2, 6.3, 6.5**

### Property 6: Text sanitizer length cap

For any string whose UTF-8 byte length after stripping exceeds `options.maxBytes`, `sanitizeText` throws an error whose message starts with `sanitize_too_long:`.

**Validates: Requirements 6.4**

### Property 7: Text sanitizer idempotence

For any string `x` and options `o`, `sanitizeText(sanitizeText(x, o), o)` deep-equals `sanitizeText(x, o)`.

**Validates: Requirements 6.9**

### Property 8: Rate limiter sliding-window invariant

For any positive `requestsPerMinute`, any non-negative `burst`, and any sequence of request timestamps applied to a single key, the count of `consume(key)` calls returning `{ allowed: true }` within any 60-second sliding window is at most `requestsPerMinute + burst`.

**Validates: Requirements 4.3, 4.4, 4.8**

## Testing Strategy

**Property tests** (Properties 1–8):

- Implemented under `tests/property/` using `fast-check`.
- Each property runs at `{ numRuns: 100 }` minimum.
- New arbitraries live in `tests/property/_arbitraries/`:
  - `ip-address.ts` exports `blockedIpv4Arb`, `publicIpv4Arb`, `blockedIpv6Arb`, `publicIpv6Arb`, and a tagged-union `classifiedIpArb` for use in Property 2.
  - `url.ts` exports `urlWithSchemeArb` (any scheme), `nonHttpSchemeArb`, and `urlWithHostnameArb`.
- The SSRF guard tests inject a stubbed resolver via `options.resolver` so DNS is deterministic.
- The rate limiter test injects a virtual clock via `config.now` so timestamps are deterministic.

**Unit / hardening tests** (Requirements 1, 4, 5, 6, 7, 8):

- `tests/integration/hardening/security-checks.test.ts` covers:
  - Specific blocked-address rejections (one example per range, table-driven).
  - Named scheme rejections (`file:`, `data:`, `ftp:`, `gopher:`).
  - 429 emission under bearer auth when bucket exhausted.
  - Sanitizer strip + length error.
  - Offline-mode integration with one external fetch site.
  - Schema `maxLength` presence on named fields.
  - `SECURITY.md` content presence (threat scenarios, providers, offline flag, reporting).
  - `README.md` linking to `SECURITY.md`.
  - Secret-pattern audit across `hosts/`, `runtime/`, `engine/`, `discovery/`, `architecture/`, `shared/`.

**External fetch site wiring tests**:

- Per-site example tests in the hardening file. For each of the four sites, set up a stub resolver that returns a private IP and assert the site returns its structured failure variant.

**Configuration tests**:

- `runtime.allowExternalFetches` and `rateLimit.{requestsPerMinute, burst}` resolution defaults are exercised through the existing config tests in the hardening suite (extended) rather than a new dedicated file.

**No tests are marked optional in this spec.** F15 is P0 and every assertion in this design protects against a category of attack the kernel is otherwise vulnerable to.
