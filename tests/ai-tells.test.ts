import { describe, expect, it } from "vitest";
import { describeTells, findAiTells } from "../lib/ai-tells";
import { analyzeAts, DEMO_JD, DEMO_RESUME, type ResumeDocument } from "../lib/resume-engine";

const matches = (text: string) => findAiTells(text).map((tell) => tell.match.toLowerCase());

describe("findAiTells", () => {
  it("finds over-used words in any form", () => {
    expect(matches("Leveraged data and spearheaded a pivotal launch, showcasing results.")).toEqual([
      "leveraged",
      "spearheaded",
      "pivotal",
      "showcasing",
    ]);
  });

  it("finds stock phrases and structures", () => {
    expect(matches("Played a crucial role in hiring.")).toContain("played a crucial role");
    expect(matches("Not only cut costs but also grew revenue.")[0]).toMatch(/^not only/);
    expect(matches("Moved fast in order to ship.")).toEqual(["in order to"]);
  });

  it("flags a spaced em dash but not a date range", () => {
    expect(matches("Built the API — then scaled it.")).toEqual(["—"]);
    expect(matches("2021–2024 at Acme")).toEqual([]);
  });

  it("leaves plain, specific bullets alone", () => {
    expect(findAiTells("Led 6 engineers; cut checkout time 30% by caching prices.")).toEqual([]);
    expect(findAiTells("Landscape architect. Taught dynamic programming.")).toEqual([]);
    expect(findAiTells("")).toEqual([]);
  });

  it("returns tells in the order they appear", () => {
    expect(matches("Robust and seamless, a testament to grit.")).toEqual(["robust", "seamless", "testament"]);
  });
});

describe("describeTells", () => {
  it("lists up to three unique matches and counts the rest", () => {
    const tells = findAiTells("leverage, Leverage, pivotal, robust, seamless, crucial");
    expect(describeTells(tells)).toBe("“leverage”, “pivotal”, “robust” and 2 more");
    expect(describeTells(findAiTells("pivotal and robust"))).toBe("“pivotal” and “robust”");
    expect(describeTells([])).toBe("");
  });
});

describe("analyzeAts with AI tells", () => {
  const withBullet = (bullet: string): ResumeDocument => ({
    ...DEMO_RESUME,
    experience: DEMO_RESUME.experience.map((entry, index) =>
      index === 0 ? { ...entry, bullets: [bullet, ...entry.bullets.slice(1)] } : entry,
    ),
  });

  it("the demo resume has no tells and no warning", () => {
    expect(analyzeAts(DEMO_RESUME, DEMO_JD).warnings.join(" ")).not.toMatch(/AI-written/);
  });

  it("warns and lowers the language score when tells appear", () => {
    const clean = analyzeAts(DEMO_RESUME, DEMO_JD);
    const generated = analyzeAts(
      withBullet("Leveraged robust, seamless tooling that played a pivotal role in growth."),
      DEMO_JD,
    );
    expect(generated.warnings.join(" ")).toMatch(/reads as AI-written \(“leveraged”, “robust”, “seamless” and/);
    expect(generated.language).toBeLessThan(clean.language);
  });
});
