import { getAdminClient } from '@/lib/supabase'
import type { IssueClassified, PatternMatchResult } from '@/types'
import { fingerprint as computeFingerprint, clusterKey as computeClusterKey } from './issue-fingerprinter'

export interface TopPattern {
  id: string
  cluster_key: string | null
  cluster_id: string | null
  type: string
  severity: string
  title: string
  occurrence_count: number
  total_scans_affected: number
  confidence_score: number | null
  trend_velocity: number | null
  feedback_positive: number
  feedback_negative: number
  affected_frameworks: string[]
  root_cause_template: string | null
  fix_template: string | null
  needs_refresh: boolean
  first_seen_at: string
  last_seen_at: string
}

interface StoredIssue {
  id: string
  type: string
  severity: string
  title: string
  description: string | null
  details: Record<string, unknown> | null
}

function toClassifiedLike(issue: StoredIssue, scanId: string): IssueClassified {
  return {
    scan_id: scanId,
    page_id: null,
    type: issue.type as IssueClassified['type'],
    severity: issue.severity as IssueClassified['severity'],
    title: issue.title,
    description: issue.description,
    details: issue.details,
  }
}

/**
 * Find or create a pattern cluster for a given cluster_key.
 * Handles concurrent inserts via unique-violation retry.
 */
async function findOrCreateCluster(
  ck: string,
  type: string,
  title: string,
): Promise<string> {
  const db = getAdminClient()
  const now = new Date().toISOString()

  const { data: existing } = await db
    .from('pattern_clusters')
    .select('id, pattern_count')
    .eq('cluster_key', ck)
    .maybeSingle()

  if (existing) {
    // pattern_count is a denormalized counter refreshed periodically —
    // skip per-write increments to avoid lost-update races under concurrency.
    return existing.id as string
  }

  const { data: created, error } = await db
    .from('pattern_clusters')
    .insert({ cluster_key: ck, type, canonical_title: title, pattern_count: 1, created_at: now, updated_at: now })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      // Another concurrent worker won the insert race — fetch the winner
      const { data: raceSurvivor } = await db
        .from('pattern_clusters')
        .select('id')
        .eq('cluster_key', ck)
        .maybeSingle()
      if (raceSurvivor) return raceSurvivor.id as string
    }
    throw new Error(`[pattern-matcher] cluster insert failed: ${error.message}`)
  }

  return created!.id as string
}

/**
 * Find an existing issue pattern by fingerprint or create a new one.
 *
 * On match:   increments occurrence_count + total_scans_affected, extends
 *             affected_frameworks, tracks in pattern_occurrences, returns cached templates.
 * On miss:    inserts a new pattern row, returns empty templates (Claude will fill them later).
 */
async function findOrCreatePattern(
  fp: string,
  issue: StoredIssue,
  scanId: string,
  frameworks: string[],
): Promise<PatternMatchResult> {
  const db = getAdminClient()
  const now = new Date().toISOString()
  const primaryFramework = frameworks[0] ?? null

  const { data: existing } = await db
    .from('issue_patterns')
    .select('id, occurrence_count, total_scans_affected, root_cause_template, fix_template, affected_frameworks, cluster_id, needs_refresh')
    .eq('fingerprint', fp)
    .maybeSingle()

  if (existing) {
    // Atomic increment via SQL RPC — avoids lost-update race when concurrent workers process the same fingerprint
    await db.rpc('increment_pattern_occurrence', {
      p_pattern_id: existing.id,
      p_frameworks: frameworks.length > 0 ? frameworks : null,
      p_now: now,
    })

    // Time-series record — one row per (pattern, scan); UNIQUE constraint deduplicates
    await db
      .from('pattern_occurrences')
      .upsert(
        { pattern_id: existing.id, scan_id: scanId, framework: primaryFramework, occurred_at: now },
        { onConflict: 'pattern_id,scan_id' },
      )

    return {
      patternId:         existing.id,
      fingerprint:       fp,
      isNew:             false,
      occurrenceCount:   existing.occurrence_count + 1,
      rootCauseTemplate: existing.root_cause_template ?? null,
      fixTemplate:       existing.fix_template ?? null,
      needsRefresh:      (existing.needs_refresh as boolean) ?? false,
    }
  }

  // Compute cluster key and find/create a cluster for this new pattern family
  const ck = computeClusterKey(toClassifiedLike(issue, scanId))
  const clusterId = await findOrCreateCluster(ck, issue.type, issue.title)

  const { data: created, error } = await db
    .from('issue_patterns')
    .insert({
      fingerprint:         fp,
      type:                issue.type,
      severity:            issue.severity,
      title:               issue.title,
      occurrence_count:    1,
      total_scans_affected: 1,
      affected_frameworks: frameworks,
      cluster_key:         ck,
      cluster_id:          clusterId,
      first_seen_at:       now,
      last_seen_at:        now,
    })
    .select('id')
    .single()

  if (error || !created) {
    throw new Error(`[pattern-matcher] insert failed: ${error?.message}`)
  }

  // Set this as the cluster representative if none is set yet
  await db
    .from('pattern_clusters')
    .update({ representative_id: created.id, updated_at: now })
    .eq('id', clusterId)
    .is('representative_id', null)

  await db
    .from('pattern_occurrences')
    .upsert(
      { pattern_id: created.id, scan_id: scanId, framework: primaryFramework, occurred_at: now },
      { onConflict: 'pattern_id,scan_id' },
    )

  return {
    patternId:         created.id,
    fingerprint:       fp,
    isNew:             true,
    occurrenceCount:   1,
    rootCauseTemplate: null,
    fixTemplate:       null,
    needsRefresh:      false,
  }
}

