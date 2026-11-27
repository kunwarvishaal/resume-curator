// Career snapshot from TryHired's free, read-only career data API
// (https://tryhired.co/data/#api), found via the public-apis catalogue.
// It republishes U.S. government data (BLS) and O*NET; no key, no account.
//
// Privacy: only a cleaned job TITLE (e.g. "software engineer") ever leaves this
// server. Resume text and the job description are never sent.
import { z } from "zod";
import { fetchWithRetry } from "./retry";

const API_BASE = "https://tryhired.co/api/v1";
const TOTAL_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000; // the data changes a few times a year
const CACHE_MAX_ENTRIES = 200;
const MAX_TITLE_LENGTH = 100;

export type CareerSnapshot = {
  name: string;
  medianAnnualUsd: number | null;
  payReferencePeriod: string | null;
  typicalEducation: string | null;
  outlookChangePct: number | null;
  annualOpenings: number | null;
  teleworkAbility: string | null;
  noPriorExperience: string | null;
  sourceUrl: string;
  attribution: string;
};

export type CareerLookup = { query: string; match: CareerSnapshot | null };

export class CareerDataError extends Error {}

// Seniority and filler words change the search but not the occupation.
const NOISE_WORDS = new Set([
  "senior", "sr", "junior", "jr", "lead", "principal", "staff", "head", "chief",
  "associate", "assistant", "intern", "trainee", "entry", "level", "mid", "i", "ii", "iii", "iv",
  "remote", "hybrid", "onsite", "contract", "temporary", "full", "part", "time",
]);

/**
 * Turn a job-page title like "Senior Software Engineer (Remote) - Acme | LinkedIn"
 * into a clean search phrase: "software engineer". Returns "" when nothing usable is left.
 */
export function cleanJobTitle(raw: string): string {
  const firstPart = raw.split(/\s[|–—-]\s|\s@\s|\sat\s|,/i)[0] ?? "";
  const words = firstPart
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .toLowerCase()
    .replace(/[^a-z\s/&+]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !NOISE_WORDS.has(word));
  return words.join(" ").slice(0, MAX_TITLE_LENGTH).trim();
}

// Words that appear in many unrelated careers, so sharing only one of them is not a match.
const GENERIC_WORDS = new Set([
  "officer", "manager", "specialist", "worker", "technician", "representative", "coordinator",
  "consultant", "director", "administrator", "operator", "agent", "executive", "clerk",
  "supervisor", "analyst", "engineer", "developer", "designer", "and", "&", "of", "the",
]);

/**
 * TryHired search also returns "any word" matches ("vibes officer" -> "Correctional
 * Officer"). Accept a result only when it shares at least half of the query's words
 * and at least one shared word is specific (not in GENERIC_WORDS).
 */
export function isPlausibleMatch(query: string, careerName: string): boolean {
  const queryWords = query.split(/\s+/).filter(Boolean);
  const nameWords = careerName.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  // "nursing" ~ "nurse", "developers" ~ "developer": compare the first 4 letters.
  const stem = (word: string) => word.slice(0, 4);
  const nameStems = new Set(nameWords.map(stem));
  const shared = queryWords.filter((word) => nameStems.has(stem(word)));
  return shared.length * 2 >= queryWords.length && shared.some((word) => !GENERIC_WORDS.has(word));
}

// Only the fields we use are checked; anything else in the response is ignored.
const searchSchema = z.object({
  data: z.object({
    results: z.array(z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/), name: z.string() })),
  }),
});

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();

const careerSchema = z.object({
  tryhired_url: z.string().url().optional(),
  data: z.object({
    name: z.string(),
    pay_national: z
      .object({ median_annual: nullableNumber, reference_period: nullableString })
      .nullable()
      .optional(),
    education: z.object({ bls_typical_entry_education: nullableString }).nullable().optional(),
    outlook: z.object({ change_pct: nullableNumber, annual_openings: nullableNumber }).nullable().optional(),
  }),
});

