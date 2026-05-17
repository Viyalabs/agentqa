import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { extractDomain, findPrevScanId } from '@/services/regression-worker'

export const runtime = 'nodejs'

// POST /api/schedules/[id]/run — fire a manual scan for a schedule from the UI
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getAdminClient()

  const { data: schedule } = await db
    .from('scan_schedules')
    .select('id, url, domain, notify_email, enabled')
    .eq('id', id)
    .single()

  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  if (!schedule.enabled) return NextResponse.json({ error: 'Schedule is disabled' }, { status: 409 })

  const prevScanId = await findPrevScanId(schedule.url as string)

  const { data: scan, error: scanError } = await db
    .from('scans')
    .insert({
      url:          schedule.url,
      domain:       schedule.domain || extractDomain(schedule.url as string),
      status:       'pending',
      notify_email: schedule.notify_email,
      schedule_id:  id,
      prev_scan_id: prevScanId,
    })
    .select('id')
    .single()

  if (scanError || !scan) {
    console.error(`[POST /api/schedules/run] scan insert failed for schedule ${id}:`, scanError?.message)
    return NextResponse.json({ error: 'Failed to create scan' }, { status: 500 })
  }

  const scanId = (scan as { id: string }).id

  await Promise.all([
    db.from('scan_runs').insert({ schedule_id: id, scan_id: scanId, triggered_by: 'manual' }),
    db.from('scan_schedules').update({ last_scan_id: scanId, updated_at: new Date().toISOString() }).eq('id', id),
  ])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  fetch(`${appUrl}/api/scan/worker`, {
    method:  'POST',
    headers: { 'content-type': 'application/json', 'x-worker-secret': process.env.WORKER_SECRET ?? '' },
    body:    JSON.stringify({ scanId }),
  }).catch((err: unknown) => console.error(`[POST /api/schedules/run] worker trigger failed for scan ${scanId}:`, err))

  console.log(`[POST /api/schedules/run] schedule=${id} scan=${scanId} triggered manually`)
  return NextResponse.json({ scanId }, { status: 202 })
}
