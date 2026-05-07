import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getAdminClient } from '@/lib/supabase'
import { claimNextJob, completeJob, failJob } from '@/services/ai-queue'
import { analyzeIssues, generateScanOverview } from '@/services/ai-analyzer'
import { matchScanIssues } from '@/services/pattern-matcher'

export const runtime    = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const secret = process.env.WORKER_SECRET
  if (secret && req.headers.get('x-worker-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  waitUntil(processNextJob())
  return NextResponse.json({ ok: true }, { status: 202 })
}

async function processNextJob(): Promise<void> {
  const job = await claimNextJob()
  if (!job) {
    console.log('[ai-worker] queue empty — nothing to process')
    return
  }

  console.log(`[ai-worker] claimed job ${job.id} (${job.job_type}) attempt ${job.attempts}`)
  const db = getAdminClient()

  try {
    // Load scan context — url, score needed for both job types
    const { data: scan } = await db
      .from('scans')
      .select('url, score')
      .eq('id', job.scan_id)
      .single()

    if (!scan) throw new Error(`Scan ${job.scan_id} not found`)

    // Load detected frameworks (stored during scan, fast)
    const { data: fwRows } = await db
      .from('scan_frameworks')
      .select('framework')
      .eq('scan_id', job.scan_id)
      .order('confidence', { ascending: false })
    const frameworks = (fwRows ?? []).map((r: { framework: string }) => r.framework)

    if (job.job_type === 'issue_batch') {
      // Re-run pattern matching — idempotent, DB-only, provides cached templates
      const patternMatches = await matchScanIssues(job.scan_id, frameworks)
      // Only analyze medium + critical issues (low severity skipped to save cost)
      await analyzeIssues(job.scan_id, scan.url, patternMatches, frameworks, ['critical', 'medium'])
    } else {
      // scan_overview: needs issue counts
      const [{ count: critCount }, { count: medCount }] = await Promise.all([
        db.from('issues').select('*', { count: 'exact', head: true })
          .eq('scan_id', job.scan_id).eq('severity', 'critical'),
        db.from('issues').select('*', { count: 'exact', head: true })
          .eq('scan_id', job.scan_id).eq('severity', 'medium'),
      ])

      await generateScanOverview(
        job.scan_id,
        scan.url,
        scan.score ?? 0,
        critCount ?? 0,
        medCount  ?? 0,
        frameworks,
      )
    }

    await completeJob(job.id)
    console.log(`[ai-worker] completed job ${job.id} (${job.job_type})`)

    // Tail-call: drain any remaining pending jobs in this same execution
    await processNextJob()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[ai-worker] job ${job.id} failed (attempt ${job.attempts}):`, msg)
    await failJob(job.id, job.attempts, msg)
  }
}
