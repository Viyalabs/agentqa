'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, AlertCircle, Info, ExternalLink, ChevronDown, ChevronUp, Layers, TrendingUp, ThumbsUp, ThumbsDown, RefreshCw, Copy, Check } from 'lucide-react'
import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import type { Issue } from '@/types'
import { truncateUrl } from '@/lib/utils'

// Impact statements derived from issue type — shown in the AI panel
const IMPACT: Record<string, string> = {
  page_crash:          'Users cannot access this page — direct loss of sessions and revenue',
  page_not_found:      'Dead link creates dead ends for users, harming UX and SEO ranking',
  navigation_failure:  'Navigation failure blocks users from reaching intended content',
  js_error:            'JavaScript failures silently break interactive features for all visitors',
  console_error:       'Runtime errors logged — risk of cascading failures and degraded UX',
  network_failure:     'Failed requests cause broken UI elements, missing images, or stale data',
  missing_image:       'Missing visuals degrade perceived quality and erode user trust',
  missing_alt:         'Images without alt text exclude screen reader users and hurt SEO image indexing',
  missing_meta:        'Missing metadata reduces search ranking and degrades social share previews',
  broken_form:         'Form failures directly block conversions, signups, and lead capture',
  slow_load:           'Every 100ms over 3s increases bounce rate — SEO and conversion penalty',
  console_warning:     'Deprecation warnings signal accumulating technical debt',
  mobile_layout:       'Layout broken on mobile — affects 60%+ of web traffic by default',
  large_asset:         'Oversized assets inflate load time across all connection types',
}

function deriveConfidence(issue: Issue): number | null {
  if (!issue.ai_summary) return null
  // Prefer the real numeric confidence from issues_enriched (0-1 float)
  if (issue.confidence != null) return Math.round(issue.confidence * 100)
  let score = 40
  if (issue.root_cause)    score += 15
  if (issue.fix_suggestion) score += 15
  if (issue.pattern_count && issue.pattern_count > 1) {
    score += Math.min(25, Math.round(Math.log2(issue.pattern_count) * 8))
  }
  return Math.min(score, 95)
}

type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'

function confidenceLevel(pct: number): ConfidenceLevel {
  return pct >= 80 ? 'HIGH' : pct >= 55 ? 'MEDIUM' : 'LOW'
}

function parseFixLines(fix: string): string[] {
  const lines = fix.split('\n').map(l => l.replace(/^\d+\.\s+/, '').trim()).filter(Boolean)
  return lines.length > 1 ? lines : [fix.trim()]
}

