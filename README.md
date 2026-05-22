# AgentQA

**Autonomous AI QA engineer for web apps.**

Paste a deployed URL. AgentQA launches a real Chrome browser, crawls up to 5 pages, detects bugs, captures screenshots, and delivers a scored QA report — then runs AI root-cause analysis on every issue in the background.

Built by [Viyalabs](https://viyalabs.com) · [info@viyalabs.com](mailto:info@viyalabs.com) · [agentqa.viyalabs.com](https://agentqa.viyalabs.com)

---

## What it does

| Capability | Detail |
|---|---|
| **Real browser crawling** | Playwright Chromium visits every page — not a headless HTTP client |
| **Multi-page BFS crawl** | Up to 5 pages, depth 1, skipping admin/auth/cart routes automatically |
| **Issue detection** | 404s, JS crashes, console errors, broken images, failed API calls, broken forms, slow loads, mobile overflow, large assets, missing alt text, missing meta tags |
| **QA Score** | 0–100, severity-weighted (critical −20 cap 60, medium −8 cap 30, low −2 cap 10) |
| **Desktop + mobile screenshots** | Full captures at 1280×800 and 375×812 per page |
| **Network debugging** | XHR/Fetch/script/stylesheet requests — status, timing, size |
| **JS error stacks** | Uncaught exceptions via `page.on('pageerror')` with full stack traces |
| **Real-time scan log** | Live terminal feed in dashboard as scan progresses |
| **AI root-cause analysis** | Claude Haiku analyzes every issue in the background — produces a one-sentence summary, specific root cause, and ordered fix steps |
| **AI scan overview** | One-paragraph engineering summary generated after all issues are analyzed |
| **Pattern learning** | Identical fingerprinted issues reuse cached AI templates — zero extra Claude calls after the first occurrence |
| **Feedback loop** | Thumbs up/down on AI fix suggestions; negative feedback flags the pattern for re-analysis |
| **Shareable reports** | Permanent public URL at `/report/{id}` with OG preview card |
| **Notify when done** | User submits email while scan runs; scanner emails the report link on completion |
| **CI/CD webhook** | `POST /api/webhook/scan` — runs scan synchronously, returns JSON + HTTP 422 if score < threshold |
| **Scan history** | `/scans` — public feed of 50 most recent completed scans |
| **Per-IP rate limiting** | 3 scans per IP per hour, 20 concurrent global queue limit, 15-minute dedup window |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router, TypeScript, Tailwind CSS |
| UI | Shadcn-style Radix UI components |
| Testing engine | Playwright (real Chromium) |
| AI analysis | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) |
| Database | Supabase (PostgreSQL + RLS) |
| Storage | Supabase Storage (screenshots, mobile screenshots) |
| Email | Resend API |
| Analytics | Vercel Analytics |
| Deployment | Vercel (Node.js runtime, 5-min function timeout) |

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/PraveenPerfeito/agentqa
cd agentqa
npm install
```

### 2. Install Playwright browsers

```bash
npm run install:browsers
# or: npx playwright install chromium --with-deps
```

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations (see [Database migrations](#database-migrations) below)
3. Go to **Storage → New bucket** → name it `screenshots` → set to **Public**

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
# Required — Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required — App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional — AI root-cause analysis (Claude Haiku)
ANTHROPIC_API_KEY=sk-ant-your-key-here        # get at console.anthropic.com

# Optional — Resend (email notifications + report emails)
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=onboarding@resend.dev        # use this until domain is verified
RESEND_NOTIFY_EMAIL=your@email.com             # admin notification recipient

# Optional — CI/CD webhook authentication
WEBHOOK_API_KEY=your_secret_key_here           # generate: openssl rand -hex 32

# Optional — internal worker protection
WORKER_SECRET=your_worker_secret               # generate: openssl rand -hex 32
```

> Supabase values: **Settings → API** in your Supabase dashboard.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Database migrations

All schema changes are managed through a single migration runner:

```bash
npm run db:migrate
```

This reads `.env.local` and applies all pending migrations via the Supabase Management API (HTTPS — no direct Postgres connection required). Migrations are idempotent; re-running is safe.

**Required in `.env.local` for migrations:**

```env
SUPABASE_ACCESS_TOKEN=your-personal-access-token   # supabase.com/dashboard/account/tokens
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

The runner creates all tables, views, functions, indexes, and RLS policies in the correct order. See `scripts/migrate.js` for the full migration history.

---

## CI/CD integration

Automatically QA-gate every deployment. See [agentqa.viyalabs.com/docs](https://agentqa.viyalabs.com/docs) for full docs.

### Setup

1. Set `WEBHOOK_API_KEY` in Vercel environment variables
2. Add `AGENTQA_API_KEY` as a secret in your GitHub repository

### GitHub Actions example

```yaml
# .github/workflows/qa.yml
name: QA Gate
on:
  deployment_status:

