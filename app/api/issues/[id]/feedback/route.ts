import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: issueId } = await params

  if (!issueId || typeof issueId !== 'string') {
    return NextResponse.json({ error: 'Missing issue ID' }, { status: 400 })
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
