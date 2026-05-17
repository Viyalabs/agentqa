'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  Globe,
  Calendar,
  Users,
  Zap,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle2,
} from 'lucide-react'

interface Metrics {
  computed_at: string
  active_domains_30d: number
  scans_7d: number
  active_schedules: number
  repeat_user_count: number
  cache_hit_rate_7d: number | null
  avg_rescans_per_domain: number
  top_domains: Array<{ domain: string; scan_count: number }>
  repeat_users: Array<{ email: string; scan_count: number; first_scan: string; last_scan: string }>
  schedule_health: Array<{ cadence: string; total: number; paused: number }>
  open_issues: { critical: number; medium: number; low: number; recurring: number }
}

function StatCard({ label, value, sub, icon: Icon, color = 'text-zinc-200' }: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-zinc-600" />
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-600 mt-1">{sub}</div>}
    </div>
  )
}

export default function InternalPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken]     = useState('')
  const [authed, setAuthed]   = useState(false)

  async function fetchMetrics(t: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/metrics', {
        headers: { 'x-founder-token': t },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `HTTP ${res.status}`)
        return
      }
      setMetrics(await res.json())
      setAuthed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('aq_founder_token')
    if (saved) { setToken(saved); fetchMetrics(saved) }
    else setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!authed && !loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="h-5 w-5 text-blue-400" />
            <span className="text-zinc-200 font-semibold">AgentQA Internal</span>
          </div>
          <input
            type="password"
            placeholder="Founder token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && token) {
                sessionStorage.setItem('aq_founder_token', token)
                fetchMetrics(token)
              }
            }}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 text-sm font-mono"
            autoFocus
          />
          <button
            onClick={() => { if (token) { sessionStorage.setItem('aq_founder_token', token); fetchMetrics(token) } }}
            disabled={!token || loading}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Enter'}
          </button>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (!metrics) return null

  const cacheHitPct = metrics.cache_hit_rate_7d !== null
    ? `${(metrics.cache_hit_rate_7d * 100).toFixed(1)}%`
    : 'n/a'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-400" />
            <h1 className="text-xl font-bold text-white">AgentQA — Platform Metrics</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-600 font-mono flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(metrics.computed_at).toLocaleTimeString()}
            </span>
            <button
              onClick={() => fetchMetrics(token)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active domains (30d)"  value={metrics.active_domains_30d}    icon={Globe}    />
          <StatCard label="Scans (7d)"             value={metrics.scans_7d}              icon={Activity} />
          <StatCard label="Active schedules"       value={metrics.active_schedules}      icon={Calendar} />
          <StatCard label="Repeat users (30d)"     value={metrics.repeat_user_count}     icon={Users}    />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="AI cache hit rate (7d)"
            value={cacheHitPct}
            sub="Issues served from pattern cache"
            icon={Zap}
            color={metrics.cache_hit_rate_7d !== null && metrics.cache_hit_rate_7d > 0.5 ? 'text-emerald-400' : 'text-zinc-200'}
          />
          <StatCard
            label="Avg rescans / domain"
            value={metrics.avg_rescans_per_domain.toFixed(1)}
            sub="Higher = stronger retention"
            icon={TrendingUp}
          />
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-zinc-600" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Open Issues</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-red-400">Critical</span>
                <span className="font-mono font-bold text-red-400 tabular-nums">{metrics.open_issues.critical}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-yellow-400">Medium</span>
                <span className="font-mono font-bold text-yellow-400 tabular-nums">{metrics.open_issues.medium}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Low</span>
                <span className="font-mono font-bold text-zinc-400 tabular-nums">{metrics.open_issues.low}</span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-zinc-800">
                <span className="text-orange-400">Recurring</span>
                <span className="font-mono text-orange-400 tabular-nums">{metrics.open_issues.recurring}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top domains */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-300">Top domains (30d)</span>
              <span className="text-xs text-zinc-600">{metrics.top_domains.length} domains</span>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {metrics.top_domains.length === 0 ? (
                <p className="text-sm text-zinc-600 p-5">No data yet</p>
              ) : (
                metrics.top_domains.map((d, i) => (
                  <div key={d.domain} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="text-xs font-mono text-zinc-700 w-5 tabular-nums">{i + 1}</span>
                    <span className="flex-1 text-sm font-mono text-zinc-300 truncate">{d.domain}</span>
                    <span className="text-xs font-mono text-zinc-500 tabular-nums shrink-0">{d.scan_count} scans</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Repeat users */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-300">Repeat users (30d)</span>
              <span className="text-xs text-zinc-600">{metrics.repeat_users.length} users</span>
            </div>
            <div className="divide-y divide-zinc-800/60 max-h-80 overflow-y-auto">
              {metrics.repeat_users.length === 0 ? (
                <p className="text-sm text-zinc-600 p-5">No repeat users yet</p>
              ) : (
                metrics.repeat_users.slice(0, 15).map((u) => (
                  <div key={u.email} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 truncate font-mono">{u.email}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {u.scan_count} scans · since {new Date(u.first_scan).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-400 tabular-nums shrink-0">{u.scan_count}×</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Schedule health */}
        {metrics.schedule_health.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-zinc-600" />
              Schedule health
            </h3>
            <div className="flex flex-wrap gap-4">
              {metrics.schedule_health.map((s) => (
                <div key={s.cadence} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200 capitalize">{s.cadence}</p>
                    <p className="text-xs text-zinc-600">{s.total} total · {s.paused} paused</p>
                  </div>
                  {s.paused === 0
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    : <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0" />
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-zinc-700 text-center">
          Internal use only · AgentQA · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
