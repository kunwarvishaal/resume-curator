import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CareerDataError,
  cleanJobTitle,
  clearCareerCache,
  isPlausibleMatch,
  lookupCareer,
} from "../lib/server/career-data";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const searchHit = { data: { results: [{ slug: "software-engineer", name: "Software Engineer" }] } };
const career = {
  data: {
    name: "Software Engineer",
    pay_national: { median_annual: 135980, reference_period: "May 2025" },
    education: { bls_typical_entry_education: "Bachelor's degree" },
    outlook: { change_pct: 10.2, annual_openings: 95300 },
  },
};
const requirements = { data: { requirements: { telework_ability: "77.2%", no_prior_experience_required: "24.0%" } } };

function fakeApi(overrides: Record<string, Response> = {}) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    for (const [part, response] of Object.entries(overrides)) if (url.includes(part)) return response;
    if (url.includes("/careers/search")) return jsonResponse(searchHit);
    if (url.endsWith("/requirements")) return jsonResponse(requirements);
    return jsonResponse(career);
  });
}

beforeEach(() => clearCareerCache());

describe("cleanJobTitle", () => {
  it("drops seniority, brackets, company and site names", () => {
    expect(cleanJobTitle("Senior Software Engineer (Remote) - Acme | LinkedIn")).toBe("software engineer");
    expect(cleanJobTitle("Lead Data Analyst II at Globex")).toBe("data analyst");
    expect(cleanJobTitle("Registered Nurse, ICU")).toBe("registered nurse");
  });

  it("returns empty text when nothing usable is left", () => {
    expect(cleanJobTitle("Senior (Remote)")).toBe("");
  });
});

describe("isPlausibleMatch", () => {
  it("accepts real matches and close synonyms", () => {
    expect(isPlausibleMatch("software engineer", "Software Engineer")).toBe(true);
    expect(isPlausibleMatch("software developer", "Software Engineer")).toBe(true);
    expect(isPlausibleMatch("nursing", "Registered Nurse")).toBe(true);
  });

  it("rejects matches that share only a generic word", () => {
    expect(isPlausibleMatch("vibes officer", "Correctional Officer")).toBe(false);
    expect(isPlausibleMatch("growth hacker marketing manager", "Marketing Manager")).toBe(true);
    expect(isPlausibleMatch("product manager", "Construction Manager")).toBe(false);
  });
});

describe("lookupCareer", () => {
  it("builds a snapshot from search, career and requirements", async () => {
    const fetchImpl = fakeApi();
    const result = await lookupCareer("Senior Software Engineer", { fetchImpl });
    expect(result.query).toBe("software engineer");
    expect(result.match).toMatchObject({
      name: "Software Engineer",
      medianAnnualUsd: 135980,
      typicalEducation: "Bachelor's degree",
      outlookChangePct: 10.2,
      teleworkAbility: "77.2%",
      sourceUrl: "https://tryhired.co/careers/software-engineer/",
    });
    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      "https://tryhired.co/api/v1/careers/search?q=software%20engineer",
    );
  });

  it("sends only the cleaned title, never anything else", async () => {
    const fetchImpl = fakeApi();
    await lookupCareer("Software Engineer - Acme", { fetchImpl });
    for (const [url, init] of fetchImpl.mock.calls as unknown as [string, RequestInit][]) {
      expect(url).not.toContain("Acme");
      expect(init.body).toBeUndefined();
    }
  });

  it("returns match: null when nothing is found", async () => {
    const fetchImpl = fakeApi({ "/careers/search": jsonResponse({ data: { results: [] } }) });
    expect((await lookupCareer("Underwater Basket Weaver", { fetchImpl })).match).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("caches results for a day", async () => {
    let now = 0;
    const fetchImpl = fakeApi();
    await lookupCareer("Software Engineer", { fetchImpl, now: () => now });
    await lookupCareer("software engineer", { fetchImpl, now: () => now });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    now = 25 * 60 * 60 * 1_000;
    await lookupCareer("Software Engineer", { fetchImpl, now: () => now });
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it("still answers when the requirements call fails", async () => {
    const fetchImpl = fakeApi({ "/requirements": jsonResponse({}, 404) });
    const result = await lookupCareer("Software Engineer", { fetchImpl });
    expect(result.match?.medianAnnualUsd).toBe(135980);
    expect(result.match?.teleworkAbility).toBeNull();
  });

  it("refuses a slug that could change the URL path", async () => {
    const fetchImpl = fakeApi({
      "/careers/search": jsonResponse({ data: { results: [{ slug: "../admin", name: "x" }] } }),
    });
    await expect(lookupCareer("Software Engineer", { fetchImpl })).rejects.toBeInstanceOf(CareerDataError);
  });

  it("reports a clear error when the API is down", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 503));
    await expect(lookupCareer("Software Engineer", { fetchImpl })).rejects.toThrow("unavailable");
  });
});
