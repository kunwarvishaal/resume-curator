# Resume Curator

A futuristic, oceanic glass-morphism web app that tailors your parent CV to any job description and exports an ATS-targeted resume in **LaTeX**, **DOCX**, and **PDF**.

Built for [Vercel](https://vercel.com) with Next.js 15, OpenAI, and client-side file parsing.

## Features

- **Upload parent CV** — PDF, DOCX, or `.tex` (up to 10 MB), parsed locally in the browser
- **Job description input** — paste text or import from a public HTTPS job URL
- **95+ ATS target** — transparent, explainable scoring rubric (alignment, evidence, structure, completeness, language)
- **AI fix suggestions** — grammar, vocabulary, impact, and keyword improvements via OpenAI (with local fallback)
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
| `APP_PASSWORD` | Recommended once deployed | Gates the whole app behind a shared password so a public URL isn't open to anyone |

Without `OPENAI_API_KEY`, the app still works using deterministic on-device analysis.
Without `APP_PASSWORD`, the app has no login gate at all — fine for local dev, not recommended
once deployed to a public URL (there is per-IP rate limiting on the API routes, but no auth).

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. Add `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) under **Settings → Environment Variables**.
4. Deploy — Vercel auto-detects Next.js.

Or use the CLI:

```bash
npm i -g vercel
vercel
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
    login/route.ts       # Password check + session cookie
lib/
  resume-engine.ts      # Parsing, ATS scoring, LaTeX builder
  client/file-tools.ts  # Upload parsing + exports
  server/api-security.ts
  server/auth.ts          # Password gate helpers
middleware.ts            # Redirects unauthenticated requests to /login
public/
  hero-wave.svg         # Decorative landing SVG
  fonts/                # PDF export fonts
```

## Privacy

Uploaded CV bytes are parsed in the browser and are **not stored** by this version. OpenAI requests send only structured resume text and the job description to your configured API key on the server.

## License

Private — all rights reserved.
