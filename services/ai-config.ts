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

/** Max jobs processed per single HTTP invocation of the worker.
 *  With AI_JOB_TIMEOUT_MS = 240 s and Vercel maxDuration = 300 s,
 *  only ~1 job fits when timeouts are hit. 3 is a safe cap that prevents
 *  the drain loop from stalling the cron on normal (fast) jobs. */
export const AI_MAX_JOBS_PER_INVOCATION = 3

/** Max concurrent batch API calls in a single analyzeIssues run.
 *  3 parallel batches is safe under Haiku's rate limits and avoids starvation. */
export const AI_BATCH_CONCURRENCY = 3

/** Per-job wall-clock timeout in the drain loop.
 *  240 s leaves 60 s of buffer inside the 300 s Vercel maxDuration. */
export const AI_JOB_TIMEOUT_MS = 240_000

// ── Analysis batching ─────────────────────────────────────────────────────────

/**
 * Issues per Claude call in batch mode.
 * Smaller batches = more reliable JSON parsing, faster individual timeouts,
 * and lower blast radius when a batch fails (solo fallback covers fewer issues).
 * 4 issues × ~130 output tokens = ~520 out, well within 60 s per-call timeout.
 */
export const AI_BATCH_SIZE = 4

/**
 * Maximum unique issue representatives sent to Claude per scan.
 * Applied after fingerprint dedup + same-type grouping.
 * Representatives are sorted by severity (critical → medium → low) before capping,
 * so the highest-impact issues are always analyzed within budget.
 * Increase for paid/enterprise tiers; keep low to protect free-trial economics.
 */
export const AI_MAX_REPRESENTATIVES_PER_SCAN = 20

// ── Scan queue ────────────────────────────────────────────────────────────────

export const MAX_CONCURRENT_SCANS      = 20
/** Fallback used only when access-control cannot determine quota (e.g. no IP). */
export const MAX_SCANS_PER_IP_PER_HOUR = 5   // raised from 3; per-role overrides in lib/access-control.ts
export const DEDUP_WINDOW_MINUTES      = 15

// ── Feedback rate limiting ────────────────────────────────────────────────────

export const FEEDBACK_RATE_LIMIT_MAX       = 10
export const FEEDBACK_RATE_LIMIT_WINDOW_MS = 60_000

// ── Frontend polling ──────────────────────────────────────────────────────────

export const POLL_INTERVAL_MS  = 2_500
export const POLL_TIMEOUT_MS   = 90_000
