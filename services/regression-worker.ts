/**
 * Regression worker — runs after each scan completes.
 *
 * Calls two Postgres functions:
 *   1. agentqa_compute_regressions — populates scan_regressions with per-fingerprint diffs
 *   2. agentqa_apply_scan_to_state — maintains domain_issue_state memory
 *
 * Both are idempotent (ON CONFLICT DO NOTHING / DO UPDATE), safe to retry.
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
}

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