const requirementsSchema = z.object({
  data: z.object({
    requirements: z
      .object({ telework_ability: nullableString, no_prior_experience_required: nullableString })
      .nullable()
      .optional(),
  }),
});

type CacheEntry = { value: CareerLookup; expiresAt: number };
const cache = new Map<string, CacheEntry>();

export function clearCareerCache() {
  cache.clear();
}

type Options = { fetchImpl?: typeof fetch; now?: () => number };

async function getJson(path: string, signal: AbortSignal, fetchImpl?: typeof fetch): Promise<unknown | null> {
  const response = await fetchWithRetry(
    `${API_BASE}${path}`,
    { headers: { accept: "application/json", "user-agent": "Resume-Curator/1.0 (career snapshot)" }, signal },
    { maxAttempts: 2, baseDelayMs: 400, maxDelayMs: 2_000, fetchImpl },
  );
  if (response.status === 404) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new CareerDataError(
      response.status === 429 ? "Career data is busy right now. Try again in a minute." : "Career data is unavailable right now.",
    );
  }
  return response.json();
}

/**
 * Look up a job title and return a small career snapshot, or match: null when
 * TryHired has no career for it. Results (including misses) are cached for a day.
 */
export async function lookupCareer(rawTitle: string, options: Options = {}): Promise<CareerLookup> {
  const now = options.now ?? Date.now;
  const query = cleanJobTitle(rawTitle);
  if (query.length < 2) return { query, match: null };

  const cached = cache.get(query);
  if (cached && cached.expiresAt > now()) return cached.value;

  const signal = AbortSignal.timeout(TOTAL_TIMEOUT_MS);
  let result: CareerLookup;
  try {
    const search = searchSchema.safeParse(
      await getJson(`/careers/search?q=${encodeURIComponent(query)}`, signal, options.fetchImpl),
    );
    if (!search.success) throw new CareerDataError("Career data came back in an unexpected format.");
    const best = search.data.data.results.find((result) => isPlausibleMatch(query, result.name));

    if (!best) {
      result = { query, match: null };
    } else {
      // The slug was checked against /^[a-z0-9-]+$/ above, so it cannot change the path.
      const [careerRaw, requirementsRaw] = await Promise.all([
        getJson(`/careers/${best.slug}`, signal, options.fetchImpl),
        getJson(`/careers/${best.slug}/requirements`, signal, options.fetchImpl).catch(() => null),
      ]);
      const career = careerSchema.safeParse(careerRaw);
      if (!career.success) throw new CareerDataError("Career data came back in an unexpected format.");
      const requirements = requirementsSchema.safeParse(requirementsRaw);
      const req = requirements.success ? requirements.data.data.requirements : null;
      const data = career.data.data;

      result = {
        query,
        match: {
          name: data.name,
          medianAnnualUsd: data.pay_national?.median_annual ?? null,
          payReferencePeriod: data.pay_national?.reference_period ?? null,
          typicalEducation: data.education?.bls_typical_entry_education ?? null,
          outlookChangePct: data.outlook?.change_pct ?? null,
          annualOpenings: data.outlook?.annual_openings ?? null,
          teleworkAbility: req?.telework_ability ?? null,
          noPriorExperience: req?.no_prior_experience_required ?? null,
          sourceUrl: `https://tryhired.co/careers/${best.slug}/`,
          attribution: "TryHired, from BLS and O*NET data (U.S. figures)",
        },
      };
    }
  } catch (error) {
    if (error instanceof CareerDataError) throw error;
    if (signal.aborted) throw new CareerDataError("Career data took too long to respond.");
    throw new CareerDataError("Career data is unavailable right now.");
  }

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest) cache.delete(oldest);
  }
  cache.set(query, { value: result, expiresAt: now() + CACHE_TTL_MS });
  return result;
}
