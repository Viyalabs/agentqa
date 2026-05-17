import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import type { IntelligenceSummary } from '@/types'

export const runtime = 'nodejs'

/**
 * GET /api/intelligence
 *
 * Returns the cross-scan failure intelligence summary:
 * - Patterns that have recurred after being "fixed" (sorted by recurrence_count)
 * - Known failure signatures that have been matched (sorted by occurrence_count)
 * - Per-framework failure breakdown
 * - Global recurrence metrics for the requested time window
 *
 * Query params:
 *   domain?  — filter recurrence events to a specific domain
 *   days?    — lookback window in days (default 30)
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain') ?? null
  const days   = Math.max(1, Math.min(365, parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)))
  const since  = new Date(Date.now() - days * 86_400_000).toISOString()

  const db = getAdminClient()

  const [
    recurringRes,
    signaturesRes,
    frameworksRes,
    eventsRes,
  ] = await Promise.all([

    // Patterns that have reappeared at least once after a fix
    db.from('issue_patterns')
      .select(
        'id, fingerprint, type, severity, title, occurrence_count, total_scans_affected, ' +
        'affected_frameworks, root_cause_template, fix_template, confidence_score, ' +
        'recurrence_count, first_resolved_at, avg_days_to_recur, last_seen_at, first_seen_at'
      )
      .gt('recurrence_count', 0)
      .order('recurrence_count', { ascending: false })
      .limit(20),

    // Known failure signatures that have been observed in real scans
    db.from('failure_signatures')
      .select(
        'id, framework, name, description, issue_type, severity, ' +
        'root_cause, fix_suggestion, docs_url, occurrence_count, last_seen_at, created_at'
      )
      .gt('occurrence_count', 0)
      .order('occurrence_count', { ascending: false })
      .limit(30),

    // Framework failure breakdown from analytics view
    db.from('framework_failure_analytics')
      .select('*')
      .order('total_issues', { ascending: false })
      .limit(20),

    // Lifecycle events for the time window (optionally filtered by domain)
    (() => {
      let q = db
        .from('issue_resolution_events')
        .select('event_type, days_since_last_event, domain, pattern_fingerprint')
        .gte('occurred_at', since)
      if (domain) q = q.eq('domain', domain)
      return q
    })(),
  ])

  // ── Compute recurrence metrics ─────────────────────────────────────────────

  type EventRow = { event_type: string; days_since_last_event: number | null; domain: string; pattern_fingerprint: string }
  const events = (eventsRes.data ?? []) as EventRow[]

  const detected     = events.filter((e) => e.event_type === 'detected').length
  const resolved     = events.filter((e) => e.event_type === 'resolved').length
  const reappeared   = events.filter((e) => e.event_type === 'reappeared').length

  const reappDays = events
    .filter((e) => e.event_type === 'reappeared' && e.days_since_last_event !== null)
    .map((e) => e.days_since_last_event as number)

  const avgDaysToRecur = reappDays.length > 0
    ? Math.round(reappDays.reduce((a, b) => a + b, 0) / reappDays.length * 10) / 10
    : null

  const recurrenceRatePct = resolved > 0
    ? Math.round(reappeared / resolved * 1000) / 10
    : null

  // ── Shape framework stats ──────────────────────────────────────────────────

  type FwRow = {
    framework:            string
    total_scans_affected: number
    total_issues:         number
    critical_issues:      number
    medium_issues:        number
    low_issues:           number
    avg_score:            number | null
    known_signatures_seen: number
    issue_types:          string[] | null
    signatures_seen:      string[] | null
  }

  const frameworks = ((frameworksRes.data ?? []) as unknown as FwRow[]).map((r) => ({
    framework:           r.framework,
    totalScansAffected:  r.total_scans_affected,
    totalIssues:         r.total_issues,
    criticalIssues:      r.critical_issues,
    mediumIssues:        r.medium_issues,
    lowIssues:           r.low_issues,
    avgScore:            r.avg_score,
    knownSignaturesSeen: r.known_signatures_seen,
    issueTypes:          r.issue_types ?? [],
    signaturesSeen:      r.signatures_seen ?? [],
  }))

  // ── Shape known signatures ─────────────────────────────────────────────────

  type SigRow = {
    id: string; framework: string; name: string; description: string | null
    issue_type: string; severity: string; root_cause: string; fix_suggestion: string
    docs_url: string | null; occurrence_count: number; last_seen_at: string | null; created_at: string
  }

  const knownSignatures = ((signaturesRes.data ?? []) as unknown as SigRow[]).map((r) => ({
    id:              r.id,
    framework:       r.framework,
    name:            r.name,
    description:     r.description,
    issueType:       r.issue_type,
    severity:        r.severity,
    triggerPatterns: [] as string[],   // not returned by API (internal matching only)
    rootCause:       r.root_cause,
    fixSuggestion:   r.fix_suggestion,
    docsUrl:         r.docs_url,
    occurrenceCount: r.occurrence_count,
    lastSeenAt:      r.last_seen_at,
  }))

  // ── Shape recurring patterns ───────────────────────────────────────────────

  type PatRow = {
    id: string; fingerprint: string; type: string; severity: string; title: string
    occurrence_count: number; total_scans_affected: number; affected_frameworks: string[]
    root_cause_template: string | null; fix_template: string | null
    confidence_score: number | null; recurrence_count: number
    first_resolved_at: string | null; avg_days_to_recur: number | null
    last_seen_at: string; first_seen_at: string
  }

  const topRecurring = ((recurringRes.data ?? []) as unknown as PatRow[]).map((r) => ({
    id:                  r.id,
    fingerprint:         r.fingerprint,
    type:                r.type,
    severity:            r.severity,
    title:               r.title,
    occurrence_count:    r.occurrence_count,
    total_scans_affected: r.total_scans_affected ?? 0,
    affected_frameworks: r.affected_frameworks ?? [],
    root_cause_template: r.root_cause_template,
    fix_template:        r.fix_template,
    confidence_score:    r.confidence_score,
    recurrence_count:    r.recurrence_count,
    first_resolved_at:   r.first_resolved_at,
    avg_days_to_recur:   r.avg_days_to_recur,
    last_seen_at:        r.last_seen_at,
    first_seen_at:       r.first_seen_at,
  }))

  const summary: IntelligenceSummary = {
    patterns: {
      topRecurring:    topRecurring as never,
      knownSignatures: knownSignatures as never,
    },
    frameworks,
    recurrence: {
      totalDetections:    detected,
      totalResolutions:   resolved,
      totalReappearances: reappeared,
      avgDaysToRecur,
      recurrenceRatePct,
    },
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(summary)
}
