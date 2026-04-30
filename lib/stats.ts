import { createClient } from '@supabase/supabase-js'

export interface HomeStats {
  appsScanned: number
  bugsCaught: number
}

const FALLBACK: HomeStats = { appsScanned: 0, bugsCaught: 0 }

export async function getHomeStats(): Promise<HomeStats> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return FALLBACK

  try {
    const db = createClient(url, key)

    const [{ count }, { data }] = await Promise.all([
      db
        .from('scans')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed'),
      db
        .from('scans')
        .select('total_issues')
        .eq('status', 'completed'),
    ])

    const bugsCaught = data?.reduce((sum, row) => sum + (row.total_issues ?? 0), 0) ?? 0

    return {
      appsScanned: count ?? 0,
      bugsCaught,
    }
  } catch {
    return FALLBACK
  }
}

export function formatStat(value: number, fallback: string): string {
  if (value === 0) return fallback
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toLocaleString()
}
