import type { BrowserContext } from 'playwright'
import type { PageTestResult } from '@/types'
import { normalizeUrl } from '@/lib/utils'

const PAGE_TIMEOUT_MS = parseInt(process.env.PLAYWRIGHT_TIMEOUT_MS ?? '30000', 10)

const IGNORED_FAILURE_ORIGINS = new Set([
  'youtube.com', 'www.youtube.com', 'youtu.be',
  'doubleclick.net', 'googletagmanager.com',
  'google-analytics.com', 'analytics.google.com',
  'facebook.com', 'connect.facebook.net',
  'hotjar.com', 'intercom.io', 'crisp.chat', 'clarity.ms',
  'ads.linkedin.com', 'snap.licdn.com',
  'twitter.com', 'platform.twitter.com',
  'cdn.segment.com',
])

const SKIP_EXTENSIONS = new Set([
  'pdf', 'zip', 'png', 'jpg', 'jpeg', 'svg', 'ico',
  'xml', 'json', 'woff', 'woff2', 'ttf', 'mp4', 'webm',
])

function isThirdParty(url: string, pageOrigin: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'chrome-extension:') return true
    if (IGNORED_FAILURE_ORIGINS.has(parsed.hostname)) return true
    return parsed.origin !== pageOrigin
  } catch {
    return true
  }
}

export async function testPage(
  context: BrowserContext,
  url: string,
  baseOrigin: string
): Promise<PageTestResult> {
  const pageOrigin = new URL(url).origin
  const page = await context.newPage()

  const consoleErrors: Array<{ level: string; message: string }> = []
  const consoleWarnings: Array<{ level: string; message: string }> = []
  const networkFailures: Array<{
    url: string
    status: number | null
    method: string
    resourceType: string
  }> = []

  let statusCode: number | null = null
  let screenshot: Buffer | null = null
  let error: string | null = null
  let loadTimeMs = 0
  let title = ''
  let failedImages: string[] = []
  let forms: PageTestResult['forms'] = []
  let links: string[] = []
  let isCrash = false
  let isUnreachable = false
  let is404 = false

  page.on('console', (msg) => {
    const type = msg.type()
    const text = msg.text()

    if (
      text.includes('Download the React DevTools') ||
      text.includes('[HMR]') ||
      text.includes('Deprecation') ||
      text.includes('was preloaded using link preload but not used')
    ) return

    const msgUrl = msg.location().url
    if (msgUrl && isThirdParty(msgUrl, pageOrigin)) return

    if (type === 'error') {
      consoleErrors.push({ level: 'error', message: text })
    } else if (type === 'warning') {
      consoleWarnings.push({ level: 'warning', message: text })
    }
  })

  page.on('crash', () => { isCrash = true })

  page.on('requestfailed', (request) => {
    const reqUrl = request.url()
    if (isThirdParty(reqUrl, pageOrigin)) return
    networkFailures.push({
      url: reqUrl,
      status: null,
      method: request.method(),
      resourceType: request.resourceType(),
    })
  })

  try {
    const startTime = Date.now()
    const response = await page.goto(url, {
      timeout: PAGE_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    })

    try {
      await page.waitForLoadState('networkidle', { timeout: 5000 })
    } catch {
      // networkidle timeout is acceptable
    }

    loadTimeMs = Date.now() - startTime

    if (response) {
      statusCode = response.status()
      // If the page redirected to a different origin, treat it as unreachable for crawl purposes
      const finalUrl = response.url()
      try {
        const finalOrigin = new URL(finalUrl).origin
        if (finalOrigin !== pageOrigin) {
          // Cross-origin redirect: record status but skip link extraction
          return {
            url,
            statusCode,
            loadTimeMs,
            title: await page.title().catch(() => ''),
            consoleErrors,
            consoleWarnings,
            networkFailures,
            failedImages: [],
            forms: [],
            links: [],
            screenshot: await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1280, height: 800 } }).catch(() => null),
            error: null,
            isCrash: false,
            isUnreachable: false,
            is404: false,
          }
        }
      } catch {
        // ignore parse error on finalUrl
      }
    }

    is404 = statusCode === 404
    isCrash = statusCode !== null && statusCode >= 500

    title = await page.title().catch(() => '')

    screenshot = await page
      .screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1280, height: 800 } })
      .catch(() => null)

    failedImages = await page
      .evaluate(() =>
        Array.from(document.querySelectorAll('img'))
          .filter((img) => img.src?.startsWith('http') && img.complete && img.naturalWidth === 0)
          .map((img) => img.src)
      )
      .catch(() => [])

    forms = await page
      .evaluate(() =>
        Array.from(document.querySelectorAll('form')).map((form) => ({
          action: form.action || null,
          method: form.method || 'get',
          hasSubmitButton: !!(
            form.querySelector('button[type="submit"]') ??
            form.querySelector('input[type="submit"]') ??
            form.querySelector('button:not([type])')
          ),
        }))
      )
      .catch(() => [])

    // Extract same-origin links while the page is already loaded (isUnreachable is only set in catch)
    if (!is404) {
      const hrefs = await page
        .evaluate(() =>
          Array.from(document.querySelectorAll('a[href]'))
            .map((a) => (a as HTMLAnchorElement).href)
            .filter((href) => href && href.startsWith('http'))
        )
        .catch(() => [] as string[])

      const seen = new Set<string>()
      for (const href of hrefs) {
        try {
          const parsed = new URL(href)
          if (parsed.origin !== baseOrigin) continue
          if (parsed.pathname === '/' && parsed.hash) continue
          const ext = parsed.pathname.split('.').pop()?.toLowerCase()
          if (ext && SKIP_EXTENSIONS.has(ext)) continue
          const normalized = normalizeUrl(parsed.origin + parsed.pathname)
          if (!seen.has(normalized)) {
            seen.add(normalized)
            links.push(normalized)
          }
        } catch {
          // ignore malformed hrefs
        }
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)

    // Network-level failure: DNS, connection refused, timeout — page never loaded
    isUnreachable =
      error.includes('net::ERR_') ||
      error.includes('ECONNREFUSED') ||
      error.includes('ENOTFOUND') ||
      error.includes('ERR_NAME_NOT_RESOLVED') ||
      error.includes('Timeout')

    try {
      screenshot = await page.screenshot({ type: 'png' })
    } catch {
      // ignore
    }
  } finally {
    await page.close().catch(() => {})
  }

  return {
    url,
    statusCode,
    loadTimeMs,
    title,
    consoleErrors,
    consoleWarnings,
    networkFailures,
    failedImages,
    forms,
    links,
    screenshot,
    error,
    isCrash,
    isUnreachable,
    is404,
  }
}
