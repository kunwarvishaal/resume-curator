import { describe, expect, it } from "vitest";
import { ApiRequestError, readJsonBody, takeRateLimit } from "../lib/server/api-security";

function jsonRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("https://app.example/api", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
  });
}

async function statusOf(promise: Promise<unknown>): Promise<number | "ok"> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return error instanceof ApiRequestError ? error.status : -1;
  }
}

describe("readJsonBody", () => {
  it("parses a small JSON body", async () => {
    expect(await readJsonBody(jsonRequest('{"a":1}'), 100)).toEqual({ a: 1 });
  });

  it("rejects the wrong content type with 415", async () => {
    expect(await statusOf(readJsonBody(jsonRequest("{}", { "content-type": "text/plain" }), 100))).toBe(415);
  });

  it("rejects an oversized body with 413 even without Content-Length", async () => {
    expect(await statusOf(readJsonBody(jsonRequest(JSON.stringify({ x: "y".repeat(500) })), 100))).toBe(413);
  });

  it("rejects invalid JSON with 400", async () => {
    expect(await statusOf(readJsonBody(jsonRequest("{nope"), 100))).toBe(400);
  });
});

describe("takeRateLimit", () => {
  it("allows up to the limit per client, then blocks", () => {
    const request = new Request("https://app.example/", { headers: { "x-real-ip": "203.0.113.7" } });
    const namespace = `test-${Math.random()}`;
    const results = Array.from({ length: 4 }, () => takeRateLimit(request, namespace, 3, 60_000));
    expect(results.map((result) => result.allowed)).toEqual([true, true, true, false]);
    expect(results[3].remaining).toBe(0);
  });

  it("counts different clients separately", () => {
    const namespace = `test-${Math.random()}`;
    const a = new Request("https://app.example/", { headers: { "x-real-ip": "203.0.113.8" } });
    const b = new Request("https://app.example/", { headers: { "x-real-ip": "203.0.113.9" } });
    takeRateLimit(a, namespace, 1, 60_000);
    expect(takeRateLimit(a, namespace, 1, 60_000).allowed).toBe(false);
    expect(takeRateLimit(b, namespace, 1, 60_000).allowed).toBe(true);
  });
});
