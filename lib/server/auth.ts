// Uses only the Web Crypto API (globalThis.crypto) rather than node:crypto so this
// module works in both the Node.js runtime (API routes) and the Edge runtime
// (middleware, which cannot import Node built-ins).

export const SESSION_COOKIE_NAME = "rc_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const TOKEN_VERSION = "v1";

/**
 * - "password": APP_PASSWORD is set, so every page and API needs a session.
 * - "open":     no password, allowed in development, or in production only when
 *               ALLOW_OPEN_ACCESS=true is set on purpose.
 * - "locked":   production with no password and no opt-in. Fails closed so a
 *               forgotten env var never publishes an open app with a paid API key.
 */
export type AccessMode = "password" | "open" | "locked";

function password(): string {
  return process.env.APP_PASSWORD?.trim() || "";
}

/**
 * The key that signs session cookies. SESSION_SECRET (if set) lets you rotate
 * every session (sign everyone out) without changing the shared password.
 * Changing APP_PASSWORD also invalidates every existing session.
 */
function signingKey(): string {
  return `${process.env.SESSION_SECRET?.trim() || ""}\u0000${password()}`;
}

export function accessMode(env: Record<string, string | undefined> = process.env): AccessMode {
  if (env.APP_PASSWORD?.trim()) return "password";
  if (env.NODE_ENV !== "production") return "open";
  return env.ALLOW_OPEN_ACCESS?.trim().toLowerCase() === "true" ? "open" : "locked";
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

/** Constant-time string comparison (returns false at once only when lengths differ). */
function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** A signed token `v1.<expiresAtSeconds>.<hmac>`; it carries its own expiry, never the password. */
export async function makeSessionToken(nowMs = Date.now()): Promise<string> {
  const expiresAt = Math.floor(nowMs / 1_000) + SESSION_MAX_AGE_SECONDS;
  const signature = await hmacSha256Hex(`${TOKEN_VERSION}.${expiresAt}`, signingKey());
  return `${TOKEN_VERSION}.${expiresAt}.${signature}`;
}

export async function verifySessionToken(token: string, nowMs = Date.now()): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION || !/^\d{1,12}$/.test(parts[1])) return false;
  const expiresAt = Number(parts[1]);
  const now = Math.floor(nowMs / 1_000);
  // Reject expired tokens, and tokens claiming a lifetime longer than we ever issue.
  if (expiresAt <= now || expiresAt > now + SESSION_MAX_AGE_SECONDS + 60) return false;
  const expected = await hmacSha256Hex(`${TOKEN_VERSION}.${expiresAt}`, signingKey());
  return timingSafeEqualString(parts[2], expected);
}

function parseCookies(header: string | null): Record<string, string> {
  const jar: Record<string, string> = {};
  if (!header) return jar;
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!key) continue;
    try {
      jar[key] = decodeURIComponent(value);
    } catch {
      // A malformed cookie must not crash the middleware; skip it.
    }
  }
  return jar;
}

/** True when access is open, or the request carries a valid, unexpired session cookie. */
export async function isAuthedRequest(request: Request): Promise<boolean> {
  const mode = accessMode();
  if (mode === "open") return true;
  if (mode === "locked") return false;
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE_NAME];
  return token ? verifySessionToken(token) : false;
}

export async function sessionCookieHeader(): Promise<string> {
  const value = await makeSessionToken();
  return `${SESSION_COOKIE_NAME}=${value}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

/**
 * Compares HMACs of both values, so the comparison takes the same time
 * whatever the candidate's length or content (no length or prefix leak).
 */
export async function passwordMatches(candidate: string): Promise<boolean> {
  const expected = password();
  if (!expected) return false;
  const key = "resume-curator-password-check";
  const [a, b] = await Promise.all([hmacSha256Hex(candidate, key), hmacSha256Hex(expected, key)]);
  return timingSafeEqualString(a, b);
}
