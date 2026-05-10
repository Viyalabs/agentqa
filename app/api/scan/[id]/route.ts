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

    // issues_with_analysis view — explicit column list excludes analysis_data
    // (a large JSONB blob not needed in the polling path; saves bandwidth at scale).
    db.from('issues_with_analysis')
      .select([
        'id', 'scan_id', 'page_id', 'type', 'severity', 'title',
        'description', 'details', 'fingerprint', 'framework',
        'fix_helpful', 'created_at',
        'ai_summary', 'root_cause', 'fix_suggestion',
        'confidence', 'model_version', 'analysis_version',
        'from_pattern', 'pattern_id', 'analyzed_at',
        'pattern_count', 'pattern_frameworks', 'total_scans_affected',
        'pattern_needs_refresh', 'pattern_feedback_positive',
        'pattern_feedback_negative', 'cluster_key', 'cluster_id',
      ].join(','))
      .eq('scan_id', scanId)
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

  // Sort issues: critical → medium → low (alphabetical DB sort gives wrong order)
  const severityOrder: Record<string, number> = { critical: 0, medium: 1, low: 2 }
  const sortedIssues = (issues ?? []).sort((a, b) => {
    const aOrd = severityOrder[a.severity as string] ?? 3
    const bOrd = severityOrder[b.severity as string] ?? 3
    return aOrd !== bOrd ? aOrd - bOrd : 0
  })

  // Fetch prior completed scans for same URL (after we have scan.url)
  const { data: historyRows } = await db
    .from('scans')
    .select('id, score, completed_at')
    .eq('url', scan.url as string)
    .eq('status', 'completed')
    .neq('id', scanId)
    .order('completed_at', { ascending: false })
    .limit(5)

  return NextResponse.json({
    scan,
    pages:      pages ?? [],
    issues:     sortedIssues,
    logs:       logsData ?? [],
    frameworks: frameworkNames,
    history:    historyRows ?? [],
  })
}
