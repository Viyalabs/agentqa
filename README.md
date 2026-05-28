# AgentQA

**Continuous AI reliability intelligence for web apps.**

Paste a deployed URL or trigger from CI/CD. AgentQA launches a real Chrome browser, crawls every page, detects bugs, captures screenshots, and delivers a scored reliability report — then runs AI root-cause analysis matched against a growing failure signature library.

Built by [Praveen Kumar](https://www.linkedin.com/in/praveen-perfeito-75852a64/) · [Viyalabs](https://viyalabs.com) · [info@viyalabs.com](mailto:info@viyalabs.com) · [agentqa.viyalabs.com](https://agentqa.viyalabs.com)

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
| **AI root-cause analysis** | Claude Haiku analyzes every issue — produces a one-sentence summary, specific root cause, and ordered fix steps |
| **AI scan overview** | One-paragraph engineering summary generated after all issues are analyzed |
| **Failure signature matching** | 33 known framework-specific failure signatures (Next.js hydration, Shopify race conditions, Laravel CSRF) matched before any Claude call — instant, zero cost |
| **Pattern learning** | Identical fingerprinted issues reuse cached AI templates — zero extra Claude calls after the first occurrence |
| **Regression tracking** | Issues resolved in one scan and reappearing in a later scan are flagged as regressions, not new issues |
| **Recurrence intelligence** | `recurrence_count` and `avg_days_to_recur` tracked per pattern across all scans |
| **Semantic embeddings** | Optional pgvector-powered semantic similarity matching for issue clustering (requires OpenAI key) |
| **Scheduled scans** | Daily, weekly, or custom cadence — automated reliability monitoring without manual triggers |
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
| Semantic embeddings | OpenAI `text-embedding-3-small` via pgvector (optional) |
| Database | Supabase (PostgreSQL + pgvector + RLS) |
| Storage | Supabase Storage (screenshots, mobile screenshots) |
| Email | Resend API |
| Analytics | Vercel Analytics |
| Deployment | Vercel (Node.js runtime, 5-min function timeout) |

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/Viyalabs/agentqa
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
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional — Semantic embeddings + similarity matching (OpenAI)
OPENAI_API_KEY=sk-your-openai-key-here

# Optional — Resend (email notifications)
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_NOTIFY_EMAIL=your@email.com

# Optional — CI/CD webhook
WEBHOOK_API_KEY=your_secret_key_here

# Optional — worker protection
WORKER_SECRET=your_worker_secret
```

See `.env.example` for the full list including founder access, beta emails, session encryption, and WhatsApp notifications.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Database migrations

```bash
npm run db:migrate
```

Reads `.env.local` and applies all pending migrations via the Supabase Management API. Idempotent — safe to re-run.

**Required for migrations:**

```env
SUPABASE_ACCESS_TOKEN=your-personal-access-token
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

---

## CI/CD integration

Automatically QA-gate every deployment. Full docs at [agentqa.viyalabs.com/docs](https://agentqa.viyalabs.com/docs).

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

Returns `200` when score ≥ `failThreshold`, `422` when score falls below.

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
│   ├── page.tsx                        # Homepage (ISR, 1h revalidate) — 11 sections
│   ├── layout.tsx                      # Root layout + SEO metadata + Vercel Analytics
│   ├── opengraph-image.tsx             # Homepage OG image (edge)
│   ├── icon.svg                        # SVG favicon
│   ├── robots.ts                       # robots.txt
│   ├── sitemap.ts                      # sitemap.xml
│   ├── demo-app/
│   │   ├── page.tsx                    # Controlled demo page — seeded issues for DemoScan
│   │   └── demo-error-trigger.tsx      # Client component — fires real uncaught TypeError
│   ├── about/
│   │   └── page.tsx                    # /about — founder story, company info, tech stack
│   ├── contact/
│   │   └── page.tsx                    # /contact — email, LinkedIn, X, GitHub, Google Business
│   ├── internal/
│   │   └── page.tsx                    # /internal — founder analytics dashboard (token-gated)
│   ├── api/
│   │   ├── scan/
│   │   │   ├── route.ts                # POST /api/scan — start scan
│   │   │   ├── [id]/route.ts           # GET /api/scan/:id — poll results
│   │   │   ├── [id]/notify/route.ts    # POST /api/scan/:id/notify
│   │   │   └── worker/route.ts         # Internal scan worker
│   │   ├── ai/worker/route.ts          # POST /api/ai/worker — drains AI job queue
│   │   ├── cron/ai-worker/route.ts     # Vercel Cron → /api/ai/worker (every 5 min)
│   │   ├── issues/[id]/feedback/route.ts # POST /api/issues/:id/feedback
│   │   ├── intelligence/route.ts       # GET /api/intelligence — cross-scan failure summary
│   │   ├── admin/metrics/route.ts      # GET /api/admin/metrics — founder analytics (gated)
│   │   ├── waitlist/route.ts           # POST /api/waitlist — Pro waitlist + Resend + WhatsApp
│   │   └── webhook/scan/route.ts       # POST /api/webhook/scan — CI/CD integration
│   ├── scan/[id]/page.tsx              # Live scan progress page
│   ├── report/[id]/
│   │   ├── page.tsx                    # Shareable public report (ISR 60s)
│   │   └── opengraph-image.tsx         # Per-report OG score card
│   ├── scans/page.tsx                  # /scans — public feed of recent scans
│   ├── docs/page.tsx                   # /docs — CI/CD API documentation
│   ├── changelog/page.tsx              # /changelog
│   ├── privacy/page.tsx                # /privacy
│   └── terms/page.tsx                  # /terms
├── components/
│   ├── hero.tsx                        # Hero + ForWhoSection — scan form, traction stats (live DB)
│   ├── why-agentqa.tsx                 # Problem narrative + compact comparison table (merged)
│   ├── how-it-works.tsx                # 4-step process
│   ├── demo-scan.tsx                   # Live demo — controlled /demo-app + 2 real-world sites
│   ├── ai-moat.tsx                     # AI root cause + fix deep dive
│   ├── features.tsx                    # Full feature grid (5 categories)
│   ├── reliability-intelligence.tsx    # Cross-scan pattern memory, regression tracking (live DB)
│   ├── cta-banner.tsx                  # Conversion CTA
│   ├── pricing.tsx                     # Free tier + Pro waitlist form (POST /api/waitlist)
│   ├── about-section.tsx               # Founder + company — homepage legitimacy anchor
│   ├── recent-reports.tsx              # Live scan gallery (server component, ISR 60s)
│   ├── navbar.tsx                      # Fixed nav
│   ├── footer.tsx                      # Four-column footer with all social links
│   ├── results-dashboard.tsx           # Real-time scan dashboard
│   ├── issue-card.tsx                  # Issue display with AI analysis + feedback
│   ├── scan-form.tsx                   # URL input form
│   ├── screenshot-viewer.tsx           # Screenshot grid + lightbox
│   ├── notify-when-done.tsx            # Email capture during scan
│   ├── mobile-cta.tsx                  # Mobile sticky CTA
│   └── reliability-timeline.tsx        # Per-scan timeline (used in report view)
├── lib/
│   ├── supabase.ts                     # Supabase clients + storage helpers
│   ├── stats.ts                        # getHomeStats() — live DB counts for hero
│   ├── access-control.ts               # Founder token + internal/beta email tiers
│   └── utils.ts                        # URL validation, formatting, score helpers
├── playwright/
│   ├── crawler.ts                      # BFS web crawler with abort signal + resource blocking
│   └── page-tester.ts                  # Per-page Playwright test runner
├── services/
│   ├── scanner.ts                      # Scan orchestrator — timeout, screenshots, notify email
│   ├── scorer.ts                       # QA score calculation
│   ├── ai-analyzer.ts                  # AI analysis orchestrator — batches issues, calls Claude
│   ├── ai-queue.ts                     # AI job queue — enqueue, claim, complete, fail with backoff
│   ├── ai-config.ts                    # Model tiering (Haiku default, Sonnet for critical issues)
│   ├── pattern-matcher.ts              # Issue fingerprint → pattern DB — template reuse
│   ├── issue-fingerprinter.ts          # Per-issue fingerprint + cluster key generation
│   ├── signature-matcher.ts            # Two-pass signature matching: keyword → semantic ANN
│   ├── known-signatures.ts             # 33 seeded failure signatures across 8 frameworks
│   ├── embedding-service.ts            # OpenAI text-embedding-3-small wrapper (optional)
│   ├── regression-worker.ts            # Post-scan regression computation + lifecycle events
│   └── ai/claude.ts                    # Singleton Claude client — retries, timeouts, JSON parsing
├── scripts/
│   └── migrate.js                      # Database migration runner
├── types/
│   └── index.ts                        # All TypeScript types
├── database/
│   ├── schema.sql                      # Full Supabase schema reference
│   └── migrations/                     # Individual migration SQL files
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
| `NEXT_PUBLIC_APP_URL` | ✅ | `https://agentqa.viyalabs.com` | Base URL for reports, emails, and demo scan |
| `ANTHROPIC_API_KEY` | optional | — | Enables AI root-cause analysis and scan overview |
| `OPENAI_API_KEY` | optional | — | Enables semantic embeddings + pgvector similarity matching |
| `AI_PREMIUM_MODEL` | optional | `false` | Set `true` to use Claude Sonnet for critical JS/network issues |
| `RESEND_API_KEY` | optional | — | Email delivery (report links, waitlist notifications) |
| `RESEND_FROM_EMAIL` | optional | `AgentQA <noreply@viyalabs.com>` | Sender — use `onboarding@resend.dev` until domain verified |
| `RESEND_NOTIFY_EMAIL` | optional | `info@viyalabs.com` | Admin notification recipient |
| `WEBHOOK_API_KEY` | optional | — | CI/CD webhook secret (`x-api-key` header) |
| `WORKER_SECRET` | optional | — | Protects `/api/scan/worker` and `/api/ai/worker` |
| `CRON_SECRET` | optional | — | Vercel sets automatically on Pro; required if self-hosting |
| `SESSION_ENCRYPTION_KEY` | optional | — | AES-256-GCM key for auth session credentials (64 hex chars) |
| `FOUNDER_TOKEN` | optional | — | Header token for internal access without email check |
| `INTERNAL_EMAILS` | optional | — | Comma-separated emails — bypass rate limits, full AI analysis |
| `BETA_EMAILS` | optional | — | Comma-separated emails — elevated limits (20 scans/hr) |
| `SUPABASE_ACCESS_TOKEN` | optional | — | Required for `npm run db:migrate` via Management API |
| `SUPABASE_POOLER_URL` | optional | — | PostgreSQL pooler URL for direct migration scripts |
| `PLAYWRIGHT_HEADLESS` | optional | `true` | Set `false` to see browser during local dev |
| `PLAYWRIGHT_TIMEOUT_MS` | optional | `10000` | Per-page navigation timeout in ms |
| `MAX_PAGES_PER_SCAN` | optional | `5` | Max pages per scan |
| `MAX_CRAWL_DEPTH` | optional | `1` | BFS depth from start URL |
| `CALLMEBOT_API_KEY` | optional | — | WhatsApp notifications for waitlist leads |
| `CALLMEBOT_PHONE` | optional | — | WhatsApp phone number (with country code, no +) |

---

## Supabase tables

| Table / View | Purpose |
|---|---|
| `scans` | One row per scan — URL, status, score, `notify_email`, `ip`, `ai_overview`, `session_id` |
| `scanned_pages` | Per-page data — status code, load time, screenshot URLs, network details |
| `issues` | Every detected issue — type, severity, details JSONB, `ai_summary`, `root_cause`, `fix_suggestion`, `signature_id` |
| `issues_enriched` | Full AI analysis record — confidence, model version, pattern cache hit |
| `issues_with_analysis` | View joining `issues` + `issues_enriched` + `issue_patterns` |
| `issue_patterns` | Fingerprint → root cause template + recurrence tracking + embeddings |
| `pattern_clusters` | Groups of related patterns across pages/apps |
| `pattern_occurrences` | Time-series log of pattern triggers per scan |
| `failure_signatures` | 33 pre-seeded known failure signatures — matched before AI analysis |
| `issue_resolution_events` | Lifecycle events: `detected`, `resolved`, `reappeared` per domain+fingerprint |
| `domain_issue_state` | Current open/resolved status per domain fingerprint |
| `scan_regressions` | Per-scan regression diffs (new / resolved / recurring / worsened / improved) |
| `scan_schedules` | Recurring scan configuration — cadence, next run, owner email |
| `ai_analysis_jobs` | Async job queue — `issue_batch` and `scan_overview` jobs |
| `scan_frameworks` | Detected tech stack per scan with confidence scores |
| `page_logs` | Console errors/warnings + JS stack traces |
| `scan_logs` | Real-time progress messages |
| `waitlist` | Pro plan signups — email, name, timestamp |
| `domain_recurrence_summary` | View — detection / resolution / reappearance counts per domain |
| `framework_failure_analytics` | View — issue breakdown by detected framework |

---

## Intelligence layer

### Failure signature matching

Before any Claude call, every issue is matched against 33 pre-seeded failure signatures across 8 frameworks using a two-pass approach:

1. **Keyword/regex** — fast pattern match against `triggerPatterns` (no API, no latency)
2. **Semantic ANN** — pgvector cosine similarity via `find_signature_by_embedding` (requires `OPENAI_API_KEY`)

Matched signatures provide instant root cause and fix — Claude is only called for genuinely novel issues.

### Pattern learning

The first time a fingerprinted issue is analyzed by Claude, the root cause and fix are written back to `issue_patterns` as a reusable template. Every subsequent scan that matches the fingerprint skips Claude entirely.

### Regression tracking

After each scan, `regression-worker.ts` runs two Postgres functions:
- `agentqa_compute_regressions` — diffs current vs previous scan per fingerprint
- `agentqa_apply_scan_to_state` — updates `domain_issue_state` memory

Lifecycle events (`detected`, `resolved`, `reappeared`) are logged to `issue_resolution_events`, powering the recurrence intelligence API at `GET /api/intelligence`.

---

## AI analysis pipeline

After a scan completes, two async jobs are enqueued:

1. **`issue_batch` (priority 1)** — groups issues by fingerprint, sends batches to Claude Haiku, writes `ai_summary` / `root_cause` / `fix_suggestion`. Issues with cached pattern templates skip Claude entirely.

2. **`scan_overview` (priority 2)** — generates a 2–3 sentence engineering summary stored in `scans.ai_overview`.

Jobs are drained by `POST /api/ai/worker`, triggered by Vercel Cron every 5 minutes.

---

## Scoring system

| Severity | Deduction | Cap |
|---|---|---|
| Critical | 20 pts/issue | 60 pts |
| Medium | 8 pts/issue | 30 pts |
| Low | 2 pts/issue | 10 pts |

`Score = max(0, 100 − total_deductions)`

**Critical:** page crash, unreachable page, uncaught JS exception (TypeError / ReferenceError / SyntaxError)
**Medium:** 404, console errors, failed XHR/Fetch, broken images, missing alt text, mobile overflow, broken forms
**Low:** load > 5s, 3+ console warnings, assets > 500 KB, missing meta description/OG image/H1

---

## Rate limiting

| Limit | Value | Scope |
|---|---|---|
| Per-IP scan rate | 3 scans/hour | Per client IP |
| Global queue | 20 concurrent scans | All active pending/running scans |
| URL deduplication | 15-minute window | Returns cached result for same URL |
| Feedback endpoint | 10 requests/minute | Per IP, in-process sliding window |

Internal emails (`INTERNAL_EMAILS`) bypass all limits. Beta emails (`BETA_EMAILS`) get 20 scans/hour.

---

## API reference

### `POST /api/scan`
Start a scan. Returns `{ scanId }` (202) or `{ scanId, cached: true }` (200) for dedup window hits.

Body: `{ url: string, email?: string }`

### `GET /api/scan/:id`
Poll scan status. Returns `{ scan, pages, issues, logs, frameworks, history }`. Issues sorted critical → medium → low.

### `POST /api/scan/:id/notify`
Store notification email. Scanner sends report link on completion.

### `POST /api/issues/:id/feedback`
Thumbs up/down on AI fix. Negative feedback flags pattern for re-analysis.

Body: `{ helpful: boolean }`

### `GET /api/intelligence`
Cross-scan failure intelligence summary — recurring patterns, matched signatures, framework breakdown, recurrence metrics.

Query params: `domain?`, `days?` (default 30)

### `POST /api/waitlist`
Join Pro waitlist. Stores to Supabase, notifies via Resend + WhatsApp.

Body: `{ email: string, name?: string, scanId?: string }`

### `POST /api/webhook/scan` *(requires `x-api-key`)*
CI/CD integration — synchronous scan. Returns `200` (passed) or `422` (below threshold).

Body: `{ url: string, failThreshold?: number }` (default threshold: 70)

### `POST /api/ai/worker` *(requires `x-worker-secret` if `WORKER_SECRET` set)*
Drain AI job queue. Called by Vercel Cron every 5 minutes.

---

## Architecture decisions

**Fire-and-forget scanning:** `POST /api/scan` returns `scanId` immediately, uses `waitUntil` to keep the serverless function alive while the scan runs. Frontend polls every 2.5s.

**Async AI queue:** AI runs after the scan completes in a separate job queue. Frontend polls up to 90s post-completion. Vercel Cron is the safety net.

**Signature-first, pattern-second, Claude-last:** Issues flow through three layers before a Claude call — known signature match → fingerprint cache hit → novel issue (Claude). Most repeat issues never touch Claude.

**Regression worker:** Runs post-scan via two idempotent Postgres functions. Lifecycle events power the intelligence API. Never blocks the scan result.

**Fire-and-forget embeddings:** Pattern embeddings are generated async after pattern creation, never block the scan pipeline. Uses `.is('embedding', null)` guard to be race-safe.

**hnsw over ivfflat:** pgvector index uses `hnsw` (works on empty tables) instead of `ivfflat` (requires training data at index creation time).

**Deferred screenshot uploads:** Screenshots collected in memory, uploaded in parallel after crawl. Removes 3–5s of upload latency per page.

**2-minute global timeout:** `AbortController` fires at 120s. Crawler stops cleanly between pages, always returns partial results.

**IP rate limiting without Redis:** Rate check queries `scans` table — no external cache needed for 3 req/hour granularity.

**Node.js runtime everywhere:** Playwright requires Node.js APIs. Edge runtime only for OG image routes.

---

## Deployment

### Vercel (recommended)

1. Push to GitHub (`github.com/Viyalabs/agentqa`)
2. Import at [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.example`
4. Set **Function Region** to your nearest region
5. Run `npm run db:migrate`
6. Deploy

> **Vercel Hobby vs Pro:** Hobby has a 60-second function timeout. Upgrade to Pro for the 300-second timeout needed for reliable full-site scans.

### Running tests

```bash
npm test
# or watch mode:
npm run test:watch
```

---

## License

MIT
