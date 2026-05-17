import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveAccess } from '@/lib/access-control'
import { createSession, listSessions } from '@/services/auth-session'
import type { AuthConfig } from '@/types'

export const runtime = 'nodejs'

const CookieSchema = z.object({
  name:     z.string().min(1),
  value:    z.string(),
  domain:   z.string().optional(),
  path:     z.string().optional(),
  secure:   z.boolean().optional(),
  httpOnly: z.boolean().optional(),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
  expires:  z.number().optional(),
})

const CreateSessionSchema = z.object({
  email:        z.string().email(),
  label:        z.string().max(80).optional(),
  kind:         z.enum(['cookies', 'storage_state', 'headers', 'combined']),
  cookies:      z.array(CookieSchema).optional(),
  storageState: z.string().optional(),   // JSON-encoded Playwright storageState
  headers:      z.record(z.string()).optional(),
  loginUrl:     z.string().url().optional(),
  ttlHours:     z.number().min(1).max(8760).optional(),  // default: no expiry
})

// POST /api/sessions — store an encrypted auth session
export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateSessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const { email, label, kind, cookies, storageState, headers, loginUrl, ttlHours } = parsed.data

  const founderToken = req.headers.get('x-founder-token')
  const access = resolveAccess(email, founderToken)

  // Session storage is gated: admins always allowed; non-admins need to send a valid founder token
  // (since this is an advanced feature not yet exposed in the free-tier UI)
  if (!access.bypassRateLimit) {
    return NextResponse.json({ error: 'Authenticated scanning requires a founder token for now.' }, { status: 403 })
  }

  // Validate that at least one auth mechanism is provided
  if (!cookies?.length && !storageState && !headers) {
    return NextResponse.json(
      { error: 'Provide at least one of: cookies, storageState, or headers.' },
      { status: 422 }
    )
  }

  const auth: AuthConfig = {
    kind,
    ...(cookies        ? { cookies }       : {}),
    ...(storageState   ? { storageState }  : {}),
    ...(headers        ? { headers }       : {}),
    ...(loginUrl       ? { loginUrl }      : {}),
  }

  const expiresAt = ttlHours
    ? new Date(Date.now() + ttlHours * 3600_000)
    : undefined

  try {
    const session = await createSession(email, auth, label, expiresAt)
    console.log(`[POST /api/sessions] created session=${session.id} kind=${kind} owner=${email}`)
    return NextResponse.json(session, { status: 201 })
  } catch (err) {
    console.error('[POST /api/sessions] failed:', err)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}

// GET /api/sessions?email= — list sessions for an email
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 })

  const founderToken = req.headers.get('x-founder-token')
  const access = resolveAccess(email, founderToken)
  if (!access.bypassRateLimit) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sessions = await listSessions(email)
  return NextResponse.json({ sessions })
}
