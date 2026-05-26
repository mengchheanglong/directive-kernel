import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type AddressClassification =
  | "loopback"
  | "private"
  | "linkLocal"
  | "unspecified"
  | "multicast"
  | "reserved"
  | "uniqueLocal"
  | "public";

export type AssertUrlIsSafeOptions = {
  /**
   * When false, every URL is rejected with ssrf_blocked_offline:.
   * When true (default), URLs are classified by scheme and IP.
   */
  allowExternalFetches?: boolean;
  /**
   * When non-empty, the URL's registered hostname must equal one of these
   * (case-insensitive). When empty or undefined, no allowlist is applied.
   */
  allowlistDomains?: readonly string[];
  /**
   * When true, loopback addresses (127.0.0.0/8, ::1) are accepted.
   * When false (default), loopback is rejected like any other blocked range.
   */
  allowLoopback?: boolean;
  /**
   * Injectable resolver for testing. Must return one or more IP literals.
   * Defaults to dns.lookup with { all: true, family: 0, verbatim: true }.
   */
  resolver?: (hostname: string) => Promise<readonly string[]>;
};

const HTTP_SCHEMES = new Set(["http:", "https:"]);

async function defaultResolver(hostname: string): Promise<readonly string[]> {
  const results = await lookup(hostname, {
    all: true,
    family: 0,
    verbatim: true,
  });
  return results.map((entry) => entry.address);
}

export async function assertUrlIsSafe(
  url: string | URL,
  options: AssertUrlIsSafeOptions = {},
): Promise<void> {
  const parsed = url instanceof URL ? url : new URL(url);

  if (options.allowExternalFetches === false) {
    throw new Error(`ssrf_blocked_offline:${parsed.href}`);
  }

  if (!HTTP_SCHEMES.has(parsed.protocol)) {
    throw new Error(`ssrf_blocked_scheme:${parsed.protocol}`);
  }

  const hostname = parsed.hostname;
  // IPv6 literals come back from the URL parser wrapped in brackets
  // (e.g. "[::1]"); strip them before classification or DNS lookup.
  const bareHostname =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;

  if (options.allowlistDomains && options.allowlistDomains.length > 0) {
    const lowered = bareHostname.toLowerCase();
    const matched = options.allowlistDomains.some(
      (entry) => entry.toLowerCase() === lowered,
    );
    if (!matched) {
      throw new Error(`ssrf_blocked_allowlist:${bareHostname}`);
    }
  }

  let addresses: readonly string[];
  if (isIP(bareHostname) !== 0) {
    addresses = [bareHostname];
  } else {
    const resolver = options.resolver ?? defaultResolver;
    addresses = await resolver(bareHostname);
  }

  for (const address of addresses) {
    const classification = classifyAddress(address);
    if (classification === "loopback" && options.allowLoopback === true) {
      continue;
    }
    if (classification !== "public") {
      throw new Error(`ssrf_blocked_address:${bareHostname}:${address}`);
    }
  }
}

export function classifyAddress(addr: string): AddressClassification {
  const family = isIP(addr);
  if (family === 4) {
    return classifyIpv4(addr);
  }
  if (family === 6) {
    return classifyIpv6(addr);
  }
  // Anything that isn't a valid IP is conservatively treated as reserved.
  return "reserved";
}

function classifyIpv4(addr: string): AddressClassification {
  const parts = addr.split(".").map((piece) => Number.parseInt(piece, 10));
  const value =
    (((parts[0] ?? 0) << 24) |
      ((parts[1] ?? 0) << 16) |
      ((parts[2] ?? 0) << 8) |
      (parts[3] ?? 0)) >>>
    0;

  // 0.0.0.0/8 unspecified ("this network")
  if (matchesIpv4(value, 0x00000000, 8)) return "unspecified";
  // 127.0.0.0/8 loopback
  if (matchesIpv4(value, 0x7f000000, 8)) return "loopback";
  // 10.0.0.0/8 private
  if (matchesIpv4(value, 0x0a000000, 8)) return "private";
  // 172.16.0.0/12 private
  if (matchesIpv4(value, 0xac100000, 12)) return "private";
  // 192.168.0.0/16 private
  if (matchesIpv4(value, 0xc0a80000, 16)) return "private";
  // 169.254.0.0/16 link-local
  if (matchesIpv4(value, 0xa9fe0000, 16)) return "linkLocal";
  // 224.0.0.0/4 multicast
  if (matchesIpv4(value, 0xe0000000, 4)) return "multicast";
  // 240.0.0.0/4 reserved (includes 255.255.255.255 broadcast)
  if (matchesIpv4(value, 0xf0000000, 4)) return "reserved";
  return "public";
}

