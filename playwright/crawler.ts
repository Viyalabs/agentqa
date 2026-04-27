import { chromium } from 'playwright'
import type { PageTestResult } from '@/types'
import { normalizeUrl, MAX_PAGES_PER_SCAN } from '@/lib/utils'
import { testPage } from './page-tester'

const MAX_PAGES = parseInt(process.env.MAX_PAGES_PER_SCAN ?? String(MAX_PAGES_PER_SCAN), 10)
const MAX_DEPTH = parseInt(process.env.MAX_CRAWL_DEPTH ?? '1', 10)

// Paths that are slow, auth-gated, or cause infinite loops
const SKIP_PATH_PATTERNS = [
  /^\/(admin|account|settings|profile)(\/|$)/i,
  /^\/(logout|signout|sign-out|log-out)(\/|$)/i,
  /^\/(cart|checkout|payment|billing|subscribe)(\/|$)/i,
]

// Tracker/ad/analytics hostnames — blocked at context level
const BLOCKED_DOMAINS = new Set([
  'doubleclick.net', 'google-analytics.com', 'googletagmanager.com',
  'hotjar.com', 'intercom.io', 'crisp.chat', 'clarity.ms',
  'ads.linkedin.com', 'snap.licdn.com', 'platform.twitter.com',
  'cdn.segment.com', 'connect.facebook.net', 'analytics.tiktok.com',
  'bat.bing.com', 'stats.g.doubleclick.net',
])

function shouldSkipUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Skip URLs with very long query strings (infinite scroll / filter pages)
    if (parsed.search.length > 80) return true
    const path = parsed.pathname
    for (const pattern of SKIP_PATH_PATTERNS) {
      if (pattern.test(path)) return true
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

  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--no-zygote', '--single-process',
      '--disable-extensions', '--disable-background-networking',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    ],
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (compatible; AgentQA/1.0; +https://agentqa.dev/bot) Chrome/120',
    ignoreHTTPSErrors: true,
    javaScriptEnabled: true,
  })

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
  const results: PageTestResult[] = []

  try {
    while (queue.length > 0 && visited.size < MAX_PAGES) {
      // Honour global abort signal — stop between pages, not mid-page
      if (options?.signal?.aborted) {
        console.log(`[crawler] Abort signal received — stopping after ${visited.size} pages`)
        break
      }

      const { url: currentUrl, depth } = queue.shift()!
      const normalized = normalizeUrl(currentUrl)

      if (visited.has(normalized)) continue
      if (shouldSkipUrl(normalized)) {
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
          if (!visited.has(link) && !queued.has(link) && !shouldSkipUrl(link)) {
            queued.add(link)
            queue.push({ url: link, depth: depth + 1 })
          }
        }
      }
    }
  } finally {
    log('Closing browser...')
    await browser.close().catch(() => {})
  }

  return results
}
