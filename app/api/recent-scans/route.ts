import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const revalidate = 60

export async function GET() {
  const db = getAdminClient()
  const { data } = await db
    .from('scans')
    .select('id, url, score, total_issues, completed_at')
    .eq('status', 'completed')
    .not('score', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(6)

  return NextResponse.json({ scans: data ?? [] }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}
