import { chromium } from 'playwright'
import type { PageTestResult } from '@/types'
import { normalizeUrl, MAX_PAGES_PER_SCAN } from '@/lib/utils'
import { testPage } from './page-tester'

const MAX_PAGES = parseInt(process.env.MAX_PAGES_PER_SCAN ?? String(MAX_PAGES_PER_SCAN), 10)
const MAX_DEPTH = 2

const COMMON_ROUTES = [
  '/login', '/signin', '/signup', '/register',
  '/dashboard', '/pricing', '/contact', '/about',
  '/help', '/faq', '/terms', '/privacy',
]

export interface CrawlProgress {
  scannedUrl: string
  result: PageTestResult
  totalQueued: number
  totalVisited: number
}

export async function crawlWebsite(
  startUrl: string,
  onProgress?: (progress: CrawlProgress) => Promise<void>
): Promise<PageTestResult[]> {
  const normalizedStart = normalizeUrl(startUrl)
  let baseOrigin: string

  try {
    baseOrigin = new URL(normalizedStart).origin
  } catch {
    throw new Error(`Invalid start URL: ${startUrl}`)
  }

  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (compatible; AgentQA/1.0; +https://agentqa.dev/bot) Chrome/120',
    ignoreHTTPSErrors: true,
    javaScriptEnabled: true,
  })

  const visited = new Set<string>()
  const queued = new Set<string>([normalizedStart])
  const queue: Array<{ url: string; depth: number }> = [{ url: normalizedStart, depth: 0 }]
  const results: PageTestResult[] = []

  try {
    // Phase 1: BFS crawl from the start URL
    while (queue.length > 0 && visited.size < MAX_PAGES) {
      const { url: currentUrl, depth } = queue.shift()!
      const normalized = normalizeUrl(currentUrl)

      if (visited.has(normalized)) continue
      visited.add(normalized)

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

      // Enqueue links discovered during page test (no second page load needed)
      if (depth < MAX_DEPTH && !result.isUnreachable && result.statusCode !== 404) {
        for (const link of result.links) {
          if (!visited.has(link) && !queued.has(link)) {
            queued.add(link)
            queue.push({ url: link, depth: depth + 1 })
          }
        }
      }
    }

    // Phase 2: Probe common routes not yet visited
    for (const route of COMMON_ROUTES) {
      if (visited.size >= MAX_PAGES) break

      const candidateUrl = normalizeUrl(`${baseOrigin}${route}`)
      if (visited.has(candidateUrl) || queued.has(candidateUrl)) continue

      visited.add(candidateUrl)
      console.log(`[crawler] Probing common route: ${candidateUrl}`)

      const result = await testPage(context, candidateUrl, baseOrigin)

      if (result.statusCode !== 404 && !result.isUnreachable) {
        results.push(result)
        if (onProgress) {
          await onProgress({
            scannedUrl: candidateUrl,
            result,
            totalQueued: 0,
            totalVisited: visited.size,
          }).catch(console.error)
        }
      }
    }
  } finally {
    await browser.close().catch(() => {})
  }

  return results
}
