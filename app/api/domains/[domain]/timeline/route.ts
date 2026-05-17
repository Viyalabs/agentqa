import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import type { DomainTimelineEntry } from '@/types'

export const runtime = 'nodejs'

// GET /api/domains/[domain]/timeline?limit=20
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params
  const decodedDomain = decodeURIComponent(domain)

  const db = getAdminClient()

  // Fetch completed scans for this domain, most recent first
  const { data: scans, error: scansError } = await db
    .from('scans')
    .select('id, score, score_delta, run_sequence, completed_at, regression_new, regression_resolved, regression_recurring, regression_worsened, regression_improved')
    .eq('domain', decodedDomain)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(20)

  if (scansError) {
    console.error('[GET /api/domains/timeline] error:', scansError.message)
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 })
  }

  const timeline: DomainTimelineEntry[] = (scans ?? []).map((s) => ({
    scan_id:              s.id as string,
    completed_at:         s.completed_at as string,
    score:                s.score as number | null,
    score_delta:          s.score_delta as number | null,
    run_sequence:         s.run_sequence as number | null,
    regression_new:       (s.regression_new as number) ?? 0,
    regression_resolved:  (s.regression_resolved as number) ?? 0,
    regression_recurring: (s.regression_recurring as number) ?? 0,
    regression_worsened:  (s.regression_worsened as number) ?? 0,
    regression_improved:  (s.regression_improved as number) ?? 0,
  }))

  // Open issues for this domain
  const { data: openIssues } = await db
    .from('domain_issue_state')
    .select('fingerprint, current_status, current_severity, consecutive_scans_seen, total_occurrences, first_seen_at, days_unresolved: first_seen_at')
    .eq('domain', decodedDomain)
    .neq('current_status', 'resolved')
    .order('first_seen_at', { ascending: true })
    .limit(50)

  // Compute days_unresolved in JS since it's not a generated column
  const now = Date.now()
  const enrichedOpenIssues = (openIssues ?? []).map((i) => ({
    ...i,
    days_unresolved: i.first_seen_at
      ? Math.max(0, Math.floor((now - new Date(i.first_seen_at as string).getTime()) / 86_400_000))
      : 0,
  }))

  return NextResponse.json({
    domain: decodedDomain,
    timeline,
    open_issues: enrichedOpenIssues,
  })
}
