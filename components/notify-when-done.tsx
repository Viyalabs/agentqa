'use client'

import { useState } from 'react'
import { Bell, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  scanId: string
}

type State = 'idle' | 'loading' | 'success' | 'error'

export function NotifyWhenDone({ scanId }: Props) {
  const [state, setState] = useState<State>('idle')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setState('loading')

    try {
      const res = await fetch(`/api/scan/${scanId}/notify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (res.ok) {
        setState('success')
        setMsg(data.message ?? "We'll email you the report link when the scan finishes.")
      } else {
        setState('error')
        setMsg(data.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setState('error')
      setMsg('Network error. Please try again.')
    }
  }

  if (state === 'success') {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-green-500/20 bg-green-500/5">
        <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
        <p className="text-green-300 text-sm">{msg}</p>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="h-4 w-4 text-blue-400 shrink-0" />
        <p className="text-white text-sm font-medium">Get notified when the scan is done</p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={state === 'loading'}
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={state === 'loading' || !email}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {state === 'loading' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            'Notify me'
          )}
        </button>
      </form>

      {state === 'error' && (
        <div className="flex items-center gap-1.5 mt-2 text-red-400 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {msg}
        </div>
      )}
    </div>
  )
}
