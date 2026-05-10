/**
 * CI/CD Webhook — POST /api/webhook/scan
 *
 * Runs a full QA scan synchronously and returns results as JSON.
 * Returns HTTP 200 when score >= failThreshold, HTTP 422 otherwise (fails the build).
 *
 * Authentication: x-api-key header (or Authorization: Bearer <key>)
 * Set WEBHOOK_API_KEY env var (comma-separated for multiple keys).
 *
 * Example (GitHub Actions):
 *   curl -X POST https://agentqa.viyalabs.com/api/webhook/scan \
 *     -H "x-api-key: $AGENTQA_API_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d '{"url":"https://my-preview.vercel.app","failThreshold":80}'
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminClient } from '@/lib/supabase'
import { validateUrl, normalizeUrl } from '@/lib/utils'
import { runScan } from '@/services/scanner'

export const runtime = 'nodejs'
export const maxDuration = 300

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agentqa.viyalabs.com'

const RequestSchema = z.object({
  url: z.string().min(1, 'URL is required').max(2048, 'URL is too long'),
  failThreshold: z.number().int().min(0).max(100).optional().default(70),
})

function isValidApiKey(req: NextRequest): boolean {
  const rawKeys = process.env.WEBHOOK_API_KEY ?? ''
  const validKeys = rawKeys.split(',').map((k) => k.trim()).filter(Boolean)
  if (validKeys.length === 0) return false

  const provided =
    req.headers.get('x-api-key') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null

  return provided !== null && validKeys.includes(provided)
}

export async function POST(req: NextRequest) {
  if (!isValidApiKey(req)) {
    return NextResponse.json(
      { error: 'Invalid or missing API key. Set x-api-key header.' },
      { status: 401 }
    )
  }

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

  const { url: rawUrl, failThreshold } = parsed.data
  const url = normalizeUrl(rawUrl)
  const { valid, error: urlError } = validateUrl(url)
  if (!valid) {
    return NextResponse.json({ error: urlError }, { status: 422 })
  }

  const db = getAdminClient()

  const { data: scan, error: dbError } = await db
    .from('scans')
    .insert({ url, status: 'pending' })
    .select('id')
    .single()

  if (dbError || !scan) {
    console.error('[webhook/scan] DB insert error:', dbError?.message)
    return NextResponse.json({ error: 'Failed to create scan' }, { status: 500 })
  }

  const scanId: string = scan.id

  // Run synchronously — webhook caller waits for results
  await runScan(scanId, url).catch((err: unknown) => {
    console.error(`[webhook/scan] runScan error for ${scanId}:`, err)
  })

  const [{ data: scanRow }, { data: issues }] = await Promise.all([
    db.from('scans').select('*').eq('id', scanId).single(),
    db
      .from('issues')
      .select('type, severity, title, description')
      .eq('scan_id', scanId)
      .order('severity'),
  ])

  const score = scanRow?.score ?? 0
  const passed = score >= failThreshold

  const criticalIssues =
    issues?.filter((i) => i.severity === 'critical').map((i) => ({
      type: i.type,
      title: i.title,
      description: i.description,
    })) ?? []

  return NextResponse.json(
    {
      passed,
      score,
      failThreshold,
      scanId,
      url,
      reportUrl: `${APP_URL}/report/${scanId}`,
      summary: {
        totalPages: scanRow?.total_pages ?? 0,
        totalIssues: scanRow?.total_issues ?? 0,
        critical: issues?.filter((i) => i.severity === 'critical').length ?? 0,
        medium: issues?.filter((i) => i.severity === 'medium').length ?? 0,
        low: issues?.filter((i) => i.severity === 'low').length ?? 0,
      },
      criticalIssues,
    },
    { status: passed ? 200 : 422 }
  )
}
