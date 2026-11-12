export type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal | null) => Promise<void>;
  random?: () => number;
  onRetry?: (info: { attempt: number; delayMs: number; status?: number; error?: unknown }) => void;
};

/** 429 and 5xx are worth another try; every other status is a real answer. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Exponential backoff with jitter: base, 2x base, 4x base ... capped at maxDelayMs,
 * plus up to 25% random jitter so many clients do not retry in lockstep.
 * A Retry-After header (seconds) wins when it is present and within the cap.
 */
export function backoffDelay(
  attempt: number,
  options: Pick<RetryOptions, "baseDelayMs" | "maxDelayMs" | "random">,
  retryAfter?: string | null,
): number {
  const seconds = retryAfter ? Number(retryAfter.trim()) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, options.maxDelayMs);
  }
  const exponential = Math.min(options.baseDelayMs * 2 ** (attempt - 1), options.maxDelayMs);
  const jitter = exponential * 0.25 * (options.random ?? Math.random)();
  return Math.round(exponential + jitter);
}

function defaultSleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * fetch() with retries for network errors, 429 and 5xx. Returns the last
 * Response (which may still be an error status) or throws the last network
 * error. Pass an AbortSignal in init to cap the total time across attempts.
 * The request body must be replayable (a string, not a stream).
 */
export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit,
  options: RetryOptions,
): Promise<Response> {
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; ; attempt += 1) {
    let response: Response;
    try {
      response = await doFetch(input, init);
    } catch (error) {
      if (init.signal?.aborted || attempt >= options.maxAttempts) throw error;
      const delayMs = backoffDelay(attempt, options);
      options.onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs, init.signal);
      continue;
    }

    if (response.ok || !isRetryableStatus(response.status) || attempt >= options.maxAttempts) {
      return response;
    }

    await response.body?.cancel().catch(() => undefined);
    const delayMs = backoffDelay(attempt, options, response.headers.get("retry-after"));
    options.onRetry?.({ attempt, delayMs, status: response.status });
    await sleep(delayMs, init.signal);
  }
}
