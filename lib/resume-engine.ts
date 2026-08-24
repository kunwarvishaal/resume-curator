export type ExperienceEntry = {
  id: string;
  company: string;
  role: string;
  location: string;
  period: string;
  bullets: string[];
};

export type EducationEntry = {
  id: string;
  school: string;
  degree: string;
  period: string;
};

/**
 * A conservative representation for resume sections that do not fit the core
 * experience/education schema. Keeping each source line as an item avoids
 * silently dropping factual project, credential, award, or publication data.
 */
export type AdditionalSection = {
  id: string;
  title: "Projects" | "Certifications" | "Awards" | "Publications";
  items: string[];
};

export type ResumeDocument = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
  summary: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  /** Optional so older saved/API documents remain valid. */
  additionalSections?: AdditionalSection[];
};

/**
 * An estimated ATS-readiness and job-alignment score. Component scores use the
 * maxima in their comments and add up to `overall` (out of 100).
 */
export type AtsBreakdown = {
  overall: number;
  alignment: number; // / 35
  evidence: number; // / 25
  parseability: number; // / 20
  completeness: number; // / 10
  language: number; // / 10
  matchedKeywords: string[];
  missingKeywords: string[];
  warnings: string[];
};

export type Suggestion = {
  id: string;
  type: "Grammar" | "Vocabulary" | "Impact" | "Keyword";
  before: string;
  after: string;
  rationale: string;
  /** Stable field path, for example `summary` or `experience.exp-1.bullet.0`. */
  target: string;
};

export const DEMO_RESUME: ResumeDocument = {
  name: "Maya Rao",
  headline: "Senior Product Manager | B2B SaaS and AI",
  email: "maya.rao@example.com",
  phone: "+91 98765 43210",
  location: "Bengaluru, India",
  links: [
    "https://www.linkedin.com/in/mayarao",
    "https://mayarao.example.com",
  ],
  summary:
    "Senior product manager with 8+ years of experience building B2B SaaS and AI products. Turns customer research and data analysis into product strategy, measurable roadmaps, and successful go-to-market execution.",
  skills: [
    "Product strategy",
    "Roadmap prioritization",
    "B2B SaaS",
    "AI products",
    "Customer discovery",
    "Data analysis",
    "Agile",
    "A/B testing",
    "Stakeholder management",
    "Go-to-market",
  ],
  experience: [
    {
      id: "exp-northstar",
      company: "Northstar Cloud",
      role: "Senior Product Manager",
      location: "Bengaluru, India",
      period: "2022 – Present",
      bullets: [
        "Led product strategy and roadmap prioritization for an AI-powered B2B SaaS platform used by 240 enterprise customers.",
        "Launched three customer-requested workflows with engineering, design, and sales, increasing weekly active use by 31%.",
        "Built an A/B testing and data analysis practice that improved trial-to-paid conversion from 18% to 26%.",
        "Ran 60+ customer discovery interviews and translated insights into a go-to-market plan that generated $2.4M in qualified pipeline.",
      ],
    },
    {
      id: "exp-orbit",
      company: "Orbit Systems",
      role: "Product Manager",
      location: "Pune, India",
      period: "2018 – 2022",
      bullets: [
        "Owned an Agile roadmap across four cross-functional teams and delivered 92% of committed quarterly outcomes.",
        "Partnered with customer success and enterprise stakeholders to reduce onboarding time by 40%.",
        "Defined product requirements and success metrics for analytics features that grew expansion revenue by $780K annually.",
      ],
    },
  ],
  education: [
    {
      id: "edu-iim",
      school: "Indian Institute of Management Bangalore",
      degree: "MBA, Strategy and Marketing",
      period: "2016 – 2018",
    },
    {
      id: "edu-pune",
      school: "Savitribai Phule Pune University",
      degree: "B.E., Computer Engineering",
      period: "2010 – 2014",
    },
  ],
};

export const DEMO_JD = `Senior Product Manager — B2B SaaS / AI

We are looking for a Senior Product Manager with 7+ years of product management experience to own product strategy and roadmap prioritization for our AI-powered B2B SaaS platform.

Responsibilities
- Lead customer discovery and user research with enterprise customers.
- Partner with cross-functional engineering, design, sales, and customer success teams.
- Define product requirements, success metrics, and an Agile product roadmap.
- Use data analysis and A/B testing to improve adoption and conversion.
- Lead go-to-market planning and stakeholder management.

Required qualifications
- Demonstrated experience launching B2B SaaS products.
- Strong product strategy, customer discovery, data analysis, and communication skills.
- Evidence of measurable product outcomes and enterprise stakeholder management.`;

/** Reject empty/image-only uploads before replacing the user's working resume. */
export function hasUsableResumeText(value: string): boolean {
  return value.trim().length >= 40;
}

const EMPTY_RESUME = (): ResumeDocument => ({
  name: "",
  headline: "",
  email: "",
  phone: "",
  location: "",
  links: [],
  summary: "",
  skills: [],
  experience: [],
  education: [],
  additionalSections: [],
});

const SECTION_ALIASES: Record<string, string> = {
  summary: "summary",
  "professional summary": "summary",
  profile: "summary",
  "professional profile": "summary",
  objective: "summary",
  "career objective": "summary",
  skills: "skills",
  "technical skills": "skills",
  "core skills": "skills",
  "core competencies": "skills",
  competencies: "skills",
  technologies: "skills",
  expertise: "skills",
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  employment: "experience",
  "employment history": "experience",
  "career history": "experience",
  "work history": "experience",
  "professional background": "experience",
  education: "education",
  "academic background": "education",
  academics: "education",
  qualifications: "education",
  "education and training": "education",
  contact: "contact",
  "contact details": "contact",
  "personal details": "contact",
  project: "projects",
  projects: "projects",
  certification: "certifications",
  certifications: "certifications",
  "licenses and certifications": "certifications",
  credential: "certifications",
  credentials: "certifications",
  award: "awards",
  awards: "awards",
  achievement: "awards",
  achievements: "awards",
  publication: "publications",
  publications: "publications",
  research: "publications",
};

const ADDITIONAL_SECTION_TITLES = {
  projects: "Projects",
  certifications: "Certifications",
  awards: "Awards",
  publications: "Publications",
} as const;

