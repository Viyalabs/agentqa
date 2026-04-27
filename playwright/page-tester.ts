import type { BrowserContext } from 'playwright'
import type { PageTestResult, NetworkRequest } from '@/types'
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

// Resource types tracked for the network debugging tab
const TRACKED_RESOURCE_TYPES = new Set(['xhr', 'fetch', 'script', 'stylesheet'])

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

  // Capture video handle before any page operations so we can read path after close
  const videoHandle = page.video()

  const consoleErrors: Array<{ level: string; message: string }> = []
  const consoleWarnings: Array<{ level: string; message: string }> = []
  const jsErrors: Array<{ message: string; stackTrace: string | null; timestamp: number }> = []
  const networkRequests: NetworkRequest[] = []
  const requestStartTimes = new Map<string, number>()

  let statusCode: number | null = null
  let screenshot: Buffer | null = null
  let mobileScreenshot: Buffer | null = null
  let hasMobileLayoutIssues = false
  let error: string | null = null
  let loadTimeMs = 0
  let title = ''
  let failedImages: string[] = []
  let forms: PageTestResult['forms'] = []
  let links: string[] = []
  let isCrash = false
  let isUnreachable = false
  let is404 = false
  let isCrossOriginRedirect = false

  // ── Event listeners ─────────────────────────────────────────────────────────

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

  // Uncaught JS exceptions — always include stack traces
  page.on('pageerror', (err) => {
    jsErrors.push({
      message: err.message,
      stackTrace: err.stack ?? null,
      timestamp: Date.now(),
    })
  })

  page.on('crash', () => { isCrash = true })

  // Track request start times for response timing
  page.on('request', (request) => {
    if (
      TRACKED_RESOURCE_TYPES.has(request.resourceType()) &&
      !isThirdParty(request.url(), pageOrigin)
    ) {
      requestStartTimes.set(request.url(), Date.now())
    }
  })

  // Successful responses — capture timing and size for network debugging tab
  page.on('response', (response) => {
    const request = response.request()
    const reqUrl = request.url()
    const resourceType = request.resourceType()
    if (!TRACKED_RESOURCE_TYPES.has(resourceType)) return
    if (isThirdParty(reqUrl, pageOrigin)) return
    if (networkRequests.length >= 60) return // guard against runaway pages

    const startTime = requestStartTimes.get(reqUrl)
    const responseTimeMs = startTime ? Date.now() - startTime : 0
    const cl = response.headers()['content-length']
    const responseSizeBytes = cl ? parseInt(cl, 10) : null

    networkRequests.push({
      url: reqUrl,
      method: request.method(),
      resourceType,
      statusCode: response.status(),
      responseTimeMs,
      responseSizeBytes,
      failed: false,
      errorText: null,
    })
  })

  // Failed requests — all same-origin failures regardless of resource type
  page.on('requestfailed', (request) => {
    const reqUrl = request.url()
    if (isThirdParty(reqUrl, pageOrigin)) return
    networkRequests.push({
      url: reqUrl,
      method: request.method(),
      resourceType: request.resourceType(),
      statusCode: null,
      responseTimeMs: 0,
      responseSizeBytes: null,
      failed: true,
      errorText: request.failure()?.errorText ?? null,
    })
  })

  // ── Page navigation ──────────────────────────────────────────────────────────

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

      // Cross-origin redirect: record status but skip all further extraction
      const finalUrl = response.url()
      try {
        const finalOrigin = new URL(finalUrl).origin
        if (finalOrigin !== pageOrigin) {
          isCrossOriginRedirect = true
          title = await page.title().catch(() => '')
          screenshot = await page
            .screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1280, height: 800 } })
            .catch(() => null)
        }
      } catch {
        // ignore URL parse error
      }
    }

    if (!isCrossOriginRedirect) {
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

      // Mobile responsiveness check — resize the already-loaded page, no second navigation
      if (statusCode === 200 && !isCrash) {
        try {
          await page.setViewportSize({ width: 375, height: 812 })
          // Let layout reflow
          await page.evaluate(() => new Promise<void>((r) => setTimeout(r, 300)))
          hasMobileLayoutIssues = await page
            .evaluate(
              () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 5
            )
            .catch(() => false)
          mobileScreenshot = await page
            .screenshot({ type: 'png', clip: { x: 0, y: 0, width: 375, height: 812 } })
            .catch(() => null)
        } catch {
          // mobile check is best-effort
        }
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)

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

  // Video is only finalised after page.close()
  const videoPath = videoHandle ? await videoHandle.path().catch(() => null) : null

  return {
    url,
    statusCode,
    loadTimeMs,
    title,
    consoleErrors,
    consoleWarnings,
    jsErrors,
    networkRequests,
    failedImages,
    forms,
    links,
    screenshot,
    mobileScreenshot,
    hasMobileLayoutIssues,
    videoPath,
    error,
    isCrash,
    isUnreachable,
    is404,
  }
}
