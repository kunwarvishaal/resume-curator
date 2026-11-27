import { accessMode } from "../../../lib/server/auth";

// Health check for uptime monitors (e.g. a free UptimeRobot check every 5 minutes).
// Public on purpose and reveals nothing sensitive: just whether the app can serve.
// "locked" (production without APP_PASSWORD) reports 503 so a monitor alerts on it.
export const dynamic = "force-dynamic";

export function GET() {
  const mode = accessMode();
  const ok = mode !== "locked";
  return Response.json(
    { ok, status: ok ? "ok" : "locked", time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
