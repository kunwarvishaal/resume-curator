import { isIP } from "node:net";
import { ApiRequestError } from "./api-security";

// SSRF guard for the job-page importer: only public HTTPS hosts on port 443 are
// allowed, so the server can never be pointed at localhost, a private network or
// a cloud metadata endpoint. DNS answers are checked separately in the route.

function isPublicIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((octet) => octet > 255)) return false;
  const [a, b] = octets;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && octets[2] === 100) ||
    (a === 203 && b === 0 && octets[2] === 113) ||
    a >= 224
  );
}

function isPublicIpv6(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host) !== 6) return false;

  // Public job pages should resolve to global unicast space. This excludes
  // loopback, link-local, unique-local, multicast, mapped IPv4 and NAT64 ranges.
  const segments = host.split(":");
  const first = Number.parseInt(segments[0] || "0", 16);
  const second = Number.parseInt(segments[1] || "0", 16);
  if (first < 0x2000 || first > 0x3fff) return false;

  // Exclude globally scoped documentation and transition/benchmark ranges.
  if (first === 0x2002) return false; // 6to4
  if (
    first === 0x2001 &&
    (second === 0 || second === 2 || second === 0x0db8 || (second >= 0x10 && second <= 0x2f))
  ) {
    return false;
  }
  if (first === 0x3fff && second < 0x1000) return false;
  return true;
}

export function isPublicIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPublicIpv4(address);
  if (version === 6) return isPublicIpv6(address);
  return false;
}

export function validatePublicUrl(value: string, base?: URL): URL {
  let url: URL;
  try {
    url = base ? new URL(value, base) : new URL(value);
  } catch {
    throw new ApiRequestError(400, "Enter a valid public HTTPS URL.");
  }

  if (url.protocol !== "https:") throw new ApiRequestError(400, "Only public HTTPS job URLs are supported.");
  if (url.username || url.password) throw new ApiRequestError(400, "URLs with embedded credentials are not supported.");
  if (url.port && url.port !== "443") throw new ApiRequestError(400, "Only the standard HTTPS port is supported.");

  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  const blockedSuffixes = [
    ".localhost",
    ".local",
    ".internal",
    ".home",
    ".lan",
    ".test",
    ".invalid",
    ".example",
    ".nip.io",
    ".sslip.io",
    ".localtest.me",
    ".lvh.me",
  ];
  const ipVersion = isIP(host);
  if (
    (!host.includes(".") && ipVersion === 0) ||
    host === "localhost" ||
    host === "metadata.google.internal" ||
    blockedSuffixes.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix)) ||
    (ipVersion !== 0 && !isPublicIp(host))
  ) {
    throw new ApiRequestError(400, "That URL does not point to a public website.");
  }

  url.hash = "";
  return url;
}