/**
 * Persist a root cause + fix back to the pattern as a reusable template.
 * Writes only when the pattern has no template yet OR when needs_refresh = true
 * (set by negative user feedback). Resets needs_refresh and records the model
 * version so stale templates can be detected when the model is upgraded.
 */
export async function updatePatternTemplates(
  patternId: string,
  rootCause: string,
  fix: string,
  modelVersion: string,
): Promise<void> {
  const db = getAdminClient()

  await db.rpc('update_pattern_template', {
    p_pattern_id:   patternId,
    p_root_cause:   rootCause,
    p_fix:          fix,
    p_model_ver:    modelVersion,
    p_updated_at:   new Date().toISOString(),
  })
}

/**
 * Reconstruct the patternMatches Map from the DB for a scan that was already
 * processed during the scan phase. Used by the async AI worker so it can pass
 * cached pattern templates to analyzeIssues and skip redundant Claude calls.
 */
export async function getPatternMatchesForScan(
  scanId: string,
): Promise<Map<string, PatternMatchResult>> {
  const db = getAdminClient()

  const { data: issueRows } = await db
    .from('issues')
    .select('id')
    .eq('scan_id', scanId)

  if (!issueRows?.length) return new Map()

  const issueIds = issueRows.map((i) => i.id as string)

  const { data: links } = await db
    .from('issue_pattern_matches')
    .select('issue_id, pattern_id')
    .in('issue_id', issueIds)

  if (!links?.length) return new Map()

  const patternIds = [...new Set(links.map((l) => l.pattern_id as string))]

  const { data: patterns } = await db
    .from('issue_patterns')
    .select('id, fingerprint, occurrence_count, root_cause_template, fix_template, needs_refresh')
    .in('id', patternIds)

  const patternMap = new Map((patterns ?? []).map((p) => [p.id as string, p]))

  const result = new Map<string, PatternMatchResult>()
  for (const link of links) {
    const p = patternMap.get(link.pattern_id as string)
    if (!p) continue
    result.set(link.issue_id as string, {
      patternId:         p.id as string,
      fingerprint:       p.fingerprint as string,
      isNew:             false,
      occurrenceCount:   p.occurrence_count as number,
      rootCauseTemplate: (p.root_cause_template as string | null) ?? null,
      fixTemplate:       (p.fix_template as string | null) ?? null,
      needsRefresh:      (p.needs_refresh as boolean) ?? false,
    })
  }
  return result
}

/**
 * Run the full pattern-matching pipeline for all issues in a completed scan:
 *
 * 1. Fetch issues from DB (they have IDs at this point).
 * 2. Compute fingerprint for each.
 * 3. Write fingerprint + detected framework back to issues row.
 * 4. Find-or-create an issue_pattern per unique fingerprint.
 * 5. Insert issue_pattern_match links.
 *
 * Returns a map of issue ID → PatternMatchResult so the AI analyzer can
 * skip Claude calls for issues whose pattern already has cached templates.
 */
export async function matchScanIssues(
  scanId: string,
  frameworks: string[],
): Promise<Map<string, PatternMatchResult>> {
  const db = getAdminClient()

  const { data: issues, error } = await db
    .from('issues')
    .select('id, type, severity, title, description, details')
    .eq('scan_id', scanId)

  if (error || !issues || issues.length === 0) return new Map()

  const primaryFramework = frameworks[0] ?? null
  const results = new Map<string, PatternMatchResult>()
  // Deduplicate: same fingerprint in one scan → one pattern lookup, many links
  const fpCache = new Map<string, PatternMatchResult>()

  await Promise.allSettled(
    (issues as StoredIssue[]).map(async (issue) => {
      try {
        const fp = computeFingerprint({
          scan_id: scanId,
          page_id: null,
          type: issue.type as never,
          severity: issue.severity as never,
          title: issue.title,
          description: issue.description,
          details: issue.details,
        })

        // Reuse result if we already processed this fingerprint in this scan
        let match = fpCache.get(fp)
        if (!match) {
          match = await findOrCreatePattern(fp, issue, scanId, frameworks)
          fpCache.set(fp, match)
        }

        results.set(issue.id, match)

        // Write fingerprint + primary framework back to the issue row
        await db
          .from('issues')
          .update({ fingerprint: fp, framework: primaryFramework })
          .eq('id', issue.id)

        // Link issue → pattern
        await db
          .from('issue_pattern_matches')
          .upsert(
            { issue_id: issue.id, pattern_id: match.patternId },
            { onConflict: 'issue_id,pattern_id' }
          )
      } catch (err) {
        console.error(`[pattern-matcher] issue ${issue.id} failed:`, err)
      }
    })
  )

  const newCount = [...fpCache.values()].filter((m) => m.isNew).length
  console.log(
    `[pattern-matcher] ${scanId}: ${issues.length} issue(s) → ` +
    `${fpCache.size} unique fingerprint(s), ${newCount} new pattern(s)`
  )

  return results
}

