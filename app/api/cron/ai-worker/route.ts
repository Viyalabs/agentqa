import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Vercel Cron: runs every 5 minutes — picks up missed or retry-scheduled jobs.
// Vercel sends Authorization: Bearer {CRON_SECRET} automatically.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workerUrl  = `${process.env.NEXT_PUBLIC_APP_URL}/api/ai/worker`
  const workerSecret = process.env.WORKER_SECRET ?? ''

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
      { ok: res.ok, status: res.status },
      { status: res.ok ? 200 : 502 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/ai-worker] Failed to trigger worker:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
