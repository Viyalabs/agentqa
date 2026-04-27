'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  ExternalLink,
  RefreshCw,
  Download,
  ArrowLeft,
} from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { IssueCard } from './issue-card'
import { ScreenshotViewer } from './screenshot-viewer'
import type { ScanStatusResponse } from '@/types'
import {
  getScoreColor,
  getScoreBgColor,
  getScoreLabel,
  formatTimestamp,
  formatDuration,
  truncateUrl,
  MAX_PAGES_PER_SCAN,
} from '@/lib/utils'

interface ResultsDashboardProps {
  scanId: string
}

const POLL_INTERVAL_MS = 2500

type SeverityFilter = 'all' | 'critical' | 'medium' | 'low'

export function ResultsDashboard({ scanId }: ResultsDashboardProps) {
  const [data, setData] = useState<ScanStatusResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/scan/${scanId}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setFetchError(body.error ?? `Failed to load results (${res.status})`)
        setIsPolling(false)
        return
      }
      const json: ScanStatusResponse = await res.json()
      setData(json)
      if (json.scan.status === 'completed' || json.scan.status === 'failed') {
        setIsPolling(false)
      }
    } catch (err) {
      console.error('Poll error:', err)
    }
  }, [scanId])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  useEffect(() => {
    if (!isPolling) return
    const timer = setInterval(fetchResults, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [isPolling, fetchResults])

  const exportReport = useCallback(() => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agentqa-report-${scanId.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [data, scanId])

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4">
        <XCircle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Failed to load scan</h2>
        <p className="text-zinc-400 text-sm mb-6">{fetchError}</p>
        <button
          onClick={() => { setFetchError(null); setIsPolling(true); fetchResults() }}
          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin mb-4" />
        <p className="text-zinc-400 text-sm">Loading scan results…</p>
      </div>
    )
  }

  const { scan, pages, issues } = data
  const isRunning = scan.status === 'running' || scan.status === 'pending'
  const isFailed = scan.status === 'failed'
  const isComplete = scan.status === 'completed'

  const criticalIssues = issues.filter((i) => i.severity === 'critical')
  const mediumIssues = issues.filter((i) => i.severity === 'medium')
  const lowIssues = issues.filter((i) => i.severity === 'low')

  const scanProgress = isComplete
    ? 100
    : scan.total_pages > 0
    ? Math.min((scan.total_pages / MAX_PAGES_PER_SCAN) * 100, 90)
    : 15

  const lastScannedUrl = pages.length > 0 ? pages[pages.length - 1]?.url : null

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a
              href={scan.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors font-mono"
            >
              {truncateUrl(scan.url, 60)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Clock className="h-3 w-3" />
            Started {formatTimestamp(scan.started_at ?? scan.created_at)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isComplete && (
            <button
              onClick={exportReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-sm transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </button>
          )}

          {isRunning && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning in progress…
            </div>
          )}
          {isComplete && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Scan complete
              </div>
              <Link
                href="/"
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                New scan
              </Link>
            </div>
          )}
          {isFailed && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <XCircle className="h-4 w-4" />
                Scan failed
              </div>
              <Link
                href="/"
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                New scan
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar (during scan) */}
      {isRunning && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>
              {lastScannedUrl
                ? <>Scanning page {scan.total_pages} of {MAX_PAGES_PER_SCAN}: <span className="font-mono text-zinc-400">{truncateUrl(lastScannedUrl, 55)}</span></>
                : 'Starting scan…'
              }
            </span>
            <span>{scan.total_pages} / {MAX_PAGES_PER_SCAN}</span>
          </div>
          <Progress value={scanProgress} className="h-1.5" />
        </div>
      )}

      {/* Error message */}
      {isFailed && scan.error_message && (
        <div className="p-4 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400 text-sm">
          <strong>Error:</strong> {scan.error_message}
        </div>
      )}

      {/* Score + stats */}
      {(isComplete || scan.total_pages > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* QA Score */}
          <Card className={`col-span-2 lg:col-span-1 border ${isComplete && scan.score !== null ? getScoreBgColor(scan.score) : 'border-zinc-800'}`}>
            <CardContent className="p-6">
              <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">QA Score</div>
              {isComplete && scan.score !== null ? (
                <>
                  <div className={`text-5xl font-bold tabular-nums ${getScoreColor(scan.score)}`}>
                    {scan.score}
                    <span className="text-2xl text-zinc-600">/100</span>
                  </div>
                  <div className={`text-sm mt-1 ${getScoreColor(scan.score)}`}>
                    {getScoreLabel(scan.score)}
                  </div>
                </>
              ) : (
                <div className="text-3xl font-bold text-zinc-600">–</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Pages Scanned</div>
              <div className="flex items-end gap-2">
                <div className="text-4xl font-bold text-white tabular-nums">
                  {scan.total_pages}
                </div>
                <Globe className="h-5 w-5 text-zinc-600 mb-1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Total Issues</div>
              <div className="text-4xl font-bold text-white tabular-nums">
                {scan.total_issues}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">By Severity</div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-red-400">
                    <AlertCircle className="h-3.5 w-3.5" /> Critical
                  </span>
                  <span className="font-mono font-bold text-red-400">{criticalIssues.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-yellow-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> Medium
                  </span>
                  <span className="font-mono font-bold text-yellow-400">{mediumIssues.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <Info className="h-3.5 w-3.5" /> Low
                  </span>
                  <span className="font-mono font-bold text-blue-400">{lowIssues.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main tabs */}
      <Tabs defaultValue="issues">
        <TabsList>
          <TabsTrigger value="issues">
            Issues {issues.length > 0 && <span className="ml-1.5 tabular-nums">({issues.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="pages">
            Pages {pages.length > 0 && <span className="ml-1.5 tabular-nums">({pages.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
        </TabsList>

        {/* Issues tab */}
        <TabsContent value="issues">
          {issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
              {isRunning ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin mb-3" />
                  <p className="text-sm">Detecting issues…</p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-8 w-8 text-green-500 mb-3" />
                  <p className="text-sm font-medium text-zinc-300">No issues found!</p>
                  <p className="text-xs mt-1">All scanned pages passed checks.</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Severity filter */}
              <div className="flex items-center gap-2 flex-wrap">
                {(['all', 'critical', 'medium', 'low'] as SeverityFilter[]).map((f) => {
                  const count =
                    f === 'all' ? issues.length :
                    f === 'critical' ? criticalIssues.length :
                    f === 'medium' ? mediumIssues.length :
                    lowIssues.length
                  const isActive = severityFilter === f
                  const colorClass =
                    f === 'critical' ? (isActive ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-500/30') :
                    f === 'medium' ? (isActive ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400' : 'border-zinc-700 text-zinc-500 hover:text-yellow-400 hover:border-yellow-500/30') :
                    f === 'low' ? (isActive ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : 'border-zinc-700 text-zinc-500 hover:text-blue-400 hover:border-blue-500/30') :
                    (isActive ? 'border-zinc-600 bg-zinc-800 text-zinc-200' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300')
                  return (
                    <button
                      key={f}
                      onClick={() => setSeverityFilter(f)}
                      className={`px-3 py-1 rounded-lg border text-xs font-medium transition-colors capitalize ${colorClass}`}
                    >
                      {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                    </button>
                  )
                })}
              </div>

              {/* Issue groups */}
              <div className="space-y-6">
                {(severityFilter === 'all' || severityFilter === 'critical') && criticalIssues.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-red-400 mb-3">
                      <AlertCircle className="h-4 w-4" />
                      Critical ({criticalIssues.length})
                    </h3>
                    <div className="space-y-2">
                      {criticalIssues.map((issue) => (
                        <IssueCard key={issue.id} issue={issue} />
                      ))}
                    </div>
                  </div>
                )}

                {(severityFilter === 'all' || severityFilter === 'medium') && mediumIssues.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-yellow-400 mb-3">
                      <AlertTriangle className="h-4 w-4" />
                      Medium ({mediumIssues.length})
                    </h3>
                    <div className="space-y-2">
                      {mediumIssues.map((issue) => (
                        <IssueCard key={issue.id} issue={issue} />
                      ))}
                    </div>
                  </div>
                )}

                {(severityFilter === 'all' || severityFilter === 'low') && lowIssues.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-400 mb-3">
                      <Info className="h-4 w-4" />
                      Low ({lowIssues.length})
                    </h3>
                    <div className="space-y-2">
                      {lowIssues.map((issue) => (
                        <IssueCard key={issue.id} issue={issue} />
                      ))}
                    </div>
                  </div>
                )}

                {severityFilter !== 'all' && { critical: criticalIssues, medium: mediumIssues, low: lowIssues }[severityFilter].length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                    <CheckCircle2 className="h-6 w-6 text-green-500 mb-2" />
                    <p className="text-sm">No {severityFilter} issues found.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Pages tab */}
        <TabsContent value="pages">
          {pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
              <Loader2 className="h-6 w-6 animate-spin mb-3" />
              <p className="text-sm">Crawling pages…</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pages.map((page) => (
                <Card key={page.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        {page.status_code === 200 ? (
                          <Badge variant="success">{page.status_code}</Badge>
                        ) : page.status_code === 404 ? (
                          <Badge variant="critical">{page.status_code}</Badge>
                        ) : page.status_code ? (
                          <Badge variant="medium">{page.status_code}</Badge>
                        ) : (
                          <Badge variant="secondary">ERR</Badge>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-zinc-300 hover:text-white transition-colors font-mono flex items-center gap-1 truncate"
                        >
                          {truncateUrl(page.url, 65)}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                        {page.title && (
                          <p className="text-xs text-zinc-600 mt-0.5 truncate">{page.title}</p>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center gap-3 text-xs text-zinc-600">
                        {page.load_time_ms && (
                          <span title="Load time">
                            {formatDuration(page.load_time_ms)}
                          </span>
                        )}
                        {page.has_console_errors && (
                          <span className="text-red-500 font-medium">Errors</span>
                        )}
                        {page.has_network_failures && (
                          <span className="text-yellow-500 font-medium">Net</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Screenshots tab */}
        <TabsContent value="screenshots">
          <ScreenshotViewer pages={pages} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
