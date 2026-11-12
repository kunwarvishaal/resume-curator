/**
 * Only same-site paths are allowed as a post-login destination. Anything else
 * (https://evil.example, //evil.example, /\evil.example, javascript:...) falls
 * back to "/", so a crafted /login?next=... link cannot send users off-site.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || value.length > 2_000) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  // Control characters and backslashes can be normalized by browsers into "//".
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://same-origin.invalid");
    if (url.origin !== "https://same-origin.invalid") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
