import { describe, expect, it } from "vitest";
import { isPublicIp, validatePublicUrl } from "../lib/server/public-url";

describe("isPublicIp", () => {
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows public address %s", (ip) => {
    expect(isPublicIp(ip)).toBe(true);
  });

  it.each([
    "127.0.0.1",
    "10.0.0.5",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata endpoint
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
  ])("blocks private or reserved address %s", (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });
});

describe("validatePublicUrl (SSRF guard)", () => {
  it("accepts a normal public job page and drops the fragment", () => {
    const url = validatePublicUrl("https://jobs.example.org/role/123#apply");
    expect(url.toString()).toBe("https://jobs.example.org/role/123");
  });

  it.each([
    ["http://jobs.example.org/", "HTTPS"],
    ["ftp://jobs.example.org/", "HTTPS"],
    ["https://user:pass@jobs.example.org/", "credentials"],
    ["https://jobs.example.org:8443/", "port"],
    ["https://localhost/", "public website"],
    ["https://127.0.0.1/", "public website"],
    ["https://169.254.169.254/latest/meta-data/", "public website"],
    ["https://[::1]/", "public website"],
    ["https://intranet/", "public website"],
    ["https://printer.local/", "public website"],
    ["https://metadata.google.internal/", "public website"],
    ["https://127.0.0.1.nip.io/", "public website"],
    ["not a url", "valid"],
  ])("rejects %s", (value, message) => {
    expect(() => validatePublicUrl(value)).toThrow(message);
  });

  it("checks redirect targets against the same rules", () => {
    const base = new URL("https://jobs.example.org/a");
    expect(validatePublicUrl("/b", base).toString()).toBe("https://jobs.example.org/b");
    expect(() => validatePublicUrl("https://10.0.0.1/", base)).toThrow("public website");
  });
});
