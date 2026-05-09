import { NextRequest, NextResponse } from 'next/server'
import { getTopPatterns } from '@/services/pattern-matcher'

export const runtime = 'nodejs'

const VALID_SORTS = new Set(['frequency', 'trending', 'recent', 'confidence'])

const VALID_TYPES = new Set([
  'js_error', 'console_error', 'network_failure', 'page_crash', 'page_not_found',
  'navigation_failure', 'missing_image', 'broken_form', 'slow_load',
  'console_warning', 'mobile_layout', 'large_asset',
])

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const sort   = searchParams.get('sort') ?? 'frequency'
  const type   = searchParams.get('type') ?? undefined
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

  if (!VALID_SORTS.has(sort)) {
    return NextResponse.json({ error: 'Invalid sort. Use: frequency, trending, recent, confidence' }, { status: 400 })
  }
  if (type && !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid type filter' }, { status: 400 })
  }

  const { patterns, total } = await getTopPatterns({
    sort: sort as 'frequency' | 'trending' | 'recent' | 'confidence',
    type,
    limit,
    offset,
  })

  return NextResponse.json({ patterns, total, limit, offset })
}
