/**
 * Signature matcher — matches incoming issues to known failure signatures.
 *
 * Two-pass strategy:
 *  1. Keyword/regex match against the signature's triggerPatterns (fast, no API).
 *  2. Semantic similarity via pgvector ANN search (when embeddings are available).
 *
 * When a signature matches:
 *  - The issue's signature_id column is set in the DB.
 *  - The signature's root_cause and fix_suggestion are used instead of calling Claude.
 *  - The signature's occurrence_count and last_seen_at are updated.
 */

import { getAdminClient }          from '@/lib/supabase'
import { KNOWN_SIGNATURES }        from './known-signatures'
import { generateEmbedding, issueToEmbeddingText } from './embedding-service'
import type { IssueClassified }    from '@/types'

interface SignatureMatch {
  signatureId:   string
  name:          string
  rootCause:     string
  fixSuggestion: string
  matchType:     'keyword' | 'semantic'
  confidence:    number   // 0–1
}

// ── Keyword matching ──────────────────────────────────────────────────────────

function matchByKeyword(
  issue:     IssueClassified,
  framework: string | null,
): SignatureMatch | null {
  const haystack = `${issue.title} ${issue.description ?? ''}`.toLowerCase()

  for (const sig of KNOWN_SIGNATURES) {
    // Filter by framework when both are known
    if (framework && sig.framework !== 'any' && sig.framework !== framework) continue
    // Filter by issue type when defined
    if (sig.issueType && sig.issueType !== issue.type) continue

    for (const pattern of sig.triggerPatterns) {
      try {
        if (new RegExp(pattern, 'i').test(haystack)) {
          return {
            signatureId:   sig.id,
            name:          sig.name,
            rootCause:     sig.rootCause,
            fixSuggestion: sig.fixSuggestion,
            matchType:     'keyword',
            confidence:    0.90,
          }
        }
      } catch {
        // Malformed regex — skip gracefully
      }
    }
  }

  return null
}

// ── Semantic matching (pgvector) ──────────────────────────────────────────────

async function matchBySemantic(
  issue:     IssueClassified,
  framework: string | null,
): Promise<SignatureMatch | null> {
  const text      = issueToEmbeddingText(issue)
  const embedding = await generateEmbedding(text).catch(() => null)
  if (!embedding) return null

  const db = getAdminClient()
  let data: unknown = null
  try {
    const res = await db.rpc('find_signature_by_embedding', {
      query_embedding:      embedding,
      filter_framework:     framework ?? null,
      similarity_threshold: 0.78,
      max_results:          1,
    })
    data = res.data
  } catch {
    return null
  }

  if (!Array.isArray(data) || data.length === 0) return null

  const row = (data as Array<{
    signature_id: string
    name:         string
    framework:    string
    similarity:   number
  }>)[0]

  // Look up full root_cause and fix_suggestion from the in-memory library
  const sig = KNOWN_SIGNATURES.find((s) => s.id === row.signature_id)
  if (!sig) return null

  return {
    signatureId:   row.signature_id,
    name:          row.name,
    rootCause:     sig.rootCause,
    fixSuggestion: sig.fixSuggestion,
    matchType:     'semantic',
    confidence:    row.similarity,
  }
}

// ── Main API ──────────────────────────────────────────────────────────────────

/**
 * Attempt to match a single issue to a known failure signature.
 * Tries keyword matching first; falls back to semantic if no keyword match.
 */
export async function matchSignature(
  issue:     IssueClassified,
  framework: string | null,
): Promise<SignatureMatch | null> {
  // Fast path: keyword match (no API call, no DB round-trip)
  const keyword = matchByKeyword(issue, framework)
  if (keyword) return keyword

  // Slow path: semantic similarity (requires embedding API + pgvector)
  return matchBySemantic(issue, framework)
}

/**
 * Enrich all issues for a completed scan with known signature IDs.
 *
 * - Reads issues from DB.
 * - For each, runs keyword + (optionally) semantic matching.
 * - Batch-updates the signature_id column.
 * - Increments occurrence_count on matched signatures.
 *
 * Called from scanner.ts between framework detection and pattern matching.
 * Non-blocking: errors are logged, never thrown.
 */
export async function enrichIssuesWithSignatures(
  scanId:    string,
  framework: string | null,
): Promise<void> {
  const db = getAdminClient()

  const { data: issues } = await db
    .from('issues')
    .select('id, type, severity, title, description, details')
    .eq('scan_id', scanId)

  if (!issues?.length) return

  const updates:    Array<{ id: string; signature_id: string }> = []
  const sigCounts:  Map<string, number> = new Map()

  await Promise.allSettled(
    (issues as Array<{ id: string; type: string; severity: string; title: string; description: string | null; details: unknown }>)
      .map(async (issue) => {
        const classified: IssueClassified = {
          scan_id:     scanId,
          page_id:     null,
          type:        issue.type     as IssueClassified['type'],
          severity:    issue.severity as IssueClassified['severity'],
          title:       issue.title,
          description: issue.description,
          details:     issue.details as Record<string, unknown> | null,
        }

        const match = await matchSignature(classified, framework)
        if (!match) return

        updates.push({ id: issue.id, signature_id: match.signatureId })
        sigCounts.set(match.signatureId, (sigCounts.get(match.signatureId) ?? 0) + 1)
      })
  )

  if (updates.length === 0) return

  // Batch-update issues with matched signature IDs
  await Promise.allSettled(
    updates.map(({ id, signature_id }) =>
      db.from('issues').update({ signature_id }).eq('id', id)
    )
  )

  // Bump occurrence_count + last_seen_at for each matched signature
  const now = new Date().toISOString()
  await Promise.allSettled(
    [...sigCounts.entries()].map(async ([sigId, delta]) => {
      const { data: current } = await db
        .from('failure_signatures')
        .select('occurrence_count')
        .eq('id', sigId)
        .maybeSingle()
      const newCount = ((current as { occurrence_count: number } | null)?.occurrence_count ?? 0) + delta
      return db.from('failure_signatures')
        .update({ occurrence_count: newCount, last_seen_at: now })
        .eq('id', sigId)
    })
  )

  console.log(
    `[signature-matcher] ${scanId}: ${updates.length} issue(s) matched across ` +
    `${sigCounts.size} signature(s) — framework: ${framework ?? 'unknown'}`
  )
}
