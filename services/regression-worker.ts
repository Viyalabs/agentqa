/**
 * Regression worker — runs after each scan completes.
 *
 * Calls two Postgres functions:
 *   1. agentqa_compute_regressions — populates scan_regressions with per-fingerprint diffs
 *   2. agentqa_apply_scan_to_state — maintains domain_issue_state memory
 *
 * Then logs issue lifecycle events (detected / resolved / reappeared) which
 * power the recurrence intelligence layer.
 *
 * All steps are idempotent (ON CONFLICT DO NOTHING / DO UPDATE), safe to retry.
 */

import { getAdminClient } from '@/lib/supabase'

export async function runRegressionWorker(scanId: string): Promise<void> {
  const db = getAdminClient()

  const [regrResult, stateResult] = await Promise.all([
    db.rpc('agentqa_compute_regressions', { p_scan_id: scanId }),
    db.rpc('agentqa_apply_scan_to_state', { p_scan_id: scanId }),
  ])

  if (regrResult.error) {
    console.error(`[regression-worker] compute_regressions failed for ${scanId}:`, regrResult.error.message)
  }
  if (stateResult.error) {
    console.error(`[regression-worker] apply_scan_to_state failed for ${scanId}:`, stateResult.error.message)
  }

  // Log lifecycle events for recurrence intelligence (non-blocking)
  await logRecurrenceEvents(scanId).catch((err: unknown) => {
    console.error(`[regression-worker] logRecurrenceEvents failed for ${scanId}:`, err)
  })
}

// ── Recurrence event tracking ─────────────────────────────────────────────────

interface RegressionRow {
  fingerprint:  string
  change_kind:  string
  signature_id: string | null
}

/**
 * After regressions are computed, log detected / resolved / reappeared events
 * for every fingerprint that changed state.  Updates recurrence_count and
 * avg_days_to_recur on the issue_patterns table when an issue reappears.
 */
async function logRecurrenceEvents(scanId: string): Promise<void> {
  const db = getAdminClient()

  // Fetch the domain for this scan
  const { data: scanData } = await db
    .from('scans')
    .select('domain')
    .eq('id', scanId)
    .single()

  const domain = (scanData as { domain: string | null } | null)?.domain
  if (!domain) return

  // Fetch regressions that represent lifecycle changes (new / resolved only)
  const { data: regressions } = await db
    .from('scan_regressions')
    .select('fingerprint, change_kind, signature_id')
    .eq('scan_id', scanId)
    .in('change_kind', ['new', 'resolved'])

  if (!regressions?.length) return

  const rows = regressions as RegressionRow[]
  const fps  = rows.map((r) => r.fingerprint)
  const now  = new Date()

  // Batch-load last events per fingerprint for this domain (newest first)
  const { data: lastEvents } = await db
    .from('issue_resolution_events')
    .select('pattern_fingerprint, event_type, occurred_at')
    .eq('domain', domain)
    .in('pattern_fingerprint', fps)
    .order('occurred_at', { ascending: false })

  // Map: fingerprint → array of past events (newest first)
  const lastEventMap = new Map<string, Array<{ event_type: string; occurred_at: string }>>()
  for (const evt of (lastEvents ?? []) as Array<{
    pattern_fingerprint: string
    event_type: string
    occurred_at: string
  }>) {
    if (!lastEventMap.has(evt.pattern_fingerprint)) lastEventMap.set(evt.pattern_fingerprint, [])
    lastEventMap.get(evt.pattern_fingerprint)!.push(evt)
  }

  const newEvents:     Array<Record<string, unknown>> = []
  const reappearedFps: string[]                       = []

  for (const reg of rows) {
    const fp     = reg.fingerprint
    const events = lastEventMap.get(fp) ?? []
    const latest = events[0] ?? null

    let eventType: 'detected' | 'resolved' | 'reappeared'

    if (reg.change_kind === 'resolved') {
      eventType = 'resolved'
      // Record first resolution timestamp on the pattern (idempotent)
      void db
        .from('issue_patterns')
        .update({ first_resolved_at: now.toISOString() })
        .eq('fingerprint', fp)
        .is('first_resolved_at', null)
    } else {
      // change_kind === 'new' — check if fingerprint was previously resolved
      const wasResolved = events.some((e) => e.event_type === 'resolved')
      if (wasResolved) {
        eventType = 'reappeared'
        reappearedFps.push(fp)
      } else {
        eventType = 'detected'
      }
    }

    const daysSinceLast = latest
      ? (now.getTime() - new Date(latest.occurred_at).getTime()) / 86_400_000
      : null

    newEvents.push({
      pattern_fingerprint:   fp,
      domain,
      scan_id:               scanId,
      event_type:            eventType,
      days_since_last_event: daysSinceLast,
      signature_id:          reg.signature_id ?? null,
      occurred_at:           now.toISOString(),
    })
  }

  if (newEvents.length > 0) {
    const { error } = await db.from('issue_resolution_events').insert(newEvents)
    if (error) console.error('[regression-worker] insert lifecycle events failed:', error.message)
  }

  // Update recurrence_count + avg_days_to_recur for reappeared patterns
  for (const fp of reappearedFps) {
    const { data: pat } = await db
      .from('issue_patterns')
      .select('recurrence_count, avg_days_to_recur')
      .eq('fingerprint', fp)
      .maybeSingle()

    if (!pat) continue

    const p           = pat as { recurrence_count: number; avg_days_to_recur: number | null }
    const oldCount    = p.recurrence_count ?? 0
    const newCount    = oldCount + 1
    const oldAvg      = p.avg_days_to_recur
    const reappEvent  = newEvents.find(
      (e) => e.pattern_fingerprint === fp && e.event_type === 'reappeared'
    )
    const daysSince   = (reappEvent?.days_since_last_event as number | null) ?? null

    const newAvg = oldAvg !== null && daysSince !== null
      ? (oldAvg * oldCount + daysSince) / newCount
      : daysSince

    await db
      .from('issue_patterns')
      .update({ recurrence_count: newCount, avg_days_to_recur: newAvg })
      .eq('fingerprint', fp)
  }

  const detected   = newEvents.filter((e) => e.event_type === 'detected').length
  const resolved   = newEvents.filter((e) => e.event_type === 'resolved').length
  const reappeared = reappearedFps.length
  if (newEvents.length > 0) {
    console.log(
      `[regression-worker] ${scanId}: +${detected} detected, +${resolved} resolved, ` +
      `+${reappeared} reappeared (domain: ${domain})`
    )
  }
}

// ── Utility helpers ───────────────────────────────────────────────────────────

/** Extract normalized domain from a URL (e.g. "https://example.com/path" → "example.com") */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Fetch the most recent completed scan for the same URL, used to set prev_scan_id */
export async function findPrevScanId(url: string, excludeScanId?: string): Promise<string | null> {
  const db = getAdminClient()
  let q = db
    .from('scans')
    .select('id')
    .eq('url', url)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
  if (excludeScanId) q = q.neq('id', excludeScanId)
  const { data } = await q.single()
  return (data as { id: string } | null)?.id ?? null
}

/** Count how many completed scans exist for this domain (used for run_sequence) */
export async function getRunSequence(domain: string, excludeScanId: string): Promise<number> {
  const db = getAdminClient()
  const { count } = await db
    .from('scans')
    .select('*', { count: 'exact', head: true })
    .eq('domain', domain)
    .eq('status', 'completed')
    .neq('id', excludeScanId)
  return (count ?? 0) + 1
}
