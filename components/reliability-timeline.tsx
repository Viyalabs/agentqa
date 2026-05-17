'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Clock,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Loader2,
} from 'lucide-react'
import type { DomainTimelineEntry, DomainIssueState } from '@/types'
import { getScoreColor } from '@/lib/utils'

interface TimelineResponse {
  domain: string
  timeline: DomainTimelineEntry[]
  open_issues: (DomainIssueState & { days_unresolved: number })[]
}

interface ReliabilityTimelineProps {
  domain: string
  currentScanId: string
  currentScore: number | null
  regressionNew: number
  regressionResolved: number
  regressionRecurring: number
  regressionWorsened: number
  regressionImproved: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreBand(score: number) {
  if (score >= 90) return { bar: 'bg-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500/30' }
  if (score >= 75) return { bar: 'bg-blue-500',    text: 'text-blue-400',    ring: 'ring-blue-500/30' }
  if (score >= 50) return { bar: 'bg-amber-500',   text: 'text-amber-400',   ring: 'ring-amber-500/30' }
  return              { bar: 'bg-red-500',          text: 'text-red-400',     ring: 'ring-red-500/30' }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)  return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RegressionChip({ kind, count }: { kind: 'new' | 'resolved' | 'recurring' | 'worsened' | 'improved'; count: number }) {
  if (count === 0) return null
  const cfg = {
    new:      { label: `+${count} new`,      cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
    worsened: { label: `↑${count} worsened`, cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
    resolved: { label: `✓${count} resolved`, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    improved: { label: `↓${count} improved`, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    recurring:{ label: `↩${count} recurring`,cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  }[kind]
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function ScoreBadge({ score, size = 'sm' }: { score: number | null; size?: 'sm' | 'lg' }) {
  if (score === null) return <span className="text-zinc-600 font-mono text-xs">—</span>
  const { text } = scoreBand(score)
  const cls = size === 'lg'
    ? `text-2xl font-bold tabular-nums ${text}`
    : `text-sm font-bold tabular-nums font-mono ${text}`
  return <span className={cls}>{score}</span>
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return null
  const up = delta > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? '+' : ''}{delta}
    </span>
  )
}

// ── Score sparkline ────────────────────────────────────────────────────────────

function ScoreSparkline({ entries, currentScanId }: { entries: DomainTimelineEntry[]; currentScanId: string }) {
  const scores = entries.map(e => e.score ?? 0)
  const max = Math.max(...scores, 100)

  return (
    <div className="flex items-end gap-1" style={{ height: 40 }}>
      {entries.map((entry) => {
        const score = entry.score ?? 0
        const pct   = Math.max((score / max) * 100, 4)
        const { bar } = scoreBand(score)
        const isCurrent = entry.scan_id === currentScanId
        return (
          <div
            key={entry.scan_id}
            title={`Score ${score} · ${relativeTime(entry.completed_at)}`}
            className="flex-1 rounded-sm transition-all"
            style={{ height: `${pct}%` }}
          >
            <div className={`h-full w-full rounded-sm ${bar} ${isCurrent ? 'opacity-100 ring-1 ring-white/30' : 'opacity-40 hover:opacity-70 transition-opacity'}`} />
          </div>
        )
      })}
    </div>
  )
}

// ── Timeline entry row ────────────────────────────────────────────────────────

function TimelineRow({ entry, isCurrent }: { entry: DomainTimelineEntry; isCurrent: boolean }) {
  const hasChanges = entry.regression_new + entry.regression_resolved + entry.regression_recurring + entry.regression_worsened + entry.regression_improved > 0
  return (
    <div className={`flex items-start gap-3 px-4 py-3 group hover:bg-zinc-800/30 transition-colors ${isCurrent ? 'bg-zinc-800/20' : ''}`}>
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <div className={`w-2 h-2 rounded-full ring-2 ring-zinc-950 ${isCurrent ? 'bg-blue-400' : 'bg-zinc-700'}`} />
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/report/${entry.scan_id}`}
            className="flex items-center gap-1.5 hover:text-white transition-colors group-hover:underline"
          >
            <ScoreBadge score={entry.score} />
            {isCurrent && <span className="text-[10px] text-blue-400 font-medium">current</span>}
          </Link>
          <DeltaBadge delta={entry.score_delta} />
          <span className="text-[10px] text-zinc-600 font-mono ml-auto shrink-0">
            {relativeTime(entry.completed_at)}
          </span>
        </div>

        {hasChanges && (
          <div className="flex flex-wrap gap-1">
            <RegressionChip kind="new"       count={entry.regression_new} />
            <RegressionChip kind="worsened"  count={entry.regression_worsened} />
            <RegressionChip kind="resolved"  count={entry.regression_resolved} />
            <RegressionChip kind="improved"  count={entry.regression_improved} />
            <RegressionChip kind="recurring" count={entry.regression_recurring} />
          </div>
        )}
        {!hasChanges && entry.scan_id !== undefined && (
          <span className="text-[10px] text-zinc-700">No changes from previous scan</span>
        )}
      </div>
    </div>
  )
}

// ── Recurring issue row ───────────────────────────────────────────────────────

function RecurringIssueRow({ issue }: { issue: DomainIssueState & { days_unresolved: number } }) {
  const isRecurring = issue.current_status === 'recurring'
  const sevColor = issue.current_severity === 'critical'
    ? 'text-red-400'
    : issue.current_severity === 'medium'
    ? 'text-amber-400'
    : 'text-zinc-400'

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-zinc-800/20 transition-colors">
      <div className="shrink-0 mt-0.5">
        {isRecurring
          ? <RotateCcw className="h-3.5 w-3.5 text-orange-400" />
          : <AlertCircle className={`h-3.5 w-3.5 ${sevColor}`} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-mono font-medium ${sevColor}`}>
            {issue.fingerprint.replace(/_/g, ' ')}
          </span>
          {isRecurring && (
            <span className="text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded font-medium">
              recurring
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {issue.consecutive_scans_seen > 1 && (
            <span className="text-[10px] text-zinc-500">
              seen in {issue.consecutive_scans_seen} consecutive scans
            </span>
          )}
          {issue.days_unresolved > 0 && (
            <span className="text-[10px] text-zinc-600">
              unresolved {issue.days_unresolved}d
            </span>
          )}
          {issue.total_occurrences > 1 && (
            <span className="text-[10px] text-zinc-600">
              {issue.total_occurrences} total occurrences
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReliabilityTimeline({
  domain,
  currentScanId,
  currentScore,
  regressionNew,
  regressionResolved,
  regressionRecurring,
  regressionWorsened,
  regressionImproved,
}: ReliabilityTimelineProps) {
  const [data, setData] = useState<TimelineResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!domain) return
    setLoading(true)
    fetch(`/api/domains/${encodeURIComponent(domain)}/timeline`)
      .then(r => r.ok ? r.json() : null)
      .then(json => { setData(json); setLoading(false) })
      .catch(() => setLoading(false))
  }, [domain])

  const hasScanHistory = (data?.timeline?.length ?? 0) > 1

  // Only show if there's meaningful data
  if (!loading && !hasScanHistory && regressionNew === 0 && regressionResolved === 0 && regressionRecurring === 0) {
    return null
  }

  const timeline = data?.timeline ?? []
  const openIssues = (data?.open_issues ?? []).filter(i =>
    i.current_status !== 'resolved' && (i.consecutive_scans_seen > 1 || i.days_unresolved > 2)
  )
  const recurringIssues = openIssues.filter(i => i.current_status === 'recurring')
  const persistentIssues = openIssues.filter(i => i.current_status !== 'recurring' && i.days_unresolved > 2)

  // Score trend summary
  const firstScore  = timeline.length > 1 ? (timeline[timeline.length - 1].score ?? null) : null
  const scoreTrend  = currentScore !== null && firstScore !== null ? currentScore - firstScore : null
  const scanCount   = timeline.length

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Reliability Timeline</span>
          <span className="text-[10px] text-zinc-700 font-mono">{domain}</span>
        </div>
        {!loading && scanCount > 0 && (
          <div className="flex items-center gap-3 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {scanCount} scan{scanCount !== 1 ? 's' : ''}
            </span>
            {scoreTrend !== null && scoreTrend !== 0 && (
              <span className={`flex items-center gap-0.5 font-mono font-semibold ${scoreTrend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {scoreTrend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {scoreTrend > 0 ? '+' : ''}{scoreTrend} overall
              </span>
            )}
            {scoreTrend === 0 && <span className="flex items-center gap-0.5"><Minus className="h-3 w-3" /> stable</span>}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-4 py-4 text-zinc-600 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading reliability history…
        </div>
      )}

      {/* Current scan regression summary */}
      {(regressionNew + regressionResolved + regressionRecurring + regressionWorsened + regressionImproved) > 0 && (
        <div className="px-4 py-3 border-b border-zinc-800/40 bg-zinc-900/30">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="h-3 w-3 text-zinc-500" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">This scan vs previous</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <RegressionChip kind="new"       count={regressionNew} />
            <RegressionChip kind="worsened"  count={regressionWorsened} />
            <RegressionChip kind="resolved"  count={regressionResolved} />
            <RegressionChip kind="improved"  count={regressionImproved} />
            <RegressionChip kind="recurring" count={regressionRecurring} />
          </div>
        </div>
      )}

      {/* Score sparkline */}
      {!loading && timeline.length > 1 && (
        <div className="px-4 py-3 border-b border-zinc-800/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Score trend</span>
            <div className="flex items-center gap-2">
              <ScoreBadge score={firstScore} size="sm" />
              <span className="text-zinc-700 text-[10px]">→</span>
              <ScoreBadge score={currentScore} size="sm" />
            </div>
          </div>
          <ScoreSparkline entries={[...timeline].reverse()} currentScanId={currentScanId} />
        </div>
      )}

      {/* Timeline entries */}
      {!loading && timeline.length > 0 && (
        <div className="border-b border-zinc-800/40">
          <div className="px-4 pt-3 pb-1">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Scan history</span>
          </div>
          <div className="divide-y divide-zinc-800/40 relative">
            {/* Vertical spine line */}
            <div className="absolute left-[22px] top-2 bottom-2 w-px bg-zinc-800/60" />
            {[...timeline].map((entry) => (
              <TimelineRow
                key={entry.scan_id}
                entry={entry}
                isCurrent={entry.scan_id === currentScanId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recurring & persistent issues */}
      {!loading && (recurringIssues.length > 0 || persistentIssues.length > 0) && (
        <div>
          <div className="px-4 pt-3 pb-1 flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">
              Persistent issues
            </span>
            {recurringIssues.length > 0 && (
              <span className="text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded font-medium">
                {recurringIssues.length} recurring
              </span>
            )}
          </div>
          <div className="divide-y divide-zinc-800/30">
            {[...recurringIssues, ...persistentIssues].slice(0, 6).map((issue) => (
              <RecurringIssueRow key={`${issue.domain}-${issue.fingerprint}`} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {/* Empty — first scan */}
      {!loading && timeline.length <= 1 && regressionNew === 0 && (
        <div className="px-4 py-4 flex items-center gap-2 text-xs text-zinc-600">
          <CheckCircle2 className="h-3.5 w-3.5 text-zinc-700" />
          First scan for this domain — reliability history will build over time.
        </div>
      )}
    </div>
  )
}
