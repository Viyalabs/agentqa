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

  // Enrich issues with cross-scan pattern data (occurrence_count, affected_frameworks)
  const issueList = (issues ?? []) as Array<Record<string, unknown>>
  const fingerprints = [...new Set(
    issueList.map((i) => i.fingerprint as string | null).filter((f): f is string => !!f)
  )]

  let patternMap = new Map<string, { occurrence_count: number; affected_frameworks: string[] }>()
  if (fingerprints.length > 0) {
    try {
      const { data: patterns } = await db
        .from('issue_patterns')
        .select('fingerprint, occurrence_count, affected_frameworks')
        .in('fingerprint', fingerprints)

      for (const p of patterns ?? []) {
        patternMap.set(p.fingerprint, {
          occurrence_count: p.occurrence_count,
          affected_frameworks: p.affected_frameworks ?? [],
        })
      }
    } catch {
      // issue_patterns table not yet migrated — skip enrichment
    }
  }

  const enrichedIssues = issueList.map((issue) => {
    const fp = issue.fingerprint as string | null
    const pattern = fp ? patternMap.get(fp) : undefined
    return {
      ...issue,
      pattern_count: pattern?.occurrence_count ?? null,
      pattern_frameworks: pattern?.affected_frameworks ?? [],
    }
  })

  // Fetch detected frameworks for this scan
  let frameworkNames: string[] = []
  try {
    const { data: fws } = await db
      .from('scan_frameworks')
      .select('framework, confidence')
      .eq('scan_id', scanId)
      .order('confidence', { ascending: false })
    frameworkNames = (fws ?? []).map((f: { framework: string }) => f.framework)
  } catch {
    // scan_frameworks table not yet migrated — skip
  }

  return NextResponse.json({
    scan,
    pages: pages ?? [],
    issues: enrichedIssues,
    logs: logsData,
    frameworks: frameworkNames,
  })
}
