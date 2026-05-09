import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getAdminClient } from '@/lib/supabase'
import { claimNextJob, completeJob, failJob } from '@/services/ai-queue'
import { analyzeIssues, generateScanOverview } from '@/services/ai-analyzer'
import { getPatternMatchesForScan } from '@/services/pattern-matcher'

export const runtime    = 'nodejs'
export const maxDuration = 300   // Vercel max — gives ~5 min to drain the queue

// Safety valve: never process more than this many jobs per HTTP invocation.
// Each issue_batch job can take 5-30 s; 10 jobs fits comfortably within 300 s.
const MAX_JOBS_PER_INVOCATION = 10

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
  await analyzeIssues(scanId, appUrl, patternMatches, frameworks, ['critical', 'medium'])
}

async function runScanOverview(
  scanId: string,
  appUrl: string,
  score: number,
  frameworks: string[],
): Promise<void> {
  const db = getAdminClient()

  // issue_batch runs first (priority 1) so these counts reflect analyzed issues
  const [{ count: critCount }, { count: medCount }] = await Promise.all([
    db.from('issues').select('*', { count: 'exact', head: true })
      .eq('scan_id', scanId).eq('severity', 'critical'),
    db.from('issues').select('*', { count: 'exact', head: true })
      .eq('scan_id', scanId).eq('severity', 'medium'),
  ])

  await generateScanOverview(scanId, appUrl, score, critCount ?? 0, medCount ?? 0, frameworks)
}

// ── Queue drainer ─────────────────────────────────────────────────────────────

/**
 * Claim and execute one job.
 * Returns true when a job was found (regardless of success/failure),
 * false when the queue is empty so the loop can stop.
 */
async function processOne(): Promise<boolean> {
  const job = await claimNextJob()
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
    // otherwise marks permanently 'failed'.
    await failJob(job.id, job.attempts, msg)
    // Return true — there may be other jobs in the queue even though this one failed
  }

  return true
}

/**
 * Drain up to MAX_JOBS_PER_INVOCATION jobs from the queue.
 * Uses an iterative loop — not recursion — to avoid stack growth.
 */
async function drainQueue(): Promise<void> {
  let processed = 0
  while (processed < MAX_JOBS_PER_INVOCATION) {
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
