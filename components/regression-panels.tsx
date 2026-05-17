'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Loader2,
  Flame,
} from 'lucide-react'
import type { RegressionItem, RegressionSummary } from '@/app/api/scan/[id]/regressions/route'

// ── Shared data ───────────────────────────────────────────────────────────────

type BusinessImpact = 'SEO' | 'Accessibility' | 'Conversion' | 'Performance' | 'Availability' | 'Mobile UX' | 'Functionality'

const ISSUE_LABELS: Record<string, string> = {
  page_crash:         'Page Crash',
  page_not_found:     'Page Not Found',
  navigation_failure: 'Navigation Failure',
  js_error:           'JavaScript Error',
  console_error:      'Console Error',
  console_warning:    'Console Warning',
  network_failure:    'Network Failure',
  missing_image:      'Missing Image',
  slow_load:          'Slow Load',
  large_asset:        'Large Asset',
  missing_alt:        'Missing Alt Text',
  mobile_layout:      'Mobile Layout',
  missing_meta:       'Missing Meta',
  broken_form:        'Broken Form',
}

const IMPACT_MAP: Partial<Record<string, BusinessImpact[]>> = {
  page_crash:         ['Availability'],
  page_not_found:     ['Availability', 'SEO'],
  navigation_failure: ['Availability'],
  js_error:           ['Functionality'],
  console_error:      ['Functionality'],
  console_warning:    ['Functionality'],
  network_failure:    ['Performance', 'Availability'],
  missing_image:      ['Accessibility'],
  slow_load:          ['Performance', 'Conversion'],
  large_asset:        ['Performance'],
  missing_alt:        ['Accessibility', 'SEO'],
  mobile_layout:      ['Mobile UX'],
  missing_meta:       ['SEO'],
  broken_form:        ['Conversion'],
}

const IMPACT_COLORS: Record<BusinessImpact, string> = {
  SEO:           'text-purple-400 bg-purple-500/10 border-purple-500/20',
  Accessibility: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  Conversion:    'text-orange-400 bg-orange-500/10 border-orange-500/20',
  Performance:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  Availability:  'text-red-400 bg-red-500/10 border-red-500/20',
  'Mobile UX':   'text-pink-400 bg-pink-500/10 border-pink-500/20',
  Functionality: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const cfg: Record<string, string> = {
    critical: 'text-red-400 bg-red-500/10 border-red-500/30',
    medium:   'text-amber-400 bg-amber-500/10 border-amber-500/30',
    low:      'text-zinc-400 bg-zinc-500/10 border-zinc-600/30',
  }
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${cfg[severity] ?? cfg.low}`}>
      {severity}
    </span>
  )
}

function ImpactTags({ issueType }: { issueType: string }) {
  const tags = IMPACT_MAP[issueType] ?? []
  if (!tags.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(t => (
        <span key={t} className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${IMPACT_COLORS[t]}`}>
          {t}
        </span>
      ))}
    </div>
  )
}

