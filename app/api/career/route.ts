import { z } from "zod";
import { CareerDataError, lookupCareer } from "../../../lib/server/career-data";
import { describeError, log } from "../../../lib/server/log";
import {
  ApiRequestError,
  rateLimitHeaders,
  readJsonBody,
  takeRateLimit,
} from "../../../lib/server/api-security";

const MAX_REQUEST_BYTES = 2_000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const noStoreHeaders = { "cache-control": "no-store" };

const bodySchema = z.object({ title: z.string().trim().min(2).max(300) }).strict();

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...noStoreHeaders, ...headers } });
}

// POST { title } -> { query, match } with a U.S. career snapshot, or match: null.
// Sits behind the password gate in middleware.ts like every other API route.
export async function POST(request: Request) {
  const rateLimit = takeRateLimit(request, "career", RATE_LIMIT, RATE_WINDOW_MS);
  if (!rateLimit.allowed) {
    log("warn", "career.rate_limited");
    return json({ error: "Too many career lookups. Please wait a moment." }, 429, rateLimitHeaders(rateLimit));
  }

  let raw: unknown;
  try {
    raw = await readJsonBody(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof ApiRequestError) return json({ error: error.message }, error.status);
    return json({ error: "Send a valid JSON request." }, 400);
  }

  const body = bodySchema.safeParse(raw);
  if (!body.success) return json({ error: "Enter a job title (2–300 characters)." }, 400);

  try {
    const result = await lookupCareer(body.data.title);
    // Log whether it matched, never the title itself (it can hint at who is applying where).
    log("info", "career.lookup", { matched: Boolean(result.match) });
    return json(result);
  } catch (error) {
    if (error instanceof CareerDataError) {
      log("warn", "career.unavailable", { reason: error.message });
      return json({ error: error.message }, 502);
    }
    log("error", "career.failed", { error: describeError(error) });
    return json({ error: "Something went wrong while looking up career data." }, 500);
  }
}