jobs:
  qa:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - name: Run QA scan
        run: |
          curl -f -X POST https://agentqa.viyalabs.com/api/webhook/scan \
            -H "x-api-key: ${{ secrets.AGENTQA_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"url":"${{ github.event.deployment_status.target_url }}","failThreshold":75}'
```

Returns `200` when score ≥ `failThreshold`, `422` when score falls below — failing the build automatically.

### Response shape

```json
{
  "passed": true,
  "score": 87,
  "failThreshold": 75,
  "scanId": "uuid",
  "url": "https://your-app.com",
  "reportUrl": "https://agentqa.viyalabs.com/report/uuid",
  "summary": { "totalPages": 8, "totalIssues": 3, "critical": 0, "medium": 2, "low": 1 },
  "criticalIssues": []
}
```

---

## Project structure

```
agentqa/
├── app/
│   ├── page.tsx                        # Homepage (ISR, 1h revalidate)
│   ├── layout.tsx                      # Root layout + Vercel Analytics + SEO metadata
│   ├── opengraph-image.tsx             # Homepage OG image (edge)
│   ├── icon.svg                        # SVG favicon
│   ├── robots.ts                       # robots.txt
│   ├── sitemap.ts                      # sitemap.xml (/, /docs, /scans, /privacy)
│   ├── api/
│   │   ├── scan/
│   │   │   ├── route.ts                # POST /api/scan — start scan (dedup, rate limit, queue limit)
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts            # GET /api/scan/:id — poll results, issues, logs, frameworks
│   │   │   │   └── notify/
│   │   │   │       └── route.ts        # POST /api/scan/:id/notify — store notify email
│   │   │   └── worker/
│   │   │       └── route.ts            # Internal scan worker endpoint
│   │   ├── ai/
│   │   │   └── worker/
│   │   │       └── route.ts            # POST /api/ai/worker — drains AI analysis job queue
│   │   ├── cron/
│   │   │   └── ai-worker/
│   │   │       └── route.ts            # Vercel Cron trigger (every 5 min) → /api/ai/worker
│   │   ├── issues/
│   │   │   └── [id]/
│   │   │       └── feedback/
│   │   │           └── route.ts        # POST /api/issues/:id/feedback — thumbs up/down on AI fix
│   │   ├── waitlist/
│   │   │   └── route.ts                # POST /api/waitlist — Pro waitlist + report email
│   │   └── webhook/
│   │       └── scan/
│   │           └── route.ts            # POST /api/webhook/scan — CI/CD integration
│   ├── scan/[id]/
│   │   └── page.tsx                    # Live scan progress page
│   ├── report/[id]/
│   │   ├── page.tsx                    # Shareable public report (ISR 60s)
│   │   └── opengraph-image.tsx         # Per-report OG image with score card
│   ├── scans/
│   │   └── page.tsx                    # /scans — public feed of 50 recent scans
│   ├── docs/
│   │   └── page.tsx                    # /docs — CI/CD API documentation
│   └── privacy/
│       └── page.tsx                    # /privacy — privacy policy
├── components/
│   ├── results-dashboard.tsx           # Real-time scan dashboard (polls API, shows AI analysis)
│   ├── issue-card.tsx                  # Issue display with AI summary, root cause, fix steps, feedback
│   ├── scan-form.tsx                   # URL input form (homepage)
│   ├── screenshot-viewer.tsx           # Screenshot grid + lightbox
│   ├── notify-when-done.tsx            # Email form shown while scan runs
│   └── ...                            # Landing page components (hero, features, pricing, etc.)
├── lib/
│   ├── supabase.ts                     # Supabase clients + storage helpers
│   ├── stats.ts                        # getHomeStats() for homepage live stats
│   └── utils.ts                        # URL validation, formatting, score helpers
├── playwright/
│   ├── crawler.ts                      # BFS web crawler with abort signal + resource blocking
│   └── page-tester.ts                  # Per-page Playwright test runner
├── services/
│   ├── scanner.ts                      # Scan orchestrator — timeout, screenshots, notify email
│   ├── scorer.ts                       # QA score calculation
│   ├── ai-analyzer.ts                  # AI analysis orchestrator — batches issues, calls Claude
│   ├── ai-queue.ts                     # AI job queue — enqueue, claim, complete, fail with backoff
│   ├── pattern-matcher.ts              # Issue fingerprint → pattern DB — template reuse, clustering
│   ├── issue-fingerprinter.ts          # Per-issue fingerprint + cluster key generation
│   └── ai/
│       └── claude.ts                   # Singleton Claude client — retries, timeouts, JSON parsing
├── scripts/
│   └── migrate.js                      # Database migration runner (Management API or direct Postgres)
├── types/
│   └── index.ts                        # All TypeScript types (Scan, Issue, ScanStatusResponse…)
├── database/
│   ├── schema.sql                      # Full Supabase schema reference
│   └── migrations/                     # Individual migration SQL files (reference only)
└── __tests__/
    ├── url-validation.test.ts
    ├── scorer.test.ts
    └── issue-detection.test.ts
