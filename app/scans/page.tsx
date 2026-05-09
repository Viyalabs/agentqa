import type { Metadata } from 'next'
import Link from 'next/link'
import { Activity, ExternalLink, Clock, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { getAdminClient } from '@/lib/supabase'
import { getScoreColor, getScoreLabel, formatTimestamp, truncateUrl } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Recent Scans — AgentQA',
  description: 'Live QA reports for recently scanned websites, powered by AgentQA.',
}

export const dynamic = 'force-dynamic'

export default async function ScansPage() {
  const db = getAdminClient()
  const { data: scans } = await db
    .from('scans')
    .select('id, url, score, total_pages, total_issues, completed_at, created_at')
    .eq('status', 'completed')
    .not('score', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(50)

  // Batch-fetch severity breakdown for all returned scans in one query
  const scanIds = (scans ?? []).map((s) => s.id)
  const { data: issueRows } = scanIds.length > 0
    ? await db.from('issues').select('scan_id, severity').in('scan_id', scanIds)
    : { data: [] }

  type SeverityMap = { critical: number; medium: number; low: number }
  const severityByScan = new Map<string, SeverityMap>()
  for (const row of issueRows ?? []) {
    if (!severityByScan.has(row.scan_id)) {
      severityByScan.set(row.scan_id, { critical: 0, medium: 0, low: 0 })
    }
    const s = severityByScan.get(row.scan_id)!
    if (row.severity === 'critical') s.critical++
    else if (row.severity === 'medium') s.medium++
    else s.low++
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <nav className="sticky top-0 z-40 border-b border-zinc-800/50 bg-[#0A0A0F]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-white">
            <Activity className="h-5 w-5 text-blue-400" />
            AgentQA
          </Link>
          <div className="flex items-center gap-5 text-sm text-zinc-400">
            <Link href="/patterns" className="hover:text-zinc-200 transition-colors">Patterns</Link>
            <Link href="/" className="hover:text-zinc-200 transition-colors">Run a scan →</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-2">Recent Scans</h1>
          <p className="text-base text-zinc-400 leading-relaxed">
            The last {scans?.length ?? 0} completed QA scans. All reports are public and permanent.
          </p>
        </div>

        {!scans || scans.length === 0 ? (
          <p className="text-zinc-500 text-sm">No completed scans yet.</p>
        ) : (
          <div className="space-y-2">
            {scans.map((scan) => {
              const sev = severityByScan.get(scan.id) ?? { critical: 0, medium: 0, low: 0 }
              return (
                <Link
                  key={scan.id}
                  href={`/report/${scan.id}`}
                  className="group flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all"
                >
                  <div
                    className={`shrink-0 text-2xl font-bold tabular-nums w-12 text-right ${
                      scan.score !== null ? getScoreColor(scan.score) : 'text-zinc-600'
                    }`}
                  >
                    {scan.score ?? '–'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm text-zinc-300 font-mono group-hover:text-white transition-colors">
                      <span className="truncate">{truncateUrl(scan.url, 60)}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-zinc-600" />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-600 flex-wrap">
                      <span>{scan.total_pages} page{scan.total_pages !== 1 ? 's' : ''}</span>
                      {scan.total_issues > 0 ? (
                        <>
                          {sev.critical > 0 && (
                            <span className="flex items-center gap-0.5 text-red-400">
                              <AlertCircle className="h-3 w-3" />
                              {sev.critical}
                            </span>
                          )}
                          {sev.medium > 0 && (
                            <span className="flex items-center gap-0.5 text-yellow-400">
                              <AlertTriangle className="h-3 w-3" />
                              {sev.medium}
                            </span>
                          )}
                          {sev.low > 0 && (
                            <span className="flex items-center gap-0.5 text-blue-400">
                              <Info className="h-3 w-3" />
                              {sev.low}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-green-600">No issues</span>
                      )}
                      {(scan.completed_at ?? scan.created_at) && (
                        <span className="flex items-center gap-1 ml-auto">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(scan.completed_at ?? scan.created_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {scan.score !== null && (
                    <div className={`shrink-0 text-xs font-medium hidden sm:block ${getScoreColor(scan.score)}`}>
                      {getScoreLabel(scan.score)}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
