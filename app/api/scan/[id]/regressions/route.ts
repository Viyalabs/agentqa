import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import type { ChangeKind } from '@/types'

export const runtime = 'nodejs'

export interface RegressionItem {
  fingerprint:   string
  issue_type:    string
  change_kind:   ChangeKind
  severity:      string
  prev_severity: string | null
  curr_severity: string | null
  days_unresolved: number
  pages_affected:  number
  title:         string | null
  description:   string | null
  ai_summary:    string | null
}

export interface RegressionSummary {
  scan_id:       string
  prev_scan_id:  string | null
  score_delta:   number | null
  new:           RegressionItem[]
  resolved:      RegressionItem[]
  recurring:     RegressionItem[]
  worsened:      RegressionItem[]
  improved:      RegressionItem[]
}

// GET /api/scan/[id]/regressions
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scanId } = await params
  const db = getAdminClient()

  // Fetch scan header for score_delta + prev_scan_id
  const { data: scan } = await db
    .from('scans')
    .select('id, prev_scan_id, score_delta')
    .eq('id', scanId)
    .single()

  if (!scan) return NextResponse.json({ error: 'Scan not found' }, { status: 404 })

  // Fetch regression rows for this scan
  const { data: regrRows, error } = await db
    .from('scan_regressions')
    .select('fingerprint, issue_type, change_kind, severity, prev_severity, curr_severity, days_unresolved, prev_count, curr_count')
    .eq('scan_id', scanId)
    .order('severity', { ascending: true })  // critical < low alphabetically — we re-sort in JS

  if (error) {
    console.error('[GET /api/scan/regressions] DB error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch regressions' }, { status: 500 })
  }

  if (!regrRows || regrRows.length === 0) {
    return NextResponse.json({
      scan_id:      scanId,
      prev_scan_id: (scan as { prev_scan_id: string | null }).prev_scan_id,
      score_delta:  (scan as { score_delta: number | null }).score_delta,
      new: [], resolved: [], recurring: [], worsened: [], improved: [],
    } satisfies RegressionSummary)
  }

  const fingerprints = regrRows.map(r => r.fingerprint as string)

  // Fetch best representative issue for each fingerprint from current scan (new/recurring/worsened)
  // and from prev scan (resolved/improved) to get human-readable titles
  const [{ data: currIssues }, { data: prevIssues }] = await Promise.all([
    db.from('issues_with_analysis')
      .select('fingerprint, title, description, ai_summary')
      .eq('scan_id', scanId)
      .in('fingerprint', fingerprints),

    scan.prev_scan_id
      ? db.from('issues_with_analysis')
          .select('fingerprint, title, description, ai_summary')
          .eq('scan_id', scan.prev_scan_id as string)
          .in('fingerprint', fingerprints)
      : Promise.resolve({ data: [] }),
  ])

  // Build fingerprint → issue detail maps
  const currMap = new Map<string, { title: string | null; description: string | null; ai_summary: string | null }>()
  for (const i of currIssues ?? []) {
    if (!currMap.has(i.fingerprint as string)) {
      currMap.set(i.fingerprint as string, {
        title:       i.title as string | null,
        description: i.description as string | null,
        ai_summary:  i.ai_summary as string | null,
      })
    }
  }
  const prevMap = new Map<string, { title: string | null; description: string | null; ai_summary: string | null }>()
  for (const i of prevIssues ?? []) {
    if (!prevMap.has(i.fingerprint as string)) {
      prevMap.set(i.fingerprint as string, {
        title:       i.title as string | null,
        description: i.description as string | null,
        ai_summary:  i.ai_summary as string | null,
      })
    }
  }

  const SEV_ORDER: Record<string, number> = { critical: 0, medium: 1, low: 2 }

  const toItem = (r: typeof regrRows[0]): RegressionItem => {
    const fp = r.fingerprint as string
    const ck = r.change_kind as ChangeKind
    const detail = (['resolved', 'improved'].includes(ck) ? prevMap : currMap).get(fp)
    return {
      fingerprint:    fp,
      issue_type:     r.issue_type as string,
      change_kind:    ck,
      severity:       r.severity as string,
      prev_severity:  r.prev_severity as string | null,
      curr_severity:  r.curr_severity as string | null,
      days_unresolved:(r.days_unresolved as number) ?? 0,
      pages_affected: (r.curr_count as number) || (r.prev_count as number) || 1,
      title:          detail?.title ?? null,
      description:    detail?.description ?? null,
      ai_summary:     detail?.ai_summary ?? null,
    }
  }

  const sortBySev = (items: RegressionItem[]) =>
    items.sort((a, b) => (SEV_ORDER[a.severity] ?? 3) - (SEV_ORDER[b.severity] ?? 3))

  const grouped: Record<ChangeKind, RegressionItem[]> = {
    new:      [], resolved: [], recurring: [],
    worsened: [], improved: [],
  }
  for (const r of regrRows) {
    const ck = r.change_kind as ChangeKind
    grouped[ck].push(toItem(r))
  }

  return NextResponse.json({
    scan_id:      scanId,
    prev_scan_id: (scan as { prev_scan_id: string | null }).prev_scan_id,
    score_delta:  (scan as { score_delta: number | null }).score_delta,
    new:       sortBySev(grouped.new),
    resolved:  sortBySev(grouped.resolved),
    recurring: grouped.recurring.sort((a, b) => b.days_unresolved - a.days_unresolved),
    worsened:  sortBySev(grouped.worsened),
    improved:  sortBySev(grouped.improved),
  } satisfies RegressionSummary)
}
