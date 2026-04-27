# AgentQA

**Automated QA for AI-generated web applications.**

Paste a deployed URL. AgentQA launches a real Chrome browser, crawls up to 5 pages, detects failures, captures screenshots, and delivers a scored QA report — in under 2 minutes.

A product by [Viyalabs](https://viyalabs.com) · [support@viyalabs.com](mailto:support@viyalabs.com)

---

## What it does

- **Real browser crawling** — Playwright Chromium visits every page (not a headless HTTP client)
- **Multi-page testing** — BFS crawl up to 5 pages, depth 1, skipping admin/auth/cart routes automatically
- **Resource blocking** — fonts, media, and 14 tracker/ad/analytics domains blocked per page for faster scans
- **Issue detection** — 404s, JS crashes, console errors, broken images, failed API requests, broken forms, slow loads, mobile layout overflow, large assets
- **Screenshots** — full desktop (1280×800) and mobile (375×812) captures for every scanned page
- **Network debugging** — captures XHR/Fetch/script/stylesheet requests with status codes, response times, and sizes
- **JS error stacks** — uncaught exceptions captured via `pageerror` with full stack traces
- **Mobile responsiveness** — detects horizontal overflow at 375 px viewport after every page load
- **QA Score** — 0–100 score with severity-weighted deductions
- **Real-time scan log** — live terminal feed in dashboard showing exactly what the scanner is doing
- **Progressive results** — dashboard updates every 2.5 s as pages are scanned
- **Issue grouping** — repeated issues collapsed to "Broken images on 4 pages" instead of 20 duplicate cards
- **Shareable reports** — every scan gets a permanent public URL at `/report/{id}`
- **Rescan** — one-click rescan from the results dashboard
- **Notifications** — email + WhatsApp alert to support on every scan start and waitlist signup

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router, TypeScript, Tailwind CSS |
| UI Components | Shadcn-style Radix UI components |
| Testing Engine | Playwright (real Chromium) |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (screenshots, mobile screenshots) |
| Email | Resend API |
| Deployment | Vercel |

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

---

## Local setup

### 1. Clone and install

```bash
git clone <your-repo>
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
2. Go to **SQL Editor** and run the contents of `database/schema.sql`
3. Go to **Storage → New bucket** → name it `screenshots`, set to **Public**

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional — enables email notifications on scan + waitlist signup
RESEND_API_KEY=re_your_api_key_here

# Optional — enables WhatsApp notifications via CallMeBot
CALLMEBOT_API_KEY=your_callmebot_api_key_here
```

Get Supabase values from: **Settings → API**.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Migrating an existing database

If you already have the schema from an earlier release, run these in your Supabase SQL Editor:

```sql
-- Phase 1 columns
ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS has_mobile_issues BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS mobile_screenshot_url TEXT;
ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS network_details JSONB;
ALTER TABLE page_logs ADD COLUMN IF NOT EXISTS stack_trace TEXT;

-- Waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only on waitlist" ON waitlist FOR ALL USING (false);

-- Scan logs table (real-time dashboard feed)
CREATE TABLE IF NOT EXISTS scan_logs (
  id BIGSERIAL PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scan_logs_scan_id ON scan_logs(scan_id);
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to scan_logs" ON scan_logs FOR ALL USING (true);
```

---

## Usage

1. Go to `http://localhost:3000`
2. Enter any deployed URL (e.g. `https://example.com`)
3. Click **Test Your App**
4. Watch the live log terminal and dashboard update in real time
5. Review the QA score, issues, network requests, and screenshots

---

## Project structure

```
agentqa/
├── app/
│   ├── page.tsx                  # Homepage
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   ├── api/
│   │   ├── scan/
│   │   │   ├── route.ts          # POST /api/scan — start a scan
│   │   │   └── [id]/
│   │   │       └── route.ts      # GET /api/scan/:id — poll results + logs
│   │   └── waitlist/
│   │       └── route.ts          # POST /api/waitlist — Pro waitlist signup
│   ├── scan/[id]/
│   │   └── page.tsx              # Results dashboard page
│   └── report/[id]/
│       └── page.tsx              # Shareable public report URL
├── components/
│   ├── ui/                       # Primitive UI components
│   ├── hero.tsx                  # Homepage hero + scan form
│   ├── how-it-works.tsx          # 3-step explainer
│   ├── features.tsx              # Features grid (8 cards)
│   ├── pricing.tsx               # Pricing section + waitlist form
│   ├── footer.tsx                # Site footer
│   ├── scan-form.tsx             # URL input form
│   ├── results-dashboard.tsx     # Real-time results view (polls API, scan log terminal)
│   ├── issue-card.tsx            # Individual issue display with stack traces
│   └── screenshot-viewer.tsx     # Screenshot grid + lightbox
├── lib/
│   ├── supabase.ts               # Supabase client + storage helpers
│   └── utils.ts                  # URL validation, formatting, score helpers
├── playwright/
│   ├── crawler.ts                # BFS web crawler — resource blocking, route skipping, abort signal
│   └── page-tester.ts            # Per-page Playwright test runner
├── services/
│   ├── scanner.ts                # Scan orchestrator — 2-min timeout, deferred uploads, logging
│   └── scorer.ts                 # QA score calculation
├── types/
│   └── index.ts                  # All TypeScript types
├── database/
│   └── schema.sql                # Supabase table definitions + RLS policies + migration blocks
└── __tests__/
    ├── url-validation.test.ts    # URL validation unit tests
    ├── scorer.test.ts            # Scoring logic tests
    └── issue-detection.test.ts   # Issue classification tests
```

---

## Running tests

```bash
npm test
# or watch mode:
npm run test:watch
```

---

## Scoring system

| Severity | Deduction per issue | Max deduction |
|---|---|---|
| Critical | 20 points | 60 points |
| Medium | 8 points | 30 points |
| Low | 2 points | 10 points |

**Score = 100 − (critical + medium + low deductions)**. Minimum score is 0.

### Issue types by severity

**Critical**
- Page crash / unreachable
- 404 Not Found
- 5xx Server Error
- Uncaught JS exception (TypeError / ReferenceError / SyntaxError) with stack trace

**Medium**
- Console errors (non-crash)
- Failed XHR/Fetch API requests
- Broken images (`naturalWidth === 0`)
- Forms without submit buttons
- Failed script/stylesheet loads
- Mobile layout overflow (content wider than 375 px viewport)

**Low**
- Page load time > 5 seconds
- More than 3 console warnings
- Large JS/CSS assets (> 500 KB per file)

---

## Results dashboard

| Tab | What it shows |
|---|---|
| **Issues** | All detected issues grouped by type, with severity filter. Expandable stack traces for JS errors. |
| **Network** | Per-page breakdown of XHR, Fetch, script, and stylesheet requests — status, method, response time, size. |
| **Pages** | All crawled pages with status code, load time, and error/network/mobile flags. |
| **Screenshots** | Desktop screenshot grid with click-to-fullscreen lightbox. |

### Header actions
- **Share** — copies `/report/{id}` to clipboard for a permanent public link
- **Export JSON** — downloads the full scan data
- **Rescan** — starts a fresh scan of the same URL

### Scan log terminal
While a scan is running, a live terminal feed shows progress:
```
Launching browser...
Scanning homepage...
Scanning /pricing...
Uploading 4 screenshot(s)...
Scan complete. Score: 87/100 · 3 pages · 2 issues
```

---

## Supabase tables

| Table | Purpose |
|---|---|
| `scans` | One row per scan — URL, status, score, page/issue counts |
| `scanned_pages` | One row per tested page — status code, load time, screenshot URLs |
| `issues` | Every detected issue with type, severity, and details |
| `page_logs` | Console errors/warnings and JS stack traces per page |
| `scan_logs` | Real-time progress messages per scan (shown in dashboard) |
| `waitlist` | Pro plan waitlist signups — email, name, timestamp |

---

## Notifications

When `RESEND_API_KEY` is set, an email is sent to `support@viyalabs.com` for:
- Every URL submitted for scanning (subject: `New scan started: <url>`)
- Every Pro waitlist signup (subject: `New waitlist signup: <email>`)

When `CALLMEBOT_API_KEY` is set, a WhatsApp message is also sent to the configured number.

To get a CallMeBot API key:
1. Add `+34 644 597 145` to WhatsApp contacts as "CallMeBot"
2. Send `I allow callmebot to send me messages` to that number
3. You'll receive your API key in reply — paste it into `CALLMEBOT_API_KEY`

---

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | — | Supabase project URL (required) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Supabase anon key (required) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase service role key (required) |
| `PLAYWRIGHT_HEADLESS` | `true` | Set to `false` to see the browser window |
| `PLAYWRIGHT_TIMEOUT_MS` | `10000` | Per-page navigation timeout in ms |
| `MAX_PAGES_PER_SCAN` | `5` | Max pages to crawl per scan |
| `MAX_CRAWL_DEPTH` | `1` | BFS depth limit from the start URL |
| `RESEND_API_KEY` | — | Resend API key for email notifications |
| `RESEND_FROM_EMAIL` | `AgentQA <noreply@agentqa.dev>` | Sender address (must be verified in Resend) |
| `CALLMEBOT_API_KEY` | — | CallMeBot key for WhatsApp notifications |

---

## Architecture decisions

### Why fire-and-forget scanning?
`POST /api/scan` creates the DB record and immediately returns a `scanId`. The Playwright scan runs asynchronously (`void runScan(...)`) and writes results to Supabase progressively. The frontend polls `GET /api/scan/:id` every 2.5 seconds. This gives a fast initial response, real-time progress, and a clean separation between accepting the request and running the scan.

### Why deferred screenshot uploads?
Screenshots are collected in memory during the crawl and uploaded to Supabase Storage in parallel after all pages are tested. This removes 3–5 s of upload latency from each page's hot path, cutting total scan time significantly.

### Why a 2-minute global timeout?
The `AbortController` fires at 120 s. The crawler checks the signal between pages and stops cleanly. Partial results (all pages scanned so far) are marked `completed` with a warning — the user always gets something back instead of an infinite loading state.

### Why store `network_details` as JSONB?
Each page generates at most ~60 tracked requests. Storing them as a JSONB column on `scanned_pages` avoids an extra join and keeps the API response flat, while still being queryable if needed.

### Why not Edge runtime?
Playwright requires Node.js APIs (child processes, file system). Edge runtime is incompatible. All API routes use `export const runtime = 'nodejs'`.

---

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.example`
4. Deploy

> **Important:** Playwright requires Chromium binaries. On Vercel Hobby (60 s function timeout) large sites may not fully complete — upgrade to Pro (300 s) for reliable scans. The 2-minute global timeout ensures partial results are always returned even if the function limit is hit.

---

## License

MIT