function SeverityArrow({ from, to }: { from: string | null; to: string | null }) {
  if (!from || !to || from === to) return null
  const sevColor = (s: string) =>
    s === 'critical' ? 'text-red-400' : s === 'medium' ? 'text-amber-400' : 'text-zinc-500'
  return (
    <span className="flex items-center gap-1 text-[10px] font-mono">
      <span className={sevColor(from)}>{from}</span>
      <ArrowRight className="h-2.5 w-2.5 text-zinc-600" />
      <span className={sevColor(to)}>{to}</span>
    </span>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function RegressionRow({ item, variant }: { item: RegressionItem; variant: 'new' | 'resolved' | 'recurring' | 'worsened' | 'improved' }) {
  const label = ISSUE_LABELS[item.issue_type] ?? item.issue_type.replace(/_/g, ' ')

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-800/20 transition-colors border-b border-zinc-800/30 last:border-0">
      {/* Severity indicator bar */}
      <div className={`w-0.5 self-stretch rounded-full shrink-0 mt-0.5 ${
        item.severity === 'critical' ? 'bg-red-500' :
        item.severity === 'medium'   ? 'bg-amber-500' : 'bg-zinc-600'
      }`} />

      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Title row */}
        <div className="flex items-start gap-2 flex-wrap">
          <SeverityBadge severity={item.severity} />
          <span className="text-sm text-zinc-200 font-medium leading-tight">
            {item.title ?? label}
          </span>
          {item.pages_affected > 1 && (
            <span className="text-[10px] text-zinc-600 font-mono shrink-0 mt-0.5">
              ×{item.pages_affected} pages
            </span>
          )}
        </div>

        {/* Contextual metadata */}
        <div className="flex items-center gap-3 flex-wrap">
          {variant === 'worsened' && (
            <SeverityArrow from={item.prev_severity} to={item.curr_severity} />
          )}
          {variant === 'recurring' && item.days_unresolved > 0 && (
            <span className="text-[10px] text-orange-400 flex items-center gap-1">
              <Flame className="h-2.5 w-2.5" />
              Unresolved {item.days_unresolved}d
            </span>
          )}
          {variant === 'new' && (
            <span className="text-[10px] text-zinc-500">First detected this scan</span>
          )}
          {variant === 'resolved' && (
            <span className="text-[10px] text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Fixed this scan
            </span>
          )}
          {variant === 'improved' && (
            <SeverityArrow from={item.prev_severity} to={item.curr_severity} />
          )}
          <ImpactTags issueType={item.issue_type} />
        </div>

        {/* AI summary excerpt */}
        {item.ai_summary && (
          <p className="text-[11px] text-zinc-600 leading-relaxed line-clamp-2">
            {item.ai_summary}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface PanelConfig {
  key:    'new' | 'resolved' | 'recurring' | 'worsened' | 'improved'
  label:  string
  icon:   React.ReactNode
  accent: string
  headerBg: string
  defaultOpen: boolean
}

function Panel({ config, items }: { config: PanelConfig; items: RegressionItem[] }) {
  const [open, setOpen] = useState(config.defaultOpen && items.length > 0)
  if (items.length === 0) return null

  const critCount = items.filter(i => i.severity === 'critical').length

  return (
    <div className={`border-b border-zinc-800/50 last:border-0`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/20 transition-colors ${config.headerBg}`}
      >
        <span className={`shrink-0 ${config.accent}`}>{config.icon}</span>
        <span className={`text-sm font-semibold flex-1 ${config.accent}`}>{config.label}</span>
        <div className="flex items-center gap-2">
          {critCount > 0 && (
            <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
              {critCount} critical
            </span>
          )}
          <span className={`text-[11px] font-mono ${config.accent} opacity-70`}>
            {items.length}
          </span>
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
            : <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
          }
        </div>
      </button>

      {open && (
        <div>
          {items.map(item => (
            <RegressionRow
              key={`${item.change_kind}-${item.fingerprint}`}
              item={item}
              variant={config.key}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Score change callout ──────────────────────────────────────────────────────

function ScoreChangeSummary({ delta, data }: { delta: number | null; data: RegressionSummary }) {
  const totalNew      = data.new.length + data.worsened.length
  const totalResolved = data.resolved.length + data.improved.length
  const critNew       = [...data.new, ...data.worsened].filter(i => i.severity === 'critical').length

  if (delta === null && totalNew === 0 && totalResolved === 0) return null

  return (
    <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-6 flex-wrap">
      {delta !== null && delta !== 0 && (
        <div className="flex items-center gap-2">
          {delta > 0
            ? <TrendingUp className="h-4 w-4 text-emerald-400" />
            : <TrendingDown className="h-4 w-4 text-red-400" />
          }
          <span className={`text-sm font-bold tabular-nums font-mono ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {delta > 0 ? '+' : ''}{delta} pts
          </span>
          <span className="text-xs text-zinc-600">score change</span>
        </div>
      )}
      {delta === 0 && (
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-zinc-600 rounded" />
          <span className="text-xs text-zinc-600">Score unchanged</span>
        </div>
      )}
      {critNew > 0 && (
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          <span className="text-xs text-red-400 font-semibold">{critNew} new critical</span>
        </div>
      )}
      {totalNew > 0 && critNew === 0 && (
        <span className="text-xs text-zinc-400">{totalNew} issue{totalNew !== 1 ? 's' : ''} introduced</span>
      )}
      {totalResolved > 0 && (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs text-emerald-400">{totalResolved} issue{totalResolved !== 1 ? 's' : ''} resolved</span>
        </div>
      )}
      {data.recurring.length > 0 && (
        <div className="flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-xs text-orange-400">{data.recurring.length} recurring</span>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function RegressionPanels({ scanId, prevScanId }: { scanId: string; prevScanId: string | null }) {
  const [data, setData]       = useState<RegressionSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/scan/${scanId}/regressions`)
      .then(r => r.ok ? r.json() : null)
      .then(json => { setData(json); setLoading(false) })
      .catch(() => setLoading(false))
  }, [scanId])

  // No prev scan = no regression data to show
  if (!prevScanId) return null

  const totalChanges = data
    ? data.new.length + data.resolved.length + data.recurring.length + data.worsened.length + data.improved.length
    : 0

  if (!loading && totalChanges === 0) return null

  const PANELS: PanelConfig[] = [
    {
      key:         'new',
      label:       'New Issues',
      icon:        <AlertCircle className="h-3.5 w-3.5" />,
      accent:      'text-red-400',
      headerBg:    '',
      defaultOpen: true,
    },
    {
      key:         'worsened',
      label:       'Worsened',
      icon:        <TrendingDown className="h-3.5 w-3.5" />,
      accent:      'text-red-400',
      headerBg:    '',
      defaultOpen: true,
    },
    {
      key:         'recurring',
      label:       'Recurring Issues',
      icon:        <RotateCcw className="h-3.5 w-3.5" />,
      accent:      'text-orange-400',
      headerBg:    '',
      defaultOpen: true,
    },
    {
      key:         'resolved',
      label:       'Resolved Issues',
      icon:        <CheckCircle2 className="h-3.5 w-3.5" />,
      accent:      'text-emerald-400',
      headerBg:    '',
      defaultOpen: false,
    },
    {
      key:         'improved',
      label:       'Improved',
      icon:        <TrendingUp className="h-3.5 w-3.5" />,
      accent:      'text-emerald-400',
      headerBg:    '',
      defaultOpen: false,
    },
  ]

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Regression Intelligence
          </span>
        </div>
        {!loading && data && (
          <span className="text-[10px] text-zinc-600">vs previous scan</span>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-4 py-4 text-zinc-600 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Analysing regressions…
        </div>
      )}

      {!loading && data && (
        <>
          <ScoreChangeSummary delta={data.score_delta} data={data} />
          {PANELS.map(cfg => (
            <Panel
              key={cfg.key}
              config={cfg}
              items={data[cfg.key]}
            />
          ))}
        </>
      )}
    </div>
  )
}
