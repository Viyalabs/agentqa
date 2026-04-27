# AgentQA

**Automated QA for AI-generated web applications.**

Paste a deployed URL. AgentQA launches a real Chromium browser, crawls up to 10 pages, detects failures, captures screenshots, and generates a scored QA report — in under 2 minutes.

---

## What it does

- **Real browser crawling** — Playwright Chromium visits every page (not a headless HTTP client)
- **Multi-page testing** — crawls navbar, footer, CTA links + probes common routes (`/login`, `/signup`, `/dashboard`, etc.)
- **Issue detection** — 404s, JS crashes, console errors, broken images, failed API requests, broken forms, slow loads
- **Screenshots** — full viewport capture for every scanned page
- **QA Score** — 0–100 score with severity-weighted deductions
- **Progressive results** — dashboard updates in real time as pages are scanned

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router, TypeScript, Tailwind CSS |
| UI Components | Shadcn-style Radix UI components |
| Testing Engine | Playwright (real Chromium) |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (screenshots) |
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

## Usage

1. Go to `http://localhost:3000`
2. Enter any deployed URL (e.g. `https://example.com`)
3. Click **Test Your App**
4. Watch the dashboard update in real time
5. Review the QA score, issues, pages, and screenshots

---

## Project structure

```
agentqa/
├── app/
│   ├── page.tsx                  # Homepage
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   └── api/
│       └── scan/
│           ├── route.ts          # POST /api/scan — start a scan
│           └── [id]/
│               └── route.ts      # GET /api/scan/:id — poll results
├── app/scan/[id]/
│   └── page.tsx                  # Results dashboard page
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
│   ├── issue-card.tsx            # Individual issue display
│   └── screenshot-viewer.tsx     # Screenshot grid + lightbox
├── lib/
│   ├── supabase.ts               # Supabase client + storage helpers
│   └── utils.ts                  # URL validation, formatting helpers
├── playwright/
│   ├── crawler.ts                # BFS web crawler, link extraction
│   └── page-tester.ts            # Per-page Playwright test runner
├── services/
│   ├── scanner.ts                # Scan orchestrator (DB writes, issue classification)
│   └── scorer.ts                 # QA score calculation
├── types/
│   └── index.ts                  # All TypeScript types
├── database/
│   └── schema.sql                # Supabase table definitions + RLS policies
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
- Uncaught TypeError / ReferenceError / SyntaxError

**Medium**
- Console errors (non-crash)
- Failed XHR/fetch API requests
- Broken images (naturalWidth === 0)
- Forms without submit buttons
- Failed script/stylesheet loads

**Low**
- Page load time > 5 seconds
- More than 3 console warnings

---

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables (same as `.env.local`)
4. Deploy

> **Important:** Playwright requires Chromium binaries. Vercel serverless functions support this via the `playwright` npm package with bundled Chromium. For scans longer than Vercel's function timeout (60s on Hobby, 300s on Pro), consider running the scanner as a separate long-running process.

### Running a standalone scan worker

For production environments where serverless timeouts are a concern:

```bash
# Set up environment variables first, then:
node scripts/run-scan.js <scanId> <url>
```

The API route creates the scan record and the worker picks it up — you can decouple these however your infrastructure requires.

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

### Why Supabase Storage for screenshots?
Base64-encoding screenshots in the DB column works but inflates the DB size quickly (each PNG is 200–500 KB). Supabase Storage keeps the DB lean and serves images via a CDN.

### Why not Edge runtime?
Playwright requires Node.js APIs (child processes, file system). Edge runtime is incompatible. All API routes use `export const runtime = 'nodejs'`.

---

## License

MIT
