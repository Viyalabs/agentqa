import { NextRequest, NextResponse } from 'next/server'
import { resolveAccess } from '@/lib/access-control'
import { getSessionMetadata, deleteSession } from '@/services/auth-session'

export const runtime = 'nodejs'

// GET /api/sessions/[id] — session metadata (never exposes raw credentials)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await getSessionMetadata(id)
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const email        = req.headers.get('x-owner-email') ?? session.owner_email
  const founderToken = req.headers.get('x-founder-token')
  const access       = resolveAccess(email, founderToken)

  if (!access.bypassRateLimit && session.owner_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(session)
}

// DELETE /api/sessions/[id] — permanently revoke a session
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await getSessionMetadata(id)
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const email        = req.headers.get('x-owner-email') ?? session.owner_email
  const founderToken = req.headers.get('x-founder-token')
  const access       = resolveAccess(email, founderToken)

  if (!access.bypassRateLimit && session.owner_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await deleteSession(id)
  console.log(`[DELETE /api/sessions/${id}] revoked by ${email}`)
  return NextResponse.json({ deleted: true })
}
