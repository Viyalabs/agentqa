import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

function scoreColor(score: number): string {
  if (score >= 85) return '#22c55e'  // green-500
  if (score >= 70) return '#eab308'  // yellow-500
  if (score >= 50) return '#f97316'  // orange-500
  return '#ef4444'                    // red-500
}

function badge(score: number | null, label = 'QA score'): string {
  const value = score !== null ? `${score}/100` : 'pending'
  const color = score !== null ? scoreColor(score) : '#71717a'

  const labelWidth = label.length * 6.2 + 10
  const valueWidth = value.length * 7 + 10
  const totalWidth = labelWidth + valueWidth

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0"  stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1"  stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth / 2 + 1}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}"     y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2 + 1}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${labelWidth + valueWidth / 2}"     y="14">${value}</text>
  </g>
</svg>`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const db = getAdminClient()
  const { data: scan } = await db
    .from('scans')
    .select('score, status')
    .eq('id', id)
    .single()

  const score = scan?.score ?? null
  const svg = badge(score)

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600',
    },
  })
}
