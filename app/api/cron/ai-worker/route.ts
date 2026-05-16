import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getAdminClient } from '@/lib/supabase'
import { refreshPatternVelocities } from '@/services/pattern-matcher'
import { AI_STUCK_JOB_TIMEOUT_MINUTES } from '@/services/ai-config'

export const runtime = 'nodejs'

// Vercel Cron: runs every 5 minutes — picks up missed or retry-scheduled jobs
// and reaps ghost scans/jobs left by crashed lambdas.
// Vercel sends Authorization: Bearer {CRON_SECRET} automatically.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/ai-worker] CRON_SECRET not set — refusing all requests')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminClient()

  // Reap scans stuck in 'running' (lambda crashed without cleanup).
  // Timeout matches the scan maxDuration (300 s) with generous margin.
  const { data: scansReaped } = await db.rpc('reap_stuck_scans', { p_timeout_minutes: 10 })
  if (scansReaped) {
    console.log(`[cron] reaped ${scansReaped} stuck scan(s)`)
  }

  // Reap AI jobs stuck in 'running' — catches worker lambdas that crashed mid-drain.
  await db.rpc('reap_stuck_ai_jobs', { p_timeout_minutes: AI_STUCK_JOB_TIMEOUT_MINUTES })

  // Refresh pattern velocity scores on a fixed schedule — offloaded to waitUntil so
  // the cron handler responds quickly and the two full-table UPDATEs run async.
  waitUntil(refreshPatternVelocities())

  const workerUrl    = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentqa.viyalabs.com'}/api/ai/worker`
  const workerSecret = process.env.WORKER_SECRET

  try {
    const res = await fetch(workerUrl, {
      method:  'POST',
      headers: {
        ...(workerSecret ? { 'x-worker-secret': workerSecret } : {}),
        'Content-Type': 'application/json',
      },
      body: '{}',
    })

    return NextResponse.json(
      { ok: res.ok, status: res.status, scansReaped: scansReaped ?? 0 },
      { status: res.ok ? 200 : 502 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/ai-worker] Failed to trigger worker:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
