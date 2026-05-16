import Link from 'next/link'
import { AlertCircle, AlertTriangle, ArrowRight, Clock } from 'lucide-react'
import { getAdminClient } from '@/lib/supabase'

export const revalidate = 60

interface RecentScan {
  id: string
  url: string
  score: number
  total_issues: number
  completed_at: string
  critical: number
  medium: number
  low: number
}

function scoreColor(score: number) {
  if (score >= 80) return { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', bar: '#4ade80' }
  if (score >= 60) return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', bar: '#facc15' }
  return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', bar: '#f87171' }
}

function scoreLabel(score: number) {
  if (score >= 80) return 'Good'
  if (score >= 60) return 'Fair'
  return 'Needs work'
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function isRecent(iso: string) {
  return (Date.now() - new Date(iso).getTime()) < 60 * 60 * 1000
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

    const { data: scans } = await db
      .from('scans')
      .select('id, url, score, total_issues, completed_at')
      .eq('status', 'completed')
      .not('score', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(6)

    if (!scans?.length) return []

    const scanIds = scans.map((s: { id: string }) => s.id)
    const { data: issueRows } = await db
      .from('issues')
      .select('scan_id, severity')
      .in('scan_id', scanIds)
      .in('severity', ['critical', 'medium', 'low'])

    type Counts = { critical: number; medium: number; low: number }
    const counts: Record<string, Counts> = {}
    for (const row of (issueRows ?? []) as { scan_id: string; severity: string }[]) {
      if (!counts[row.scan_id]) counts[row.scan_id] = { critical: 0, medium: 0, low: 0 }
      if (row.severity === 'critical') counts[row.scan_id].critical++
      else if (row.severity === 'medium') counts[row.scan_id].medium++
      else if (row.severity === 'low') counts[row.scan_id].low++
    }

    return scans.map((s: { id: string; url: string; score: number; total_issues: number; completed_at: string }) => ({
      ...s,
      critical: counts[s.id]?.critical ?? 0,
      medium:   counts[s.id]?.medium   ?? 0,
      low:      counts[s.id]?.low      ?? 0,
    }))
  } catch {
    return []
  }
}

export async function RecentReports() {
  const scans = await getRecentScans()
  if (scans.length < 3) return null

  return (
    <section className="py-20 border-y border-zinc-800/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Live results</p>
          </div>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Real reports, running right now
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-xl mx-auto">
            Every card is a live scan that just completed. Click any to see the full report — screenshots, JS errors, network failures, and AI root cause.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {scans.map((scan) => {
            const { text, bg, border, bar } = scoreColor(scan.score)
            const domain = extractDomain(scan.url)
            const recent = isRecent(scan.completed_at)
            const label = scoreLabel(scan.score)
            const hasSeverity = scan.critical > 0 || scan.medium > 0

            return (
              <Link
                key={scan.id}
                href={`/report/${scan.id}`}
                className="group relative flex flex-col p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all duration-200 h-full overflow-hidden"
              >
                {/* Top: timestamp + live indicator */}
                <div className="flex items-center gap-1.5 mb-4">
                  {recent ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                      <span className="text-xs text-green-400 font-medium">live</span>
                      <span className="text-xs text-zinc-600 ml-0.5">· {timeAgo(scan.completed_at)}</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3 text-zinc-600 shrink-0" />
                      <span className="text-xs text-zinc-500">{timeAgo(scan.completed_at)}</span>
                    </>
                  )}
                </div>

                {/* Domain + Score */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white transition-colors leading-snug">
                      {domain}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {scan.total_issues === 0
                        ? 'No issues found'
                        : `${scan.total_issues} issue${scan.total_issues !== 1 ? 's' : ''} detected`}
                    </div>
                  </div>
                  <div className={`shrink-0 text-center min-w-[56px] px-3 py-2 rounded-xl ${bg} border ${border}`}>
                    <div className={`text-2xl font-bold tabular-nums leading-none ${text}`}>{scan.score}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 tabular-nums">/100</div>
                  </div>
                </div>

                {/* Score bar */}
                <div className="h-1 bg-zinc-800 rounded-full mb-4 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${scan.score}%`, background: bar }}
                  />
                </div>

                {/* Severity breakdown */}
                <div className="flex items-center gap-3 flex-1">
                  {hasSeverity ? (
                    <>
                      {scan.critical > 0 && (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 text-red-400 shrink-0" />
                          <span className="text-xs font-semibold text-red-400">{scan.critical}</span>
                          <span className="text-xs text-zinc-600">critical</span>
                        </div>
                      )}
                      {scan.medium > 0 && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-yellow-400 shrink-0" />
                          <span className="text-xs font-semibold text-yellow-400">{scan.medium}</span>
                          <span className="text-xs text-zinc-600">medium</span>
                        </div>
                      )}
                      {scan.low > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-blue-400/60 shrink-0" />
                          <span className="text-xs font-semibold text-blue-400">{scan.low}</span>
                          <span className="text-xs text-zinc-600">low</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-green-400 font-medium">Clean scan</span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800/60">
                  <span className={`text-xs font-semibold ${text}`}>{label}</span>
                  <span className="text-xs text-blue-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    View report <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="mt-10 text-center">
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
