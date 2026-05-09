import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Activity, TrendingUp, Clock, Star, AlertTriangle,
  AlertCircle, Info, Zap, BarChart2, ChevronRight,
} from 'lucide-react'
import { getTopPatterns } from '@/services/pattern-matcher'
import type { TopPattern } from '@/services/pattern-matcher'

export const metadata: Metadata = {
  title: 'Issue Patterns — AgentQA',
  description: 'Recurring bug patterns detected across all AgentQA scans, ranked by frequency, trend velocity, and confidence.',
}

export const dynamic = 'force-dynamic'

// ── helpers ──────────────────────────────────────────────────────────────────

type Sort = 'frequency' | 'trending' | 'recent' | 'confidence'
type TypeFilter = string | undefined

const SORT_TABS: { value: Sort; label: string; icon: React.ReactNode }[] = [
  { value: 'frequency', label: 'Most Common',  icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { value: 'trending',  label: 'Trending',     icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { value: 'recent',   label: 'Recent',        icon: <Clock className="h-3.5 w-3.5" /> },
  { value: 'confidence',label: 'Confidence',   icon: <Star className="h-3.5 w-3.5" /> },
]

const TYPE_LABELS: Record<string, string> = {
  js_error: 'JS Error', console_error: 'Console Error', network_failure: 'Network',
  page_crash: 'Page Crash', page_not_found: '404', navigation_failure: 'Navigation',
  missing_image: 'Missing Image', broken_form: 'Broken Form', slow_load: 'Slow Load',
  console_warning: 'Warning', mobile_layout: 'Mobile Layout', large_asset: 'Large Asset',
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  medium:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  critical: <AlertCircle className="h-3 w-3" />,
  medium:   <AlertTriangle className="h-3 w-3" />,
  low:      <Info className="h-3 w-3" />,
}

function confidencePct(score: number | null): number {
  return Math.round((score ?? 0.5) * 100)
}

function velocityLabel(v: number | null): string | null {
  if (v === null || v <= 0) return null
  if (v >= 5) return `${v.toFixed(1)}/day`
  if (v >= 1) return `${v.toFixed(1)}/day`
  return `${(v * 7).toFixed(1)}/wk`
}

function buildHref(
  sort: Sort,
  type: TypeFilter,
  nextSort?: Sort,
  nextType?: string | null,
  nextPage?: number,
): string {
  const p = new URLSearchParams()
  p.set('sort', nextSort ?? sort)
  const t = nextType !== undefined ? nextType : type
  if (t) p.set('type', t)
  if (nextPage && nextPage > 1) p.set('page', String(nextPage))
  return `/patterns?${p.toString()}`
}

// ── pattern card ─────────────────────────────────────────────────────────────

function PatternCard({ pattern, sort }: { pattern: TopPattern; sort: Sort }) {
  const pct     = confidencePct(pattern.confidence_score)
  const velocity = velocityLabel(pattern.trend_velocity)
  const sevStyle = SEVERITY_STYLES[pattern.severity] ?? SEVERITY_STYLES.low
  const sevIcon  = SEVERITY_ICON[pattern.severity]

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Occurrence count */}
        <div className="shrink-0 text-center min-w-[3rem]">
          <div className="text-2xl font-bold font-mono text-white tabular-nums leading-none">
            {pattern.occurrence_count}
          </div>
          <div className="text-[10px] text-zinc-600 mt-0.5 uppercase tracking-wide">hits</div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${sevStyle}`}>
              {sevIcon}
              {pattern.severity}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
              {TYPE_LABELS[pattern.type] ?? pattern.type}
            </span>
            {velocity && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="h-2.5 w-2.5" />
                {velocity}
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-zinc-100 leading-snug line-clamp-2">
            {pattern.title}
          </h3>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <BarChart2 className="h-3 w-3" />
          {pattern.total_scans_affected} scan{pattern.total_scans_affected !== 1 ? 's' : ''} affected
        </span>

        {pattern.affected_frameworks.length > 0 && (
          <span className="flex items-center gap-1 flex-wrap">
            {pattern.affected_frameworks.slice(0, 3).map((fw) => (
              <span key={fw} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[10px]">
                {fw}
              </span>
            ))}
            {pattern.affected_frameworks.length > 3 && (
              <span className="text-zinc-600">+{pattern.affected_frameworks.length - 3}</span>
            )}
          </span>
        )}

        {/* Confidence bar */}
        <span className="flex items-center gap-1.5 ml-auto">
          <span className="text-zinc-600">confidence</span>
          <span className="flex gap-0.5">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={`block w-1.5 h-2.5 rounded-sm ${
                  i < Math.round(pct / 10)
                    ? pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                    : 'bg-zinc-700'
                }`}
              />
            ))}
          </span>
          <span className={`font-mono font-semibold text-xs tabular-nums ${
            pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {pct}%
          </span>
        </span>
      </div>

      {/* Root cause or fix snippet */}
      {(pattern.root_cause_template || pattern.fix_template) && (
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-950/60 overflow-hidden">
          {pattern.root_cause_template && (
            <div className="px-3 py-2 border-b border-zinc-700/50">
              <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">Root cause</div>
              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                {pattern.root_cause_template}
              </p>
            </div>
          )}
          {pattern.fix_template && (
            <div className="px-3 py-2">
              <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">Fix</div>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed line-clamp-2">
                {pattern.fix_template}
              </p>
            </div>
          )}
        </div>
      )}

      {/* No AI templates yet */}
      {!pattern.root_cause_template && !pattern.fix_template && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/30">
          <Zap className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
          <span className="text-xs text-zinc-600">AI analysis pending — templates generated after enough occurrences</span>
        </div>
      )}

      {/* Feedback hints */}
      {(pattern.feedback_positive + pattern.feedback_negative) > 0 && (
        <div className="text-[10px] text-zinc-700 flex items-center gap-2">
          <span>{pattern.feedback_positive} helpful</span>
          <span>·</span>
          <span>{pattern.feedback_negative} not helpful</span>
        </div>
      )}
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30

interface Props {
  searchParams: Promise<{ sort?: string; type?: string; page?: string }>
}

export default async function PatternsPage({ searchParams }: Props) {
  const params = await searchParams
  const sort   = (params.sort ?? 'frequency') as Sort
  const type   = params.type || undefined
  const page   = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const { patterns, total } = await getTopPatterns({ sort, type, limit: PAGE_SIZE, offset })
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const typeKeys = Object.keys(TYPE_LABELS)

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-zinc-800/50 bg-[#0A0A0F]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-white">
            <Activity className="h-5 w-5 text-blue-400" />
            AgentQA
          </Link>
          <div className="flex items-center gap-5 text-sm text-zinc-400">
            <Link href="/scans" className="hover:text-zinc-200 transition-colors">Recent scans</Link>
            <Link href="/" className="hover:text-zinc-200 transition-colors">Run a scan →</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-widest mb-3">
            <Zap className="h-3.5 w-3.5" />
            Pattern Intelligence
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-2">
            Issue Patterns
          </h1>
          <p className="text-base text-zinc-400 leading-relaxed max-w-2xl">
            Recurring bugs detected across all AgentQA scans. Every pattern is fingerprinted, clustered, and
            enriched with AI root-cause analysis. Use this to spot systemic issues before they spread.
          </p>
          {total > 0 && (
            <p className="mt-2 text-sm text-zinc-600 font-mono">{total} unique pattern{total !== 1 ? 's' : ''} tracked</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
          {/* Sort tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
            {SORT_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={buildHref(sort, type, tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  sort === tab.value
                    ? 'bg-zinc-700 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </Link>
            ))}
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <Link
              href={buildHref(sort, type, undefined, null)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
                !type
                  ? 'bg-zinc-700 text-white border-zinc-600'
                  : 'text-zinc-500 border-zinc-700/50 hover:text-zinc-300 hover:border-zinc-600'
              }`}
            >
              All types
            </Link>
            {typeKeys.map((t) => (
              <Link
                key={t}
                href={buildHref(sort, type, undefined, t)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
                  type === t
                    ? 'bg-zinc-700 text-white border-zinc-600'
                    : 'text-zinc-500 border-zinc-700/50 hover:text-zinc-300 hover:border-zinc-600'
                }`}
              >
                {TYPE_LABELS[t]}
              </Link>
            ))}
          </div>
        </div>

        {/* Patterns grid */}
        {patterns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
            <BarChart2 className="h-8 w-8 mb-3 opacity-40" />
            <p className="text-sm">No patterns yet — run your first scan to start building intelligence.</p>
            <Link href="/" className="mt-4 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              Run a scan <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {patterns.map((p) => (
                <PatternCard key={p.id} pattern={p} sort={sort} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800/60">
                <span className="text-xs text-zinc-600 font-mono">
                  Page {page} of {totalPages} · {total} patterns
                </span>
                <div className="flex items-center gap-2">
                  {page > 1 && (
                    <Link
                      href={buildHref(sort, type, undefined, undefined, page - 1)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                    >
                      ← Prev
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link
                      href={buildHref(sort, type, undefined, undefined, page + 1)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                    >
                      Next →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
