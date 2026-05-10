/**
 * Central configuration for the AI analysis pipeline.
 *
 * SQL functions (claim_next_ai_job, reap_stuck_ai_jobs) also reference
 * MAX_ATTEMPTS. Keep those in sync when changing this value — they cannot
 * import from here. Search for "attempts < 3" in scripts/migrate.js.
 */

// ── Job queue ─────────────────────────────────────────────────────────────────

/** Maximum retry attempts before a job is permanently marked 'failed'. */
export const AI_MAX_ATTEMPTS = 3

/** Back-off delays between attempts. Index = attempts already made. */
export const AI_RETRY_DELAY_MS: readonly number[] = [
  0,
  2 * 60_000,   // 2 min after attempt 1
  10 * 60_000,  // 10 min after attempt 2
]

/** Jobs stuck in 'running' beyond this are presumed dead and reaped.
 *  Worker maxDuration = 300 s (5 min); 8 min gives one full drain cycle of margin. */
export const AI_STUCK_JOB_TIMEOUT_MINUTES = 8

/** Max jobs processed per single HTTP invocation of the worker. */
export const AI_MAX_JOBS_PER_INVOCATION = 10

// ── Analysis batching ─────────────────────────────────────────────────────────

/**
 * Issues per Claude call in batch mode.
 * ~170 output tokens each → max_tokens ≈ BATCH_SIZE × 170.
 * Keep below 20 to stay within a 60 s per-call timeout.
 */
export const AI_BATCH_SIZE = 14

// ── Scan queue ────────────────────────────────────────────────────────────────

export const MAX_CONCURRENT_SCANS      = 20
export const MAX_SCANS_PER_IP_PER_HOUR = 3
export const DEDUP_WINDOW_MINUTES      = 15

// ── Feedback rate limiting ────────────────────────────────────────────────────

export const FEEDBACK_RATE_LIMIT_MAX       = 10
export const FEEDBACK_RATE_LIMIT_WINDOW_MS = 60_000

// ── Frontend polling ──────────────────────────────────────────────────────────

export const POLL_INTERVAL_MS  = 2_500
export const POLL_TIMEOUT_MS   = 90_000
