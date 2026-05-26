import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { isIP } from "node:net";

import { assertUrlIsSafe } from "../../shared/lib/ssrf-guard.ts";
import {
  classifiedIpArb,
  type ClassifiedIp,
} from "./_arbitraries/ip-address.ts";
import {
  nonHttpSchemeArb,
  urlWithHostnameArb,
} from "./_arbitraries/url.ts";

// Property tests for `shared/lib/ssrf-guard.ts`. Each `it` corresponds to a
// numbered correctness property in the design document
// (.kiro/specs/directive-kernel-security-posture/design.md →
// "Correctness Properties → Properties 1–4"). Every property runs at
// `{ numRuns: 100 }` per task 1.4.

// Public IPv4 literal used as the canonical "safe" return value from the
// stub resolver. 93.184.216.34 was the long-standing example.com record;
// any address in `publicIpv4Arb`'s range would do, but pinning it keeps
// the property tests deterministic when DNS would otherwise be invoked.
const PUBLIC_STUB_IP = "93.184.216.34";

function makeStubResolver(addresses: readonly string[]) {
  return async (_hostname: string): Promise<readonly string[]> => addresses;
}

describe("ssrf-guard", () => {
  // Property 1 — SSRF guard scheme rejection.
  // Design: design.md → "Correctness Properties → Property 1".
  // For any URL whose scheme is not `http` or `https`, `assertUrlIsSafe`
  // throws an error whose message starts with `ssrf_blocked_scheme:`.
  // Validates: Requirements 2.2, 2.10.
  it("Property 1: rejects every non-http(s) scheme with ssrf_blocked_scheme:", async () => {
    await fc.assert(
      fc.asyncProperty(
        nonHttpSchemeArb,
        urlWithHostnameArb,
        async (scheme, hostnameInfo) => {
          // Construct a hierarchical URL with the generated scheme. The
          // WHATWG URL parser accepts the `//host/` form for both special
          // schemes (file:) and opaque schemes (data:, javascript:,
          // mailto:, about:, ...). If a particular combination fails to
          // parse, skip the iteration; the property is about parseable
          // non-http(s) URLs.
          const candidate = `${scheme}//${hostnameInfo.hostname}/`;
          try {
            new URL(candidate);
          } catch {
            fc.pre(false);
            return;
          }
          await expect(
            assertUrlIsSafe(candidate, {
              // Stub resolver in case any non-http path falls through to
              // DNS. It shouldn't — scheme rejection runs before address
              // classification — but providing the stub keeps the test
              // deterministic if behavior ever drifts.
              resolver: makeStubResolver([PUBLIC_STUB_IP]),
            }),
          ).rejects.toThrow(/^ssrf_blocked_scheme:/);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 2 — SSRF guard address classification.
  // Design: design.md → "Correctness Properties → Property 2".
  // For any classified IP (literal or via stub resolver), the guard
  // rejects blocked addresses with `ssrf_blocked_address:` and accepts
  // public addresses. We exercise both the literal-IP branch and the
  // DNS branch within the same property so the assertion holds across
  // both code paths.
  // Validates: Requirements 2.3, 2.4, 2.5, 2.9, 3.7.
  it("Property 2: accepts public IPs and rejects blocked IPs (literal + DNS paths)", async () => {
    type AddressCase =
      | { readonly via: "literal"; readonly classified: ClassifiedIp }
      | {
          readonly via: "dns";
          readonly classified: ClassifiedIp;
          readonly info: { readonly url: string; readonly hostname: string };
        };

    const caseArb: fc.Arbitrary<AddressCase> = fc.oneof(
      classifiedIpArb.map(
        (classified) => ({ via: "literal", classified } as const),
      ),
      fc
        .tuple(classifiedIpArb, urlWithHostnameArb)
        .map(
          ([classified, info]) => ({ via: "dns", classified, info } as const),
        ),
    );

    await fc.assert(
      fc.asyncProperty(caseArb, async (addressCase) => {
        const { classified } = addressCase;
        const family = isIP(classified.address);
        // Skip rare iterations where an arbitrary produced a string
        // Node refuses to recognise as an IP literal.
        if (family === 0) {
          fc.pre(false);
          return;
        }

        let url: string;
        if (addressCase.via === "literal") {
          url =
            family === 6
              ? `http://[${classified.address}]/`
              : `http://${classified.address}/`;
        } else {
          url = addressCase.info.url;
        }
        // For the literal branch the guard skips DNS, so the resolver
        // is defensive only. For the DNS branch the resolver is the
        // mechanism under test.
        const resolver = makeStubResolver([classified.address]);

        if (classified.kind === "blocked") {
          await expect(
            assertUrlIsSafe(url, { resolver }),
          ).rejects.toThrow(/^ssrf_blocked_address:/);
        } else {
          await expect(
            assertUrlIsSafe(url, { resolver }),
          ).resolves.toBeUndefined();
        }
      }),
      { numRuns: 100 },
    );
  });

  // Property 3 — SSRF guard offline mode.
  // Design: design.md → "Correctness Properties → Property 3".
  // For any URL, when invoked with `allowExternalFetches: false`, the
  // guard throws `ssrf_blocked_offline:` and short-circuits before scheme
  // or address classification. We mix http(s) URLs with non-http schemes
  // to confirm offline mode runs first regardless of scheme.
  // Validates: Requirements 2.7, 5.2.
  it("Property 3: offline mode rejects every URL with ssrf_blocked_offline:", async () => {
    const anyUrlArb: fc.Arbitrary<string> = fc.oneof(
      urlWithHostnameArb.map((info) => info.url),
      fc
        .tuple(nonHttpSchemeArb, urlWithHostnameArb)
        .map(([scheme, info]) => `${scheme}//${info.hostname}/`),
    );

    await fc.assert(
      fc.asyncProperty(anyUrlArb, async (url) => {
        // Skip iterations whose URL doesn't parse at all — the guard
        // would propagate the URL parser's own error, not
        // `ssrf_blocked_offline:`.
        try {
          new URL(url);
        } catch {
          fc.pre(false);
          return;
        }
        await expect(
          assertUrlIsSafe(url, { allowExternalFetches: false }),
        ).rejects.toThrow(/^ssrf_blocked_offline:/);
      }),
      { numRuns: 100 },
    );
  });

  // Property 4 — SSRF guard allowlist.
  // Design: design.md → "Correctness Properties → Property 4".
  // For any URL and any non-empty `allowlistDomains`, the guard accepts
  // the URL iff its registered hostname matches an allowlist entry
  // (case-insensitive). Driven by a tagged `branch` so a single property
  // covers both the accept and reject paths.
  // Validates: Requirements 2.6.
  it("Property 4: allowlist accepts iff registered hostname matches", async () => {
    // A small label/TLD generator for "other" allowlist entries. Kept
    // local so it doesn't leak into the shared arbitraries module.
    const labelArb = fc.stringMatching(/^[a-z]{1,8}$/);
    const tldArb = fc.constantFrom("com", "org", "net", "io", "dev");
    const otherHostnameArb = fc
      .tuple(labelArb, tldArb)
      .map(([head, tld]) => `${head}.${tld}`);

    type AllowlistCase = {
      readonly branch: "match" | "reject";
      readonly info: { readonly url: string; readonly hostname: string };
      readonly others: readonly string[];
    };

    const caseArb: fc.Arbitrary<AllowlistCase> = fc.oneof(
      fc
        .tuple(urlWithHostnameArb, fc.array(otherHostnameArb, { maxLength: 4 }))
        .map(([info, others]) => ({
          branch: "match" as const,
          info,
          others,
        })),
      fc
        .tuple(urlWithHostnameArb, fc.array(otherHostnameArb, { maxLength: 4 }))
        .map(([info, others]) => ({
          branch: "reject" as const,
          info,
          others,
        })),
    );

    await fc.assert(
      fc.asyncProperty(caseArb, async (testCase) => {
        const { info, others, branch } = testCase;
        // Stub resolver returns a public IP so the IP-classification
        // step succeeds whenever the allowlist check passes. This
        // isolates the property to the allowlist behavior.
        const resolver = makeStubResolver([PUBLIC_STUB_IP]);

        if (branch === "match") {
          const allowlist = [info.hostname, ...others];
          await expect(
            assertUrlIsSafe(info.url, {
              allowlistDomains: allowlist,
              resolver,
            }),
          ).resolves.toBeUndefined();
          return;
        }

        // "reject" branch: ensure the random extras don't accidentally
        // include the URL's hostname (case-insensitive). If filtering
        // leaves the allowlist empty, skip — an empty allowlist is
        // semantically equivalent to "no allowlist", which the guard
        // does not reject on.
        const hostnameLowered = info.hostname.toLowerCase();
        const allowlist = others.filter(
          (entry) => entry.toLowerCase() !== hostnameLowered,
        );
        if (allowlist.length === 0) {
          fc.pre(false);
          return;
        }
        await expect(
          assertUrlIsSafe(info.url, {
            allowlistDomains: allowlist,
            resolver,
          }),
        ).rejects.toThrow(/^ssrf_blocked_allowlist:/);
      }),
      { numRuns: 100 },
    );
  });
});
