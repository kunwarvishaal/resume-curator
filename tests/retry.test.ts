import { describe, expect, it, vi } from "vitest";
import { backoffDelay, fetchWithRetry, isRetryableStatus } from "../lib/server/retry";

const options = { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 4_000, random: () => 0 };
const noSleep = vi.fn(async () => undefined);

function respond(status: number, headers: Record<string, string> = {}) {
  return new Response(status === 204 ? null : "{}", { status, headers });
}

describe("backoffDelay", () => {
  it("doubles each attempt and caps at the maximum", () => {
    expect([1, 2, 3, 4, 5].map((attempt) => backoffDelay(attempt, options))).toEqual([500, 1_000, 2_000, 4_000, 4_000]);
  });

  it("adds at most 25% jitter", () => {
    expect(backoffDelay(1, { ...options, random: () => 0.999 })).toBeLessThanOrEqual(625);
  });

  it("honours Retry-After within the cap", () => {
    expect(backoffDelay(1, options, "2")).toBe(2_000);
    expect(backoffDelay(1, options, "120")).toBe(4_000);
    expect(backoffDelay(1, options, "soon")).toBe(500);
  });
});

describe("isRetryableStatus", () => {
  it("retries rate limits and server errors only", () => {
    expect([429, 500, 502, 503].every(isRetryableStatus)).toBe(true);
    expect([200, 400, 401, 404, 422].some(isRetryableStatus)).toBe(false);
  });
});

describe("fetchWithRetry", () => {
  it("retries a 503 and returns the later success", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(respond(503)).mockResolvedValueOnce(respond(200));
    const response = await fetchWithRetry("https://api.example", {}, { ...options, fetchImpl, sleep: noSleep });
    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 400", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respond(400));
    const response = await fetchWithRetry("https://api.example", {}, { ...options, fetchImpl, sleep: noSleep });
    expect(response.status).toBe(400);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts and returns the last error response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respond(429));
    const onRetry = vi.fn();
    const response = await fetchWithRetry("https://api.example", {}, { ...options, fetchImpl, sleep: noSleep, onRetry });
    expect(response.status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("retries network errors, then rethrows the last one", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      fetchWithRetry("https://api.example", {}, { ...options, fetchImpl, sleep: noSleep }),
    ).rejects.toThrow("fetch failed");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("stops retrying once the deadline signal has fired", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    await expect(
      fetchWithRetry("https://api.example", { signal: controller.signal }, { ...options, fetchImpl, sleep: noSleep }),
    ).rejects.toThrow("aborted");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