const STOP_WORDS = new Set([
  "a",
  "ability",
  "able",
  "about",
  "above",
  "across",
  "after",
  "all",
  "also",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "being",
  "below",
  "both",
  "but",
  "by",
  "can",
  "candidate",
  "collaborate",
  "collaboration",
  "company",
  "create",
  "creating",
  "day",
  "demonstrated",
  "do",
  "ensure",
  "excellent",
  "each",
  "etc",
  "evidence",
  "experience",
  "for",
  "familiar",
  "familiarity",
  "from",
  "has",
  "have",
  "having",
  "he",
  "her",
  "here",
  "help",
  "hers",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "job",
  "knowledge",
  "lead",
  "leading",
  "led",
  "looking",
  "may",
  "more",
  "most",
  "must",
  "new",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "out",
  "over",
  "preferred",
  "product",
  "products",
  "proficient",
  "proficiency",
  "qualification",
  "qualifications",
  "required",
  "requirement",
  "requirements",
  "responsibilities",
  "responsibility",
  "role",
  "should",
  "skills",
  "so",
  "some",
  "strong",
  "support",
  "supporting",
  "such",
  "team",
  "teams",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "up",
  "us",
  "using",
  "we",
  "well",
  "what",
  "when",
  "where",
  "which",
  "who",
  "will",
  "with",
  "within",
  "work",
  "working",
  "would",
  "year",
  "years",
  "you",
  "your",
]);

const ROLE_WORDS = /\b(manager|management|engineer|developer|designer|analyst|architect|consultant|director|specialist|lead|leader|officer|president|founder|intern|administrator|scientist|researcher|coordinator|executive|associate|product|marketing|sales|operations|finance|accountant|recruiter|writer|editor)\b/i;
const SCHOOL_WORDS = /\b(university|college|institute|school|academy|polytechnic)\b/i;
const DEGREE_WORDS = /\b(bachelor|master|mba|bba|b\.?(?:e|tech|sc|a)\.?|m\.?(?:e|tech|sc|a)\.?|ph\.?d|doctor|diploma|degree|engineering|science|arts|commerce)\b/i;
const COMPANY_WORDS = /\b(inc\.?|llc|ltd\.?|limited|corp\.?|corporation|company|technologies|systems|solutions|consulting|group|labs?)\b/i;
const LOCATION_WORDS = /\b(remote|hybrid|onsite|india|usa|united states|uk|united kingdom|canada|australia|singapore|germany|france|spain|italy|uae)\b/i;
const PERIOD_PATTERN = /\b(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+)?(?:19|20)\d{2}\b(?:\s*(?:-|–|—|to)\s*(?:(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+)?(?:19|20)\d{2}|present|current|now))?/i;
const BULLET_PATTERN = /^\s*(?:[-*•●▪◦‣⁃]|\d+[.)])\s+/;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function compactWhitespace(value: string): string {
  return value.replace(/[\t ]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
}

function normalizeInput(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

function stripLatexComments(line: string): string {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "%") continue;
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) {
      slashes += 1;
    }
    if (slashes % 2 === 0) return line.slice(0, index);
  }
  return line;
}

/** Converts common resume-oriented LaTeX into text before heuristic parsing. */
function latexToText(source: string): string {
  const documentStart = source.match(/\\begin\s*\{document\}/i);
  if (documentStart?.index !== undefined) {
    source = source.slice(documentStart.index + documentStart[0].length);
  }
  source = source.replace(/\\end\s*\{document\}[\s\S]*$/i, "");

  let text = source
    .split("\n")
    .map(stripLatexComments)
    .join("\n")
    .replace(/\\(?:section|section\*|subsection|subsection\*|resumeSubheading)\s*\{([^{}]*)\}/gi, "\n$1\n")
    .replace(/\\(?:textbf|textit|emph|underline|small|large|Large|href\s*\{[^{}]*\})\s*\{([^{}]*)\}/gi, "$1")
    .replace(/\\item(?:\[[^\]]*\])?\s*/gi, "\n- ")
    .replace(/\\(?:begin|end)\s*\{[^{}]*\}/gi, "\n")
    .replace(/\\(?:vspace|hspace)\s*\{[^{}]*\}/gi, " ")
    .replace(/\\textbar\s*\{\}/gi, " | ")
    .replace(/\\hfill\b/gi, " | ")
    .replace(/\\(?:medskip|smallskip|bigskip|noindent|centering)\b/gi, " ")
    .replace(/\\&/g, "&")
    .replace(/\\%/g, "%")
    .replace(/\\_/g, "_")
    .replace(/\\#/g, "#")
    .replace(/\\\$/g, "$")
    .replace(/\\textbackslash\s*\{\}/g, "\\")
    .replace(/\\textasciitilde\s*\{\}/g, "~")
    .replace(/\\textasciicircum\s*\{\}/g, "^")
    .replace(/\\[a-zA-Z@]+\*?(?:\[[^\]]*\])?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/~+/g, " ");

  // LaTeX commonly uses a double backslash as a visual line break.
  text = text.replace(/\\\\(?:\[[^\]]*\])?/g, "\n");
  return text;
}

