import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { getAdminClient, uploadScreenshot, uploadMobileScreenshot, uploadVideo } from '@/lib/supabase'
import { crawlWebsite } from '@/playwright/crawler'
import { calculateScore } from './scorer'
import type { IssueClassified, IssueType, IssueSeverity, PageTestResult } from '@/types'

export async function runScan(scanId: string, url: string): Promise<void> {
  const db = getAdminClient()

  await db
    .from('scans')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', scanId)

  // Create a temp dir for Playwright video recordings
  const videoDir = path.join(os.tmpdir(), 'agentqa-videos', scanId)
  await fs.mkdir(videoDir, { recursive: true }).catch(() => {})

  try {
    const allIssues: IssueClassified[] = []
    let totalPages = 0

    await crawlWebsite(
      url,
      async ({ result }) => {
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

        // Upload desktop screenshot
        if (result.screenshot) {
          const screenshotUrl = await uploadScreenshot(scanId, pageId, result.screenshot)
          if (screenshotUrl) {
            await db.from('scanned_pages').update({ screenshot_url: screenshotUrl }).eq('id', pageId)
          }
        }

        // Upload mobile screenshot
        if (result.mobileScreenshot) {
          const mobileUrl = await uploadMobileScreenshot(scanId, pageId, result.mobileScreenshot)
          if (mobileUrl) {
            await db.from('scanned_pages').update({ mobile_screenshot_url: mobileUrl }).eq('id', pageId)
          }
        }

        // Page logs: console errors + warnings + uncaught JS exceptions with stack traces
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

        // Upload video only for pages that have significant issues
        if (result.videoPath) {
          const hasSignificantIssues = pageIssues.some(
            (i) => i.severity === 'critical' || i.severity === 'medium'
          )
          if (hasSignificantIssues) {
            try {
              const videoBuffer = await fs.readFile(result.videoPath)
              const videoUrl = await uploadVideo(scanId, pageId, videoBuffer)
              if (videoUrl) {
                await db.from('scanned_pages').update({ video_url: videoUrl }).eq('id', pageId)
              }
            } catch (e) {
              console.error('[scanner] Video upload failed:', e)
            }
          }
          // Always clean up local video file
          await fs.unlink(result.videoPath).catch(() => {})
        }

        await db
          .from('scans')
          .update({ total_pages: totalPages, total_issues: allIssues.length })
          .eq('id', scanId)
      },
      { videoDir }
    )

    const { score } = calculateScore(allIssues)

    await db
      .from('scans')
      .update({
        status: 'completed',
        score,
        total_pages: totalPages,
        total_issues: allIssues.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', scanId)

    console.log(`[scanner] ${scanId} complete — score:${score} pages:${totalPages} issues:${allIssues.length}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[scanner] ${scanId} failed:`, message)

    await db
      .from('scans')
      .update({
        status: 'failed',
        error_message: categoriseError(message),
        completed_at: new Date().toISOString(),
      })
      .eq('id', scanId)
  } finally {
    // Best-effort cleanup of the video directory
    await fs.rm(videoDir, { recursive: true, force: true }).catch(() => {})
  }
}

/** Maps raw Playwright/Node error messages to user-friendly descriptions. */
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
      issue('page_not_found', 'critical', '404 – Page Not Found', `The page at ${result.url} returned a 404 status code.`, {
        url: result.url,
        statusCode: result.statusCode,
      })
    )
  }

  // Use pageerror events (uncaught exceptions) for critical JS error detection
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
    // Fallback: console errors that look like uncaught exceptions
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

  // Large asset detection — flag scripts or stylesheets over 500 KB
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