function matchesIpv4(value: number, base: number, prefix: number): boolean {
  if (prefix === 0) return true;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return ((value & mask) >>> 0) === ((base & mask) >>> 0);
}

function classifyIpv6(addr: string): AddressClassification {
  const bytes = parseIpv6(addr);

  // IPv4-mapped IPv6 (::ffff:0:0/96): first 80 bits zero, next 16 bits 0xffff.
  let prefixZero = true;
  for (let i = 0; i < 10; i += 1) {
    if (bytes[i] !== 0) {
      prefixZero = false;
      break;
    }
  }
  if (prefixZero && bytes[10] === 0xff && bytes[11] === 0xff) {
    const ipv4 = `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
    return classifyIpv4(ipv4);
  }

  // ::1 loopback
  let isLoopback = true;
  for (let i = 0; i < 15; i += 1) {
    if (bytes[i] !== 0) {
      isLoopback = false;
      break;
    }
  }
  if (isLoopback && bytes[15] === 1) return "loopback";

  // :: unspecified
  if (bytes.every((byte) => byte === 0)) return "unspecified";

  // fe80::/10 link-local: first byte 0xfe, top 2 bits of second byte are 10.
  if (bytes[0] === 0xfe && ((bytes[1] ?? 0) & 0xc0) === 0x80) {
    return "linkLocal";
  }
  // fc00::/7 unique local: top 7 bits of first byte = 0xfc >> 1, so first byte 0xfc or 0xfd.
  if (((bytes[0] ?? 0) & 0xfe) === 0xfc) return "uniqueLocal";
  // ff00::/8 multicast
  if (bytes[0] === 0xff) return "multicast";

  return "public";
}

function parseIpv6(addr: string): number[] {
  // Split off any embedded IPv4 dotted-quad tail (e.g. ::ffff:192.168.1.1).
  let head = addr;
  const tailBytes: number[] = [];
  if (addr.includes(".")) {
    const lastColon = addr.lastIndexOf(":");
    const dotted = addr.slice(lastColon + 1);
    const dottedParts = dotted.split(".").map((p) => Number.parseInt(p, 10));
    if (dottedParts.length !== 4) {
      throw new Error(`ssrf_invalid_ipv6:${addr}`);
    }
    for (const part of dottedParts) {
      tailBytes.push(part & 0xff);
    }
    head = addr.slice(0, lastColon);
  }

  const totalGroups = tailBytes.length > 0 ? 6 : 8;
  let groups: string[];
  if (head.includes("::")) {
    const [left, right] = head.split("::");
    const leftGroups = left ? left.split(":") : [];
    const rightGroups = right ? right.split(":") : [];
    const missing = totalGroups - leftGroups.length - rightGroups.length;
    groups = [
      ...leftGroups,
      ...Array<string>(Math.max(missing, 0)).fill("0"),
      ...rightGroups,
    ];
  } else {
    groups = head.split(":");
  }

  const bytes: number[] = [];
  for (const group of groups) {
    const value = Number.parseInt(group || "0", 16);
    bytes.push((value >>> 8) & 0xff, value & 0xff);
  }
  for (const tailByte of tailBytes) {
    bytes.push(tailByte);
  }
  if (bytes.length !== 16) {
    throw new Error(`ssrf_invalid_ipv6:${addr}`);
  }
  return bytes;
}
