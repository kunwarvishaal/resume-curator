import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  accessMode,
  isAuthedRequest,
  makeSessionToken,
  passwordMatches,
  sessionCookieHeader,
  verifySessionToken,
} from "../lib/server/auth";

const NOW = Date.UTC(2026, 10, 12, 12, 0, 0);

function requestWithCookie(cookie?: string) {
  return new Request("https://app.example/", { headers: cookie ? { cookie } : {} });
}

beforeEach(() => {
  vi.stubEnv("APP_PASSWORD", "correct horse battery staple");
  vi.stubEnv("SESSION_SECRET", "");
  vi.stubEnv("ALLOW_OPEN_ACCESS", "");
});

describe("accessMode", () => {
  it("requires a password when one is configured", () => {
    expect(accessMode({ APP_PASSWORD: "x", NODE_ENV: "production" })).toBe("password");
  });

  it("is open in development without a password", () => {
    expect(accessMode({ NODE_ENV: "development" })).toBe("open");
  });

  it("fails closed in production without a password", () => {
    expect(accessMode({ NODE_ENV: "production" })).toBe("locked");
    expect(accessMode({ NODE_ENV: "production", APP_PASSWORD: "   " })).toBe("locked");
  });

  it("allows an explicit opt-in to open access in production", () => {
    expect(accessMode({ NODE_ENV: "production", ALLOW_OPEN_ACCESS: "true" })).toBe("open");
    expect(accessMode({ NODE_ENV: "production", ALLOW_OPEN_ACCESS: "yes" })).toBe("locked");
  });
});

describe("session tokens", () => {
  it("round-trips a fresh token", async () => {
    const token = await makeSessionToken(NOW);
    expect(token).toMatch(/^v1\.\d+\.[0-9a-f]{64}$/);
    expect(await verifySessionToken(token, NOW)).toBe(true);
  });

  it("never contains the password", async () => {
    expect(await makeSessionToken(NOW)).not.toContain("correct");
  });

  it("expires after the max age", async () => {
    const token = await makeSessionToken(NOW);
    const justBefore = NOW + (SESSION_MAX_AGE_SECONDS - 1) * 1_000;
    const after = NOW + (SESSION_MAX_AGE_SECONDS + 1) * 1_000;
    expect(await verifySessionToken(token, justBefore)).toBe(true);
    expect(await verifySessionToken(token, after)).toBe(false);
  });

  it("rejects a token whose expiry was edited", async () => {
    const [version, expiresAt, signature] = (await makeSessionToken(NOW)).split(".");
    const extended = `${version}.${Number(expiresAt) + 86_400}.${signature}`;
    expect(await verifySessionToken(extended, NOW)).toBe(false);
  });

  it("rejects a token signed far in the future", async () => {
    const future = await makeSessionToken(NOW + 365 * 86_400_000);
    expect(await verifySessionToken(future, NOW)).toBe(false);
  });

  it("is invalidated by changing the password", async () => {
    const token = await makeSessionToken(NOW);
    vi.stubEnv("APP_PASSWORD", "a new password");
    expect(await verifySessionToken(token, NOW)).toBe(false);
  });

  it("is invalidated by rotating SESSION_SECRET", async () => {
    const token = await makeSessionToken(NOW);
    vi.stubEnv("SESSION_SECRET", "rotated");
    expect(await verifySessionToken(token, NOW)).toBe(false);
  });

  it.each(["", "garbage", "v1.abc.def", "v2.1.2", "v1.1.2.3"])("rejects malformed token %j", async (token) => {
    expect(await verifySessionToken(token, NOW)).toBe(false);
  });
});

describe("isAuthedRequest", () => {
  it("accepts a valid session cookie", async () => {
    const token = await makeSessionToken();
    expect(await isAuthedRequest(requestWithCookie(`a=1; ${SESSION_COOKIE_NAME}=${token}`))).toBe(true);
  });

  it("rejects a missing or malformed cookie without throwing", async () => {
    expect(await isAuthedRequest(requestWithCookie())).toBe(false);
    expect(await isAuthedRequest(requestWithCookie(`${SESSION_COOKIE_NAME}=%E0%A4%A`))).toBe(false);
  });

  it("rejects every request when production has no password", async () => {
    vi.stubEnv("APP_PASSWORD", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(await isAuthedRequest(requestWithCookie())).toBe(false);
  });
});

describe("passwordMatches", () => {
  it("accepts only the exact password", async () => {
    expect(await passwordMatches("correct horse battery staple")).toBe(true);
    expect(await passwordMatches("correct horse battery stapl")).toBe(false);
    expect(await passwordMatches("")).toBe(false);
  });

  it("never matches when no password is configured", async () => {
    vi.stubEnv("APP_PASSWORD", "");
    expect(await passwordMatches("")).toBe(false);
  });
});

describe("sessionCookieHeader", () => {
  it("sets HttpOnly, Secure and SameSite", async () => {
    const header = await sessionCookieHeader();
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);
  });
});
