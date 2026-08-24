import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "rc_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.APP_PASSWORD?.trim() || "";
}

/** Deterministic session token derived from the configured password, never the password itself. */
export function makeSessionToken(): string {
  const pass = secret();
  return crypto.createHmac("sha256", pass || "unset-app-password").update("resume-curator-session").digest("hex");
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

/** Returns true when access is open (no password configured) or the request carries a valid session cookie. */
export function isAuthedRequest(request: Request): boolean {
  if (!secret()) return true;
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return false;
  const expected = makeSessionToken();
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function sessionCookieHeader(): string {
  const value = makeSessionToken();
  return `${SESSION_COOKIE_NAME}=${value}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function isPasswordConfigured(): boolean {
  return Boolean(secret());
}

export function passwordMatches(candidate: string): boolean {
  const expected = secret();
  if (!expected) return true;
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}
