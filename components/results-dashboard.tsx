'use client'

import { useEffect, useState, useCallback, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  Share2,
  Copy,
  Check,
  Smartphone,
  Video,
  Wifi,
  WifiOff,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { IssueCard } from './issue-card'
import { ScreenshotViewer } from './screenshot-viewer'
import { ReportEmailCapture } from './report-email-capture'
import { NotifyWhenDone } from './notify-when-done'
import type { Issue, IssueSeverity, IssueType, NetworkRequest, ScanLog, ScanStatusResponse } from '@/types'
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

// ── Issue grouping ────────────────────────────────────────────────────────────

interface GroupedIssue {
  type: IssueType
  severity: IssueSeverity
  title: string
  description: string | null
  pageCount: number
  totalCount: number
  affectedUrls: string[]
  representative: Issue
  all: Issue[]
}

function groupIssues(issues: Issue[]): GroupedIssue[] {
  const map = new Map<string, GroupedIssue>()

  for (const issue of issues) {
    const key = `${issue.type}::${issue.severity}`
    if (!map.has(key)) {
      map.set(key, {
        type: issue.type,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        pageCount: 0,
        totalCount: 0,
        affectedUrls: [],
        representative: issue,
        all: [],
      })
    }
    const g = map.get(key)!
    g.totalCount++
    g.all.push(issue)
    const url = typeof issue.details?.url === 'string' ? issue.details.url : null
    if (url && !g.affectedUrls.includes(url)) {
      g.affectedUrls.push(url)
      g.pageCount++
    }
  }

  return Array.from(map.values())
}

// ── Friendly scan failure messages ────────────────────────────────────────────

function getFriendlyError(raw: string | null): string {
  if (!raw) return 'The scan failed unexpectedly. Please try again.'
  // Already categorised by scanner — just pass through
  return raw
}

// ── Network request row ───────────────────────────────────────────────────────

function NetworkRow({ req }: { req: NetworkRequest }) {
  const badgeColor = req.failed
    ? 'text-red-400 bg-red-500/10'
    : req.statusCode && req.statusCode >= 400
    ? 'text-yellow-400 bg-yellow-500/10'
    : 'text-green-400 bg-green-500/10'

  const statusText = req.failed
    ? req.errorText?.slice(0, 20) ?? 'FAILED'
    : String(req.statusCode ?? '—')

  const typeLabel: Record<string, string> = {
    xhr: 'XHR', fetch: 'Fetch', script: 'JS', stylesheet: 'CSS',
    document: 'Doc', image: 'Img', font: 'Font',
  }

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-zinc-900/60 text-xs">
      <span
        className={`shrink-0 w-14 text-center font-mono rounded px-1.5 py-0.5 text-xs font-medium ${badgeColor}`}
      >
        {statusText}
      </span>
      <span className="shrink-0 w-10 text-zinc-600 font-mono">{typeLabel[req.resourceType] ?? req.resourceType}</span>
      <span className="shrink-0 w-8 text-zinc-600">{req.method}</span>
      <span className="flex-1 font-mono text-zinc-400 truncate" title={req.url}>
        {truncateUrl(req.url, 70)}
      </span>
      {req.responseTimeMs > 0 && (
        <span className={`shrink-0 font-mono ${req.responseTimeMs > 1000 ? 'text-yellow-400' : 'text-zinc-600'}`}>
          {req.responseTimeMs}ms
        </span>
      )}
      {req.responseSizeBytes !== null && (
        <span className="shrink-0 text-zinc-700">
          {req.responseSizeBytes > 1024
            ? `${(req.responseSizeBytes / 1024).toFixed(0)}k`
            : `${req.responseSizeBytes}b`}
        </span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ResultsDashboard({ scanId }: ResultsDashboardProps) {
  const router = useRouter()
  const [data, setData] = useState<ScanStatusResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const stopPollingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [copied, setCopied] = useState(false)
  const [rescanPending, startRescan] = useTransition()

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
      if (json.scan.status === 'failed') {
        setIsPolling(false)
      } else if (json.scan.status === 'completed') {
        if (json.scan.ai_overview) {
          // AI results are in — stop polling
          if (stopPollingTimer.current) clearTimeout(stopPollingTimer.current)
          setIsPolling(false)
        } else if (!stopPollingTimer.current) {
          // Keep polling up to 20s to catch AI analysis results
          stopPollingTimer.current = setTimeout(() => setIsPolling(false), 20000)
        }
      }
    } catch (err) {
      console.error('Poll error:', err)
    }
  }, [scanId])

  useEffect(() => { fetchResults() }, [fetchResults])

  useEffect(() => {
    return () => { if (stopPollingTimer.current) clearTimeout(stopPollingTimer.current) }
  }, [])

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

  const copyShareLink = useCallback(() => {
    const shareUrl = `${window.location.origin}/report/${scanId}`
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [scanId])

  const handleRescan = useCallback(() => {
    if (!data) return
    startRescan(async () => {
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: data.scan.url }),
        })
        if (res.ok) {
          const { scanId: newId } = await res.json()
          router.push(`/scan/${newId}`)
        }
      } catch {
        // silently ignore
      }
    })
  }, [data, router])

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

  const { scan, pages, issues, logs } = data
  const isRunning = scan.status === 'running' || scan.status === 'pending'
  const isFailed = scan.status === 'failed'
  const isComplete = scan.status === 'completed'

  const criticalIssues = issues.filter((i) => i.severity === 'critical')
  const mediumIssues = issues.filter((i) => i.severity === 'medium')
  const lowIssues = issues.filter((i) => i.severity === 'low')

  const isClean = isComplete && scan.score !== null && scan.score >= 90 && criticalIssues.length === 0

  const scanProgress = isComplete
    ? 100
    : scan.total_pages > 0
    ? Math.min((scan.total_pages / MAX_PAGES_PER_SCAN) * 100, 90)
    : 15

  const lastScannedUrl = pages.length > 0 ? pages[pages.length - 1]?.url : null

  // Group issues by type for de-duplicated display
  const groupedCritical = groupIssues(criticalIssues)
  const groupedMedium = groupIssues(mediumIssues)
  const groupedLow = groupIssues(lowIssues)

  const filteredGroups =
    severityFilter === 'all'
      ? [...groupedCritical, ...groupedMedium, ...groupedLow]
      : severityFilter === 'critical'
      ? groupedCritical
      : severityFilter === 'medium'
      ? groupedMedium
      : groupedLow

  // All network requests across all pages (for the network tab)
  const allNetworkRequests: NetworkRequest[] = pages.flatMap(
    (p) => (p.network_details as NetworkRequest[] | null) ?? []
  )
  const failedNetworkRequests = allNetworkRequests.filter((r) => r.failed)

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

        <div className="flex items-center gap-2 flex-wrap">
          {isComplete && (
            <>
              <button
                onClick={copyShareLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-sm transition-colors"
                title="Copy shareable link"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Share2 className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Share'}
              </button>
              <a
                href={(() => {
                  const reportUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://qa.viyalabs.com'}/report/${scanId}`
                  const scoreText = scan.score !== null ? ` (score: ${scan.score}/100)` : ''
                  const issueText = issues.length > 0
                    ? `Found ${issues.length} issue${issues.length !== 1 ? 's' : ''}${scoreText} automatically.`
                    : `Zero bugs found${scoreText}. ✅`
                  const text = `Just ran AgentQA on my app — ${issueText} No QA team, no setup. Free browser testing in under 2 min.\n\n${reportUrl} via @viyalabs`
                  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
                })()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-sm transition-colors"
                title="Share on X / Twitter"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Post
              </a>
              <button
                onClick={exportReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-sm transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export JSON
              </button>
              <button
                onClick={handleRescan}
                disabled={rescanPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rescanPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                Rescan
              </button>
            </>
          )}

          {isRunning && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning in progress…
            </div>
          )}
          {isComplete && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Scan complete
            </div>
          )}
          {isFailed && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <XCircle className="h-4 w-4" />
              Scan failed
            </div>
          )}
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            New scan
          </Link>
        </div>
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>
              {lastScannedUrl
                ? <>Scanning page {scan.total_pages} of {MAX_PAGES_PER_SCAN}:{' '}
                    <span className="font-mono text-zinc-400">{truncateUrl(lastScannedUrl, 55)}</span>
                  </>
                : 'Starting scan…'}
            </span>
            <span>{scan.total_pages} / {MAX_PAGES_PER_SCAN}</span>
          </div>
          <Progress value={scanProgress} className="h-1.5" />
        </div>
      )}

      {isRunning && <NotifyWhenDone scanId={scanId} alreadySet={Boolean(scan.notify_email)} />}

      {/* Real-time scan log terminal */}
      {(isRunning || (isComplete && logs.length > 0)) && (
        <ScanLogTerminal logs={logs} isRunning={isRunning} />
      )}

      {/* Partial results warning */}
      {isComplete && scan.error_message?.includes('partial') && (
        <div className="p-3 rounded-lg bg-yellow-950/20 border border-yellow-500/20 text-yellow-400 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          {scan.error_message}
        </div>
      )}

      {/* Failure message */}
      {isFailed && scan.error_message && (
        <div className="p-4 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400 text-sm space-y-3">
          <p><strong>Scan failed:</strong> {getFriendlyError(scan.error_message)}</p>
          <div className="flex gap-3 flex-wrap text-xs text-red-500/80">
            <span>Possible causes: bot protection · CAPTCHA · site unreachable · auth required</span>
          </div>
          <button
            onClick={handleRescan}
            disabled={rescanPending}
            className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      )}

      {/* Success empty state */}
      {isClean && (
        <div className="p-5 rounded-xl bg-green-950/20 border border-green-500/20 flex items-start gap-4">
          <CheckCircle2 className="h-8 w-8 text-green-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-green-300 font-semibold text-base mb-1">
              Great news — no critical issues detected
            </h3>
            <p className="text-green-600 text-sm">
              All scanned pages passed with a score of{' '}
              <span className="text-green-400 font-bold">{scan.score}/100</span>. Minor warnings
              may still exist — check the Low severity tab.
            </p>
          </div>
        </div>
      )}

      {/* Score + stats */}
      {(isComplete || scan.total_pages > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                <div className="text-4xl font-bold text-white tabular-nums">{scan.total_pages}</div>
                <Globe className="h-5 w-5 text-zinc-600 mb-1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Total Issues</div>
              <div className="text-4xl font-bold text-white tabular-nums">{scan.total_issues}</div>
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

      {/* AI Overview */}
      {isComplete && scan.ai_overview && (
        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">AI Overview</span>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">{scan.ai_overview}</p>
        </div>
      )}

      {/* Main tabs */}
      <Tabs defaultValue="issues">
        <TabsList>
          <TabsTrigger value="issues">
            Issues {issues.length > 0 && <span className="ml-1.5 tabular-nums">({issues.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="network">
            Network {allNetworkRequests.length > 0 && (
              <span className="ml-1.5 tabular-nums">
                ({failedNetworkRequests.length > 0 ? (
                  <span className="text-red-400">{failedNetworkRequests.length} failed</span>
                ) : allNetworkRequests.length})
              </span>
            )}
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
                    f === 'critical'
                      ? isActive ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-500/30'
                      : f === 'medium'
                      ? isActive ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400' : 'border-zinc-700 text-zinc-500 hover:text-yellow-400 hover:border-yellow-500/30'
                      : f === 'low'
                      ? isActive ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : 'border-zinc-700 text-zinc-500 hover:text-blue-400 hover:border-blue-500/30'
                      : isActive ? 'border-zinc-600 bg-zinc-800 text-zinc-200' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                  return (
                    <button
                      key={f}
                      onClick={() => setSeverityFilter(f)}
                      aria-pressed={isActive}
                      className={`px-3 py-1 rounded-lg border text-xs font-medium transition-colors capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${colorClass}`}
                    >
                      {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                    </button>
                  )
                })}
                <span className="ml-auto text-xs text-zinc-600 flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  Grouped by type
                </span>
              </div>

              {/* Grouped issue sections */}
              <div className="space-y-6">
                {(severityFilter === 'all' || severityFilter === 'critical') && groupedCritical.length > 0 && (
                  <IssueSection
                    label="Critical"
                    groups={groupedCritical}
                    iconColor="text-red-400"
                    Icon={AlertCircle}
                  />
                )}
                {(severityFilter === 'all' || severityFilter === 'medium') && groupedMedium.length > 0 && (
                  <IssueSection
                    label="Medium"
                    groups={groupedMedium}
                    iconColor="text-yellow-400"
                    Icon={AlertTriangle}
                  />
                )}
                {(severityFilter === 'all' || severityFilter === 'low') && groupedLow.length > 0 && (
                  <IssueSection
                    label="Low"
                    groups={groupedLow}
                    iconColor="text-blue-400"
                    Icon={Info}
                  />
                )}

                {filteredGroups.length === 0 && severityFilter !== 'all' && (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                    <CheckCircle2 className="h-6 w-6 text-green-500 mb-2" />
                    <p className="text-sm">No {severityFilter} issues found.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Network tab */}
        <TabsContent value="network">
          {allNetworkRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
              {isRunning ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin mb-3" />
                  <p className="text-sm">Collecting network data…</p>
                </>
              ) : (
                <>
                  <Wifi className="h-8 w-8 mb-3" />
                  <p className="text-sm">No network requests recorded.</p>
                  <p className="text-xs mt-1">Only XHR, Fetch, scripts, and stylesheets are tracked.</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary row */}
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <Wifi className="h-3.5 w-3.5 text-green-400" />
                  {allNetworkRequests.filter((r) => !r.failed).length} successful
                </span>
                {failedNetworkRequests.length > 0 && (
                  <span className="flex items-center gap-1.5 text-red-400">
                    <WifiOff className="h-3.5 w-3.5" />
                    {failedNetworkRequests.length} failed
                  </span>
                )}
                <span className="text-zinc-700">
                  Across {pages.filter((p) => p.network_details).length} pages
                </span>
              </div>

              {/* Per-page breakdown */}
              {pages
                .filter((p) => p.network_details && (p.network_details as NetworkRequest[]).length > 0)
                .map((page) => {
                  const reqs = page.network_details as NetworkRequest[]
                  const failed = reqs.filter((r) => r.failed)
                  return (
                    <div key={page.id} className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-zinc-500 px-1">
                        <Globe className="h-3 w-3 shrink-0" />
                        <span className="font-mono truncate">{truncateUrl(page.url, 70)}</span>
                        {failed.length > 0 && (
                          <span className="shrink-0 text-red-400">{failed.length} failed</span>
                        )}
                      </div>
                      <Card>
                        <CardContent className="p-1">
                          <div className="divide-y divide-zinc-800/50">
                            {/* Show failed first, then successful */}
                            {[...reqs.filter((r) => r.failed), ...reqs.filter((r) => !r.failed)].map(
                              (req, i) => <NetworkRow key={i} req={req} />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })}
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
                          <span title="Load time">{formatDuration(page.load_time_ms)}</span>
                        )}
                        {page.has_console_errors && (
                          <span className="text-red-500 font-medium">Errors</span>
                        )}
                        {page.has_network_failures && (
                          <span className="text-yellow-500 font-medium">Net</span>
                        )}
                        {page.has_mobile_issues && (
                          <span
                            className="flex items-center gap-0.5 text-orange-400 font-medium"
                            title="Mobile layout overflow detected"
                          >
                            <Smartphone className="h-3 w-3" />
                            Mobile
                          </span>
                        )}
                        {page.video_url && (
                          <a
                            href={page.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-blue-400 hover:text-blue-300 transition-colors font-medium"
                            title="Watch failure replay video"
                          >
                            <Video className="h-3 w-3" />
                            Replay
                          </a>
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

      {/* Post-scan conversion: email capture + secondary CTA */}
      {isComplete && (
        <div className="mt-10 space-y-3">
          <ReportEmailCapture scanId={scanId} scannedUrl={scan.url} />
          <div className="flex items-center justify-between px-1">
            <p className="text-zinc-600 text-xs">AgentQA is free — no account required.</p>
            <Link
              href="/"
              className="text-sm text-zinc-400 hover:text-white transition-colors underline underline-offset-2"
            >
              Scan another app →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ScanLogTerminal — real-time scan log feed ─────────────────────────────────

function ScanLogTerminal({ logs, isRunning }: { logs: ScanLog[]; isRunning: boolean }) {
  const visibleLogs = logs.slice(-12) // show last 12 entries
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        </div>
        <span className="text-xs text-zinc-500 font-mono ml-1">scan log</span>
        {isRunning && <Loader2 className="h-3 w-3 text-blue-400 animate-spin ml-auto" />}
      </div>
      <div className="p-3 font-mono text-xs space-y-1 min-h-[80px]">
        {visibleLogs.length === 0 ? (
          <span className="text-zinc-600">Waiting for scan to start…</span>
        ) : (
          visibleLogs.map((entry) => (
            <div key={entry.id} className="flex gap-2 text-zinc-400">
              <span className="text-zinc-700 shrink-0">
                {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={
                entry.message.toLowerCase().includes('complete') ? 'text-green-400' :
                entry.message.toLowerCase().includes('fail') ? 'text-red-400' :
                entry.message.toLowerCase().includes('upload') ? 'text-blue-400' :
                'text-zinc-300'
              }>
                {entry.message}
              </span>
            </div>
          ))
        )}
        {isRunning && (
          <div className="flex gap-2 text-zinc-600">
            <span className="animate-pulse">▋</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── IssueSection — renders grouped issues under a severity heading ─────────────

interface IssueSectionProps {
  label: string
  groups: GroupedIssue[]
  iconColor: string
  Icon: React.ElementType
}

function IssueSection({ label, groups, iconColor, Icon }: IssueSectionProps) {
  const totalRaw = groups.reduce((s, g) => s + g.totalCount, 0)
  return (
    <div>
      <h3 className={`flex items-center gap-2 text-sm font-semibold ${iconColor} mb-3`}>
        <Icon className="h-4 w-4" />
        {label} ({totalRaw})
      </h3>
      <div className="space-y-2">
        {groups.map((g) => (
          <IssueCard
            key={`${g.type}-${g.severity}`}
            issue={g.representative}
            pageCount={g.pageCount > 1 ? g.pageCount : undefined}
            totalCount={g.totalCount > 1 ? g.totalCount : undefined}
          />
        ))}
      </div>
    </div>
  )
}
