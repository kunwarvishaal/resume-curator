import { z } from "zod";
import { accessMode, passwordMatches, sessionCookieHeader } from "../../../lib/server/auth";
import { ApiRequestError, rateLimitHeaders, readJsonBody, takeRateLimit } from "../../../lib/server/api-security";
import { log } from "../../../lib/server/log";

const MAX_REQUEST_BYTES = 2_000;
const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 60_000;

const requestSchema = z.object({ password: z.string().max(500) }).strict();
const noStoreHeaders = { "cache-control": "no-store" };

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...noStoreHeaders, ...headers } });
}

export async function POST(request: Request) {
  const rateLimit = takeRateLimit(request, "login", RATE_LIMIT, RATE_WINDOW_MS);
  if (!rateLimit.allowed) {
    log("warn", "login.rate_limited");
    return json({ error: "Too many attempts. Please wait a moment and try again." }, 429, rateLimitHeaders(rateLimit));
  }

  const mode = accessMode();
  if (mode === "open") return json({ ok: true });
  if (mode === "locked") return json({ error: "Sign-in is not configured on this deployment." }, 503);

  let raw: unknown;
  try {
    raw = await readJsonBody(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof ApiRequestError) return json({ error: error.message }, error.status);
    return json({ error: "Send a valid JSON request." }, 400);
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success || !(await passwordMatches(parsed.data.password))) {
    log("warn", "login.failed");
    return json({ error: "Incorrect password." }, 401);
  }

  log("info", "login.ok");
  return json({ ok: true }, 200, { "set-cookie": await sessionCookieHeader() });
}