// ── Pattern intelligence ──────────────────────────────────────────────────────

/**
 * Recalculate and store confidence_score for a pattern.
 * Factors: AI-derived base + feedback ratio nudge + occurrence-count boost.
 * Called after recording feedback or writing new AI templates.
 */
export async function updatePatternConfidence(patternId: string): Promise<void> {
  const db = getAdminClient()

  const { data } = await db
    .from('issue_patterns')
    .select('confidence_score, feedback_positive, feedback_negative, occurrence_count')
    .eq('id', patternId)
    .maybeSingle()

  if (!data) return

  const pos   = (data.feedback_positive  as number) ?? 0
  const neg   = (data.feedback_negative  as number) ?? 0
  const total = pos + neg
  const base  = (data.confidence_score   as number | null) ?? 0.5

  // ±0.15 nudge once ≥3 feedback votes arrive
  const feedbackNudge = total >= 3 ? (pos / total - 0.5) * 0.3 : 0
  // +0 to +0.10 logarithmic boost from occurrence count
  const occurrenceBoost = Math.min(0.1, Math.log10(Math.max(1, (data.occurrence_count as number) ?? 1)) * 0.05)

  const newScore = Math.max(0.05, Math.min(0.97, base + feedbackNudge + occurrenceBoost))

  await db
    .from('issue_patterns')
    .update({ confidence_score: newScore })
    .eq('id', patternId)
}

/**
 * Batch-refresh trend_velocity on all issue_patterns by counting
 * pattern_occurrences in the last 7 days.
 *
 * Also re-computes cluster pattern_count + representative_id via SQL
 * (avoids the application-layer lost-update race from per-write increments).
 *
 * Call from the AI worker at the end of each drain cycle.
 */
export async function refreshPatternVelocities(): Promise<void> {
  const db = getAdminClient()
  const [velResult, clusterResult] = await Promise.all([
    db.rpc('refresh_pattern_velocities'),
    db.rpc('refresh_cluster_counts'),
  ])
  if (velResult.error)     console.error('[pattern-matcher] refresh_pattern_velocities:', velResult.error.message)
  if (clusterResult.error) console.error('[pattern-matcher] refresh_cluster_counts:', clusterResult.error.message)
}

/**
 * Return the top issue patterns sorted by frequency, trend velocity,
 * recency, or confidence.  Used by the patterns intelligence API.
 */
export async function getTopPatterns(opts: {
  sort?:   'frequency' | 'trending' | 'recent' | 'confidence'
  type?:   string
  limit?:  number
  offset?: number
} = {}): Promise<{ patterns: TopPattern[]; total: number }> {
  const db     = getAdminClient()
  const limit  = Math.min(opts.limit ?? 20, 100)
  const offset = opts.offset ?? 0

  let query = db
    .from('issue_patterns')
    .select(
      `id, cluster_key, cluster_id, type, severity, title,
       occurrence_count, total_scans_affected, confidence_score, trend_velocity,
       feedback_positive, feedback_negative, affected_frameworks,
       root_cause_template, fix_template, needs_refresh,
       first_seen_at, last_seen_at`,
      { count: 'exact' },
    )
    .range(offset, offset + limit - 1)

  if (opts.type) query = query.eq('type', opts.type)

  switch (opts.sort ?? 'frequency') {
    case 'trending':
      query = query.order('trend_velocity', { ascending: false, nullsFirst: false })
      break
    case 'recent':
      query = query.order('last_seen_at', { ascending: false })
      break
    case 'confidence':
      query = query.order('confidence_score', { ascending: false, nullsFirst: false })
      break
    default:
      query = query.order('occurrence_count', { ascending: false })
  }

  const { data, count, error } = await query

  if (error) {
    console.error('[pattern-matcher] getTopPatterns:', error.message)
    return { patterns: [], total: 0 }
  }

  return { patterns: (data ?? []) as TopPattern[], total: count ?? 0 }
}
