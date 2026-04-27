import { getAdminClient, uploadScreenshot, uploadMobileScreenshot } from '@/lib/supabase'
import { crawlWebsite } from '@/playwright/crawler'
import { calculateScore } from './scorer'
import type { IssueClassified, IssueType, IssueSeverity, PageTestResult } from '@/types'

const SCAN_TIMEOUT_MS = 120_000 // 2 minutes

interface UploadJob {
  pageId: string
  type: 'screenshot' | 'mobile'
  buffer: Buffer
}

export async function runScan(scanId: string, url: string): Promise<void> {
  const db = getAdminClient()

  await db
    .from('scans')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', scanId)

  const log = async (message: string): Promise<void> => {
    console.log(`[scanner:${scanId}] ${message}`)
    try {
      await db.from('scan_logs').insert({ scan_id: scanId, message })
    } catch {
      // scan_logs table may not exist yet — skip gracefully
    }
  }

  const controller = new AbortController()
  const globalTimer = setTimeout(() => {
    console.warn(`[scanner:${scanId}] 2-minute timeout — stopping crawl`)
    controller.abort()
  }, SCAN_TIMEOUT_MS)

  const uploadJobs: UploadJob[] = []
  const allIssues: IssueClassified[] = []
  let totalPages = 0

  try {
    await crawlWebsite(
      url,
      async ({ result }) => {
        // Respect abort signal — don't process results after timeout
        if (controller.signal.aborted) return

        totalPages++
        const failedRequests = result.networkRequests.filter((r) => r.failed)

        const { data: pageRow, error: pageErr } = await db
          .from('scanned_pages')
          .insert({
            scan_id: scanId,
            url: result.url,
            status_code: result.statusCode,
            load_time_ms: result.loadTimeMs,
            title: result.title || null,
            has_console_errors: result.consoleErrors.length > 0 || result.jsErrors.length > 0,
            has_network_failures: failedRequests.length > 0,
            has_mobile_issues: result.hasMobileLayoutIssues,
            network_details: result.networkRequests.length > 0 ? result.networkRequests : null,
          })
          .select('id')
          .single()

        if (pageErr || !pageRow) {
          console.error('[scanner] Failed to insert page:', pageErr?.message)
          return
        }

        const pageId: string = pageRow.id

        // Queue screenshots for deferred upload — keeps crawl fast
        if (result.screenshot) {
          uploadJobs.push({ pageId, type: 'screenshot', buffer: result.screenshot })
        }
        if (result.mobileScreenshot) {
          uploadJobs.push({ pageId, type: 'mobile', buffer: result.mobileScreenshot })
        }

        // Fast DB writes: logs and issues
        const logs = [
          ...result.consoleErrors.map((e) => ({
            page_id: pageId,
            level: 'error' as const,
            message: e.message,
            stack_trace: null as string | null,
          })),
          ...result.consoleWarnings.map((w) => ({
            page_id: pageId,
            level: 'warning' as const,
            message: w.message,
            stack_trace: null as string | null,
          })),
          ...result.jsErrors.map((e) => ({
            page_id: pageId,
            level: 'error' as const,
            message: e.message,
            stack_trace: e.stackTrace,
          })),
        ]
        if (logs.length > 0) await db.from('page_logs').insert(logs)

        const pageIssues = classifyPageIssues(result, scanId, pageId)
        allIssues.push(...pageIssues)
        if (pageIssues.length > 0) await db.from('issues').insert(pageIssues)

        await db
          .from('scans')
          .update({ total_pages: totalPages, total_issues: allIssues.length })
          .eq('id', scanId)

        console.log(
          `[scanner:${scanId}] page: ${result.url} | ${result.loadTimeMs}ms | ${pageIssues.length} issues`
        )
      },
      { signal: controller.signal, onLog: log }
    )

    // Upload all screenshots in parallel after crawl — doesn't block page testing
    if (uploadJobs.length > 0) {
      await log(`Uploading ${uploadJobs.length} screenshot(s)...`)
      const uploadResults = await Promise.allSettled(
        uploadJobs.map(async (job) => {
          const uploadedUrl =
            job.type === 'screenshot'
              ? await uploadScreenshot(scanId, job.pageId, job.buffer)
              : await uploadMobileScreenshot(scanId, job.pageId, job.buffer)

          if (uploadedUrl) {
            const field = job.type === 'screenshot' ? 'screenshot_url' : 'mobile_screenshot_url'
            await db.from('scanned_pages').update({ [field]: uploadedUrl }).eq('id', job.pageId)
          }
        })
      )

      const failed = uploadResults.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        console.error(`[scanner:${scanId}] ${failed.length} screenshot upload(s) failed`)
      }
    }

    const { score } = calculateScore(allIssues)
    const timedOut = controller.signal.aborted

    await db
      .from('scans')
      .update({
        status: 'completed',
        score,
        total_pages: totalPages,
        total_issues: allIssues.length,
        completed_at: new Date().toISOString(),
        ...(timedOut
          ? { error_message: 'Scan reached the 2-minute time limit — results shown are partial.' }
          : { error_message: null }),
      })
      .eq('id', scanId)

    await log(
      timedOut
        ? `Partial scan complete (time limit reached). ${totalPages} pages · ${allIssues.length} issues · score: ${score}/100`
        : `Scan complete. Score: ${score}/100 · ${totalPages} pages · ${allIssues.length} issues`
    )

    console.log(
      `[scanner] ${scanId} done — score:${score} pages:${totalPages} issues:${allIssues.length}${timedOut ? ' [PARTIAL]' : ''}`
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[scanner] ${scanId} failed:`, message)

    await log(`Scan failed: ${categoriseError(message)}`).catch(() => {})

    await db
      .from('scans')
      .update({
        status: 'failed',
        error_message: categoriseError(message),
        completed_at: new Date().toISOString(),
      })
      .eq('id', scanId)
  } finally {
    clearTimeout(globalTimer)
  }
}

function categoriseError(raw: string): string {
  if (/timeout/i.test(raw)) {
    return 'The site took too long to respond. It may be slow, unreachable, or protected by a CAPTCHA.'
  }
  if (/captcha|bot.?protection|cloudflare|challenge/i.test(raw)) {
    return 'The site uses bot protection (e.g. Cloudflare) that blocked the scan.'
  }
  if (/ECONNREFUSED|ENOTFOUND|ERR_NAME_NOT_RESOLVED/i.test(raw)) {
    return 'Could not connect to the site. Check that the URL is correct and publicly accessible.'
  }
  if (/403|Forbidden/i.test(raw)) {
    return 'The site returned 403 Forbidden. It may require authentication or block automated access.'
  }
  if (/net::ERR_/i.test(raw)) {
    return 'A network-level error occurred. The site may be down or blocking automated requests.'
  }
  return raw
}

function classifyPageIssues(
  result: PageTestResult,
  scanId: string,
  pageId: string
): IssueClassified[] {
  const issues: IssueClassified[] = []

  const issue = (
    type: IssueType,
    severity: IssueSeverity,
    title: string,
    description: string,
    details?: Record<string, unknown>
  ): IssueClassified => ({
    scan_id: scanId,
    page_id: pageId,
    type,
    severity,
    title,
    description,
    details: details ?? null,
  })

  // ── Critical ─────────────────────────────────────────────────────────────────

  if (result.isUnreachable) {
    const friendly = categoriseError(result.error ?? '')
    issues.push(
      issue('page_crash', 'critical', 'Page Unreachable', friendly, {
        url: result.url,
        error: result.error,
      })
    )
    return issues
  }

  if (result.isCrash) {
    issues.push(
      issue(
        'page_crash',
        'critical',
        `Server Error (${result.statusCode})`,
        `The server returned a ${result.statusCode} error for ${result.url}.`,
        { url: result.url, statusCode: result.statusCode }
      )
    )
  }

  if (result.is404) {
    issues.push(
      issue(
        'page_not_found',
        'critical',
        '404 – Page Not Found',
        `The page at ${result.url} returned a 404 status code.`,
        { url: result.url, statusCode: result.statusCode }
      )
    )
  }

  if (result.jsErrors.length > 0) {
    issues.push(
      issue(
        'js_error',
        'critical',
        'Uncaught JavaScript Error',
        `${result.jsErrors.length} uncaught JS exception(s) detected on page load.`,
        {
          url: result.url,
          errors: result.jsErrors.slice(0, 5).map((e) => e.message),
          stacks: result.jsErrors.slice(0, 5).map((e) => e.stackTrace).filter(Boolean),
        }
      )
    )
  } else {
    const criticalConsoleErrors = result.consoleErrors.filter((e) =>
      /TypeError|ReferenceError|SyntaxError|Uncaught/.test(e.message)
    )
    if (criticalConsoleErrors.length > 0) {
      issues.push(
        issue(
          'js_error',
          'critical',
          'Uncaught JavaScript Error',
          `${criticalConsoleErrors.length} uncaught JS error(s) detected on page load.`,
          { url: result.url, errors: criticalConsoleErrors.slice(0, 5).map((e) => e.message) }
        )
      )
    }
  }

  // ── Medium ───────────────────────────────────────────────────────────────────

  const nonCriticalErrors = result.consoleErrors.filter(
    (e) => !/TypeError|ReferenceError|SyntaxError|Uncaught/.test(e.message)
  )
  if (nonCriticalErrors.length > 0) {
    issues.push(
      issue(
        'console_error',
        'medium',
        'Console Errors Detected',
        `${nonCriticalErrors.length} console error(s) logged during page load.`,
        { url: result.url, errors: nonCriticalErrors.slice(0, 5).map((e) => e.message) }
      )
    )
  }

  const failedRequests = result.networkRequests.filter((r) => r.failed)

  const apiFailures = failedRequests.filter(
    (f) => f.resourceType === 'xhr' || f.resourceType === 'fetch'
  )
  if (apiFailures.length > 0) {
    issues.push(
      issue(
        'network_failure',
        'medium',
        'Failed API Requests',
        `${apiFailures.length} network request(s) failed during page load.`,
        {
          url: result.url,
          failures: apiFailures.slice(0, 5).map((f) => ({
            url: f.url,
            method: f.method,
            error: f.errorText,
          })),
        }
      )
    )
  }

  if (result.failedImages.length > 0) {
    issues.push(
      issue(
        'missing_image',
        'medium',
        'Broken Images',
        `${result.failedImages.length} image(s) failed to load.`,
        { url: result.url, images: result.failedImages.slice(0, 5) }
      )
    )
  }

  const brokenForms = result.forms.filter((f) => !f.hasSubmitButton)
  if (brokenForms.length > 0) {
    issues.push(
      issue(
        'broken_form',
        'medium',
        'Form Missing Submit Button',
        `${brokenForms.length} form(s) found without a visible submit button.`,
        { url: result.url, count: brokenForms.length }
      )
    )
  }

  const resourceFailures = failedRequests.filter(
    (f) => f.resourceType === 'script' || f.resourceType === 'stylesheet'
  )
  if (resourceFailures.length > 0) {
    issues.push(
      issue(
        'network_failure',
        'medium',
        'Failed Static Assets',
        `${resourceFailures.length} script/stylesheet(s) failed to load.`,
        { url: result.url, failures: resourceFailures.slice(0, 5).map((f) => f.url) }
      )
    )
  }

  if (result.hasMobileLayoutIssues) {
    issues.push(
      issue(
        'mobile_layout',
        'medium',
        'Mobile Layout Overflow',
        'Content overflows the viewport horizontally on mobile (375 px). Users on phones may need to scroll sideways.',
        { url: result.url }
      )
    )
  }

  // ── Low ──────────────────────────────────────────────────────────────────────

  if (result.loadTimeMs > 5000 && !result.is404) {
    issues.push(
      issue(
        'slow_load',
        'low',
        'Slow Page Load',
        `Page took ${(result.loadTimeMs / 1000).toFixed(1)}s to load (threshold: 5s).`,
        { url: result.url, loadTimeMs: result.loadTimeMs }
      )
    )
  }

  if (result.consoleWarnings.length > 3) {
    issues.push(
      issue(
        'console_warning',
        'low',
        'Multiple Console Warnings',
        `${result.consoleWarnings.length} console warning(s) logged.`,
        { url: result.url, warnings: result.consoleWarnings.slice(0, 3).map((w) => w.message) }
      )
    )
  }

  const largeAssets = result.networkRequests.filter(
    (r) =>
      !r.failed &&
      (r.resourceType === 'script' || r.resourceType === 'stylesheet') &&
      r.responseSizeBytes !== null &&
      r.responseSizeBytes > 512_000
  )
  if (largeAssets.length > 0) {
    const totalKb = largeAssets.reduce((s, r) => s + (r.responseSizeBytes ?? 0), 0) / 1024
    issues.push(
      issue(
        'large_asset',
        'low',
        'Large JS/CSS Assets',
        `${largeAssets.length} asset(s) exceed 500 KB (${totalKb.toFixed(0)} KB total). Consider code splitting or compression.`,
        {
          url: result.url,
          assets: largeAssets.slice(0, 5).map((r) => ({
            url: r.url,
            sizeKb: Math.round((r.responseSizeBytes ?? 0) / 1024),
          })),
        }
      )
    )
  }

  return issues
}
