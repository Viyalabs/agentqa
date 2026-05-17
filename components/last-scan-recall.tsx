'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, ArrowRight, X } from 'lucide-react'

interface LastScan {
  url: string
  scanId: string
  ts: number
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function LastScanRecall() {
  const [last, setLast] = useState<LastScan | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('aqLastScan')
      if (!raw) return
      const parsed = JSON.parse(raw) as LastScan
      if (Date.now() - parsed.ts < MAX_AGE_MS) setLast(parsed)
    } catch { /* ok */ }
  }, [])

  if (!last || dismissed) return null

  let host = last.url
  try { host = new URL(last.url).hostname.replace(/^www\./, '') } catch { /* ok */ }

  return (
    <div className="mt-4 flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-500">Your last scan:</p>
        <p className="text-sm font-mono text-zinc-300 truncate">{host}</p>
      </div>
      <Link
        href={`/scan/${last.scanId}`}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
        title="Rescan this URL"
      >
        <RefreshCw className="h-3 w-3" />
        Rescan
      </Link>
      <Link
        href={`/report/${last.scanId}`}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium transition-colors border border-blue-500/20"
      >
        Report
        <ArrowRight className="h-3 w-3" />
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded text-zinc-600 hover:text-zinc-400 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
