import Link from 'next/link'
import { AlertCircle, AlertTriangle, Info, ArrowRight, Clock } from 'lucide-react'
import { getAdminClient } from '@/lib/supabase'

export const revalidate = 60

interface RecentScan {
  id: string
  url: string
  score: number
  total_issues: number
  completed_at: string
}

function scoreColor(score: number) {
  if (score >= 80) return { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' }
  if (score >= 60) return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' }
  return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' }
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function extractDomain(url: string) {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

async function getRecentScans(): Promise<RecentScan[]> {
  try {
    const db = getAdminClient()
    const { data } = await db
      .from('scans')
      .select('id, url, score, total_issues, completed_at')
      .eq('status', 'completed')
      .not('score', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(6)
    return (data ?? []) as RecentScan[]
  } catch {
    return []
  }
}

export async function RecentReports() {
  const scans = await getRecentScans()
  if (scans.length < 3) return null

  return (
    <section className="py-16 border-y border-zinc-800/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-3">Live results</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
            Real reports, scanned right now
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-xl mx-auto">
            Every card below is a real scan that just ran. Click any to see the full report.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {scans.map((scan) => {
            const { text, bg, border } = scoreColor(scan.score)
            const domain = extractDomain(scan.url)
            return (
              <Link
                key={scan.id}
                href={`/report/${scan.id}`}
                className="group p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all flex flex-col gap-4"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-mono text-zinc-200 truncate group-hover:text-white transition-colors">
                      {domain}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-zinc-600">
                      <Clock className="h-3 w-3 shrink-0" />
                      {timeAgo(scan.completed_at)}
                    </div>
                  </div>
                  <div className={`shrink-0 px-3 py-1.5 rounded-lg ${bg} border ${border}`}>
                    <span className={`text-lg font-bold tabular-nums ${text}`}>{scan.score}</span>
                    <span className="text-xs text-zinc-600">/100</span>
                  </div>
                </div>

                {/* Issue count row */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    {scan.total_issues === 0
                      ? 'No issues found'
                      : `${scan.total_issues} issue${scan.total_issues !== 1 ? 's' : ''} found`}
                  </span>
                  <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    View report <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/scans"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            See all recent scans <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
