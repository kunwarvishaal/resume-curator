// Structured, one-line JSON logs. Vercel (and most log tools) index each line's
// fields, so you can filter by `event` or `level` instead of grepping prose.
//
// Never pass resume text, job descriptions, passwords, cookies, API keys or
// client IPs as fields: these logs are kept by the hosting provider.

type Level = "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | null | undefined>;

export function log(level: Level, event: string, fields: Fields = {}): void {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** A short, safe description of an unknown thrown value (name and message only, no stack). */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 300);
  return String(error).slice(0, 300);
}
