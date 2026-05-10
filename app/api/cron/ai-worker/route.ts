import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { refreshPatternVelocities } from '@/services/pattern-matcher'

export const runtime = 'nodejs'

// Vercel Cron: runs every 5 minutes — picks up missed or retry-scheduled jobs
// and reaps ghost scans/jobs left by crashed lambdas.
// Vercel sends Authorization: Bearer {CRON_SECRET} automatically.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminClient()

  // Reap scans stuck in 'running' (lambda crashed without cleanup).
  // Timeout matches the scan maxDuration (300 s) with generous margin.
  const { data: scansReaped } = await db.rpc('reap_stuck_scans', { p_timeout_minutes: 10 })
  if (scansReaped) {
    console.log(`[cron] reaped ${scansReaped} stuck scan(s)`)
  }

  const workerUrl    = `${process.env.NEXT_PUBLIC_APP_URL}/api/ai/worker`
  const workerSecret = process.env.WORKER_SECRET ?? ''

  // Refresh pattern velocity scores on every cron tick — fixed schedule is
  // better than per-drain because drain frequency varies with queue load.
  await refreshPatternVelocities()

  try {
    const res = await fetch(workerUrl, {
      method:  'POST',
      headers: {
        'x-worker-secret': workerSecret,
        'Content-Type':    'application/json',
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
