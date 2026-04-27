# AgentQA

**Automated QA for AI-generated web applications.**

Paste a deployed URL. AgentQA launches a real Chromium browser, crawls up to 10 pages, detects failures, captures screenshots, and generates a scored QA report — in under 2 minutes.

---

## What it does

- **Real browser crawling** — Playwright Chromium visits every page (not a headless HTTP client)
- **Multi-page testing** — crawls navbar, footer, CTA links + probes common routes (`/login`, `/signup`, `/dashboard`, etc.)
- **Issue detection** — 404s, JS crashes, console errors, broken images, failed API requests, broken forms, slow loads, mobile layout overflow, large assets
- **Screenshots** — full desktop (1280×800) and mobile (375×812) captures for every scanned page
- **Video recording** — Playwright records a WebM replay for every page that has critical or medium issues
- **Network debugging** — captures XHR/Fetch/script/stylesheet requests with status codes, response times, and sizes
- **JS error stacks** — uncaught exceptions captured via `pageerror` with full stack traces
- **Mobile responsiveness** — detects horizontal overflow at 375 px viewport after every page load
- **QA Score** — 0–100 score with severity-weighted deductions
- **Progressive results** — dashboard updates in real time as pages are scanned
- **Issue grouping** — repeated issues collapsed to "Broken images on 4 pages" instead of 20 duplicate cards
- **Shareable reports** — every scan gets a permanent public URL at `/report/{id}`
- **Rescan** — one-click rescan from the results dashboard

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router, TypeScript, Tailwind CSS |
| UI Components | Shadcn-style Radix UI components |
| Testing Engine | Playwright (real Chromium) |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (screenshots, mobile screenshots, videos) |
| Deployment | Vercel (frontend) |

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
3. Go to **Storage** → **New bucket** → name it `screenshots`, set to **Public**

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
```

Get these values from your Supabase project: **Settings → API**.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Migrating an existing database

If you already have the schema from the initial release, run these in your Supabase SQL Editor:

```sql
ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS has_mobile_issues BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS mobile_screenshot_url TEXT;
ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE scanned_pages ADD COLUMN IF NOT EXISTS network_details JSONB;
ALTER TABLE page_logs ADD COLUMN IF NOT EXISTS stack_trace TEXT;
```

---

## Usage

1. Go to `http://localhost:3000`
2. Enter any deployed URL (e.g. `https://example.com`)
3. Click **Test Your App**
4. Watch the dashboard update in real time
5. Review the QA score, issues, network requests, screenshots, and video replays

---

## Project structure

```
agentqa/
├── app/
│   ├── page.tsx                  # Homepage
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   ├── api/
│   │   └── scan/
│   │       ├── route.ts          # POST /api/scan — start a scan
│   │       └── [id]/
│   │           └── route.ts      # GET /api/scan/:id — poll results
│   ├── scan/[id]/
│   │   └── page.tsx              # Results dashboard page
│   └── report/[id]/
│       └── page.tsx              # Shareable public report URL
├── components/
│   ├── ui/                       # Primitive UI components
│   ├── hero.tsx                  # Homepage hero + scan form
│   ├── how-it-works.tsx          # 3-step explainer
│   ├── report-preview.tsx        # Static mock report preview
│   ├── demo-scan.tsx             # One-click demo scan cards
│   ├── features.tsx              # Features grid
│   ├── pricing.tsx               # Pricing section
│   ├── footer.tsx                # Site footer
│   ├── scan-form.tsx             # URL input form
│   ├── results-dashboard.tsx     # Real-time results view (polls API)
│   ├── issue-card.tsx            # Individual issue display with stack traces
│   └── screenshot-viewer.tsx     # Screenshot grid + lightbox
├── lib/
│   ├── supabase.ts               # Supabase client + storage helpers
│   └── utils.ts                  # URL validation, formatting helpers
├── playwright/
│   ├── crawler.ts                # BFS web crawler, link extraction, video recording
│   └── page-tester.ts            # Per-page Playwright test runner
├── services/
│   ├── scanner.ts                # Scan orchestrator (DB writes, issue classification)
│   └── scorer.ts                 # QA score calculation
├── types/
│   └── index.ts                  # All TypeScript types
├── database/
│   └── schema.sql                # Supabase table definitions + RLS policies + migration
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

**Score = 100 − (critical deductions + medium deductions + low deductions)**
Minimum score is 0.

### Issue types by severity

**Critical**
- Page crash / unreachable
- 404 Not Found
- 5xx Server Error
- Uncaught JS exception (TypeError / ReferenceError / SyntaxError) with stack trace

**Medium**
- Console errors (non-crash)
- Failed XHR/Fetch API requests
- Broken images (naturalWidth === 0)
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
| **Network** | Per-page breakdown of XHR, Fetch, script, and stylesheet requests — status, method, response time, size. Failed requests highlighted in red. |
| **Pages** | All crawled pages with status code, load time, error/network/mobile flags, and video replay links. |
| **Screenshots** | Desktop screenshot grid with click-to-fullscreen lightbox. |

### Header actions
- **Share** — copies `/report/{id}` to clipboard for a permanent public link
- **Export JSON** — downloads the full scan data
- **Rescan** — starts a fresh scan of the same URL

---

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables (same as `.env.local`)
4. Deploy

> **Important:** Playwright requires Chromium binaries. Playwright videos and mobile screenshots are written to the system temp directory during a scan and uploaded to Supabase Storage before the function exits. On Vercel Hobby (60s timeout) very large sites may not complete — upgrade to Pro (300s) or run the scanner as a standalone worker.

### Running a standalone scan worker

For production environments where serverless timeouts are a concern:

```bash
# Set up environment variables first, then:
node scripts/run-scan.js <scanId> <url>
```

---

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | — | Supabase project URL (required) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Supabase anon key (required) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase service role key (required) |
| `PLAYWRIGHT_HEADLESS` | `true` | Set to `false` to see the browser |
| `PLAYWRIGHT_TIMEOUT_MS` | `30000` | Per-page navigation timeout |
| `MAX_PAGES_PER_SCAN` | `10` | Max pages to crawl per scan |

---

## Architecture decisions

### Why fire-and-forget scanning?
The POST `/api/scan` endpoint creates the DB record and immediately returns a `scanId`. The Playwright scan runs asynchronously (fire-and-forget via `void runScan(...)`) and writes results to Supabase progressively. The frontend polls `GET /api/scan/:id` every 2.5 seconds. This gives fast initial response, real-time progress, and a clean separation between accepting the request and executing the scan.

### Why Supabase Storage for screenshots and videos?
Storing binaries in the DB inflates it quickly. Supabase Storage keeps the DB lean and serves assets via CDN. Desktop screenshots, mobile screenshots, and WebM video replays all use the same `screenshots` bucket under different path prefixes.

### Why store network_details as JSONB?
Each page generates at most ~60 tracked requests (XHR, Fetch, scripts, stylesheets). Storing them as a JSONB column on `scanned_pages` avoids an extra join and keeps the API response shape flat, while still being queryable if needed later.

### Why not Edge runtime?
Playwright requires Node.js APIs (child processes, file system). Edge runtime is incompatible. All API routes use `export const runtime = 'nodejs'`.

---

## License

MIT
