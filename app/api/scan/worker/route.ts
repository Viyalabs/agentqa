import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getAdminClient } from '@/lib/supabase'
import { runScan } from '@/services/scanner'

export const runtime = 'nodejs'
export const maxDuration = 300

// Internal endpoint — processes one queued scan.
// Called manually or by an external scheduler if needed.
// The primary scan execution path now uses waitUntil in /api/scan directly.
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

  // Atomic claim: returns rows only when the scan was actually pending.
  // Using .select() (not .single()) so 0 rows = empty array, not an error.
  const { data: rows } = await db
    .from('scans')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', scanId)
    .eq('status', 'pending')
    .select('id, url')

  const claimed = rows?.[0] ?? null

  if (!claimed) {
    return NextResponse.json({ ok: true, message: 'scan already claimed or not found' })
  }

  waitUntil(runScan(scanId, claimed.url))

  return NextResponse.json({ ok: true }, { status: 202 })
}
