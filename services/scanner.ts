import { waitUntil } from '@vercel/functions'
import { getAdminClient, uploadScreenshot, uploadMobileScreenshot } from '@/lib/supabase'
import { crawlWebsite } from '@/playwright/crawler'
import { calculateScore } from './scorer'
import { detectAndStoreFrameworks } from './framework-detector'
import { matchScanIssues } from './pattern-matcher'
import { enqueueAIJobs } from './ai-queue'
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

    // ── Post-scan intelligence pipeline ─────────────────────────────────────────

    // 1. Detect frameworks (fast — reads network_details already in DB)
    const frameworks = await detectAndStoreFrameworks(scanId).catch((err: unknown) => {
      console.error(`[scanner] Framework detection failed for ${scanId}:`, err)
      return [] as string[]
    })

    // 2. Fingerprint issues + match to cross-scan pattern DB (capped at 25 s)
    //    If it times out, enqueueAIJobs still runs — pattern cache just won't be warm.
    await Promise.race([
      matchScanIssues(scanId, frameworks).catch((err: unknown) => {
        console.error(`[scanner] Pattern matching failed for ${scanId}:`, err)
      }),
      new Promise<void>(resolve => setTimeout(resolve, 25_000)),
    ])

    // 3. Enqueue AI analysis jobs — always runs, even if pattern matching timed out.
    //    Scan is already marked complete above — AI runs without blocking the user.
    await enqueueAIJobs(scanId).catch((err: unknown) => {
      console.error(`[scanner] Failed to enqueue AI jobs for ${scanId}:`, err)
    })

    // Trigger the AI worker — registered with waitUntil so Vercel keeps the
    // lambda alive long enough for the request to leave before shutdown.
    const workerUrl    = `${process.env.NEXT_PUBLIC_APP_URL}/api/ai/worker`
    const workerSecret = process.env.WORKER_SECRET
    waitUntil(
      fetch(workerUrl, {
        method:  'POST',
        headers: {
          ...(workerSecret ? { 'x-worker-secret': workerSecret } : {}),
          'Content-Type': 'application/json',
        },
        body:   '{}',
        signal: AbortSignal.timeout(10_000),
      }).catch((err: unknown) => {
        console.error(`[scanner] Failed to trigger AI worker for ${scanId}:`, err)
      })
    )

    if (notifyEmail) {
      const { data: prevRows } = await db
        .from('scans')
        .select('score')
        .eq('url', url)
        .eq('status', 'completed')
        .neq('id', scanId)
        .order('completed_at', { ascending: false })
        .limit(1)
      const previousScore = (prevRows?.[0] as { score: number | null } | undefined)?.score ?? null

      await sendScanCompletionEmail(notifyEmail, scanId, url, score, allIssues, previousScore).catch((err: unknown) => {
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentqa.viyalabs.com'

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
  issues: IssueClassified[],
  previousScore: number | null,
): Promise<void> {
  const reportLink = `${APP_URL}/report/${scanId}`
  const badgeUrl = `${APP_URL}/api/badge/${scanId}`

  const critical = issues.filter((i) => i.severity === 'critical')
  const medium   = issues.filter((i) => i.severity === 'medium')
  const low      = issues.filter((i) => i.severity === 'low')

  const scoreColor = score >= 85 ? '#22c55e' : score >= 70 ? '#eab308' : score >= 50 ? '#f97316' : '#ef4444'
  const scoreLabel = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs work' : 'Critical issues'

  const delta = previousScore !== null ? score - previousScore : null
  const deltaHtml = delta !== null
    ? `<span style="font-size:13px;font-weight:600;color:${delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#a1a1aa'};margin-left:8px">${delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '→ no change'} vs last scan</span>`
    : ''
  const deltaSubject = delta !== null
    ? (delta > 0 ? ` (+${delta} ↑)` : delta < 0 ? ` (${delta} ↓)` : '')
    : ''

  const topCritical = critical.slice(0, 3).map((i) => `
    <div style="padding:10px 12px;border-radius:6px;background:#450a0a;border-left:3px solid #ef4444;margin-bottom:8px">
      <div style="color:#fca5a5;font-size:13px;font-weight:600;margin-bottom:2px">${i.title}</div>
      ${i.description ? `<div style="color:#7f1d1d;font-size:12px">${i.description}</div>` : ''}
    </div>
  `).join('')

  const severityRow = `
    <div style="display:flex;gap:12px;margin:16px 0">
      ${critical.length ? `<span style="padding:4px 10px;border-radius:20px;background:#450a0a;color:#fca5a5;font-size:12px;font-weight:600">${critical.length} critical</span>` : ''}
      ${medium.length  ? `<span style="padding:4px 10px;border-radius:20px;background:#422006;color:#fcd34d;font-size:12px;font-weight:600">${medium.length} medium</span>`  : ''}
      ${low.length     ? `<span style="padding:4px 10px;border-radius:20px;background:#0c1a3a;color:#93c5fd;font-size:12px;font-weight:600">${low.length} low</span>`      : ''}
      ${issues.length === 0 ? `<span style="padding:4px 10px;border-radius:20px;background:#052e16;color:#86efac;font-size:12px;font-weight:600">No issues found</span>` : ''}
    </div>
  `

  console.log(`[scanner] Sending completion email to ${email} for ${scanId}`)
  await resendPost({
    to: [email],
    subject: `AgentQA: ${score}/100${deltaSubject} — ${scoreLabel} · ${issues.length} issue${issues.length !== 1 ? 's' : ''} on ${new URL(scannedUrl).hostname}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;background:#09090b;color:#fff;padding:0;border-radius:12px;overflow:hidden">
        <!-- Header -->
        <div style="background:#18181b;padding:20px 28px;border-bottom:1px solid #27272a;display:flex;align-items:center;gap:10px">
          <span style="font-size:18px">⚡</span>
          <span style="font-weight:700;font-size:16px;color:#fff">AgentQA</span>
        </div>

        <!-- Score hero -->
        <div style="padding:32px 28px;text-align:center;border-bottom:1px solid #27272a">
          <div style="font-size:60px;font-weight:800;color:${scoreColor};line-height:1;font-variant-numeric:tabular-nums">${score}</div>
          <div style="font-size:18px;color:#71717a;margin-top:4px">/100 — ${scoreLabel}${deltaHtml}</div>
          <img src="${badgeUrl}" alt="QA Score ${score}/100" style="margin:16px auto 0;display:block" />
        </div>

        <!-- Details -->
        <div style="padding:24px 28px">
          <p style="color:#71717a;font-size:13px;margin:0 0 4px">Scanned</p>
          <p style="color:#a1a1aa;font-size:14px;font-family:monospace;margin:0 0 16px">${scannedUrl}</p>

          ${severityRow}

          ${topCritical ? `
            <p style="color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin:20px 0 10px">Critical issues</p>
            ${topCritical}
            ${critical.length > 3 ? `<p style="color:#71717a;font-size:12px;margin:8px 0 0">+${critical.length - 3} more in the full report</p>` : ''}
          ` : ''}

          <a href="${reportLink}" style="display:block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:600;font-size:15px;text-align:center;margin:24px 0 0">
            View Full Report →
          </a>
        </div>

        <!-- Footer -->
        <div style="padding:16px 28px;background:#18181b;border-top:1px solid #27272a">
          <p style="color:#52525b;font-size:12px;margin:0">
            This report link is permanent. Share it with your team or embed the badge in your README.
            &nbsp;·&nbsp; <a href="https://viyalabs.com" style="color:#3f3f46;text-decoration:none">AgentQA by Viyalabs</a>
          </p>
        </div>
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

  if (result.missingAltCount > 0) {
    issues.push(
      issue(
        'missing_alt',
        'medium',
        'Images Missing Alt Text',
        `${result.missingAltCount} image(s) have no alt attribute, making them inaccessible to screen readers (WCAG 2.1 SC 1.1.1).`,
        { url: result.url, count: result.missingAltCount }
      )
    )
  }

  if (result.missingViewport) {
    issues.push(
      issue(
        'missing_meta',
        'medium',
        'Missing Viewport Meta Tag',
        'Page has no <meta name="viewport"> tag. Mobile browsers will default to a desktop-width layout, causing the page to appear zoomed out on phones.',
        { url: result.url }
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

  if (result.missingMetaDescription && !result.is404) {
    issues.push(
      issue(
        'missing_meta',
        'low',
        'Missing Meta Description',
        'Page has no <meta name="description"> tag. Search engines and social platforms use this to generate preview snippets. Without it, snippets are auto-generated and typically lower quality.',
        { url: result.url }
      )
    )
  }

  if (result.missingOgImage && !result.is404) {
    issues.push(
      issue(
        'missing_meta',
        'low',
        'Missing Open Graph Image',
        'Page has no <meta property="og:image"> tag. Without it, shared links on Slack, Twitter/X, LinkedIn, and iMessage show no preview image — dramatically reducing click-through rates.',
        { url: result.url }
      )
    )
  }

  if (!result.is404 && !result.isCrash && !result.isUnreachable) {
    if (result.h1Count === 0) {
      issues.push(
        issue(
          'missing_meta',
          'low',
          'Missing H1 Heading',
          'Page has no H1 tag. Every page should have exactly one H1 to signal the primary topic to search engines and assistive technologies.',
          { url: result.url }
        )
      )
    } else if (result.h1Count > 1) {
      issues.push(
        issue(
          'missing_meta',
          'low',
          'Multiple H1 Tags',
          `Page has ${result.h1Count} H1 tags. Exactly one H1 is the SEO and accessibility best practice — multiple H1s dilute keyword signals and confuse document structure.`,
          { url: result.url, count: result.h1Count }
        )
      )
    }
  }

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
