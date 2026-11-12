import { describe, expect, it } from "vitest";
import { safeNextPath } from "../lib/safe-redirect";

describe("safeNextPath (open-redirect guard)", () => {
  it.each([
    ["/", "/"],
    ["/workspace", "/workspace"],
    ["/a/b?x=1#top", "/a/b?x=1#top"],
  ])("keeps same-site path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/\tevil",
    "evil.example",
  ])("falls back to / for %j", (input) => {
    expect(safeNextPath(input)).toBe("/");
  });
});
