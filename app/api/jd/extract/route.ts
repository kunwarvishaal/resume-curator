import dns from "node:dns";
import { isIP } from "node:net";
import {
  ApiRequestError,
  rateLimitHeaders,
  readJsonBody,
  takeRateLimit,
} from "../../../../lib/server/api-security";

const MAX_REQUEST_BYTES = 10_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_JOB_TEXT = 30_000;
const REDIRECT_LIMIT = 3;
const FETCH_TIMEOUT_MS = 12_000;
const DNS_TIMEOUT_MS = 4_000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const noStoreHeaders = { "cache-control": "no-store" };

class RouteError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...noStoreHeaders, ...headers } });
}

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

function isPublicIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPublicIpv4(address);
  if (version === 6) return isPublicIpv6(address);
  return false;
}

function validatePublicUrl(value: string, base?: URL): URL {
  let url: URL;
  try {
    url = base ? new URL(value, base) : new URL(value);
  } catch {
    throw new RouteError(400, "Enter a valid public HTTPS URL.");
  }

  if (url.protocol !== "https:") throw new RouteError(400, "Only public HTTPS job URLs are supported.");
  if (url.username || url.password) throw new RouteError(400, "URLs with embedded credentials are not supported.");
  if (url.port && url.port !== "443") throw new RouteError(400, "Only the standard HTTPS port is supported.");

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
    throw new RouteError(400, "That URL does not point to a public website.");
  }

  url.hash = "";
  return url;
}

async function resolvePublicHostname(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (isIP(host)) {
    if (!isPublicIp(host)) throw new RouteError(400, "That URL does not point to a public website.");
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const lookup = Promise.allSettled([dns.promises.resolve4(host), dns.promises.resolve6(host)]);
    const results = await Promise.race([
      lookup,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("DNS lookup timed out")), DNS_TIMEOUT_MS);
      }),
    ]);
    const addresses = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    if (addresses.length === 0) {
      throw new RouteError(422, "The job page hostname could not be safely resolved.");
    }
    if (addresses.some((address) => !isPublicIp(address))) {
      throw new RouteError(400, "That URL does not point to a public website.");
    }
  } catch (error) {
    if (error instanceof RouteError) throw error;
    throw new RouteError(422, "The job page hostname could not be safely resolved.");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readLimitedBody(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let result = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new RouteError(413, "That page is too large to import safely.");
    }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}

async function fetchPublicPage(initialUrl: URL): Promise<{ html: string; finalUrl: URL }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let current = initialUrl;

  try {
    for (let redirect = 0; redirect <= REDIRECT_LIMIT; redirect += 1) {
      await resolvePublicHostname(current);
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
          "user-agent": "Resume-Curator/1.0 (job description importer)",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => undefined);
        if (!location || redirect === REDIRECT_LIMIT) {
          throw new RouteError(422, "The job page redirected too many times.");
        }
        current = validatePublicUrl(location, current);
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new RouteError(422, "The job page could not be read.");
      }
      const contentType = response.headers.get("content-type")?.toLowerCase() || "";
      if (!/^(?:text\/html|text\/plain|application\/xhtml\+xml)(?:;|$)/.test(contentType)) {
        await response.body?.cancel().catch(() => undefined);
        throw new RouteError(415, "That URL does not return a readable job page.");
      }
      const declaredLength = Number(response.headers.get("content-length") || "0");
      if (declaredLength > MAX_RESPONSE_BYTES) {
        await response.body?.cancel().catch(() => undefined);
        throw new RouteError(413, "That page is too large to import safely.");
      }
      return { html: await readLimitedBody(response), finalUrl: current };
    }
  } catch (error) {
    if (error instanceof RouteError) throw error;
    if (controller.signal.aborted) throw new RouteError(408, "The job page took too long to respond.");
    throw new RouteError(422, "The job page could not be read.");
  } finally {
    clearTimeout(timeout);
  }

  throw new RouteError(422, "The job page could not be read.");
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#")) {
      const hexadecimal = code[1]?.toLowerCase() === "x";
      const point = Number.parseInt(code.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    return named[code.toLowerCase()] ?? entity;
  });
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|svg|noscript|template|nav|header|footer|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article)\b[^>]*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const type = record["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return record;
  return findJobPosting(record["@graph"]);
}

function extractJobPosting(html: string): { text: string; title?: string } | null {
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    try {
      const data = JSON.parse(match[1].replace(/^\s*<!--|-->\s*$/g, "").trim());
      const posting = findJobPosting(data);
      if (!posting) continue;
      const description = typeof posting.description === "string" ? htmlToText(posting.description) : "";
      if (description.length < 80) continue;
      const title = typeof posting.title === "string" ? htmlToText(posting.title).slice(0, 300) : undefined;
      return { text: description.slice(0, MAX_JOB_TEXT), title };
    } catch {
      // Ignore malformed structured data and continue with visible page text.
    }
  }
  return null;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const title = match ? htmlToText(match[1]) : "";
  return title ? title.slice(0, 300) : undefined;
}

export async function POST(request: Request) {
  const rateLimit = takeRateLimit(request, "job-description", RATE_LIMIT, RATE_WINDOW_MS);
  if (!rateLimit.allowed) {
    return json(
      { error: "Too many job-page imports. Please wait a moment and try again." },
      429,
      rateLimitHeaders(rateLimit),
    );
  }

  let raw: unknown;
  try {
    raw = await readJsonBody(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof ApiRequestError) return json({ error: error.message }, error.status);
    return json({ error: "Send a valid JSON request." }, 400);
  }

  try {
    const body = raw as { url?: unknown };
    if (typeof body.url !== "string" || body.url.length > 2_000) {
      return json({ error: "Enter a valid public HTTPS URL." }, 400);
    }

    const initialUrl = validatePublicUrl(body.url.trim());
    const { html, finalUrl } = await fetchPublicPage(initialUrl);
    const structured = extractJobPosting(html);
    const text = structured?.text || htmlToText(html).slice(0, MAX_JOB_TEXT);
    if (text.length < 80) throw new RouteError(422, "No complete job description was found on that page.");

    return json({
      text,
      title: structured?.title || extractTitle(html),
      sourceUrl: finalUrl.toString(),
    });
  } catch (error) {
    if (error instanceof RouteError) return json({ error: error.message }, error.status);
    return json({ error: "Send a valid JSON request." }, 400);
  }
}
