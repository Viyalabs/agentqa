/**
 * Founder analytics — gated by x-founder-token header.
 * Returns platform-wide metrics for the internal dashboard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { resolveAccess } from '@/lib/access-control'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // Require founder token or internal email
  const founderToken = req.headers.get('x-founder-token')
  const emailHeader  = req.headers.get('x-notify-email')
  const access = resolveAccess(emailHeader, founderToken)

  if (!access.showDebugInfo) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = getAdminClient()
  const now = new Date()
  const d30 = new Date(now.getTime() - 30 * 86_400_000).toISOString()
  const d7  = new Date(now.getTime() -  7 * 86_400_000).toISOString()

  const [
    { count: activeDomains30d },
    { count: scans7d },
    { count: activeSchedules },
    { data: topDomains },
    { data: repeatUsers },
    { data: cacheStats },
    { data: scheduleHealth },
    { data: openIssueStats },
    { data: rescansStats },
  ] = await Promise.all([
    // Active domains in last 30 days
    db.from('scans')
      .select('domain', { count: 'exact', head: true })
      .gte('completed_at', d30)
      .not('domain', 'is', null),

    // Total scans in last 7 days
    db.from('scans')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', d7),

    // Active schedules
    db.from('scan_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true)
      .is('paused_reason', null),

    // Top 10 domains by scan count (last 30d)
    db.from('scans')
      .select('domain')
      .gte('completed_at', d30)
      .not('domain', 'is', null)
      .eq('status', 'completed')
      .limit(500),

    // Repeat users (email seen > 1 scan)
    db.from('scans')
      .select('notify_email, created_at')
      .not('notify_email', 'is', null)
      .gte('created_at', d30)
      .limit(1000),

    // AI cache stats (from issues — check from_pattern flag)
    db.from('issues')
      .select('from_pattern, analyzed_at')
      .not('analyzed_at', 'is', null)
      .gte('analyzed_at', d7)
      .limit(2000),

    // Schedule health by cadence
    db.from('scan_schedules')
      .select('cadence, enabled, paused_reason, consecutive_failures')
      .limit(500),

    // Open issue counts by severity
    db.from('domain_issue_state')
      .select('current_status, current_severity')
      .neq('current_status', 'resolved')
      .limit(2000),

    // Rescan rate: scans per domain last 30d
    db.from('scans')
      .select('domain')
      .gte('created_at', d30)
      .not('domain', 'is', null)
      .limit(2000),
  ])

  // Aggregate top domains
  const domainCounts = new Map<string, number>()
  for (const row of topDomains ?? []) {
    const d = row.domain as string
    domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1)
  }
  const topDomainsResult = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, scan_count]) => ({ domain, scan_count, avg_score: null }))

  // Aggregate repeat users
  const userMap = new Map<string, { count: number; first: string; last: string }>()
  for (const row of repeatUsers ?? []) {
    const email = row.notify_email as string
    const ts    = row.created_at as string
    const cur = userMap.get(email)
    if (!cur) { userMap.set(email, { count: 1, first: ts, last: ts }); continue }
    cur.count++
    if (ts < cur.first) cur.first = ts
    if (ts > cur.last)  cur.last  = ts
  }
  const repeatUsersResult = Array.from(userMap.entries())
    .filter(([, v]) => v.count > 1)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([email, v]) => ({ email, scan_count: v.count, first_scan: v.first, last_scan: v.last }))

  // AI cache hit rate
  const totalAnalyzed = (cacheStats ?? []).length
  const fromPatternCount = (cacheStats ?? []).filter(r => r.from_pattern).length
  const cacheHitRate = totalAnalyzed > 0 ? fromPatternCount / totalAnalyzed : null

  // Schedule health summary
  const healthMap = new Map<string, { total: number; paused: number }>()
  for (const row of scheduleHealth ?? []) {
    const cadence = row.cadence as string
    const cur = healthMap.get(cadence) ?? { total: 0, paused: 0 }
    cur.total++
    if (row.paused_reason) cur.paused++
    healthMap.set(cadence, cur)
  }
  const scheduleHealthResult = Array.from(healthMap.entries())
    .map(([cadence, v]) => ({ cadence, ...v }))

  // Open issues by severity
  const openBySeverity = { critical: 0, medium: 0, low: 0, recurring: 0 }
  for (const row of openIssueStats ?? []) {
    const sev = row.current_severity as string
    if (sev === 'critical') openBySeverity.critical++
    else if (sev === 'medium') openBySeverity.medium++
    else if (sev === 'low') openBySeverity.low++
    if (row.current_status === 'recurring') openBySeverity.recurring++
  }

  // Avg rescans per domain
  const rescanCounts = new Map<string, number>()
  for (const row of rescansStats ?? []) {
    const d = row.domain as string
    rescanCounts.set(d, (rescanCounts.get(d) ?? 0) + 1)
  }
  const avgRescans = rescanCounts.size > 0
    ? Array.from(rescanCounts.values()).reduce((s, v) => s + v, 0) / rescanCounts.size
    : 0

  return NextResponse.json({
    computed_at: now.toISOString(),
    active_domains_30d:    activeDomains30d ?? 0,
    scans_7d:              scans7d ?? 0,
    active_schedules:      activeSchedules ?? 0,
    top_domains:           topDomainsResult,
    repeat_users:          repeatUsersResult,
    repeat_user_count:     repeatUsersResult.length,
    cache_hit_rate_7d:     cacheHitRate,
    schedule_health:       scheduleHealthResult,
    open_issues:           openBySeverity,
    avg_rescans_per_domain: Number(avgRescans.toFixed(2)),
  })
}