```

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | — | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | — | Supabase anon key (public reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | Supabase service role key (writes) |
| `NEXT_PUBLIC_APP_URL` | ✅ | `https://agentqa.viyalabs.com` | Base URL for report/email links and AI worker trigger. Local dev: `http://localhost:3000` |
| `ANTHROPIC_API_KEY` | optional | — | Enables AI root-cause analysis, fix suggestions, and scan overview. Without it, issues are still detected — just without AI enrichment |
| `RESEND_API_KEY` | optional | — | Enables all email delivery (report links, notifications) |
| `RESEND_FROM_EMAIL` | optional | `AgentQA <noreply@viyalabs.com>` | Sender address — use `onboarding@resend.dev` until domain verified |
| `RESEND_NOTIFY_EMAIL` | optional | `info@viyalabs.com` | Admin email for waitlist/lead notifications |
| `WEBHOOK_API_KEY` | optional | — | Secret for CI/CD webhook (`x-api-key` header). Generate: `openssl rand -hex 32` |
| `WORKER_SECRET` | optional | — | Protects `/api/scan/worker` and `/api/ai/worker`. Generate: `openssl rand -hex 32` |
| `SUPABASE_ACCESS_TOKEN` | optional | — | Required for `npm run db:migrate` via Management API |
| `CRON_SECRET` | optional | — | Vercel sets this automatically on Pro. Required if self-hosting cron |
| `PLAYWRIGHT_HEADLESS` | optional | `true` | Set `false` to see browser window during local dev |
| `PLAYWRIGHT_TIMEOUT_MS` | optional | `10000` | Per-page navigation timeout in ms |
| `MAX_PAGES_PER_SCAN` | optional | `5` | Max pages per scan |
| `MAX_CRAWL_DEPTH` | optional | `1` | BFS depth from start URL |

---

## Supabase tables

| Table / View | Purpose |
|---|---|
| `scans` | One row per scan — URL, status, score, `notify_email`, `ip`, `ai_overview` |
| `scanned_pages` | Per-page data — status code, load time, screenshot URLs, network details |
| `issues` | Every detected issue — type, severity, details JSONB, `ai_summary`, `root_cause`, `fix_suggestion` |
| `issues_enriched` | Full AI analysis record — confidence, model version, whether result came from pattern cache |
| `issues_with_analysis` | View joining `issues` + `issues_enriched` + `issue_patterns` — used by the scan results API |
| `issue_patterns` | Fingerprint → root cause template. Populated on first analysis; reused on every subsequent match |
| `pattern_clusters` | Groups of related patterns (same issue family across different pages/apps) |
| `pattern_occurrences` | Time-series log of which scans triggered each pattern |
| `ai_analysis_jobs` | Async job queue — `issue_batch` and `scan_overview` jobs with priority, status, retry count |
| `scan_frameworks` | Detected tech stack per scan (Next.js, React, etc.) with confidence scores |
| `page_logs` | Console errors/warnings + JS stack traces per page |
| `scan_logs` | Real-time progress messages shown in the dashboard terminal |
| `waitlist` | Pro plan signups — email, name, timestamp |

---

## AI analysis pipeline

After a scan completes, two async jobs are enqueued in `ai_analysis_jobs`:

1. **`issue_batch` (priority 1)** — groups issues by fingerprint, sends batches of up to 14 issues to Claude Haiku in a single call, writes `ai_summary` / `root_cause` / `fix_suggestion` to each issue. Issues whose fingerprint already has a pattern template skip the Claude call entirely.

2. **`scan_overview` (priority 2)** — after issue analysis, generates a 2–3 sentence engineering summary for the scan and stores it in `scans.ai_overview`.

Jobs are drained by `POST /api/ai/worker`, triggered by Vercel Cron every 5 minutes. Each invocation reaps stuck jobs (lambda crashed mid-job), processes up to 10 jobs, then refreshes pattern velocity metrics.

