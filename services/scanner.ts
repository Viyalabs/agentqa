import { getAdminClient, uploadScreenshot } from '@/lib/supabase'
import { crawlWebsite } from '@/playwright/crawler'
import { calculateScore } from './scorer'
import type { IssueClassified, IssueType, IssueSeverity, PageTestResult } from '@/types'

export async function runScan(scanId: string, url: string): Promise<void> {
  const db = getAdminClient()

  await db
    .from('scans')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', scanId)

  try {
    const allIssues: IssueClassified[] = []
    let totalPages = 0

    await crawlWebsite(url, async ({ result }) => {
      totalPages++

      const { data: pageRow, error: pageErr } = await db
        .from('scanned_pages')
        .insert({
          scan_id: scanId,
          url: result.url,
          status_code: result.statusCode,
          load_time_ms: result.loadTimeMs,
          title: result.title || null,
          has_console_errors: result.consoleErrors.length > 0,
          has_network_failures: result.networkFailures.length > 0,
        })
        .select('id')
        .single()

      if (pageErr || !pageRow) {
        console.error('[scanner] Failed to insert page:', pageErr?.message)
        return
      }

      const pageId: string = pageRow.id

      if (result.screenshot) {
        const screenshotUrl = await uploadScreenshot(scanId, pageId, result.screenshot)
        if (screenshotUrl) {
          await db.from('scanned_pages').update({ screenshot_url: screenshotUrl }).eq('id', pageId)
        }
      }

      const logs = [
        ...result.consoleErrors.map((e) => ({ page_id: pageId, level: 'error' as const, message: e.message })),
        ...result.consoleWarnings.map((w) => ({ page_id: pageId, level: 'warning' as const, message: w.message })),
      ]
      if (logs.length > 0) await db.from('page_logs').insert(logs)

      const pageIssues = classifyPageIssues(result, scanId, pageId)
      allIssues.push(...pageIssues)

      if (pageIssues.length > 0) await db.from('issues').insert(pageIssues)

      // Update running totals so the dashboard can show live progress
      await db
        .from('scans')
        .update({ total_pages: totalPages, total_issues: allIssues.length })
        .eq('id', scanId)
    })

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
      .update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() })
      .eq('id', scanId)
  }
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
  ): IssueClassified => ({ scan_id: scanId, page_id: pageId, type, severity, title, description, details: details ?? null })

  // ── Critical ────────────────────────────────────────────────────────────────

  if (result.isUnreachable) {
    issues.push(issue(
      'page_crash', 'critical',
      'Page Unreachable',
      result.error ? `Could not connect: ${result.error}` : 'The page could not be reached.',
      { url: result.url, error: result.error }
    ))
    return issues
  }

  if (result.isCrash) {
    issues.push(issue(
      'page_crash', 'critical',
      `Server Error (${result.statusCode})`,
      `The server returned a ${result.statusCode} error for ${result.url}.`,
      { url: result.url, statusCode: result.statusCode }
    ))
  }

  if (result.is404) {
    issues.push(issue(
      'page_not_found', 'critical',
      '404 – Page Not Found',
      `The page at ${result.url} returned a 404 status code.`,
      { url: result.url, statusCode: result.statusCode }
    ))
  }

  const criticalJsErrors = result.consoleErrors.filter((e) =>
    /TypeError|ReferenceError|SyntaxError|Uncaught/.test(e.message)
  )
  if (criticalJsErrors.length > 0) {
    issues.push(issue(
      'js_error', 'critical',
      'Uncaught JavaScript Error',
      `${criticalJsErrors.length} uncaught JS error(s) detected on page load.`,
      { url: result.url, errors: criticalJsErrors.slice(0, 5).map((e) => e.message) }
    ))
  }

  // ── Medium ──────────────────────────────────────────────────────────────────

  const nonCriticalErrors = result.consoleErrors.filter(
    (e) => !/TypeError|ReferenceError|SyntaxError|Uncaught/.test(e.message)
  )
  if (nonCriticalErrors.length > 0) {
    issues.push(issue(
      'console_error', 'medium',
      'Console Errors Detected',
      `${nonCriticalErrors.length} console error(s) logged during page load.`,
      { url: result.url, errors: nonCriticalErrors.slice(0, 5).map((e) => e.message) }
    ))
  }

  const apiFailures = result.networkFailures.filter(
    (f) => f.resourceType === 'xhr' || f.resourceType === 'fetch'
  )
  if (apiFailures.length > 0) {
    issues.push(issue(
      'network_failure', 'medium',
      'Failed API Requests',
      `${apiFailures.length} network request(s) failed during page load.`,
      { url: result.url, failures: apiFailures.slice(0, 5).map((f) => ({ url: f.url, method: f.method })) }
    ))
  }

  if (result.failedImages.length > 0) {
    issues.push(issue(
      'missing_image', 'medium',
      'Broken Images',
      `${result.failedImages.length} image(s) failed to load.`,
      { url: result.url, images: result.failedImages.slice(0, 5) }
    ))
  }

  const brokenForms = result.forms.filter((f) => !f.hasSubmitButton)
  if (brokenForms.length > 0) {
    issues.push(issue(
      'broken_form', 'medium',
      'Form Missing Submit Button',
      `${brokenForms.length} form(s) found without a visible submit button.`,
      { url: result.url, count: brokenForms.length }
    ))
  }

  const resourceFailures = result.networkFailures.filter(
    (f) => f.resourceType === 'script' || f.resourceType === 'stylesheet'
  )
  if (resourceFailures.length > 0) {
    issues.push(issue(
      'network_failure', 'medium',
      'Failed Static Assets',
      `${resourceFailures.length} script/stylesheet(s) failed to load.`,
      { url: result.url, failures: resourceFailures.slice(0, 5).map((f) => f.url) }
    ))
  }

  // ── Low ─────────────────────────────────────────────────────────────────────

  if (result.loadTimeMs > 5000 && !result.is404) {
    issues.push(issue(
      'slow_load', 'low',
      'Slow Page Load',
      `Page took ${(result.loadTimeMs / 1000).toFixed(1)}s to load (threshold: 5s).`,
      { url: result.url, loadTimeMs: result.loadTimeMs }
    ))
  }

  if (result.consoleWarnings.length > 3) {
    issues.push(issue(
      'console_warning', 'low',
      'Multiple Console Warnings',
      `${result.consoleWarnings.length} console warning(s) logged.`,
      { url: result.url, warnings: result.consoleWarnings.slice(0, 3).map((w) => w.message) }
    ))
  }

  return issues
}
