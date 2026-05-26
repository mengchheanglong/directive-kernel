import * as fc from "fast-check";

// Curated list of real-world URL schemes that are NOT http/https. We use a
// fixed list rather than generating arbitrary scheme strings because the
// WHATWG URL parser is strict about what counts as a valid bare-scheme
// input, and we want every emitted value to round-trip through
// `new URL(...)`. `ftp:` is intentionally absent: WHATWG treats it as a
// "special scheme" that requires a host, so the bare form throws.
const NON_HTTP_SCHEMES = [
  "file:",
  "data:",
  "gopher:",
  "ssh:",
  "javascript:",
  "chrome:",
  "about:",
  "vbscript:",
  "smb:",
  "tftp:",
  "telnet:",
  "ldap:",
  "blob:",
  "mailto:",
  "dict:",
] as const;

export const nonHttpSchemeArb: fc.Arbitrary<string> =
  fc.constantFrom(...NON_HTTP_SCHEMES);

// Single ASCII-lowercase label, 1-8 chars. Keeps generated hostnames inside
// IDN-safe territory so URL parsing and the SSRF guard's hostname comparison
// stay deterministic.
const labelArb = fc.stringMatching(/^[a-z]{1,8}$/);
const tldArb = fc.constantFrom("com", "org", "net", "io", "dev");

const registrableHostnameArb: fc.Arbitrary<string> = fc
  .tuple(labelArb, fc.option(labelArb, { nil: undefined }), tldArb)
  .map(([head, sub, tld]) =>
    sub === undefined ? `${head}.${tld}` : `${sub}.${head}.${tld}`,
  );

// Generate an http/https URL plus the bare hostname the URL parser would
// surface from `new URL(url).hostname`. Downstream tests use the `hostname`
// field for assertions about what the SSRF guard sees post-parse.
export const urlWithHostnameArb: fc.Arbitrary<{
  url: string;
  hostname: string;
}> = fc
  .tuple(
    fc.constantFrom("http", "https"),
    registrableHostnameArb,
    fc.option(fc.stringMatching(/^[a-z0-9-]{1,16}$/), { nil: undefined }),
  )
  .map(([scheme, hostname, path]) => ({
    url: path === undefined
      ? `${scheme}://${hostname}/`
      : `${scheme}://${hostname}/${path}`,
    hostname,
  }));
