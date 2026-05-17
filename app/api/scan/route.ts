import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { z } from 'zod'
import { getAdminClient } from '@/lib/supabase'
import { validateUrl, normalizeUrl } from '@/lib/utils'
import { runScan } from '@/services/scanner'
import { resolveAccess, rateLimitDescription } from '@/lib/access-control'
import { extractDomain, findPrevScanId } from '@/services/regression-worker'
import { DEDUP_WINDOW_MINUTES, MAX_CONCURRENT_SCANS } from '@/services/ai-config'
import { createSession, getSessionMetadata } from '@/services/auth-session'
import type { AuthConfig } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 300

const InlineAuthSchema = z.object({
  kind:         z.enum(['cookies', 'storage_state', 'headers', 'combined']),
  cookies:      z.array(z.object({
    name:     z.string(),
    value:    z.string(),
    domain:   z.string().optional(),
    path:     z.string().optional(),
    secure:   z.boolean().optional(),
    httpOnly: z.boolean().optional(),
    sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
    expires:  z.number().optional(),
  })).optional(),
  storageState: z.string().optional(),
  headers:      z.record(z.string()).optional(),
  loginUrl:     z.string().optional(),
}).optional()

const RequestSchema = z.object({
  url:         z.string().min(1, 'URL is required').max(2048, 'URL is too long'),
  email:       z.string().email().optional().or(z.literal('')),
  forceRescan: z.boolean().optional(),
  sessionId:   z.string().uuid().optional(),   // reference to stored scan_sessions row
  auth:        InlineAuthSchema,               // one-shot inline auth (stored as ephemeral session)
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    )
  }

  const { url: rawUrl, email, forceRescan, sessionId, auth } = parsed.data
  const url = normalizeUrl(rawUrl)

  const { valid, error: urlError } = validateUrl(url)
  if (!valid) {
    return NextResponse.json({ error: urlError }, { status: 422 })
  }

  // ── Access control ───────────────────────────────────────────────────────────
  // Resolve role from email + optional x-founder-token header.
  // Admins bypass IP rate limiting and get unlimited AI analysis.
  const founderToken = req.headers.get('x-founder-token')
  const access = resolveAccess(email, founderToken)

  const forwarded = req.headers.get('x-forwarded-for')
  const clientIp  = forwarded ? forwarded.split(',')[0].trim() : null

  const db = getAdminClient()

  // ── Deduplication: reuse a recent scan for the same URL ─────────────────────
  const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString()
  const { data: recentRows } = await db
    .from('scans')
    .select('id, status, completed_at')
    .eq('url', url)
    .in('status', ['pending', 'running', 'completed'])
    .gte('created_at', dedupCutoff)
    .order('created_at', { ascending: false })
    .limit(1)

  const recent = recentRows?.[0] as { id: string; status: string; completed_at: string | null } | undefined
  if (recent) {
    const isInProgress = recent.status === 'pending' || recent.status === 'running'

    // Always deduplicate in-progress scans — no value in two concurrent scans for same URL.
    if (isInProgress) {
      console.log(`[POST /api/scan] dedup:in-progress url=${url} scanId=${recent.id}`)
      if (email) {
        await db.from('scans').update({ notify_email: email }).eq('id', recent.id).is('notify_email', null)
      }
      return NextResponse.json({ scanId: recent.id, cached: true, running: true }, { status: 200 })
    }

    // Completed scan: skip dedup when the user explicitly asks for a fresh scan.
    if (!forceRescan) {
      console.log(`[POST /api/scan] dedup:completed url=${url} scanId=${recent.id}`)
      if (email) {
        await db.from('scans').update({ notify_email: email }).eq('id', recent.id).is('notify_email', null)
      }
      return NextResponse.json(
        { scanId: recent.id, cached: true, completedAt: recent.completed_at },
        { status: 200 },
      )
    }

    console.log(`[POST /api/scan] force-rescan url=${url} bypassing completed scan ${recent.id}`)
  }

  // ── Per-IP rate limit (skipped for admin/founder accounts) ──────────────────
  if (!access.bypassRateLimit && clientIp) {
    const windowMs    = access.windowMinutes * 60 * 1000
    const windowStart = new Date(Date.now() - windowMs).toISOString()
    const { count: ipCount, error: ipCountError } = await db
      .from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('ip', clientIp)
      .gte('created_at', windowStart)

    // Fail-safe: count query error → treat as exceeded
    if (ipCountError || (ipCount ?? access.scansPerWindow) >= access.scansPerWindow) {
      const retryAfterSeconds = access.windowMinutes * 60
      console.log(`[POST /api/scan] rate-limit ip=${clientIp} count=${ipCount ?? '?'} limit=${access.scansPerWindow}/${access.windowMinutes}min`)
      return NextResponse.json(
        {
          error: `You've reached the free scan limit (${rateLimitDescription(access)}). Please try again in ${access.windowMinutes} minutes.`,
          retryAfterSeconds,
          role: access.role,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
            'X-RateLimit-Limit': String(access.scansPerWindow),
            'X-RateLimit-Window': `${access.windowMinutes}m`,
          },
        }
      )
    }
  } else if (access.bypassRateLimit) {
    console.log(`[POST /api/scan] rate-limit bypassed role:${access.role} email:${access.email ?? 'none'}`)
  }

  // ── Queue limit: prevent overloading the scanner ─────────────────────────────
  const { count: activeCount, error: activeCountError } = await db
    .from('scans')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'running'])

  // Fail-safe: count error → treat as busy. Admins bypass the queue ceiling too.
  if (!access.bypassRateLimit) {
    if (activeCountError || (activeCount ?? MAX_CONCURRENT_SCANS) >= MAX_CONCURRENT_SCANS) {
      return NextResponse.json(
        { error: 'Scanner is busy right now. Please try again in a few minutes.' },
        { status: 429 }
      )
    }
  }

  // ── Resolve session ID ───────────────────────────────────────────────────────
  let resolvedSessionId: string | null = null

  if (auth && access.bypassRateLimit) {
    // Inline auth: create a short-lived ephemeral session (1 hour TTL)
    const authPayload: AuthConfig = {
      kind: auth.kind,
      ...(auth.cookies        ? { cookies: auth.cookies }           : {}),
      ...(auth.storageState   ? { storageState: auth.storageState } : {}),
      ...(auth.headers        ? { headers: auth.headers }           : {}),
      ...(auth.loginUrl       ? { loginUrl: auth.loginUrl }         : {}),
    }
    try {
      const session = await createSession(
        email || 'ephemeral',
        authPayload,
        'ephemeral',
        new Date(Date.now() + 3600_000),
      )
      resolvedSessionId = session.id
      console.log(`[POST /api/scan] ephemeral session=${session.id} kind=${auth.kind}`)
    } catch (err) {
      console.error('[POST /api/scan] failed to create ephemeral session:', err)
    }
  } else if (sessionId) {
    const existing = await getSessionMetadata(sessionId)
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    resolvedSessionId = sessionId
  }

  // ── Create scan record ───────────────────────────────────────────────────────
  const domain = extractDomain(url)
  const prevScanId = await findPrevScanId(url)

  const { data: scan, error: dbError } = await db
    .from('scans')
    .insert({ url, domain, status: 'pending', ip: clientIp ?? null, notify_email: email || null, prev_scan_id: prevScanId, session_id: resolvedSessionId })
    .select('id')
    .single()

  if (dbError || !scan) {
    console.error('[POST /api/scan] DB insert error:', dbError?.message)
    return NextResponse.json(
      { error: 'Failed to create scan. Check database configuration.' },
      { status: 500 }
    )
  }

  const scanId: string = scan.id
  console.log(
    `[POST /api/scan] new-scan url=${url} scanId=${scanId} role:${access.role}` +
    (forceRescan ? ' (forced)' : '')
  )

  waitUntil(
    runScan(scanId, url).catch((err: unknown) => {
      console.error(`[runScan] unhandled error for ${scanId}:`, err)
    })
  )

  // Include role in response so the client can store it alongside the scan ID.
  // Admins use this to surface the debug panel in the results view.
  return NextResponse.json(
    { scanId, role: access.role },
    { status: 202 }
  )
}