**Pattern learning:** the first time a fingerprinted issue is analyzed by Claude, the root cause and fix are written back to `issue_patterns` as a reusable template. Every subsequent scan that hits the same fingerprint skips Claude entirely — analysis is instant and free.

---

## Scoring system

| Severity | Deduction | Cap |
|---|---|---|
| Critical | 20 pts/issue | 60 pts |
| Medium | 8 pts/issue | 30 pts |
| Low | 2 pts/issue | 10 pts |

`Score = max(0, 100 − total_deductions)`

**Critical issues:** page crash, navigation failure (unreachable), uncaught JS exception (TypeError / ReferenceError / SyntaxError)  
**Medium issues:** 404, console errors, failed XHR/Fetch, broken images, missing alt text, mobile layout overflow, broken forms  
**Low issues:** page load > 5s, 3+ console warnings, assets > 500 KB, missing meta description/OG image/H1

---

## Rate limiting

| Limit | Value | Scope |
|---|---|---|
| Per-IP scan rate | 3 scans/hour | Per client IP (`x-forwarded-for`) |
| Global queue | 20 concurrent scans | All active `pending`/`running` scans |
| URL deduplication | 15-minute window | Returns cached result for same URL |
| Feedback endpoint | 10 requests/minute | Per IP, in-process sliding window |

---

## API reference

### `POST /api/scan`
Start a scan. Returns `{ scanId }` (202) or `{ scanId, cached: true }` (200) for recent scans within the dedup window.

Body: `{ url: string, email?: string }`

### `GET /api/scan/:id`
Poll scan status. Returns `{ scan, pages, issues, logs, frameworks, history }`. Issues are sorted critical → medium → low.

### `POST /api/scan/:id/notify`
Store a notification email while scan is running. Scanner emails the report link on completion.

### `POST /api/issues/:id/feedback`
Record thumbs up/down on an AI fix suggestion. Rate-limited per IP. Negative feedback flags the pattern for re-analysis on the next scan.

Body: `{ helpful: boolean }`

### `POST /api/waitlist`
Join Pro waitlist. Optionally attach a `scanId` to receive the report link by email.

### `POST /api/webhook/scan` *(requires `x-api-key` header)*
CI/CD integration — runs scan synchronously. Returns `200` (passed) or `422` (score below threshold).

Body: `{ url: string, failThreshold?: number }` (default threshold: 70)

### `POST /api/ai/worker` *(internal — requires `x-worker-secret` if `WORKER_SECRET` is set)*
Drain the AI analysis job queue. Called by Vercel Cron every 5 minutes. Responds immediately (202); processing continues via `waitUntil`.

---

## Architecture decisions

**Fire-and-forget scanning:** `POST /api/scan` creates the DB record, returns `scanId` immediately, and uses `waitUntil` to keep the serverless function alive while the scan runs in the background. The frontend polls every 2.5s.

**Async AI queue:** AI analysis runs in a separate job queue after the scan completes so it doesn't block the scan result. The frontend polls for up to 90 seconds after scan completion to catch AI results. A Vercel Cron triggers the AI worker every 5 minutes as a safety net.

**Pattern-first analysis:** Before calling Claude, every issue is checked against the fingerprint cache in `issue_patterns`. If a matching template exists and hasn't been flagged for refresh, it's applied instantly. Claude is only called for genuinely novel issues. This compounds over time — common bugs become free after the first scan.

**Deferred screenshot uploads:** Screenshots are collected in memory during the crawl and uploaded to Supabase Storage in parallel after all pages are tested. Removes 3–5s of upload latency from each page's critical path.

**2-minute global timeout:** `AbortController` fires at 120s. The crawler checks the signal between pages and stops cleanly, always returning partial results — users never see an infinite loading state.

**JSONB for network details:** Each page generates ≤60 tracked requests. Storing as JSONB on `scanned_pages` avoids an extra join and keeps the API response flat.

**IP rate limiting without Redis:** Client IP stored in `scans.ip` at insert time. Rate check queries the `scans` table for recent inserts from the same IP — no external cache needed for 3 req/hour granularity. Fail-safe: if the count query errors, the request is rejected rather than allowed through.

**Node.js runtime everywhere:** Playwright requires Node.js APIs (child processes, file system). Edge runtime is incompatible. Only the OG image routes use edge runtime.

---

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import at [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.example`
4. Set **Function Region** to your nearest region
5. Run `npm run db:migrate` to apply the schema
6. Deploy

> **Vercel Hobby vs Pro:** Hobby has a 60-second function timeout. Large sites may not complete a full scan. Upgrade to Vercel Pro for the 300-second timeout needed for reliable results and AI analysis.

### Running tests

```bash
npm test
# or watch mode:
npm run test:watch
```

---

## License

MIT