function ConfidenceBar({ pct, fromPattern }: { pct: number; fromPattern?: boolean | null }) {
  const level = confidenceLevel(pct)
  const filled = Math.round(pct / 10)
  const palette = level === 'HIGH'
    ? { dot: 'bg-emerald-400', dim: 'bg-emerald-400/15', label: 'text-emerald-400' }
    : level === 'MEDIUM'
    ? { dot: 'bg-blue-400',    dim: 'bg-blue-400/15',    label: 'text-blue-400' }
    : { dot: 'bg-amber-400',   dim: 'bg-amber-400/15',   label: 'text-amber-400' }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono font-bold tracking-[0.12em] text-zinc-500 uppercase">
          confidence
        </span>
        <div className="flex items-center gap-2">
          {fromPattern && (
            <span className="text-[9px] font-mono text-violet-400/70 tracking-wide">⚡ pattern-verified</span>
          )}
          <span className={`text-[9px] font-mono font-bold tracking-wider ${palette.label}`}>{level}</span>
          <span className="text-[9px] font-mono text-zinc-500 tabular-nums">{pct}%</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-sm transition-colors ${i < filled ? palette.dot : palette.dim}`} />
        ))}
      </div>
    </div>
  )
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    label: 'Critical',
    variant: 'critical' as const,
    iconColor: 'text-red-400',
  },
  medium: {
    icon: AlertTriangle,
    label: 'Medium',
    variant: 'medium' as const,
    iconColor: 'text-yellow-400',
  },
  low: {
    icon: Info,
    label: 'Low',
    variant: 'low' as const,
    iconColor: 'text-blue-400',
  },
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  page_crash: 'Page Crash',
  page_not_found: '404 Not Found',
  navigation_failure: 'Navigation Failure',
  js_error: 'JavaScript Error',
  console_error: 'Console Error',
  network_failure: 'Network Failure',
  missing_image: 'Missing Image',
  missing_alt: 'Missing Alt Text',
  missing_meta: 'Missing Metadata',
  broken_form: 'Broken Form',
  slow_load: 'Slow Load',
  console_warning: 'Console Warning',
  mobile_layout: 'Mobile Layout',
  large_asset: 'Large Asset',
}

interface IssueCardProps {
  issue: Issue
  pageCount?: number
  totalCount?: number
}

export function IssueCard({ issue, pageCount, totalCount }: IssueCardProps) {
  const [stackOpen, setStackOpen] = useState(false)
  const config = SEVERITY_CONFIG[issue.severity]
  const Icon = config.icon
  const details = issue.details as Record<string, unknown> | null

  const affectedUrl = typeof details?.url === 'string' ? details.url : null

  const errorMessages = Array.isArray(details?.errors)
    ? (details.errors as string[])
    : Array.isArray(details?.failures)
    ? (details.failures as unknown[]).map((f) =>
        typeof f === 'string' ? f : JSON.stringify(f)
      )
    : Array.isArray(details?.images)
    ? (details.images as string[])
    : Array.isArray(details?.assets)
    ? (details.assets as Array<{ url: string; sizeKb: number }>).map(
        (a) => `${truncateUrl(a.url, 50)} — ${a.sizeKb} KB`
      )
    : []

  // Stack traces from pageerror events
  const stacks = Array.isArray(details?.stacks)
    ? (details.stacks as Array<string | null>).filter((s): s is string => !!s)
    : []

  const isGrouped = (pageCount ?? 0) > 1 || (totalCount ?? 0) > 1

  return (
    <Card className="hover:border-zinc-700 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Icon className={`h-4 w-4 ${config.iconColor}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-medium text-zinc-100">{issue.title}</h4>
                {isGrouped && (
                  <span className="flex items-center gap-1 text-xs text-zinc-500 bg-zinc-800 rounded px-1.5 py-0.5">
                    <Layers className="h-2.5 w-2.5" />
                    {pageCount && pageCount > 1
                      ? `${pageCount} pages`
                      : totalCount && totalCount > 1
                      ? `${totalCount}×`
                      : null}
                  </span>
                )}
                {issue.pattern_count != null && issue.pattern_count > 1 && (
                  <Link
                    href={`/patterns?type=${issue.type}&sort=frequency`}
                    className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded px-1.5 py-0.5 font-mono hover:bg-orange-500/20 transition-colors"
                    title={`This pattern has been seen ${issue.pattern_count} times — view similar patterns`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <TrendingUp className="h-2.5 w-2.5" />
                    {issue.pattern_count >= 100 ? '100+×' : `${issue.pattern_count}×`} known
                  </Link>
                )}
                {(issue.total_scans_affected ?? 0) >= 3 && (
                  <span
                    className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5 font-mono"
                    title={`Seen in ${issue.total_scans_affected} separate scans — this issue keeps coming back`}
                  >
                    <RefreshCw className="h-2.5 w-2.5" />
                    recurring
                  </span>
                )}
              </div>
              <Badge variant={config.variant} className="shrink-0">
                {config.label}
              </Badge>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-zinc-600">
                {ISSUE_TYPE_LABELS[issue.type] ?? issue.type}
              </span>
              {issue.framework && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 font-mono">
                  {issue.framework}
                </span>
              )}
            </div>

            {issue.description && (
              <p className="text-xs text-zinc-400 leading-relaxed mb-2">{issue.description}</p>
            )}

            {affectedUrl && (
              <a
                href={affectedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mb-2"
              >
                <ExternalLink className="h-3 w-3" />
                {truncateUrl(affectedUrl, 55)}
              </a>
            )}

            {errorMessages.length > 0 && (
              <div className="mt-1 space-y-1">
                {errorMessages.slice(0, 3).map((msg, i) => (
                  <div
                    key={i}
                    className="text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-500 truncate"
                    title={msg}
                  >
                    {msg}
                  </div>
                ))}
                {errorMessages.length > 3 && (
                  <div className="text-xs text-zinc-600">+{errorMessages.length - 3} more</div>
                )}
              </div>
            )}

            {/* Stack traces — collapsible */}
            {stacks.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setStackOpen((o) => !o)}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {stackOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {stackOpen ? 'Hide' : 'Show'} stack trace{stacks.length > 1 ? 's' : ''}
                </button>
                {stackOpen && (
                  <div className="mt-2 space-y-2">
                    {stacks.slice(0, 3).map((stack, i) => (
                      <pre
                        key={i}
                        className="text-[10px] font-mono bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-500 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto"
                      >
                        {stack}
                      </pre>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Analysis panel — show for medium/critical always */}
            {issue.severity !== 'low' && (
              <AIPanel issue={issue} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FeedbackButtons({ issueId, initial }: { issueId: string; initial: boolean | null | undefined }) {
  const [voted, setVoted] = useState<boolean | null>(initial ?? null)
  const [sending, setSending] = useState(false)

  async function vote(helpful: boolean) {
    if (sending || voted === helpful) return
    setSending(true)
    setVoted(helpful) // optimistic
    try {
      await fetch(`/api/issues/${issueId}/feedback`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ helpful }),
      })
    } catch {
      setVoted(null) // revert on network error
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="px-3 py-2 border-t border-zinc-800/50 flex items-center justify-between">
      <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.12em]">
        Was this fix helpful?
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => vote(true)}
          disabled={sending}
          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${
            voted === true
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10'
          }`}
          title="Fix was helpful"
        >
          <ThumbsUp className="h-3 w-3" />
        </button>
        <button
          onClick={() => vote(false)}
          disabled={sending}
          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${
            voted === false
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10'
          }`}
          title="Fix was not helpful"
        >
          <ThumbsDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

type SectionAccent = 'amber' | 'red' | 'emerald'

const SECTION_RULE_CLASSES: Record<SectionAccent, { line: string; text: string }> = {
  amber:   { line: 'bg-amber-500/20',   text: 'text-amber-500/70' },
  red:     { line: 'bg-red-500/20',     text: 'text-red-500/70' },
  emerald: { line: 'bg-emerald-500/20', text: 'text-emerald-500/70' },
}

function SectionRule({ label, accent }: { label: string; accent: SectionAccent }) {
  const cls = SECTION_RULE_CLASSES[accent]
  return (
    <div className="flex items-center gap-2">
      <div className={`h-px flex-1 ${cls.line}`} />
      <span className={`text-[9px] font-mono font-bold tracking-[0.15em] uppercase ${cls.text}`}>
        {label}
      </span>
      <div className={`h-px flex-1 ${cls.line}`} />
    </div>
  )
}

function AIPanel({ issue }: { issue: Issue }) {
  const hasAnalysis = Boolean(issue.ai_summary)
  const confidence  = hasAnalysis ? deriveConfidence(issue) : null
  const [fixCopied, setFixCopied] = useState(false)

  function copyFix(lines: string[]) {
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setFixCopied(true)
      setTimeout(() => setFixCopied(false), 2000)
    })
  }
  const impact      = IMPACT[issue.type] ?? (
    issue.severity === 'critical'
      ? 'Critical impact on user experience and core functionality'
      : 'Degrades user experience and application reliability'
  )
  const fixLines = issue.fix_suggestion ? parseFixLines(issue.fix_suggestion) : []
  const patternBadge = issue.from_pattern && issue.pattern_count && issue.pattern_count > 1

  return (
    <div className="mt-3 rounded-lg border border-zinc-700/40 bg-zinc-950 overflow-hidden">

      {/* Terminal chrome header */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-1 shrink-0">
          <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <div className={`h-2.5 w-2.5 rounded-full ${hasAnalysis ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
        </div>
        <div className="flex flex-1 items-center justify-between min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-zinc-300 uppercase shrink-0">
              AI Analysis
            </span>
            {patternBadge && (
              <span className="flex items-center gap-0.5 text-[9px] font-mono text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5 shrink-0">
                ⚡ {(issue.pattern_count ?? 0) >= 100 ? '100+' : issue.pattern_count}× verified
              </span>
            )}
          </div>
          <span className="text-[9px] font-mono text-zinc-600 shrink-0 ml-2">
            {hasAnalysis ? 'claude-haiku-4-5' : 'analyzing…'}
          </span>
        </div>
      </div>

      {/* Pending state */}
      {!hasAnalysis && (
        <div className="px-3 py-3 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500/60 animate-pulse" />
            <span className="text-[9px] font-mono text-zinc-600 tracking-wide">running analysis pipeline…</span>
          </div>
          {[
            { w: 'w-3/4', label: 'scanning patterns' },
            { w: 'w-5/6', label: 'generating root cause' },
            { w: 'w-2/3', label: 'building fix suggestion' },
          ].map(({ w, label }, i) => (
            <div key={i} className="space-y-1">
              <span className="text-[9px] font-mono text-zinc-700">{label}</span>
              <div className={`h-1.5 ${w} rounded bg-zinc-800 animate-pulse`} style={{ animationDelay: `${i * 150}ms` }} />
            </div>
          ))}
        </div>
      )}

      {/* Analysis content */}
      {hasAnalysis && (
        <div className="divide-y divide-zinc-800/40">

          {/* Root cause */}
          {issue.root_cause && (
            <div className="px-3 py-2.5 space-y-2">
              <SectionRule label="root cause" accent="amber" />
              <div className="flex gap-2.5 pl-0.5">
                <div className="w-0.5 self-stretch bg-amber-500/30 rounded-full shrink-0" />
                <p className="text-xs text-zinc-200 leading-relaxed">{issue.root_cause}</p>
              </div>
            </div>
          )}

          {/* Impact */}
          <div className="px-3 py-2.5 space-y-2">
            <SectionRule label="impact" accent="red" />
            <p className="text-xs text-zinc-400 leading-relaxed pl-1">{impact}</p>
          </div>

          {/* Fix — terminal box */}
          {fixLines.length > 0 && (
            <div className="px-3 py-2.5 space-y-2">
              <SectionRule label="fix" accent="emerald" />
              <div className="rounded-md border border-zinc-800 overflow-hidden">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/50 border-b border-zinc-700/50">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
                  <span className="text-[9px] font-mono text-zinc-500 tracking-wide">terminal</span>
                  <button
                    onClick={() => copyFix(fixLines)}
                    className={`ml-auto flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                      fixCopied
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-700/50'
                    }`}
                    title="Copy fix to clipboard"
                  >
                    {fixCopied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                    {fixCopied ? 'copied' : 'copy'}
                  </button>
                </div>
                <div className="px-2.5 py-2 bg-zinc-900/60 space-y-1.5">
                  {fixLines.map((line, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-emerald-500 font-mono text-xs shrink-0 select-none mt-px">$</span>
                      <p className="text-xs font-mono text-emerald-200 leading-relaxed break-words">{line}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Confidence */}
          {confidence !== null && (
            <div className="px-3 py-2.5">
              <ConfidenceBar pct={confidence} fromPattern={issue.from_pattern} />
            </div>
          )}

          {/* Feedback */}
          <FeedbackButtons issueId={issue.id} initial={issue.fix_helpful} />

        </div>
      )}
    </div>
  )
}
