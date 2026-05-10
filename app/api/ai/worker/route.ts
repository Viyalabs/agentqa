import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getAdminClient } from '@/lib/supabase'
import { claimNextJob, completeJob, failJob } from '@/services/ai-queue'
import { analyzeIssues, generateScanOverview } from '@/services/ai-analyzer'
import { getPatternMatchesForScan } from '@/services/pattern-matcher'
import { AI_MAX_JOBS_PER_INVOCATION, AI_STUCK_JOB_TIMEOUT_MINUTES } from '@/services/ai-config'

export const runtime    = 'nodejs'
export const maxDuration = 300   // Vercel max — gives ~5 min to drain the queue

// ── Job handlers ──────────────────────────────────────────────────────────────

async function runIssueBatch(
  scanId: string,
  appUrl: string,
  frameworks: string[],
): Promise<void> {
  // Read existing pattern matches from DB — avoids re-fingerprinting issues
  // that were already matched during the scan phase (matchScanIssues ran then).
  // Any issue with a cached root_cause_template will skip the Claude call.
  const patternMatches = await getPatternMatchesForScan(scanId)
  // Include low severity — accessibility + SEO issues deserve fix guidance too.
  // Haiku is cheap enough (~$0.01/scan) that covering all severities is fine.
  await analyzeIssues(scanId, appUrl, patternMatches, frameworks, ['critical', 'medium', 'low'])
}

async function runScanOverview(
  scanId: string,
  appUrl: string,
  score: number,
  frameworks: string[],
): Promise<void> {
  const db = getAdminClient()

  // issue_batch runs first (priority 1) so these counts reflect analyzed issues
  const [{ count: critCount }, { count: medCount }, { count: lowCount }] = await Promise.all([
    db.from('issues').select('*', { count: 'exact', head: true })
      .eq('scan_id', scanId).eq('severity', 'critical'),
    db.from('issues').select('*', { count: 'exact', head: true })
      .eq('scan_id', scanId).eq('severity', 'medium'),
    db.from('issues').select('*', { count: 'exact', head: true })
      .eq('scan_id', scanId).eq('severity', 'low'),
  ])

  await generateScanOverview(scanId, appUrl, score, critCount ?? 0, medCount ?? 0, frameworks, lowCount ?? 0)
}

// ── Queue drainer ─────────────────────────────────────────────────────────────

/**
 * Claim and execute one job.
 * Returns true when a job was found (regardless of success/failure),
 * false when the queue is empty so the loop can stop.
 */
async function processOne(): Promise<boolean> {
  let job
  try {
    job = await claimNextJob()
  } catch (err) {
    // RPC failure on claim (e.g. DB unavailable, function missing) — log and stop
    // draining for this invocation rather than crashing the whole waitUntil promise.
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[ai-worker] claimNextJob failed — stopping drain: ${msg}`)
    return false
  }
  if (!job) return false

  console.log(`[ai-worker] claimed ${job.job_type} job ${job.id} (attempt ${job.attempts})`)
  const db = getAdminClient()

  try {
    const { data: scan } = await db
      .from('scans')
      .select('url, score')
      .eq('id', job.scan_id)
      .single()

    // If the scan was deleted while the job was queued, silently complete
    if (!scan) {
      await completeJob(job.id)
      return true
    }

    const { data: fwRows } = await db
      .from('scan_frameworks')
      .select('framework')
      .eq('scan_id', job.scan_id)
      .order('confidence', { ascending: false })
    const frameworks = (fwRows ?? []).map((r: { framework: string }) => r.framework)

    if (job.job_type === 'issue_batch') {
      await runIssueBatch(job.scan_id, scan.url as string, frameworks)
    } else {
      await runScanOverview(job.scan_id, scan.url as string, (scan.score as number) ?? 0, frameworks)
    }

    await completeJob(job.id)
    console.log(`[ai-worker] ${job.job_type} ${job.id} — completed`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[ai-worker] ${job.job_type} ${job.id} attempt ${job.attempts} — failed: ${msg}`)
    // failJob resets to 'pending' with back-off delay if attempts < MAX_ATTEMPTS,
    // otherwise marks permanently 'failed'. Wrapped so a DB error here doesn't
    // abort the drain loop — the reaper will recover the job on the next cron tick.
    try {
      await failJob(job.id, job.attempts, msg)
    } catch (failErr) {
      console.error(`[ai-worker] failJob for ${job.id} threw — job will be reaped:`, failErr)
    }
    // Return true — there may be other jobs in the queue even though this one failed
  }

  return true
}

/**
 * Drain up to MAX_JOBS_PER_INVOCATION jobs from the queue.
 * Uses an iterative loop — not recursion — to avoid stack growth.
 */
async function drainQueue(): Promise<void> {
  // Reset jobs stuck in 'running' after a crashed lambda so they re-enter the queue.
  await getAdminClient().rpc('reap_stuck_ai_jobs', { p_timeout_minutes: AI_STUCK_JOB_TIMEOUT_MINUTES })

  let processed = 0
  while (processed < AI_MAX_JOBS_PER_INVOCATION) {
    const hadWork = await processOne()
    if (!hadWork) break
    processed++
  }
  if (processed > 0) {
    console.log(`[ai-worker] drained ${processed} job(s) this invocation`)
  }
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const workerSecret = process.env.WORKER_SECRET
  if (workerSecret && req.headers.get('x-worker-secret') !== workerSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Respond immediately — Vercel keeps the function alive via waitUntil
  // while drainQueue runs in the background without blocking the HTTP response.
  waitUntil(drainQueue())

  return NextResponse.json({ ok: true }, { status: 202 })
}
