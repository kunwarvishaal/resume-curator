# Engineering checklist — Resume Curator

Every item from `~/.claude/engineering-checklist.md`, accounted for.
Status: **Done** · **Partial** · **To do** · **N/A** (doesn't apply yet, with the reason).
Last reviewed: 28 Nov 2026 (moved to Next.js 16; added the AI-writing check).

What the app is: a Next.js app on Vercel. CVs are parsed **in the browser**; the server
has four API routes (`/api/curate`, `/api/jd/extract`, `/api/career`, `/api/login`) plus `/api/health`,
no database, and one secret (`OPENAI_API_KEY`) used only on the server.

## Infrastructure
| Item | Status | Where / notes |
| --- | --- | --- |
| Load balancing | N/A | Vercel runs serverless functions and spreads requests itself. |
| Rate limiting | Partial | `lib/server/api-security.ts` `takeRateLimit` on every API route. In-memory per instance, so not a hard global limit. Upgrade: Vercel KV / Upstash counter. |
| Environment variables | Done | `.env.example` documents all; read via `process.env` on the server only. |
| Secrets management | Done | `OPENAI_API_KEY` never reaches the browser; `.env*` git-ignored; logs never include secrets. |
| Backups | N/A | No stored user data. Code is in git + GitHub. |
| Caching | Partial | Pages prerendered and served from Vercel's CDN; API responses are `no-store` on purpose (personal data). Career lookups cached in memory for 24 h, max 200 titles (`lib/server/career-data.ts`); per instance, not shared. |
| CDNs | Done | Vercel edge network serves static assets. |
| Reverse proxies | Done | Vercel terminates TLS and proxies to the functions. |
| API gateways | N/A | Internal routes only; `proxy.ts` (Next.js 16's name for middleware) does auth for all of them. |
| Docker | N/A | Vercel builds from source; no container needed. |
| CI/CD | Done | `.github/workflows/ci.yml` (lint via the ESLint CLI and `eslint.config.mjs`, typecheck, test, build, audit) + Vercel auto-deploy. Runs on every push to `main` and every PR. |
| Message queues | N/A | No slow background work. |
| HTTPS / TLS | Done | Vercel TLS + HSTS + `upgrade-insecure-requests` (`next.config.ts`). |
| Horizontal vs vertical scaling | N/A | Serverless scales horizontally automatically. |
| Stateless services | Partial | Everything is stateless except the in-memory rate limiter and career cache; losing either only costs a refetch. |
| Health checks | Done | `app/api/health/route.ts` — public, returns 503 when the deployment is locked. |
| Graceful shutdown | N/A | Serverless functions; no long-lived process. |
| Staging environments | Partial | Vercel preview deployments per branch. Needs feature branches (see Branching). |
| Infrastructure as Code | Partial | `vercel.json`, `next.config.ts` in git; env vars live only in the Vercel dashboard. |
| Disaster recovery | Partial | Redeploy from GitHub. To do: keep a private note of which env vars exist (not values). |

## Reliability
| Item | Status | Where / notes |
| --- | --- | --- |
| Error handling | Done | `ApiRequestError` with real status codes; unexpected errors logged and returned as 500. |
| Timeouts | Done | OpenAI 25 s total, job page 12 s, DNS 4 s, career data 8 s total. |
| Exponential backoff | Done | `lib/server/retry.ts` `fetchWithRetry` (429/5xx, 3 attempts, jitter, Retry-After); career data uses 2 attempts. |
| Idempotency | Done | All routes are free of side effects; repeating a request changes nothing. |
| Circuit breakers | Partial | Falls back to local analysis per request. Career snapshot is optional: if TryHired is down the panel shows a message and nothing else breaks. No "stop calling for 60 s" state. |
| Race conditions | N/A | No shared data is written. |
| Concurrency | Done | IPv4/IPv6 DNS lookups run in parallel; nothing shared to protect. |
| Async / await | Done | All I/O is awaited; body streams read with limits. |
| Memory leaks | Done | Rate-limit map capped at 5,000 entries and pruned every 30 s. |
| Background jobs | N/A | None needed. |
| Cron jobs | N/A | None. |
| Webhooks | N/A | None received. |
| Feature flags | N/A | `OPENAI_API_KEY` presence acts as the only switch. |

## Data
| Item | Status | Where / notes |
| --- | --- | --- |
| Database indexing / migrations / normalization / connection pooling / read replicas / soft deletes | N/A | No database. Revisit if saved resumes are ever added. |
| Cache invalidation | Done | Career cache entries expire after 24 h (TryHired data changes a few times a year); oldest entry evicted at 200. |
| Data validation on the server | Done | Strict zod schemas with size caps; `readJsonBody` caps bytes while streaming; AI output validated against the source resume; TryHired responses checked with zod before use. |
| Time zones | Done | Session expiry stored as Unix seconds (UTC); no other stored times. |
| Character encoding | Done | Strict UTF-8 decoding of request bodies; NFKC normalization when comparing words. |

## Observability
| Item | Status | Where / notes |
| --- | --- | --- |
| Logging | Done | `lib/server/log.ts` on every route. |
| Structured logging | Done | One JSON line per event (`curate.ai_failed`, `login.failed` ...). |
| Monitoring | Partial | Vercel Logs and Analytics only. |
| Alerting | To do | Free UptimeRobot check on `/api/health`; Vercel log alert on `curate.ai_failed`. |
| Distributed tracing | N/A | One service. |
| Error tracking | Partial | Errors are logged; no grouping tool like Sentry yet. |
| Uptime monitoring | To do | Point a free uptime monitor at `/api/health`. |
| Profiling | N/A | No performance problem to investigate. |
| Cost monitoring | To do | Set a monthly budget and alert in the OpenAI dashboard; add token counts to `curate.ai_ok` logs. |
| Performance budgets | Partial | Build prints first-load JS (126 kB); no enforced limit yet. |

## Process
| Item | Status | Where / notes |
| --- | --- | --- |
| Automated testing | Done | `tests/` — 91 Vitest tests (incl. `career-data.test.ts`). |
| Unit vs integration vs end-to-end tests | Partial | Unit tests only. To do: one Playwright end-to-end test (login → curate). |
| Load testing | N/A | Personal tool; rate limits cap load. |
| Debugging | Done | Structured logs give the reason for every fallback. |
| Code review | Partial | CI checks every push; use PRs so changes get reviewed before merging. |
| Branching strategies | To do | Commits go straight to `main`. Use short-lived feature branches + PRs. |
| Semantic versioning | N/A | An app, not a library; `package.json` 1.0.0. |
| API versioning | N/A | APIs are only called by this app's own frontend. |
| API documentation | Partial | README describes routes (incl. `/api/career`) and env vars; no request/response reference. |
| Technical debt | Done | Tracked in this file (Partial / To do rows). |
| Reading documentation / error messages | Done | Practice: logs keep real error names and messages. |

## Auth
| Item | Status | Where / notes |
| --- | --- | --- |
| Authentication | Done | Shared password gate (`proxy.ts`, `/api/login`). |
| Authorization | N/A | One role: everyone who logs in can do everything. |
| Session management | Done | Signed `v1.<expiry>.<hmac>` cookie, 7 days (`lib/server/auth.ts`). |
| Two-factor authentication / SSO / passkeys / magic links / password reset | N/A | Shared-password personal tool with no user accounts. Revisit if real accounts are added. |
| Role-based access control / Row-level security | N/A | No roles, no stored rows. |
| API keys | Done | OpenAI key is server-only. |
| Token expiration and refresh | Done | Expiry is inside the signed token; users log in again after 7 days (no refresh tokens needed). |
| Account lockout | Partial | 8 login attempts/minute per IP; no lockout after N failures. |
| Brute-force protection | Partial | Same rate limit + constant-time compare; per-instance only. |

## Security
| Item | Status | Where / notes |
| --- | --- | --- |
| Input validation | Done | zod `.strict()` schemas with max lengths everywhere. |
| HTTP status codes | Done | 400, 401, 408, 413, 415, 422, 429, 500, 503 used correctly. |
| SQL injection | N/A | No database. |
| XSS | Done | React escapes all text; no `dangerouslySetInnerHTML`; CSP blocks outside scripts. |
| CSRF | Done | `SameSite=Lax` cookie + APIs require `application/json` (cross-site forms can't send it). |
| SSRF | Done | `lib/server/public-url.ts` + DNS checks in the importer; career lookups only call the fixed `tryhired.co` host, and the slug from its reply must match `^[a-z0-9-]+$` before it goes in a URL; tested. |
| IDOR | N/A | No per-user objects. |
| Mass assignment | Done | Strict schemas reject unknown fields. |
| Clickjacking | Done | `frame-ancestors 'none'` + `X-Frame-Options: DENY`. |
| Open redirects | Done | `lib/safe-redirect.ts` on the login page; tested. |
| Path traversal | N/A | Server never reads files from user input. |
| Command injection | N/A | No shell commands. |
| File upload security | Done | Files are parsed in the browser (10 MB cap) and never uploaded to the server. |
| Dependency vulnerabilities | Done | Lockfile, `npm run audit:prod` in CI, Dependabot weekly. On Next.js 16 since 28 Nov, so the old postcss pin is gone (Next's own postcss 8.5.23 audits clean). `npm audit` on 28 Nov: 0 vulnerabilities (production and dev). |
| Principle of least privilege | Partial | CI token is read-only. To do: use a project-scoped OpenAI key limited to the Responses API. |
| Content Security Policy | Partial | Strict except `script-src 'unsafe-inline'` (needed by Next without nonces). Career data is fetched server-side, so `connect-src 'self'` is unchanged. |
| Security headers | Done | `next.config.ts`. |
| Cookie flags | Done | `HttpOnly; Secure; SameSite=Lax`. |
| Secret rotation | Done | `SESSION_SECRET` signs everyone out; OpenAI key replaceable in Vercel without code changes. |
| Audit logs | Partial | `login.ok` / `login.failed` events; no long-term retention. |
| Encryption at rest | N/A | Nothing stored. |
| Encryption in transit | Done | HTTPS everywhere; OpenAI called over HTTPS. |
| Hashing vs encryption | Done | Sessions use HMAC (one-way signature); nothing is encrypted that should be hashed. |
| Salting | N/A | No stored password hashes (password lives only in an env var). |
| Penetration testing | Partial | Attack-style unit tests for SSRF, redirects, tampered sessions. No full pen test. |

## Product
| Item | Status | Where / notes |
| --- | --- | --- |
| Accessibility | Partial | `jsx-a11y` lint rules pass; no screen-reader or contrast audit yet. |
| Mobile responsiveness | To do | Not yet checked at phone width. |
| Writing quality (AI-sounding text) | Done | `lib/ai-tells.ts` flags words, phrases and spaced em dashes from Wikipedia's "Signs of AI writing" (checked 28 Nov 2026). Each one costs 0.5 language points (max 1.5), a note appears under the keywords panel, and the AI-review prompt is told to avoid them. Flags only, never rewrites (`tests/ai-tells.test.ts`, 8 tests). |
| Data privacy | Partial | CVs parsed locally, OpenAI called with `store:false`, logs exclude content. Career lookup sends only a cleaned job title to TryHired (never the CV or JD), says so in the panel, and logs only matched yes/no. To do: a short privacy note for the whole app. |

## Tool: Charted Waters CV formatter (`tools/cv-format/`)
A local Python command, not part of the web app or its deployment. It reads one candidate
JSON file and writes a Word CV plus a PDF (exported by Microsoft Word) to `~/Downloads`.

| Item | Status | Where / notes |
| --- | --- | --- |
| Data validation | Done | `load_content`: required fields, unknown fields rejected, length caps so the page cannot overflow, sea-service rows must have 6 cells. |
| Error handling | Done | Clear `content.invalid` / `pdf.failed` messages; exit codes 0 ok, 1 PDF failed (Word file kept), 2 bad input. |
| Timeouts | Done | Word PDF export runs in a child process, stopped after `--pdf-timeout` (240 s). |
| Idempotency | Done | Same input gives the same files; `save_atomic` and a `.partial.pdf` then rename, so reruns overwrite cleanly and a crash never leaves half a file (tested). |
| Path traversal | Done | `output_stem` strips slashes and other unsafe characters from the name used in the file name (tested). |
| Command injection | Done | Word is called with an argument list, never a shell string. Candidate files are JSON, never run as code. |
| Data privacy | Done | Candidate files hold personal data and are git-ignored (only `example.json` is committed); candidates' own phone and email never appear in the output. |
| Character encoding | Done | Files read as UTF-8; accents such as "Wärtsilä" print correctly. |
| Logging / Structured logging | Partial | One `level event detail` line per step (`docx.saved`, `pdf.failed` ...); plain text, not JSON. Enough for a hand-run tool. |
| Automated testing | Done | `tools/cv-format/test_build_cv.py`: 11 unit tests (validation, naming, layout, reruns). |
| CI/CD | Done | `cv-tool` job in `.github/workflows/ci.yml` (28 Nov): installs `requirements.txt` on Python 3.12, runs the 11 tests and pip-audit. The PDF step needs Word, so CI tests the Word file only. Starts once pushed. |
| Dependency vulnerabilities | Done | Versions pinned in `requirements.txt`. `pip-audit -r requirements.txt` on 28 Nov: no known vulnerabilities (python-docx 1.2.0, lxml 6.1.3, docx2pdf 0.1.8 and what they pull in). Runs on every push in the `cv-tool` CI job. |
| Secrets management | N/A | No keys or passwords. The Charted Waters email and phone in `build_cv.py` are public business details. |
| Graceful shutdown | Done | Temp files are removed in `finally` blocks, even after an error or timeout. |
| Circuit breakers / Exponential backoff | N/A | One local call to Word; a failure is reported once for you to fix, not retried. |
| Everything else in the list (scaling, databases, auth, web security headers, monitoring, queues, cron ...) | N/A | No server, network access, users or stored data; it runs only when you start it. |
