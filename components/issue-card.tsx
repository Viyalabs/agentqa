'use client'

import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, ExternalLink, ChevronDown, ChevronUp, Layers, Sparkles } from 'lucide-react'
import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import type { Issue } from '@/types'
import { truncateUrl } from '@/lib/utils'

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
              </div>
              <Badge variant={config.variant} className="shrink-0">
                {config.label}
              </Badge>
            </div>

            <div className="text-xs text-zinc-600 mb-2">
              {ISSUE_TYPE_LABELS[issue.type] ?? issue.type}
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

            {/* AI Analysis */}
            {issue.ai_summary && (
              <div className="mt-3 pt-3 border-t border-zinc-800/60">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-3 w-3 text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 tracking-wide">AI Analysis</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed mb-2">{issue.ai_summary}</p>
                {issue.root_cause && (
                  <p className="text-xs text-zinc-500 leading-relaxed mb-2">
                    <span className="text-zinc-600 font-medium">Root cause: </span>
                    {issue.root_cause}
                  </p>
                )}
                {issue.fix_suggestion && (
                  <div className="p-2 rounded-md bg-green-950/20 border border-green-500/15">
                    <p className="text-xs text-zinc-500 font-medium mb-0.5">Fix</p>
                    <p className="text-xs text-green-300 leading-relaxed">{issue.fix_suggestion}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
