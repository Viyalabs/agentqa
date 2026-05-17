import { chromium } from 'playwright'
import type { LaunchOptions } from 'playwright'
import type { PageTestResult, AuthConfig } from '@/types'
import { normalizeUrl, MAX_PAGES_PER_SCAN } from '@/lib/utils'
import { testPage } from './page-tester'

const MAX_PAGES = parseInt(process.env.MAX_PAGES_PER_SCAN ?? String(MAX_PAGES_PER_SCAN), 10)

const BASE_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
  '--disable-gpu', '--no-zygote', '--single-process',
  '--disable-extensions', '--disable-background-networking',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
]

async function getBrowserLaunchOptions(): Promise<LaunchOptions> {
  // On Vercel (production) use @sparticuz/chromium — its binary is bundled inside
  // the npm package and extracted to /tmp at runtime. No download needed.
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    const chromiumLambda = (await import('@sparticuz/chromium')).default
    return {
      args: [...chromiumLambda.args, ...BASE_ARGS],
      executablePath: await chromiumLambda.executablePath(),
      headless: true,
    }
  }
  // Local dev — use Playwright's own managed Chromium
  return {
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    args: BASE_ARGS,
  }
}
const MAX_DEPTH = parseInt(process.env.MAX_CRAWL_DEPTH ?? '1', 10)

// Paths always skipped — session-destructive or payment-sensitive
const SKIP_PATH_ALWAYS = [
  /^\/(logout|signout|sign-out|log-out)(\/|$)/i,
  /^\/(cart|checkout|payment|billing|subscribe)(\/|$)/i,
]

// Paths skipped only for unauthenticated scans (auth-gated by convention)
const SKIP_PATH_UNAUTHED = [
  /^\/(admin|account|settings|profile|dashboard)(\/|$)/i,
]

// Tracker/ad/analytics hostnames — blocked at context level
const BLOCKED_DOMAINS = new Set([
  'doubleclick.net', 'google-analytics.com', 'googletagmanager.com',
  'hotjar.com', 'intercom.io', 'crisp.chat', 'clarity.ms',
  'ads.linkedin.com', 'snap.licdn.com', 'platform.twitter.com',
  'cdn.segment.com', 'connect.facebook.net', 'analytics.tiktok.com',
  'bat.bing.com', 'stats.g.doubleclick.net',
])

function shouldSkipUrl(url: string, hasAuth: boolean): boolean {
  try {
    const parsed = new URL(url)
    // Skip URLs with very long query strings (infinite scroll / filter pages)
    if (parsed.search.length > 80) return true
    const path = parsed.pathname
    for (const pattern of SKIP_PATH_ALWAYS) {
      if (pattern.test(path)) return true
    }
    // With auth injected, crawl otherwise-gated paths
    if (!hasAuth) {
      for (const pattern of SKIP_PATH_UNAUTHED) {
        if (pattern.test(path)) return true
      }
    }
    return false
  } catch {
    return true
  }
}

export interface CrawlProgress {
  scannedUrl: string
  result: PageTestResult
  totalQueued: number
  totalVisited: number
}

export interface CrawlOptions {
  /** AbortSignal from a global scan timeout — crawler stops between pages when aborted. */
  signal?: AbortSignal
  /** Real-time progress messages written to the scan log. */
  onLog?: (message: string) => void | Promise<void>
  /** Auth credentials to inject before the first navigation. */
  auth?: AuthConfig
}

