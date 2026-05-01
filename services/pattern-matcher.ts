import { getAdminClient } from '@/lib/supabase'
import type { PatternMatchResult } from '@/types'
import { fingerprint as computeFingerprint } from './issue-fingerprinter'

interface StoredIssue {
  id: string
  type: string
  severity: string
  title: string
  description: string | null
  details: Record<string, unknown> | null
}

/**
 * Find an existing issue pattern by fingerprint or create a new one.
 *
 * On match:   increments occurrence_count, extends affected_frameworks, returns cached templates.
 * On miss:    inserts a new pattern row, returns empty templates (Claude will fill them later).
 */
async function findOrCreatePattern(
  fp: string,
  issue: StoredIssue,
  frameworks: string[],
): Promise<PatternMatchResult> {
  const db = getAdminClient()

  const { data: existing } = await db
    .from('issue_patterns')
    .select('id, occurrence_count, root_cause_template, fix_template, affected_frameworks')
    .eq('fingerprint', fp)
    .maybeSingle()

  if (existing) {
    const merged = [...new Set([...(existing.affected_frameworks ?? []), ...frameworks])]
    await db
      .from('issue_patterns')
      .update({
        occurrence_count: existing.occurrence_count + 1,
        last_seen_at: new Date().toISOString(),
        affected_frameworks: merged,
      })
      .eq('id', existing.id)

    return {
      patternId: existing.id,
      fingerprint: fp,
      isNew: false,
      occurrenceCount: existing.occurrence_count + 1,
      rootCauseTemplate: existing.root_cause_template ?? null,
      fixTemplate: existing.fix_template ?? null,
    }
  }

  const { data: created, error } = await db
    .from('issue_patterns')
    .insert({
      fingerprint: fp,
      type: issue.type,
      severity: issue.severity,
      title: issue.title,
      occurrence_count: 1,
      affected_frameworks: frameworks,
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !created) {
    throw new Error(`[pattern-matcher] insert failed: ${error?.message}`)
  }

  return {
    patternId: created.id,
    fingerprint: fp,
    isNew: true,
    occurrenceCount: 1,
    rootCauseTemplate: null,
    fixTemplate: null,
  }
}

/**
 * After AI analysis produces a root cause + fix for an issue, persist it back
 * to the pattern as a reusable template — but only if the pattern has none yet.
 * This means the first quality analysis wins and is reused for all future matches.
 */
export async function updatePatternTemplates(
  patternId: string,
  rootCause: string,
  fix: string,
): Promise<void> {
  const db = getAdminClient()
  await db
    .from('issue_patterns')
    .update({ root_cause_template: rootCause, fix_template: fix })
    .eq('id', patternId)
    .is('root_cause_template', null)   // never overwrite an existing template
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
          match = await findOrCreatePattern(fp, issue, frameworks)
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