function linesFromText(text: string): string[] {
  let normalized = normalizeInput(text).slice(0, 250_000);
  if (/\\documentclass|\\begin\s*\{document\}|\\section\*?\s*\{/i.test(normalized)) {
    normalized = latexToText(normalized);
  }

  return normalized
    .split("\n")
    .map((line) => line.replace(/\s+$/g, "").trim())
    .filter(Boolean);
}

function headingFor(line: string): { section: string; remainder: string } | null {
  const cleaned = line.replace(/^#+\s*/, "").trim();
  const colonIndex = cleaned.indexOf(":");
  const candidate = (colonIndex >= 0 ? cleaned.slice(0, colonIndex) : cleaned)
    .replace(/&/g, " and ")
    .replace(/[\s_-]+/g, " ")
    .trim()
    .toLowerCase();
  const section = SECTION_ALIASES[candidate];
  if (!section) return null;

  // Without a colon, only short exact aliases count as headings. This avoids
  // treating sentences such as "Experience designing APIs" as a section.
  if (colonIndex < 0 && cleaned.split(/\s+/).length > 3) return null;
  return {
    section,
    remainder: colonIndex >= 0 ? cleaned.slice(colonIndex + 1).trim() : "",
  };
}

function stableId(prefix: string, primary: string, index: number): string {
  const slug = primary
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return `${prefix}-${slug || index + 1}${index ? `-${index + 1}` : ""}`;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = compactWhitespace(value).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractPeriod(value: string): string {
  return value.match(PERIOD_PATTERN)?.[0]?.trim() ?? "";
}

function withoutPeriod(value: string): string {
  return compactWhitespace(value.replace(PERIOD_PATTERN, "").replace(/^[|,;\s–—-]+|[|,;\s–—-]+$/g, ""));
}

function likelyLocation(value: string): boolean {
  if (LOCATION_WORDS.test(value)) return true;
  return value.includes(",") && !ROLE_WORDS.test(value) && !COMPANY_WORDS.test(value);
}

function parseExperienceHeader(headers: string[], index: number): ExperienceEntry {
  const periodSource = headers.find((line) => PERIOD_PATTERN.test(line)) ?? "";
  const period = extractPeriod(periodSource);
  const flattened = headers.flatMap((line) =>
    withoutPeriod(line)
      .split(/\s+\|\s+|\s+[–—]\s+/)
      .map(compactWhitespace)
      .filter(Boolean),
  );

  let role = "";
  let company = "";
  let location = "";

  for (const part of flattened) {
    if (!location && likelyLocation(part)) {
      location = part;
      continue;
    }
    if (!role && ROLE_WORDS.test(part)) {
      role = part;
      continue;
    }
    if (!company && COMPANY_WORDS.test(part)) {
      company = part;
      continue;
    }
    if (!company) company = part;
    else if (!role) role = part;
    else if (!location) location = part;
  }

  // The most common unlabelled two-line layout is Company, then Role.
  if (!role && flattened.length > 1) role = flattened[1];
  if (!company && flattened.length) company = flattened[0];

  return {
    id: stableId("exp", company || role, index),
    company,
    role,
    location,
    period,
    bullets: [],
  };
}

function parseExperience(lines: string[]): ExperienceEntry[] {
  const groups: Array<{ headers: string[]; bullets: string[] }> = [];
  let current = { headers: [] as string[], bullets: [] as string[] };

  const pushCurrent = () => {
    if (current.headers.length || current.bullets.length) groups.push(current);
    current = { headers: [], bullets: [] };
  };

  for (const rawLine of lines) {
    const line = compactWhitespace(rawLine);
    if (!line) continue;
    if (BULLET_PATTERN.test(line)) {
      current.bullets.push(line.replace(BULLET_PATTERN, "").trim());
      continue;
    }

    if (current.bullets.length) pushCurrent();
    else if (current.headers.some((header) => PERIOD_PATTERN.test(header))) pushCurrent();
    current.headers.push(line);
  }
  pushCurrent();

  return groups
    .map((group, index) => ({
      ...parseExperienceHeader(group.headers, index),
      bullets: uniqueStrings(group.bullets),
    }))
    .filter((entry) => entry.company || entry.role || entry.bullets.length);
}

function parseEducation(lines: string[]): EducationEntry[] {
  const groups: string[][] = [];
  let current: string[] = [];

  for (const rawLine of lines) {
    const line = compactWhitespace(rawLine.replace(BULLET_PATTERN, ""));
    if (!line) continue;
    if (current.some((part) => PERIOD_PATTERN.test(part))) {
      groups.push(current);
      current = [];
    }
    current.push(line);
    if (PERIOD_PATTERN.test(line)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);

  return groups
    .map((group, index) => {
      const parts = group.flatMap((line) =>
        withoutPeriod(line)
          .split(/\s+\|\s+|\s+[–—]\s+/)
          .map(compactWhitespace)
          .filter(Boolean),
      );
      const school = parts.find((part) => SCHOOL_WORDS.test(part)) ?? parts[0] ?? "";
      const degree = parts.find((part) => DEGREE_WORDS.test(part) && part !== school) ??
        parts.find((part) => part !== school) ??
        "";
      const period = group.map(extractPeriod).find(Boolean) ?? "";
      return {
        id: stableId("edu", school || degree, index),
        school,
        degree,
        period,
      };
    })
    .filter((entry) => entry.school || entry.degree);
}

function splitSkills(lines: string[]): string[] {
  return uniqueStrings(
    lines.flatMap((line) =>
      line
        .replace(BULLET_PATTERN, "")
        .split(/[,;|•·]/)
        .map((skill) => compactWhitespace(skill.replace(/^[-–—]\s*/, "")))
        .filter((skill) => skill.length > 1 && skill.length <= 80),
    ),
  );
}

function parseAdditionalSections(sections: Record<string, string[]>): AdditionalSection[] {
  return Object.entries(ADDITIONAL_SECTION_TITLES).flatMap(([section, title], index) => {
    const items = uniqueStrings(
      (sections[section] ?? [])
        .map((line) => compactWhitespace(line.replace(BULLET_PATTERN, "")))
        .filter(Boolean),
    );
    if (!items.length) return [];
    return [{ id: stableId("section", section, index), title, items }];
  });
}

function extractContact(lines: string[]): Pick<
  ResumeDocument,
  "name" | "headline" | "email" | "phone" | "location" | "links"
> {
  const joined = lines.slice(0, 12).join(" | ");
  const email = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phoneCandidates = joined.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) ?? [];
  const phone = phoneCandidates.find((candidate) => candidate.replace(/\D/g, "").length >= 8)?.trim() ?? "";
  const explicitLinks = joined.match(/(?:https?:\/\/|www\.)[^\s|,;]+/gi) ?? [];
  const bareLinks = joined.match(/(?:linkedin\.com|github\.com)\/[^\s|,;]+/gi) ?? [];
  const links = uniqueStrings([
    ...explicitLinks,
    ...bareLinks.filter(
      (bareLink) =>
        !explicitLinks.some((explicitLink) =>
          explicitLink.toLowerCase().replace(/^https?:\/\/(?:www\.)?/, "").includes(bareLink.toLowerCase()),
        ),
    ),
  ]).map((link) => link.replace(/[.)]+$/g, ""));

  const isContactLine = (line: string) => {
    if (email && line.includes(email)) return true;
    if (phone && line.includes(phone)) return true;
    if (/(?:https?:\/\/|www\.|linkedin\.com|github\.com)/i.test(line)) return true;
    return false;
  };

  const cleanCandidates = lines
    .slice(0, 8)
    .filter((line) => !headingFor(line) && !isContactLine(line) && !BULLET_PATTERN.test(line));
  const identityCandidates = cleanCandidates.flatMap((line) =>
    line
      .split(/\s+(?:\+|[|•·])\s+/)
      .map(compactWhitespace)
      .filter(Boolean),
  );
  const name =
    identityCandidates.find(
      (line) =>
        line.length <= 60 &&
        !/\d/.test(line) &&
        !ROLE_WORDS.test(line) &&
        !likelyLocation(line) &&
        line.split(/\s+/).length <= 6,
    ) ?? identityCandidates[0] ?? "";
  const headline =
    identityCandidates.find((line) => line !== name && ROLE_WORDS.test(line) && line.length <= 100) ??
    identityCandidates.find((line) => line !== name && !likelyLocation(line) && line.length <= 100) ??
    "";
  const contactLocation = lines
    .slice(0, 8)
    .flatMap((line) => line.split(/\s*(?:\+|[|•])\s*/))
    .map((part) =>
      compactWhitespace(
        part
          .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
          .replace(/(?:https?:\/\/|www\.)\S+/gi, "")
          .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, ""),
      ),
    )
    .find((part) => part !== name && part !== headline && likelyLocation(part));
  const location =
    identityCandidates.find((line) => line !== name && line !== headline && likelyLocation(line)) ??
    contactLocation ??
    "";

  return { name, headline, email, phone, location, links };
}

/**
 * Parses plain text extracted from PDF/DOCX, or common resume LaTeX, into the
 * canonical editable document. The parser is deliberately conservative: it
 * leaves uncertain fields empty instead of inventing resume content.
 */
export function parseResumeText(text: string): ResumeDocument {
  if (!text.trim()) return EMPTY_RESUME();

  const lines = linesFromText(text);
  const sections: Record<string, string[]> = {
    contact: [],
    summary: [],
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    awards: [],
    publications: [],
  };
  let activeSection = "contact";
  let foundHeading = false;

  for (const line of lines) {
    const heading = headingFor(line);
    if (heading) {
      activeSection = heading.section;
      foundHeading = true;
      if (heading.remainder) sections[activeSection].push(heading.remainder);
      continue;
    }
    sections[activeSection].push(line);
  }

  if (!foundHeading) {
    // Preserve the likely identity/contact block, then use date-and-bullet
    // patterns as a modest fallback for heading-free extracted text.
    const firstBullet = lines.findIndex((line) => BULLET_PATTERN.test(line));
    const firstPeriod = lines.findIndex((line) => PERIOD_PATTERN.test(line));
    const experienceStart = [firstBullet, firstPeriod]
      .filter((index) => index >= 0)
      .reduce((minimum, index) => Math.min(minimum, Math.max(3, index - 3)), Number.POSITIVE_INFINITY);
    sections.contact = lines.slice(0, Number.isFinite(experienceStart) ? experienceStart : Math.min(5, lines.length));
    if (Number.isFinite(experienceStart)) {
      sections.experience = lines.slice(experienceStart);
    } else {
      sections.summary = lines.slice(Math.min(3, lines.length));
    }
  }

  const contact = extractContact(foundHeading ? sections.contact : lines.slice(0, 10));
  const contactValues = new Set(
    [contact.name, contact.headline, contact.email, contact.phone, contact.location, ...contact.links]
      .filter(Boolean)
      .map((value) => value.toLowerCase()),
  );
  const summary = compactWhitespace(
    sections.summary
      .filter((line) => !contactValues.has(line.toLowerCase()))
      .map((line) => line.replace(BULLET_PATTERN, ""))
      .join(" "),
  );

  return {
    ...contact,
    summary,
    skills: splitSkills(sections.skills),
    experience: parseExperience(sections.experience),
    education: parseEducation(sections.education),
    additionalSections: parseAdditionalSections(sections),
  };
}

/** Produces a predictable, sectioned plain-text representation for exports and AI prompts. */
export function resumeToText(resume: ResumeDocument): string {
  const lines: string[] = [];
  const add = (value: string) => {
    if (value.trim()) lines.push(value.trim());
  };

  add(resume.name);
  add(resume.headline);
  add([resume.location, resume.email, resume.phone].filter(Boolean).join(" | "));
  add(resume.links.filter(Boolean).join(" | "));

  if (resume.summary.trim()) {
    lines.push("", "SUMMARY", resume.summary.trim());
  }
  if (resume.skills.length) {
    lines.push("", "SKILLS", resume.skills.filter(Boolean).join(" | "));
  }
  if (resume.experience.length) {
    lines.push("", "EXPERIENCE");
    for (const entry of resume.experience) {
      add([entry.role, entry.company, entry.location, entry.period].filter(Boolean).join(" | "));
      for (const bullet of entry.bullets) add(`- ${bullet}`);
    }
  }
  if (resume.education.length) {
    lines.push("", "EDUCATION");
    for (const entry of resume.education) {
      add([entry.degree, entry.school, entry.period].filter(Boolean).join(" | "));
    }
  }
  for (const section of resume.additionalSections ?? []) {
    if (!section.items.some((item) => item.trim())) continue;
    lines.push("", section.title.toUpperCase());
    for (const item of section.items) add(`- ${item}`);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

type WeightedKeyword = { term: string; weight: number };

const PHRASE_KEYWORDS = [
  "account management",
  "artificial intelligence",
  "business analysis",
  "business development",
  "change management",
  "cloud computing",
  "cross functional",
  "customer discovery",
  "customer experience",
  "customer success",
  "data analysis",
  "data science",
  "digital marketing",
  "financial analysis",
  "go to market",
  "machine learning",
  "market research",
  "people management",
  "product management",
  "product requirements",
  "product strategy",
  "program management",
  "project management",
  "quality assurance",
  "risk management",
  "roadmap prioritization",
  "software development",
  "stakeholder management",
  "supply chain",
  "user experience",
  "user research",
] as const;

const KEYWORD_ALIASES: Record<string, readonly string[]> = {
  "a b testing": [
    "a b testing",
    "a b test",
    "a b tests",
    "ab testing",
    "split testing",
    "split test",
    "split tests",
  ],
  "amazon web services": ["amazon web services", "aws"],
  "artificial intelligence": ["artificial intelligence", "ai"],
  "b2b saas": ["b2b saas"],
  "ci cd": [
    "ci cd",
    "continuous integration and delivery",
    "continuous integration and continuous delivery",
    "continuous integration continuous delivery",
    "continuous integration delivery",
  ],
  "cross functional": ["cross functional"],
  "go to market": ["go to market", "gtm"],
  nodejs: ["nodejs", "node.js", "node js"],
  "product management": ["product management", "product manager", "product managers"],
};

const CANONICAL_KEYWORD_CONCEPTS = [
  "a b testing",
  "amazon web services",
  "artificial intelligence",
  "b2b saas",
  "ci cd",
  "nodejs",
  "product management",
] as const;

const KNOWN_SINGLE_KEYWORDS = new Set([
  "agile",
  "angular",
  "azure",
  "communication",
  "css",
  "docker",
  "excel",
  "figma",
  "gcp",
  "git",
  "golang",
  "html",
  "java",
  "javascript",
  "jira",
  "kubernetes",
  "linux",
  "mongodb",
  "mysql",
  "postgresql",
  "python",
  "react",
  "redis",
  "rust",
  "salesforce",
  "scrum",
  "sql",
  "tableau",
  "terraform",
  "typescript",
]);

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[-–—_/]+/g, " ")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\.(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalizeSearchText(value)
    .split(" ")
    .map((token) => token.replace(/^[.]+|[.]+$/g, ""))
    .filter(Boolean);
}

function displayKeyword(term: string): string {
  const names: Record<string, string> = {
    "a b testing": "A/B testing",
    "amazon web services": "AWS",
    "artificial intelligence": "artificial intelligence",
    "b2b saas": "B2B SaaS",
    "c#": "C#",
    "c++": "C++",
    "ci cd": "CI/CD",
    css: "CSS",
    gcp: "GCP",
    html: "HTML",
    javascript: "JavaScript",
    nodejs: "Node.js",
    python: "Python",
    react: "React",
    saas: "SaaS",
    sql: "SQL",
    typescript: "TypeScript",
  };
  return names[term] ?? term.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function includesNormalizedPhrase(normalizedHaystack: string, value: string): boolean {
  const normalizedNeedle = normalizeSearchText(value);
  return Boolean(
    normalizedNeedle && ` ${normalizedHaystack} `.includes(` ${normalizedNeedle} `),
  );
}

function keywordAliases(term: string): readonly string[] {
  return KEYWORD_ALIASES[term] ?? [term];
}

function extractJdKeywords(jd: string): WeightedKeyword[] {
  const normalizedJd = normalizeSearchText(jd);
  if (!normalizedJd) return [];

  const weights = new Map<string, number>();
  const explicitlyRequiredTerms = new Set<string>();
  let sectionImportance = 1;
  for (const rawLine of normalizeInput(jd).split("\n")) {
    const line = normalizeSearchText(rawLine);
    if (!line) continue;
    if (/^\s*(?:required|minimum|essential)(?:\s+qualifications?|\s+requirements?|\s+skills?)?\s*:?[\s-]*$/i.test(rawLine)) {
      sectionImportance = 1.8;
      continue;
    }
    if (/^\s*(?:preferred|bonus|nice to have)(?:\s+qualifications?|\s+skills?)?\s*:?[\s-]*$/i.test(rawLine)) {
      sectionImportance = 0.85;
      continue;
    }
    if (/^\s*(?:responsibilities|what you will do|about the role)\s*:?[\s-]*$/i.test(rawLine)) {
      sectionImportance = 1.15;
      continue;
    }
    const importance = /\b(must|required|essential|minimum|need)\b/i.test(rawLine)
      ? 1.8
      : /\b(preferred|bonus|nice to have)\b/i.test(rawLine)
        ? 0.85
        : sectionImportance;
    const lineTokens = uniqueStrings(tokens(line));
    for (const token of lineTokens) {
      const clean = token.replace(/[^a-z0-9+#.]/g, "");
      if (
        STOP_WORDS.has(clean) ||
        clean.length < 3 ||
        /^\d+$/.test(clean) ||
        /^(?:19|20)\d{2}$/.test(clean)
      ) {
        continue;
      }
      weights.set(clean, (weights.get(clean) ?? 0) + importance);
      if (importance >= 1.8) explicitlyRequiredTerms.add(clean);
    }
  }

  const detectedTerms = new Set<string>();
  const registerConcept = (term: string, weight: number) => {
    detectedTerms.add(term);
    weights.set(term, Math.max(weights.get(term) ?? 0, weight));
  };

  for (const phrase of PHRASE_KEYWORDS) {
    if (includesNormalizedPhrase(normalizedJd, phrase)) registerConcept(phrase, 1.7);
  }
  for (const term of CANONICAL_KEYWORD_CONCEPTS) {
    if (keywordAliases(term).some((alias) => includesNormalizedPhrase(normalizedJd, alias))) {
      registerConcept(term, 2);
    }
  }

  const explicitTerms: Array<[RegExp, string]> = [
    [/(?:^|\s)c\+\+(?=\s|$|[,.])/i, "c++"],
    [/(?:^|\s)c#(?=\s|$|[,.])/i, "c#"],
    [/(?:^|\s)\.net(?=\s|$|[,.])/i, ".net"],
  ];
  for (const [pattern, term] of explicitTerms) {
    if (pattern.test(jd)) registerConcept(term, 2);
  }

  // Once a phrase/synonym is canonicalized, remove its component tokens. This
  // prevents one requirement from being counted again as generic gaps such as
  // “Amazon”, “Web”, “Services”, “Testing”, or “Integration”.
  for (const term of detectedTerms) {
    for (const alias of keywordAliases(term)) {
      for (const component of tokens(alias)) {
        if (!detectedTerms.has(component)) weights.delete(component);
      }
    }
    for (const component of tokens(term)) {
      if (!detectedTerms.has(component)) weights.delete(component);
    }
  }

  // Prefer recurring/required concepts, canonical phrases, and known technical
  // terms. Unlike the previous minimum-count filler, this does not manufacture
  // a long tail of generic single-use words merely to reach a keyword quota.
  const ranked = [...weights.entries()]
    .sort((left, right) => right[1] - left[1] || right[0].length - left[0].length)
    .map(([term, weight]) => ({ term, weight }));
  return ranked
    .filter(
      ({ term, weight }) =>
        detectedTerms.has(term) ||
        explicitlyRequiredTerms.has(term) ||
        weight >= 2 ||
        KNOWN_SINGLE_KEYWORDS.has(term),
    )
    .slice(0, 28);
}

function containsKeyword(haystack: string, term: string): boolean {
  const padded = ` ${normalizeSearchText(haystack)} `;
  return keywordAliases(term).some((alias) => padded.includes(` ${normalizeSearchText(alias)} `));
}

function quantified(bullet: string): boolean {
  return /(?:[$€£₹]\s*\d|\b\d+(?:\.\d+)?\s*(?:%|[xkmb])(?=\s|[.,;:)]|$)|\b\d+\s*(?:hours?|days?|weeks?|months?|years?|users?|customers?|clients?|projects?|teams?|markets?|countries?)\b|\b\d+[+]\b|\bfrom\s+\d+\s+to\s+\d+|\b(?!(?:19|20)\d{2}\b)\d+(?:\.\d+)?\b)/i.test(
    bullet,
  );
}

const ACTION_VERBS = /^(?:accelerated|achieved|analyzed|architected|automated|built|created|cut|defined|delivered|designed|developed|drove|enabled|established|expanded|generated|grew|implemented|improved|increased|launched|led|managed|negotiated|optimized|orchestrated|owned|partnered|ran|reduced|redesigned|saved|scaled|shipped|streamlined|transformed|won)\b/i;
const OUTCOME_WORDS = /\b(?:achiev|result|increas|reduc|improv|grew|growth|revenue|profit|saving|saved|conversion|adoption|retention|efficien|faster|pipeline|quality|accuracy|cost|time|customer satisfaction|nps)\w*/i;

function evidenceItems(resume: ResumeDocument): string[] {
  const projectItems = (resume.additionalSections ?? [])
    .filter((section) => section.title === "Projects")
    .flatMap((section) => section.items);
  return [...resume.experience.flatMap((entry) => entry.bullets), ...projectItems].filter(Boolean);
}

function evidenceScore(resume: ResumeDocument): number {
  const bullets = evidenceItems(resume);
  if (!bullets.length) return 0;
  const count = bullets.length;
  const quantifiedRatio = bullets.filter(quantified).length / count;
  const actionRatio = bullets.filter((bullet) => ACTION_VERBS.test(bullet.trim())).length / count;
  const outcomeRatio = bullets.filter((bullet) => OUTCOME_WORDS.test(bullet)).length / count;
  const usefulLengthRatio =
    bullets.filter((bullet) => {
      const words = tokens(bullet).length;
      return words >= 8 && words <= 32;
    }).length / count;
  return roundScore(
    clamp(quantifiedRatio * 10 + actionRatio * 6 + outcomeRatio * 5 + usefulLengthRatio * 4, 0, 25),
  );
}

function parseabilityScore(resume: ResumeDocument): number {
  let score = 20;
  if (!resume.name.trim()) score -= 4;
  if (!resume.headline.trim()) score -= 1;
  if (!resume.summary.trim()) score -= 2;
  if (!resume.skills.length) score -= 3;
  if (!resume.experience.length) score -= 6;
  if (resume.experience.some((entry) => !entry.role.trim() || !entry.company.trim())) score -= 2;
  if (resume.experience.some((entry) => !entry.period.trim())) score -= 1;
  if (resume.experience.some((entry) => entry.bullets.length === 0)) score -= 2;
  if (resume.experience.flatMap((entry) => entry.bullets).some((bullet) => tokens(bullet).length > 45)) {
    score -= 1;
  }
  return roundScore(clamp(score, 0, 20));
}

function completenessScore(resume: ResumeDocument): number {
  let score = 0;
  if (resume.name.trim()) score += 1.25;
  if (resume.headline.trim()) score += 0.75;
  if (resume.email.trim()) score += 1.25;
  if (resume.phone.trim()) score += 0.75;
  if (resume.location.trim()) score += 0.75;
  if (resume.summary.trim()) score += 1.25;
  if (resume.skills.length >= 5) score += 1.25;
  else if (resume.skills.length) score += 0.6;
  if (resume.experience.length) score += 1.75;
  if (resume.education.length) score += 1;
  return roundScore(clamp(score, 0, 10));
}

function languageScore(resume: ResumeDocument): number {
  const fields = [resume.headline, resume.summary, ...resume.experience.flatMap((entry) => entry.bullets)].filter(
    Boolean,
  );
  if (!fields.length) return 0;
  const combined = fields.join("\n");
  let score = 10;
  if (/\b(I|me|my|mine|we|our)\b/.test(combined)) score -= 1;
  if (/\b(very|really|various|things|stuff)\b/i.test(combined)) score -= 0.75;
  if (/\b(grammer|recieved|responsibilty|manger|succesful|experiance)\b/i.test(combined)) score -= 2;
  if (/\b([a-z]+)\s+\1\b/i.test(combined)) score -= 1;
  if (/[ \t]{2,}/.test(combined)) score -= 0.5;
  if (fields.some((field) => tokens(field).length > 45)) score -= 1.5;
  const bullets = resume.experience.flatMap((entry) => entry.bullets).filter(Boolean);
  if (bullets.length > 2) {
    const withPeriods = bullets.filter((bullet) => /[.!?]$/.test(bullet.trim())).length;
    if (withPeriods > 0 && withPeriods < bullets.length) score -= 0.5;
  }
  return roundScore(clamp(score, 0, 10));
}

/**
 * Estimates ATS readiness and JD alignment. This is not a score from a
 * particular ATS vendor and intentionally does not promise an interview.
 */
export function analyzeAts(resume: ResumeDocument, jd: string): AtsBreakdown {
  const resumeText = resumeToText(resume);
  const keywords = extractJdKeywords(jd);
  const matched = keywords.filter(({ term }) => containsKeyword(resumeText, term));
  const missing = keywords.filter(({ term }) => !containsKeyword(resumeText, term));
  const totalWeight = keywords.reduce((sum, keyword) => sum + keyword.weight, 0);
  const matchedWeight = matched.reduce((sum, keyword) => sum + keyword.weight, 0);
  const alignment = totalWeight ? roundScore((matchedWeight / totalWeight) * 35) : 0;
  const evidence = evidenceScore(resume);
  const parseability = parseabilityScore(resume);
  const completeness = completenessScore(resume);
  const language = languageScore(resume);
  const warnings: string[] = [];

  if (!jd.trim()) warnings.push("Add a job description to calculate job-specific alignment.");
  else if (tokens(jd).length < 25) {
    warnings.push("The job description is short, so keyword alignment has lower confidence.");
  }
  if (!resume.name.trim() || !resume.email.trim()) {
    warnings.push("Name and email are essential contact fields and should not be omitted.");
  }
  if (!resume.experience.length) warnings.push("No work experience section was detected.");
  const bullets = evidenceItems(resume);
  if (bullets.length && !bullets.some(quantified)) {
    warnings.push("Add verified metrics to relevant experience bullets; do not invent results.");
  }
  if (missing.length) {
    warnings.push("Only add missing keywords that truthfully describe your experience.");
  }

  return {
    overall: roundScore(clamp(alignment + evidence + parseability + completeness + language, 0, 100)),
    alignment,
    evidence,
    parseability,
    completeness,
    language,
    matchedKeywords: matched.map(({ term }) => displayKeyword(term)),
    missingKeywords: missing.map(({ term }) => displayKeyword(term)),
    warnings,
  };
}

function texText(value: string): string {
  const escaped: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    "$": "\\$",
    "&": "\\&",
    "#": "\\#",
    "%": "\\%",
    _: "\\_",
    "^": "\\textasciicircum{}",
    "~": "\\textasciitilde{}",
  };
  return compactWhitespace(normalizeInput(value)).replace(
    /[\\{}$&%#_^~]/g,
    (character) => escaped[character],
  );
}

function safeUrl(value: string): string {
  let url = compactWhitespace(value);
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url.replace(/^[a-z][a-z0-9+.-]*:(?:\/\/)?/i, "")}`;
  }
  // `\url` handles URI punctuation, but braces/backslashes could escape its
  // argument. Percent-encode those characters and drop controls/whitespace.
  return url
    .replace(/\\/g, "%5C")
    .replace(/\{/g, "%7B")
    .replace(/\}/g, "%7D")
    .replace(/[\u0000-\u0020\u007f]/g, "");
}

const LATEX_SCRIPT_FONTS: ReadonlyArray<{
  label: string;
  pattern: RegExp;
  font: string;
}> = [
  { label: "Devanagari", pattern: /[\u0900-\u097f]/gu, font: "Noto Sans Devanagari" },
  { label: "Arabic", pattern: /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/gu, font: "Noto Sans Arabic" },
  { label: "Hebrew", pattern: /[\u0590-\u05ff]/gu, font: "Noto Sans Hebrew" },
  { label: "CJK", pattern: /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/gu, font: "Noto Sans CJK SC" },
  { label: "Hangul", pattern: /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/gu, font: "Noto Sans CJK KR" },
];

function latexFontConfiguration(value: string): string[] {
  const scripts = LATEX_SCRIPT_FONTS.map((script) => ({
    ...script,
    count: value.match(script.pattern)?.length ?? 0,
  }))
    .filter((script) => script.count > 0)
    .sort((left, right) => right.count - left.count);
  const preferredFonts = [...new Set([scripts[0]?.font, "Noto Sans"].filter(Boolean))] as string[];

  let selection = "\\setmainfont{TeX Gyre Heros}";
  for (const font of preferredFonts.reverse()) {
    selection = `\\IfFontExistsTF{${font}}{\\setmainfont{${font}}}{${selection}}`;
  }

  if (!scripts.length) return [selection];

  const labels = scripts.map(({ label }) => label).join(", ");
  const fonts = scripts.map(({ font }) => font).join(" / ");
  return [
    `% Detected Unicode scripts: ${labels}.`,
    `% FONT ACTION: Install ${fonts}, or configure fontspec fallbacks covering every detected script before final export.`,
    selection,
  ];
}

/** Builds static, one-column, ATS-safe Unicode LaTeX from structured fields. */
export function buildLatex(resume: ResumeDocument): string {
  const contact = [resume.location, resume.email, resume.phone]
    .filter((value) => value.trim())
    .map(texText)
    .join(" \\textbar{} ");
  const links = resume.links
    .filter((link) => link.trim())
    .map((link) => `\\url{${safeUrl(link)}}`)
    .join(" \\textbar{} ");
  const body: string[] = [
    "% !TEX program = xelatex",
    "% Compile with XeLaTeX or LuaLaTeX. Literal Unicode and disabled common ligatures improve text extraction.",
    "\\documentclass[10pt,letterpaper]{article}",
    "\\usepackage{iftex}",
    "\\ifPDFTeX",
    "  \\PackageError{cv-curator}{Compile this resume with XeLaTeX or LuaLaTeX}{Select XeLaTeX or LuaLaTeX in your LaTeX editor and compile again.}",
    "\\fi",
    "\\usepackage[margin=0.65in]{geometry}",
    "\\usepackage{fontspec}",
    "\\defaultfontfeatures{Ligatures=NoCommon,Scale=MatchLowercase}",
    ...latexFontConfiguration(resumeToText(resume)),
    "\\usepackage[hidelinks]{hyperref}",
    "\\hypersetup{unicode=true}",
    "\\usepackage{enumitem}",
    "\\usepackage{titlesec}",
    "\\pagestyle{empty}",
    "\\setlength{\\parindent}{0pt}",
    "\\setlist[itemize]{leftmargin=*,nosep}",
    "\\titleformat{\\section}{\\large\\bfseries}{}{0pt}{}[\\titlerule]",
    "\\titlespacing*{\\section}{0pt}{8pt}{4pt}",
    "\\begin{document}",
    "\\begin{center}",
    `{\\LARGE\\bfseries ${texText(resume.name || "Your Name")}}\\\\`,
  ];

  if (resume.headline.trim()) body.push(`${texText(resume.headline)}\\\\`);
  if (contact) body.push(`${contact}\\\\`);
  if (links) body.push(links);
  body.push("\\end{center}");

  if (resume.summary.trim()) {
    body.push("\\section*{Professional Summary}", texText(resume.summary));
  }
  if (resume.skills.length) {
    body.push("\\section*{Skills}", texText(resume.skills.filter(Boolean).join(" | ")));
  }
  if (resume.experience.length) {
    body.push("\\section*{Experience}");
    for (const entry of resume.experience) {
      body.push(
        `\\textbf{${texText(entry.role)}}${entry.company ? ` \\textbar{} ${texText(entry.company)}` : ""}` +
          `${entry.location ? ` \\hfill ${texText(entry.location)}` : ""}\\\\`,
      );
      if (entry.period.trim()) body.push(`\\textit{${texText(entry.period)}}`);
      if (entry.bullets.length) {
        body.push("\\begin{itemize}");
        for (const bullet of entry.bullets) body.push(`  \\item ${texText(bullet)}`);
        body.push("\\end{itemize}");
      }
    }
  }
  if (resume.education.length) {
    body.push("\\section*{Education}");
    for (const entry of resume.education) {
      body.push(
        `\\textbf{${texText(entry.degree)}}${entry.school ? ` \\textbar{} ${texText(entry.school)}` : ""}` +
          `${entry.period ? ` \\hfill ${texText(entry.period)}` : ""}\\\\`,
      );
    }
  }
  for (const section of resume.additionalSections ?? []) {
    const items = section.items.filter((item) => item.trim());
    if (!items.length) continue;
    body.push(`\\section*{${texText(section.title)}}`, "\\begin{itemize}");
    for (const item of items) body.push(`  \\item ${texText(item)}`);
    body.push("\\end{itemize}");
  }

  body.push("\\end{document}", "");
  return body.join("\n");
}

function replacementSuggestion(
  type: Suggestion["type"],
  target: string,
  before: string,
  after: string,
  rationale: string,
  index: number,
): Suggestion | null {
  if (!after || before === after) return null;
  return {
    id: `${type.toLowerCase()}-${target.replace(/[^a-z0-9]+/gi, "-")}-${index}`,
    type,
    before,
    after,
    rationale,
    target,
  };
}

function correctCommonLanguage(value: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\bgrammer\b/gi, "grammar"],
    [/\brecieved\b/gi, "received"],
    [/\bresponsibilty\b/gi, "responsibility"],
    [/\bmanger\b/gi, "manager"],
    [/\bsuccesful\b/gi, "successful"],
    [/\bexperiance\b/gi, "experience"],
  ];
  let result = value.replace(/[ \t]{2,}/g, " ").trim();
  for (const [pattern, replacement] of replacements) result = result.replace(pattern, replacement);
  result = result.replace(/\b([a-z]+)\s+\1\b/gi, "$1");
  return result;
}

function vocabularyRewrite(value: string): string {
  return value
    .replace(/^Responsible for managing\b/i, "Managed")
    .replace(/^Responsible for leading\b/i, "Led")
    .replace(/^Responsible for developing\b/i, "Developed")
    .replace(/^Responsible for\b/i, "Owned")
    .replace(/^Worked on developing\b/i, "Developed")
    .replace(/^Worked on creating\b/i, "Created")
    .replace(/^Worked on\b/i, "Contributed to")
    .replace(/^Successfully\s+/i, "")
    .replace(/\butilized\b/gi, "used");
}

/** Creates deterministic, local fixes. Keyword additions always require factual verification. */
export function createLocalSuggestions(resume: ResumeDocument, jd: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  let index = 1;
  const add = (suggestion: Suggestion | null) => {
    if (suggestion && suggestions.length < 10) suggestions.push(suggestion);
  };

  for (const [target, value] of [
    ["headline", resume.headline],
    ["summary", resume.summary],
  ] as const) {
    add(
      replacementSuggestion(
        "Grammar",
        target,
        value,
        correctCommonLanguage(value),
        "Correct spelling, repeated words, and unnecessary spacing.",
        index++,
      ),
    );
  }

  for (const entry of resume.experience) {
    entry.bullets.forEach((bullet, bulletIndex) => {
      const target = `experience.${entry.id}.bullet.${bulletIndex}`;
      const corrected = correctCommonLanguage(bullet);
      add(
        replacementSuggestion(
          "Grammar",
          target,
          bullet,
          corrected,
          "Correct spelling, repeated words, and unnecessary spacing.",
          index++,
        ),
      );
      // Emit at most one change per field so batch application cannot create
      // stale, overlapping edits. A fresh pass can offer the vocabulary fix
      // after a grammar correction has been accepted.
      if (corrected === bullet) {
        const rewritten = vocabularyRewrite(corrected);
        add(
          replacementSuggestion(
            quantified(bullet) ? "Impact" : "Vocabulary",
            target,
            bullet,
            rewritten,
            quantified(bullet)
              ? "Lead with a direct action verb so the verified result is easier to scan."
              : "Replace passive or vague wording with a concise action verb without changing the claim.",
            index++,
          ),
        );
      }
    });
  }

  const currentSkills = resume.skills.join(", ");
  const factualResume: ResumeDocument = { ...resume, skills: [] };
  const factualText = resumeToText(factualResume);
  const keywordGaps = extractJdKeywords(jd)
    .filter(({ term }) => {
      const isSkillLike =
        PHRASE_KEYWORDS.includes(term as (typeof PHRASE_KEYWORDS)[number]) ||
        CANONICAL_KEYWORD_CONCEPTS.includes(
          term as (typeof CANONICAL_KEYWORD_CONCEPTS)[number],
        ) ||
        KNOWN_SINGLE_KEYWORDS.has(term);
      return (
        isSkillLike &&
        !containsKeyword(currentSkills, term) &&
        containsKeyword(factualText, term)
      );
    })
    .map(({ term }) => displayKeyword(term))
    .slice(0, 2);
  if (keywordGaps.length) {
    const nextSkills = [...resume.skills, ...keywordGaps].filter(Boolean).join(", ");
    const keywordLabel = keywordGaps.map((keyword) => `“${keyword}”`).join(" and ");
    add(
      replacementSuggestion(
        "Keyword",
        "skills",
        currentSkills,
        nextSkills,
        `Surface ${keywordLabel} in Skills because the source resume already uses each term; review the classification before applying.`,
        index++,
      ),
    );
  }

  return suggestions;
}

function cloneResume(resume: ResumeDocument): ResumeDocument {
  return {
    ...resume,
    links: [...resume.links],
    skills: [...resume.skills],
    experience: resume.experience.map((entry) => ({ ...entry, bullets: [...entry.bullets] })),
    education: resume.education.map((entry) => ({ ...entry })),
    additionalSections: resume.additionalSections?.map((section) => ({
      ...section,
      items: [...section.items],
    })),
  };
}

/** Applies one suggestion immutably, returning the original object if it is stale or unknown. */
export function applySuggestion(resume: ResumeDocument, suggestion: Suggestion): ResumeDocument {
  const next = cloneResume(resume);
  if (suggestion.target === "skills") {
    if (resume.skills.join(", ") !== suggestion.before) return resume;
    next.skills = splitSkills([suggestion.after]);
    return next;
  }

  if (
    suggestion.target === "name" ||
    suggestion.target === "headline" ||
    suggestion.target === "email" ||
    suggestion.target === "phone" ||
    suggestion.target === "location" ||
    suggestion.target === "summary"
  ) {
    if (resume[suggestion.target] !== suggestion.before) return resume;
    next[suggestion.target] = suggestion.after;
    return next;
  }

  const bulletMatch = suggestion.target.match(/^experience\.([^.]+)\.bullet\.(\d+)$/);
  if (bulletMatch) {
    const [, entryId, rawIndex] = bulletMatch;
    const bulletIndex = Number(rawIndex);
    const entryIndex = resume.experience.findIndex((entry) => entry.id === entryId);
    if (entryIndex < 0 || resume.experience[entryIndex].bullets[bulletIndex] !== suggestion.before) {
      return resume;
    }
    next.experience[entryIndex].bullets[bulletIndex] = suggestion.after;
    return next;
  }

  const entryFieldMatch = suggestion.target.match(
    /^experience\.([^.]+)\.(company|role|location|period)$/,
  );
  if (entryFieldMatch) {
    const [, entryId, field] = entryFieldMatch as [string, string, "company" | "role" | "location" | "period"];
    const entryIndex = resume.experience.findIndex((entry) => entry.id === entryId);
    if (entryIndex < 0 || resume.experience[entryIndex][field] !== suggestion.before) return resume;
    next.experience[entryIndex][field] = suggestion.after;
    return next;
  }

  return resume;
}
