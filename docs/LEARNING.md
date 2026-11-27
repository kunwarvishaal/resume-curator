# Learning notes — Resume Curator

Plain-language lessons on the code added to this project, newest first.
Each lesson says **what** a function does, **why** it exists (which checklist item it
covers, see `docs/CHECKLIST.md`) and **how** it works.

---

## Lesson 6 — Moving to Next.js 16 (28 Nov 2026)

**Checklist:** CI/CD, Dependency vulnerabilities, Authentication

A **major version** (15 → 16) is allowed to break things that worked before; minor and patch
versions are not. Dependabot opened the upgrade as PR #6 and CI failed, which is CI doing its
job: it caught the break before it reached the live site. Three things needed changing.

### 1. `npm run lint`: from `next lint` to the ESLint CLI
Next 16 deleted the `next lint` command. It read `next lint` as "lint a folder called `lint`"
and stopped. Now `package.json` says `"lint": "eslint ."` and ESLint (the tool that flags
risky code) runs directly.

ESLint 9 also wants its settings in a new format, the **flat config**: one JavaScript file,
`eslint.config.mjs`, that lists rule sets in order, instead of the old `.eslintrc.json`:

```js
export default defineConfig([
  ...nextCoreWebVitals,   // React and Next.js rules, e.g. "hooks only at the top level"
  ...nextTypescript,      // TypeScript rules, e.g. "no `any`"
  globalIgnores([".next/**", "next-env.d.ts"]),  // generated files, not ours
]);
```

Same two rule sets as before, so the results match (0 errors, the same one `<img>` warning).
**How we know the rules really load:** a file with three planted mistakes (a hook inside an
`if`, an `any`, an unused variable) produced all three complaints. A lint config that loads
nothing would pass everything, which is worse than failing.

### 2. `middleware.ts` → `proxy.ts`, `middleware()` → `proxy()`
The file that runs before every request (our password gate) is now called a **proxy**, because
it stands in front of the app. Only the name changed; the logic is identical:
1. let assets and `/api/health` through;
2. if no password is configured, answer 503 "locked";
3. let `/login` and `/api/login` through;
4. anyone without a valid session cookie gets 401 (API) or a redirect to `/login` (pages).

**Tested by running it:** the built app was started locally and probed. With a password set:
`/` → 307 to `/login?next=%2F`, `/api/curate` → 401, `/login` and `/api/health` → 200. With
none: every route → 503 (health too, on purpose, so an uptime monitor raises the alarm).

### 3. The postcss pin is gone
`postcss` (the CSS processor) was forced to 8.5.32 because Next 15 shipped an old, vulnerable
copy. Next 16 ships 8.5.23, and `npm audit` finds 0 vulnerabilities without the pin, so the
`overrides` entry was removed. One less special case to remember.

Next 16 also rewrote `tsconfig.json` on its first build (`"jsx": "react-jsx"`, plus the new
`.next/dev/types` folder). Those are its required settings, so they are committed.

---

## Lesson 5 — Checking both kinds of packages for security bugs (28 Nov 2026)

**Checklist:** Dependency vulnerabilities (web app and CV tool), CI/CD (CV tool)

This project uses packages from two places, and each has its own checker:

| Part | Package list | Checker |
| --- | --- | --- |
| Web app (Next.js) | `package.json` + `package-lock.json` (npm) | `npm audit` |
| CV formatter (`tools/cv-format`) | `requirements.txt` (Python) | `pip-audit` |

A **vulnerability** is a known, published bug in a package that someone could abuse, for
example a crafted file that crashes the program reading it. Both checkers send only package
names and versions (public information) to a public list of known bugs and report matches.

**Results on 28 Nov:** `npm audit` found 0 (production and dev); `pip-audit -r requirements.txt`
found none in python-docx, lxml, docx2pdf or the packages they pull in. Nothing needed upgrading.

**Keeping it checked:** CI already ran `npm run audit:prod`. A new `cv-tool` job in
`.github/workflows/ci.yml` now does the same for Python on every push:
1. set up Python 3.12 (cached by `requirements.txt`, so reruns are quick);
2. install the exact pinned versions plus pip-audit;
3. run the 11 unit tests (`python -m unittest test_build_cv.py`);
4. run `pip-audit -r requirements.txt`; a found vulnerability fails the job, so you see it.

The PDF step is not tested in CI because it drives Microsoft Word, which Linux machines don't
have; the tests cover the Word file. Run the same checks by hand:
`~/.local/bin/pip-audit -r tools/cv-format/requirements.txt` and `npm audit --omit=dev`.

---

## Lesson 4 — Career snapshot from a free public API (27 Nov 2026)

