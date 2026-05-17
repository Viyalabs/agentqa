import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { resolveAccess } from '@/lib/access-control'

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

  // Start the scan fetch first; immediately chain the history query off it so both
  // run concurrently with pages / issues / logs / frameworks instead of sequentially.
  const scanFetch = db.from('scans').select('*').eq('id', scanId).single()
  const historyFetch = scanFetch.then(async ({ data: s }) => {
    if (!s) return { data: [] as Array<{ id: string; score: number | null; completed_at: string }> }
    const { data } = await db
      .from('scans')
      .select('id, score, completed_at')
      .eq('url', s.url as string)
      .eq('status', 'completed')
      .neq('id', scanId)
      .order('completed_at', { ascending: false })
      .limit(5)
    return { data: data ?? [] }
  })

  const [
    { data: scan, error: scanError },
    { data: pages },
    { data: issues },
    { data: logsData },
    { data: fws },
    { data: historyRows },
  ] = await Promise.all([
    scanFetch,

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

    historyFetch,
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
  const sortedIssues = ((issues ?? []) as Array<{ severity?: string; from_pattern?: boolean; model_version?: string; analyzed_at?: string; confidence?: number }>) .sort((a, b) => {
    const aOrd = severityOrder[a.severity ?? ''] ?? 3
    const bOrd = severityOrder[b.severity ?? ''] ?? 3
    return aOrd !== bOrd ? aOrd - bOrd : 0
  })

  // ── Debug info for admin/internal accounts ───────────────────────────────────
  // Resolved from the scan's notify_email — no auth required.
  // Only visible to accounts listed in INTERNAL_EMAILS.
  const scanEmail = (scan as { notify_email?: string | null }).notify_email ?? null
  const scanAccess = resolveAccess(scanEmail)
  const isInternal = scanAccess.showDebugInfo

  let debugInfo: Record<string, unknown> | null = null
  if (isInternal && sortedIssues.length > 0) {
    const analyzed    = sortedIssues.filter(i => i.analyzed_at).length
    const fromCache   = sortedIssues.filter(i => i.from_pattern).length
    const modelCounts = sortedIssues.reduce<Record<string, number>>((acc, i) => {
      const m = i.model_version ?? 'none'
      acc[m] = (acc[m] ?? 0) + 1
      return acc
    }, {})
    const avgConfidence = sortedIssues.reduce((s, i) => s + (i.confidence ?? 0), 0) / sortedIssues.length

    debugInfo = {
      role:             scanAccess.role,
      issuesTotal:      sortedIssues.length,
      analyzed,
      fromPatternCache: fromCache,
      cacheHitRate:     analyzed > 0 ? `${Math.round((fromCache / analyzed) * 100)}%` : 'n/a',
      avgConfidence:    Number(avgConfidence.toFixed(2)),
      modelBreakdown:   modelCounts,
      frameworks:       frameworkNames,
    }
  }

  return NextResponse.json({
    scan,
    pages:      pages ?? [],
    issues:     sortedIssues,
    logs:       logsData ?? [],
    frameworks: frameworkNames,
    history:    historyRows ?? [],
    ...(isInternal ? { isInternal: true, debugInfo } : {}),
  })
}
