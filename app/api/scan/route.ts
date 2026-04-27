import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminClient } from '@/lib/supabase'
import { validateUrl, normalizeUrl } from '@/lib/utils'
import { runScan } from '@/services/scanner'

// Use Node.js runtime — required for Playwright
export const runtime = 'nodejs'
export const maxDuration = 120

const RequestSchema = z.object({
  url: z.string().min(1, 'URL is required').max(2048, 'URL is too long'),
})

export async function POST(req: NextRequest) {
  // Parse body
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

  const { url: rawUrl } = parsed.data
  const url = normalizeUrl(rawUrl)

  const { valid, error: urlError } = validateUrl(url)
  if (!valid) {
    return NextResponse.json({ error: urlError }, { status: 422 })
  }

  // Create the scan record
  const db = getAdminClient()
  const { data: scan, error: dbError } = await db
    .from('scans')
    .insert({ url, status: 'pending' })
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

  // Fire-and-forget: start the scan without blocking the HTTP response.
  // The scan writes results to Supabase progressively.
  // The frontend polls GET /api/scan/[id] for status.
  void runScan(scanId, url).catch((err) => {
    console.error(`[runScan] Unhandled error for scan ${scanId}:`, err)
  })

  return NextResponse.json({ scanId }, { status: 202 })
}
