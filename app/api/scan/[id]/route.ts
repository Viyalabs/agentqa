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

  // Fetch scan record
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

  // Fetch scanned pages
  const { data: pages } = await db
    .from('scanned_pages')
    .select('*')
    .eq('scan_id', scanId)
    .order('created_at', { ascending: true })

  // Fetch issues
  const { data: issues } = await db
    .from('issues')
    .select('*')
    .eq('scan_id', scanId)
    .order('severity', { ascending: true }) // critical first
    .order('created_at', { ascending: true })

  return NextResponse.json({
    scan,
    pages: pages ?? [],
    issues: issues ?? [],
  })
}
