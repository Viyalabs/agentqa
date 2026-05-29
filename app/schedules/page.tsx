'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity, AlertCircle, Calendar, CheckCircle2, ChevronRight,
  Clock, ExternalLink, Loader2, Pause, Play, Plus, RotateCcw,
  Settings, Trash2, X, Zap,
} from 'lucide-react'
import type { ScanSchedule, ScheduleCadence } from '@/types'

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

// ── ScheduleCard ──────────────────────────────────────────────────────────────

function ScheduleCard({
  schedule,
  onPause, onResume, onDelete, onRunNow,
}: {
  schedule: ScanSchedule
  onPause:  (id: string) => Promise<void>
  onResume: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRunNow: (id: string) => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const cadence = CADENCE_CFG[schedule.cadence] ?? CADENCE_CFG.manual
  const status  = statusOf(schedule)
  const isPaused = !!schedule.paused_reason || !schedule.enabled

  async function act(action: string, fn: () => Promise<void>) {
    setBusy(action)
    try { await fn() } finally { setBusy(null) }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} />
            <span className="text-base font-semibold text-white truncate">{schedule.domain}</span>
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${cadence.cls}`}>
              {cadence.label}
            </span>
            <span className={`text-[10px] font-medium ${status.text}`}>{status.label}</span>
          </div>
          <p className="text-xs text-zinc-600 font-mono mt-0.5 truncate">{schedule.url}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => act('run', () => onRunNow(schedule.id))}
            disabled={!schedule.enabled || !!busy}
            title="Run now"
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {busy === 'run' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          </button>
          <Link href={`/schedules/${schedule.id}`} title="Settings" className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
            <Settings className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => isPaused
              ? act('resume', () => onResume(schedule.id))
              : act('pause',  () => onPause(schedule.id))
            }
            disabled={!!busy}
            title={isPaused ? 'Resume' : 'Pause'}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-30"
          >
            {busy === 'pause' || busy === 'resume'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />
            }
          </button>
          <button
            onClick={() => act('delete', () => onDelete(schedule.id))}
            disabled={!!busy}
            title="Delete"
            className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
          >
            {busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 px-4 pb-3 text-xs text-zinc-500 flex-wrap">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Last scan:
          <span className="text-zinc-400">{timeAgo(schedule.last_run_at)}</span>
        </span>
        {schedule.cadence !== 'webhook' && schedule.cadence !== 'manual' && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Next:
            <span className="text-zinc-400">{timeUntil(schedule.next_run_at)}</span>
          </span>
        )}
        {schedule.cadence === 'webhook' && (
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-cyan-500" />
            <span className="text-cyan-600">Webhook triggered</span>
          </span>
        )}
        {schedule.consecutive_failures > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertCircle className="h-3 w-3" />
            {schedule.consecutive_failures} consecutive failure{schedule.consecutive_failures !== 1 ? 's' : ''}
          </span>
        )}
        {schedule.last_scan_id && (
          <Link
            href={`/report/${schedule.last_scan_id}`}
            className="flex items-center gap-1 ml-auto text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            View latest <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  )
}

// ── NewScheduleForm ───────────────────────────────────────────────────────────

function NewScheduleForm({
  defaultEmail,
  onCreated,
  onCancel,
}: {
  defaultEmail: string
  onCreated: (s: ScanSchedule) => void
  onCancel:  () => void
}) {
  const [url,     setUrl]     = useState('')
  const [cadence, setCadence] = useState<ScheduleCadence>('weekly')
  const [email,   setEmail]   = useState(defaultEmail)
  const [busy,    setBusy]    = useState(false)
  const [err,     setErr]     = useState<string | null>(null)
  const [secret,  setSecret]  = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      const res = await fetch('/api/schedules', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ url, cadence, email }),
      })
      const json = await res.json()
      if (!res.ok) { setErr(json.error ?? 'Failed to create schedule'); return }
      if (json.webhook_secret) setSecret(json.webhook_secret)
      else onCreated(json as ScanSchedule)
    } catch {
      setErr('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (secret) {
    return (
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Schedule created — save your webhook secret
        </div>
        <p className="text-xs text-zinc-500">
          Send a POST request to <code className="text-zinc-300">/api/schedules/…/trigger</code> with header{' '}
          <code className="text-zinc-300">x-signature: sha256=&lt;HMAC&gt;</code> to trigger scans on deploy.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-cyan-300 truncate">
            {secret}
          </code>
        </div>
        <button
          onClick={() => onCancel()}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Done — close
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-200">New Schedule</span>
        <button type="button" onClick={onCancel} className="text-zinc-600 hover:text-zinc-400 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="url"
          placeholder="https://yoursite.com"
          value={url}
          onChange={e => setUrl(e.target.value)}
          required
          className="sm:col-span-2 bg-zinc-800/60 border border-zinc-700/60 rounded-lg px-3 py-1.5 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
        />
        <select
          value={cadence}
          onChange={e => setCadence(e.target.value as ScheduleCadence)}
          className="bg-zinc-800/60 border border-zinc-700/60 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="webhook">On Deploy</option>
        </select>
      </div>

      <input
        type="email"
        placeholder="notify@yourcompany.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-lg px-3 py-1.5 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
      />

      {err && <p className="text-xs text-red-400">{err}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium text-white transition-colors"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Create Schedule
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SchedulesPage() {
  const router = useRouter()
  const [email,     setEmail]     = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [schedules, setSchedules] = useState<ScanSchedule[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [showNew,   setShowNew]   = useState(false)

  const fetchSchedules = useCallback(async (e: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/schedules?email=${encodeURIComponent(e)}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to load'); return }
      setSchedules(json.schedules ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('agentqa_email')
    if (saved) { setEmail(saved); setEmailDraft(saved); fetchSchedules(saved) }
  }, [fetchSchedules])

  function submitEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!emailDraft) return
    localStorage.setItem('agentqa_email', emailDraft)
    setEmail(emailDraft)
    fetchSchedules(emailDraft)
  }

  async function handlePause(id: string) {
    await fetch(`/api/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paused_reason: 'user' }),
    })
    await fetchSchedules(email)
  }

  async function handleResume(id: string) {
    await fetch(`/api/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    })
    await fetchSchedules(email)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this schedule? This cannot be undone.')) return
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
    setSchedules(prev => prev.filter(s => s.id !== id))
  }

  async function handleRunNow(id: string) {
    const res = await fetch(`/api/schedules/${id}/run`, { method: 'POST' })
    const json = await res.json()
    if (res.ok && json.scanId) router.push(`/report/${json.scanId}`)
    else alert(json.error ?? 'Failed to start scan')
  }

  const activeCount = schedules.filter(s => s.enabled && !s.paused_reason).length
  const pausedCount = schedules.filter(s => s.paused_reason || !s.enabled).length

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <nav className="sticky top-0 z-40 border-b border-zinc-800/50 bg-[#0A0A0F]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-white">
            <Activity className="h-5 w-5 text-blue-400" />
            AgentQA
          </Link>
          <div className="flex items-center gap-5 text-sm text-zinc-400">
            <Link href="/scans"    className="hover:text-zinc-200 transition-colors">Scans</Link>
            <Link href="/"         className="hover:text-zinc-200 transition-colors">Run a scan →</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">My Schedules</h1>
            <p className="text-sm text-zinc-500">
              Automated QA testing on a recurring schedule.
            </p>
          </div>
          {email && (
            <button
              onClick={() => setShowNew(v => !v)}
              className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          )}
        </div>

        {/* Email lookup */}
        {!email && (
          <form onSubmit={submitEmail} className="flex gap-2 max-w-sm">
            <input
              type="email"
              placeholder="Enter your email to view schedules"
              value={emailDraft}
              onChange={e => setEmailDraft(e.target.value)}
              required
              className="flex-1 bg-zinc-800/60 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
              Lookup
            </button>
          </form>
        )}

        {/* Email shown + change */}
        {email && (
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs text-zinc-600 font-mono">{email}</span>
            <button
              onClick={() => { setEmail(''); setEmailDraft(''); setSchedules([]) }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              change
            </button>
          </div>
        )}

        {/* Stats strip */}
        {schedules.length > 0 && (
          <div className="flex items-center gap-6 mb-6 text-xs text-zinc-600">
            <span>
              <span className="text-emerald-400 font-mono font-semibold">{activeCount}</span> active
            </span>
            {pausedCount > 0 && (
              <span>
                <span className="text-amber-400 font-mono font-semibold">{pausedCount}</span> paused
              </span>
            )}
            <span>{schedules.length} total</span>
          </div>
        )}

        {/* New schedule form */}
        {showNew && email && (
          <div className="mb-4">
            <NewScheduleForm
              defaultEmail={email}
              onCreated={() => { setShowNew(false); fetchSchedules(email) }}
              onCancel={() => setShowNew(false)}
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-zinc-600 text-sm py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading schedules…
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm py-4">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && email && schedules.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-600">
            <Calendar className="h-10 w-10 mb-4" />
            <p className="text-sm font-medium text-zinc-400 mb-1">No schedules found for {email}</p>
            <p className="text-xs mb-6">
              Run a scan and click "Add to Monitor" to set up automated checking.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors"
              >
                Run a scan
              </Link>
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
              >
                <Plus className="h-4 w-4" /> Create manually
              </button>
            </div>
          </div>
        )}

        {/* Schedule cards */}
        {!loading && schedules.length > 0 && (
          <div className="space-y-3">
            {schedules.map(s => (
              <ScheduleCard
                key={s.id}
                schedule={s}
                onPause={handlePause}
                onResume={handleResume}
                onDelete={handleDelete}
                onRunNow={handleRunNow}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
