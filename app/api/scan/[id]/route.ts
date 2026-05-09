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

  // All three queries run in parallel — scan meta, pages, and enriched issues
  const [
    { data: scan, error: scanError },
    { data: pages },
    { data: issues },
    { data: logsData },
    { data: fws },
  ] = await Promise.all([
    db.from('scans').select('*').eq('id', scanId).single(),

    db.from('scanned_pages')
      .select('*')
      .eq('scan_id', scanId)
      .order('created_at', { ascending: true }),

    // issues_with_analysis view replaces the previous two-step approach:
    //   1. fetch issues
    //   2. loop fingerprints → query issue_patterns (N+1)
    // Now a single query returns issues + enrichment + pattern data via LEFT JOINs.
    db.from('issues_with_analysis')
      .select('*')
      .eq('scan_id', scanId)
      .order('severity', { ascending: true })
      .order('created_at', { ascending: true }),

    db.from('scan_logs')
      .select('id, message, created_at')
      .eq('scan_id', scanId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => ({ data: data ?? [] })),

    db.from('scan_frameworks')
      .select('framework, confidence')
      .eq('scan_id', scanId)
      .order('confidence', { ascending: false })
      .then(({ data }) => ({ data: data ?? [] })),
  ])

  if (scanError || !scan) {
    if (scanError?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
    }
    console.error('[GET /api/scan/[id]] Error:', scanError?.message)
    return NextResponse.json({ error: 'Failed to fetch scan' }, { status: 500 })
  }

  const frameworkNames = (fws ?? []).map((f: { framework: string }) => f.framework)

  return NextResponse.json({
    scan,
    pages:      pages ?? [],
    issues:     issues ?? [],
    logs:       logsData ?? [],
    frameworks: frameworkNames,
  })
}
