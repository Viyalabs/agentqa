/**
 * Scheduler cron — runs every 5 minutes (or separately scheduled).
 * Claims due scan_schedules and fires one scan per claimed schedule.
 *
 * Design: claim + enqueue only — does NOT run scans inline.
 * Each claimed schedule triggers a fire-and-forget POST to /api/scan
 * so scan execution respects the existing rate limits and pipeline.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { extractDomain } from '@/services/regression-worker'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Validate Vercel cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Claim up to 5 due schedules atomically
  const { data: claimed, error: claimError } = await db
    .rpc('agentqa_claim_due_schedules', { p_limit: 5 })

  if (claimError) {
    console.error('[cron/scheduler] claim_due_schedules error:', claimError.message)
    return NextResponse.json({ error: 'Failed to claim schedules' }, { status: 500 })
  }

  const schedules = (claimed ?? []) as Array<{
    id: string
    url: string
    domain: string
    notify_email: string
    cadence: string
  }>

  if (schedules.length === 0) {
    return NextResponse.json({ triggered: 0, message: 'No schedules due' })
  }

  const results: Array<{ scheduleId: string; scanId?: string; error?: string }> = []

  for (const schedule of schedules) {
    try {
      // Find prev scan for regression comparison
      const { data: prevRows } = await db
        .from('scans')
        .select('id')
        .eq('url', schedule.url)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
      const prevScanId = (prevRows?.[0] as { id: string } | undefined)?.id ?? null

      // Create scan record — set domain and prev_scan_id upfront
      const { data: scan, error: scanError } = await db
        .from('scans')
        .insert({
          url:          schedule.url,
          domain:       schedule.domain || extractDomain(schedule.url),
          status:       'pending',
          notify_email: schedule.notify_email,
          schedule_id:  schedule.id,
          prev_scan_id: prevScanId,
        })
        .select('id')
        .single()

      if (scanError || !scan) {
        console.error(`[cron/scheduler] failed to create scan for schedule ${schedule.id}:`, scanError?.message)
        await db.from('scan_schedules').update({
          consecutive_failures: db.rpc('agentqa_claim_due_schedules', {}).then(() => void 0) as unknown as number,
        }).eq('id', schedule.id)
        results.push({ scheduleId: schedule.id, error: scanError?.message ?? 'insert failed' })
        continue
      }

      const scanId = (scan as { id: string }).id

      // Link scan to schedule run history
      await db.from('scan_runs').insert({
        schedule_id:  schedule.id,
        scan_id:      scanId,
        triggered_by: 'cron',
      })

      // Update schedule: record last scan id + reset failure count
      await db.from('scan_schedules').update({
        last_scan_id:         scanId,
        consecutive_failures: 0,
        updated_at:           new Date().toISOString(),
      }).eq('id', schedule.id)

      // Fire-and-forget — scan worker picks it up asynchronously
      fetch(`${appUrl}/api/scan/worker`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-worker-secret': process.env.WORKER_SECRET ?? '' },
        body: JSON.stringify({ scanId }),
      }).catch((err: unknown) => {
        console.error(`[cron/scheduler] worker trigger failed for scan ${scanId}:`, err)
      })

      console.log(`[cron/scheduler] triggered schedule=${schedule.id} scan=${scanId} domain=${schedule.domain} cadence=${schedule.cadence}`)
      results.push({ scheduleId: schedule.id, scanId })
    } catch (err) {
      console.error(`[cron/scheduler] unexpected error for schedule ${schedule.id}:`, err)

      // Increment failure count; pause after 5 consecutive failures
      const { data: current } = await db
        .from('scan_schedules')
        .select('consecutive_failures')
        .eq('id', schedule.id)
        .single()
      const newFailures = ((current as { consecutive_failures: number } | null)?.consecutive_failures ?? 0) + 1
      await db.from('scan_schedules').update({
        consecutive_failures: newFailures,
        paused_reason: newFailures >= 5 ? 'failures' : null,
        updated_at: new Date().toISOString(),
      }).eq('id', schedule.id)

      results.push({ scheduleId: schedule.id, error: String(err) })
    }
  }

  return NextResponse.json({
    triggered: results.filter(r => !r.error).length,
    results,
  })
}
