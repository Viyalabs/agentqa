# AgentQA

**Autonomous AI QA engineer for web apps.**

Paste a deployed URL. AgentQA launches a real Chrome browser, crawls up to 5 pages, detects bugs, captures screenshots, and delivers a scored QA report in under 2 minutes — zero setup, no QA team required.

Built by [Viyalabs](https://viyalabs.com) · [support@viyalabs.com](mailto:support@viyalabs.com) · [qa.viyalabs.com](https://qa.viyalabs.com)

---

## What it does

| Capability | Detail |
|---|---|
| **Real browser crawling** | Playwright Chromium visits every page — not a headless HTTP client |
| **Multi-page BFS crawl** | Up to 5 pages, depth 1, skipping admin/auth/cart routes automatically |
| **Issue detection** | 404s, JS crashes, console errors, broken images, failed API requests, broken forms, slow loads, mobile overflow, large assets |
| **QA Score** | 0–100, severity-weighted (critical −20, medium −8, low −2) |
| **Desktop + mobile screenshots** | Full captures at 1280×800 and 375×812 per page |
| **Network debugging** | XHR/Fetch/script/stylesheet requests — status, timing, size |
| **JS error stacks** | Uncaught exceptions via `page.on('pageerror')` with full stack traces |
| **Real-time scan log** | Live terminal feed in dashboard as scan progresses |
| **Shareable reports** | Permanent public URL at `/report/{id}` with OG preview card |
| **Notify when done** | User submits email while scan runs; scanner emails the report link on completion |
| **CI/CD webhook** | `POST /api/webhook/scan` — runs scan synchronously, returns JSON + HTTP 422 if score < threshold |
| **Scan history** | `/scans` — public feed of 50 most recent completed scans |
| **Vercel Analytics** | Built-in traffic + event tracking via `@vercel/analytics` |
| **Per-IP rate limiting** | 3 scans per IP per hour, 20 concurrent global queue limit, 15-minute dedup window |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router, TypeScript, Tailwind CSS |
| UI | Shadcn-style Radix UI components |
| Testing engine | Playwright (real Chromium) |
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
2. Open **SQL Editor** → run the full contents of `database/schema.sql`
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

# Optional — Resend (email notifications + report emails)
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=onboarding@resend.dev      # use this until domain is verified
RESEND_NOTIFY_EMAIL=your@email.com           # admin notification recipient

# Optional — CI/CD webhook authentication
WEBHOOK_API_KEY=your_secret_key_here         # generate: openssl rand -hex 32

# Optional — WhatsApp notifications via CallMeBot
CALLMEBOT_API_KEY=your_callmebot_api_key
```

> Supabase values: **Settings → API** in your Supabase dashboard.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Database migrations

If upgrading an existing database, run these in your Supabase SQL Editor one at a time:

```sql
-- Phase 1 (mobile, network, video, logs)
ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS has_mobile_issues BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS mobile_screenshot_url TEXT;
ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS network_details JSONB;
ALTER TABLE page_logs ADD COLUMN IF NOT EXISTS stack_trace TEXT;

-- Phase 2 (waitlist)
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only on waitlist" ON waitlist FOR ALL USING (false);

-- Phase 3 (scan logs)
CREATE TABLE IF NOT EXISTS scan_logs (
  id BIGSERIAL PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scan_logs_scan_id ON scan_logs(scan_id);
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to scan_logs" ON scan_logs FOR ALL USING (true);

-- Phase 4 (notify email + IP rate limiting)
ALTER TABLE scans ADD COLUMN IF NOT EXISTS notify_email TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS ip TEXT;
```

---

## CI/CD integration

Automatically QA-gate every deployment. See [qa.viyalabs.com/docs](https://qa.viyalabs.com/docs) for full docs.

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
          curl -f -X POST https://qa.viyalabs.com/api/webhook/scan \
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
  "reportUrl": "https://qa.viyalabs.com/report/uuid",
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
│   ├── layout.tsx                      # Root layout + Vercel Analytics
│   ├── error.tsx                       # Global error boundary
│   ├── not-found.tsx                   # Custom 404 page
│   ├── opengraph-image.tsx             # Homepage OG image (edge)
│   ├── robots.ts                       # robots.txt
│   ├── sitemap.ts                      # sitemap.xml (/, /docs, /scans, /privacy)
│   ├── api/
│   │   ├── scan/
│   │   │   ├── route.ts                # POST /api/scan — start scan (dedup, IP rate limit, queue limit)
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts            # GET /api/scan/:id — poll results + logs
│   │   │   │   └── notify/
│   │   │   │       └── route.ts        # POST /api/scan/:id/notify — store notify email
│   │   │   └── worker/
│   │   │       └── route.ts            # Internal scan worker endpoint
│   │   ├── waitlist/
│   │   │   └── route.ts                # POST /api/waitlist — Pro waitlist + report email
│   │   └── webhook/
│   │       └── scan/
│   │           └── route.ts            # POST /api/webhook/scan — CI/CD integration
│   ├── scan/[id]/
│   │   ├── page.tsx                    # Live scan progress page
│   │   └── error.tsx                   # Scan page error boundary
│   ├── report/[id]/
│   │   ├── page.tsx                    # Shareable public report (noindex)
│   │   ├── opengraph-image.tsx         # Per-report OG image with score card (edge)
│   │   └── error.tsx                   # Report page error boundary
│   ├── scans/
│   │   └── page.tsx                    # /scans — public feed of 50 recent scans
│   ├── docs/
│   │   └── page.tsx                    # /docs — CI/CD API documentation
│   └── privacy/
│       └── page.tsx                    # /privacy — privacy policy
├── components/
│   ├── ui/                             # Primitive UI components (shadcn-style)
│   ├── navbar.tsx                      # Sticky navbar with scroll effect
│   ├── hero.tsx                        # Homepage hero + animated scan terminal
│   ├── problem-narrative.tsx           # Problem section + AI tools grid
│   ├── how-it-works.tsx                # 3-step explainer
│   ├── comparison.tsx                  # Traditional QA vs AgentQA table
│   ├── report-preview.tsx              # Mock report preview
│   ├── demo-scan.tsx                   # Live scan demo buttons (3 sites)
│   ├── features.tsx                    # 8-feature grid
│   ├── future-of-qa.tsx               # Today / Next / Soon roadmap
│   ├── cta-banner.tsx                  # Mid-page CTA
│   ├── pricing.tsx                     # Pricing section + waitlist form
│   ├── footer.tsx                      # Site footer
│   ├── scan-form.tsx                   # URL input form (homepage)
│   ├── results-dashboard.tsx           # Real-time scan dashboard (polls API)
│   ├── notify-when-done.tsx            # Email form shown while scan runs
│   ├── report-email-capture.tsx        # Post-scan email + waitlist capture
│   ├── issue-card.tsx                  # Issue display with stack traces
│   └── screenshot-viewer.tsx          # Screenshot grid + lightbox
├── lib/
│   ├── supabase.ts                     # Supabase clients + storage helpers
│   ├── stats.ts                        # getHomeStats() for homepage live stats
│   └── utils.ts                        # URL validation, formatting, score helpers
├── playwright/
│   ├── crawler.ts                      # BFS web crawler with abort signal + resource blocking
│   └── page-tester.ts                  # Per-page Playwright test runner
├── services/
│   ├── scanner.ts                      # Scan orchestrator — timeout, screenshots, notify email
│   └── scorer.ts                       # QA score calculation
├── types/
│   └── index.ts                        # All TypeScript types (Scan, Issue, ScanStatusResponse…)
├── database/
│   └── schema.sql                      # Full Supabase schema + RLS policies + migration blocks
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
| `NEXT_PUBLIC_APP_URL` | ✅ | `https://qa.viyalabs.com` | Base URL for report/email links |
| `RESEND_API_KEY` | optional | — | Enables all email delivery (report links, notifications) |
| `RESEND_FROM_EMAIL` | optional | `AgentQA <noreply@viyalabs.com>` | Sender address — use `onboarding@resend.dev` until domain verified |
| `RESEND_NOTIFY_EMAIL` | optional | `support@viyalabs.com` | Admin email for waitlist/lead notifications |
| `WEBHOOK_API_KEY` | optional | — | Secret key for CI/CD webhook. Comma-separate for multiple keys. Generate: `openssl rand -hex 32` |
| `CALLMEBOT_API_KEY` | optional | — | WhatsApp notification via CallMeBot |
| `PLAYWRIGHT_HEADLESS` | optional | `true` | Set `false` to see browser window during local dev |
| `PLAYWRIGHT_TIMEOUT_MS` | optional | `10000` | Per-page navigation timeout in ms |
| `MAX_PAGES_PER_SCAN` | optional | `5` | Max pages per scan |
| `MAX_CRAWL_DEPTH` | optional | `1` | BFS depth from start URL |

---

## Supabase tables

| Table | Purpose |
|---|---|
| `scans` | One row per scan — URL, status, score, `notify_email`, `ip`, page/issue counts |
| `scanned_pages` | Per-page data — status code, load time, screenshot URLs, network details |
| `issues` | Every detected issue — type, severity, details JSONB |
| `page_logs` | Console errors/warnings + JS stack traces per page |
| `scan_logs` | Real-time progress messages shown in the dashboard terminal |
| `waitlist` | Pro plan signups — email, name, timestamp |

---

## Scoring system

| Severity | Deduction | Max |
|---|---|---|
| Critical | 20 pts/issue | 60 pts |
| Medium | 8 pts/issue | 30 pts |
| Low | 2 pts/issue | 10 pts |

`Score = max(0, 100 − total_deductions)`

**Critical issues:** page crash, 404, 5xx, uncaught JS exception (TypeError / ReferenceError / SyntaxError)  
**Medium issues:** console errors, failed XHR/Fetch, broken images, forms without submit, failed scripts/stylesheets, mobile layout overflow  
**Low issues:** page load > 5s, 3+ console warnings, assets > 500 KB

---

## Rate limiting

| Limit | Value | Scope |
|---|---|---|
| Per-IP scan rate | 3 scans/hour | Per client IP (`x-forwarded-for`) |
| Global queue | 20 concurrent scans | All active `pending`/`running` scans |
| URL deduplication | 15-minute window | Returns cached result for same URL |

---

## API reference

### `POST /api/scan`
Start a scan. Returns `{ scanId }` (202) or `{ scanId, cached: true }` (200) for recent scans.

### `GET /api/scan/:id`
Poll scan status. Returns `{ scan, pages, issues, logs }`.

### `POST /api/scan/:id/notify`
Store a notification email while scan is running. Scanner emails the report link on completion.

### `POST /api/waitlist`
Join Pro waitlist. Optionally attach a `scanId` to receive the report link by email.

### `POST /api/webhook/scan` *(requires `x-api-key` header)*
CI/CD integration — runs scan synchronously. Returns `200` (passed) or `422` (score below threshold).  
Body: `{ url: string, failThreshold?: number }` (default threshold: 70)

---

## Architecture decisions

**Fire-and-forget scanning:** `POST /api/scan` creates the DB record, returns `scanId` immediately, and uses `waitUntil` to keep the serverless function alive while the scan runs in the background. The frontend polls every 2.5s. Gives a fast initial response and clean separation of concerns.

**Deferred screenshot uploads:** Screenshots are collected in memory during the crawl and uploaded to Supabase Storage in parallel after all pages are tested. Removes 3–5s of upload latency from each page's critical path.

**2-minute global timeout:** `AbortController` fires at 120s. The crawler checks the signal between pages and stops cleanly, always returning partial results — users never see an infinite loading state.

**JSONB for network details:** Each page generates ≤60 tracked requests. Storing as JSONB on `scanned_pages` avoids an extra join and keeps the API response flat.

**Node.js runtime everywhere:** Playwright requires Node.js APIs (child processes, file system). Edge runtime is incompatible. Only the OG image routes use edge runtime.

**IP rate limiting without Redis:** Client IP stored in `scans.ip` at insert time. Rate check queries the `scans` table for recent inserts from the same IP — no external cache needed for 3 req/hour granularity.

---

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import at [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.example`
4. Set **Function Region** to your nearest region
5. Deploy

> **Vercel Hobby vs Pro:** Hobby has a 60-second function timeout. Large sites may not complete a full scan. Upgrade to Vercel Pro for 300-second timeout and reliable results. The 2-minute scan timeout ensures partial results are always returned even if the function limit is reached.

### Running tests

```bash
npm test
# or:
npm run test:watch
```

---

## License

MIT
