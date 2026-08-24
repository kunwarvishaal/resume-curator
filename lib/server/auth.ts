// Uses only the Web Crypto API (globalThis.crypto) rather than node:crypto so this
// module works in both the Node.js runtime (API routes) and the Edge runtime
// (middleware, which cannot import Node built-ins).

export const SESSION_COOKIE_NAME = "rc_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.APP_PASSWORD?.trim() || "";
}

async function hmacSha256Hex(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Deterministic session token derived from the configured password, never the password itself. */
export async function makeSessionToken(): Promise<string> {
  const pass = secret();
  return hmacSha256Hex("resume-curator-session", pass || "unset-app-password");
}

function parseCookies(header: string | null): Record<string, string> {
  const jar: Record<string, string> = {};
  if (!header) return jar;
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) jar[key] = decodeURIComponent(value);
  }
  return jar;
}

/** Constant-time string comparison (equal-length inputs only; caller checks length first). */
function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Returns true when access is open (no password configured) or the request carries a valid session cookie. */
export async function isAuthedRequest(request: Request): Promise<boolean> {
  if (!secret()) return true;
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return false;
  const expected = await makeSessionToken();
  return timingSafeEqualString(token, expected);
}

export async function sessionCookieHeader(): Promise<string> {
  const value = await makeSessionToken();
  return `${SESSION_COOKIE_NAME}=${value}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function isPasswordConfigured(): boolean {
  return Boolean(secret());
}

export function passwordMatches(candidate: string): boolean {
  const expected = secret();
  if (!expected) return true;
  if (candidate.length !== expected.length) return false;
  return timingSafeEqualString(candidate, expected);
}
