import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { FEEDBACK_RATE_LIMIT_WINDOW_MS, FEEDBACK_RATE_LIMIT_MAX } from '@/services/ai-config'

export const runtime = 'nodejs'

// In-memory rate limiter — per Vercel instance only. Effective cap is
// FEEDBACK_RATE_LIMIT_MAX × N warm instances. Acceptable for now because
// abusing feedback requires knowing valid issue UUIDs and the worst outcome
// (setting needs_refresh=true) has bounded cost. Replace with Upstash/Redis
// if the pattern DB grows to a size where bulk poisoning is a real concern.
const rateLimitMap = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now  = Date.now()
  const hits = (rateLimitMap.get(ip) ?? []).filter((t) => now - t < FEEDBACK_RATE_LIMIT_WINDOW_MS)
  hits.push(now)
  rateLimitMap.set(ip, hits)
  if (rateLimitMap.size > 10_000) {
    for (const [key, ts] of rateLimitMap) {
      if (ts.every((t) => now - t > FEEDBACK_RATE_LIMIT_WINDOW_MS)) rateLimitMap.delete(key)
    }
  }
  return hits.length > FEEDBACK_RATE_LIMIT_MAX
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: issueId } = await params

  if (!issueId || typeof issueId !== 'string') {
    return NextResponse.json({ error: 'Missing issue ID' }, { status: 400 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let helpful: boolean
  try {
    const body = await req.json() as { helpful: unknown }
    if (typeof body.helpful !== 'boolean') throw new Error('invalid')
    helpful = body.helpful
  } catch {
    return NextResponse.json({ error: 'Body must be { helpful: boolean }' }, { status: 400 })
  }

  const db = getAdminClient()

  // Verify the issue exists before writing feedback — prevents poisoning with garbage IDs
  const { data: issueRow } = await db
    .from('issues')
    .select('id')
    .eq('id', issueId)
    .maybeSingle()

  if (!issueRow) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
  }

  const { error } = await db.rpc('record_issue_feedback', {
    p_issue_id: issueId,
    p_helpful:  helpful,
  })

  if (error) {
    console.error('[POST /api/issues/[id]/feedback]', error.message)
    return NextResponse.json({ error: 'Failed to record feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
