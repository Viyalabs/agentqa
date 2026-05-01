import { getAdminClient, uploadScreenshot, uploadMobileScreenshot } from '@/lib/supabase'
import { crawlWebsite } from '@/playwright/crawler'
import { calculateScore } from './scorer'
import { analyzeIssues, generateScanOverview } from './ai-analyzer'
import { detectAndStoreFrameworks } from './framework-detector'
import { matchScanIssues } from './pattern-matcher'
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

    const { data: scanMeta } = await db
      .from('scans')
      .select('notify_email')
      .eq('id', scanId)
      .single()
    const notifyEmail = (scanMeta as { notify_email?: string | null } | null)?.notify_email ?? null

    const { score } = calculateScore(allIssues)
    const criticalCount = allIssues.filter((i) => i.severity === 'critical').length
    const mediumCount = allIssues.filter((i) => i.severity === 'medium').length
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

    // ── Post-scan intelligence pipeline (non-blocking, runs after scan completes) ──

    // 1. Detect frameworks from the network requests already stored in scanned_pages
    const frameworks = await detectAndStoreFrameworks(scanId).catch((err: unknown) => {
      console.error(`[scanner] Framework detection failed for ${scanId}:`, err)
      return [] as string[]
    })

    // 2. Fingerprint issues + match to cross-scan pattern DB
    //    Returns cached AI templates for known patterns — saves Claude calls below
    const patternMatches = await matchScanIssues(scanId, frameworks).catch((err: unknown) => {
      console.error(`[scanner] Pattern matching failed for ${scanId}:`, err)
      return new Map()
    })

    // 3. AI analysis — uses cached templates where available, calls Claude for new patterns
    await analyzeIssues(scanId, url, patternMatches, frameworks).catch((err: unknown) => {
      console.error(`[scanner] AI issue analysis failed for ${scanId}:`, err)
    })

    // 4. Scan-level overview with framework context
    await generateScanOverview(scanId, url, score, criticalCount, mediumCount, frameworks).catch((err: unknown) => {
      console.error(`[scanner] AI overview failed for ${scanId}:`, err)
    })

    if (notifyEmail) {
      await sendScanCompletionEmail(notifyEmail, scanId, url, score).catch((err: unknown) => {
        console.error(`[scanner] Failed to send notify email for ${scanId}:`, err)
      })
    }
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://qa.viyalabs.com'

async function resendPost(payload: Record<string, unknown>): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  const from = process.env.RESEND_FROM_EMAIL ?? 'AgentQA <noreply@viyalabs.com>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, ...payload }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend rejected (${res.status}): ${text}`)
  }
}

async function sendScanCompletionEmail(
  email: string,
  scanId: string,
  scannedUrl: string,
  score: number,
): Promise<void> {
  const reportLink = `${APP_URL}/report/${scanId}`
  console.log(`[scanner] Sending completion email to ${email} for ${scanId}`)
  await resendPost({
    to: [email],
    subject: `Your AgentQA scan is done — score: ${score}/100`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0F;color:#fff;padding:40px 32px;border-radius:12px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px">
          <span style="font-size:20px">⚡</span>
          <span style="font-weight:700;font-size:18px;color:#fff">AgentQA</span>
        </div>
        <h1 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 8px">Your QA scan is complete</h1>
        <p style="color:#71717a;margin:0 0 8px;font-size:14px">Scanned: <span style="color:#a1a1aa">${scannedUrl}</span></p>
        <p style="color:#71717a;margin:0 0 24px;font-size:14px">Score: <span style="color:#fff;font-weight:700">${score}/100</span></p>
        <a href="${reportLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;margin-bottom:32px">
          View Full Report →
        </a>
        <p style="color:#52525b;font-size:13px;margin:0 0 8px">
          This link is permanent — bookmark it or share it with your team.
        </p>
        <hr style="border:none;border-top:1px solid #27272a;margin:24px 0"/>
        <p style="color:#3f3f46;font-size:12px;margin:0">
          AgentQA by <a href="https://viyalabs.com" style="color:#3f3f46">Viyalabs</a>
        </p>
      </div>
    `,
  })
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
