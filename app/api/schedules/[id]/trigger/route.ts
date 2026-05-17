import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { verifyWebhookSignature } from '@/lib/scheduler'
import { extractDomain } from '@/services/regression-worker'

export const runtime = 'nodejs'

// POST /api/schedules/[id]/trigger — webhook-triggered scan
// Caller must send: header x-signature: sha256=<hmac-sha256 of raw body>
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getAdminClient()

  const { data: schedule } = await db
    .from('scan_schedules')
    .select('id, url, domain, notify_email, cadence, enabled, paused_reason, webhook_secret')
    .eq('id', id)
    .single()

  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  if (schedule.cadence !== 'webhook') {
    return NextResponse.json({ error: 'Schedule is not webhook-triggered' }, { status: 400 })
  }

  if (!schedule.enabled || schedule.paused_reason) {
    return NextResponse.json({ error: 'Schedule is paused or disabled' }, { status: 409 })
  }

  // Verify HMAC signature
  const rawBody = await req.text()
  const signature = req.headers.get('x-signature') ?? req.headers.get('x-hub-signature-256')
  const secret = schedule.webhook_secret as string | null

  if (!secret) {
    return NextResponse.json({ error: 'Schedule has no webhook secret configured' }, { status: 500 })
  }

  const valid = await verifyWebhookSignature(rawBody, signature, secret)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Find previous scan for regression comparison
  const { data: prevRows } = await db
    .from('scans')
    .select('id')
    .eq('url', schedule.url as string)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
  const prevScanId = (prevRows?.[0] as { id: string } | undefined)?.id ?? null

  const { data: scan, error: scanError } = await db
    .from('scans')
    .insert({
      url:          schedule.url,
      domain:       schedule.domain || extractDomain(schedule.url as string),
      status:       'pending',
      notify_email: schedule.notify_email,
      schedule_id:  schedule.id,
      prev_scan_id: prevScanId,
    })
    .select('id')
    .single()

  if (scanError || !scan) {
    console.error(`[POST /api/schedules/trigger] scan insert failed for schedule ${id}:`, scanError?.message)
    return NextResponse.json({ error: 'Failed to create scan' }, { status: 500 })
  }

  const scanId = (scan as { id: string }).id

  await db.from('scan_runs').insert({ schedule_id: id, scan_id: scanId, triggered_by: 'webhook' })

  await db.from('scan_schedules').update({
    last_scan_id:         scanId,
    consecutive_failures: 0,
    updated_at:           new Date().toISOString(),
  }).eq('id', id)

  fetch(`${appUrl}/api/scan/worker`, {
    method:  'POST',
    headers: { 'content-type': 'application/json', 'x-worker-secret': process.env.WORKER_SECRET ?? '' },
    body:    JSON.stringify({ scanId }),
  }).catch((err: unknown) => {
    console.error(`[POST /api/schedules/trigger] worker trigger failed for scan ${scanId}:`, err)
  })

  console.log(`[POST /api/schedules/trigger] schedule=${id} scan=${scanId} triggered via webhook`)
  return NextResponse.json({ scanId, triggered: true }, { status: 202 })
}
