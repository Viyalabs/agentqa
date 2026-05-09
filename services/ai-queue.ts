import { getAdminClient } from '@/lib/supabase'

export type JobType   = 'issue_batch' | 'scan_overview'
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AIJob {
  id:           string
  scan_id:      string
  job_type:     JobType
  status:       JobStatus
  attempts:     number
  last_error:   string | null
  scheduled_at: string
  created_at:   string
  started_at:   string | null
  completed_at: string | null
}

const MAX_ATTEMPTS = 3

// Retry back-off: attempt 1 → 0ms (immediate), 2 → 2min, 3 → 10min
const RETRY_DELAY_MS = [0, 2 * 60_000, 10 * 60_000]

/**
 * Enqueue both AI jobs for a completed scan.
 * issue_batch runs first (priority 1), then scan_overview (priority 2).
 */
export async function enqueueAIJobs(scanId: string): Promise<void> {
  const db = getAdminClient()
  await db.from('ai_analysis_jobs').insert([
    { scan_id: scanId, job_type: 'issue_batch',   priority: 1 },
    { scan_id: scanId, job_type: 'scan_overview',  priority: 2 },
  ])
}

/**
 * Atomically claim the next pending job that is due.
 * Uses a Postgres function (SELECT FOR UPDATE SKIP LOCKED) so concurrent
 * workers can never double-claim the same job.
 * Returns null when the queue is empty or all pending jobs are not yet scheduled.
 */
export async function claimNextJob(): Promise<AIJob | null> {
  const db = getAdminClient()
  const { data, error } = await db.rpc('claim_next_ai_job')
  if (error) throw new Error(`claimNextJob RPC failed: ${error.message}`)
  return (data?.[0] as AIJob) ?? null
}

export async function completeJob(jobId: string): Promise<void> {
  const db = getAdminClient()
  await db
    .from('ai_analysis_jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', jobId)
}

/**
 * Mark a job as failed.
 * If attempts < MAX_ATTEMPTS, reset to 'pending' with a back-off delay.
 * Otherwise mark permanently 'failed'.
 */
export async function failJob(
  jobId: string,
  attempts: number,
  error: string,
): Promise<void> {
  const db = getAdminClient()
  const exhausted = attempts >= MAX_ATTEMPTS
  const delayMs   = RETRY_DELAY_MS[Math.min(attempts, RETRY_DELAY_MS.length - 1)] ?? 10 * 60_000

  await db
    .from('ai_analysis_jobs')
    .update({
      status:     exhausted ? 'failed' : 'pending',
      last_error: error.slice(0, 500),
      ...(exhausted ? {} : { scheduled_at: new Date(Date.now() + delayMs).toISOString() }),
    })
    .eq('id', jobId)
}