**Files:** `lib/server/career-data.ts`, `app/api/career/route.ts`, `app/page.tsx` (`CareerCard`), `tests/career-data.test.ts`
**Checklist:** Data privacy, SSRF, Data validation, Timeouts, Exponential backoff, Caching, Cache invalidation, Circuit breakers, Rate limiting, Automated testing

**The big idea:** the app now shows pay, typical education, job growth and remote-work share
for the target job. The numbers come from TryHired's free API (found in the *public-apis*
list from the reel), which republishes U.S. government data (BLS = Bureau of Labor
Statistics) and O\*NET (a U.S. database of what each job involves). An **API** is a web
address that returns data for programs instead of a page for people.

The flow: browser → our `/api/career` → TryHired → our server picks out 8 fields → browser.
The browser never talks to TryHired directly, so our Content Security Policy stays strict.

### `cleanJobTitle(raw)`: send as little as possible
**What:** turns `"Senior Software Engineer (Remote) - Acme | LinkedIn"` into `"software engineer"`.
**Why:** *Data privacy* (only the job title leaves our server, and it no longer names the
company) and better search results ("senior" and "remote" don't change the occupation).
**How:** keep the text before ` - `, ` | `, ` at ` or a comma → drop anything in brackets →
lowercase → keep letters only → remove words like *senior, lead, II, remote*.

### `isPlausibleMatch(query, careerName)`: don't trust a search blindly
**What:** decides if a search result really is the job asked about.
**Why:** *Data validation*. Testing live data found that TryHired matches **any** word, so
"Chief Vibes Officer" came back as "Correctional Officer". Showing a jail guard's pay for a
marketing job would be confidently wrong, which is worse than showing nothing.
**How:** a result counts only if (1) it shares at least half of the query's words and (2) at
least one shared word is specific, not a generic word like *officer, manager, engineer*.
Words match on their first 4 letters, so "developers" ≈ "developer".
- "software developer" vs "Software Engineer": shares *software* (specific) → ✅
- "product manager" vs "Construction Manager": shares only *manager* (generic) → ❌

### `lookupCareer(title)`: the careful outside call
**What:** search → pick the first plausible result → fetch its overview and its requirements
at the same time → return a small `CareerSnapshot`, or `match: null`.
**Why and how, one checklist item per line:**
- *Timeouts:* one 8-second budget (`AbortSignal.timeout`) covers every attempt, so a slow
  site can't hang the request.
- *Exponential backoff:* reuses `fetchWithRetry` from Lesson 2, which retries once on 429/5xx.
- *Data validation:* every reply is checked with **zod** (a library that checks data matches a
  described shape) before use. A changed or broken reply becomes a clear error, not a crash.
- *SSRF* (Server-Side Request Forgery: tricking a server into calling a URL it shouldn't):
  the host is fixed, and the career "slug" from the reply (like `software-engineer`) must match
  `^[a-z0-9-]+$` before it goes into a URL. A reply containing `../admin` is refused (there's a test for it).
- *Caching:* answers are kept in memory for 24 hours, up to 200 titles. Asking twice costs one
  outside call. Misses ("no match") are cached too.
- *Circuit breakers / graceful degradation:* if the requirements call fails, you still get pay and
  outlook. If TryHired is down, the panel shows a message and the rest of the app works as before.

### `POST /api/career`: the front door
**What:** takes `{ "title": "..." }`, returns the snapshot.
**How:** rate limit (20 a minute per IP) → read at most 2 KB of JSON → zod `.strict()` check
(2–300 characters, no extra fields) → `lookupCareer` → `502` if TryHired failed, `500` for our own bugs.
The log records only `matched: true/false`, never the title, because a job title can hint at
who is applying where.

### `CareerCard`: honest display
Missing figures show "Not published" instead of a guess, and every card links to its source
with the attribution TryHired asks for. The panel says **U.S. data**. These are American
salaries in dollars, useful for comparing roles but not as an Indian salary benchmark.

**Try it:** open *Career snapshot* under the job description, type "Registered Nurse", press the button.

---

## Lesson 3 — The Charted Waters CV formatter (13 Nov 2026)

**Files:** `tools/cv-format/build_cv.py`, `candidates/*.json`, `test_build_cv.py`
**Checklist:** Data validation, Idempotency, Timeouts, Path traversal, Data privacy, Automated testing

**The big idea:** the *layout* (logo, fonts, navy lines, footer) lives in the code once,
and each candidate's *words* live in a small JSON file. JSON (JavaScript Object Notation)
is a plain text format of `"field": value` pairs. A new CV means a new JSON file, not new code.

### `load_content(path)`: check before you build
**What:** reads the JSON file and refuses it with a clear message if something is wrong.
**Why:** *Data validation*. Never trust input, even your own. A typo should give a readable
error, not a broken CV.
**How:** it checks, in order, that:
1. the file is real UTF-8 JSON (UTF-8 is the text encoding that handles "ä" and Hindi);
2. there are no unknown fields, so `"phone"` is rejected and a candidate's number can't slip in;
3. required text exists and fits, e.g. a profile over 900 characters would push the page past one sheet;
4. every sea-service row has exactly 6 cells.

Example: delete `"profile"` and you get `ERROR content.invalid 'profile' must be non-empty text`.

### `output_stem(name)`: a safe file name
**What:** `"MR. MANOJ H CHAUDHARI"` → `"CW CV Manoj H Chaudhari"`.
**Why:** *Path traversal*. A name like `../../x` could otherwise write outside the folder.
**How:** a regex (a text pattern) removes `MR.`/`DR.`, then deletes anything that isn't a
letter, digit, space, dot or dash, so slashes go.

### `CV` class and `build_docx(content)`: the layout
**What:** creates the A4 Word document. The header holds the logo, "Resume of a Consultant",
the navy line *and the watermark*. The footer holds the company line. Then the sections are
added in the reference order.
**Why the watermark sits in the header:** anything in the header repeats on every page, so
page 2 gets it for free.
**How the watermark floats:** Word stores pictures as "inline" (sitting in the text like a big
letter). `float_behind_text` rewrites that bit of the file's XML into an "anchor" with
`behindDoc="1"`, which pins it to a page position behind the text. XML is the tagged text
format inside a .docx.
Page 2 is only added when `sea_service` has rows, so a short CV stays one page.

### `save_atomic(doc, target)` and the `.partial.pdf`: safe to rerun
**What:** writes to a temporary file, then renames it to the real name.
**Why:** *Idempotency*: running twice gives the same result, never a duplicate. And a crash
mid-save never leaves a half-written CV in Downloads.
**How:** a rename (`os.replace`) is all-or-nothing on the disk.

### `export_pdf(...)`: Word makes the PDF, with a time limit
**What:** asks Microsoft Word to save the .docx as PDF, so the PDF matches Word exactly.
**Why:** *Timeouts*. Word can hang behind a dialog. The builder waits at most 240 s, then
says so and keeps the Word file.
**How:** it starts a separate Python process with `subprocess.run([...], timeout=240)`. Passing
a list (not one shell string) means no text in a file name can be run as a command.

### Tests: `test_build_cv.py`
11 unit tests (small automatic checks of one function at a time). They cover bad input, safe
names, both one- and two-page layouts, and "run twice, still one file". Run them with
`.venv/bin/python -m unittest -v` inside `tools/cv-format`.

---

## Lesson 2 — Health check (12 Nov 2026)

**File:** `app/api/health/route.ts` · **Checklist:** Health checks, Uptime monitoring

**What:** `GET /api/health` answers `{"ok":true,"status":"ok"}` with HTTP 200, or 503 if the
deployment is locked.

**Why:** an uptime monitor (a free service that visits a URL every few minutes) needs one
URL that says "I'm alive". If it gets a 503 or no answer, it emails you. Without it you only
find out the site is down when you try to use it.

**How:** it is the only API route the middleware lets through without a login, because it
reveals nothing private. `force-dynamic` makes Next run it on every request instead of
building it once, so it reports the *current* state.

---

## Lesson 1 — The security and reliability pass (12 Nov 2026)

### `log(level, event, fields)` — `lib/server/log.ts`
**Checklist:** Logging, Structured logging

- **What:** prints one line of JSON, e.g.
  `{"level":"error","event":"curate.ai_failed","reason":"http_error","status":401}`.
- **Why:** before this, when OpenAI failed the app quietly used local analysis and you never
  knew. A log line is the app telling you what happened.
- **How:** builds an object, turns it into JSON with `JSON.stringify`, and writes it with
  `console.error` / `warn` / `info`. Vercel stores those lines; because they are JSON you
  can filter by `event`.
- **Rule:** never log personal data (resume text, passwords, IPs). Logs are kept by the host.

### `fetchWithRetry` and `backoffDelay` — `lib/server/retry.ts`
**Checklist:** Exponential backoff, Timeouts, Circuit breakers (partly)

- **What:** calls `fetch`; if the answer is "busy" (429) or "server error" (5xx), or the
  network drops, it waits and tries again, up to 3 times.
- **Why:** many failures are temporary. Retrying right away makes things worse (everyone
  retries at once, the "thundering herd"), so the wait grows: 0.5 s, 1 s, 2 s … (exponential).
- **How:**
  1. `backoffDelay(attempt)` = `base × 2^(attempt-1)`, capped at 4 s, plus up to 25% random
     **jitter** so many clients don't retry in lockstep.
  2. If the server sends `Retry-After: 2`, it waits exactly 2 s instead.
  3. A 400 or 401 is *not* retried: the request itself is wrong, and trying again won't help.
  4. One `AbortController` timer (25 s) covers all attempts, so retries never make a request
     slower than the old limit.

### Session tokens — `makeSessionToken` / `verifySessionToken` in `lib/server/auth.ts`
**Checklist:** Session management, Token expiration, Secret rotation, Hashing vs encryption

- **What:** the login cookie now looks like `v1.1795106200.3f9a…` = version, expiry time,
  signature.
- **Why:** the old cookie was the same forever, so a stolen one worked until you changed the
  password. Now it stops working after 7 days by itself.
- **How:** an **HMAC** is a fingerprint of a message made with a secret key. Anyone can read
  the expiry, but changing it breaks the fingerprint, and only the server has the key to make
  a new one. On every request the server checks: right format, not expired, fingerprint
  matches. Changing `APP_PASSWORD` or `SESSION_SECRET` changes the key, which signs everyone out.
- **Hashing vs encryption:** an HMAC is one-way, like a hash: it proves a message is genuine
  but can't be turned back into anything. Encryption is two-way (lock and unlock).

### `passwordMatches` — `lib/server/auth.ts`
**Checklist:** Brute-force protection

- **What:** checks the typed password.
- **Why:** a normal `a === b` stops at the first wrong letter, so it answers slightly faster
  for very wrong guesses. With enough tries an attacker can measure that (a **timing attack**).
- **How:** it HMACs both strings to equal-length fingerprints, then compares every character
  with XOR (`^`) and adds up the differences, so it always takes the same time.

### `accessMode()` — `lib/server/auth.ts` + `middleware.ts`
**Checklist:** Principle of least privilege, Authentication

- **What:** returns `password`, `open` or `locked`.
- **Why:** **fail closed**. If someone forgets `APP_PASSWORD` in production, the safe outcome
  is "nobody gets in" (503), not "anyone can use my paid OpenAI key".
- **How:** password set → `password`. Not production (`npm run dev`) → `open`. Production
  without one → `locked`, unless you deliberately set `ALLOW_OPEN_ACCESS=true`.

### `safeNextPath` — `lib/safe-redirect.ts`
**Checklist:** Open redirects

- **What:** after login you go back to the page you came from (`?next=/workspace`).
- **Why:** an attacker could send `yourapp.com/login?next=https://evil.com`. You'd see your
  real site, log in, and land on a fake one that asks you to "log in again".
- **How:** only allows paths starting with a single `/`. It rejects `//evil.com` (browsers
  read that as another site), backslashes, control characters and anything with a different
  origin. Everything else becomes `/`.

### `validatePublicUrl` / `isPublicIp` — `lib/server/public-url.ts`
**Checklist:** SSRF

- **What:** checks a job-page URL before the server fetches it.
- **Why:** **SSRF** (server-side request forgery) means tricking *your server* into fetching
  something only it can reach, like `169.254.169.254` (cloud secrets) or `localhost`.
- **How:** HTTPS and port 443 only, no `user:pass@`, no local hostnames, and every IP must be
  public. The route also looks up the hostname's DNS and checks each address, because
  `evil.com` could point to `127.0.0.1`. Redirects are checked again at every hop.

### Security headers — `next.config.ts`
**Checklist:** Content Security Policy, Security headers, Clickjacking, HTTPS

- **CSP:** tells the browser "only run scripts, fonts and connections from this site". If an
  attacker ever injects a `<script src=evil>`, the browser refuses it.
- **`frame-ancestors 'none'` + `X-Frame-Options: DENY`:** no other site can show yours in an
  invisible frame and trick you into clicking (**clickjacking**).
- **`nosniff`:** the browser must trust the declared file type, not guess.
- **HSTS:** "always use HTTPS for this site" for 2 years.

### Tests, lockfile, CI, Dependabot
**Checklist:** Automated testing, CI/CD, Dependency vulnerabilities

- **Tests (`tests/*.test.ts`, Vitest):** code that calls your functions with known inputs
  and checks the outputs. `it("expires after the max age")` makes a token, pretends 7 days
  passed, and expects `false`. Run `npm test`; if a later change breaks something, a test fails.
- **`package-lock.json`:** records the exact version of every package, so your laptop, CI
  and Vercel all build with the same code. `npm ci` installs exactly that.
- **CI (`.github/workflows/ci.yml`):** GitHub runs lint, typecheck, tests, build and audit on
  every push. A red ❌ means don't deploy.
- **Dependabot:** opens a PR when a package has an update or a security fix.
- **`overrides` in package.json:** forces a patched version of a package that another
  package depends on (postcss inside Next, minimatch inside typescript-eslint).
