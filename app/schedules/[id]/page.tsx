'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import {
  Activity, AlertCircle, ArrowLeft, Calendar, CheckCircle2,
  ChevronDown, Clock, Copy, ExternalLink, Loader2,
  Pause, Play, RotateCcw, Trash2, Zap,
} from 'lucide-react'
import { getScoreColor } from '@/lib/utils'
import type { ScanSchedule, ScheduleCadence } from '@/types'

// ── types ─────────────────────────────────────────────────────────────────────

interface RunScan {
  id: string
  score: number | null
  status: string
  total_issues: number
  total_pages: number
  completed_at: string | null
}

interface EnrichedRun {
  id: string
  scan_id: string
  triggered_by: string
  created_at: string
  scan: RunScan | null
}

// ── helpers ───────────────────────────────────────────────────────────────────

const CADENCE_CFG: Record<ScheduleCadence, { label: string; cls: string }> = {
  daily:   { label: 'Daily',     cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  weekly:  { label: 'Weekly',    cls: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  webhook: { label: 'On Deploy', cls: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  manual:  { label: 'Manual',    cls: 'text-zinc-400 bg-zinc-500/10 border-zinc-600/20' },
}

function statusOf(s: ScanSchedule) {
  if (s.paused_reason === 'failures')
    return { label: `Failing (${s.consecutive_failures}×)`, dot: 'bg-red-500',    text: 'text-red-400' }
  if (s.paused_reason)
    return { label: 'Paused',  dot: 'bg-amber-500',  text: 'text-amber-400' }
  if (!s.enabled)
    return { label: 'Disabled', dot: 'bg-zinc-600',   text: 'text-zinc-500' }
  return   { label: 'Active',  dot: 'bg-emerald-500', text: 'text-emerald-400' }
}

function timeUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'overdue'
  const m = Math.round(ms / 60000)
  if (m < 60) return `in ${m}m`
  const h = Math.round(ms / 3600000)
  if (h < 24) return `in ${h}h`
  return `in ${Math.round(ms / 86400000)}d`
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.round(ms / 60000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(ms / 3600000)
  if (h < 24) return `${h}h ago`
  return `${Math.round(ms / 86400000)}d ago`
}

function triggerBadge(by: string) {
  const cfg: Record<string, string> = {
    cron:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
    webhook: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    manual:  'text-zinc-400 bg-zinc-500/10 border-zinc-600/20',
    retry:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
  }
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${cfg[by] ?? cfg.manual}`}>
      {by}
    </span>
  )
}

// ── WebhookSection ────────────────────────────────────────────────────────────

function WebhookSection({ scheduleId, secret }: { scheduleId: string; secret: string }) {
  const [copied, setCopied] = useState<string | null>(null)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const endpoint = `${origin}/api/schedules/${scheduleId}/trigger`

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/60">
        <Zap className="h-3.5 w-3.5 text-cyan-500" />
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Webhook Setup</span>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-xs text-zinc-500">
          Send a <code className="text-zinc-300 bg-zinc-800 px-1 rounded">POST</code> request to the endpoint below with a signed body.
          AgentQA will verify the{' '}
          <code className="text-zinc-300 bg-zinc-800 px-1 rounded">x-signature</code> header using HMAC-SHA256.
        </p>

        <div className="space-y-2">
          <label className="text-[10px] text-zinc-600 uppercase tracking-wider font-mono">Endpoint</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-300 truncate">
              POST {endpoint}
            </code>
            <button
              onClick={() => copy(`POST ${endpoint}`, 'endpoint')}
              className="shrink-0 p-2 rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
            >
              {copied === 'endpoint' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-zinc-600 uppercase tracking-wider font-mono">Webhook Secret</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-cyan-300 truncate">
              {secret}
            </code>
            <button
              onClick={() => copy(secret, 'secret')}
              className="shrink-0 p-2 rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
            >
              {copied === 'secret' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <details className="group">
          <summary className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors list-none">
            <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180 transition-transform" />
            Example — GitHub Actions
          </summary>
          <pre className="mt-3 text-[11px] font-mono bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 text-zinc-400 overflow-x-auto leading-relaxed">{`- name: Trigger AgentQA scan
  run: |
    BODY='{}'
    SIG="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$AGENTQA_SECRET" -hex | sed 's/.*= //')"
    curl -s -X POST "${endpoint}" \\
      -H "Content-Type: application/json" \\
      -H "x-signature: $SIG" \\
      -d "$BODY"
  env:
    AGENTQA_SECRET: \${{ secrets.AGENTQA_WEBHOOK_SECRET }}`}
          </pre>
        </details>
      </div>
    </div>
  )
}

// ── RunHistoryTable ───────────────────────────────────────────────────────────

function RunHistoryTable({ runs }: { runs: EnrichedRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-600 text-sm">
        No runs yet. Trigger a scan to see history here.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800/60 bg-zinc-900/40">
            <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
            <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Score</th>
            <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Issues</th>
            <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Trigger</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {runs.map((run, i) => (
            <tr key={run.id} className={`border-b border-zinc-800/30 last:border-0 ${i % 2 === 0 ? '' : 'bg-zinc-900/10'}`}>
              <td className="px-4 py-2.5 text-xs text-zinc-400 font-mono whitespace-nowrap">
                {timeAgo(run.scan?.completed_at ?? run.created_at)}
              </td>
              <td className="px-4 py-2.5">
                {run.scan?.score != null ? (
                  <span className={`text-sm font-bold font-mono tabular-nums ${getScoreColor(run.scan.score)}`}>
                    {run.scan.score}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-600">
                    {run.scan?.status === 'pending' || run.scan?.status === 'running' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                    ) : '—'}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-zinc-500 hidden sm:table-cell">
                {run.scan?.total_issues ?? '—'}
              </td>
              <td className="px-4 py-2.5">{triggerBadge(run.triggered_by)}</td>
              <td className="px-4 py-2.5 text-right">
                {run.scan?.status === 'completed' ? (
                  <Link
                    href={`/report/${run.scan_id}`}
                    className="flex items-center justify-end gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : run.scan?.status ? (
                  <span className="text-[10px] text-zinc-600 capitalize">{run.scan.status}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScheduleDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [schedule, setSchedule]   = useState<ScanSchedule | null>(null)
  const [runs,     setRuns]       = useState<EnrichedRun[]>([])
  const [loading,  setLoading]    = useState(true)
  const [error,    setError]      = useState<string | null>(null)

  // config edit state
  const [cadence,  setCadence]    = useState<ScheduleCadence>('weekly')
  const [email,    setEmail]      = useState('')
  const [saving,   setSaving]     = useState(false)
  const [saved,    setSaved]      = useState(false)

  // action busy state
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/schedules/${id}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Not found'); return }
      setSchedule(json.schedule)
      setRuns(json.runs ?? [])
      setCadence(json.schedule.cadence)
      setEmail(json.schedule.notify_email)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    const res = await fetch(`/api/schedules/${id}`, {
      method:  'PATCH',
      headers: { 'content-type': 'application/json', 'x-notify-email': email },
      body:    JSON.stringify({ cadence, notify_email: email }),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      await load()
    }
    setSaving(false)
  }

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key)
    try { await fn() } finally { setBusy(null) }
  }

  async function handlePause() {
    await fetch(`/api/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paused_reason: 'user' }),
    })
    await load()
  }

  async function handleResume() {
    await fetch(`/api/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    })
    await load()
  }

  async function handleDelete() {
    if (!confirm('Delete this schedule permanently?')) return
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
    router.push('/schedules')
  }

  async function handleRunNow() {
    const res  = await fetch(`/api/schedules/${id}/run`, { method: 'POST' })
    const json = await res.json()
    if (res.ok && json.scanId) router.push(`/report/${json.scanId}`)
    else alert(json.error ?? 'Failed to start scan')
  }

  // ── render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
      </div>
    )
  }

  if (error || !schedule) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-zinc-400 text-sm">{error ?? 'Schedule not found'}</p>
        <Link href="/schedules" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          ← Back to schedules
        </Link>
      </div>
    )
  }

  const cadenceCfg = CADENCE_CFG[schedule.cadence] ?? CADENCE_CFG.manual
  const status     = statusOf(schedule)
  const isPaused   = !!schedule.paused_reason || !schedule.enabled
  const totalRuns  = runs.length

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <nav className="sticky top-0 z-40 border-b border-zinc-800/50 bg-[#0A0A0F]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-white">
            <Activity className="h-5 w-5 text-blue-400" />
            AgentQA
          </Link>
          <div className="flex items-center gap-5 text-sm text-zinc-400">
            <Link href="/schedules" className="hover:text-zinc-200 transition-colors">My Schedules</Link>
            <Link href="/"          className="hover:text-zinc-200 transition-colors">Run a scan →</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        {/* Breadcrumb */}
        <Link href="/schedules" className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          My Schedules
        </Link>

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-3xl font-semibold tracking-tight text-white">{schedule.domain}</h1>
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${cadenceCfg.cls}`}>
                {cadenceCfg.label}
              </span>
              <span className={`flex items-center gap-1.5 text-xs font-medium ${status.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>
            <p className="text-sm text-zinc-600 font-mono">{schedule.url}</p>
          </div>

          <button
            onClick={() => act('run', handleRunNow)}
            disabled={!schedule.enabled || !!busy}
            className="flex items-center gap-2 shrink-0 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
          >
            {busy === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Run Now
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Next Run',
              value: schedule.cadence === 'webhook' || schedule.cadence === 'manual'
                ? (schedule.cadence === 'webhook' ? 'On deploy' : 'Manual')
                : isPaused ? 'Paused' : timeUntil(schedule.next_run_at),
              icon: <Calendar className="h-3.5 w-3.5" />,
            },
            {
              label: 'Last Run',
              value: timeAgo(schedule.last_run_at),
              icon:  <Clock className="h-3.5 w-3.5" />,
            },
            {
              label: 'Total Runs',
              value: String(totalRuns),
              icon:  <RotateCcw className="h-3.5 w-3.5" />,
            },
            {
              label: 'Failures',
              value: String(schedule.consecutive_failures),
              icon:  <AlertCircle className="h-3.5 w-3.5" />,
              warn:  schedule.consecutive_failures > 0,
            },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
              <div className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider mb-1.5 ${stat.warn ? 'text-red-400' : 'text-zinc-600'}`}>
                {stat.icon} {stat.label}
              </div>
              <div className={`text-lg font-bold font-mono tabular-nums ${stat.warn ? 'text-red-400' : 'text-zinc-200'}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Configuration */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/60">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Configuration</span>
          </div>
          <form onSubmit={saveConfig} className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-[10px] text-zinc-600 uppercase tracking-wider font-mono mb-1.5">Cadence</label>
                <select
                  value={cadence}
                  onChange={e => setCadence(e.target.value as ScheduleCadence)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="webhook">On Deploy (webhook)</option>
                  <option value="manual">Manual only</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] text-zinc-600 uppercase tracking-wider font-mono mb-1.5">Notify Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-sm font-medium text-white transition-colors"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save Changes
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Webhook setup */}
        {schedule.cadence === 'webhook' && schedule.webhook_secret && (
          <WebhookSection scheduleId={id} secret={schedule.webhook_secret} />
        )}

        {/* Run history */}
        <div>
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Run History <span className="text-zinc-700 font-mono">({totalRuns})</span>
          </h2>
          <RunHistoryTable runs={runs} />
        </div>

        {/* Danger zone */}
        <div className="rounded-xl border border-zinc-800/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/60">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Danger Zone</span>
          </div>
          <div className="p-4 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => act(isPaused ? 'resume' : 'pause', isPaused ? handleResume : handlePause)}
              disabled={!!busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white disabled:opacity-40 transition-colors"
            >
              {busy === 'pause' || busy === 'resume'
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />
              }
              {isPaused ? 'Resume Monitoring' : 'Pause Monitoring'}
            </button>

            <button
              onClick={() => act('delete', handleDelete)}
              disabled={!!busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-sm text-red-400 hover:border-red-500/60 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
            >
              {busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete Schedule
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
