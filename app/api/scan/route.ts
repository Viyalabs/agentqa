import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { z } from 'zod'
import { getAdminClient } from '@/lib/supabase'
import { validateUrl, normalizeUrl } from '@/lib/utils'
import { runScan } from '@/services/scanner'
import { DEDUP_WINDOW_MINUTES, MAX_CONCURRENT_SCANS, MAX_SCANS_PER_IP_PER_HOUR } from '@/services/ai-config'

export const runtime = 'nodejs'
export const maxDuration = 300

const RequestSchema = z.object({
  url:          z.string().min(1, 'URL is required').max(2048, 'URL is too long'),
  email:        z.string().email().optional().or(z.literal('')),
  forceRescan:  z.boolean().optional(),
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

  const { url: rawUrl, email, forceRescan } = parsed.data
  const url = normalizeUrl(rawUrl)

  const { valid, error: urlError } = validateUrl(url)
  if (!valid) {
    return NextResponse.json({ error: urlError }, { status: 422 })
  }

  const forwarded = req.headers.get('x-forwarded-for')
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : null

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

    // Always deduplicate in-progress scans — no value in running two concurrent
    // scans for the same URL. forceRescan cannot override this.
    if (isInProgress) {
      console.log(`[POST /api/scan] dedup:in-progress url=${url} scanId=${recent.id}`)
      if (email) {
        await db.from('scans').update({ notify_email: email }).eq('id', recent.id).is('notify_email', null)
      }
      return NextResponse.json({ scanId: recent.id, cached: true, running: true }, { status: 200 })
    }

    // Completed scan: skip dedup when the user explicitly asks for a fresh scan
    if (!forceRescan) {
      console.log(`[POST /api/scan] dedup:completed url=${url} scanId=${recent.id} completedAt=${recent.completed_at}`)
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

  // ── Per-IP rate limit ────────────────────────────────────────────────────────
  if (clientIp) {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: ipCount, error: ipCountError } = await db
      .from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('ip', clientIp)
      .gte('created_at', hourAgo)

    // Fail-safe: if the count query errors, treat as exceeded to prevent bypass
    if (ipCountError || (ipCount ?? MAX_SCANS_PER_IP_PER_HOUR) >= MAX_SCANS_PER_IP_PER_HOUR) {
      return NextResponse.json(
        { error: "You've run too many scans recently. Please wait a moment and try again." },
        { status: 429 }
      )
    }
  }

  // ── Queue limit: prevent overloading the scanner ─────────────────────────────
  const { count: activeCount, error: activeCountError } = await db
    .from('scans')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'running'])

  // Fail-safe: if the count query errors, treat as busy to prevent queue flooding
  if (activeCountError || (activeCount ?? MAX_CONCURRENT_SCANS) >= MAX_CONCURRENT_SCANS) {
    return NextResponse.json(
      { error: 'Scanner is busy right now. Please try again in a few minutes.' },
      { status: 429 }
    )
  }

  // ── Create scan record ───────────────────────────────────────────────────────
  const { data: scan, error: dbError } = await db
    .from('scans')
    .insert({ url, status: 'pending', ip: clientIp ?? null, notify_email: email || null })
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
  console.log(`[POST /api/scan] new-scan url=${url} scanId=${scanId}${forceRescan ? ' (forced)' : ''}`)

  waitUntil(
    runScan(scanId, url).catch((err: unknown) => {
      console.error(`[runScan] unhandled error for ${scanId}:`, err)
    })
  )

  return NextResponse.json({ scanId }, { status: 202 })
}
