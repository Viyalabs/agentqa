import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
// Short max duration — health checks should be fast
export const maxDuration = 10

interface HealthPayload {
  status: 'ok' | 'degraded'
  db: 'ok' | 'error'
  queueDepth: number
  oldestPendingScanAgeMin: number | null
  oldestPendingJobAgeMin: number | null
  checkedAt: string
}

export async function GET() {
  const checkedAt = new Date().toISOString()
  let db_status: 'ok' | 'error' = 'error'
  let queueDepth = 0
  let oldestPendingScanAgeMin: number | null = null
  let oldestPendingJobAgeMin: number | null = null

  try {
    const db = getAdminClient()

    const [
      { data: scanRows, error: scanErr },
      { data: jobRows,  error: jobErr  },
    ] = await Promise.all([
      db.from('scans')
        .select('created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1),
      db.from('ai_analysis_jobs')
        .select('created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1),
    ])

    if (scanErr || jobErr) {
      console.error('[health] DB query error:', scanErr ?? jobErr)
    } else {
      db_status = 'ok'

      if (scanRows && scanRows.length > 0) {
        const oldest = new Date(scanRows[0].created_at as string)
        oldestPendingScanAgeMin = Math.floor((Date.now() - oldest.getTime()) / 60_000)
      }

      if (jobRows && jobRows.length > 0) {
        const oldest = new Date(jobRows[0].created_at as string)
        oldestPendingJobAgeMin = Math.floor((Date.now() - oldest.getTime()) / 60_000)
      }
    }

    // Queue depth = pending AI jobs
    const { count } = await db
      .from('ai_analysis_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    queueDepth = count ?? 0
  } catch (err) {
    console.error('[health] unexpected error:', err)
  }

  const payload: HealthPayload = {
    status: db_status === 'ok' ? 'ok' : 'degraded',
    db: db_status,
    queueDepth,
    oldestPendingScanAgeMin,
    oldestPendingJobAgeMin,
    checkedAt,
  }

  const httpStatus = db_status === 'ok' ? 200 : 503
  return NextResponse.json(payload, { status: httpStatus })
}
