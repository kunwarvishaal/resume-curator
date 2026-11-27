# Resume Curator

A futuristic, oceanic glass-morphism web app that tailors your parent CV to any job description and exports an ATS-targeted resume in **LaTeX**, **DOCX**, and **PDF**.

Built for [Vercel](https://vercel.com) with Next.js 15, OpenAI, and client-side file parsing.

## Features

- **Upload parent CV** — PDF, DOCX, or `.tex` (up to 10 MB), parsed locally in the browser
- **Job description input** — paste text or import from a public HTTPS job URL
- **95+ ATS target** — transparent, explainable scoring rubric (alignment, evidence, structure, completeness, language)
- **AI fix suggestions** — grammar, vocabulary, impact, and keyword improvements via OpenAI (with local fallback)
- **Career snapshot** — U.S. median pay, typical education, 10-year job growth and remote-work share for the target job title, from [TryHired](https://tryhired.co/data/#api)'s free API (BLS + O\*NET data, no key)
- **LaTeX output** — ATS-safe, single-column source you can copy or download
- **Export** — `.tex`, `.docx`, and selectable-text `.pdf`
- **Oceanic UI** — glass morphism theme with animated SVG hero visual

## Quick start

```bash
cd ~/Projects/resume-curator
npm install
cp .env.example .env.local
# Add your OpenAI API key to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Recommended | Server-side OpenAI key for AI curation and fix suggestions |
| `OPENAI_MODEL` | Optional | Model ID (defaults to `gpt-4.1`) |
| `APP_PASSWORD` | Required in production | Gates the whole app behind a shared password |
| `SESSION_SECRET` | Optional | Extra signing key for session cookies; change it to sign everyone out |
| `ALLOW_OPEN_ACCESS` | Optional | Set to `true` only to run a production deployment with no login |

Without `OPENAI_API_KEY`, the app still works using deterministic on-device analysis.
Without `APP_PASSWORD`, `npm run dev` is open (fine locally), but a production build **fails closed**:
every page and API returns 503 until you set `APP_PASSWORD` (or `ALLOW_OPEN_ACCESS=true` on purpose).
Sessions last 7 days and are signed with an expiry, so a stolen cookie stops working on its own.

## Development checks

```bash
npm test            # unit tests (auth, SSRF guard, retries, redirects, request limits)
npm run typecheck
npm run lint
npm run audit:prod  # known vulnerabilities in production dependencies
```

GitHub Actions runs all of these plus `npm run build` on every push and pull request,
and Dependabot opens weekly update PRs. Install with `npm ci` so the versions in
`package-lock.json` are used exactly.

## Logs

API routes write one JSON line per event (`curate.ai_ok`, `curate.ai_failed`, `jd_import.failed`,
`career.lookup`, `career.unavailable`, `login.failed`, `*.rate_limited` ...). In Vercel, open the project's **Logs** tab and filter by
`curate.ai_failed` to see when the OpenAI review falls back to local analysis, and why.
Logs never include resume text, job descriptions, passwords or IP addresses.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. Add `APP_PASSWORD` and `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) under **Settings → Environment Variables**.
4. Deploy — Vercel auto-detects Next.js.

Or use the CLI:

```bash
npm i -g vercel
vercel
vercel env add APP_PASSWORD
vercel env add OPENAI_API_KEY
vercel --prod
```

## How ATS scoring works

| Dimension | Points |
| --- | ---: |
| Job-description alignment | 35 |
| Evidence and achievement quality | 25 |
| ATS parseability and structure | 20 |
| Completeness and consistency | 10 |
| Language quality | 10 |

**95+** is a target on Resume Curator's published rubric — not a guarantee from every third-party ATS vendor. The app never invents employers, titles, degrees, or metrics.

## Project structure

```
app/
  page.tsx              # Main workspace UI
  layout.tsx            # Root layout + metadata
  globals.css           # Oceanic glass-morphism theme
  login/page.tsx         # Password gate UI
  components/
    ocean-resume-visual.tsx  # Landing page SVG hero
  api/
    curate/route.ts     # OpenAI fix suggestions
    jd/extract/route.ts # Job URL importer
    career/route.ts     # Career snapshot (POST { title }) via TryHired
    login/route.ts       # Password check + session cookie
lib/
  resume-engine.ts      # Parsing, ATS scoring, LaTeX builder
  client/file-tools.ts  # Upload parsing + exports
  server/api-security.ts
  server/auth.ts          # Password gate helpers
  server/career-data.ts   # TryHired lookup: title cleaning, match check, 24 h cache
proxy.ts                 # Password gate: redirects unauthenticated requests to /login
public/
  hero-wave.svg         # Decorative landing SVG
  fonts/                # PDF export fonts
```

## Privacy

Uploaded CV bytes are parsed in the browser and are **not stored** by this version. OpenAI requests send only structured resume text and the job description to your configured API key on the server. The career snapshot sends only a cleaned job title (e.g. "software engineer") to TryHired, and only when you press its button.

## License

Private — all rights reserved.
