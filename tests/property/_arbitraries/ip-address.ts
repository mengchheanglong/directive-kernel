import * as fc from "fast-check";

// IP-literal arbitraries used by the SSRF guard property tests
// (see `tests/property/ssrf-guard.property.test.ts`). Every blocked range
// from the security requirements is represented below so that property tests
// cannot drift past one slice of the rejection surface.
//
// All exports return raw IP literal strings (no URL framing). The property
// tests are responsible for embedding the literal into an `http://...` URL
// (using `[]` brackets for IPv6) before handing it to `assertUrlIsSafe`.

const octetArb = fc.integer({ min: 0, max: 255 });

function joinOctets(octets: readonly [number, number, number, number]): string {
  return octets.join(".");
}

// ---------- Blocked IPv4 ranges ---------------------------------------------

// 10.0.0.0/8 — RFC1918 private
const ipv4_10_0_0_0_8 = fc
  .tuple(fc.constant(10), octetArb, octetArb, octetArb)
  .map(joinOctets);

// 172.16.0.0/12 — RFC1918 private (second octet 16..31)
const ipv4_172_16_0_0_12 = fc
  .tuple(
    fc.constant(172),
    fc.integer({ min: 16, max: 31 }),
    octetArb,
    octetArb,
  )
  .map(joinOctets);

// 192.168.0.0/16 — RFC1918 private
const ipv4_192_168_0_0_16 = fc
  .tuple(fc.constant(192), fc.constant(168), octetArb, octetArb)
  .map(joinOctets);

// 127.0.0.0/8 — loopback
const ipv4_127_0_0_0_8 = fc
  .tuple(fc.constant(127), octetArb, octetArb, octetArb)
  .map(joinOctets);

// 169.254.0.0/16 — link-local
const ipv4_169_254_0_0_16 = fc
  .tuple(fc.constant(169), fc.constant(254), octetArb, octetArb)
  .map(joinOctets);

// 0.0.0.0/8 — unspecified ("this network")
const ipv4_0_0_0_0_8 = fc
  .tuple(fc.constant(0), octetArb, octetArb, octetArb)
  .map(joinOctets);

// 224.0.0.0/4 — multicast (first octet 224..239)
const ipv4_multicast = fc
  .tuple(fc.integer({ min: 224, max: 239 }), octetArb, octetArb, octetArb)
  .map(joinOctets);

// 240.0.0.0/4 — reserved (first octet 240..255)
const ipv4_reserved = fc
  .tuple(fc.integer({ min: 240, max: 255 }), octetArb, octetArb, octetArb)
  .map(joinOctets);

export const blockedIpv4Arb: fc.Arbitrary<string> = fc.oneof(
  ipv4_10_0_0_0_8,
  ipv4_172_16_0_0_12,
  ipv4_192_168_0_0_16,
  ipv4_127_0_0_0_8,
  ipv4_169_254_0_0_16,
  ipv4_0_0_0_0_8,
  ipv4_multicast,
  ipv4_reserved,
);

// ---------- Public IPv4 -----------------------------------------------------

// First-octet ranges that are entirely outside every blocked IPv4 range
// in the Glossary. We deliberately skip 172 in full (172.16/12 is private)
// and 192 in full (192.168/16 is private) rather than slicing each /8 around
// the private hole, since the resulting space is still huge.
const PUBLIC_FIRST_OCTET_RANGES: ReadonlyArray<readonly [number, number]> = [
  [1, 9], //   skip 0/8 unspecified, 10/8 private
  [11, 126], // skip 127/8 loopback
  [128, 168], // skip 169.254/16 link-local (168 is fine)
  [170, 171], // skip 172/8 to keep the 172.16/12 carve-out simple
  [173, 191], // skip 192 in full (covers 192.168/16)
  [193, 223], // skip 224/4 multicast and 240/4 reserved
];

const publicFirstOctetArb = fc.oneof(
  ...PUBLIC_FIRST_OCTET_RANGES.map(([min, max]) =>
    fc.integer({ min, max }),
  ),
);

export const publicIpv4Arb: fc.Arbitrary<string> = fc
  .tuple(publicFirstOctetArb, octetArb, octetArb, octetArb)
  .map(joinOctets);

// ---------- Blocked IPv6 ranges --------------------------------------------

const hexGroupArb = fc
  .integer({ min: 0, max: 0xffff })
  .map((value) => value.toString(16));

function joinIpv6Groups(groups: readonly string[]): string {
  return groups.join(":");
}

// ::1 loopback
const ipv6_loopback = fc.constant("::1");

// :: unspecified
const ipv6_unspecified = fc.constant("::");

// fe80::/10 — first 16-bit group between 0xfe80 and 0xfebf
const ipv6_linkLocal = fc
  .tuple(
    fc.integer({ min: 0xfe80, max: 0xfebf }).map((n) => n.toString(16)),
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
  )
  .map(joinIpv6Groups);

// fc00::/7 — first 16-bit group between 0xfc00 and 0xfdff
const ipv6_uniqueLocal = fc
  .tuple(
    fc.integer({ min: 0xfc00, max: 0xfdff }).map((n) => n.toString(16)),
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
  )
  .map(joinIpv6Groups);

// ff00::/8 — first 16-bit group between 0xff00 and 0xffff
const ipv6_multicast_v6 = fc
  .tuple(
    fc.integer({ min: 0xff00, max: 0xffff }).map((n) => n.toString(16)),
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
  )
  .map(joinIpv6Groups);

// ::ffff:<private-IPv4>/96 — IPv4-mapped IPv6 of any blocked IPv4
const ipv6_v4mapped = blockedIpv4Arb.map((ipv4) => `::ffff:${ipv4}`);

export const blockedIpv6Arb: fc.Arbitrary<string> = fc.oneof(
  ipv6_loopback,
  ipv6_unspecified,
  ipv6_linkLocal,
  ipv6_uniqueLocal,
  ipv6_multicast_v6,
  ipv6_v4mapped,
);

// ---------- Public IPv6 -----------------------------------------------------

// 2001::/16 is convenient: byte[0] = 0x20 sits outside every IPv6 blocked
// first-byte test in `classifyAddress` (loopback, unspecified, fe80, fc/fd,
// ff, IPv4-mapped). Every 2001:* address therefore classifies as "public".
export const publicIpv6Arb: fc.Arbitrary<string> = fc
  .tuple(
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
    hexGroupArb,
  )
  .map((groups) => ["2001", ...groups].join(":"));

// ---------- Tagged-union classifier ----------------------------------------

export type ClassifiedIp = {
  readonly kind: "blocked" | "public";
  readonly address: string;
};

export const classifiedIpArb: fc.Arbitrary<ClassifiedIp> = fc.oneof(
  blockedIpv4Arb.map((address) => ({ kind: "blocked" as const, address })),
  publicIpv4Arb.map((address) => ({ kind: "public" as const, address })),
  blockedIpv6Arb.map((address) => ({ kind: "blocked" as const, address })),
  publicIpv6Arb.map((address) => ({ kind: "public" as const, address })),
);
