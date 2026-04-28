import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getAdminClient } from '@/lib/supabase'
import { runScan } from '@/services/scanner'

export const runtime = 'nodejs'
export const maxDuration = 300 // Vercel Pro: 5-minute budget for the scan

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const scanId =
    body !== null &&
    typeof body === 'object' &&
    'scanId' in body &&
    typeof (body as Record<string, unknown>).scanId === 'string'
      ? (body as { scanId: string }).scanId
      : null

  if (!scanId) {
    return NextResponse.json({ error: 'Missing scanId' }, { status: 400 })
  }

  const db = getAdminClient()

  // Atomic claim: update status from 'pending' → 'running' only if still pending.
  // If another invocation already claimed it, the WHERE clause returns no rows.
  const { data: claimed } = await db
    .from('scans')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', scanId)
    .eq('status', 'pending')
    .select('id, url')
    .single()

  if (!claimed) {
    // Scan not found, already running, or already completed — nothing to do
    return NextResponse.json({ ok: true, message: 'scan already claimed or not found' })
  }

  // Respond 202 immediately so the scan route's waitUntil resolves fast.
  // Vercel keeps this function instance alive via waitUntil until runScan finishes.
  waitUntil(runScan(scanId, claimed.url))

  return NextResponse.json({ ok: true }, { status: 202 })
}