export async function crawlWebsite(
  startUrl: string,
  onProgress?: (progress: CrawlProgress) => Promise<void>,
  options?: CrawlOptions
): Promise<PageTestResult[]> {
  const normalizedStart = normalizeUrl(startUrl)
  let baseOrigin: string
  try {
    baseOrigin = new URL(normalizedStart).origin
  } catch {
    throw new Error(`Invalid start URL: ${startUrl}`)
  }

  const log = (msg: string): void => {
    const p = options?.onLog?.(msg)
    if (p instanceof Promise) p.catch(() => {})
  }

  log('Launching browser...')

  // Declare outside try so the finally block can always close it.
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  const results: PageTestResult[] = []

  const auth    = options?.auth
  const hasAuth = !!(auth?.cookies?.length || auth?.storageState || auth?.headers)

  try {
    browser = await chromium.launch(await getBrowserLaunchOptions())

    // storageState (full Playwright session dump) takes priority — contains cookies + localStorage
    const storageState = auth?.storageState
      ? (JSON.parse(auth.storageState) as NonNullable<Parameters<typeof browser.newContext>[0]>['storageState'])
      : undefined

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (compatible; AgentQA/1.0; +https://agentqa.dev/bot) Chrome/120',
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      ...(storageState ? { storageState } : {}),
    })

    // Inject individual cookies (supplementary to storageState if both present)
    if (auth?.cookies?.length) {
      await context.addCookies(
        auth.cookies.map(c => ({
          name:      c.name,
          value:     c.value,
          domain:    c.domain ?? new URL(normalizedStart).hostname,
          path:      c.path ?? '/',
          secure:    c.secure ?? false,
          httpOnly:  c.httpOnly ?? false,
          sameSite:  c.sameSite ?? 'Lax',
          expires:   c.expires ?? -1,
        }))
      )
    }

    // Inject extra HTTP headers (e.g. Authorization: Bearer token)
    if (auth?.headers && Object.keys(auth.headers).length > 0) {
      await context.setExtraHTTPHeaders(auth.headers)
    }

    if (hasAuth) {
      log(`Auth session injected (${auth!.kind})`)
    }

    // Block fonts, media (video/audio), and known tracker domains.
    // Same-origin scripts and stylesheets are always allowed through.
    await context.route('**/*', (route) => {
      const req = route.request()
      const resourceType = req.resourceType()

      if (resourceType === 'font' || resourceType === 'media') {
        return route.abort()
      }

      try {
        const hostname = new URL(req.url()).hostname
        if (BLOCKED_DOMAINS.has(hostname)) return route.abort()
      } catch {
        // ignore malformed URLs
      }

      return route.continue()
    })

    const visited = new Set<string>()
    const queued = new Set<string>([normalizedStart])
    const queue: Array<{ url: string; depth: number }> = [{ url: normalizedStart, depth: 0 }]

    while (queue.length > 0 && visited.size < MAX_PAGES) {
      // Honour global abort signal — stop between pages, not mid-page
      if (options?.signal?.aborted) {
        console.log(`[crawler] Abort signal received — stopping after ${visited.size} pages`)
        break
      }

      const { url: currentUrl, depth } = queue.shift()!
      const normalized = normalizeUrl(currentUrl)

      if (visited.has(normalized)) continue
      if (shouldSkipUrl(normalized, hasAuth)) {
        console.log(`[crawler] Skipping: ${normalized}`)
        continue
      }
      visited.add(normalized)

      const pathLabel = normalized.replace(baseOrigin, '') || '/'
      log(`Scanning ${pathLabel === '/' ? 'homepage' : pathLabel}...`)
      console.log(`[crawler] Testing (${visited.size}/${MAX_PAGES}): ${normalized}`)

      const result = await testPage(context, normalized, baseOrigin)
      results.push(result)

      if (onProgress) {
        await onProgress({
          scannedUrl: normalized,
          result,
          totalQueued: queue.length,
          totalVisited: visited.size,
        }).catch(console.error)
      }

      if (depth < MAX_DEPTH && !result.isUnreachable && result.statusCode !== 404) {
        for (const link of result.links) {
          if (!visited.has(link) && !queued.has(link) && !shouldSkipUrl(link, hasAuth)) {
            queued.add(link)
            queue.push({ url: link, depth: depth + 1 })
          }
        }
      }
    }
  } finally {
    log('Closing browser...')
    if (browser) await browser.close().catch(() => {})
  }

  return results
}
