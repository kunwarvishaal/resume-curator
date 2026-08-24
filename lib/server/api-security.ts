import { isIP } from "node:net";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Read JSON without ever buffering more than maxBytes from the request stream.
 * The Content-Length check is only an early rejection; the streaming counter is
 * authoritative because clients and intermediaries can omit that header.
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" && !contentType?.endsWith("+json")) {
    throw new ApiRequestError(415, "Send the request as application/json.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const normalizedLength = contentLength.trim();
    if (!/^\d+$/.test(normalizedLength)) {
      throw new ApiRequestError(400, "The Content-Length header is invalid.");
    }
    const declaredBytes = BigInt(normalizedLength);
    if (declaredBytes > BigInt(maxBytes)) {
      throw new ApiRequestError(413, "Request is too large.");
    }
  }

  if (!request.body) throw new ApiRequestError(400, "Send a valid JSON request.");

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ApiRequestError(413, "Request is too large.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(400, "Send a valid UTF-8 JSON request.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiRequestError(400, "Send a valid JSON request.");
  }
}

type RateBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  windowMs: number;
};

const buckets = new Map<string, RateBucket>();
const MAX_BUCKETS = 5_000;
let lastPruneAt = 0;

function firstValidIp(value: string | null): string | null {
  if (!value) return null;
  for (const part of value.split(",")) {
    const candidate = part.trim().replace(/^\[|\]$/g, "");
    if (candidate.length <= 64 && isIP(candidate)) return candidate.toLowerCase();
  }
  return null;
}

function clientKey(request: Request): string {
  return (
    firstValidIp(request.headers.get("cf-connecting-ip")) ||
    firstValidIp(request.headers.get("x-real-ip")) ||
    firstValidIp(request.headers.get("x-forwarded-for")) ||
    "anonymous"
  );
}

function pruneExpiredBuckets(now: number) {
  if (now - lastPruneAt < 30_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  lastPruneAt = now;
}

/**
 * A deliberately small, in-memory limiter. It is useful as best-effort abuse
 * protection per warm serverless instance, but it is not a distributed quota.
 */
export function takeRateLimit(
  request: Request,
  namespace: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  pruneExpiredBuckets(now);
  const key = `${namespace}:${clientKey(request)}`;
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value as string | undefined;
      if (oldestKey) buckets.delete(oldestKey);
    }
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  if (bucket.count >= limit) {
    return { allowed: false, limit, remaining: 0, resetAt: bucket.resetAt, windowMs };
  }

  bucket.count += 1;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    windowMs,
  };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1_000));
  return {
    "retry-after": String(retryAfter),
    "ratelimit-limit": String(result.limit),
    "ratelimit-remaining": String(result.remaining),
    "ratelimit-reset": String(retryAfter),
    "ratelimit-policy": `${result.limit};w=${Math.ceil(result.windowMs / 1_000)}`,
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
    "x-ratelimit-reset": String(Math.ceil(result.resetAt / 1_000)),
  };
}
