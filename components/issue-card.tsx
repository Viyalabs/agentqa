'use client'

import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, ExternalLink, ChevronDown, ChevronUp, Layers, TrendingUp, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react'
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
  broken_form:         'Form failures directly block conversions, signups, and lead capture',
  slow_load:           'Every 100ms over 3s increases bounce rate — SEO and conversion penalty',
  console_warning:     'Deprecation warnings signal accumulating technical debt',
  mobile_layout:       'Layout broken on mobile — affects 60%+ of web traffic by default',
  large_asset:         'Oversized assets inflate load time across all connection types',
}

function deriveConfidence(issue: Issue): number | null {
  if (!issue.ai_summary) return null
  let score = 40
  if (issue.root_cause)    score += 15
  if (issue.fix_suggestion) score += 15
  if (issue.pattern_count && issue.pattern_count > 1) {
    score += Math.min(25, Math.round(Math.log2(issue.pattern_count) * 8))
  }
  return Math.min(score, 95)
}

function ConfidenceBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'from-emerald-500 to-emerald-400'
              : pct >= 60 ? 'from-blue-500 to-blue-400'
              :             'from-amber-500 to-amber-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} rounded-full`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-zinc-400 tabular-nums w-7 text-right">{pct}%</span>
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
                  <span
                    className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded px-1.5 py-0.5 font-mono"
                    title={`This pattern has been seen ${issue.pattern_count} times across all AgentQA scans`}
                  >
                    <TrendingUp className="h-2.5 w-2.5" />
                    {issue.pattern_count >= 100 ? '100+×' : `${issue.pattern_count}×`} known
                  </span>
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

function AIPanel({ issue }: { issue: Issue }) {
  const hasAnalysis = Boolean(issue.ai_summary)
  const confidence  = hasAnalysis ? deriveConfidence(issue) : null
  const impact      = IMPACT[issue.type] ?? (
    issue.severity === 'critical'
      ? 'Critical impact on user experience and core functionality'
      : 'Degrades user experience and application reliability'
  )

  return (
    <div className="mt-3 rounded-lg border border-zinc-700/40 bg-zinc-950 overflow-hidden">

      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${hasAnalysis ? 'bg-blue-400' : 'bg-zinc-600 animate-pulse'}`} />
          <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-zinc-400 uppercase">
            AI Analysis
          </span>
        </div>
        <span className="text-[9px] font-mono text-zinc-600">
          {hasAnalysis ? 'claude-haiku' : 'analyzing…'}
        </span>
      </div>

      {/* Pending state — async worker hasn't run yet */}
      {!hasAnalysis && (
        <div className="px-3 py-3 space-y-2.5">
          {['w-3/4', 'w-5/6', 'w-2/3'].map((w, i) => (
            <div key={i} className={`h-2 ${w} rounded bg-zinc-800 animate-pulse`} />
          ))}
          <p className="text-[10px] font-mono text-zinc-600 pt-0.5">
            AI analysis queued — refreshing shortly
          </p>
        </div>
      )}

      {/* Analysis content */}
      {hasAnalysis && (
        <div className="divide-y divide-zinc-800/50">

          {/* Root cause */}
          {issue.root_cause && (
            <div className="px-3 py-2.5">
              <div className="text-[9px] font-mono font-bold tracking-[0.12em] text-amber-500/60 uppercase mb-1.5">
                root_cause
              </div>
              <div className="flex gap-2">
                <span className="text-amber-600/50 font-mono text-xs shrink-0 mt-px select-none">›</span>
                <p className="text-xs text-zinc-300 leading-relaxed">{issue.root_cause}</p>
              </div>
            </div>
          )}

          {/* Impact */}
          <div className="px-3 py-2.5">
            <div className="text-[9px] font-mono font-bold tracking-[0.12em] text-red-500/60 uppercase mb-1.5">
              impact
            </div>
            <div className="flex gap-2">
              <span className="text-red-600/50 font-mono text-xs shrink-0 mt-px select-none">›</span>
              <p className="text-xs text-zinc-400 leading-relaxed">{impact}</p>
            </div>
          </div>

          {/* Fix */}
          {issue.fix_suggestion && (
            <div className="px-3 py-2.5">
              <div className="text-[9px] font-mono font-bold tracking-[0.12em] text-emerald-500/60 uppercase mb-1.5">
                fix
              </div>
              <div className="bg-emerald-950/25 border border-emerald-900/30 rounded-md px-2.5 py-2">
                <div className="flex gap-2">
                  <span className="text-emerald-600 font-mono text-xs shrink-0 mt-px select-none">$</span>
                  <p className="text-xs text-emerald-300 leading-relaxed">{issue.fix_suggestion}</p>
                </div>
              </div>
            </div>
          )}

          {/* Confidence */}
          {confidence !== null && (
            <div className="px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[9px] font-mono font-bold tracking-[0.12em] text-zinc-500 uppercase">
                  confidence
                </div>
                {issue.pattern_count != null && issue.pattern_count > 1 && (
                  <span className="text-[9px] font-mono text-zinc-600">
                    {issue.pattern_count >= 100 ? '100+' : issue.pattern_count}× cross-scan
                  </span>
                )}
              </div>
              <ConfidenceBar pct={confidence} />
            </div>
          )}

          {/* Feedback */}
          <FeedbackButtons issueId={issue.id} initial={issue.fix_helpful} />

        </div>
      )}
    </div>
  )
}
