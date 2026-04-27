import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scanId } = await params

  if (!scanId || typeof scanId !== 'string') {
    return NextResponse.json({ error: 'Missing scan ID' }, { status: 400 })
  }

  const db = getAdminClient()

  const { data: scan, error: scanError } = await db
    .from('scans')
    .select('*')
    .eq('id', scanId)
    .single()

  if (scanError || !scan) {
    if (scanError?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
    }
    console.error('[GET /api/scan/[id]] Error:', scanError?.message)
    return NextResponse.json({ error: 'Failed to fetch scan' }, { status: 500 })
  }

  const [{ data: pages }, { data: issues }] = await Promise.all([
    db
      .from('scanned_pages')
      .select('*')
      .eq('scan_id', scanId)
      .order('created_at', { ascending: true }),
    db
      .from('issues')
      .select('*')
      .eq('scan_id', scanId)
      .order('severity', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  // Fetch scan logs separately — gracefully returns [] if table doesn't exist
  let logsData: Array<{ id: number; message: string; created_at: string }> = []
  try {
    const { data } = await db
      .from('scan_logs')
      .select('id, message, created_at')
      .eq('scan_id', scanId)
      .order('created_at', { ascending: true })
      .limit(100)
    logsData = data ?? []
  } catch {
    // scan_logs table not yet created — omit logs from response
  }

  return NextResponse.json({
    scan,
    pages: pages ?? [],
    issues: issues ?? [],
    logs: logsData,
  })
}
