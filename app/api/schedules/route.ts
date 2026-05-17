import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminClient } from '@/lib/supabase'
import { resolveAccess } from '@/lib/access-control'
import { validateUrl, normalizeUrl } from '@/lib/utils'
import { nextRunIso, generateWebhookSecret } from '@/lib/scheduler'
import { extractDomain } from '@/services/regression-worker'

export const runtime = 'nodejs'

const CreateSchema = z.object({
  url:     z.string().min(1).max(2048),
  cadence: z.enum(['daily', 'weekly', 'manual', 'webhook']),
  email:   z.string().email(),
})

// POST /api/schedules — create a new scheduled scan
export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const { url: rawUrl, cadence, email } = parsed.data
  const url = normalizeUrl(rawUrl)

  const { valid, error: urlError } = validateUrl(url)
  if (!valid) return NextResponse.json({ error: urlError }, { status: 422 })

  const domain = extractDomain(url)

  const founderToken = req.headers.get('x-founder-token')
  const access = resolveAccess(email, founderToken)
  const isInternal = access.bypassRateLimit

  const db = getAdminClient()
  const forwarded = req.headers.get('x-forwarded-for')
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : null

  // Free-tier: 1 schedule per domain (enforced by DB unique index + guard here)
  if (!isInternal) {
    const { data: existing } = await db
      .from('scan_schedules')
      .select('id, cadence, enabled')
      .eq('domain', domain)
      .eq('enabled', true)
      .limit(1)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: `A schedule for ${domain} already exists. Free accounts may monitor one domain. Upgrade for more.`, scheduleId: existing.id },
        { status: 409 }
      )
    }
  }

  const webhookSecret = cadence === 'webhook' ? generateWebhookSecret() : null

  const { data: schedule, error: dbError } = await db
    .from('scan_schedules')
    .insert({
      domain,
      url,
      cadence,
      notify_email:  email,
      is_internal:   isInternal,
      enabled:       true,
      webhook_secret: webhookSecret,
      next_run_at:   nextRunIso(cadence),
      created_by_ip: clientIp,
    })
    .select('id, domain, url, cadence, next_run_at, webhook_secret')
    .single()

  if (dbError || !schedule) {
    // Unique constraint violation = duplicate domain (race condition)
    if (dbError?.code === '23505') {
      return NextResponse.json({ error: `A schedule for ${domain} already exists.` }, { status: 409 })
    }
    console.error('[POST /api/schedules] DB error:', dbError?.message)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }

  console.log(`[POST /api/schedules] created schedule=${schedule.id} domain=${domain} cadence=${cadence}`)
  return NextResponse.json(schedule, { status: 201 })
}

// GET /api/schedules?email= — list schedules for an email
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 })

  const founderToken = req.headers.get('x-founder-token')
  const access = resolveAccess(email, founderToken)

  const db = getAdminClient()
  const query = db
    .from('scan_schedules')
    .select('id, domain, url, cadence, notify_email, enabled, next_run_at, last_run_at, last_scan_id, consecutive_failures, paused_reason, created_at, updated_at')
    .order('created_at', { ascending: false })

  // Admins can see all; regular users see only their own
  if (!access.bypassRateLimit) {
    query.eq('notify_email', email)
  }

  const { data, error } = await query
  if (error) {
    console.error('[GET /api/schedules] DB error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
  }

  return NextResponse.json({ schedules: data ?? [] })
}
